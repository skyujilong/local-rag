/**
 * POST /api/crawler/confirm - 确认内容并保存为草稿
 */
import { createError, defineEventHandler, readBody, readRawBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, updateTaskProgress, broadcastTaskUpdate, cleanupTask } from '../../utils/crawler-tasks'
import { saveAsDraft, clearXPathTimeout } from '../../crawler/crawler-service'
import { activePages } from '../../crawler/crawler-service'

const logger = createLogger(LogSystem.API, 'crawler/confirm')

export default defineEventHandler(async (event) => {
  try {
    // 读取 request body
    //
    // 已知问题：Nitro HMR (Hot Module Replacement) 环境下，h3 的 readBody() 和 readRawBody()
    // 可能返回空对象或 undefined，导致无法正确解析 JSON body。
    //
    // 经过测试验证：
    // - readBody(): 在 HMR 后总是返回空对象 {}
    // - readRawBody(): 在 HMR 后总是返回空字符串 ""
    // - Node.js req 流: 是唯一可靠的方式
    //
    // 相关日志证据 (2026-03-26):
    // - crawler/tasks: 所有请求都使用 req 流读取成功
    // - crawler/confirm: 所有请求都使用 req 流读取成功
    // - readBody/readRawBody 从未成功过
    //
    // TODO: 调查 Nitro/h3 根本原因，可能是 HMR 破坏了内部 body 缓存状态
    let body: { taskId?: string; confirmed?: boolean } = {}

    // 直接使用 Node.js req 流读取（唯一可靠的方式）
    if (event.node?.req) {
      try {
        const chunks: Buffer[] = []
        for await (const chunk of event.node.req) {
          chunks.push(chunk)
        }
        const raw = Buffer.concat(chunks).toString('utf-8')
        if (raw) {
          body = JSON.parse(raw)
        }
      } catch (e) {
        logger.error('req 流读取失败', { error: (e as Error).message })
        throw createError({
          statusCode: 400,
          statusMessage: '请求格式错误',
        })
      }
    }

    const { taskId, confirmed } = body

    logger.info('收到确认请求', { taskId, confirmed, activeTasksCount: activeTasks.size })

    if (!taskId) {
      throw createError({
        statusCode: 400,
        statusMessage: '请提供任务 ID',
      })
    }

    const task = activeTasks.get(taskId)

    if (!task) {
      logger.error('任务不存在', {
        taskId,
        activeTasksIds: Array.from(activeTasks.keys()),
        activeTasksStatuses: Array.from(activeTasks.entries()).map(([id, t]) => ({ id, status: t.status }))
      })
      throw createError({
        statusCode: 400,
        statusMessage: '任务不存在',
      })
    }

    if (task.status !== 'waiting_confirm') {
      logger.error('任务状态不正确', {
        taskId,
        currentStatus: task.status,
        expectedStatus: 'waiting_confirm',
        taskUrl: task.url,
        taskCreatedAt: task.createdAt,
        taskLastUpdatedAt: task.lastUpdatedAt,
        allActiveTasks: Array.from(activeTasks.entries()).map(([id, t]) => ({
          id,
          status: t.status,
          url: t.url,
          createdAt: t.createdAt,
        }))
      })
      throw createError({
        statusCode: 409, // Conflict - 状态冲突
        statusMessage: '任务状态已变更，请刷新页面查看最新状态',
      })
    }

    if (!confirmed) {
      // 用户拒绝内容：标记任务为已取消
      task.status = 'failed'
      task.error = '用户取消确认'
      task.completedAt = new Date()
      task.lastUpdatedAt = new Date()
      broadcastTaskUpdate(task)
      return {
        success: true,
        data: task,
        message: '已取消，您可以重新创建爬取任务'
      }
    }

    // 用户确认，保存为草稿
    const previewMarkdown = task.previewMarkdown ?? ''
    const draftId = await saveAsDraft(
      previewMarkdown.split('\n')[0]?.replace('# ', '').replace('[草稿] ', '') || 'Untitled',
      previewMarkdown,
      task.url
    )

    // 如果使用了 XPath，清除超时定时器（兼容旧逻辑）
    if (task.useXPath) {
      clearXPathTimeout(taskId)
    }

    // 标记任务完成
    task.status = 'completed'
    task.documentCount = 1
    task.completedAt = new Date()
    task.lastUpdatedAt = new Date()

    broadcastTaskUpdate(task)

    // 清理任务资源（延迟清理，确保消息已发送）
    setTimeout(() => cleanupTask(taskId), 1000)

    return {
      success: true,
      data: { ...task, draftId },
      message: '草稿已保存'
    }
  } catch (error) {
    logger.error('确认 API 错误', error as Error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to confirm',
    })
  }
})
