/**
 * POST /api/crawler/confirm - 确认内容并保存为草稿
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, updateTaskProgress, broadcastTaskUpdate, cleanupTask } from '../../utils/crawler-tasks'
import { saveAsDraft, clearXPathTimeout } from '../../crawler/crawler-service'
import { activePages } from '../../crawler/crawler-service'

const logger = createLogger(LogSystem.API, 'crawler/confirm')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) || {}
    const { taskId, confirmed } = body

    const task = activeTasks.get(taskId)
    if (!task || task.status !== 'waiting_confirm') {
      throw createError({
        statusCode: 400,
        statusMessage: '任务不在等待确认状态',
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
