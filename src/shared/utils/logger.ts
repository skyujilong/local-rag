/**
 * Winston logger with daily rotation
 */

import * as winston from 'winston';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// 从环境变量读取配置
const LOG_DIR = process.env.LOG_DIR || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_TO_CONSOLE = process.env.LOG_TO_CONSOLE !== 'false';
const LOG_MAX_SIZE = process.env.LOG_MAX_SIZE || '20m';
const LOG_MAX_FILES = process.env.LOG_MAX_FILES || '14d';
const LOG_ERROR_MAX_FILES = process.env.LOG_ERROR_MAX_FILES || '30d';

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

// 自定义格式化器：人可读的文本格式
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module, stack }) => {
    const moduleStr = module ? `[${module}] ` : '';
    const baseMsg = `[${timestamp}] [${level.toUpperCase()}] ${moduleStr}${message}`;
    return stack ? `${baseMsg}\n    ${stack}` : baseMsg;
  })
);

// 日志元数据类型
interface LogMetadata {
  module?: string;
  stack?: string;
  url?: string;
}

// Transport 初始化状态
let transportsInitialized = false;
let initializePromise: Promise<void> | null = null;

/**
 * 初始化 DailyRotateFile transport
 */
async function initializeTransports(): Promise<void> {
  if (transportsInitialized) return;
  if (initializePromise) return initializePromise;

  initializePromise = (async () => {
    try {
      const DailyRotateFileModule = await import('winston-daily-rotate-file');
      // 获取默认导出，处理不同的模块格式
      const DailyRotateFile = (DailyRotateFileModule as any).default || DailyRotateFileModule;

      // 全量日志 transport (debug 级别及以上)
      const allLogTransport = new DailyRotateFile({
        filename: join(LOG_DIR, 'all-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'debug',
        maxSize: LOG_MAX_SIZE,
        maxFiles: LOG_MAX_FILES,
        format: customFormat,
      });

      // 错误日志 transport (仅 error 级别)
      const errorLogTransport = new DailyRotateFile({
        filename: join(LOG_DIR, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: LOG_MAX_SIZE,
        maxFiles: LOG_ERROR_MAX_FILES,
        format: customFormat,
      });

      // 清除现有 transports
      winstonLogger.clear();

      // 添加新的 transports
      winstonLogger.add(allLogTransport);
      winstonLogger.add(errorLogTransport);

      // Console transport (可选)
      if (LOG_TO_CONSOLE) {
        const consoleTransport = new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message }) => {
              return `[${timestamp}] ${level}: ${message}`;
            })
          ),
        });
        winstonLogger.add(consoleTransport);
      }

      transportsInitialized = true;
    } catch (error) {
      // 如果 DailyRotateFile 不可用，使用普通文件 transport
      console.warn('winston-daily-rotate-file 不可用，使用普通文件 transport');

      const allLogTransport = new winston.transports.File({
        filename: join(LOG_DIR, 'all.log'),
        level: 'debug',
        format: customFormat,
      });

      const errorLogTransport = new winston.transports.File({
        filename: join(LOG_DIR, 'error.log'),
        level: 'error',
        format: customFormat,
      });

      winstonLogger.clear();
      winstonLogger.add(allLogTransport);
      winstonLogger.add(errorLogTransport);

      if (LOG_TO_CONSOLE) {
        const consoleTransport = new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message }) => {
              return `[${timestamp}] ${level}: ${message}`;
            })
          ),
        });
        winstonLogger.add(consoleTransport);
      }

      transportsInitialized = true;
    }
  })();

  return initializePromise;
}

// Winston logger 实例
const winstonLogger = winston.createLogger({
  level: LOG_LEVEL,
  format: customFormat,
  // 初始为空，等待异步初始化
  transports: [],
});

// 启动异步初始化
initializeTransports().catch(err => {
  console.error('初始化 logger transport 失败:', err);
});

// 模块前缀映射
const modulePrefixes: Record<string, string> = {
  'api:': 'api',
  'services:': 'services',
  'frontend:': 'frontend',
};

// Logger 类，提供简化的 API
class Logger {
  private getModule(module: string | undefined): string | undefined {
    if (!module) return undefined;
    for (const [prefix, name] of Object.entries(modulePrefixes)) {
      if (module.startsWith(name)) {
        return prefix + module;
      }
    }
    return module;
  }

  debug(message: string, module?: string): void {
    winstonLogger.debug(message, { module: this.getModule(module) });
  }

  info(message: string, module?: string): void {
    winstonLogger.info(message, { module: this.getModule(module) });
  }

  warn(message: string, module?: string): void {
    winstonLogger.warn(message, { module: this.getModule(module) });
  }

  error(message: string, error?: Error | unknown, module?: string): void {
    const meta: LogMetadata = { module: this.getModule(module) };
    if (error instanceof Error) {
      meta.stack = error.stack;
    }
    winstonLogger.error(message, meta);
  }

  // 前端日志专用方法
  logFrontend(level: string, message: string, meta?: {
    module?: string;
    url?: string;
    stack?: string;
  }): void {
    const logMeta: LogMetadata = {};
    if (meta?.module) {
      logMeta.module = 'frontend:' + meta.module;
    }
    if (meta?.url) {
      logMeta.url = meta.url;
    }
    if (meta?.stack) {
      logMeta.stack = meta.stack;
    }
    winstonLogger.log(level.toLowerCase(), message, logMeta);
  }

  setLevel(level: string): void {
    winstonLogger.level = level;
  }
}

export const logger = new Logger();
