/**
 * POST /api/crawler/close-browser - 手动关闭浏览器
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks } from '../../utils/crawler-tasks'
import { activePages } from '../../crawler/crawler-service'

const logger = createLogger(LogSystem.API, 'crawler/close-browser')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ taskId?: string }>(event) || {}
    const { taskId } = body

    if (!taskId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Task ID is required',
      })
    }

    const task = activeTasks.get(taskId)
    if (!task) {
      throw createError({
        statusCode: 404,
        statusMessage: '任务不存在',
      })
    }

    // 关闭浏览器页面
    const page = activePages.get(taskId)
    if (page) {
      await page.close()
      activePages.delete(taskId)
      logger.info(`用户手动关闭浏览器`, { taskId })
    }

    return {
      success: true,
      message: '浏览器已关闭'
    }
  } catch (error) {
    logger.error('关闭浏览器 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to close browser',
    })
  }
})
