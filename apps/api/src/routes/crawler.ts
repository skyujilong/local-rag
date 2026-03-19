/**
 * 爬虫 API 路由
 */

import express from 'express';
import { crawl, activePages, clearXPathTimeout, extractContentByXPath, generateMarkdown, saveAsDraft } from '../crawler/crawler-service.js';
import { deleteSession, listSessions } from '../crawler/session-manager.js';
import { broadcast } from '../index.js';
import { createError } from '../middleware/error-handler.js';
import { createLogger, LogSystem } from '@local-rag/shared';
import type { CrawlerTask } from '@local-rag/shared/types';

const logger = createLogger(LogSystem.API, 'crawler');

const router = express.Router();

// 存储活跃的任务
const activeTasks = new Map<string, CrawlerTask>();

/**
 * GET /api/crawler/tasks
 * 获取爬虫任务列表
 */
router.get('/tasks', async (req, res, next) => {
  try {
    const tasks = Array.from(activeTasks.values());
    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/crawler/tasks/:id
 * 获取单个任务状态
 */
router.get('/tasks/:id', async (req, res, next) => {
  try {
    const task = activeTasks.get(req.params.id);

    if (!task) {
      throw createError(404, 'TASK_NOT_FOUND', '任务不存在');
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/crawler/start
 * 启动爬虫任务
 */
router.post('/start', async (req, res, next) => {
  try {
    const { url, waitForAuth = false, useXPath = false } = req.body;

    if (!url || typeof url !== 'string') {
      throw createError(400, 'INVALID_INPUT', '请提供有效的 URL');
    }

    // 生成任务 ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 创建任务
    const task: CrawlerTask = {
      id: taskId,
      url,
      status: 'pending',
      waitForAuth,
      useXPath,
      startedAt: new Date(),
    };

    activeTasks.set(taskId, task);

    // 广播任务创建
    broadcast('crawler:task:created', task);

    // 异步执行爬取
    runCrawlerTask(taskId).catch((error) => {
      logger.error(`任务 ${taskId} 执行失败`, error as Error, { taskId });
    });

    res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/crawler/tasks/:id/cancel
 * 取消爬虫任务
 */
router.post('/tasks/:id/cancel', async (req, res, next) => {
  try {
    const task = activeTasks.get(req.params.id);

    if (!task) {
      throw createError(404, 'TASK_NOT_FOUND', '任务不存在');
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw createError(400, 'INVALID_STATE', '任务已结束，无法取消');
    }

    // TODO: 实现取消逻辑
    task.status = 'failed';
    task.error = '用户取消';
    task.completedAt = new Date();

    broadcast('crawler:task:updated', task);

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/crawler/sessions/:domain
 * 删除域名会话
 */
router.delete('/sessions/:domain', async (req, res, next) => {
  try {
    await deleteSession(req.params.domain);

    res.json({
      success: true,
      data: { domain: req.params.domain },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/crawler/sessions
 * 获取所有保存的会话
 */
router.get('/sessions', async (req, res, next) => {
  try {
    const sessions = await listSessions();

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 执行爬虫任务
 */
async function runCrawlerTask(taskId: string) {
  const task = activeTasks.get(taskId);
  if (!task) return;

  try {
    task.status = 'running';
    broadcast('crawler:task:updated', task);

    const result = await crawl(task.url, {
      waitForAuth: task.waitForAuth,
      useXPath: task.useXPath, // 使用用户选择的 XPath 模式
      onAuthStatusChange: (status) => {
        task.authStatus = status;
        broadcast('crawler:task:updated', task);
      },
      onProgress: (documentCount) => {
        task.documentCount = documentCount;
        broadcast('crawler:task:updated', task);
      },
      onLoginSuccess: (page) => {
        // 如果使用 XPath 模式，登录成功后保存页面引用并等待用户输入 XPath
        if (task.useXPath) {
          activePages.set(taskId, page);
          task.status = 'waiting_xpath';
          broadcast('crawler:task:updated', task);
        }
      },
    });

    // 如果返回结果表示正在等待 XPath，则不更新为完成状态
    if (result.waitingForXPath) {
      logger.info(`任务 ${taskId} 等待用户输入 XPath`);
      return;
    }

    task.status = 'completed';
    task.documentCount = result.documentCount;
    task.completedAt = new Date();

    broadcast('crawler:task:updated', task);
  } catch (error) {
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : String(error);
    task.completedAt = new Date();

    broadcast('crawler:task:updated', task);
  }
}

/**
 * POST /api/crawler/xpath
 * 提交 XPath 选择器
 */
router.post('/xpath', async (req, res, next) => {
  try {
    const { taskId, xpath } = req.body;

    const task = activeTasks.get(taskId);
    if (!task || task.status !== 'waiting_xpath') {
      throw createError(400, 'INVALID_STATE', '任务不在等待 XPath 状态');
    }

    const page = activePages.get(taskId);
    if (!page) {
      throw createError(404, 'PAGE_NOT_FOUND', '浏览器页面未找到');
    }

    // 提取内容
    const { html, title } = await extractContentByXPath(page, xpath);
    const markdown = generateMarkdown(html, title, task.url);

    // 更新任务状态
    task.status = 'waiting_confirm';
    task.xpath = xpath;
    task.previewMarkdown = markdown;

    broadcast('crawler:task:updated', task);

    res.json({
      success: true,
      data: {
        markdown,
        title,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/crawler/confirm
 * 确认内容并保存为草稿
 */
router.post('/confirm', async (req, res, next) => {
  try {
    const { taskId, confirmed } = req.body;

    const task = activeTasks.get(taskId);
    if (!task || task.status !== 'waiting_confirm') {
      throw createError(400, 'INVALID_STATE', '任务不在等待确认状态');
    }

    if (!confirmed) {
      // 用户拒绝，返回等待 XPath 状态
      task.status = 'waiting_xpath';
      task.xpath = undefined;
      task.previewMarkdown = undefined;
      broadcast('crawler:task:updated', task);
      res.json({ success: true, data: task });
      return;
    }

    // 清除超时定时器
    clearXPathTimeout(taskId);

    // 确认后保存为草稿（使用 NoteManager）
    const draftId = await saveAsDraft(
      task.previewMarkdown?.split('\n')[0].replace('# ', '').replace('[草稿] ', '') || 'Untitled',
      task.previewMarkdown || '',
      task.url
    );

    // 注意：不关闭浏览器，让用户自己决定何时关闭
    // 浏览器会一直保持打开，直到用户手动关闭或系统超时
    task.status = 'completed';
    task.documentCount = 1;
    task.completedAt = new Date();

    broadcast('crawler:task:updated', task);

    res.json({
      success: true,
      data: { ...task, draftId },
      message: '草稿已保存，浏览器保持打开，您可以继续使用或手动关闭'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/crawler/close-browser
 * 手动关闭浏览器
 */
router.post('/close-browser', async (req, res, next) => {
  try {
    const { taskId } = req.body;

    const task = activeTasks.get(taskId);
    if (!task) {
      throw createError(404, 'TASK_NOT_FOUND', '任务不存在');
    }

    // 关闭浏览器页面
    const page = activePages.get(taskId);
    if (page) {
      await page.close();
      activePages.delete(taskId);
      logger.info(`用户手动关闭浏览器`, { taskId });
    }

    res.json({
      success: true,
      message: '浏览器已关闭'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
