/**
 * DELETE /api/crawler/sessions/[domain] - 删除域名会话
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { deleteSession } from '../../../crawler/session-manager'

const logger = createLogger(LogSystem.API, 'crawler/sessions/delete')

export default defineEventHandler(async (event) => {
  const domain = getRouterParam(event, 'domain')

  if (!domain) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Domain is required',
    })
  }

  try {
    await deleteSession(domain)

    return {
      success: true,
      data: { domain },
    }
  } catch (error) {
    logger.error('删除会话 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to delete session',
    })
  }
})
