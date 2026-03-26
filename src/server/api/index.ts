/**
 * REST API server using Hono
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { config } from '../../shared/utils/config.js';
import { logger } from '../../shared/utils/logger.js';
import { documentService } from '../services/documents.js';
import { searchService } from '../services/search.js';
import { crawlerService } from '../services/crawler.js';
import { embeddingService } from '../services/embeddings.js';
import { vectorStore } from '../services/vectorstore.js';
import { AppError, DocumentNotFoundError } from '../../shared/types/index.js';

const app = new Hono();

// Middleware
app.use('*', honoLogger());
app.use('*', cors());

// Request body size limit middleware (10MB)
app.use('*', async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (size > maxSize) {
      return c.json({ error: 'Request body too large (max 10MB)' }, 413);
    }
  }
  await next();
});

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      ollama: embeddingService.isReady(),
      vectorStore: vectorStore.isReady(),
    },
  });
});

// System status
app.get('/api/status', async (c) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  // Import MCP server dynamically to avoid circular dependency
  const { mcpServer } = await import('../mcp/server.js');

  return c.json({
    uptime,
    memoryUsage: {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    },
    cpuUsage: process.cpuUsage(),
    documentCount: documentService.getAllDocuments().length,
    vectorCount: await vectorStore.getVectorCount(),
    ollamaConnected: embeddingService.isReady(),
    ollamaModel: embeddingService.getModel(),
    mcpConnected: mcpServer.isActive(),
  });
});

// Document routes
app.get('/api/documents', (c) => {
  const documents = documentService.getAllDocuments();
  return c.json({
    documents: documents.map((doc) => ({
      id: doc.metadata.id,
      title: doc.metadata.title,
      source: doc.metadata.source,
      tags: doc.metadata.tags,
      status: doc.vectorizationStatus,
      createdAt: doc.metadata.createdAt,
      wordCount: doc.metadata.wordCount,
    })),
    total: documents.length,
  });
});

app.get('/api/documents/:id', (c) => {
  const id = c.req.param('id');
  const document = documentService.getDocument(id!);

  if (!document) {
    throw new DocumentNotFoundError(id!);
  }

  return c.json({
    metadata: document.metadata,
    content: document.content,
    status: document.vectorizationStatus,
    chunkCount: document.chunks.length,
  });
});

app.delete('/api/documents/:id', async (c) => {
  const id = c.req.param('id');
  await documentService.deleteDocument(id!);
  return c.json({ success: true, message: 'Document deleted' });
});

app.get('/api/documents/:id/progress', (c) => {
  const id = c.req.param('id');
  const progress = documentService.getVectorizationProgress(id!);

  if (!progress) {
    return c.json({ progress: null });
  }

  return c.json({
    progress: {
      documentId: progress.documentId,
      documentTitle: progress.documentTitle,
      totalChunks: progress.totalChunks,
      processedChunks: progress.processedChunks,
      status: progress.status,
      error: progress.error,
      percentage: (progress.processedChunks / progress.totalChunks) * 100,
    },
  });
});

// Search routes
app.post('/api/search', async (c) => {
  const body = await c.req.json();
  const { query, topK = 3, filters, threshold } = body;

  if (!query) {
    return c.json({ error: 'Query parameter is required' }, 400);
  }

  const searchQuery = {
    query,
    topK,
    filters,
    threshold,
  };

  const results = await searchService.hybridSearch(searchQuery);

  return c.json({
    query,
    results: results.map((result) => ({
      documentId: result.documentId,
      chunkId: result.chunkId,
      content: result.content,
      preview: result.content.slice(0, 500) + (result.content.length > 500 ? '...' : ''),
      score: result.combinedScore,
      semanticScore: result.semanticScore,
      keywordScore: result.keywordScore,
      method: result.method,
      metadata: result.metadata,
    })),
    total: results.length,
  });
});

app.get('/api/suggestions', async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '5');

  if (!query) {
    return c.json({ suggestions: [] });
  }

  const suggestions = await searchService.getSearchSuggestions(query, limit);
  return c.json({ suggestions });
});

// Import routes
app.post('/api/import/markdown', async (c) => {
  const body = await c.req.json();
  const { path, options = {} } = body;

  if (!path) {
    return c.json({ error: 'Path parameter is required' }, 400);
  }

  try {
    const document = await documentService.importMarkdownFile(path, options);
    return c.json({
      success: true,
      document: {
        id: document.metadata.id,
        title: document.metadata.title,
        status: document.vectorizationStatus,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post('/api/import/obsidian', async (c) => {
  const body = await c.req.json();
  const { vaultPath, options = {} } = body;

  if (!vaultPath) {
    return c.json({ error: 'vaultPath parameter is required' }, 400);
  }

  try {
    const documents = await documentService.importObsidianVault(vaultPath, options);
    return c.json({
      success: true,
      imported: documents.length,
      documents: documents.map((doc) => ({
        id: doc.metadata.id,
        title: doc.metadata.title,
        status: doc.vectorizationStatus,
      })),
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post('/api/import/text', async (c) => {
  const body = await c.req.json();
  const { content, title, options = {} } = body;

  if (!content || !title) {
    return c.json({ error: 'Content and title are required' }, 400);
  }

  try {
    const document = await documentService.addDocumentFromText(title, content, options);
    return c.json({
      success: true,
      document: {
        id: document.metadata.id,
        title: document.metadata.title,
        status: document.vectorizationStatus,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

// Crawler routes
app.post('/api/crawl', async (c) => {
  const body = await c.req.json();
  const { url, cookies, waitForSelector, timeout, screenshot } = body;

  if (!url) {
    return c.json({ error: 'URL parameter is required' }, 400);
  }

  try {
    const result = await crawlerService.crawlUrl({
      url,
      cookies,
      waitForSelector,
      timeout,
      screenshot,
    });

    // Import the crawled content
    await documentService.addDocumentFromText(result.content, result.title, {
      tags: ['webpage', 'crawled'],
    });

    return c.json({
      success: true,
      result: {
        url: result.url,
        title: result.title,
        wordCount: result.metadata.wordCount,
        language: result.metadata.language,
      },
    });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

// Error handler
app.onError((err, c) => {
  logger.error('API error', err);

  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
        code: err.code,
      },
      err.statusCode as any
    );
  }

  return c.json({ error: 'Internal server error' }, 500 as any);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Start server
export async function startServer() {
  const serverConfig = config.get('server');

  // Initialize services
  await embeddingService.initialize();
  await vectorStore.initialize();

  // Start HTTP server
  const port = serverConfig.port;
  const host = serverConfig.host;

  const server = serve({
    fetch: app.fetch,
    port,
    hostname: host,
  });

  logger.info(`Server started at http://${host}:${port}`);

  return server;
}

export { app };
