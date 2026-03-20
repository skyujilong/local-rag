/**
 * POST /api/notes/[id]/images - 上传笔记图片
 */
import { createError, defineEventHandler, getRouterParam, readMultipartFormData } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { getNoteManager } from '../../../utils/service-factory'

const logger = createLogger(LogSystem.API, 'notes/images')

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Note ID is required',
    })
  }

  try {
    // 解析 multipart/form-data
    const formData = await readMultipartFormData(event)

    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No file uploaded',
      })
    }

    // 获取第一个文件
    const file = formData[0]
    if (!file || !file.name || !file.data) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid file data',
      })
    }

    // 上传图片
    const imageUrl = await getNoteManager().uploadNoteImage(id, file.name, file.data)

    return {
      success: true,
      data: {
        url: imageUrl,
      },
    }
  } catch (error) {
    logger.error('上传图片 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to upload image',
    })
  }
})
