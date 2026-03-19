import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  LogLevel,
  LogSystem,
  LoggerConfig,
  LogMeta,
  HttpInfo,
  ErrorInfo,
} from '../types/logger.js';

/**
 * 日志目录根路径
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 检测是开发环境（src）还是生产环境（dist）
const isDev = __dirname.includes('src');
const levelsUp = isDev ? 3 : 4;

let currentDir = __dirname;
for (let i = 0; i < levelsUp; i++) {
  currentDir = path.dirname(currentDir);
}
const LOGS_DIR = path.join(currentDir, 'logs');

/**
 * 默认服务配置
 */
const DEFAULT_SERVICE_NAME = 'local-rag';

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
 * 获取日志级别对应的颜色
 */
function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    error: '\x1b[31m', // 红色
    warn: '\x1b[33m',  // 黄色
    info: '\x1b[36m',  // 青色
    http: '\x1b[35m',  // 紫色
    debug: '\x1b[90m', // 灰色
  };
  return colors[level] || '\x1b[0m';
}

const RESET_COLOR = '\x1b[0m';

/**
 * 格式化人类可读时间
 */
function formatReadableTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * 格式化 ISO 8601 时间戳
 */
function formatISOTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * ECS 标准控制台格式 - 人类可读 + 结构化
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf((info) => {
    const {
      level,
      message,
      timestamp,
      service,
      system,
      module,
      host,
      pid,
      requestId,
      traceId,
      http,
      error,
      ...otherMeta
    } = info as any;

    const color = getLevelColor(level);
    const date = new Date(timestamp);

    // 时间信息
    const readableTime = formatReadableTime(date);

    // 模块信息
    const moduleStr = module ? `[${module}]` : '';
    const requestStr = requestId ? ` [req:${requestId.slice(0, 8)}]` : '';

    // 元数据格式化
    const metaParts: string[] = [];

    if (http) {
      const httpParts = [
        http.method,
        http.path,
        http.status !== undefined && `status=${http.status}`,
        http.duration !== undefined && `${http.duration}ms`,
      ].filter(Boolean).join(' ');
      if (httpParts) metaParts.push(`HTTP: ${httpParts}`);
    }

    if (error) {
      metaParts.push(`error: ${error.message}`);
    }

    const otherMetaStr = Object.keys(otherMeta).length > 0
      ? ` ${JSON.stringify(otherMeta)}`
      : '';

    const metaStr = metaParts.length > 0
      ? ` | ${metaParts.join(' | ')}`
      : '';

    // 输出格式：人类可读时间 + 结构化字段
    return `${color}[${readableTime}]${RESET_COLOR} [${level.toUpperCase()}] [${service}]${moduleStr}${requestStr} ${message}${metaStr}${otherMetaStr}`;
  })
);

/**
 * ECS 标准文件格式 - JSON
 */
const ecsFileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format((info) => {
    const date = new Date(info.timestamp as number);

    // ECS 标准字段
    const ecsInfo: any = {
      '@timestamp': formatISOTimestamp(date),
      'readableTime': formatReadableTime(date),
      'level': info.level,
      'message': info.message,
      'service': info.service || DEFAULT_SERVICE_NAME,
      'system': info.system,
      'module': info.module,
      'host': info.host || os.hostname(),
      'pid': info.pid || process.pid,
    };

    // 可选的追踪字段
    if (info.traceId) ecsInfo.traceId = info.traceId;
    if (info.requestId) ecsInfo.requestId = info.requestId;

    // HTTP 请求信息
    if (info.http) {
      ecsInfo.http = info.http;
    }

    // 错误信息
    if (info.error) {
      ecsInfo.error = info.error;
    }

    // 其他自定义字段
    Object.keys(info).forEach(key => {
      if (!['timestamp', 'level', 'message', 'service', 'system', 'module', 'host', 'pid', 'traceId', 'requestId', 'http', 'error'].includes(key)) {
        ecsInfo[key] = info[key];
      }
    });

    return ecsInfo;
  })(),
  winston.format.json()
);

/**
 * 创建日志传输器
 */
function createTransports(system: LogSystem, module?: string): winston.transport[] {
  ensureLogsDir(system);

  const transports: winston.transport[] = [];

  // 控制台输出 - 人类可读格式
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
      format: ecsFileFormat,
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
      format: ecsFileFormat,
      maxSize: '20m',
      maxFiles: '3d',
      auditFile: path.join(LOGS_DIR, system, '.audit-combined.json'),
    })
  );

  // 模块专用日志文件
  if (module) {
    const sanitizedModule = module.replace(/[^a-zA-Z0-9-_]/g, '_');
    transports.push(
      new DailyRotateFile({
        filename: path.join(LOGS_DIR, system, `${sanitizedModule}-%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        format: ecsFileFormat,
        maxSize: '20m',
        maxFiles: '3d',
        auditFile: path.join(LOGS_DIR, system, `.audit-${sanitizedModule}.json`),
      })
    );
  }

  return transports;
}

/**
 * Logger 类 - ECS 标准实现
 */
export class Logger {
  private winstonLogger: winston.Logger;
  private system: LogSystem;
  private module?: string;
  private service: string;
  private host: string;
  private pid: number;

  constructor(config: LoggerConfig) {
    this.system = config.system;
    this.module = config.module;
    this.service = config.service?.name || `${DEFAULT_SERVICE_NAME}-${this.system}`;
    this.host = os.hostname();
    this.pid = process.pid;

    // 创建 winston logger
    this.winstonLogger = winston.createLogger({
      level: config.level || LogLevel.INFO,
      defaultMeta: {
        system: this.system,
        module: this.module,
        service: this.service,
        host: this.host,
        pid: this.pid,
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
    const errorMeta: LogMeta = {
      ...meta,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        } as ErrorInfo,
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
  http(message: string, httpInfo?: HttpInfo, meta?: LogMeta): void {
    const httpMeta: LogMeta = {
      ...meta,
      ...(httpInfo && { http: httpInfo }),
    };
    this.winstonLogger.info(message, httpMeta);
  }

  /**
   * 创建带有追踪 ID 的子日志器
   */
  withTrace(traceId: string): Logger {
    const child = new Logger({
      system: this.system,
      module: this.module,
    });
    child.winstonLogger.defaultMeta = {
      ...this.winstonLogger.defaultMeta,
      traceId,
    };
    return child;
  }

  /**
   * 创建带有请求 ID 的子日志器
   */
  withRequest(requestId: string): Logger {
    const child = new Logger({
      system: this.system,
      module: this.module,
    });
    child.winstonLogger.defaultMeta = {
      ...this.winstonLogger.defaultMeta,
      requestId,
    };
    return child;
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
 */
export function createLogger(
  system: LogSystem,
  module?: string,
  config?: Partial<LoggerConfig>
): Logger {
  const cacheKey = getCacheKey(system, module);

  if (!loggerCache.has(cacheKey)) {
    loggerCache.set(
      cacheKey,
      new Logger({
        system,
        module,
        ...config,
      })
    );
  }

  return loggerCache.get(cacheKey)!;
}

/**
 * 清除缓存的日志器实例
 */
export function clearLoggerCache(): void {
  loggerCache.clear();
}
