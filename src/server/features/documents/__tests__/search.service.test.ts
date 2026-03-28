/**
 * SearchService 单元测试
 *
 * 测试重点：
 * - checkFallback 降级触发条件验证（用例 33）
 * - mergeAndDedupeResults 结果合并策略（用例 32）
 * - embedding 复用：只调用一次 embeddingService.embed
 * - 三种查询策略（filtered / hybrid / full）
 * - hybridSearch 整体流程
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// =====================================================
// Mock 外部依赖
// =====================================================

const mockEmbed = vi.fn();
const mockSearchWithFilters = vi.fn();
const mockSearch = vi.fn();
const mockGetNote = vi.fn();

// Use proxy file path (../../services/...) - matches what search.service.ts imports
vi.mock('../../services/embeddings.js', () => ({
  embeddingService: {
    embed: (...args: any[]) => mockEmbed(...args),
  },
  EmbeddingService: vi.fn(),
}));

vi.mock('../../services/vectorstore.js', () => ({
  vectorStore: {
    searchWithFilters: (...args: any[]) => mockSearchWithFilters(...args),
    search: (...args: any[]) => mockSearch(...args),
  },
  VectorStoreService: vi.fn(),
}));

vi.mock('../services/notes.service.js', () => ({
  notesService: {
    getNote: (...args: any[]) => mockGetNote(...args),
  },
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
import { SearchService } from '../services/search.service.js';

// =====================================================
// 测试工厂函数
// =====================================================

const MOCK_EMBEDDING = Array(768).fill(0.1);

/**
 * 创建模拟搜索结果
 */
function makeVectorResult(
  documentId: string,
  chunkId: string,
  score: number,
  content = '测试内容'
) {
  return {
    metadata: { documentId, chunkId },
    content,
    score,
  };
}

/**
 * 创建模拟 Note
 */
function makeNote(id: string, title = '测试笔记') {
  return {
    id,
    title,
    content: `# ${title}\n\n这是测试内容。`,
    tags: ['test'],
    filePath: `/tmp/.devrag/notes/${id}.md`,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

// =====================================================
// 测试套件
// =====================================================

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();

    // 默认 embed 返回固定向量
    mockEmbed.mockResolvedValue(MOCK_EMBEDDING);

    // 默认 vectorStore 返回空结果
    mockSearchWithFilters.mockResolvedValue([]);
    mockSearch.mockResolvedValue([]);

    // 默认 getNote 返回 null
    mockGetNote.mockResolvedValue(null);

    service = new SearchService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================================================
  // Embedding 复用验证（核心修复点）
  // ==================================================
  describe('embedding 复用（只调用一次 embed）', () => {
    it('有标签搜索时 embed 只应被调用一次', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.85),
        makeVectorResult('doc1', 'chunk2', 0.80),
        makeVectorResult('doc2', 'chunk3', 0.75),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      await service.hybridSearch({ query: 'React 教程', tags: ['react', 'tutorial'] });

      expect(mockEmbed).toHaveBeenCalledTimes(1);
      expect(mockEmbed).toHaveBeenCalledWith('React 教程');
    });

    it('无标签搜索时 embed 只应被调用一次', async () => {
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.85),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      await service.hybridSearch({ query: '测试查询' });

      expect(mockEmbed).toHaveBeenCalledTimes(1);
    });

    it('降级触发后（阶段1 + 阶段2）embed 仍只调用一次', async () => {
      // 阶段1 返回少于 3 条（触发降级）
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.65),
      ]);
      // 阶段2 返回更多结果
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.65),
        makeVectorResult('doc2', 'chunk2', 0.85),
        makeVectorResult('doc3', 'chunk3', 0.78),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      await service.hybridSearch({ query: 'React 教程', tags: ['javascript'] });

      // 关键：即使经历阶段1 + 阶段2，embed 只调用一次
      expect(mockEmbed).toHaveBeenCalledTimes(1);
    });
  });

  // ==================================================
  // 用例 33：降级触发条件验证
  // ==================================================
  describe('checkFallback 降级触发条件（用例 33）', () => {
    it('场景A：返回 0 条结果应触发降级', async () => {
      mockSearchWithFilters.mockResolvedValue([]); // 0 条
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.9),
        makeVectorResult('doc2', 'chunk2', 0.85),
        makeVectorResult('doc3', 'chunk3', 0.80),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      expect(result.meta.stage2Triggered).toBe(true);
      expect(result.strategy).toBe('hybrid');
    });

    it('场景B：返回 2 条结果（< 3）应触发降级', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.8),
        makeVectorResult('doc2', 'chunk2', 0.75),
      ]); // 2 条，小于 fallbackThreshold(3)
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.8),
        makeVectorResult('doc2', 'chunk2', 0.75),
        makeVectorResult('doc3', 'chunk3', 0.9),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      expect(result.meta.stage2Triggered).toBe(true);
    });

    it('场景C：返回 5 条但最高分 0.65（< 0.7）应触发降级', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.65), // 最高分低于 0.7
        makeVectorResult('doc2', 'chunk2', 0.60),
        makeVectorResult('doc3', 'chunk3', 0.55),
        makeVectorResult('doc4', 'chunk4', 0.52),
        makeVectorResult('doc5', 'chunk5', 0.50),
      ]);
      mockSearch.mockResolvedValue([]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      expect(result.meta.stage2Triggered).toBe(true);
    });

    it('场景D：返回 5 条但所有分数 < 0.5 应触发降级', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.48),
        makeVectorResult('doc2', 'chunk2', 0.45),
        makeVectorResult('doc3', 'chunk3', 0.42),
        makeVectorResult('doc4', 'chunk4', 0.40),
        makeVectorResult('doc5', 'chunk5', 0.38),
      ]);
      mockSearch.mockResolvedValue([]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      expect(result.meta.stage2Triggered).toBe(true);
    });

    it('场景E：返回 5 条且最高分 0.8（≥ 0.7）不应触发降级', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.80), // 最高分 >= 0.7
        makeVectorResult('doc2', 'chunk2', 0.75),
        makeVectorResult('doc3', 'chunk3', 0.72),
        makeVectorResult('doc4', 'chunk4', 0.68),
        makeVectorResult('doc5', 'chunk5', 0.65),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      expect(result.meta.stage2Triggered).toBe(false);
      expect(result.strategy).toBe('filtered');
    });
  });

  // ==================================================
  // 用例 32：结果合并策略
  // ==================================================
  describe('mergeAndDedupeResults 结果合并策略（用例 32）', () => {
    it('阶段1 和 阶段2 的重复 chunkId 应该去重', async () => {
      // doc1/chunk1 在两个阶段都出现
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.60), // filtered
      ]);
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.60), // 同一 chunk，来自全量搜索
        makeVectorResult('doc2', 'chunk2', 0.85),
        makeVectorResult('doc3', 'chunk3', 0.78),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['javascript'] });

      // doc1 应该只出现一次
      const doc1Results = result.data.results.filter((r) => r.documentId === 'doc1');
      expect(doc1Results.length).toBe(1);
    });

    it('filtered 结果加权后排序应高于同等分数的 fuzzy 结果', async () => {
      // 阶段1: doc1 score=0.6 (filtered，加权 1.2 -> 0.72)
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.60),
      ]);
      // 阶段2: doc2 score=0.85, doc3 score=0.78
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.60),
        makeVectorResult('doc2', 'chunk2', 0.85),
        makeVectorResult('doc3', 'chunk3', 0.78),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['javascript'] });

      // 排序：doc2(0.85) > doc3(0.78) > doc1(0.72，filtered加权)
      const resultIds = result.data.results.map((r) => r.documentId);
      expect(resultIds[0]).toBe('doc2'); // 0.85
      expect(resultIds[1]).toBe('doc3'); // 0.78
      // doc1 应该在第三位（0.72）
      expect(resultIds.indexOf('doc1')).toBe(2);
    });

    it('结果应该按 aggregatedScore 降序排列', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'chunk1', 0.9),
        makeVectorResult('doc2', 'chunk2', 0.7),
        makeVectorResult('doc3', 'chunk3', 0.8),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      const scores = result.data.results.map((r) => r.aggregatedScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });
  });

  // ==================================================
  // 用例 35：文档分块合并（同文档多 chunk）
  // ==================================================
  describe('文档分块合并（用例 35）', () => {
    it('同文档的多个 chunk 应该合并为一条结果', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc_a', 'chunk_15', 0.85, 'React useEffect 依赖数组...'),
        makeVectorResult('doc_a', 'chunk_16', 0.82, 'useEffect 第二参数...'),
        makeVectorResult('doc_a', 'chunk_47', 0.78, '依赖项详细说明...'),
        makeVectorResult('doc_b', 'chunk_88', 0.75, '其他文档内容...'),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: 'React useEffect', tags: ['react'] });

      // doc_a 的 3 个 chunk 应该合并为一条
      const docAResults = result.data.results.filter((r) => r.documentId === 'doc_a');
      expect(docAResults.length).toBe(1);
      expect(docAResults[0].matchedChunks.length).toBeGreaterThanOrEqual(1);

      // doc_b 单独一条
      const docBResults = result.data.results.filter((r) => r.documentId === 'doc_b');
      expect(docBResults.length).toBe(1);

      // 共 2 条文档级结果
      expect(result.data.results.length).toBe(2);
    });

    it('aggregatedScore 应取该文档所有 chunk 中的最高分', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc_a', 'chunk_1', 0.85),
        makeVectorResult('doc_a', 'chunk_2', 0.70),
        makeVectorResult('doc_a', 'chunk_3', 0.60),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote('doc_a')));

      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      expect(result.data.results[0].aggregatedScore).toBe(0.85); // 取最高分
    });

    it('matchedChunks 最多返回 3 个（Top-3）', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc_a', 'chunk_1', 0.95),
        makeVectorResult('doc_a', 'chunk_2', 0.90),
        makeVectorResult('doc_a', 'chunk_3', 0.85),
        makeVectorResult('doc_a', 'chunk_4', 0.80),
        makeVectorResult('doc_a', 'chunk_5', 0.75),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote('doc_a')));

      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      expect(result.data.results[0].matchedChunks.length).toBeLessThanOrEqual(3);
    });
  });

  // ==================================================
  // 查询策略分支
  // ==================================================
  describe('查询策略分支', () => {
    it('有标签且阶段1结果充足时 strategy 应为 filtered', async () => {
      mockSearchWithFilters.mockResolvedValue([
        makeVectorResult('doc1', 'c1', 0.9),
        makeVectorResult('doc2', 'c2', 0.85),
        makeVectorResult('doc3', 'c3', 0.80),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询', tags: ['react'] });

      expect(result.strategy).toBe('filtered');
      expect(result.meta.stage2Triggered).toBe(false);
    });

    it('有标签但降级时 strategy 应为 hybrid', async () => {
      mockSearchWithFilters.mockResolvedValue([]); // 触发降级
      mockSearch.mockResolvedValue([]);

      const result = await service.hybridSearch({ query: '查询', tags: ['react'] });

      expect(result.strategy).toBe('hybrid');
      expect(result.meta.stage2Triggered).toBe(true);
    });

    it('无标签时 strategy 应为 full', async () => {
      mockSearch.mockResolvedValue([]);

      const result = await service.hybridSearch({ query: '查询' });

      expect(result.strategy).toBe('full');
      expect(result.meta.stage2Triggered).toBe(false);
    });

    it('空标签数组时 strategy 应为 full（视为无标签）', async () => {
      mockSearch.mockResolvedValue([]);

      const result = await service.hybridSearch({ query: '查询', tags: [] });

      expect(result.strategy).toBe('full');
    });
  });

  // ==================================================
  // 搜索响应结构验证
  // ==================================================
  describe('搜索响应结构', () => {
    it('应该返回正确格式的 SearchResponse', async () => {
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'c1', 0.85),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: 'React 测试' });

      expect(result.query).toBe('React 测试');
      expect(result.strategy).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.data.total).toBeDefined();
      expect(Array.isArray(result.data.results)).toBe(true);
      expect(result.meta).toBeDefined();
      expect(typeof result.meta.stage1Results).toBe('number');
      expect(typeof result.meta.stage2Triggered).toBe('boolean');
      expect(typeof result.meta.totalTime).toBe('number');
    });

    it('文档不存在时应该跳过该 chunk（不抛出）', async () => {
      mockSearch.mockResolvedValue([
        makeVectorResult('non-existent-doc', 'c1', 0.85),
      ]);
      mockGetNote.mockResolvedValue(null); // 文档不存在

      const result = await service.hybridSearch({ query: '查询' });

      // 不抛出，但结果为空
      expect(result.data.results).toEqual([]);
    });

    it('searchWithFilters 失败时应该返回空结果（优雅降级）', async () => {
      mockSearchWithFilters.mockRejectedValue(new Error('ChromaDB 不可用'));
      mockSearch.mockResolvedValue([]); // 降级后的全量搜索也返回空

      // 阶段1 失败会触发降级到阶段2
      const result = await service.hybridSearch({ query: '查询', tags: ['tag'] });

      expect(result).toBeDefined();
      expect(result.data.results).toEqual([]);
    });
  });

  // ==================================================
  // generateHighlight（通过结果间接测试）
  // ==================================================
  describe('generateHighlight', () => {
    it('highlight 字段不应包含 Markdown 语法', async () => {
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'c1', 0.85, '# 标题\n\n这是**粗体**和*斜体*的`代码`内容。'),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询' });

      if (result.data.results.length > 0) {
        const highlight = result.data.results[0].matchedChunks[0].highlight;
        expect(highlight).not.toContain('#');
        expect(highlight).not.toContain('**');
        expect(highlight).not.toContain('`');
      }
    });

    it('highlight 长度应不超过 200 字符', async () => {
      const longContent = '很长的内容'.repeat(100);
      mockSearch.mockResolvedValue([
        makeVectorResult('doc1', 'c1', 0.85, longContent),
      ]);
      mockGetNote.mockImplementation((id: string) => Promise.resolve(makeNote(id)));

      const result = await service.hybridSearch({ query: '查询' });

      if (result.data.results.length > 0) {
        const highlight = result.data.results[0].matchedChunks[0].highlight;
        expect(highlight.length).toBeLessThanOrEqual(203); // 200 + "..."
      }
    });
  });
});
