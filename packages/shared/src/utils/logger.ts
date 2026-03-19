import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { LogLevel, LogSystem, LoggerConfig, LogMeta } from '../types/logger.js';

/**
 * 日志目录根路径
 * 计算从 dist/utils 向上到 workspace 根目录
 * packages/shared/dist/utils -> packages/shared/dist -> packages/shared -> packages -> workspace_root
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检测是开发环境（src）还是生产环境（dist）
const isDev = __dirname.includes('src');
// 如果是 src，向上 3 级到 local-rag；如果是 dist，向上 4 级
const levelsUp = isDev ? 3 : 4;

let currentDir = __dirname;
for (let i = 0; i < levelsUp; i++) {
  currentDir = path.dirname(currentDir);
}
const LOGS_DIR = path.join(currentDir, 'logs');

/**
 * 确保日志目录存在
 */
function ensureLogsDir(system: LogSystem): void {
  const systemDir = path.join(LOGS_DIR, system);
  if (!fs.existsSync(systemDir)) {
    fs.mkdirSync(systemDir, { recursive: true });
  }
}

/**
 * 获取日志级别对应的 winston 格式颜色
 */
function getColorizedLevel(level: string): string {
  const colors: Record<string, string> = {
    error: '\x1b[31m', // 红色
    warn: '\x1b[33m',  // 黄色
    info: '\x1b[36m',  // 青色
    http: '\x1b[35m',  // 紫色
    debug: '\x1b[90m', // 灰色
  };
  return colors[level] || '\x1b[0m';
}

/**
 * 重置颜色
 */
const RESET_COLOR = '\x1b[0m';

/**
 * 自定义控制台格式
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { level, message, timestamp, system, module, ...meta } = info as any;
    const color = getColorizedLevel(level);
    const moduleStr = module ? `[${module}]` : '';
    const systemStr = system ? String(system).toUpperCase() : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${color}[${timestamp}]${RESET_COLOR} [${systemStr}]${moduleStr} ${level}: ${message}${metaStr}`;
  })
);

/**
 * 自定义文件格式（JSON）
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

/**
 * 创建日志传输器
 */
function createTransports(system: LogSystem, module?: string): winston.transport[] {
  ensureLogsDir(system);

  const transports: winston.transport[] = [];

  // 控制台输出
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );

  // 错误日志文件（按天轮转）
  transports.push(
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, system, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '3d',
      auditFile: path.join(LOGS_DIR, system, '.audit-error.json'),
    })
  );

  // 组合日志文件（按天轮转）
  transports.push(
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, system, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: fileFormat,
      maxSize: '20m',
      maxFiles: '3d',
      auditFile: path.join(LOGS_DIR, system, '.audit-combined.json'),
    })
  );

  // 模块专用日志文件（如果有模块名）
  if (module) {
    const sanitizedModule = module.replace(/[^a-zA-Z0-9-_]/g, '_');
    transports.push(
      new DailyRotateFile({
        filename: path.join(LOGS_DIR, system, `${sanitizedModule}-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        format: fileFormat,
        maxSize: '20m',
        maxFiles: '3d',
        auditFile: path.join(LOGS_DIR, system, `.audit-${sanitizedModule}.json`),
      })
    );
  }

  return transports;
}

/**
 * Logger 类
 */
export class Logger {
  private winstonLogger: winston.Logger;
  private system: LogSystem;
  private module?: string;

  constructor(config: LoggerConfig) {
    this.system = config.system;
    this.module = config.module;

    // 创建 winston logger
    this.winstonLogger = winston.createLogger({
      level: config.level || LogLevel.INFO,
      defaultMeta: {
        system: this.system,
        module: this.module,
      },
      transports: createTransports(this.system, this.module),
    });
  }

  /**
   * 记录信息级别日志
   */
  info(message: string, meta?: LogMeta): void {
    this.winstonLogger.info(message, meta);
  }

  /**
   * 记录错误级别日志
   */
  error(message: string, error?: Error, meta?: LogMeta): void {
    const errorMeta = {
      ...meta,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      }),
    };
    this.winstonLogger.error(message, errorMeta);
  }

  /**
   * 记录警告级别日志
   */
  warn(message: string, meta?: LogMeta): void {
    this.winstonLogger.warn(message, meta);
  }

  /**
   * 记录调试级别日志
   */
  debug(message: string, meta?: LogMeta): void {
    this.winstonLogger.debug(message, meta);
  }

  /**
   * 记录 HTTP 请求日志
   */
  http(message: string, meta?: LogMeta): void {
    this.winstonLogger.http(message, meta);
  }

  /**
   * 创建子日志器（继承当前配置）
   */
  child(module: string): Logger {
    return new Logger({
      system: this.system,
      module: this.module ? `${this.module}:${module}` : module,
    });
  }
}

/**
 * 日志器实例缓存
 */
const loggerCache = new Map<string, Logger>();

/**
 * 生成缓存键
 */
function getCacheKey(system: LogSystem, module?: string): string {
  return module ? `${system}:${module}` : system;
}

/**
 * 创建日志器（工厂函数）
 * @param system 日志系统标识
 * @param module 模块名称
 * @returns Logger 实例
 */
export function createLogger(system: LogSystem, module?: string): Logger {
  const key = getCacheKey(system, module);

  if (!loggerCache.has(key)) {
    loggerCache.set(key, new Logger({ system, module }));
  }

  return loggerCache.get(key)!;
}

/**
 * 清除缓存的日志器实例
 */
export function clearLoggerCache(): void {
  loggerCache.clear();
}
