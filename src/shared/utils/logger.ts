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

// JSON 格式化器：每行一条 JSON，便于机器解析
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console 格式化器：人可读的彩色格式
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, module, stack }) => {
    const moduleStr = module ? `[${module}] ` : '';
    let output = `[${timestamp}] ${level}: ${moduleStr}${message}`;
    if (stack) {
      output += `\n${stack}`;
    }
    return output;
  })
);

// 日志元数据类型
interface LogMetadata {
  module?: string;
  stack?: string;
  url?: string;
  errorName?: string;
  errorMessage?: string;
  errorValue?: string;
  [key: string]: any;
}

// Transport 初始化状态
let transportsInitialized = false;
let initializePromise: Promise<void> | null = null;

// Winston logger 实例 - 先添加临时 Console transport 确保日志不丢失
const winstonLogger = winston.createLogger({
  level: LOG_LEVEL,
  format: jsonFormat,
  transports: [
    // 临时的 Console transport，等文件 transport 初始化后会移除
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

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
        format: jsonFormat,
      });

      // 错误日志 transport (仅 error 级别)
      const errorLogTransport = new DailyRotateFile({
        filename: join(LOG_DIR, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: LOG_MAX_SIZE,
        maxFiles: LOG_ERROR_MAX_FILES,
        format: jsonFormat,
      });

      // 清除所有 transports（包括临时的 Console）
      winstonLogger.clear();

      // 添加文件 transports
      winstonLogger.add(allLogTransport);
      winstonLogger.add(errorLogTransport);

      // 如果需要控制台输出，重新添加
      if (LOG_TO_CONSOLE) {
        const consoleTransport = new winston.transports.Console({
          format: consoleFormat,
        });
        winstonLogger.add(consoleTransport);
      }

      transportsInitialized = true;
      console.log('✅ Winston 日志 transport 初始化完成');
    } catch (error) {
      // 如果 DailyRotateFile 不可用，使用普通文件 transport
      console.warn('⚠️ winston-daily-rotate-file 不可用，使用普通文件 transport');

      const allLogTransport = new winston.transports.File({
        filename: join(LOG_DIR, 'all.log'),
        level: 'debug',
        format: jsonFormat,
      });

      const errorLogTransport = new winston.transports.File({
        filename: join(LOG_DIR, 'error.log'),
        level: 'error',
        format: jsonFormat,
      });

      winstonLogger.clear();
      winstonLogger.add(allLogTransport);
      winstonLogger.add(errorLogTransport);

      if (LOG_TO_CONSOLE) {
        const consoleTransport = new winston.transports.Console({
          format: consoleFormat,
        });
        winstonLogger.add(consoleTransport);
      }

      transportsInitialized = true;
      console.log('✅ Winston 文件日志 transport 初始化完成（fallback 模式）');
    }
  })();

  return initializePromise;
}

// 启动异步初始化
initializeTransports().catch(err => {
  console.error('❌ 初始化 logger transport 失败:', err);
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
      (meta as any).errorName = error.name;
      (meta as any).errorMessage = error.message;
    } else if (error !== undefined) {
      (meta as any).errorValue = String(error);
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

  /**
   * 等待 logger 初始化完成
   */
  async ready(): Promise<void> {
    return initializeTransports();
  }
}

export const logger = new Logger();
