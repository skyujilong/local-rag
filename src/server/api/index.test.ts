/**
 * Tests for REST API - request body limits, endpoints, validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock all dependencies before importing app
vi.mock('../services/documents.js', () => ({
  documentService: {
    getAllDocuments: vi.fn().mockReturnValue([]),
    getDocument: vi.fn().mockReturnValue(undefined),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    importMarkdownFile: vi.fn().mockResolvedValue({
      metadata: { id: 'doc1', title: 'Test', source: 'markdown', createdAt: new Date(), updatedAt: new Date() },
      vectorizationStatus: 'completed',
    }),
    importObsidianVault: vi.fn().mockResolvedValue([]),
    addDocumentFromText: vi.fn().mockResolvedValue({
      metadata: { id: 'doc1', title: 'Test', source: 'api', createdAt: new Date(), updatedAt: new Date() },
      vectorizationStatus: 'completed',
    }),
    getVectorizationProgress: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../services/search.js', () => ({
  searchService: {
    hybridSearch: vi.fn().mockResolvedValue([]),
    getSearchSuggestions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/crawler.js', () => ({
  crawlerService: {
    crawlUrl: vi.fn().mockResolvedValue({
      url: 'https://example.com',
      title: 'Test Page',
      content: 'Test content',
      metadata: { wordCount: 2, language: 'en', crawledAt: new Date() },
      links: [],
    }),
  },
}));

vi.mock('../services/embeddings.js', () => ({
  embeddingService: {
    isReady: vi.fn().mockReturnValue(true),
    getModel: vi.fn().mockReturnValue('nomic-embed-text'),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/vectorstore.js', () => ({
  vectorStore: {
    isReady: vi.fn().mockReturnValue(true),
    initialize: vi.fn().mockResolvedValue(undefined),
    getVectorCount: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../../shared/utils/config.js', () => ({
  config: {
    get: vi.fn().mockReturnValue({
      port: 3000,
      host: '127.0.0.1',
      cors: false,
    }),
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

// Mock mcp server
vi.mock('../mcp/server.js', () => ({
  mcpServer: {
    isActive: vi.fn().mockReturnValue(false),
  },
}));

describe('API Routes', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import to ensure mocks are in place
    const module = await import('./index.js');
    app = module.app;
  });

  describe('GET /api/health', () => {
    it('should return 200 with health status', async () => {
      const req = new Request('http://localhost/api/health');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.services).toBeDefined();
    });

    it('should include Ollama and vectorStore status', async () => {
      const req = new Request('http://localhost/api/health');
      const res = await app.fetch(req);
      const body = await res.json();

      expect(body.services.ollama).toBeDefined();
      expect(body.services.vectorStore).toBeDefined();
    });
  });

  describe('GET /api/documents', () => {
    it('should return list of documents', async () => {
      const req = new Request('http://localhost/api/documents');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.documents).toBeDefined();
      expect(body.total).toBeDefined();
    });

    it('should return documents with correct shape', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.getAllDocuments).mockReturnValueOnce([
        {
          metadata: {
            id: 'doc1',
            title: 'Test Document',
            source: 'markdown' as any,
            tags: ['test'],
            createdAt: new Date(),
            updatedAt: new Date(),
            wordCount: 100,
          },
          content: 'content',
          chunks: [],
          status: 'completed' as any,
          vectorizationStatus: 'completed' as any,
        },
      ]);

      const req = new Request('http://localhost/api/documents');
      const res = await app.fetch(req);
      const body = await res.json();

      expect(body.total).toBe(1);
      expect(body.documents[0].id).toBe('doc1');
      expect(body.documents[0].title).toBe('Test Document');
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should return 404 for non-existent document', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.getDocument).mockReturnValueOnce(undefined);

      const req = new Request('http://localhost/api/documents/non-existent-id');
      const res = await app.fetch(req);

      expect(res.status).toBe(404);
    });

    it('should return document details for existing document', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.getDocument).mockReturnValueOnce({
        metadata: {
          id: 'doc1',
          title: 'Test',
          source: 'api' as any,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        content: 'Content here',
        chunks: [],
        status: 'completed' as any,
        vectorizationStatus: 'completed' as any,
      });

      const req = new Request('http://localhost/api/documents/doc1');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.metadata.id).toBe('doc1');
      expect(body.content).toBe('Content here');
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should delete an existing document', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.deleteDocument).mockResolvedValueOnce(undefined);

      const req = new Request('http://localhost/api/documents/doc1', {
        method: 'DELETE',
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/search', () => {
    it('should return 400 when query is missing', async () => {
      const req = new Request('http://localhost/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Query parameter is required');
    });

    it('should return search results for valid query', async () => {
      const { searchService } = await import('../services/search.js');
      vi.mocked(searchService.hybridSearch).mockResolvedValueOnce([
        {
          documentId: 'doc1',
          chunkId: 'chunk1',
          content: 'Relevant content',
          score: 0.9,
          semanticScore: 0.8,
          keywordScore: 0.1,
          combinedScore: 0.9,
          method: 'hybrid',
          metadata: {
            id: 'doc1',
            title: 'Test',
            source: 'markdown' as any,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        } as any,
      ]);

      const req = new Request('http://localhost/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toHaveLength(1);
      expect(body.results[0].content).toBe('Relevant content');
      expect(body.results[0].preview).toBeDefined();
    });

    it('should include preview field truncated to 500 chars', async () => {
      const { searchService } = await import('../services/search.js');
      const longContent = 'a'.repeat(600);
      vi.mocked(searchService.hybridSearch).mockResolvedValueOnce([
        {
          documentId: 'doc1',
          chunkId: 'chunk1',
          content: longContent,
          score: 0.9,
          semanticScore: 0.8,
          keywordScore: 0.1,
          combinedScore: 0.9,
          method: 'hybrid',
          metadata: {
            id: 'doc1',
            title: 'Test',
            source: 'markdown' as any,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        } as any,
      ]);

      const req = new Request('http://localhost/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test' }),
      });
      const res = await app.fetch(req);
      const body = await res.json();

      expect(body.results[0].content).toHaveLength(600);
      expect(body.results[0].preview).toHaveLength(503); // 500 + '...'
      expect(body.results[0].preview.endsWith('...')).toBe(true);
    });
  });

  describe('Request body size limit', () => {
    it('should return 413 when Content-Length exceeds 10MB', async () => {
      const req = new Request('http://localhost/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(11 * 1024 * 1024), // 11MB
        },
        body: JSON.stringify({ query: 'test' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toContain('too large');
    });

    it('should allow requests under 10MB', async () => {
      const req = new Request('http://localhost/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(1024), // 1KB
        },
        body: JSON.stringify({ query: 'test' }),
      });
      const res = await app.fetch(req);

      // Should not get 413
      expect(res.status).not.toBe(413);
    });
  });

  describe('GET /api/suggestions', () => {
    it('should return empty suggestions for empty query', async () => {
      const req = new Request('http://localhost/api/suggestions');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.suggestions).toEqual([]);
    });

    it('should return suggestions for valid query', async () => {
      const { searchService } = await import('../services/search.js');
      vi.mocked(searchService.getSearchSuggestions).mockResolvedValueOnce([
        'test query one',
        'test query two',
      ]);

      const req = new Request('http://localhost/api/suggestions?q=test');
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.suggestions).toHaveLength(2);
    });
  });

  describe('POST /api/import/markdown', () => {
    it('should return 400 when path is missing', async () => {
      const req = new Request('http://localhost/api/import/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Path parameter is required');
    });

    it('should import markdown file and return document info', async () => {
      const req = new Request('http://localhost/api/import/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/valid/path/test.md' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('should return 500 when import fails', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.importMarkdownFile).mockRejectedValueOnce(
        new Error('Import failed')
      );

      const req = new Request('http://localhost/api/import/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/invalid/path.md' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain('Import failed');
    });
  });

  describe('POST /api/import/text', () => {
    it('should return 400 when content is missing', async () => {
      const req = new Request('http://localhost/api/import/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });

    it('should return 400 when title is missing', async () => {
      const req = new Request('http://localhost/api/import/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Some content' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/import/obsidian', () => {
    it('should return 400 when vaultPath is missing', async () => {
      const req = new Request('http://localhost/api/import/obsidian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('vaultPath parameter is required');
    });
  });

  describe('POST /api/crawl', () => {
    it('should return 400 when URL is missing', async () => {
      const req = new Request('http://localhost/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('URL parameter is required');
    });

    it('should crawl URL and return result', async () => {
      const req = new Request('http://localhost/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.result.url).toBe('https://example.com');
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const req = new Request('http://localhost/api/unknown-endpoint');
      const res = await app.fetch(req);

      expect(res.status).toBe(404);
    });
  });
});
