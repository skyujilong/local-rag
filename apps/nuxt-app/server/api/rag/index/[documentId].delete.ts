/**
 * DELETE /api/rag/index/[documentId] - 从索引中删除文档
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as RAGService from '../../../rag/index'

const logger = createLogger(LogSystem.API, 'rag/index/delete')

export default defineEventHandler(async (event) => {
  const documentId = getRouterParam(event, 'documentId')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document ID is required',
    })
  }

  try {
    await RAGService.removeFromIndex(documentId)

    return {
      success: true,
      data: { message: '文档已从索引中删除' },
    }
  } catch (error) {
    logger.error('删除索引 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to remove from index',
    })
  }
})
