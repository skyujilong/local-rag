/**
 * PUT /api/storage/ignore - 更新忽略规则
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import * as StorageService from '../../storage/index'

const logger = createLogger(LogSystem.API, 'storage/ignore')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) || {}
    const { custom } = body

    if (!Array.isArray(custom)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'custom 必须是数组',
      })
    }

    const rules = await StorageService.updateIgnoreRules({ custom })

    return {
      success: true,
      data: rules,
    }
  } catch (error) {
    logger.error('更新忽略规则 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to update ignore rules',
    })
  }
})
