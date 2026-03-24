/**
 * 爬虫 API Composable
 * 封装爬虫相关的 API 调用
 */
import type { CrawlerTask, CrawlerSession } from '@local-rag/shared/types'

interface ConfirmCrawlerTaskResponse extends CrawlerTask {
  draftId?: string
  message?: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export function useCrawlerApi() {
  const config = useRuntimeConfig()
  // 使用相对路径，自动跟随当前页面的 host 和 port
  const baseURL = config.public.apiBaseUrl || '/api'
  /**
   * 获取任务列表
   */
  async function getTasks() {
    return $fetch<ApiResponse<CrawlerTask[]>>('/crawler/tasks', { baseURL })
  }

  /**
   * 获取单个任务
   */
  async function getTask(id: string) {
    return $fetch<ApiResponse<CrawlerTask>>(`/crawler/tasks/${id}`, { baseURL })
  }

  /**
   * 开始爬虫任务
   */
  async function start(data: {
    url: string;
    taskType?: 'single' | 'batch';
    contentXPath?: string;
    linksXPath?: string;
    maxLinks?: number;
  }) {
    return $fetch<ApiResponse<CrawlerTask>>('/crawler/tasks', {
      baseURL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: data,
    })
  }

  /**
   * 确认开始爬取
   */
  async function confirmStartCrawl(taskId: string) {
    return $fetch<ApiResponse<CrawlerTask>>('/crawler/start-crawl', {
      baseURL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { taskId },
    })
  }

  /**
   * 取消任务
   */
  async function cancel(id: string) {
    return $fetch<ApiResponse<CrawlerTask>>(`/crawler/tasks/${id}/cancel`, {
      baseURL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * 提交 XPath
   */
  async function submitXPath(params: { taskId: string; xpath: string }) {
    return $fetch<ApiResponse<CrawlerTask>>('/crawler/xpath', {
      baseURL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: params,
    })
  }

  /**
   * 确认内容
   */
  async function confirmContent(params: { taskId: string; confirmed: boolean }) {
    return $fetch<ApiResponse<ConfirmCrawlerTaskResponse>>('/crawler/confirm', {
      baseURL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: params,
    })
  }

  /**
   * 关闭浏览器
   */
  async function closeBrowser(taskId: string) {
    return $fetch<ApiResponse<{ message: string }>>('/crawler/close-browser', {
      baseURL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { taskId },
    })
  }

  /**
   * 获取会话列表
   */
  async function getSessions() {
    return $fetch<ApiResponse<CrawlerSession[]>>('/crawler/sessions', { baseURL })
  }

  /**
   * 删除会话
   */
  async function deleteSession(domain: string) {
    return $fetch<ApiResponse<{ domain: string }>>(`/crawler/sessions/${domain}`, {
      baseURL,
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * 获取队列状态
   */
  async function getQueueStatus() {
    return $fetch<ApiResponse<{ pending: number; size: number }>>('/crawler/queue/status', { baseURL })
  }

  /**
   * 批量爬取
   */
  async function batchCrawl(params: {
    taskId: string
    linksXPath: string
    contentXPath?: string
    maxLinks?: number
  }) {
    return $fetch<ApiResponse<CrawlerTask>>('/crawler/batch', {
      baseURL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: params,
    })
  }

  return {
    getTasks,
    getTask,
    start,
    confirmStartCrawl,
    cancel,
    submitXPath,
    confirmContent,
    closeBrowser,
    getSessions,
    deleteSession,
    getQueueStatus,
    batchCrawl,
  }
}
