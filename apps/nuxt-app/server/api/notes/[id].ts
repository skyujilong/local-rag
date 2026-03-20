/**
 * GET /api/notes/[id] - 获取单个笔记详情
 * PUT /api/notes/[id] - 更新笔记
 * DELETE /api/notes/[id] - 删除笔记
 */
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { getNoteManager } from '../../utils/service-factory'

const logger = createLogger(LogSystem.API, 'notes/[id]')

export default defineEventHandler(async (event) => {
  const method = event.method
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Note ID is required',
    })
  }

  try {
    const noteManager = getNoteManager()

    if (method === 'GET') {
      // 获取笔记详情
      const note = await noteManager.getNote(id)
      if (!note) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Note not found',
        })
      }
      return {
        success: true,
        data: note,
      }
    } else if (method === 'PUT') {
      // 更新笔记
      const body = await readBody(event) || {}
      const note = await noteManager.updateNote(id, body)
      return {
        success: true,
        data: note,
      }
    } else if (method === 'DELETE') {
      // 删除笔记
      await noteManager.deleteNote(id)
      return {
        success: true,
        data: { id },
      }
    }

    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    })
  } catch (error) {
    logger.error('笔记详情 API 错误', error as Error)
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode) || 500
      : 500
    throw createError({
      statusCode,
      statusMessage: error instanceof Error ? error.message : 'Internal Server Error',
    })
  }
})
