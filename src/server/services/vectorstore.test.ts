/**
 * Tests for vector store service - storage, query, timeout
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create a shared mock collection
const mockCollection = {
  add: vi.fn(),
  query: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
};

// Create a shared mock client
const mockChromaClient = {
  getCollection: vi.fn(),
  createCollection: vi.fn(),
};

// Mock ChromaDB
vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => mockChromaClient),
  Collection: vi.fn(),
}));

// Mock config
vi.mock('../../shared/utils/config.js', () => ({
  config: {
    get: vi.fn().mockImplementation((_key: string) => ({
      path: '/tmp/test-chromadb',
      collectionName: 'test-documents',
    })),
  },
}));

// Mock logger
vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('VectorStoreService', () => {
  let VectorStoreService: any;
  let service: any;

  const makeQueryResult = (overrides: Partial<{ distances: any; ids: any; documents: any; metadatas: any }> = {}) => ({
    ids: [['chunk1', 'chunk2']],
    distances: [[0.1, 0.3]],
    documents: [['Content 1', 'Content 2']],
    metadatas: [
      [
        {
          documentId: 'doc1',
          chunkId: 'chunk1',
          title: 'Test Doc',
          source: 'markdown',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          documentId: 'doc2',
          chunkId: 'chunk2',
          title: 'Test Doc 2',
          source: 'api',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    ],
    ...overrides,
  });

  beforeEach(async () => {
    // Reset all mocks
    mockCollection.add.mockReset();
    mockCollection.query.mockReset();
    mockCollection.delete.mockReset();
    mockCollection.count.mockReset();
    mockChromaClient.getCollection.mockReset();
    mockChromaClient.createCollection.mockReset();

    // Set default implementations
    mockCollection.add.mockResolvedValue(undefined);
    mockCollection.query.mockResolvedValue(makeQueryResult());
    mockCollection.delete.mockResolvedValue(undefined);
    mockCollection.count.mockResolvedValue(42);

    // Default: getCollection fails (first time), createCollection succeeds
    mockChromaClient.getCollection.mockRejectedValue(new Error('Collection not found'));
    mockChromaClient.createCollection.mockResolvedValue(mockCollection);

    const module = await import('./vectorstore.js');
    VectorStoreService = module.VectorStoreService;
    service = new VectorStoreService();
  });

  describe('initialize', () => {
    it('should initialize successfully by creating a new collection', async () => {
      await service.initialize();
      expect(service.isReady()).toBe(true);
      expect(mockChromaClient.createCollection).toHaveBeenCalled();
    });

    it('should use existing collection when it already exists', async () => {
      mockChromaClient.getCollection.mockResolvedValue(mockCollection);

      await service.initialize();
      expect(service.isReady()).toBe(true);
      expect(mockChromaClient.getCollection).toHaveBeenCalled();
      expect(mockChromaClient.createCollection).not.toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      const { ChromaClient } = await import('chromadb');
      const callCountAfterFirstInit = (ChromaClient as any).mock.calls.length;

      await service.initialize();
      // ChromaClient constructor should NOT be called again
      expect((ChromaClient as any).mock.calls.length).toBe(callCountAfterFirstInit);
    });

    it('should throw AppError when initialization fails completely', async () => {
      mockChromaClient.getCollection.mockRejectedValue(new Error('Not found'));
      mockChromaClient.createCollection.mockRejectedValue(new Error('Failed to create'));

      const { AppError } = await import('../../shared/types/index.js');
      await expect(service.initialize()).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('addDocumentEmbeddings', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should add document embeddings to the collection', async () => {
      const chunks = [
        {
          id: 'chunk1',
          content: 'Test content',
          embedding: Array(768).fill(0.1),
          metadata: { title: 'Test Doc', source: 'markdown' },
        },
      ];

      await service.addDocumentEmbeddings('doc1', chunks);

      expect(mockCollection.add).toHaveBeenCalledWith({
        ids: ['chunk1'],
        embeddings: [expect.any(Array)],
        documents: ['Test content'],
        metadatas: [expect.objectContaining({ documentId: 'doc1', chunkId: 'chunk1' })],
      });
    });

    it('should handle multiple chunks in a single call', async () => {
      const chunks = [
        { id: 'c1', content: 'Content 1', embedding: Array(768).fill(0.1) },
        { id: 'c2', content: 'Content 2', embedding: Array(768).fill(0.2) },
        { id: 'c3', content: 'Content 3', embedding: Array(768).fill(0.3) },
      ];

      await service.addDocumentEmbeddings('doc1', chunks);

      const addArgs = mockCollection.add.mock.calls[0][0];
      expect(addArgs.ids).toHaveLength(3);
      expect(addArgs.documents).toEqual(['Content 1', 'Content 2', 'Content 3']);
    });

    it('should include documentId in each chunk metadata', async () => {
      const chunks = [
        { id: 'c1', content: 'Content', embedding: [0.1], metadata: { title: 'Doc' } },
      ];

      await service.addDocumentEmbeddings('my-doc-id', chunks);

      const metadatas = mockCollection.add.mock.calls[0][0].metadatas;
      expect(metadatas[0].documentId).toBe('my-doc-id');
    });

    it('should throw AppError when adding embeddings fails', async () => {
      mockCollection.add.mockRejectedValueOnce(new Error('Add failed'));

      const { AppError } = await import('../../shared/types/index.js');
      await expect(
        service.addDocumentEmbeddings('doc1', [
          { id: 'c1', content: 'Content', embedding: [0.1] },
        ])
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return search results with correct shape', async () => {
      const query = { query: 'test query', topK: 3 };
      const results = await service.search(query, Array(768).fill(0.1));

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        documentId: 'doc1',
        chunkId: 'chunk1',
        content: 'Content 1',
        score: expect.any(Number),
        metadata: expect.objectContaining({
          id: 'doc1',
          title: 'Test Doc',
        }),
      });
    });

    it('should convert distance to similarity score (1 - distance)', async () => {
      const query = { query: 'test', topK: 3 };
      const results = await service.search(query, Array(768).fill(0.1));

      // distance[0] = 0.1, score = 1 - 0.1 = 0.9
      expect(results[0].score).toBeCloseTo(0.9, 1);
      // distance[1] = 0.3, score = 1 - 0.3 = 0.7
      expect(results[1].score).toBeCloseTo(0.7, 1);
    });

    it('should apply score threshold when specified', async () => {
      // distances: [0.1, 0.3] => scores: [0.9, 0.7]
      // threshold 0.8 should filter out score 0.7
      const query = { query: 'test', topK: 3, threshold: 0.8 };
      const results = await service.search(query, Array(768).fill(0.1));

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThanOrEqual(0.8);
    });

    it('should handle empty results from ChromaDB', async () => {
      mockCollection.query.mockResolvedValueOnce({
        ids: [[]],
        distances: [[]],
        documents: [[]],
        metadatas: [[]],
      });

      const results = await service.search({ query: 'test', topK: 3 }, Array(768).fill(0));
      expect(results).toHaveLength(0);
    });

    it('should handle null distances gracefully', async () => {
      mockCollection.query.mockResolvedValueOnce({
        ids: [['chunk1']],
        distances: null,
        documents: [['Content']],
        metadatas: [[{
          documentId: 'doc1',
          chunkId: 'chunk1',
          title: 'Test',
          source: 'api',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }]],
      });

      const results = await service.search({ query: 'test', topK: 3 }, Array(768).fill(0));
      expect(Array.isArray(results)).toBe(true);
      // null distances causes the guard to skip, returning empty
      expect(results).toHaveLength(0);
    });

    it('should throw AppError when query timeout occurs', async () => {
      vi.useFakeTimers();

      // Mock query to never resolve
      mockCollection.query.mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      const query = { query: 'test', topK: 3 };
      const searchPromise = service.search(query, Array(768).fill(0.1));

      // Advance past the 5-second timeout
      vi.advanceTimersByTime(6000);

      await expect(searchPromise).rejects.toThrow();

      vi.useRealTimers();
    });

    it('should use topK from query or default to 3', async () => {
      await service.search({ query: 'test', topK: 5 }, Array(768).fill(0.1));

      expect(mockCollection.query).toHaveBeenCalledWith(
        expect.objectContaining({ nResults: 5 })
      );
    });

    it('should pass filters to buildWhereClause', async () => {
      await service.search(
        { query: 'test', topK: 3, filters: { tags: ['javascript'] } },
        Array(768).fill(0.1)
      );

      expect(mockCollection.query).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tags: expect.any(Object) }),
        })
      );
    });
  });

  describe('deleteDocument', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should delete document embeddings by documentId', async () => {
      await service.deleteDocument('doc1');

      expect(mockCollection.delete).toHaveBeenCalledWith({ where: { documentId: 'doc1' } });
    });

    it('should throw AppError when deletion fails', async () => {
      mockCollection.delete.mockRejectedValueOnce(new Error('Delete failed'));

      const { AppError } = await import('../../shared/types/index.js');
      await expect(service.deleteDocument('doc1')).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('getDocumentCount and getVectorCount', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return the count from ChromaDB', async () => {
      const count = await service.getDocumentCount();
      expect(count).toBe(42);
    });

    it('should return 0 on count error', async () => {
      mockCollection.count.mockRejectedValueOnce(new Error('Count failed'));
      const count = await service.getDocumentCount();
      expect(count).toBe(0);
    });

    it('getVectorCount should delegate to getDocumentCount', async () => {
      const vectorCount = await service.getVectorCount();
      const docCount = await service.getDocumentCount();
      expect(vectorCount).toBe(docCount);
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await service.initialize();
      expect(service.isReady()).toBe(true);
    });
  });
});
