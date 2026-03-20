/**
 * GET /api/knowledge - 获取文档列表
 */
import { createError, defineEventHandler, getQuery } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as KnowledgeService from '../../services/knowledge-base/document-manager'

const logger = createLogger(LogSystem.API, 'knowledge')

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20
    const type = query.type as string | undefined
    const search = query.search as string | undefined

    const result = await KnowledgeService.listDocuments({
      page,
      pageSize,
      type,
      search,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    logger.error('知识库列表 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to list documents',
    })
  }
})
