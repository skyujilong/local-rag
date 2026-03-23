/**
 * GET /api/crawler/tasks - 获取爬虫任务列表
 * POST /api/crawler/tasks - 创建爬虫任务
 */
import { createError, defineEventHandler, readBody, readRawBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, CRAWLER_CONFIG, updateTaskProgress, broadcastTaskUpdate } from '../../../utils/crawler-tasks'
import { crawl } from '../../../crawler/crawler-service'
import { ResourceManager, taskQueue } from '../../../crawler/concurrency-controller'
import type { CrawlerTask } from '@local-rag/shared/types'

type CreateCrawlerTaskBody = {
  url?: string
  waitForAuth?: boolean
  useXPath?: boolean
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
      // Nitro 的 readBody/readRawBody 在某些情况下有问题
      // 使用多种方式尝试读取 body
      let body: CreateCrawlerTaskBody = {}

      // 方法1: 尝试 readBody
      try {
        const result = await readBody<CreateCrawlerTaskBody>(event)
        if (result && Object.keys(result).length > 0) {
          body = result
          logger.info('使用 readBody 成功', { body })
        }
      } catch (e) {
        logger.debug('readBody 失败', { errorMessage: (e as Error).message })
      }

      // 方法2: 如果 readBody 返回空，尝试 readRawBody
      if (!body.url) {
        try {
          const rawBody = await readRawBody(event, 'utf-8')
          if (rawBody) {
            body = JSON.parse(rawBody) as CreateCrawlerTaskBody
            logger.info('使用 readRawBody 成功', { body })
          }
        } catch (e) {
          logger.debug('readRawBody 失败', { errorMessage: (e as Error).message })
        }
      }

      // 方法3: 如果仍然失败，尝试从 Node.js req 读取
      if (!body.url && event.node?.req) {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of event.node.req) {
            chunks.push(chunk)
          }
          const rawBody = Buffer.concat(chunks).toString('utf-8')
          if (rawBody) {
            body = JSON.parse(rawBody) as CreateCrawlerTaskBody
            logger.info('使用 req 流读取成功', { body })
          }
        } catch (e) {
          logger.error('req 流读取失败', e as Error)
        }
      }

      logger.info('收到爬虫任务请求', { body, hasUrl: !!body.url, urlType: typeof body.url })
      const { url, waitForAuth = false, useXPath = false } = body

      if (!url || typeof url !== 'string') {
        logger.info('URL 验证失败', { url, waitForAuth, useXPath, body })
        throw createError({
          statusCode: 400,
          message: '请提供有效的 URL',
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

      // 计算总步骤数
      const totalSteps = waitForAuth ? CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH : CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH

      // 创建任务
      const task: CrawlerTask = {
        id: taskId,
        url,
        status: 'pending',
        type: 'single',  // 默认为单页模式
        waitForAuth,
        useXPath,
        startedAt: new Date(),
        progress: {
          currentStep: '任务已创建',
          currentStepNumber: 1,
          totalSteps,
          progressPercentage: 0,
        },
        lastUpdatedAt: new Date(),
      }

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

  let totalSteps = CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH
  if (task.waitForAuth) {
    totalSteps = CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH
  }

  try {
    // 步骤 1: 启动任务
    updateTaskProgress(task, {
      currentStep: '启动爬虫任务',
      currentStepNumber: 1,
      totalSteps,
      progressPercentage: Math.round((1 / totalSteps) * 100),
      stepDetails: '正在初始化...',
    })
    task.status = 'running'
    broadcastTaskUpdate(task)

    // 步骤 2: 启动浏览器
    updateTaskProgress(task, {
      currentStep: '启动浏览器',
      currentStepNumber: 2,
      totalSteps,
      progressPercentage: Math.round((2 / totalSteps) * 100),
      stepDetails: '正在初始化浏览器实例...',
    })
    broadcastTaskUpdate(task)

    // 步骤 3: 导航到目标页面
    updateTaskProgress(task, {
      currentStep: '导航到目标页面',
      currentStepNumber: 3,
      totalSteps,
      progressPercentage: Math.round((3 / totalSteps) * 100),
      stepDetails: `正在加载: ${task.url}`,
    })
    broadcastTaskUpdate(task)

    // 执行爬虫任务
    const result = await crawl(task.url, {
      waitForAuth: task.waitForAuth,
      useXPath: task.useXPath,
      onAuthStatusChange: (status) => {
        task.authStatus = status

        if (status === 'detected') {
          updateTaskProgress(task, {
            currentStep: '检测到登录需求',
            currentStepNumber: 4,
            totalSteps,
            progressPercentage: Math.round((4 / totalSteps) * 100),
            stepDetails: '请在浏览器中完成登录操作',
          })
        } else if (status === 'waiting_qrcode') {
          updateTaskProgress(task, {
            currentStep: '等待扫码登录',
            currentStepNumber: 5,
            totalSteps,
            progressPercentage: Math.round((5 / totalSteps) * 100),
            stepDetails: '请使用手机扫描二维码登录',
          })
        } else if (status === 'success') {
          updateTaskProgress(task, {
            currentStep: '登录成功',
            currentStepNumber: 6,
            totalSteps,
            progressPercentage: Math.round((6 / totalSteps) * 100),
            stepDetails: '会话已保存',
          })
        }

        broadcastTaskUpdate(task)
      },
      onProgress: (documentCount) => {
        task.documentCount = documentCount
        task.lastUpdatedAt = new Date()
        broadcastTaskUpdate(task)
      },
      onLoginSuccess: (page) => {
        // 这个回调会在两种情况下被调用：
        // 1. 登录成功后（waitForAuth = true）
        // 2. XPath 模式下页面加载完成（useXPath = true）
        logger.info(`onLoginSuccess 回调被触发`, { taskId, useXPath: task.useXPath, waitForAuth: task.waitForAuth })
        if (task.useXPath) {
          const xpathStepNumber = task.waitForAuth ? CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH : CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH
          updateTaskProgress(task, {
            currentStep: '等待输入 XPath',
            currentStepNumber: xpathStepNumber,
            totalSteps,
            progressPercentage: Math.round((xpathStepNumber / totalSteps) * 100),
            stepDetails: '请在界面中输入 XPath 表达式',
          })
          task.status = 'waiting_xpath'
          logger.info(`任务状态已设置为 waiting_xpath`, { taskId, status: task.status })
          broadcastTaskUpdate(task)
          logger.info(`任务状态已广播`, { taskId, status: task.status })
        }
      },
    })

    if (result.waitingForXPath) {
      logger.info(`任务 ${taskId} 等待用户输入 XPath`)
      return
    }

    // 如果返回了 Markdown，进入确认流程
    if (result.markdown && result.title) {
      const confirmStepNumber = task.waitForAuth ? CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH : CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH
      updateTaskProgress(task, {
        currentStep: '等待用户确认',
        currentStepNumber: confirmStepNumber,
        totalSteps,
        progressPercentage: Math.round((confirmStepNumber / totalSteps) * 100),
        stepDetails: '请查看并确认爬取的内容',
      })
      task.previewMarkdown = result.markdown
      task.status = 'waiting_confirm'
      task.lastUpdatedAt = new Date()
      broadcastTaskUpdate(task)
      logger.info(`任务 ${taskId} 等待用户确认`, { markdownLength: result.markdown.length })
      return
    }

    // 最后步骤: 完成
    updateTaskProgress(task, {
      currentStep: '爬取完成',
      currentStepNumber: totalSteps,
      totalSteps,
      progressPercentage: 100,
      stepDetails: `爬取已完成`,
    })
    task.status = 'completed'
    task.completedAt = new Date()
    task.lastUpdatedAt = new Date()

    broadcastTaskUpdate(task)
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
