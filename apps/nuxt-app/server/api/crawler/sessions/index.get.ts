/**
 * GET /api/crawler/sessions - 获取所有保存的会话
 */
import { createError, defineEventHandler } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { listSessions } from '../../../crawler/session-manager'

const logger = createLogger(LogSystem.API, 'crawler/sessions')

export default defineEventHandler(async (event) => {
  try {
    const sessions = await listSessions()

    return {
      success: true,
      data: sessions,
    }
  } catch (error) {
    logger.error('获取会话列表 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to list sessions',
    })
  }
})
