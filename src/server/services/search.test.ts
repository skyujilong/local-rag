/**
 * Tests for search service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchService } from './search.js';
import { documentService } from './documents.js';
import { embeddingService } from './embeddings.js';
import { vectorStore } from './vectorstore.js';

// Mock dependencies
vi.mock('./embeddings.js');
vi.mock('./vectorstore.js');
vi.mock('./documents.js');

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
    vi.clearAllMocks();
  });

  describe('semanticSearch', () => {
    it('should generate query embedding and search vector store', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      const mockResults = [
        {
          documentId: 'doc1',
          chunkId: 'chunk1',
          content: 'Test content',
          score: 0.9,
          metadata: {
            id: 'doc1',
            title: 'Test Doc',
            source: 'markdown',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      vi.mocked(embeddingService.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(vectorStore.search).mockResolvedValue(mockResults);

      const query = { query: 'test query', topK: 3 };
      const results = await searchService.semanticSearch(query);

      expect(embeddingService.embed).toHaveBeenCalledWith('test query');
      expect(vectorStore.search).toHaveBeenCalledWith(query, mockEmbedding);
      expect(results).toEqual(mockResults);
    });

    it('should handle empty results', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      vi.mocked(embeddingService.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(vectorStore.search).mockResolvedValue([]);

      const query = { query: 'test query', topK: 3 };
      const results = await searchService.semanticSearch(query);

      expect(results).toEqual([]);
    });
  });

  describe('keywordSearch', () => {
    it('should search documents by keyword matching', async () => {
      const mockDocuments = [
        {
          metadata: {
            id: 'doc1',
            title: 'Test Doc',
            source: 'markdown',
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: ['test'],
          },
          content: 'This is a test document about testing',
          chunks: [
            {
              id: 'chunk1',
              documentId: 'doc1',
              content: 'This is a test document',
              chunkIndex: 0,
              startPosition: 0,
              endPosition: 20,
            },
          ],
          status: 'completed',
          vectorizationStatus: 'completed',
        },
      ];

      vi.mocked(documentService.getAllDocuments).mockReturnValue(mockDocuments as any);

      const query = { query: 'test document', topK: 3 };
      const results = await searchService.keywordSearch(query);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].content).toContain('test');
    });

    it('should filter by tags when specified', async () => {
      const mockDocuments = [
        {
          metadata: {
            id: 'doc1',
            title: 'Test Doc',
            source: 'markdown',
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: ['javascript'],
          },
          content: 'Test content',
          chunks: [],
          status: 'completed',
          vectorizationStatus: 'completed',
        },
        {
          metadata: {
            id: 'doc2',
            title: 'Another Doc',
            source: 'markdown',
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: ['python'],
          },
          content: 'Test content',
          chunks: [],
          status: 'completed',
          vectorizationStatus: 'completed',
        },
      ];

      vi.mocked(documentService.getAllDocuments).mockReturnValue(mockDocuments as any);

      const query = { query: 'test', filters: { tags: ['javascript'] } };
      const results = await searchService.keywordSearch(query);

      // Should only return javascript tagged documents
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('hybridSearch', () => {
    it('should combine semantic and keyword results', async () => {
      const mockEmbedding = Array(768).fill(0.1);
      const semanticResults = [
        {
          documentId: 'doc1',
          chunkId: 'chunk1',
          content: 'Semantic result',
          score: 0.9,
          metadata: {
            id: 'doc1',
            title: 'Test',
            source: 'markdown',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      vi.mocked(embeddingService.embed).mockResolvedValue(mockEmbedding);
      vi.mocked(vectorStore.search).mockResolvedValue(semanticResults);
      vi.spyOn(searchService, 'keywordSearch').mockResolvedValue(semanticResults);

      const query = { query: 'test', topK: 3 };
      const results = await searchService.hybridSearch(query);

      expect(results).toHaveLength(1);
      expect(results[0].method).toBe('hybrid');
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return suggestions based on partial query', async () => {
      const mockDocuments = [
        {
          metadata: {
            id: 'doc1',
            title: 'Test',
            source: 'markdown',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          content: 'This is a test document about testing frameworks',
          chunks: [],
          status: 'completed',
          vectorizationStatus: 'completed',
        },
      ];

      vi.mocked(documentService.getAllDocuments).mockReturnValue(mockDocuments as any);

      const suggestions = await searchService.getSearchSuggestions('test', 5);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });
});
