/**
 * Core type definitions for devrag-cli
 */

/**
 * Document source types
 */
export enum DocumentSource {
  MARKDOWN = 'markdown',
  OBSIDIAN = 'obsidian',
  WEBPAGE = 'webpage',
  API = 'api',
}

/**
 * Document status in the system
 */
export enum DocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Vectorization status
 */
export enum VectorizationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

/**
 * Metadata for a document
 */
export interface DocumentMetadata {
  id: string;
  title: string;
  source: DocumentSource;
  path?: string;
  url?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  author?: string;
  language?: string;
  wordCount?: number;
}

/**
 * A text chunk from document splitting
 */
export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  startPosition: number;
  endPosition: number;
  metadata?: Record<string, unknown>;
}

/**
 * Vector embedding with metadata
 */
export interface VectorEmbedding {
  id: string;
  chunkId: string;
  documentId: string;
  embedding: number[];
  vectorDimension: number;
  model: string;
  createdAt: Date;
}

/**
 * Complete document with chunks
 */
export interface Document {
  metadata: DocumentMetadata;
  content: string;
  chunks: Chunk[];
  status: DocumentStatus;
  vectorizationStatus: VectorizationStatus;
  error?: string;
}

/**
 * Search result with relevance score
 */
export interface SearchResult {
  documentId: string;
  chunkId: string;
  content: string;
  score: number;
  metadata: DocumentMetadata;
  highlightedText?: string;
}

/**
 * Search query with filters
 */
export interface SearchQuery {
  query: string;
  topK?: number;
  filters?: {
    tags?: string[];
    sources?: DocumentSource[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  threshold?: number;
}

/**
 * Hybrid search result combining semantic and keyword search
 */
export interface HybridSearchResult extends SearchResult {
  semanticScore: number;
  keywordScore: number;
  combinedScore: number;
  method: 'semantic' | 'keyword' | 'hybrid';
}

/**
 * System status information
 */
export interface SystemStatus {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  documentCount: number;
  vectorCount: number;
  ollamaConnected: boolean;
  ollamaModel?: string;
  mcpConnected: boolean;
}

/**
 * Vectorization progress
 */
export interface VectorizationProgress {
  documentId: string;
  documentTitle: string;
  totalChunks: number;
  processedChunks: number;
  status: VectorizationStatus;
  error?: string;
  startTime: Date;
  estimatedCompletion?: Date;
}

/**
 * Crawler configuration
 */
export interface CrawlerConfig {
  url: string;
  cookies?: Record<string, string>;
  waitForSelector?: string;
  timeout?: number;
  screenshot?: boolean;
  incrementalUpdate?: boolean;
}

/**
 * Crawler result
 */
export interface CrawlerResult {
  url: string;
  title: string;
  content: string;
  metadata: {
    crawledAt: Date;
    wordCount: number;
    language?: string;
    screenshotPath?: string;
  };
  links?: string[];
  error?: string;
}

/**
 * Import options
 */
export interface ImportOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  tags?: string[];
  skipErrors?: boolean;
  onProgress?: (progress: VectorizationProgress) => void;
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP tool call result
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
  }>;
  isError?: boolean;
}

/**
 * Configuration for the application
 */
export interface AppConfig {
  server: {
    port: number;
    host: string;
    cors?: boolean;
  };
  ollama: {
    baseUrl: string;
    model: string;
    timeout: number;
  };
  chromadb: {
    path: string;
    collectionName: string;
  };
  processing: {
    chunkSize: number;
    chunkOverlap: number;
    maxConcurrency: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

/**
 * Error types
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DocumentNotFoundError extends AppError {
  constructor(documentId: string) {
    super(`Document not found: ${documentId}`, 'DOC_NOT_FOUND', 404);
    this.name = 'DocumentNotFoundError';
  }
}

export class VectorizationError extends AppError {
  constructor(documentId: string, reason: string) {
    super(`Vectorization failed for ${documentId}: ${reason}`, 'VECT_ERROR', 500);
    this.name = 'VectorizationError';
  }
}

export class OllamaConnectionError extends AppError {
  constructor(reason: string) {
    super(`Ollama connection failed: ${reason}`, 'OLLAMA_CONN_ERROR', 503);
    this.name = 'OllamaConnectionError';
  }
}

export class CrawlerError extends AppError {
  constructor(url: string, reason: string) {
    super(`Crawler failed for ${url}: ${reason}`, 'CRAWLER_ERROR', 500);
    this.name = 'CrawlerError';
  }
}
