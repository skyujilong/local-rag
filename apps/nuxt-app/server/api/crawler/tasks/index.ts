/**
 * GET /api/crawler/tasks - 获取爬虫任务列表
 * POST /api/crawler/tasks - 创建爬虫任务
 */
import { createError, defineEventHandler, readBody, readRawBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, CRAWLER_CONFIG, updateTaskProgress, broadcastTaskUpdate, cleanupTask } from '../../../utils/crawler-tasks'
import { crawl, activePages } from '../../../crawler/crawler-service'
import { ResourceManager, taskQueue } from '../../../crawler/concurrency-controller'
import type { CrawlerTask } from '@local-rag/shared/types'

type CreateCrawlerTaskBody = {
  url?: string
  taskType?: 'single' | 'batch'
  contentXPath?: string
  linksXPath?: string
  maxLinks?: number
}

const logger = createLogger(LogSystem.API, 'crawler/tasks')

export default defineEventHandler(async (event) => {
  const method = event.method

  try {
    if (method === 'GET') {
      // 获取所有任务
      const tasks = Array.from(activeTasks.values())
      return {
        success: true,
        data: tasks,
      }
    } else if (method === 'POST') {
      // 创建新任务
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
      // - 所有请求都使用 req 流读取成功
      // - readBody/readRawBody 从未成功过
      //
      // TODO: 调查 Nitro/h3 根本原因，可能是 HMR 破坏了内部 body 缓存状态
      let body: CreateCrawlerTaskBody = {}

      // 直接使用 Node.js req 流读取（唯一可靠的方式）
      if (event.node?.req) {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of event.node.req) {
            chunks.push(chunk)
          }
          const rawBody = Buffer.concat(chunks).toString('utf-8')
          if (rawBody) {
            body = JSON.parse(rawBody) as CreateCrawlerTaskBody
          }
        } catch (e) {
          logger.error('req 流读取失败', e as Error)
          throw createError({
            statusCode: 400,
            statusMessage: '请求格式错误',
          })
        }
      }

      logger.info('收到爬虫任务请求', { body, hasUrl: !!body.url, urlType: typeof body.url })
      const {
        url,
        taskType = 'single',
        contentXPath,
        linksXPath,
        maxLinks = 100
      } = body

      if (!url || typeof url !== 'string') {
        logger.info('URL 验证失败', { url, taskType, body })
        throw createError({
          statusCode: 400,
          message: '请提供有效的 URL',
        })
      }

      // 批量模式必须提供 linksXPath
      if (taskType === 'batch' && !linksXPath) {
        throw createError({
          statusCode: 400,
          message: '批量模式必须提供链接列表 XPath',
        })
      }

      // 检查队列是否已满
      const queueStatus = ResourceManager.getInstance().getQueueStatus()
      if (queueStatus.queueSize >= CRAWLER_CONFIG.MAX_QUEUE_SIZE) {
        throw createError({
          statusCode: 429,
          statusMessage: '任务队列已满，请稍后再试',
        })
      }

      // 生成任务 ID
      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      // 创建任务
      const task: CrawlerTask = {
        id: taskId,
        url,
        status: 'pending',
        type: taskType,
        waitForAuth: false,  // 已废弃，保留以兼容类型
        useXPath: false,     // 已废弃，保留以兼容类型
        contentXPath,
        linksXPath: taskType === 'batch' ? linksXPath : undefined,
        startedAt: new Date(),
        progress: {
          currentStep: '任务已创建',
          currentStepNumber: 1,
          totalSteps: 3,
          progressPercentage: 0,
        },
        lastUpdatedAt: new Date(),
        metadata: {
          maxLinks,
        },
      }

      // 移除自动清理逻辑 - 允许多个 waiting_confirm 任务共存
      // 前端会显示最新的等待确认任务
      activeTasks.set(taskId, task)

      // 广播任务创建
      broadcastTaskUpdate(task)

      // 将任务添加到队列
      const queuePosition = taskQueue.size
      taskQueue.add(() => runCrawlerTask(taskId)).catch((error) => {
        logger.error(`任务 ${taskId} 执行失败`, error as Error)
      })

      return {
        success: true,
        data: task,
        queueStatus: {
          position: queuePosition,
          pending: taskQueue.pending,
          size: taskQueue.size,
        },
      }
    }

    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    })
  } catch (error) {
    logger.error('爬虫任务 API 错误', error as Error)
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode) || 500
      : 500
    throw createError({
      statusCode,
      statusMessage: error instanceof Error ? error.message : 'Internal Server Error',
    })
  }
})

/**
 * 执行爬虫任务
 */
async function runCrawlerTask(taskId: string) {
  const task = activeTasks.get(taskId)
  if (!task) return

  const totalSteps = 3

  try {
    // 步骤 1: 启动浏览器
    updateTaskProgress(task, {
      currentStep: '启动浏览器',
      currentStepNumber: 1,
      totalSteps,
      progressPercentage: Math.round((1 / totalSteps) * 100),
      stepDetails: '正在初始化浏览器实例...',
    })
    task.status = 'running'
    broadcastTaskUpdate(task)

    // 步骤 2: 导航到目标页面
    updateTaskProgress(task, {
      currentStep: '导航到目标页面',
      currentStepNumber: 2,
      totalSteps,
      progressPercentage: Math.round((2 / totalSteps) * 100),
      stepDetails: `正在加载: ${task.url}`,
    })
    broadcastTaskUpdate(task)

    // 执行爬虫任务（只打开浏览器，不自动爬取）
    const result = await crawl(task.url, {
      taskId,
      contentXPath: task.contentXPath,
      onProgress: (documentCount) => {
        task.documentCount = documentCount
        task.lastUpdatedAt = new Date()
        broadcastTaskUpdate(task)
      },
      onPageEvent: (event) => {
        // 更新任务的页面事件信息
        task.metadata = task.metadata || {}
        task.metadata.lastPageEventType = event.type
        task.metadata.lastPageUrl = event.url
        task.metadata.lastPageEventTimestamp = event.timestamp
        task.lastUpdatedAt = new Date()

        logger.info('Playwright 页面事件', {
          taskId,
          eventType: event.type,
          url: event.url,
        })

        // 广播任务更新，通知前端
        broadcastTaskUpdate(task)
      },
      onBrowserReady: (page) => {
        logger.info(`[DEBUG] onBrowserReady 回调被触发`, { taskId, pageUrl: page.url() });

        // 保存页面引用
        activePages.set(taskId, page)
        logger.info(`[DEBUG] 页面引用已保存`, { taskId, activePagesSize: activePages.size });

        // 保存 pageId 到 metadata
        task.metadata = task.metadata || {}
        task.metadata.pageId = taskId

        // 更新任务状态为 browser_ready
        updateTaskProgress(task, {
          currentStep: '浏览器已就绪',
          currentStepNumber: 3,
          totalSteps,
          progressPercentage: 100,
          stepDetails: '请手动登录（如需要），然后点击"确认开始爬取"',
        })

        const oldStatus = task.status;
        task.status = 'browser_ready'
        task.lastUpdatedAt = new Date()

        logger.info(`[DEBUG] 任务状态已更新`, {
          taskId,
          oldStatus,
          newStatus: task.status,
        });

        // 重新获取任务确认状态
        const updatedTask = activeTasks.get(taskId);
        logger.info(`[DEBUG] 从 activeTasks 重新获取任务`, {
          taskId,
          status: updatedTask?.status,
        });

        broadcastTaskUpdate(task)
        logger.info(`[DEBUG] 任务更新已广播`, { taskId, status: task.status });
      },
    })

    if (result.browserReady) {
      logger.info(`任务 ${taskId} 等待用户确认开始爬取`)
      return
    }

    // 如果直接返回了 Markdown（不需要用户确认的情况），进入确认流程
    if (result.markdown && result.title) {
      updateTaskProgress(task, {
        currentStep: '等待用户确认',
        currentStepNumber: 3,
        totalSteps,
        progressPercentage: 100,
        stepDetails: '请查看并确认爬取的内容',
      })
      task.previewMarkdown = result.markdown
      task.status = 'waiting_confirm'
      task.lastUpdatedAt = new Date()
      broadcastTaskUpdate(task)
      logger.info(`任务 ${taskId} 等待用户确认`, { markdownLength: result.markdown.length })
      return
    }
  } catch (error) {
    updateTaskProgress(task, {
      currentStep: '任务失败',
      currentStepNumber: 0,
      totalSteps,
      progressPercentage: 0,
      stepDetails: error instanceof Error ? error.message : String(error),
    })
    task.status = 'failed'
    task.error = error instanceof Error ? error.message : String(error)
    task.completedAt = new Date()
    task.lastUpdatedAt = new Date()

    broadcastTaskUpdate(task)
  }
}
