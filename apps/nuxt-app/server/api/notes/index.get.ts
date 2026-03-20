/**
 * GET /api/notes - 获取所有笔记列表
 * POST /api/notes - 创建新笔记
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { getNoteManager } from '../../utils/service-factory'

const logger = createLogger(LogSystem.API, 'notes')

export default defineEventHandler(async (event) => {
  const method = event.method

  try {
    const noteManager = getNoteManager()

    if (method === 'GET') {
      // 获取所有笔记
      const notes = await noteManager.getAllNotes()
      return {
        success: true,
        data: notes,
      }
    } else if (method === 'POST') {
      // 创建新笔记
      const body = await readBody<{
        title?: string
        content?: string
        tags?: string[]
      }>(event) || {}

      logger.info('收到创建笔记请求', { body, hasTitle: !!body.title })

      // 验证必填字段
      if (!body.title || typeof body.title !== 'string') {
        logger.info('标题验证失败', { body, bodyType: typeof body })
        throw createError({
          statusCode: 400,
          statusMessage: '标题是必填字段',
        })
      }

      if (!body.content || typeof body.content !== 'string') {
        throw createError({
          statusCode: 400,
          statusMessage: '内容是必填字段',
        })
      }

      const note = await noteManager.createNote({
        title: body.title,
        content: body.content,
        tags: Array.isArray(body.tags) ? body.tags : [],
      })
      return {
        success: true,
        data: note,
      }
    }

    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    })
  } catch (error) {
    logger.error('笔记 API 错误', error as Error)
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode) || 500
      : 500
    throw createError({
      statusCode,
      statusMessage: error instanceof Error ? error.message : 'Internal Server Error',
    })
  }
})
