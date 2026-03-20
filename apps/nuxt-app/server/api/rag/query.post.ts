/**
 * POST /api/rag/query - RAG 查询
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as RAGService from '../../rag/index'

const logger = createLogger(LogSystem.API, 'rag/query')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) || {}
    const { query, topK = 5, threshold, searchType } = body

    if (!query || typeof query !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: '请提供查询内容',
      })
    }

    const result = await RAGService.query({
      query,
      topK,
      threshold,
      searchType,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    logger.error('RAG 查询 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to query',
    })
  }
})
