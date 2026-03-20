/**
 * API 客户端
 * 封装 $fetch 用于 API 调用
 */
import type { FetchOptions } from 'ofetch'
import type {
  ApiResponse,
  PaginatedResponse,
  Note,
  CrawlerTask,
  CrawlerSession,
  KnowledgeDocument,
  RAGQueryResult,
  StorageFile,
} from './types'

// 重新导出类型
export type {
  ApiResponse,
  PaginatedResponse,
  Note,
  CrawlerTask,
  CrawlerSession,
  KnowledgeDocument,
  RAGQueryResult,
  StorageFile,
} from './types'

// 浏览器环境日志工具
const logger = {
  debug: (...args: unknown[]) => console.debug('[api]', ...args),
  info: (...args: unknown[]) => console.info('[api]', ...args),
  warn: (...args: unknown[]) => console.warn('[api]', ...args),
  error: (...args: unknown[]) => console.error('[api]', ...args),
}

const baseURL = '/api'

export const api = $fetch.create({
  baseURL,
  onRequest({ options }) {
    // 可以在这里添加认证头等
    options.headers = {
      ...options.headers,
      'Content-Type': 'application/json',
    }
  },
  onResponseError({ response }) {
    logger.error('API 请求失败', new Error(response._data?.message || 'Unknown error'), {
      status: response.status,
      url: response.url,
    })
  },
})

/**
 * 笔记 API
 */
export const notesApi = {
  list: (params?: { page?: number; pageSize?: number; tag?: string; search?: string }) =>
    api<ApiResponse<PaginatedResponse<Note>>>('/notes', {
      query: params,
    }),
  get: (id: string) =>
    api<ApiResponse<Note>>(`/notes/${id}`),
  create: (data: { title: string; content: string; tags?: string[] }) =>
    api<ApiResponse<Note>>('/notes', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: { title?: string; content?: string; tags?: string[] }) =>
    api<ApiResponse<Note>>(`/notes/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    api<ApiResponse<void>>(`/notes/${id}`, {
      method: 'DELETE',
    }),
  search: (title: string) =>
    api<ApiResponse<Note[]>>('/notes', {
      query: { search: title },
    }),
  uploadImage: (id: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return $fetch<ApiResponse<{ url: string }>>(`/api/notes/${id}/images`, {
      method: 'POST',
      body: formData,
    })
  },
}

/**
 * 爬虫 API
 */
export const crawlerApi = {
  getTasks: () =>
    api<ApiResponse<CrawlerTask[]>>('/crawler/tasks'),
  getTask: (id: string) =>
    api<ApiResponse<CrawlerTask>>(`/crawler/tasks/${id}`),
  start: (data: { url: string; waitForAuth?: boolean; useXPath?: boolean }) =>
    api<ApiResponse<CrawlerTask>>('/crawler/tasks', {
      method: 'POST',
      body: data,
    }),
  cancel: (id: string) =>
    api<ApiResponse<CrawlerTask>>(`/crawler/tasks/${id}/cancel`, {
      method: 'POST',
    }),
  submitXPath: (params: { taskId: string; xpath: string }) =>
    api<ApiResponse<{ markdown: string; title: string }>>('/crawler/xpath', {
      method: 'POST',
      body: params,
    }),
  confirmContent: (params: { taskId: string; confirmed: boolean }) =>
    api<ApiResponse<CrawlerTask & { message?: string }>>('/crawler/confirm', {
      method: 'POST',
      body: params,
    }),
  closeBrowser: (taskId: string) =>
    api<ApiResponse<{ message: string }>>('/crawler/close-browser', {
      method: 'POST',
      body: { taskId },
    }),
  getSessions: () =>
    api<ApiResponse<CrawlerSession[]>>('/crawler/sessions'),
  deleteSession: (domain: string) =>
    api<ApiResponse<{ domain: string }>>(`/crawler/sessions/${domain}`, {
      method: 'DELETE',
    }),
  getQueueStatus: () =>
    api<ApiResponse<{ pending: number; size: number }>>('/crawler/queue/status'),
}

/**
 * 知识库 API
 */
export const knowledgeApi = {
  list: (params?: { page?: number; pageSize?: number; type?: string; search?: string }) =>
    api<ApiResponse<PaginatedResponse<KnowledgeDocument>>>('/knowledge', {
      query: params,
    }),
  get: (id: string) =>
    api<ApiResponse<KnowledgeDocument>>(`/knowledge/${id}`),
  search: (keywords: string[]) =>
    api<ApiResponse<KnowledgeDocument[]>>('/knowledge/search', {
      method: 'POST',
      body: { keywords },
    }),
  delete: (id: string) =>
    api<ApiResponse<{ id: string }>>(`/knowledge/${id}`, {
      method: 'DELETE',
    }),
  reindex: () =>
    api<ApiResponse<{ message: string }>>('/knowledge/reindex', {
      method: 'POST',
    }),
}

/**
 * RAG API
 */
export const ragApi = {
  query: (data: { query: string; topK?: number; threshold?: number; searchType?: string }) =>
    api<ApiResponse<RAGQueryResult>>('/rag/query', {
      method: 'POST',
      body: data,
    }),
  index: (documentId: string) =>
    api<ApiResponse<{ message: string }>>('/rag/index', {
      method: 'POST',
      body: { documentId },
    }),
  removeFromIndex: (documentId: string) =>
    api<ApiResponse<{ message: string }>>(`/rag/index/${documentId}`, {
      method: 'DELETE',
    }),
}

/**
 * 存储 API
 */
export const storageApi = {
  listFiles: (path?: string) =>
    api<ApiResponse<StorageFile[]>>('/storage/files', {
      query: { path },
    }),
  index: (path: string, recursive = true) =>
    api<ApiResponse<{ message: string; indexed: number }>>('/storage/index', {
      method: 'POST',
      body: { path, recursive },
    }),
  removeFile: (documentId: string) =>
    api<ApiResponse<{ message: string }>>(`/storage/files/${documentId}`, {
      method: 'DELETE',
    }),
  getIgnoreRules: () =>
    api<ApiResponse<{ default: string[]; custom: string[] }>>('/storage/ignore'),
  updateIgnoreRules: (custom: string[]) =>
    api<ApiResponse<{ default: string[]; custom: string[] }>>('/storage/ignore', {
      method: 'PUT',
      body: { custom },
    }),
}
