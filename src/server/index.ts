/**
 * Server entry point
 */

export { startServer, app } from './api/index.js';
export { mcpServer } from './mcp/server.js';
export * from './services/documents.js';
export * from './services/embeddings.js';
export * from './services/vectorstore.js';
export * from './services/search.js';
export * from './services/crawler.js';
