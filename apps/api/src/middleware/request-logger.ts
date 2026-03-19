import { Request, Response, NextFunction } from 'express';
import { createLogger, LogSystem } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'request');

/**
 * 请求日志中间件
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // 使用 info 级别记录 HTTP 请求，确保能被文件传输器记录
    logger.info(`${req.method} ${req.path}`, {
      status,
      duration,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  });

  next();
}
