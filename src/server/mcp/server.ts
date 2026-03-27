/**
 * MCP Server implementation for Claude Code integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { searchService } from '../services/search.js';
import { documentService } from '../services/documents.js';
import { createLogger } from '../../shared/utils/logger.js';
import type { MCPToolResult } from '../../shared/types/index.js';

const log = createLogger('mcp');

export class MCPServer {
  private server: Server | null = null;
  private running = false;

  /**
   * Initialize and start MCP server
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    try {
      // Create server instance
      this.server = new Server(
        {
          name: 'devrag-cli',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Register tool list handler
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: this.getToolDefinitions(),
        };
      });

      // Register tool call handler
      this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
        const result = await this.handleToolCall(request.params.name, request.params.arguments || {});
        return result as any;
      });

      // Connect using stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      this.running = true;
      log.info('MCP Server started successfully');
    } catch (error) {
      log.error('Failed to start MCP Server', error);
      throw error;
    }
  }

  /**
   * Get available tool definitions
   */
  private getToolDefinitions() {
    return [
      {
        name: 'search_knowledge_base',
        description:
          'Search the local knowledge base for relevant documents using semantic search. Returns top-k most relevant document chunks with similarity scores.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query in natural language',
            },
            topK: {
              type: 'number',
              description: 'Number of results to return (default: 3)',
              default: 3,
            },
            useHybridSearch: {
              type: 'boolean',
              description: 'Use hybrid search combining semantic and keyword matching (default: true)',
              default: true,
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_documents',
        description: 'List all documents in the knowledge base with metadata',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of documents to return (default: 50)',
              default: 50,
            },
            filterByTags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter documents by tags',
            },
          },
        },
      },
      {
        name: 'get_document',
        description: 'Get the full content of a specific document by ID',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: {
              type: 'string',
              description: 'The ID of the document to retrieve',
            },
          },
          required: ['documentId'],
        },
      },
      {
        name: 'add_document',
        description: 'Add a new document to the knowledge base from text content',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The document content in markdown or plain text',
            },
            title: {
              type: 'string',
              description: 'The document title',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for the document',
            },
          },
          required: ['content', 'title'],
        },
      },
    ];
  }

  /**
   * Handle tool calls
   */
  private async handleToolCall(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    try {
      log.info(`MCP Tool called: ${name}`, args);

      switch (name) {
        case 'search_knowledge_base':
          return await this.searchKnowledgeBase(args);
        case 'list_documents':
          return await this.listDocuments(args);
        case 'get_document':
          return await this.getDocument(args);
        case 'add_document':
          return await this.addDocument(args);
        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
      }
    } catch (error) {
      log.error(`Tool execution failed: ${name}`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Search knowledge base tool with input validation
   */
  private async searchKnowledgeBase(args: Record<string, unknown>): Promise<MCPToolResult> {
    const query = args.query as string;
    const topK = (args.topK as number) || 3;
    const useHybrid = (args.useHybridSearch as boolean) !== false;

    // Validate query parameter
    if (!query || typeof query !== 'string') {
      return {
        content: [{ type: 'text', text: 'Error: Query parameter is required and must be a string' }],
        isError: true,
      };
    }

    // Validate query length
    if (query.length > 1000) {
      return {
        content: [{ type: 'text', text: 'Error: Query too long (max 1000 characters)' }],
        isError: true,
      };
    }

    // Validate and sanitize query
    const sanitizedQuery = query.trim().slice(0, 500);

    // Validate topK
    if (topK < 1 || topK > 100) {
      return {
        content: [{ type: 'text', text: 'Error: topK must be between 1 and 100' }],
        isError: true,
      };
    }

    const searchQuery = {
      query: sanitizedQuery,
      topK,
    };

    const results = useHybrid
      ? await searchService.hybridSearch(searchQuery)
      : await searchService.semanticSearch(searchQuery);

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No relevant documents found for query: "${sanitizedQuery}"`,
          },
        ],
      };
    }

    // Format results
    const formattedResults = results
      .map(
        (result, index) =>
          `${index + 1}. **${result.metadata.title}** (Score: ${result.score.toFixed(3)})
   Source: ${result.metadata.source}
   Tags: ${result.metadata.tags?.join(', ') || 'none'}

   ${result.content.slice(0, 500)}...

   ---`
      )
      .join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${results.length} relevant documents for query: "${sanitizedQuery}"\n\n${formattedResults}`,
        },
      ],
    };
  }

  /**
   * List documents tool with input validation
   */
  private async listDocuments(args: Record<string, unknown>): Promise<MCPToolResult> {
    const limit = (args.limit as number) || 50;
    const filterByTags = args.filterByTags as string[] | undefined;

    // Validate limit
    if (limit < 1 || limit > 1000) {
      return {
        content: [{ type: 'text', text: 'Error: limit must be between 1 and 1000' }],
        isError: true,
      };
    }

    // Validate filterByTags
    if (filterByTags && !Array.isArray(filterByTags)) {
      return {
        content: [{ type: 'text', text: 'Error: filterByTags must be an array' }],
        isError: true,
      };
    }

    let documents = documentService.getAllDocuments();

    // Filter by tags if specified
    if (filterByTags && filterByTags.length > 0) {
      documents = documents.filter((doc) =>
        filterByTags.some((tag) => doc.metadata.tags?.includes(tag))
      );
    }

    // Limit results
    documents = documents.slice(0, limit);

    if (documents.length === 0) {
      return {
        content: [{ type: 'text', text: 'No documents found in knowledge base' }],
      };
    }

    // Format results
    const formattedDocs = documents
      .map(
        (doc) =>
          `- **${doc.metadata.title}** (ID: ${doc.metadata.id})
   Source: ${doc.metadata.source}
   Tags: ${doc.metadata.tags?.join(', ') || 'none'}
   Status: ${doc.vectorizationStatus}
   Created: ${doc.metadata.createdAt.toLocaleDateString()}`
      )
      .join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Knowledge base contains ${documents.length} documents:\n\n${formattedDocs}`,
        },
      ],
    };
  }

  /**
   * Get document tool with input validation
   */
  private async getDocument(args: Record<string, unknown>): Promise<MCPToolResult> {
    const documentId = args.documentId as string;

    if (!documentId || typeof documentId !== 'string') {
      return {
        content: [{ type: 'text', text: 'Error: documentId parameter is required and must be a string' }],
        isError: true,
      };
    }

    // Validate documentId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(documentId)) {
      return {
        content: [{ type: 'text', text: 'Error: documentId must be a valid UUID' }],
        isError: true,
      };
    }

    const document = documentService.getDocument(documentId);

    if (!document) {
      return {
        content: [{ type: 'text', text: `Document not found: ${documentId}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `# ${document.metadata.title}

**Source:** ${document.metadata.source}
**Tags:** ${document.metadata.tags?.join(', ') || 'none'}
**Created:** ${document.metadata.createdAt.toLocaleDateString()}
**Word Count:** ${document.metadata.wordCount}

---

${document.content}`,
        },
      ],
    };
  }

  /**
   * Add document tool with input validation
   */
  private async addDocument(args: Record<string, unknown>): Promise<MCPToolResult> {
    const content = args.content as string;
    const title = args.title as string;
    const tags = (args.tags as string[]) || undefined;

    // Validate required parameters
    if (!content || typeof content !== 'string') {
      return {
        content: [{ type: 'text', text: 'Error: content parameter is required and must be a string' }],
        isError: true,
      };
    }

    if (!title || typeof title !== 'string') {
      return {
        content: [{ type: 'text', text: 'Error: title parameter is required and must be a string' }],
        isError: true,
      };
    }

    // Validate content length
    if (content.length > 1000000) { // 1MB limit
      return {
        content: [{ type: 'text', text: 'Error: content too large (max 1MB)' }],
        isError: true,
      };
    }

    // Validate title length
    if (title.length > 500) {
      return {
        content: [{ type: 'text', text: 'Error: title too long (max 500 characters)' }],
        isError: true,
      };
    }

    // Validate tags
    if (tags && (!Array.isArray(tags) || tags.some(t => typeof t !== 'string'))) {
      return {
        content: [{ type: 'text', text: 'Error: tags must be an array of strings' }],
        isError: true,
      };
    }

    try {
      const document = await documentService.addDocumentFromText(content, title, {
        tags,
        onProgress: (progress) => {
          log.debug(`Vectorization progress: ${progress.processedChunks}/${progress.totalChunks}`);
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: `Document added successfully!\n\n**Title:** ${document.metadata.title}\n**Document ID:** ${document.metadata.id}\n**Status:** ${document.vectorizationStatus}\n\nThe document is being vectorized and will be available for search shortly.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to add document: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (this.server && this.running) {
      await this.server.close();
      this.running = false;
      log.info('MCP Server stopped');
    }
  }

  /**
   * Check if server is running
   */
  isActive(): boolean {
    return this.running;
  }
}

export const mcpServer = new MCPServer();
