/**
 * 任务调度器
 * 定期清理过期任务和资源
 */

import { createLogger, LogSystem } from '@local-rag/shared';
import { cleanupExpiredTasks, getActiveTasksStats } from './crawler-tasks.js';
import { CRAWLER_LIMITS } from '../config/crawler-limits.js';

const logger = createLogger(LogSystem.API, 'task-scheduler');

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * 启动任务调度器
 */
export function startTaskScheduler(): void {
  if (cleanupInterval) {
    logger.warn('任务调度器已在运行');
    return;
  }

  logger.info('启动任务调度器', {
    cleanupInterval: CRAWLER_LIMITS.TASK_CLEANUP_INTERVAL,
    maxTaskAge: CRAWLER_LIMITS.MAX_TASK_AGE,
  });

  // 立即执行一次清理
  performScheduledCleanup();

  // 定期清理
  cleanupInterval = setInterval(() => {
    performScheduledCleanup();
  }, CRAWLER_LIMITS.TASK_CLEANUP_INTERVAL);

  logger.info('任务调度器已启动');
}

/**
 * 停止任务调度器
 */
export function stopTaskScheduler(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    logger.info('任务调度器已停止');
  }
}

/**
 * 执行计划清理任务
 */
function performScheduledCleanup(): void {
  try {
    // 清理过期任务
    const cleanedCount = cleanupExpiredTasks(CRAWLER_LIMITS.MAX_TASK_AGE);

    // 记录统计信息
    const stats = getActiveTasksStats();
    logger.debug('活跃任务统计', {
      ...stats,
      cleanedCount,
    });

    // 如果活跃任务过多，记录警告
    if (stats.total > 50) {
      logger.warn('活跃任务数量过多', {
        total: stats.total,
        byStatus: stats.byStatus,
        byType: stats.byType,
      });
    }
  } catch (error) {
    logger.error('任务调度器执行失败', error as Error);
  }
}

/**
 * 获取调度器状态
 */
export function getSchedulerStatus(): {
  isRunning: boolean;
  lastCleanup?: Date;
  stats?: ReturnType<typeof getActiveTasksStats>;
} {
  const stats = getActiveTasksStats();

  return {
    isRunning: cleanupInterval !== null,
    stats,
  };
}
