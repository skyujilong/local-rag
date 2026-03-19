import { Request, Response, NextFunction } from 'express';
import { createLogger, LogSystem, type HttpInfo } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'error');

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * 错误处理中间件 - ECS 标准
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || '服务器内部错误';

  // 获取请求 ID
  const requestId = (req as any).requestId;

  // ECS 标准的 HTTP 信息
  const httpInfo: HttpInfo = {
    method: req.method,
    path: req.path,
    status: statusCode,
    ip: req.ip,
    requestId,
  };

  // 记录错误日志，包含错误对象和 HTTP 上下文
  logger.error(
    `${req.method} ${req.path}: ${message}`,
    err,
    {
      http: httpInfo,
      code,
    }
  );

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: err.details,
      requestId,
    },
  });
}

/**
 * 创建 API 错误
 */
export function createError(
  statusCode: number,
  code: string,
  message: string,
  details?: any
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}
