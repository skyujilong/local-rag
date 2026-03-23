/**
 * POST /api/crawler/batch - 批量爬取
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, updateTaskProgress, broadcastTaskUpdate } from '../../utils/crawler-tasks'
import type { BatchCrawlRequest } from '@local-rag/shared/types'

const logger = createLogger(LogSystem.API, 'crawler/batch')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<BatchCrawlRequest>(event)
    const { taskId, linksXPath, contentXPath, maxLinks = 100 } = body

    if (!taskId || !linksXPath) {
      throw createError({
        statusCode: 400,
        message: '请提供任务 ID 和链接 XPath',
      })
    }

    const task = activeTasks.get(taskId)
    if (!task) {
      throw createError({
        statusCode: 404,
        message: '任务不存在',
      })
    }

    // 更新任务为批量模式
    task.type = 'batch'
    task.linksXPath = linksXPath
    task.contentXPath = contentXPath
    task.status = 'running'
    task.batchResults = []
    task.totalLinks = 0
    task.completedLinks = 0

    updateTaskProgress(task, {
      currentStep: '提取链接列表',
      currentStepNumber: 1,
      totalSteps: 3,
      progressPercentage: 10,
      stepDetails: `使用 XPath: ${linksXPath}`,
    })

    broadcastTaskUpdate(task)

    // 异步执行批量爬取
    executeBatchCrawl(taskId, linksXPath, contentXPath, maxLinks).catch((error) => {
      logger.error(`批量爬取任务 ${taskId} 失败`, error as Error)
    })

    return {
      success: true,
      data: task,
    }
  } catch (error) {
    logger.error('批量爬取 API 错误', error as Error)
    throw error
  }
})

/**
 * 执行批量爬取
 */
async function executeBatchCrawl(
  taskId: string,
  linksXPath: string,
  contentXPath: string | undefined,
  maxLinks: number
) {
  const task = activeTasks.get(taskId)
  if (!task) return

  try {
    // TODO: 实现批量爬取逻辑
    // 1. 从当前页面提取所有链接
    // 2. 限制链接数量
    // 3. 逐个访问并爬取
    // 4. 实时更新进度

    logger.info(`开始批量爬取任务 ${taskId}`, {
      linksXPath,
      contentXPath,
      maxLinks,
    })

    // 这里先返回占位实现
    updateTaskProgress(task, {
      currentStep: '批量爬取完成',
      currentStepNumber: 3,
      totalSteps: 3,
      progressPercentage: 100,
    })
    task.status = 'completed'
    task.completedAt = new Date()
    task.lastUpdatedAt = new Date()

    broadcastTaskUpdate(task)
  } catch (error) {
    logger.error(`批量爬取任务 ${taskId} 执行失败`, error as Error)
    task.status = 'failed'
    task.error = error instanceof Error ? error.message : String(error)
    task.lastUpdatedAt = new Date()
    broadcastTaskUpdate(task)
  }
}
