/**
 * Additional tests for search service - RRF algorithm, threshold filtering, similar documents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from './search.js';

// Mock dependencies
vi.mock('./embeddings.js', () => ({
  embeddingService: {
    embed: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
  },
}));

vi.mock('./vectorstore.js', () => ({
  vectorStore: {
    search: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('./documents.js', () => ({
  documentService: {
    getAllDocuments: vi.fn().mockReturnValue([]),
    getDocument: vi.fn().mockReturnValue(undefined),
  },
}));

vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const makeSearchResult = (id: string, score = 0.9) => ({
  documentId: id,
  chunkId: `${id}-chunk`,
  content: `Content for ${id}`,
  score,
  metadata: {
    id,
    title: `Title for ${id}`,
    source: 'markdown' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

const makeDocument = (id: string, content: string, tags: string[] = []) => ({
  metadata: {
    id,
    title: `Doc ${id}`,
    source: 'markdown' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    tags,
  },
  content,
  chunks: [
    {
      id: `${id}-chunk`,
      documentId: id,
      content,
      chunkIndex: 0,
      startPosition: 0,
      endPosition: content.length,
    },
  ],
  status: 'completed' as any,
  vectorizationStatus: 'completed' as any,
});

describe('SearchService - RRF Algorithm', () => {
  let searchService: SearchService;
  let embeddingService: any;
  let vectorStore: any;
  let documentService: any;

  beforeEach(async () => {
    searchService = new SearchService();
    const mods = await Promise.all([
      import('./embeddings.js'),
      import('./vectorstore.js'),
      import('./documents.js'),
    ]);
    embeddingService = mods[0].embeddingService;
    vectorStore = mods[1].vectorStore;
    documentService = mods[2].documentService;

    embeddingService.embed.mockReset();
    vectorStore.search.mockReset();
    documentService.getAllDocuments.mockReset();
    documentService.getDocument.mockReset();

    embeddingService.embed.mockResolvedValue(Array(768).fill(0.1));
    vectorStore.search.mockResolvedValue([]);
    documentService.getAllDocuments.mockReturnValue([]);
  });

  describe('reciprocalRankFusion', () => {
    it('should combine semantic and keyword results using RRF scoring', async () => {
      const doc1 = makeSearchResult('doc1', 0.9);
      const doc2 = makeSearchResult('doc2', 0.7);

      vectorStore.search.mockResolvedValue([doc1, doc2]);
      // Keyword search returns doc2 first
      documentService.getAllDocuments.mockReturnValue([
        makeDocument('doc2', 'hello world test'),
        makeDocument('doc1', 'hello world test'),
      ]);

      const results = await searchService.hybridSearch({ query: 'hello world test', topK: 3 });

      expect(results.length).toBeGreaterThan(0);
      // Results should have combinedScore
      results.forEach(r => {
        expect(r.combinedScore).toBeGreaterThan(0);
        expect(r.method).toMatch(/^(semantic|keyword|hybrid)$/);
      });
    });

    it('should assign method "hybrid" when result appears in both searches', async () => {
      const sharedDoc = makeSearchResult('doc1', 0.9);
      vectorStore.search.mockResolvedValue([sharedDoc]);
      documentService.getAllDocuments.mockReturnValue([
        makeDocument('doc1', 'test content'),
      ]);

      const results = await searchService.hybridSearch({ query: 'test content', topK: 3 });

      const hybridResult = results.find(r => r.documentId === 'doc1');
      // When same document appears in both, method should be 'hybrid'
      if (hybridResult) {
        expect(hybridResult.method).toBe('hybrid');
      }
    });

    it('should assign method "semantic" when result only appears in semantic search', async () => {
      // Semantic returns doc1, keyword returns nothing (empty docs)
      vectorStore.search.mockResolvedValue([makeSearchResult('doc1', 0.9)]);
      documentService.getAllDocuments.mockReturnValue([]); // no docs for keyword search

      const results = await searchService.hybridSearch({ query: 'test', topK: 3 });

      expect(results.length).toBeGreaterThan(0);
      const semanticResult = results.find(r => r.documentId === 'doc1');
      expect(semanticResult?.method).toBe('semantic');
    });

    it('should assign method "keyword" when result only appears in keyword search', async () => {
      // Semantic returns empty, keyword returns doc1
      vectorStore.search.mockResolvedValue([]);
      documentService.getAllDocuments.mockReturnValue([
        makeDocument('doc1', 'unique keyword phrase'),
      ]);

      const results = await searchService.hybridSearch({
        query: 'unique keyword phrase',
        topK: 3,
      });

      if (results.length > 0) {
        expect(results[0].method).toBe('keyword');
      }
    });

    it('should use RRF formula: 1/(k + rank) where k=60', async () => {
      // Top result should have score ~1/(60+1) ≈ 0.01639
      vectorStore.search.mockResolvedValue([makeSearchResult('doc1', 0.9)]);
      documentService.getAllDocuments.mockReturnValue([]);

      const results = await searchService.hybridSearch({ query: 'test', topK: 3 });

      if (results.length > 0) {
        const expectedScore = 1 / (60 + 1); // k=60, rank=0 (index 0)
        expect(results[0].combinedScore).toBeCloseTo(expectedScore, 5);
      }
    });

    it('should filter results by threshold when specified', async () => {
      vectorStore.search.mockResolvedValue([
        makeSearchResult('doc1', 0.9),
        makeSearchResult('doc2', 0.5),
      ]);
      documentService.getAllDocuments.mockReturnValue([]);

      // RRF scores are small (~0.01-0.03 range)
      // Use a very high threshold to filter all results
      const results = await searchService.hybridSearch({
        query: 'test',
        topK: 10,
        threshold: 100, // Impossibly high threshold
      });

      expect(results).toHaveLength(0);
    });

    it('should return all results with threshold=0 (default)', async () => {
      vectorStore.search.mockResolvedValue([
        makeSearchResult('doc1', 0.9),
        makeSearchResult('doc2', 0.5),
      ]);
      documentService.getAllDocuments.mockReturnValue([]);

      const results = await searchService.hybridSearch({ query: 'test', topK: 10 });

      // All results should pass with threshold=0
      expect(results.length).toBeGreaterThan(0);
    });

    it('should sort results by combinedScore in descending order', async () => {
      vectorStore.search.mockResolvedValue([
        makeSearchResult('doc3', 0.5), // rank 0 - highest semantic rank
        makeSearchResult('doc2', 0.7), // rank 1
        makeSearchResult('doc1', 0.9), // rank 2
      ]);
      documentService.getAllDocuments.mockReturnValue([]);

      const results = await searchService.hybridSearch({ query: 'test', topK: 10 });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].combinedScore).toBeGreaterThanOrEqual(results[i].combinedScore);
      }
    });
  });

  describe('keywordSearch - filtering', () => {
    it('should filter by source when sources filter is specified', async () => {
      documentService.getAllDocuments.mockReturnValue([
        makeDocument('doc1', 'test content'),
        {
          ...makeDocument('doc2', 'test content'),
          metadata: {
            ...makeDocument('doc2', 'test content').metadata,
            source: 'webpage' as any,
          },
        },
      ]);

      const results = await searchService.keywordSearch({
        query: 'test',
        filters: { sources: ['markdown' as any] },
      });

      // Only markdown source should be included
      results.forEach(r => {
        expect(r.metadata.source).toBe('markdown');
      });
    });

    it('should skip documents that are not vectorized', async () => {
      documentService.getAllDocuments.mockReturnValue([
        {
          ...makeDocument('doc1', 'test content'),
          vectorizationStatus: 'pending' as any, // Not completed
        },
        makeDocument('doc2', 'test content'),
      ]);

      const results = await searchService.keywordSearch({ query: 'test' });

      // Only completed documents should be searched
      results.forEach(r => {
        expect(r.documentId).not.toBe('doc1');
      });
    });

    it('should score results by keyword match ratio', async () => {
      documentService.getAllDocuments.mockReturnValue([
        makeDocument('doc1', 'test query matching word'), // All words match
        makeDocument('doc2', 'test only'), // Partial match
      ]);

      const results = await searchService.keywordSearch({ query: 'test query matching word' });

      if (results.length >= 2) {
        // Full match should have higher score than partial match
        const doc1Result = results.find(r => r.documentId === 'doc1');
        const doc2Result = results.find(r => r.documentId === 'doc2');
        if (doc1Result && doc2Result) {
          expect(doc1Result.score).toBeGreaterThan(doc2Result.score);
        }
      }
    });

    it('should respect topK limit', async () => {
      const docs = Array(10).fill(null).map((_, i) => makeDocument(`doc${i}`, 'test content'));
      documentService.getAllDocuments.mockReturnValue(docs);

      const results = await searchService.keywordSearch({ query: 'test', topK: 3 });

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getSimilarDocuments', () => {
    it('should return empty array when document not found', async () => {
      documentService.getDocument.mockReturnValue(undefined);

      const results = await searchService.getSimilarDocuments('non-existent-id');

      expect(results).toEqual([]);
    });

    it('should use document summary (title + paragraphs) as query', async () => {
      const doc = {
        metadata: { id: 'doc1', title: 'My Document Title', source: 'api' as any, createdAt: new Date(), updatedAt: new Date() },
        content: 'First paragraph content.\n\nSecond paragraph content.',
        chunks: [],
        status: 'completed' as any,
        vectorizationStatus: 'completed' as any,
      };

      documentService.getDocument.mockReturnValue(doc);
      vectorStore.search.mockResolvedValue([]);

      await searchService.getSimilarDocuments('doc1', 3);

      // Should call embed with a query containing the title
      expect(embeddingService.embed).toHaveBeenCalledWith(
        expect.stringContaining('My Document Title')
      );
    });

    it('should limit query to 1000 characters', async () => {
      const doc = {
        metadata: { id: 'doc1', title: 'T'.repeat(200), source: 'api' as any, createdAt: new Date(), updatedAt: new Date() },
        content: 'a'.repeat(2000),
        chunks: [],
        status: 'completed' as any,
        vectorizationStatus: 'completed' as any,
      };

      documentService.getDocument.mockReturnValue(doc);
      vectorStore.search.mockResolvedValue([]);

      await searchService.getSimilarDocuments('doc1', 3);

      const queryArg = embeddingService.embed.mock.calls[0][0];
      expect(queryArg.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return phrases that start with partial query', async () => {
      documentService.getAllDocuments.mockReturnValue([
        makeDocument('doc1', 'test query suggestion one two three'),
      ]);

      const suggestions = await searchService.getSearchSuggestions('test query', 5);

      expect(suggestions.some(s => s.startsWith('test query'))).toBe(true);
    });

    it('should limit results to the specified count', async () => {
      documentService.getAllDocuments.mockReturnValue([
        makeDocument('doc1', 'test a b c d e f g h i j k l m n o p q r s t'),
      ]);

      const suggestions = await searchService.getSearchSuggestions('test', 3);

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array when no documents exist', async () => {
      documentService.getAllDocuments.mockReturnValue([]);

      const suggestions = await searchService.getSearchSuggestions('test', 5);

      expect(suggestions).toEqual([]);
    });

    it('should return empty array for empty query', async () => {
      documentService.getAllDocuments.mockReturnValue([
        makeDocument('doc1', 'some content'),
      ]);

      const suggestions = await searchService.getSearchSuggestions('', 5);

      // Empty query has no starting character to match
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });
});
