/**
 * POST /api/crawler/xpath - 提交 XPath 选择器
 */
import { createError, defineEventHandler, readBody } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'
import { activeTasks, CRAWLER_CONFIG, updateTaskProgress, broadcastTaskUpdate } from '../../utils/crawler-tasks'
import { validateXPath } from '../../utils/validation'
import { extractContentByXPath, generateMarkdown, clearXPathTimeout } from '../../crawler/crawler-service'
import { activePages } from '../../crawler/crawler-service'

const logger = createLogger(LogSystem.API, 'crawler/xpath')

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event) || {}
    const { taskId, xpath } = body

    // 验证 XPath 输入
    validateXPath(xpath)

    const task = activeTasks.get(taskId)
    if (!task || task.status !== 'waiting_xpath') {
      throw createError({
        statusCode: 400,
        statusMessage: '任务不在等待 XPath 状态',
      })
    }

    const page = activePages.get(taskId)
    if (!page) {
      throw createError({
        statusCode: 404,
        statusMessage: '浏览器页面未找到',
      })
    }

    // 提取内容
    const { html, title } = await extractContentByXPath(page, xpath)
    const markdown = generateMarkdown(html, title, task.url)

    // 更新任务状态和进度
    const totalSteps = task.waitForAuth ? CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH : CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH
    updateTaskProgress(task, {
      currentStep: '等待用户确认',
      currentStepNumber: totalSteps,
      totalSteps,
      progressPercentage: 100,
      stepDetails: '请查看并确认爬取的内容',
    })
    task.status = 'waiting_confirm'
    task.xpath = xpath
    task.previewMarkdown = markdown

    logger.info(`任务 ${taskId} XPath 提取完成，等待用户确认`, {
      markdownLength: markdown.length,
      progress: task.progress,
    })
    broadcastTaskUpdate(task)

    return {
      success: true,
      data: {
        markdown,
        title,
      },
    }
  } catch (error) {
    logger.error('XPath API 错误', error as Error)
    const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode) || 500
      : 500
    throw createError({
      statusCode,
      statusMessage: error instanceof Error ? error.message : 'Failed to extract content',
    })
  }
})
