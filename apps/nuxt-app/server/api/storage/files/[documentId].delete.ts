/**
 * DELETE /api/storage/files/[documentId] - 删除已索引的文件
 */
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as StorageService from '../../../storage/index'

const logger = createLogger(LogSystem.API, 'storage/files/delete')

export default defineEventHandler(async (event) => {
  const documentId = getRouterParam(event, 'documentId')

  if (!documentId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Document ID is required',
    })
  }

  try {
    await StorageService.removeIndexedFile(documentId)

    return {
      success: true,
      data: { message: '文件已删除' },
    }
  } catch (error) {
    logger.error('删除文件 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to delete file',
    })
  }
})
