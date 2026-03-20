/**
 * POST /api/knowledge/search - 搜索文档
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as KnowledgeService from '../../services/knowledge-base/document-manager'

const logger = createLogger(LogSystem.API, 'knowledge/search')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) || {}
    const { keywords } = body

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: '请提供搜索关键词',
      })
    }

    const documents = await KnowledgeService.searchDocuments(keywords)

    return {
      success: true,
      data: documents,
    }
  } catch (error) {
    logger.error('搜索文档 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to search documents',
    })
  }
})
