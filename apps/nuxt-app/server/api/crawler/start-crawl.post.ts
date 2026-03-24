/**
 * POST /api/crawler/start-crawl - 用户确认后开始爬取
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, CRAWLER_CONFIG, updateTaskProgress, broadcastTaskUpdate } from '../../utils/crawler-tasks'
import { continueCrawl, saveAsDraft, activePages } from '../../crawler/crawler-service'
import type { CrawlerTask } from '@local-rag/shared/types'

type StartCrawlBody = {
  taskId: string
}

const logger = createLogger(LogSystem.API, 'crawler/start-crawl')

export default defineEventHandler(async (event) => {
  try {
    // 使用多种方法尝试读取 body（参考 tasks/index.ts 的做法）
    let body: StartCrawlBody | undefined

    // 方法1: 尝试 readBody
    try {
      const result = await readBody<StartCrawlBody>(event)
      if (result && Object.keys(result).length > 0) {
        body = result
      }
    } catch (e) {
      logger.debug('readBody 失败', { errorMessage: (e as Error).message })
    }

    // 方法2: 如果 readBody 返回空，尝试 readRawBody
    if (!body || !body.taskId) {
      try {
        const rawBody = await readRawBody(event, 'utf-8')
        if (rawBody) {
          body = JSON.parse(rawBody) as StartCrawlBody
        }
      } catch (e) {
        logger.debug('readRawBody 失败', { errorMessage: (e as Error).message })
      }
    }

    // 方法3: 如果仍然为空，尝试从 Node.js req 读取
    if (!body || !body.taskId) {
      if (event.node?.req) {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of event.node.req) {
            chunks.push(chunk)
          }
          const rawBody = Buffer.concat(chunks).toString('utf-8')
          if (rawBody) {
            body = JSON.parse(rawBody) as StartCrawlBody
          }
        } catch (e) {
          logger.error('req 流读取失败', e as Error)
        }
      }
    }

    if (!body || !body.taskId) {
      throw createError({
        statusCode: 400,
        message: '请提供任务 ID',
      })
    }

    const { taskId } = body

    const task = activeTasks.get(taskId)
    if (!task) {
      throw createError({
        statusCode: 404,
        message: '任务不存在',
      })
    }

    if (task.status !== 'browser_ready') {
      throw createError({
        statusCode: 400,
        message: '任务状态不正确',
      })
    }

    // 更新任务状态
    updateTaskProgress(task, {
      currentStep: '正在爬取内容',
      currentStepNumber: 2,
      totalSteps: 3,
      progressPercentage: 50,
      stepDetails: '正在提取页面内容...',
    })
    task.status = 'running'
    broadcastTaskUpdate(task)

    // 异步执行爬取
    executeCrawl(taskId).catch((error) => {
      logger.error(`爬取任务 ${taskId} 失败`, error as Error)
    })

    return {
      success: true,
      data: task,
    }
  } catch (error) {
    logger.error('开始爬取 API 错误', error as Error)
    throw error
  }
})

/**
 * 执行爬取
 */
async function executeCrawl(taskId: string) {
  const task = activeTasks.get(taskId)
  if (!task) return

  try {
    // 从 metadata 获取 page
    const pageId = task.metadata?.pageId
    if (!pageId) {
      throw new Error('页面 ID 不存在')
    }

    // 获取页面引用（从全局存储）
    const page = activePages.get(taskId)
    if (!page) {
      throw new Error('浏览器页面未找到')
    }

    // 继续爬取
    const { markdown, title } = await continueCrawl(page, task.url, task.contentXPath)

    // 更新任务状态
    updateTaskProgress(task, {
      currentStep: '等待用户确认',
      currentStepNumber: 3,
      totalSteps: 3,
      progressPercentage: 100,
      stepDetails: '请查看并确认爬取的内容',
    })
    task.previewMarkdown = markdown
    task.status = 'waiting_confirm'
    task.lastUpdatedAt = new Date()
    broadcastTaskUpdate(task)

    logger.info(`任务 ${taskId} 爬取完成，等待用户确认`, {
      markdownLength: markdown.length,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`任务 ${taskId} 爬取失败`, error as Error)

    updateTaskProgress(task, {
      currentStep: '爬取失败',
      currentStepNumber: 0,
      totalSteps: 3,
      progressPercentage: 0,
      stepDetails: errorMessage,
    })
    task.status = 'failed'
    task.error = errorMessage
    task.lastUpdatedAt = new Date()
    broadcastTaskUpdate(task)
  }
}
