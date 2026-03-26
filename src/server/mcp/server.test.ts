/**
 * Tests for MCP Server - input validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPServer } from './server.js';

// Mock MCP SDK
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: vi.fn().mockImplementation(() => ({
    setRequestHandler: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: 'CallToolRequestSchema',
  ListToolsRequestSchema: 'ListToolsRequestSchema',
}));

// Mock search service
vi.mock('../services/search.js', () => ({
  searchService: {
    hybridSearch: vi.fn().mockResolvedValue([]),
    semanticSearch: vi.fn().mockResolvedValue([]),
  },
}));

// Mock document service
vi.mock('../services/documents.js', () => ({
  documentService: {
    getAllDocuments: vi.fn().mockReturnValue([]),
    getDocument: vi.fn().mockReturnValue(undefined),
    addDocumentFromText: vi.fn().mockResolvedValue({
      metadata: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        title: 'Test Doc',
        source: 'api',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
      },
      vectorizationStatus: 'completed',
    }),
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

describe('MCPServer', () => {
  let server: MCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
    server = new MCPServer();
  });

  describe('isActive', () => {
    it('should return false before starting', () => {
      expect(server.isActive()).toBe(false);
    });

    it('should return true after starting', async () => {
      await server.start();
      expect(server.isActive()).toBe(true);
    });

    it('should return false after stopping', async () => {
      await server.start();
      await server.stop();
      expect(server.isActive()).toBe(false);
    });
  });

  // Test the internal tool methods by accessing the private handleToolCall method via a test interface
  // We test the validation logic directly

  describe('searchKnowledgeBase input validation', () => {
    let handleToolCall: Function;

    beforeEach(async () => {
      await server.start();
      // Access private method for testing
      handleToolCall = (server as any).handleToolCall.bind(server);
    });

    it('should reject missing query', async () => {
      const result = await handleToolCall('search_knowledge_base', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query parameter is required');
    });

    it('should reject non-string query', async () => {
      const result = await handleToolCall('search_knowledge_base', { query: 123 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query parameter is required');
    });

    it('should reject query exceeding 1000 characters', async () => {
      const longQuery = 'a'.repeat(1001);
      const result = await handleToolCall('search_knowledge_base', { query: longQuery });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Query too long');
    });

    it('should accept valid query at exactly 1000 characters', async () => {
      const maxQuery = 'a'.repeat(1000);
      const result = await handleToolCall('search_knowledge_base', { query: maxQuery });
      // Should not have query-length error
      expect(result.content[0].text).not.toContain('Query too long');
    });

    it('should reject topK below 1 (when a negative value is used)', async () => {
      // Note: topK=0 is handled by `(args.topK as number) || 3` which coerces 0 to 3.
      // A negative value explicitly fails the < 1 check.
      const result = await handleToolCall('search_knowledge_base', { query: 'test', topK: -1 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('topK must be between 1 and 100');
    });

    it('should reject topK above 100', async () => {
      const result = await handleToolCall('search_knowledge_base', { query: 'test', topK: 101 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('topK must be between 1 and 100');
    });

    it('should sanitize query by trimming and slicing to 500 chars', async () => {
      const { searchService } = await import('../services/search.js');
      const query = '  ' + 'a'.repeat(600) + '  ';

      await handleToolCall('search_knowledge_base', { query });

      expect(searchService.hybridSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'a'.repeat(500), // trimmed and sliced
        })
      );
    });

    it('should return no-results message when search returns empty', async () => {
      const { searchService } = await import('../services/search.js');
      vi.mocked(searchService.hybridSearch).mockResolvedValue([]);

      const result = await handleToolCall('search_knowledge_base', { query: 'test' });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No relevant documents found');
    });

    it('should use semantic search when useHybridSearch is false', async () => {
      const { searchService } = await import('../services/search.js');

      await handleToolCall('search_knowledge_base', {
        query: 'test',
        useHybridSearch: false,
      });

      expect(searchService.semanticSearch).toHaveBeenCalled();
      expect(searchService.hybridSearch).not.toHaveBeenCalled();
    });
  });

  describe('listDocuments input validation', () => {
    let handleToolCall: Function;

    beforeEach(async () => {
      await server.start();
      handleToolCall = (server as any).handleToolCall.bind(server);
    });

    it('should reject limit below 1 (when a negative value is used)', async () => {
      // Note: limit=0 is handled by `(args.limit as number) || 50` which coerces 0 to 50.
      // A negative value explicitly fails the < 1 check.
      const result = await handleToolCall('list_documents', { limit: -1 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('limit must be between 1 and 1000');
    });

    it('should reject limit above 1000', async () => {
      const result = await handleToolCall('list_documents', { limit: 1001 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('limit must be between 1 and 1000');
    });

    it('should reject non-array filterByTags', async () => {
      const result = await handleToolCall('list_documents', { filterByTags: 'not-an-array' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('filterByTags must be an array');
    });

    it('should return no-documents message when knowledge base is empty', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.getAllDocuments).mockReturnValueOnce([]);

      const result = await handleToolCall('list_documents', {});

      expect(result.content[0].text).toContain('No documents found');
    });

    it('should filter documents by tags', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.getAllDocuments).mockReturnValueOnce([
        {
          metadata: {
            id: 'doc1',
            title: 'JS Doc',
            source: 'markdown' as any,
            tags: ['javascript'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          content: '',
          chunks: [],
          status: 'completed' as any,
          vectorizationStatus: 'completed' as any,
        },
        {
          metadata: {
            id: 'doc2',
            title: 'Python Doc',
            source: 'markdown' as any,
            tags: ['python'],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          content: '',
          chunks: [],
          status: 'completed' as any,
          vectorizationStatus: 'completed' as any,
        },
      ]);

      const result = await handleToolCall('list_documents', { filterByTags: ['javascript'] });

      expect(result.content[0].text).toContain('JS Doc');
      expect(result.content[0].text).not.toContain('Python Doc');
    });
  });

  describe('getDocument input validation', () => {
    let handleToolCall: Function;

    beforeEach(async () => {
      await server.start();
      handleToolCall = (server as any).handleToolCall.bind(server);
    });

    it('should reject missing documentId', async () => {
      const result = await handleToolCall('get_document', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('documentId parameter is required');
    });

    it('should reject non-UUID documentId', async () => {
      const result = await handleToolCall('get_document', { documentId: 'not-a-uuid' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('documentId must be a valid UUID');
    });

    it('should accept valid UUID format', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const result = await handleToolCall('get_document', { documentId: validUuid });

      // Should not have UUID validation error
      expect(result.content[0].text).not.toContain('documentId must be a valid UUID');
    });

    it('should return not-found message for non-existent document', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.getDocument).mockReturnValueOnce(undefined);

      const result = await handleToolCall('get_document', {
        documentId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Document not found');
    });

    it('should return document content for valid existing document', async () => {
      const { documentService } = await import('../services/documents.js');
      vi.mocked(documentService.getDocument).mockReturnValueOnce({
        metadata: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          title: 'My Test Document',
          source: 'api' as any,
          tags: ['test'],
          createdAt: new Date(),
          updatedAt: new Date(),
          wordCount: 100,
        },
        content: 'This is the document content',
        chunks: [],
        status: 'completed' as any,
        vectorizationStatus: 'completed' as any,
      });

      const result = await handleToolCall('get_document', {
        documentId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('My Test Document');
      expect(result.content[0].text).toContain('This is the document content');
    });
  });

  describe('addDocument input validation', () => {
    let handleToolCall: Function;

    beforeEach(async () => {
      await server.start();
      handleToolCall = (server as any).handleToolCall.bind(server);
    });

    it('should reject missing content', async () => {
      const result = await handleToolCall('add_document', { title: 'Test' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('content parameter is required');
    });

    it('should reject missing title', async () => {
      const result = await handleToolCall('add_document', { content: 'Some content' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('title parameter is required');
    });

    it('should reject content exceeding 1MB (1,000,000 chars)', async () => {
      const hugeContent = 'a'.repeat(1000001);
      const result = await handleToolCall('add_document', {
        content: hugeContent,
        title: 'Test',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('content too large');
    });

    it('should reject title exceeding 500 characters', async () => {
      const longTitle = 'a'.repeat(501);
      const result = await handleToolCall('add_document', {
        content: 'Content',
        title: longTitle,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('title too long');
    });

    it('should reject non-array tags', async () => {
      const result = await handleToolCall('add_document', {
        content: 'Content',
        title: 'Title',
        tags: 'not-an-array',
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tags must be an array of strings');
    });

    it('should reject tags with non-string elements', async () => {
      const result = await handleToolCall('add_document', {
        content: 'Content',
        title: 'Title',
        tags: ['valid', 123],
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('tags must be an array of strings');
    });

    it('should successfully add a valid document', async () => {
      const result = await handleToolCall('add_document', {
        content: 'Valid document content',
        title: 'Valid Title',
        tags: ['tag1', 'tag2'],
      });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Document added successfully');
    });
  });

  describe('unknown tool', () => {
    let handleToolCall: Function;

    beforeEach(async () => {
      await server.start();
      handleToolCall = (server as any).handleToolCall.bind(server);
    });

    it('should return error for unknown tool name', async () => {
      const result = await handleToolCall('unknown_tool', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Unknown tool');
    });
  });
});
