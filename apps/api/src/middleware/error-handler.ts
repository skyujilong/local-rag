import { Request, Response, NextFunction } from 'express';
import { createLogger, LogSystem } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'error');

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

/**
 * 错误处理中间件
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

  logger.error(`${req.method} ${req.path}: ${message}`, err, {
    statusCode,
    code,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details: err.details,
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
