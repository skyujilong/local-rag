/**
 * 爬虫任务管理工具
 * 管理活跃任务和 WebSocket 广播
 */
import type { CrawlerTask, CrawlerTaskProgress } from '@local-rag/shared/types'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activePages, clearXPathTimeout, teardownPageEventListeners } from '../crawler/crawler-service.js'
import { getWebSocketManager } from './websocket-manager'

const logger = createLogger(LogSystem.API, 'crawler-tasks')

// 使用 globalThis 存储活跃任务，防止 Nitro 热重载时数据丢失
const ACTIVE_TASKS_KEY = '__local_rag_active_tasks__'

// 初始化 globalThis 中的 Map
if (!(ACTIVE_TASKS_KEY in globalThis)) {
  (globalThis as any)[ACTIVE_TASKS_KEY] = new Map<string, CrawlerTask>()
  logger.info('📦 [crawler-tasks] 初始化 globalThis activeTasks Map')
}

// 导出对 globalThis 中 Map 的引用
export const activeTasks = (globalThis as any)[ACTIVE_TASKS_KEY] as Map<string, CrawlerTask>

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
  const wsManager = getWebSocketManager()

  logger.debug('广播任务更新', {
    taskId: task.id,
    status: task.status,
    clientCount: wsManager.getClientCount(),
  })

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
  wsManager.broadcast('crawler:task:updated', taskCopy)

  // 更新状态快照，供重连客户端使用
  const allTasks = Array.from(activeTasks.values())
  wsManager.updateSnapshot(allTasks)
}

/**
 * 清理任务资源
 * 在任务完成、取消或超时时调用，释放相关资源
 */
export function cleanupTask(taskId: string): void {
  logger.info('开始清理任务资源', { taskId })

  try {
    // 关闭并清理页面引用
    const page = activePages.get(taskId)
    if (page) {
      // 清理事件监听器
      teardownPageEventListeners(page)

      page.close().catch((err) => {
        logger.error('关闭页面失败', err as Error, { taskId })
      })
      activePages.delete(taskId)
      logger.debug('页面引用已清理', { taskId })
    }

    // 清除 XPath 超时定时器
    clearXPathTimeout(taskId)

    // 从活跃任务中移除
    const removed = activeTasks.delete(taskId)
    if (removed) {
      logger.info('任务资源已清理', { taskId })
    } else {
      logger.warn('任务不存在，可能已被清理', { taskId })
    }
  } catch (error) {
    logger.error('清理任务资源失败', error as Error, { taskId })
  }
}

/**
 * 清理过期任务
 * 定期调用以清理长时间未更新的任务
 */
export function cleanupExpiredTasks(maxAge: number = 3600000): number {
  const now = Date.now()
  const expiredTaskIds: string[] = []

  for (const [taskId, task] of activeTasks.entries()) {
    const taskAge = now - (task.lastUpdatedAt?.getTime() || task.startedAt?.getTime() || 0)

    // 清理超过最大年龄的任务
    if (taskAge > maxAge) {
      expiredTaskIds.push(taskId)
    }
  }

  // 清理过期任务
  for (const taskId of expiredTaskIds) {
    cleanupTask(taskId)
  }

  if (expiredTaskIds.length > 0) {
    logger.info('已清理过期任务', {
      count: expiredTaskIds.length,
      taskIds: expiredTaskIds,
    })
  }

  return expiredTaskIds.length
}

/**
 * 获取活跃任务统计
 */
export function getActiveTasksStats(): {
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
} {
  const stats = {
    total: activeTasks.size,
    byStatus: {} as Record<string, number>,
    byType: {} as Record<string, number>,
  }

  for (const task of activeTasks.values()) {
    stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1
    stats.byType[task.type] = (stats.byType[task.type] || 0) + 1
  }

  return stats
}
