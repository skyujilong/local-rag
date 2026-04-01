/**
 * Web Crawler API Routes
 *
 * 提供爬虫功能的 HTTP API 接口
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createLogger } from '../../../shared/utils/logger.js';
import { crawlerEnhancedService } from '../../services/crawler-enhanced.service.js';
import { authSessionManagerService } from '../../services/auth-session-manager.service.js';
import { crawlerDbService } from '../../services/crawler-db.service.js';
import { UrlUtil } from '../../../shared/utils/url.js';
import type {
  SinglePageConfig,
  SitemapConfig,
  RecursiveConfig,
  ImportConfirmItem,
  BatchImportRequest,
} from '../../../shared/types/crawler.js';

const log = createLogger('server:api:crawler');
const router = new Hono();

// ===== Zod 验证 Schema =====

const singlePageSchema = z.object({
  url: z.string().url('Invalid URL format'),
  authProfileId: z.string().optional(),
  timeout: z.number().min(1000).max(120000).optional(),
  waitForSelector: z.string().optional(),
  cssSelector: z.string().optional(),
});

const sitemapParseSchema = z.object({
  sitemapUrl: z.string().url('Invalid URL format'),
  authProfileId: z.string().optional(),
});

const sitemapStartSchema = z.object({
  sitemapUrl: z.string().url('Invalid URL format'),
  urls: z.array(z.string().url()).optional(),
  authProfileId: z.string().optional(),
  timeout: z.number().min(1000).max(120000).optional(),
  interval: z.number().min(1).max(10).optional(),
});

const recursiveDiscoverSchema = z.object({
  startUrl: z.string().url('Invalid URL format'),
  maxDepth: z.number().min(1).max(3).optional(),
  urlFilter: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
  authProfileId: z.string().optional(),
  timeout: z.number().min(1000).max(120000).optional(),
});

const recursiveStartSchema = z.object({
  startUrl: z.string().url('Invalid URL format'),
  maxDepth: z.number().min(1).max(3),
  urlFilter: z
    .object({
      include: z.array(z.string()).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
  urls: z.array(z.string().url()),
  authProfileId: z.string().optional(),
  timeout: z.number().min(1000).max(120000).optional(),
  interval: z.number().min(1).max(10).optional(),
});

const cookieAuthSchema = z.object({
  domain: z.string().min(1),
  cookie: z.string().min(1),
  name: z.string().optional(),
});

const headerAuthSchema = z.object({
  domain: z.string().min(1),
  headerName: z.string().min(1),
  headerValue: z.string().min(1),
  name: z.string().optional(),
});

const launchBrowserSchema = z.object({
  url: z.string().url('Invalid URL format'),
  name: z.string().optional(),
});

const completeLoginSchema = z.object({
  sessionId: z.string().min(1),
  name: z.string().optional(),
});

const batchImportSchema = z.object({
  taskId: z.string().min(1),
  items: z.array(
    z.object({
      resultId: z.string(),
      selected: z.boolean(),
      tags: z.array(z.string()).optional(),
    })
  ),
  batchTags: z.array(z.string()).optional(),
});

// ===== 单页面爬取 =====

/**
 * POST /api/crawl/single
 * 单页面爬取（同步阻塞模式）
 */
router.post('/single', async (c) => {
  try {
    const body = await c.req.json();
    const validated = singlePageSchema.parse(body);

    log.info(`Single page crawl request: ${validated.url}`);

    const config: SinglePageConfig = {
      url: validated.url,
      authProfileId: validated.authProfileId,
      timeout: validated.timeout,
      waitForSelector: validated.waitForSelector,
      cssSelector: validated.cssSelector,
    };

    const result = await crawlerEnhancedService.crawlSinglePage(config);

    return c.json({
      success: true,
      result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Single page crawl failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Crawl failed',
      },
      500
    );
  }
});

// ===== 站点地图爬取 =====

/**
 * POST /api/crawl/sitemap/parse
 * 解析站点地图
 */
router.post('/sitemap/parse', async (c) => {
  try {
    const body = await c.req.json();
    const validated = sitemapParseSchema.parse(body);

    log.info(`Sitemap parse request: ${validated.sitemapUrl}`);

    const config: SitemapConfig = {
      sitemapUrl: validated.sitemapUrl,
      authProfileId: validated.authProfileId,
    };

    const urls = await crawlerEnhancedService.parseSitemap(config);

    return c.json({
      success: true,
      urls,
      total: urls.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Sitemap parse failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Parse failed',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/sitemap/start
 * 启动站点地图爬取任务
 */
router.post('/sitemap/start', async (c) => {
  try {
    const body = await c.req.json();
    const validated = sitemapStartSchema.parse(body);

    log.info(`Sitemap crawl start request: ${validated.sitemapUrl}`);

    const config: SitemapConfig = {
      sitemapUrl: validated.sitemapUrl,
      urls: validated.urls,
      authProfileId: validated.authProfileId,
      timeout: validated.timeout,
      interval: validated.interval,
    };

    const taskId = await crawlerEnhancedService.createSitemapTask(config);

    return c.json({
      success: true,
      taskId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Sitemap crawl start failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Start failed',
      },
      500
    );
  }
});

// ===== 递归爬取 =====

/**
 * POST /api/crawl/recursive/discover
 * 发现链接（递归爬取）
 */
router.post('/recursive/discover', async (c) => {
  try {
    const body = await c.req.json();
    const validated = recursiveDiscoverSchema.parse(body);

    log.info(`Recursive discover request: ${validated.startUrl}`);

    const config: RecursiveConfig = {
      startUrl: validated.startUrl,
      maxDepth: validated.maxDepth || 2,
      urlFilter: validated.urlFilter,
      authProfileId: validated.authProfileId,
      timeout: validated.timeout,
    };

    const urls = await crawlerEnhancedService.discoverLinks(config);

    return c.json({
      success: true,
      urls,
      total: urls.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Recursive discover failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Discover failed',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/recursive/start
 * 启动递归爬取任务
 */
router.post('/recursive/start', async (c) => {
  try {
    const body = await c.req.json();
    const validated = recursiveStartSchema.parse(body);

    log.info(`Recursive crawl start request: ${validated.startUrl}`);

    const config: RecursiveConfig = {
      startUrl: validated.startUrl,
      maxDepth: validated.maxDepth,
      urlFilter: validated.urlFilter,
      authProfileId: validated.authProfileId,
      timeout: validated.timeout,
      interval: validated.interval,
    };

    const taskId = await crawlerEnhancedService.createRecursiveTask(config, validated.urls);

    return c.json({
      success: true,
      taskId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Recursive crawl start failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Start failed',
      },
      500
    );
  }
});

// ===== 任务管理 =====

/**
 * GET /api/crawl/tasks
 * 获取所有任务
 */
router.get('/tasks', async (c) => {
  try {
    const status = c.req.query('status');
    const tasks = crawlerEnhancedService.getAllTasks(status);

    return c.json({
      success: true,
      tasks,
      total: tasks.length,
    });
  } catch (error) {
    log.error('Get tasks failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get tasks',
      },
      500
    );
  }
});

/**
 * GET /api/crawl/tasks/:taskId
 * 获取任务详情
 */
router.get('/tasks/:taskId', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    const task = crawlerEnhancedService.getTask(taskId);

    if (!task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    // 获取任务结果
    const results = crawlerDbService.getTaskResults(taskId);

    // 获取检查点
    const checkpoint = crawlerDbService.getCheckpoint(taskId);

    return c.json({
      success: true,
      task,
      results,
      checkpoint,
    });
  } catch (error) {
    log.error('Get task failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get task',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/tasks/:taskId/pause
 * 暂停任务
 */
router.post('/tasks/:taskId/pause', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    crawlerEnhancedService.pauseTask(taskId);

    return c.json({
      success: true,
      message: 'Task paused',
    });
  } catch (error) {
    log.error('Pause task failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to pause task',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/tasks/:taskId/resume
 * 恢复任务
 */
router.post('/tasks/:taskId/resume', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    await crawlerEnhancedService.resumeTask(taskId);

    return c.json({
      success: true,
      message: 'Task resumed',
    });
  } catch (error) {
    log.error('Resume task failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to resume task',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/tasks/:taskId/terminate
 * 终止任务
 */
router.post('/tasks/:taskId/terminate', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    crawlerEnhancedService.terminateTask(taskId);

    return c.json({
      success: true,
      message: 'Task terminated',
    });
  } catch (error) {
    log.error('Terminate task failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to terminate task',
      },
      500
    );
  }
});

/**
 * DELETE /api/crawl/tasks/:taskId
 * 删除任务
 */
router.delete('/tasks/:taskId', async (c) => {
  try {
    const taskId = c.req.param('taskId');
    crawlerEnhancedService.deleteTask(taskId);

    return c.json({
      success: true,
      message: 'Task deleted',
    });
  } catch (error) {
    log.error('Delete task failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete task',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/import
 * 批量导入爬取结果
 */
router.post('/import', async (c) => {
  try {
    const body = await c.req.json();
    const validated = batchImportSchema.parse(body);

    log.info(`Batch import request: task=${validated.taskId}, items=${validated.items.length}`);

    const request: BatchImportRequest = {
      taskId: validated.taskId,
      items: validated.items as ImportConfirmItem[],
      batchTags: validated.batchTags,
    };

    const result = await crawlerEnhancedService.batchImport(request);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Batch import failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Import failed',
      },
      500
    );
  }
});

/**
 * GET /api/crawl/stats
 * 获取爬取统计
 */
router.get('/stats', async (c) => {
  try {
    const stats = crawlerEnhancedService.getStats();

    return c.json({
      success: true,
      stats,
    });
  } catch (error) {
    log.error('Get stats failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get stats',
      },
      500
    );
  }
});

// ===== 认证管理 =====

/**
 * POST /api/crawl/auth/cookie
 * 保存认证配置（Cookie 注入）
 */
router.post('/auth/cookie', async (c) => {
  try {
    const body = await c.req.json();
    const validated = cookieAuthSchema.parse(body);

    log.info(`Cookie auth save request: domain=${validated.domain}`);

    const profile = await authSessionManagerService.saveCookieAuth(
      validated.domain,
      validated.cookie,
      validated.name
    );

    return c.json({
      success: true,
      profile: {
        id: profile.id,
        domain: profile.domain,
        type: profile.type,
        name: profile.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Cookie auth save failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save cookie auth',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/auth/header
 * 保存认证配置（Header 注入）
 */
router.post('/auth/header', async (c) => {
  try {
    const body = await c.req.json();
    const validated = headerAuthSchema.parse(body);

    log.info(`Header auth save request: domain=${validated.domain}`);

    const profile = await authSessionManagerService.saveHeaderAuth(
      validated.domain,
      validated.headerName,
      validated.headerValue,
      validated.name
    );

    return c.json({
      success: true,
      profile: {
        id: profile.id,
        domain: profile.domain,
        type: profile.type,
        name: profile.name,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Header auth save failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save header auth',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/auth/launch-browser
 * 启动浏览器登录
 */
router.post('/auth/launch-browser', async (c) => {
  try {
    const body = await c.req.json();
    const validated = launchBrowserSchema.parse(body);

    log.info(`Launch browser request: url=${validated.url}`);

    // 检测 GUI 环境
    const hasGui = await authSessionManagerService.hasGuiEnvironment();
    if (!hasGui) {
      return c.json(
        {
          error: 'no_display',
          message: '当前环境不支持弹出浏览器，请使用 Cookie 注入方式',
        },
        400
      );
    }

    const session = await authSessionManagerService.launchBrowserLogin(validated.url);

    return c.json({
      success: true,
      sessionId: session.sessionId,
      message: '请在弹出的浏览器中完成登录',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Launch browser failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to launch browser',
      },
      500
    );
  }
});

/**
 * POST /api/crawl/auth/complete-login
 * 完成浏览器登录
 */
router.post('/auth/complete-login', async (c) => {
  try {
    const body = await c.req.json();
    const validated = completeLoginSchema.parse(body);

    log.info(`Complete login request: sessionId=${validated.sessionId}`);

    const profile = await authSessionManagerService.completeBrowserLogin(
      validated.sessionId,
      validated.name
    );

    const cookieCount = await authSessionManagerService.getProfileCookieCount(profile.id);

    return c.json({
      success: true,
      profile: {
        id: profile.id,
        domain: profile.domain,
        type: profile.type,
        name: profile.name,
        cookieCount,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Invalid request body', details: error.errors }, 400);
    }

    log.error('Complete login failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to complete login',
      },
      500
    );
  }
});

/**
 * GET /api/crawl/auth/profiles
 * 获取所有认证配置
 */
router.get('/auth/profiles', async (c) => {
  try {
    const profiles = crawlerDbService.getAllAuthProfiles();

    return c.json({
      success: true,
      profiles: profiles.map((p) => ({
        id: p.id,
        domain: p.domain,
        type: p.type,
        name: p.name,
        createdAt: p.createdAt,
        lastUsedAt: p.lastUsedAt,
      })),
    });
  } catch (error) {
    log.error('Get auth profiles failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get auth profiles',
      },
      500
    );
  }
});

/**
 * DELETE /api/crawl/auth/profiles/:profileId
 * 删除认证配置
 */
router.delete('/auth/profiles/:profileId', async (c) => {
  try {
    const profileId = c.req.param('profileId');
    crawlerDbService.deleteAuthProfile(profileId);

    return c.json({
      success: true,
      message: 'Auth profile deleted',
    });
  } catch (error) {
    log.error('Delete auth profile failed', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete auth profile',
      },
      500
    );
  }
});

export { router as crawlRoutes };
