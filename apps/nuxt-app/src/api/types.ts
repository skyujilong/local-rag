/**
 * API 响应类型
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * 笔记类型
 */
export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  images: NoteImage[]
  createdAt: Date
  updatedAt: Date
}

export interface NoteImage {
  id: string
  filename: string
  path: string
  size: number
  mimeType: string
}

/**
 * 爬虫类型
 */
export interface CrawlerTask {
  id: string
  url: string
  status: CrawlerTaskStatus
  waitForAuth: boolean
  useXPath?: boolean
  authStatus?: 'none' | 'detected' | 'waiting_qrcode' | 'success' | 'failed'
  xpath?: string
  previewMarkdown?: string
  startedAt?: Date
  completedAt?: Date
  error?: string
  documentCount?: number
  progress?: CrawlerTaskProgress
  lastUpdatedAt?: string
  metadata?: {
    browserPid?: number
    pageId?: string
    sessionId?: string
  }
}

export type CrawlerTaskStatus =
  | 'pending'
  | 'running'
  | 'waiting_auth'
  | 'waiting_xpath'
  | 'ready_crawl'
  | 'waiting_confirm'
  | 'completed'
  | 'failed'

export interface CrawlerTaskProgress {
  currentStep: string
  currentStepNumber: number
  totalSteps: number
  progressPercentage: number
  stepDetails?: string
}

export interface CrawlerSession {
  domain: string
  createdAt: Date
  updatedAt: Date
  cookies: Cookie[]
  localStorage: Record<string, string>
  userAgent: string
}

export interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  expires?: number
  secure?: boolean
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

/**
 * 知识库类型
 */
export interface KnowledgeDocument {
  id: string
  title: string
  content: string
  source: string
  type: string
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

/**
 * RAG 类型
 */
export interface RAGQueryResult {
  query: string
  results: RAGDocumentChunk[]
  totalResults: number
  queryTime: number
}

export interface RAGDocumentChunk {
  documentId: string
  chunkId: string
  content: string
  score: number
  metadata: {
    type: string
    tags?: string[]
    author?: string
    url?: string
    filePath?: string
  }
}

/**
 * 存储类型
 */
export interface StorageFile {
  id: string
  path: string
  name: string
  type: string
  size: number
  indexedAt: Date
}
