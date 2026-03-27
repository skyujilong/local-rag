/**
 * 日志接收 API 端点
 * 接收来自前端的批量日志
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createLogger, logFrontend } from '../../shared/utils/logger.js';
import type { FrontendLogEntry } from '../../shared/types/index.js';

const log = createLogger('api:logs');

const logsRouter = new Hono();

// 请求体验证 schema
const logEntrySchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  message: z.string().max(1000), // 限制消息长度
  module: z.string().max(100).optional(),
  url: z.string().max(500).optional(),
  stack: z.string().max(5000).optional(),
  userId: z.string().optional(),
});

const batchLogSchema = z.object({
  logs: z.array(logEntrySchema).min(1).max(50), // 降低批量大小限制
});

// 清理日志消息，防止注入攻击
function sanitizeLogMessage(message: string): string {
  return message
    .replace(/[\r\n]+/g, ' ') // 移除换行符
    .replace(/\s+/g, ' ') // 合并多个空格
    .trim()
    .slice(0, 1000); // 限制长度
}

function sanitizeModule(module: string | undefined): string | undefined {
  if (!module) return undefined;
  return module.replace(/[^\w\-:/]/g, '').slice(0, 100);
}

function sanitizeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url, 'http://localhost');
    return parsed.pathname.slice(0, 500);
  } catch {
    return undefined;
  }
}

function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack.replace(/[\r\n]+/g, '\n').slice(0, 5000);
}

// 简单的速率限制 (内存中)
const rateLimiter = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1分钟
const RATE_LIMIT_MAX_REQUESTS = 10; // 降低到 10
const MAX_REQUEST_SIZE = 100 * 1024; // 100KB

// 定期清理速率限制器
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  const keysToDelete: string[] = [];
  rateLimiter.forEach((value, key) => {
    if (now > value.resetTime) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => rateLimiter.delete(key));
  cleaned = keysToDelete.length;
  if (cleaned > 0) {
    log.debug(`清理速率限制器: 移除 ${cleaned} 条记录`);
  }
}, 60000);

// 确保进程退出时清理定时器
process.on('beforeExit', () => clearInterval(cleanupInterval));
process.on('SIGINT', () => clearInterval(cleanupInterval));
process.on('SIGTERM', () => clearInterval(cleanupInterval));

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimiter.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimiter.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

// POST /api/logs - 接收批量日志
logsRouter.post('/', async (c) => {
  try {
    // 检查请求体大小
    const contentLength = c.req.header('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
      return c.json({ error: 'Request body too large (max 100KB)' }, 413);
    }

    // 简单的速率限制
    const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
               c.req.header('x-real-ip') ||
               c.req.header('cf-connecting-ip') ||
               'unknown';
    if (!checkRateLimit(ip)) {
      log.warn(`速率限制触发: ${ip}`);
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const body = await c.req.json();
    const validationResult = batchLogSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json({ error: 'Invalid request format', details: validationResult.error }, 400);
    }

    const { logs } = validationResult.data;

    // 清理并验证日志数据
    const sanitizedLogs: FrontendLogEntry[] = logs.map(log => ({
      level: log.level,
      message: sanitizeLogMessage(log.message),
      module: sanitizeModule(log.module),
      url: sanitizeUrl(log.url),
      stack: sanitizeStack(log.stack),
      userId: log.userId?.slice(0, 100),
    }));

    // 异步写入日志，带错误处理
    setImmediate(() => {
      try {
        for (const log of sanitizedLogs) {
          logFrontend(log.level, log.message, {
            module: log.module,
            url: log.url,
            stack: log.stack,
          });
        }
      } catch (error) {
        log.error('写入日志失败', error);
      }
    });

    return c.json({ success: true, received: sanitizedLogs.length });
  } catch (error) {
    log.error('处理日志请求失败', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { logsRouter };
