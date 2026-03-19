/**
 * 爬虫 API 路由
 */

import express from 'express';
import { crawl, activePages, clearXPathTimeout, extractContentByXPath, generateMarkdown, saveAsDraft } from '../crawler/crawler-service.js';
import { deleteSession, listSessions } from '../crawler/session-manager.js';
import { broadcast } from '../index.js';
import { createError } from '../middleware/error-handler.js';
import { createLogger, LogSystem } from '@local-rag/shared';
import type { CrawlerTask, CrawlerTaskProgress } from '@local-rag/shared/types';
import { ResourceManager, taskQueue } from '../crawler/concurrency-controller.js';

const logger = createLogger(LogSystem.API, 'crawler');

const router = express.Router();

// 存储活跃的任务
const activeTasks = new Map<string, CrawlerTask>();

// 爬虫配置常量
const CRAWLER_CONFIG = {
  MAX_QUEUE_SIZE: 10,
  DEFAULT_TOTAL_STEPS_NO_AUTH: 4,
  DEFAULT_TOTAL_STEPS_WITH_AUTH: 7,
  MAX_XPATH_LENGTH: 1000,
  MAX_PREVIEW_LENGTH: 100_000, // 100KB
  DANGEROUS_XPATH_PATTERNS: ['document(', 'system-property(', 'import '] as const,
};

/**
 * XPath 验证和清理
 */
function validateXPath(xpath: string): void {
  if (!xpath || typeof xpath !== 'string' || xpath.trim().length === 0) {
    throw createError(400, 'INVALID_INPUT', '请提供有效的 XPath 表达式');
  }

  const trimmed = xpath.trim();

  // 检查长度
  if (trimmed.length > CRAWLER_CONFIG.MAX_XPATH_LENGTH) {
    throw createError(400, 'INVALID_INPUT', `XPath 表达式过长（最大 ${CRAWLER_CONFIG.MAX_XPATH_LENGTH} 字符）`);
  }

  // 检查危险模式
  for (const pattern of CRAWLER_CONFIG.DANGEROUS_XPATH_PATTERNS) {
    if (trimmed.includes(pattern)) {
      throw createError(400, 'INVALID_INPUT', '包含不安全的 XPath 表达式');
    }
  }
}

/**
 * 更新任务进度
 */
function updateTaskProgress(
  task: CrawlerTask,
  progress: Partial<CrawlerTaskProgress>
): void {
  task.progress = {
    ...task.progress,
    ...progress,
  } as CrawlerTaskProgress;
  // 使用 ISO 字符串确保序列化一致性
  task.lastUpdatedAt = new Date().toISOString() as any;
}

/**
 * 安全地广播任务更新（确保数据被正确序列化）
 */
function broadcastTaskUpdate(task: CrawlerTask): void {
  // 创建一个干净的对象副本，确保所有字段都能被正确序列化
  const taskCopy = {
    id: task.id,
    url: task.url,
    status: task.status,
    waitForAuth: task.waitForAuth,
    useXPath: task.useXPath,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    error: task.error,
    documentCount: task.documentCount,
    authStatus: task.authStatus,
    xpath: task.xpath,
    // 截断过长的预览内容
    previewMarkdown: task.previewMarkdown && task.previewMarkdown.length > CRAWLER_CONFIG.MAX_PREVIEW_LENGTH
      ? task.previewMarkdown.substring(0, CRAWLER_CONFIG.MAX_PREVIEW_LENGTH) + '\n\n[内容过长，已截断]'
      : task.previewMarkdown,
    progress: task.progress,
    lastUpdatedAt: task.lastUpdatedAt,
  };

  broadcast('crawler:task:updated', taskCopy);
}

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

    // 检查队列是否已满
    const queueStatus = ResourceManager.getInstance().getQueueStatus();
    if (queueStatus.queueSize >= CRAWLER_CONFIG.MAX_QUEUE_SIZE) {
      throw createError(429, 'QUEUE_FULL', '任务队列已满，请稍后再试');
    }

    // 生成任务 ID
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 计算总步骤数
    const totalSteps = waitForAuth ? CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH : CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH;

    // 创建任务
    const task: CrawlerTask = {
      id: taskId,
      url,
      status: 'pending',
      waitForAuth,
      useXPath,
      startedAt: new Date(),
      progress: {
        currentStep: '任务已创建',
        currentStepNumber: 1,
        totalSteps,
        progressPercentage: 0,
      },
      lastUpdatedAt: new Date().toISOString() as any,
    };

    activeTasks.set(taskId, task);

    // 广播任务创建
    broadcast('crawler:task:created', task);

    // 将任务添加到队列
    const queuePosition = taskQueue.size;
    taskQueue.add(() => runCrawlerTask(taskId)).catch((error) => {
      logger.error(`任务 ${taskId} 执行失败`, error as Error, { taskId });
    });

    res.status(201).json({
      success: true,
      data: task,
      queueStatus: {
        position: queuePosition,
        pending: taskQueue.pending,
        size: taskQueue.size,
      },
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

    broadcastTaskUpdate(task);

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
 * GET /api/crawler/queue/status
 * 获取队列状态
 */
router.get('/queue/status', async (req, res, next) => {
  try {
    const status = ResourceManager.getInstance().getQueueStatus();
    res.json({
      success: true,
      data: status,
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

  // 计算总步骤数：根据 waitForAuth 和 useXPath 的组合
  // 1. 不登录，不 XPath: 4 步 (启动 → 浏览器 → 导航 → 完成)
  // 2. 不登录，XPath: 4 步 (启动 → 浏览器 → 导航 → 等待 XPath)
  // 3. 登录，不 XPath: 7 步 (启动 → 浏览器 → 导航 → 登录检测 → 等待登录 → 登录成功 → 完成)
  // 4. 登录，XPath: 7 步 (启动 → 浏览器 → 导航 → 登录检测 → 等待登录 → 登录成功 → 等待 XPath)
  let totalSteps = CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH;
  if (task.waitForAuth) {
    totalSteps = CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH;
  }

  try {
    // 步骤 1: 启动任务
    updateTaskProgress(task, {
      currentStep: '启动爬虫任务',
      currentStepNumber: 1,
      totalSteps,
      progressPercentage: Math.round((1 / totalSteps) * 100),
      stepDetails: '正在初始化...',
    });
    task.status = 'running';
    broadcastTaskUpdate(task);

    // 步骤 2: 启动浏览器
    updateTaskProgress(task, {
      currentStep: '启动浏览器',
      currentStepNumber: 2,
      totalSteps,
      progressPercentage: Math.round((2 / totalSteps) * 100),
      stepDetails: '正在初始化浏览器实例...',
    });
    broadcastTaskUpdate(task);

    // 步骤 3: 导航到目标页面
    updateTaskProgress(task, {
      currentStep: '导航到目标页面',
      currentStepNumber: 3,
      totalSteps,
      progressPercentage: Math.round((3 / totalSteps) * 100),
      stepDetails: `正在加载: ${task.url}`,
    });
    broadcastTaskUpdate(task);

    const result = await crawl(task.url, {
      waitForAuth: task.waitForAuth,
      useXPath: task.useXPath,
      onAuthStatusChange: (status) => {
        task.authStatus = status;

        // 登录状态对应的进度更新
        if (status === 'detected') {
          updateTaskProgress(task, {
            currentStep: '检测到登录需求',
            currentStepNumber: 4,
            totalSteps,
            progressPercentage: Math.round((4 / totalSteps) * 100),
            stepDetails: '请在浏览器中完成登录操作',
          });
        } else if (status === 'waiting_qrcode') {
          updateTaskProgress(task, {
            currentStep: '等待扫码登录',
            currentStepNumber: 5,
            totalSteps,
            progressPercentage: Math.round((5 / totalSteps) * 100),
            stepDetails: '请使用手机扫描二维码登录',
          });
        } else if (status === 'success') {
          updateTaskProgress(task, {
            currentStep: '登录成功',
            currentStepNumber: 6,
            totalSteps,
            progressPercentage: Math.round((6 / totalSteps) * 100),
            stepDetails: '会话已保存',
          });
        }

        broadcastTaskUpdate(task);
      },
      onProgress: (documentCount) => {
        task.documentCount = documentCount;
        task.lastUpdatedAt = new Date();
        broadcastTaskUpdate(task);
      },
      onLoginSuccess: (page) => {
        // 只在启用 XPath 模式时保存页面引用
        if (task.useXPath) {
          const xpathStepNumber = task.waitForAuth ? CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH : CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH;
          updateTaskProgress(task, {
            currentStep: '等待输入 XPath',
            currentStepNumber: xpathStepNumber,
            totalSteps,
            progressPercentage: Math.round((xpathStepNumber / totalSteps) * 100),
            stepDetails: '请在界面中输入 XPath 表达式',
          });
          activePages.set(taskId, page);
          task.status = 'waiting_xpath';
          broadcastTaskUpdate(task);
        }
      },
    });

    if (result.waitingForXPath) {
      logger.info(`任务 ${taskId} 等待用户输入 XPath`);
      return;
    }

    // 如果返回了 Markdown，进入确认流程
    if (result.markdown && result.title) {
      const confirmStepNumber = task.waitForAuth ? CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH : CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH;
      updateTaskProgress(task, {
        currentStep: '等待用户确认',
        currentStepNumber: confirmStepNumber,
        totalSteps,
        progressPercentage: Math.round((confirmStepNumber / totalSteps) * 100),
        stepDetails: '请查看并确认爬取的内容',
      });
      task.previewMarkdown = result.markdown;
      task.status = 'waiting_confirm';
      task.lastUpdatedAt = new Date();
      broadcastTaskUpdate(task);
      logger.info(`任务 ${taskId} 等待用户确认`, { markdownLength: result.markdown.length });
      return;
    }

    // 最后步骤: 完成（不应该到达这里，因为所有爬取都需要确认）
    updateTaskProgress(task, {
      currentStep: '爬取完成',
      currentStepNumber: totalSteps,
      totalSteps,
      progressPercentage: 100,
      stepDetails: `爬取已完成`,
    });
    task.status = 'completed';
    task.completedAt = new Date();
    task.lastUpdatedAt = new Date();

    broadcastTaskUpdate(task);
  } catch (error) {
    updateTaskProgress(task, {
      currentStep: '任务失败',
      currentStepNumber: 0,
      totalSteps,
      progressPercentage: 0,
      stepDetails: error instanceof Error ? error.message : String(error),
    });
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : String(error);
    task.completedAt = new Date();
    task.lastUpdatedAt = new Date();

    broadcastTaskUpdate(task);
  }
}

/**
 * POST /api/crawler/xpath
 * 提交 XPath 选择器
 */
router.post('/xpath', async (req, res, next) => {
  try {
    const { taskId, xpath } = req.body;

    // 验证 XPath 输入
    validateXPath(xpath);

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

    // 更新任务状态和进度
    const totalSteps = task.waitForAuth ? CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_WITH_AUTH : CRAWLER_CONFIG.DEFAULT_TOTAL_STEPS_NO_AUTH;
    updateTaskProgress(task, {
      currentStep: '等待用户确认',
      currentStepNumber: totalSteps,
      totalSteps,
      progressPercentage: 100,
      stepDetails: '请查看并确认爬取的内容',
    });
    task.status = 'waiting_confirm';
    task.xpath = xpath;
    task.previewMarkdown = markdown;

    logger.info(`任务 ${taskId} XPath 提取完成，等待用户确认`, {
      markdownLength: markdown.length,
      progress: task.progress,
    });
    broadcastTaskUpdate(task);

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
      // 用户拒绝内容的处理
      if (task.useXPath) {
        // XPath 模式：返回等待 XPath 状态，让用户重新输入
        task.status = 'waiting_xpath';
        task.xpath = undefined;
        task.previewMarkdown = undefined;
        broadcastTaskUpdate(task);
        res.json({
          success: true,
          data: task,
          message: '已取消，请重新输入 XPath'
        });
      } else {
        // 非 XPath 模式：标记任务为已取消（用户可以重新创建任务）
        task.status = 'failed';
        task.error = '用户取消确认';
        task.completedAt = new Date();
        task.lastUpdatedAt = new Date();
        broadcastTaskUpdate(task);
        res.json({
          success: true,
          data: task,
          message: '已取消，您可以重新创建爬取任务'
        });
      }
      return;
    }

    // 用户确认，保存为草稿
    const draftId = await saveAsDraft(
      task.previewMarkdown?.split('\n')[0].replace('# ', '').replace('[草稿] ', '') || 'Untitled',
      task.previewMarkdown || '',
      task.url
    );

    // 如果使用了 XPath，清除超时定时器
    if (task.useXPath) {
      clearXPathTimeout(taskId);
    }

    // 标记任务完成
    task.status = 'completed';
    task.documentCount = 1;
    task.completedAt = new Date();
    task.lastUpdatedAt = new Date();

    broadcastTaskUpdate(task);

    res.json({
      success: true,
      data: { ...task, draftId },
      message: '草稿已保存'
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
