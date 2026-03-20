/**
 * GET /api/storage/ignore - 获取忽略规则
 */
import { createError, defineEventHandler } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as StorageService from '../../storage/index'

const logger = createLogger(LogSystem.API, 'storage/ignore')

export default defineEventHandler(async (event) => {
  try {
    const rules = await StorageService.getIgnoreRules()

    return {
      success: true,
      data: rules,
    }
  } catch (error) {
    logger.error('获取忽略规则 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to get ignore rules',
    })
  }
})
