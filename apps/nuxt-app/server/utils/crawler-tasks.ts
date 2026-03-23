/**
 * 爬虫任务管理工具
 * 管理活跃任务和 WebSocket 广播
 */
import type { CrawlerTask, CrawlerTaskProgress } from '@local-rag/shared/types'

type WsManager = {
  broadcast: (event: string, payload: unknown) => void
}

// 存储活跃的任务
export const activeTasks = new Map<string, CrawlerTask>()

// 爬虫配置常量
export const CRAWLER_CONFIG = {
  MAX_QUEUE_SIZE: 10,
  DEFAULT_TOTAL_STEPS_NO_AUTH: 4,
  DEFAULT_TOTAL_STEPS_WITH_AUTH: 7,
  MAX_XPATH_LENGTH: 1000,
  MAX_PREVIEW_LENGTH: 100_000, // 100KB
}

/**
 * 更新任务进度
 */
export function updateTaskProgress(
  task: CrawlerTask,
  progress: Partial<CrawlerTaskProgress>
): void {
  task.progress = {
    ...task.progress,
    ...progress,
  } as CrawlerTaskProgress
  task.lastUpdatedAt = new Date()
}

/**
 * 广播任务更新（通过 WebSocket）
 */
export function broadcastTaskUpdate(task: CrawlerTask): void {
  const wsManager = (globalThis as typeof globalThis & { __wsManager?: WsManager }).__wsManager

  // 创建干净的副本用于广播
  const taskCopy = {
    id: task.id,
    url: task.url,
    status: task.status,
    type: task.type,
    waitForAuth: task.waitForAuth,
    useXPath: task.useXPath,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    error: task.error,
    documentCount: task.documentCount,
    authStatus: task.authStatus,
    xpath: task.xpath,
    previewMarkdown: task.previewMarkdown && task.previewMarkdown.length > CRAWLER_CONFIG.MAX_PREVIEW_LENGTH
      ? task.previewMarkdown.substring(0, CRAWLER_CONFIG.MAX_PREVIEW_LENGTH) + '\n\n[内容过长，已截断]'
      : task.previewMarkdown,
    progress: task.progress,
    lastUpdatedAt: task.lastUpdatedAt,
    contentXPath: task.contentXPath,
    linksXPath: task.linksXPath,
    batchResults: task.batchResults,
    totalLinks: task.totalLinks,
    completedLinks: task.completedLinks,
    metadata: task.metadata,
  }

  // 使用 WebSocket 管理器广播
  if (wsManager) {
    wsManager.broadcast('crawler:task:updated', taskCopy)
  }
}
