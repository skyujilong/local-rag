/**
 * Enhanced Web Crawler Service
 *
 * 支持三种爬取模式：单页面、站点地图、递归爬取
 * 支持认证、断点续爬、进度跟踪等功能
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { randomUUID } from 'crypto';
import { createLogger } from '../../shared/utils/logger.js';
import { UrlUtil } from '../../shared/utils/url.js';
import { contentCleanerService } from './content-cleaner.service.js';
import { authSessionManagerService } from './auth-session-manager.service.js';
import { crawlerDbService } from './crawler-db.service.js';
import { notesService } from '../features/documents/services/notes.service.js';
import type {
  CrawlMode,
  CrawlTask,
  CrawlResult,
  TaskStatus,
  SinglePageConfig,
  SitemapConfig,
  RecursiveConfig,
  ImportConfirmItem,
  BatchImportResponse,
  CrawlStats,
  CheckpointData,
} from '../../shared/types/crawler.js';

const log = createLogger('server:services:crawler-enhanced');

/**
 * Enhanced Crawler Service 类
 */
export class CrawlerEnhancedService {
  private browser: Browser | null = null;
  private activeTasks: Map<string, CrawlTask> = new Map();
  private pauseSignals: Map<string, boolean> = new Map();
  private terminateSignals: Map<string, boolean> = new Map();

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    try {
      this.browser = await chromium.launch({
        headless: true,
      });

      // 恢复之前未完成的任务
      await this.recoverRunningTasks();

      log.info('Enhanced crawler service initialized');
    } catch (error) {
      log.error('Failed to initialize enhanced crawler', error);
      throw error;
    }
  }

  /**
   * 恢复运行中的任务（服务重启后）
   */
  private async recoverRunningTasks(): Promise<void> {
    const runningTasks = crawlerDbService.getAllTasks('running');

    for (const task of runningTasks) {
      log.warn(`Recovering running task: ${task.taskId}`);
      task.status = 'paused';
      crawlerDbService.updateTaskStatus(task.taskId, 'paused');

      // 从配置中重新解析 URL 列表
      const config = task.config as SitemapConfig;
      let urls: string[] = [];

      if (config.urls) {
        urls = config.urls;
      } else if (config.sitemapUrl) {
        try {
          urls = await this.parseSitemap(config);
        } catch (error) {
          log.error(`Failed to re-parse sitemap for task ${task.taskId}`, error);
          continue;
        }
      }

      // 重建任务对象并放入 activeTasks
      const fullTask: CrawlTask = {
        ...task,
        urls,
      };

      this.activeTasks.set(task.taskId, fullTask);
    }
  }

  /**
   * ===== 单页面爬取 =====
   */

  /**
   * 单页面爬取（同步阻塞模式）
   */
  async crawlSinglePage(config: SinglePageConfig): Promise<CrawlResult> {
    await this.initialize();

    const resultId = randomUUID();
    const startTime = Date.now();

    try {
      log.info(`Crawling single page: ${config.url}`);

      // 创建浏览器上下文
      const context = await this.createContext(config.authProfileId, config.url);

      // 创建页面
      const page = await context.newPage();

      // 导航到 URL
      await page.goto(config.url, {
        waitUntil: 'networkidle',
        timeout: config.timeout || 30000,
      });

      // 等待特定选择器（如果配置）
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
      }

      // 提取 HTML 内容
      const html = await page.content();

      // 清洗内容
      const cleanedResult = await contentCleanerService.cleanContent(
        html,
        config.cssSelector
      );

      // 检测是否为登录页
      const isLogin = contentCleanerService.isLoginPage(cleanedResult.content);

      // 关闭页面和上下文
      await page.close();
      await context.close();

      // 构造结果
      const result: CrawlResult = {
        resultId,
        taskId: '', // 单页面爬取没有任务 ID
        url: config.url,
        status: isLogin ? 'auth_expired' : 'success',
        title: cleanedResult.title,
        content: cleanedResult.content,
        wordCount: cleanedResult.wordCount,
        qualityScore: cleanedResult.qualityScore,
        importedAt: undefined,
        retryCount: 0,
        errorMessage: isLogin ? 'Login page detected' : undefined,
        createdAt: new Date(),
      };

      const duration = Date.now() - startTime;
      log.info(
        `Single page crawled: ${config.url}, status=${result.status}, duration=${duration}ms`
      );

      return result;
    } catch (error) {
      log.error(`Failed to crawl single page: ${config.url}`, error);

      return {
        resultId,
        taskId: '',
        url: config.url,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        retryCount: 0,
        createdAt: new Date(),
      };
    }
  }

  /**
   * ===== 站点地图爬取 =====
   */

  /**
   * 解析站点地图
   */
  async parseSitemap(config: SitemapConfig): Promise<string[]> {
    await this.initialize();

    try {
      log.info(`Parsing sitemap: ${config.sitemapUrl}`);

      const context = await this.createContext(config.authProfileId, config.sitemapUrl);
      const page = await context.newPage();

      await page.goto(config.sitemapUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      const content = await page.content();
      await page.close();
      await context.close();

      // 解析 XML（支持嵌套 Sitemap）
      const urls = await this.extractUrlsFromSitemap(content, config.authProfileId);

      // 去重
      const uniqueUrls = UrlUtil.deduplicateUrls(urls);

      log.info(`Sitemap parsed: ${config.sitemapUrl}, found ${uniqueUrls.length} URLs`);

      return uniqueUrls;
    } catch (error) {
      log.error(`Failed to parse sitemap: ${config.sitemapUrl}`, error);
      throw error;
    }
  }

  /**
   * 从 Sitemap XML 中提取 URL
   */
  private async extractUrlsFromSitemap(
    xml: string,
    authProfileId?: string,
    visited: Set<string> = new Set(),
    depth: number = 0,
    maxDepth: number = 3
  ): Promise<string[]> {
    const urls: string[] = [];

    // 简单的正则提取（生产环境应使用 XML 解析器）
    const urlRegex = /<loc>(.*?)<\/loc>/g;
    let match;

    while ((match = urlRegex.exec(xml)) !== null) {
      urls.push(match[1]);
    }

    // 处理 Sitemap Index（嵌套 Sitemap）
    const sitemapRegex = /<sitemap>([\s\S]*?)<\/sitemap>/g;
    const sitemaps: string[] = [];

    while ((match = sitemapRegex.exec(xml)) !== null) {
      const locMatch = /<loc>(.*?)<\/loc>/.exec(match[1]);
      if (locMatch) {
        sitemaps.push(locMatch[1]);
      }
    }

    // 递归解析嵌套的 Sitemap
    if (sitemaps.length > 0 && depth < maxDepth) {
      log.info(`Found ${sitemaps.length} nested sitemaps, parsing recursively...`);

      for (const sitemapUrl of sitemaps) {
        // 循环检测：跳过已访问的 Sitemap
        if (visited.has(sitemapUrl)) {
          log.warn(`Sitemap already visited, skipping: ${sitemapUrl}`);
          continue;
        }

        // 标记为已访问
        visited.add(sitemapUrl);

        try {
          const context = await this.createContext(authProfileId, sitemapUrl);
          const page = await context.newPage();

          await page.goto(sitemapUrl, {
            waitUntil: 'networkidle',
            timeout: 30000,
          });

          const nestedContent = await page.content();
          await page.close();
          await context.close();

          // 递归提取嵌套 Sitemap 的 URL（深度+1）
          const nestedUrls = await this.extractUrlsFromSitemap(nestedContent, authProfileId, visited, depth + 1, maxDepth);
          urls.push(...nestedUrls);

          log.info(`Parsed nested sitemap: ${sitemapUrl}, found ${nestedUrls.length} URLs`);
        } catch (error) {
          log.error(`Failed to parse nested sitemap: ${sitemapUrl}`, error);
          // 继续处理其他嵌套 Sitemap
        }
      }
    }

    // 深度限制警告
    if (sitemaps.length > 0 && depth >= maxDepth) {
      log.warn(`Sitemap recursion depth limit reached: ${maxDepth}, skipping ${sitemaps.length} nested sitemaps`);
    }

    return urls;
  }

  /**
   * 创建站点地图爬取任务
   */
  async createSitemapTask(config: SitemapConfig): Promise<string> {
    const urls = config.urls || (await this.parseSitemap(config));

    if (urls.length === 0) {
      throw new Error('No URLs found in sitemap');
    }

    // 检查页面数限制
    if (urls.length > 500) {
      throw new Error('Sitemap exceeds maximum limit of 500 pages');
    }

    if (urls.length > 200) {
      log.warn(`Large sitemap detected: ${urls.length} pages, may impact performance`);
    }

    // 创建任务
    const taskId = randomUUID();
    const task: CrawlTask = {
      taskId,
      mode: 'sitemap',
      status: 'pending',
      currentIndex: 0,
      totalUrls: urls.length,
      urls,
      authProfileId: config.authProfileId,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    crawlerDbService.createTask(task);
    this.activeTasks.set(taskId, task);

    log.info(`Sitemap task created: ${taskId}, URLs: ${urls.length}`);

    // 异步开始爬取
    setImmediate(() => this.executeSitemapTask(taskId));

    return taskId;
  }

  /**
   * 执行站点地图爬取任务
   */
  private async executeSitemapTask(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return;
    }

    try {
      // 更新任务状态为运行中
      task.status = 'running';
      crawlerDbService.updateTaskStatus(taskId, 'running', 0);

      // 创建或恢复检查点
      let checkpoint = crawlerDbService.getCheckpoint(taskId);
      if (checkpoint) {
        // 恢复现有检查点
        log.info(`Resuming from checkpoint: ${taskId}, urlIndex=${checkpoint.urlIndex}`);
      } else {
        // 创建新检查点
        checkpoint = this.createCheckpoint(task);
        crawlerDbService.saveCheckpoint(checkpoint);
      }

      // 获取配置
      const config = task.config as SitemapConfig;
      const interval = Math.max(config.interval || 1, 1) * 1000; // 最小 1 秒

      // 串行爬取
      for (let i = checkpoint.urlIndex; i < task.urls.length; i++) {
        // 检查暂停信号
        if (this.pauseSignals.get(taskId)) {
          task.status = 'paused';
          task.pausedAt = new Date();
          crawlerDbService.updateTaskStatus(taskId, 'paused', i);
          log.info(`Sitemap task paused: ${taskId} at ${i}/${task.urls.length}`);
          return;
        }

        // 检查终止信号
        if (this.terminateSignals.get(taskId)) {
          task.status = 'completed';
          crawlerDbService.updateTaskStatus(taskId, 'completed', i);
          log.info(`Sitemap task terminated: ${taskId} at ${i}/${task.urls.length}`);
          return;
        }

        const url = task.urls[i];
        task.currentIndex = i;

        try {
          // 爬取单页
          const result = await this.crawlSinglePage({
            url,
            authProfileId: config.authProfileId,
            timeout: config.timeout,
          });

          // 保存结果
          result.taskId = taskId;
          result.resultId = randomUUID();
          crawlerDbService.createResult(result);

          // 检查认证过期
          if (result.status === 'auth_expired') {
            task.status = 'auth_expired';
            crawlerDbService.updateTaskStatus(taskId, 'auth_expired', i, 'Authentication expired');
            log.warn(`Auth expired in sitemap task: ${taskId} at ${i}`);
            return;
          }

          // 更新检查点
          checkpoint.checkpointData.completedUrls.push(url);
          checkpoint.urlIndex = i + 1;
          checkpoint.updatedAt = new Date();
          crawlerDbService.saveCheckpoint(checkpoint);

          // 更新任务进度
          crawlerDbService.updateTaskStatus(taskId, 'running', i + 1);

          log.debug(`Sitemap progress: ${taskId} ${i + 1}/${task.urls.length}`);

          // 请求间隔
          if (i < task.urls.length - 1) {
            await this.sleep(interval);
          }

          // 每 50 页强制 GC
          if ((i + 1) % 50 === 0) {
            await this.forceGc();
          }
        } catch (error) {
          log.error(`Failed to crawl ${url}`, error);
          checkpoint.checkpointData.failedUrls.push({
            url,
            error: error instanceof Error ? error.message : String(error),
            retryCount: 0,
          });
        }
      }

      // 任务完成
      task.status = 'completed';
      crawlerDbService.updateTaskStatus(taskId, 'completed', task.urls.length);

      log.info(`Sitemap task completed: ${taskId}`);
    } catch (error) {
      log.error(`Sitemap task failed: ${taskId}`, error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      crawlerDbService.updateTaskStatus(taskId, 'failed', task.currentIndex, task.error);
    }
  }

  /**
   * ===== 递归爬取 =====
   */

  /**
   * 发现链接（递归爬取）
   */
  async discoverLinks(config: RecursiveConfig): Promise<string[]> {
    await this.initialize();

    try {
      log.info(`Discovering links from: ${config.startUrl}`);

      const discoveredUrls: string[] = [];
      const visitedUrls = new Set<string>();
      const queue: Array<{ url: string; depth: number }> = [{ url: config.startUrl, depth: 0 }];

      const maxDepth = Math.min(config.maxDepth, 3);

      while (queue.length > 0) {
        const { url, depth } = queue.shift()!;

        // 标准化 URL
        const normalizedUrl = UrlUtil.normalize(url);

        // 检查是否已访问
        if (visitedUrls.has(normalizedUrl)) {
          continue;
        }

        // 检查是否同域名
        if (!UrlUtil.isSameDomain(config.startUrl, url)) {
          continue;
        }

        // 检查过滤规则
        if (!UrlUtil.applyFilters(url, config.urlFilter || {})) {
          continue;
        }

        visitedUrls.add(normalizedUrl);
        discoveredUrls.push(url);

        // 如果达到最大深度，停止发现
        if (depth >= maxDepth) {
          continue;
        }

        // 爬取页面并提取链接
        try {
          const context = await this.createContext(config.authProfileId, url);
          const page = await context.newPage();
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

          const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'));
            return anchors
              .map((a) => (a as HTMLAnchorElement).href)
              .filter((href) => href.startsWith('http'));
          });

          await page.close();
          await context.close();

          // 添加到队列
          for (const link of links) {
            queue.push({ url: link, depth: depth + 1 });
          }
        } catch (error) {
          log.warn(`Failed to discover links from ${url}`, error);
        }
      }

      const uniqueUrls = UrlUtil.deduplicateUrls(discoveredUrls);

      log.info(`Links discovered: ${config.startUrl}, found ${uniqueUrls.length} URLs`);

      return uniqueUrls;
    } catch (error) {
      log.error(`Failed to discover links: ${config.startUrl}`, error);
      throw error;
    }
  }

  /**
   * 创建递归爬取任务
   */
  async createRecursiveTask(config: RecursiveConfig, urls: string[]): Promise<string> {
    if (urls.length === 0) {
      throw new Error('No URLs discovered');
    }

    if (urls.length > 500) {
      throw new Error('Discovered URLs exceed maximum limit of 500 pages');
    }

    // 创建任务
    const taskId = randomUUID();
    const task: CrawlTask = {
      taskId,
      mode: 'recursive',
      status: 'pending',
      currentIndex: 0,
      totalUrls: urls.length,
      urls,
      authProfileId: config.authProfileId,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    crawlerDbService.createTask(task);
    this.activeTasks.set(taskId, task);

    log.info(`Recursive task created: ${taskId}, URLs: ${urls.length}`);

    // 异步开始爬取（复用站点地图爬取逻辑）
    setImmediate(() => this.executeSitemapTask(taskId));

    return taskId;
  }

  /**
   * ===== 任务管理 =====
   */

  /**
   * 获取任务详情
   */
  getTask(taskId: string): CrawlTask | null {
    return crawlerDbService.getTask(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(status?: TaskStatus): CrawlTask[] {
    return crawlerDbService.getAllTasks(status);
  }

  /**
   * 暂停任务
   */
  pauseTask(taskId: string): void {
    this.pauseSignals.set(taskId, true);
    log.info(`Task pause signal sent: ${taskId}`);
  }

  /**
   * 恢复任务
   */
  async resumeTask(taskId: string): Promise<void> {
    this.pauseSignals.delete(taskId);
    const task = crawlerDbService.getTask(taskId);

    if (task && task.status === 'paused') {
      // 从配置中重新解析 URL 列表
      const config = task.config as SitemapConfig;
      let urls: string[] = [];

      if (config.urls) {
        urls = config.urls;
      } else if (config.sitemapUrl) {
        // 重新解析 Sitemap
        try {
          urls = await this.parseSitemap(config);
        } catch (error) {
          log.error(`Failed to re-parse sitemap for task ${taskId}`, error);
          return;
        }
      }

      // 重建任务对象并放入 activeTasks
      const fullTask: CrawlTask = {
        ...task,
        urls,
      };

      this.activeTasks.set(taskId, fullTask);

      // 恢复执行
      if (task.mode === 'sitemap') {
        setImmediate(() => this.executeSitemapTask(taskId));
      } else if (task.mode === 'recursive') {
        setImmediate(() => this.executeSitemapTask(taskId));
      }

      log.info(`Task resumed: ${taskId}`);
    }
  }

  /**
   * 终止任务
   */
  terminateTask(taskId: string): void {
    this.terminateSignals.set(taskId, true);
    log.info(`Task terminate signal sent: ${taskId}`);
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): void {
    this.pauseSignals.delete(taskId);
    this.terminateSignals.delete(taskId);
    this.activeTasks.delete(taskId);
    crawlerDbService.deleteTask(taskId);
    log.info(`Task deleted: ${taskId}`);
  }

  /**
   * ===== 导入管理 =====
   */

  /**
   * 批量导入爬取结果
   */
  async batchImport(request: BatchImportRequest): Promise<BatchImportResponse> {
    const results = crawlerDbService.getTaskResults(request.taskId);

    let imported = 0;
    let failed = 0;
    let skipped = 0;
    const documentIds: string[] = [];

    for (const item of request.items) {
      if (!item.selected) {
        skipped++;
        continue;
      }

      const result = results.find((r) => r.resultId === item.resultId);
      if (!result || result.status !== 'success' || !result.content) {
        skipped++;
        continue;
      }

      try {
        // 合并标签
        const tags = [...(item.tags || []), ...(request.batchTags || [])];

        // 创建笔记
        const note = await notesService.createNote({
          title: item.title || result.title || 'Untitled',
          content: result.content,
          tags,
        });

        // 标记为已导入
        crawlerDbService.updateResultStatus(result.resultId, 'success', result.content, result.title);

        // 更新 URL 索引
        crawlerDbService.upsertUrlIndex(result.url, note.id);

        imported++;
        documentIds.push(note.id);
      } catch (error) {
        log.error(`Failed to import ${result.url}`, error);
        failed++;
      }
    }

    log.info(
      `Batch import completed: task=${request.taskId}, imported=${imported}, failed=${failed}, skipped=${skipped}`
    );

    return {
      imported,
      failed,
      skipped,
      documentIds,
    };
  }

  /**
   * ===== 统计信息 =====
   */

  /**
   * 获取爬取统计
   */
  getStats(): CrawlStats {
    const allTasks = this.getAllTasks();

    const totalTasks = allTasks.length;
    const runningTasks = allTasks.filter((t) => t.status === 'running').length;
    const completedTasks = allTasks.filter((t) => t.status === 'completed').length;
    const failedTasks = allTasks.filter((t) => t.status === 'failed').length;

    const totalCrawled = completedTasks;
    const successRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

    return {
      totalTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      totalCrawled,
      successRate,
    };
  }

  /**
   * ===== 辅助方法 =====
   */

  /**
   * 创建浏览器上下文（带认证）
   */
  private async createContext(authProfileId: string | undefined, url: string): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // 应用认证
    if (authProfileId) {
      await authSessionManagerService.applyAuthToContext(context, authProfileId, url);
    }

    return context;
  }

  /**
   * 创建检查点
   */
  private createCheckpoint(task: CrawlTask): import('../../shared/types/crawler.js').TaskCheckpoint {
    return {
      taskId: task.taskId,
      urlIndex: task.currentIndex,
      checkpointData: {
        completedUrls: [],
        failedUrls: [],
      },
      updatedAt: new Date(),
    };
  }

  /**
   * 强制 GC
   */
  private async forceGc(): Promise<void> {
    if (global.gc) {
      global.gc();
      log.debug('GC forced');
    }
  }

  /**
   * 休眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.activeTasks.clear();
    this.pauseSignals.clear();
    this.terminateSignals.clear();

    log.info('Enhanced crawler service closed');
  }
}

// 导出单例
export const crawlerEnhancedService = new CrawlerEnhancedService();
