/**
 * GET /api/storage/files - 获取已索引的文件列表
 */
import { createError, defineEventHandler, getQuery } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as StorageService from '../../storage/index'

const logger = createLogger(LogSystem.API, 'storage/files')

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const path = query.path as string | undefined

    const files = await StorageService.listIndexedFiles(path)

    return {
      success: true,
      data: files,
    }
  } catch (error) {
    logger.error('获取文件列表 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to list files',
    })
  }
})
