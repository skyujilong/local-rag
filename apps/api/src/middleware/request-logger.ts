import { Request, Response, NextFunction } from 'express';
import { createLogger, LogSystem, type HttpInfo } from '@local-rag/shared';
import { randomUUID } from 'crypto';

const logger = createLogger(LogSystem.API, 'request');

/**
 * 生成请求 ID
 */
function generateRequestId(): string {
  return randomUUID();
}

/**
 * 请求日志中间件 - ECS 标准
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // 生成请求 ID 并添加到请求对象
  const requestId = generateRequestId();
  (req as any).requestId = requestId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // ECS 标准的 HTTP 信息
    const httpInfo: HttpInfo = {
      method: req.method,
      path: req.path,
      status,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId,
    };

    // 使用 http 方法记录，传入结构化的 HTTP 信息
    logger.http(`${req.method} ${req.path}`, httpInfo);
  });

  next();
}
