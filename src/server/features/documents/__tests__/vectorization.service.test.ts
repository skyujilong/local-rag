/**
 * VectorizationService 单元测试
 *
 * 测试重点：
 * - vectorizeChunks: 批量生成向量并存储
 * - deleteDocumentVectors: 删除文档向量
 * - 异常处理（embedBatch / addDocumentEmbeddings 失败）
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// =====================================================
// Mock 外部依赖
// =====================================================

const mockEmbedBatch = vi.fn();
const mockAddDocumentEmbeddings = vi.fn();
const mockDeleteDocument = vi.fn();

// Use proxy file path (../../services/...) - matches what vectorization.service.ts imports
vi.mock('../../services/embeddings.js', () => ({
  embeddingService: {
    embedBatch: (...args: any[]) => mockEmbedBatch(...args),
  },
  EmbeddingService: vi.fn(),
}));

vi.mock('../../services/vectorstore.js', () => ({
  vectorStore: {
    addDocumentEmbeddings: (...args: any[]) => mockAddDocumentEmbeddings(...args),
    deleteDocument: (...args: any[]) => mockDeleteDocument(...args),
  },
  VectorStoreService: vi.fn(),
}));

vi.mock('../../../../shared/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// =====================================================
// 导入被测类
// =====================================================
import { VectorizationService } from '../services/vectorization.service.js';
import type { Chunk } from '../../../../shared/types/documents.js';

// =====================================================
// 工厂函数
// =====================================================

function makeChunk(index: number, content = `chunk ${index} 的内容`): Chunk {
  return {
    id: `chunk-id-${index}`,
    documentId: 'doc-123',
    content,
    index,
    metadata: {
      chunkId: `chunk-id-${index}`,
      documentId: 'doc-123',
      filePath: '/tmp/.devrag/notes/test.md',
      chunkIndex: index,
      startPosition: index * 100,
      endPosition: index * 100 + content.length,
      contentLength: content.length,
      sectionTitle: index === 0 ? '第一章' : undefined,
      sectionLevel: index === 0 ? 1 : undefined,
      isCodeBlock: index === 1,
      tags: ['react', 'tutorial'],
    },
  };
}

// =====================================================
// 测试套件
// =====================================================

describe('VectorizationService', () => {
  let service: VectorizationService;

  beforeEach(() => {
    vi.clearAllMocks();

    // 默认成功行为
    mockEmbedBatch.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => Array(768).fill(0.1)))
    );
    mockAddDocumentEmbeddings.mockResolvedValue(undefined);
    mockDeleteDocument.mockResolvedValue(undefined);

    service = new VectorizationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================================================
  // vectorizeChunks
  // ==================================================
  describe('vectorizeChunks', () => {
    it('应该为每个 chunk 生成向量并存储', async () => {
      const chunks = [makeChunk(0), makeChunk(1), makeChunk(2)];

      await service.vectorizeChunks('doc-123', '测试文档', chunks, ['react']);

      // embedBatch 应该以所有 chunk 的内容调用
      expect(mockEmbedBatch).toHaveBeenCalledTimes(1);
      const calledTexts = mockEmbedBatch.mock.calls[0][0];
      expect(calledTexts).toHaveLength(3);
      expect(calledTexts[0]).toBe(chunks[0].content);
      expect(calledTexts[1]).toBe(chunks[1].content);
      expect(calledTexts[2]).toBe(chunks[2].content);

      // addDocumentEmbeddings 应该以文档 ID 和向量数据调用
      expect(mockAddDocumentEmbeddings).toHaveBeenCalledTimes(1);
      expect(mockAddDocumentEmbeddings.mock.calls[0][0]).toBe('doc-123');
    });

    it('存储的数据应包含正确的 metadata', async () => {
      const chunk = makeChunk(0);

      await service.vectorizeChunks('doc-123', '测试文档标题', [chunk], ['react', 'tutorial']);

      const embeddingData = mockAddDocumentEmbeddings.mock.calls[0][1];
      const firstItem = embeddingData[0];

      expect(firstItem.id).toBe('chunk-id-0');
      expect(firstItem.content).toBe(chunk.content);
      expect(firstItem.embedding).toHaveLength(768);
      expect(firstItem.metadata.documentId).toBe('doc-123');
      expect(firstItem.metadata.title).toBe('测试文档标题');
      expect(firstItem.metadata.tags).toEqual(['react', 'tutorial']);
      expect(firstItem.metadata.chunkIndex).toBe(0);
      expect(firstItem.metadata.filePath).toBe('/tmp/.devrag/notes/test.md');
      expect(firstItem.metadata.createdAt).toBeDefined();
    });

    it('代码块 chunk 的 isCodeBlock 元数据应该正确传递', async () => {
      const codeChunk = makeChunk(1); // index=1 时 isCodeBlock=true

      await service.vectorizeChunks('doc-123', '文档', [codeChunk], []);

      const embeddingData = mockAddDocumentEmbeddings.mock.calls[0][1];
      expect(embeddingData[0].metadata.isCodeBlock).toBe(true);
    });

    it('空 chunks 数组应该正确处理（不调用存储）', async () => {
      await service.vectorizeChunks('doc-123', '文档', [], []);

      // embedBatch 以空数组调用
      expect(mockEmbedBatch).toHaveBeenCalledWith([]);
      // addDocumentEmbeddings 以空数组调用
      expect(mockAddDocumentEmbeddings).toHaveBeenCalledWith('doc-123', []);
    });

    it('embedBatch 失败时应该抛出错误', async () => {
      mockEmbedBatch.mockRejectedValue(new Error('Ollama 不可用'));

      const chunks = [makeChunk(0)];

      await expect(
        service.vectorizeChunks('doc-123', '文档', chunks, [])
      ).rejects.toThrow('Ollama 不可用');
    });

    it('addDocumentEmbeddings 失败时应该抛出错误', async () => {
      mockAddDocumentEmbeddings.mockRejectedValue(new Error('ChromaDB 写入失败'));

      const chunks = [makeChunk(0)];

      await expect(
        service.vectorizeChunks('doc-123', '文档', chunks, [])
      ).rejects.toThrow('ChromaDB 写入失败');
    });

    it('向量数量应该与 chunks 数量对应（一一映射）', async () => {
      const chunks = [makeChunk(0), makeChunk(1), makeChunk(2), makeChunk(3)];
      // 每个 chunk 对应一个不同的向量
      mockEmbedBatch.mockResolvedValue([
        Array(768).fill(0.1),
        Array(768).fill(0.2),
        Array(768).fill(0.3),
        Array(768).fill(0.4),
      ]);

      await service.vectorizeChunks('doc-123', '文档', chunks, []);

      const embeddingData = mockAddDocumentEmbeddings.mock.calls[0][1];
      expect(embeddingData).toHaveLength(4);
      // 验证向量与 chunk 的对应关系
      expect(embeddingData[0].embedding[0]).toBeCloseTo(0.1);
      expect(embeddingData[1].embedding[0]).toBeCloseTo(0.2);
      expect(embeddingData[2].embedding[0]).toBeCloseTo(0.3);
      expect(embeddingData[3].embedding[0]).toBeCloseTo(0.4);
    });
  });

  // ==================================================
  // deleteDocumentVectors
  // ==================================================
  describe('deleteDocumentVectors', () => {
    it('应该调用 vectorStore.deleteDocument', async () => {
      await service.deleteDocumentVectors('doc-456');

      expect(mockDeleteDocument).toHaveBeenCalledTimes(1);
      expect(mockDeleteDocument).toHaveBeenCalledWith('doc-456');
    });

    it('deleteDocument 失败时应该抛出错误', async () => {
      mockDeleteDocument.mockRejectedValue(new Error('向量删除失败'));

      await expect(service.deleteDocumentVectors('doc-456')).rejects.toThrow('向量删除失败');
    });

    it('删除成功时不应抛出错误', async () => {
      await expect(service.deleteDocumentVectors('doc-456')).resolves.not.toThrow();
    });
  });
});
