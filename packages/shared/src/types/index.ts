// 日志类型
export * from './logger.js';

// 文档类型
export interface Document {
  id: string;
  title: string;
  content: string;
  source: string;
  metadata: DocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentMetadata {
  type: 'note' | 'webpage' | 'file' | 'code';
  tags?: string[];
  author?: string;
  url?: string;
  filePath?: string;
  language?: string;
  chunkIndex?: number;
  totalChunks?: number;
}

// 笔记类型
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  images: NoteImage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NoteImage {
  id: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
}

// RAG 查询类型
export interface RAGQuery {
  query: string;
  topK?: number;
  threshold?: number;
  searchType?: 'dense' | 'sparse' | 'hybrid';
}

export interface RAGResult {
  query: string;
  results: RAGDocumentChunk[];
  totalResults: number;
  queryTime: number;
}

export interface RAGDocumentChunk {
  documentId: string;
  chunkId: string;
  content: string;
  score: number;
  metadata: DocumentMetadata;
}

// 爬虫类型
export type CrawlerTaskStatus =
  | 'pending'
  | 'running'
  | 'waiting_auth'
  | 'waiting_xpath'
  | 'ready_crawl'
  | 'waiting_confirm'
  | 'completed'
  | 'failed';

export interface CrawlerTask {
  id: string;
  url: string;
  status: CrawlerTaskStatus;
  waitForAuth: boolean;
  useXPath?: boolean;
  authStatus?: 'none' | 'detected' | 'waiting_qrcode' | 'success' | 'failed';
  xpath?: string;
  previewMarkdown?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  documentCount?: number;
}

export interface XPathSubmitRequest {
  taskId: string;
  xpath: string;
}

export interface ContentPreview {
  taskId: string;
  markdown: string;
  title: string;
  previewLength: number;
}

export interface ContentConfirmRequest {
  taskId: string;
  confirmed: boolean;
}

export interface CrawlerSession {
  domain: string;
  createdAt: Date;
  updatedAt: Date;
  cookies: Cookie[];
  localStorage: Record<string, string>;
  userAgent: string;
}

export interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// 配置类型
export interface LlamaConfig {
  embeddings: {
    provider: 'ollama' | 'openai' | 'local';
    model: string;
    dimension: number;
    batchSize: number;
  };
  vectorStore: {
    type: 'chroma' | 'simple';
    path: string;
    collectionName: string;
  };
  retrieval: {
    topK: number;
    similarityThreshold: number;
    searchType: 'dense' | 'sparse' | 'hybrid';
  };
  chunking: {
    chunkSize: number;
    chunkOverlap: number;
    splitter: 'sentence' | 'paragraph' | 'token';
  };
}

export interface CrawlerConfig {
  request: {
    timeout: number;
    retries: number;
    userAgent: string;
  };
  browser: {
    headless: boolean;
    viewport: {
      width: number;
      height: number;
    };
  };
  auth: {
    sessionPath: string;
    credentialPath: string;
  };
  parsing: {
    removeSelectors: string[];
    contentSelector: string;
    extractImages: boolean;
  };
}
