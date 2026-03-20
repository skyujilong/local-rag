/**
 * 并发控制器 - 管理爬虫任务的并发执行
 */

import PQueue from 'p-queue';
import { chromium, type Browser } from 'playwright';
import { createLogger, LogSystem } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'concurrency-controller');

// 并发配置
const CONCURRENCY_CONFIG = {
  maxConcurrentTasks: 2,           // 最大并发任务数
  maxConcurrentBrowsers: 1,        // 每个浏览器最大并发任务数
  taskTimeout: 10 * 60 * 1000,     // 任务超时时间（10分钟）
  cleanupInterval: 5 * 60 * 1000,  // 清理间隔（5分钟）
  maxIdleTime: 5 * 60 * 1000,      // 最大空闲时间（5分钟）
};

// 任务队列
export const taskQueue = new PQueue({
  concurrency: CONCURRENCY_CONFIG.maxConcurrentTasks,
  timeout: CONCURRENCY_CONFIG.taskTimeout,
});

// 浏览器实例池
export interface BrowserInstance {
  id: string;
  browser: Browser;
  createdAt: Date;
  lastUsedAt: Date;
  taskCount: number;
}

const browserPool = new Map<string, BrowserInstance>();

/**
 * 资源管理器
 */
export class ResourceManager {
  private static instance: ResourceManager;
  private cleanupTimer?: NodeJS.Timeout;

  private constructor() {}

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  /**
   * 获取或创建浏览器实例
   */
  async getBrowser(): Promise<BrowserInstance> {
    // 检查是否有可用的浏览器实例
    for (const [id, instance] of browserPool.entries()) {
      if (instance.taskCount < CONCURRENCY_CONFIG.maxConcurrentBrowsers) {
        instance.lastUsedAt = new Date();
        instance.taskCount++;
        logger.info('复用浏览器实例', { browserId: id, taskCount: instance.taskCount });
        return instance;
      }
    }

    // 创建新的浏览器实例
    const browser = await chromium.launch({ headless: false });
    const instance: BrowserInstance = {
      id: `browser_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      browser,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      taskCount: 1,
    };

    browserPool.set(instance.id, instance);
    logger.info('创建新浏览器实例', { browserId: instance.id, poolSize: browserPool.size });

    return instance;
  }

  /**
   * 释放浏览器实例
   */
  async releaseBrowser(browserId: string): Promise<void> {
    const instance = browserPool.get(browserId);
    if (!instance) {
      logger.warn('浏览器实例不存在', { browserId });
      return;
    }

    instance.taskCount--;
    instance.lastUsedAt = new Date();

    // 如果没有任务在使用，关闭浏览器
    if (instance.taskCount <= 0) {
      await this.closeBrowser(instance.id);
    } else {
      logger.info('释放浏览器实例', { browserId, taskCount: instance.taskCount });
    }
  }

  /**
   * 关闭浏览器实例
   */
  async closeBrowser(browserId: string): Promise<void> {
    const instance = browserPool.get(browserId);
    if (!instance) {
      return;
    }

    try {
      await instance.browser.close();
      browserPool.delete(browserId);
      logger.info('关闭浏览器实例', { browserId, poolSize: browserPool.size });
    } catch (error) {
      logger.error('关闭浏览器失败', error instanceof Error ? error : new Error(String(error)), { browserId });
      browserPool.delete(browserId);
    }
  }

  /**
   * 清理空闲浏览器实例
   */
  async cleanupIdleBrowsers(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, instance] of browserPool.entries()) {
      const idleTime = now - instance.lastUsedAt.getTime();

      if (idleTime > CONCURRENCY_CONFIG.maxIdleTime && instance.taskCount === 0) {
        await this.closeBrowser(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('清理空闲浏览器完成', { cleanedCount, poolSize: browserPool.size });
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      queueSize: taskQueue.size,
      queuePending: taskQueue.pending,
      poolSize: browserPool.size,
      browsers: Array.from(browserPool.values()).map(b => ({
        id: b.id,
        taskCount: b.taskCount,
        createdAt: b.createdAt,
        lastUsedAt: b.lastUsedAt,
      })),
    };
  }

  /**
   * 清空队列和资源
   */
  async clear(): Promise<void> {
    taskQueue.clear();

    for (const [id] of browserPool.entries()) {
      await this.closeBrowser(id);
    }

    logger.info('清空队列和资源');
  }

  /**
   * 启动定期清理任务
   */
  startCleanupTask(): void {
    if (this.cleanupTimer) {
      return; // 已经启动
    }

    this.cleanupTimer = setInterval(
      () => {
        this.cleanupIdleBrowsers();
      },
      CONCURRENCY_CONFIG.cleanupInterval
    );

    logger.info('启动资源清理任务', {
      interval: `${CONCURRENCY_CONFIG.cleanupInterval / 1000}s`,
      maxIdleTime: `${CONCURRENCY_CONFIG.maxIdleTime / 1000}s`,
    });
  }

  /**
   * 停止清理任务
   */
  stopCleanupTask(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      logger.info('停止资源清理任务');
    }
  }
}

// 启动定期清理任务（在模块加载时自动启动）
ResourceManager.getInstance().startCleanupTask();

// 优雅关闭：进程退出时清理资源
process.on('beforeExit', async () => {
  await ResourceManager.getInstance().clear();
});

process.on('SIGINT', async () => {
  await ResourceManager.getInstance().clear();
});

process.on('SIGTERM', async () => {
  await ResourceManager.getInstance().clear();
});
