/**
 * POST /api/notes - 创建新笔记
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { getNoteManager } from '../../utils/service-factory'

const logger = createLogger(LogSystem.API, 'notes/create')

type CreateNoteBody = {
  title?: string
  content?: string
  tags?: string[]
}

export default defineEventHandler(async (event) => {
  try {
    const noteManager = getNoteManager()

    // 读取请求体 - 使用多种方法尝试
    let body: CreateNoteBody = {}

    // 方法 1: 尝试 readBody
    try {
      body = await readBody<CreateNoteBody>(event) || {}
      logger.info('readBody 结果', { body, isEmpty: Object.keys(body).length === 0 })
    } catch (e) {
      logger.warn('readBody 失败')
    }

    // 如果 readBody 返回空对象，尝试从 context 读取
    if (Object.keys(body).length === 0 && event.context?.body) {
      body = event.context.body as CreateNoteBody
      logger.info('从 context.body 读取', { body })
    }

    // 最后尝试直接解析
    if (Object.keys(body).length === 0 && event.node?.req) {
      const chunks = []
      for await (const chunk of event.node.req) {
        chunks.push(chunk)
      }
      const raw = Buffer.concat(chunks).toString()
      logger.info('直接读取请求体', { raw, length: raw.length })
      if (raw) {
        try {
          body = JSON.parse(raw) as CreateNoteBody
        } catch {
          logger.error('JSON 解析失败')
        }
      }
    }

    logger.info('收到创建笔记请求', { body, hasTitle: !!body.title, title: body.title })

    // 验证必填字段
    if (!body.title || typeof body.title !== 'string') {
      logger.info('标题验证失败', { body, bodyType: typeof body })
      throw createError({
        statusCode: 400,
        message: '标题是必填字段',
      })
    }

    if (!body.content || typeof body.content !== 'string') {
      throw createError({
        statusCode: 400,
        message: '内容是必填字段',
      })
    }

    const note = await noteManager.createNote({
      title: body.title,
      content: body.content,
      tags: Array.isArray(body.tags) ? body.tags : [],
    })

    return {
      success: true,
      data: note,
    }
  } catch (error) {
    logger.error('创建笔记 API 错误', error as Error)
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode) || 500
      : 500
    throw createError({
      statusCode,
      message: error instanceof Error ? error.message : 'Failed to create note',
    })
  }
})
