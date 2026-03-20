/**
 * DELETE /api/knowledge/[id] - 删除文档
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as KnowledgeService from '../../services/knowledge-base/document-manager'

const logger = createLogger(LogSystem.API, 'knowledge/[id]/delete')

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document ID is required',
    })
  }

  try {
    const deleted = await KnowledgeService.deleteDocument(id)

    if (!deleted) {
      throw createError({
        statusCode: 404,
        statusMessage: '文档不存在',
      })
    }

    return {
      success: true,
      data: { id },
    }
  } catch (error) {
    logger.error('删除文档 API 错误', error as Error, { documentId: id })
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode) || 500
      : 500
    throw createError({
      statusCode,
      statusMessage: error instanceof Error ? error.message : 'Failed to delete document',
    })
  }
})
