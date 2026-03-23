/**
 * POST /api/crawler/tasks/[id]/cancel - 取消爬虫任务
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, updateTaskProgress, broadcastTaskUpdate, cleanupTask } from '../../../../utils/crawler-tasks'

const logger = createLogger(LogSystem.API, 'crawler/tasks/cancel')

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Task ID is required',
    })
  }

  try {
    const task = activeTasks.get(id)

    if (!task) {
      throw createError({
        statusCode: 404,
        statusMessage: '任务不存在',
      })
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw createError({
        statusCode: 400,
        statusMessage: '任务已结束，无法取消',
      })
    }

    // 标记任务为失败
    task.status = 'failed'
    task.error = '用户取消'
    task.completedAt = new Date()
    task.lastUpdatedAt = new Date()

    broadcastTaskUpdate(task)

    // 清理任务资源
    cleanupTask(id)

    return {
      success: true,
      data: task,
    }
  } catch (error) {
    logger.error('取消任务 API 错误', error as Error)
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode) || 500
      : 500
    throw createError({
      statusCode,
      statusMessage: error instanceof Error ? error.message : 'Failed to cancel task',
    })
  }
})
