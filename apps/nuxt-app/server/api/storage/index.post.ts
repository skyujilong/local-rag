/**
 * POST /api/storage/index - 索引文件或目录
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as StorageService from '../../storage/index'

const logger = createLogger(LogSystem.API, 'storage/index')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) || {}
    const { path: filePath, recursive = true } = body

    if (!filePath) {
      throw createError({
        statusCode: 400,
        statusMessage: '请提供文件路径',
      })
    }

    const result = await StorageService.indexPath(filePath, recursive)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    logger.error('索引文件 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to index file',
    })
  }
})
