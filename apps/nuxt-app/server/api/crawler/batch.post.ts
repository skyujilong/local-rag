/**
 * POST /api/crawler/batch - 批量爬取
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, updateTaskProgress, broadcastTaskUpdate } from '../../utils/crawler-tasks'
import { extractLinksByXPath, crawlSinglePage, mergeMarkdown } from '../../crawler/batch-utils.js'
import { saveAsDraft } from '../../crawler/crawler-service.js'
import { activePages } from '../../crawler/crawler-service.js'
import type { BatchCrawlRequest } from '@local-rag/shared/types'

const logger = createLogger(LogSystem.API, 'crawler/batch')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<BatchCrawlRequest>(event)
    const { taskId, linksXPath, contentXPath, maxLinks = 100 } = body

    if (!taskId || !linksXPath) {
      throw createError({
        statusCode: 400,
        message: '请提供任务 ID 和链接 XPath',
      })
    }

    const task = activeTasks.get(taskId)
    if (!task) {
      throw createError({
        statusCode: 404,
        message: '任务不存在',
      })
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
  if (!task) return

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

    const links = await extractLinksByXPath(page, linksXPath, maxLinks)
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

    // 步骤 2: 批量爬取（并发数 3）
    updateTaskProgress(task, {
      currentStep: '批量爬取中',
      currentStepNumber: 2,
      totalSteps: 4,
      progressPercentage: 20,
      stepDetails: `正在爬取 ${links.length} 个页面...`,
    })
    broadcastTaskUpdate(task)

    const batchSize = 3
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
          broadcastTaskUpdate(task)

          const { title, markdown } = await crawlSinglePage(page, url, contentXPath)

          resultItem.title = title
          resultItem.markdown = markdown
          resultItem.status = 'success'
          resultItem.crawledAt = new Date()

          logger.info(`页面爬取成功`, { url, title, resultIdx })
        } catch (error) {
          // 跳过失败的页面，继续处理下一个
          const errorMessage = error instanceof Error ? error.message : String(error)
          resultItem.status = 'failed'
          resultItem.error = errorMessage
          logger.warn(`页面爬取失败，跳过`, { url, error: { message: errorMessage } })
        }

        task.completedLinks = resultIdx + 1
        const progressPercentage = Math.round((task.completedLinks / task.totalLinks!) * 60) + 20
        updateTaskProgress(task, {
          progressPercentage,
          stepDetails: `已完成 ${task.completedLinks} / ${task.totalLinks}`,
        })
        broadcastTaskUpdate(task)
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
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
  }
}
