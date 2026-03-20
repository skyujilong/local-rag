/**
 * POST /api/rag/index - 添加文档到索引
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as RAGService from '../../rag/index'

const logger = createLogger(LogSystem.API, 'rag/index')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) || {}
    const { documentId } = body

    if (!documentId) {
      throw createError({
        statusCode: 400,
        statusMessage: '请提供文档 ID',
      })
    }

    await RAGService.indexDocument(documentId)

    return {
      success: true,
      data: { message: '文档已添加到索引' },
    }
  } catch (error) {
    logger.error('添加索引 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to index document',
    })
  }
})
