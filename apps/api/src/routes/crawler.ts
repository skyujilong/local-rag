/**
 * 爬虫 API 路由
 */

import express from 'express';
import { crawl } from '../crawler/crawler-service.js';
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
    const { url, waitForAuth = false } = req.body;

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
      onAuthStatusChange: (status) => {
        task.authStatus = status;
        broadcast('crawler:task:updated', task);
      },
      onProgress: (documentCount) => {
        task.documentCount = documentCount;
        broadcast('crawler:task:updated', task);
      },
    });

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

export default router;
