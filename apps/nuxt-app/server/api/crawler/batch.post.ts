/**
 * POST /api/crawler/batch - 批量爬取
 */
import { createError, defineEventHandler, readBody, getCookie } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, updateTaskProgress, broadcastTaskUpdate, cleanupTask } from '../../utils/crawler-tasks'
import { extractLinksByXPath, crawlSinglePage, mergeMarkdown, CrawlErrorType } from '../../crawler/batch-utils.js'
import { saveAsDraft } from '../../crawler/crawler-service.js'
import { activePages } from '../../crawler/crawler-service.js'
import { validateXPath } from '../../utils/xpath-validator.js'
import { validateCrawlUrl } from '../../utils/url-validator.js'
import { CRAWLER_LIMITS } from '../../config/crawler-limits.js'
import type { BatchCrawlRequest } from '@local-rag/shared/types'

const logger = createLogger(LogSystem.API, 'crawler/batch')

// 简单的内存速率限制器（基于 IP）
const rateLimiter = new Map<string, { count: number; resetTime: number }>()

/**
 * 检查速率限制
 */
function checkRateLimit(identifier: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now()
  const record = rateLimiter.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimiter.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}

/**
 * 获取客户端 IP
 */
function getClientIP(event: any): string {
  // 尝试从各种头部获取真实 IP
  const headers = event.node.req.headers
  return headers['x-forwarded-for']?.split(',')[0]?.trim()
    || headers['x-real-ip']
    || headers['cf-connecting-ip']
    || event.node.req.socket?.remoteAddress
    || 'unknown'
}

export default defineEventHandler(async (event) => {
  try {
    // 应用速率限制（基于客户端 IP）
    const clientIp = getClientIP(event)
    if (!checkRateLimit(clientIp, 10, 60000)) {
      throw createError({
        statusCode: 429,
        statusMessage: '请求过于频繁，请稍后再试',
      })
    }

    const body = await readBody<BatchCrawlRequest>(event)
    const { taskId, linksXPath, contentXPath, maxLinks = 100 } = body

    if (!taskId || !linksXPath) {
      throw createError({
        statusCode: 400,
        message: '请提供任务 ID 和链接 XPath',
      })
    }

    // 验证 XPath
    const xpathValidation = validateXPath(linksXPath)
    if (!xpathValidation.valid) {
      throw createError({
        statusCode: 400,
        message: xpathValidation.error || 'XPath 格式不正确',
      })
    }

    // 验证 contentXPath（如果提供）
    if (contentXPath) {
      const contentXpathValidation = validateXPath(contentXPath)
      if (!contentXpathValidation.valid) {
        throw createError({
          statusCode: 400,
          message: contentXpathValidation.error || '内容 XPath 格式不正确',
        })
      }
    }

    // 验证 maxLinks
    if (maxLinks < 1 || maxLinks > 500) {
      throw createError({
        statusCode: 400,
        message: '最大链接数必须在 1 到 500 之间',
      })
    }

    const task = activeTasks.get(taskId)
    if (!task) {
      throw createError({
        statusCode: 404,
        message: '任务不存在',
      })
    }

    // 验证 contentXPath（如果提供）
    if (contentXPath) {
      const contentXpathValidation = validateXPath(contentXPath)
      if (!contentXpathValidation.valid) {
        throw createError({
          statusCode: 400,
          message: contentXpathValidation.error || '内容 XPath 格式不正确',
        })
      }
    }

    // 更新任务为批量模式
    task.type = 'batch'
    task.linksXPath = linksXPath
    task.contentXPath = contentXPath
    task.status = 'running'
    task.batchResults = []
    task.totalLinks = 0
    task.completedLinks = 0

    updateTaskProgress(task, {
      currentStep: '提取链接列表',
      currentStepNumber: 1,
      totalSteps: 4,
      progressPercentage: 10,
      stepDetails: `使用 XPath: ${linksXPath}`,
    })

    broadcastTaskUpdate(task)

    // 异步执行批量爬取
    executeBatchCrawl(taskId, linksXPath, contentXPath, maxLinks).catch((error) => {
      logger.error(`批量爬取任务 ${taskId} 失败`, error as Error)
    })

    return {
      success: true,
      data: task,
    }
  } catch (error) {
    logger.error('批量爬取 API 错误', error as Error)
    throw error
  }
})

/**
 * 执行批量爬取
 */
async function executeBatchCrawl(
  taskId: string,
  linksXPath: string,
  contentXPath: string | undefined,
  maxLinks: number
) {
  const task = activeTasks.get(taskId)
  if (!task) {
    logger.warn('任务不存在，无法执行批量爬取', { taskId })
    return
  }

  // 节流广播状态
  let lastBroadcastTime = 0

  function throttledBroadcast() {
    const currentTask = activeTasks.get(taskId)
    if (!currentTask) {
      logger.warn('任务不存在，跳过广播', { taskId })
      return
    }

    const now = Date.now()
    if (now - lastBroadcastTime > CRAWLER_LIMITS.BROADCAST_THROTTLE) {
      broadcastTaskUpdate(currentTask)
      lastBroadcastTime = now
    }
  }

  try {
    logger.info(`开始批量爬取任务 ${taskId}`, {
      linksXPath,
      contentXPath,
      maxLinks,
    })

    // 获取页面引用
    const page = activePages.get(taskId)
    if (!page) {
      throw new Error('浏览器页面未找到')
    }

    // 步骤 1: 提取链接列表
    updateTaskProgress(task, {
      currentStep: '提取链接列表',
      currentStepNumber: 1,
      totalSteps: 4,
      progressPercentage: 10,
      stepDetails: `正在使用 XPath 提取链接...`,
    })
    broadcastTaskUpdate(task)

    const links = await extractLinksByXPath(page, linksXPath, maxLinks, task.url)
    task.totalLinks = links.length
    task.batchResults = links.map(url => ({
      url,
      status: 'pending' as const,
    }))
    broadcastTaskUpdate(task)

    logger.info(`提取到 ${links.length} 个链接`, { taskId })

    if (links.length === 0) {
      throw new Error('未提取到任何链接')
    }

    // 步骤 2: 批量爬取（并发数由配置控制）
    updateTaskProgress(task, {
      currentStep: '批量爬取中',
      currentStepNumber: 2,
      totalSteps: 4,
      progressPercentage: 20,
      stepDetails: `正在爬取 ${links.length} 个页面...`,
    })
    broadcastTaskUpdate(task)

    const batchSize = CRAWLER_LIMITS.BATCH_CONCURRENCY
    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize)

      await Promise.all(batch.map(async (url, idx) => {
        const resultIdx = i + idx
        const resultItem = task.batchResults![resultIdx]

        if (!resultItem) {
          logger.warn(`批量结果项不存在`, { resultIdx })
          return
        }

        try {
          resultItem.status = 'crawling'
          task.completedLinks = resultIdx
          throttledBroadcast()

          const { title, markdown } = await crawlSinglePage(page, url, contentXPath)

          resultItem.title = title
          resultItem.markdown = markdown
          resultItem.status = 'success'
          resultItem.crawledAt = new Date()

          logger.info(`页面爬取成功`, { url, title, resultIdx })
        } catch (error: unknown) {
          // 区分错误类型并记录
          const errorType = (error as any)?.errorType || CrawlErrorType.UNKNOWN
          const errorMsg: string = error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error))

          resultItem.status = 'failed'
          resultItem.error = errorMsg
          (resultItem as any).errorType = errorType

          logger.warn(`页面爬取失败，跳过`, {
            url,
            errorType,
            errorMessage: errorMsg,
            willRetry: false,
          })
        }

        task.completedLinks = resultIdx + 1
        const progressPercentage = Math.round((task.completedLinks / task.totalLinks!) * 60) + 20
        updateTaskProgress(task, {
          progressPercentage,
          stepDetails: `已完成 ${task.completedLinks} / ${task.totalLinks}`,
        })
        throttledBroadcast()
      }))
    }

    // 步骤 3: 保存草稿
    updateTaskProgress(task, {
      currentStep: '保存草稿',
      currentStepNumber: 3,
      totalSteps: 4,
      progressPercentage: 90,
      stepDetails: '正在保存爬取结果...',
    })
    broadcastTaskUpdate(task)

    const successResults = task.batchResults.filter(r => r.status === 'success')

    if (successResults.length === 0) {
      throw new Error('没有成功爬取到任何内容')
    }

    // 每个页面单独保存
    for (const result of successResults) {
      try {
        const draftId = await saveAsDraft(result.title!, result.markdown!, result.url)
        logger.info(`草稿已保存`, { draftId, title: result.title })
      } catch (error) {
        logger.error(`保存草稿失败`, error as Error, { title: result.title })
      }
    }

    // 步骤 4: 完成
    updateTaskProgress(task, {
      currentStep: '批量爬取完成',
      currentStepNumber: 4,
      totalSteps: 4,
      progressPercentage: 100,
      stepDetails: `成功爬取 ${successResults.length} 个页面，已保存为草稿`,
    })
    task.status = 'completed'
    task.completedAt = new Date()
    task.lastUpdatedAt = new Date()

    broadcastTaskUpdate(task)
    logger.info(`批量爬取任务 ${taskId} 完成`, {
      total: links.length,
      success: successResults.length,
      failed: links.length - successResults.length,
    })

    // 清理任务资源（延迟清理，确保消息已发送）
    setTimeout(() => cleanupTask(taskId), 1000)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : `${error}`
    logger.error(`批量爬取任务 ${taskId} 执行失败`, error as Error)

    updateTaskProgress(task, {
      currentStep: '批量爬取失败',
      currentStepNumber: 0,
      totalSteps: 4,
      progressPercentage: 0,
      stepDetails: errorMessage,
    })
    task.status = 'failed'
    task.error = errorMessage
    task.lastUpdatedAt = new Date()
    broadcastTaskUpdate(task)

    // 清理任务资源（延迟清理）
    setTimeout(() => cleanupTask(taskId), 1000)
  }
}
