/**
 * 日志级别
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
}

/**
 * 日志系统标识
 */
export enum LogSystem {
  API = 'api',
  WEB = 'web',
  MCP = 'mcp',
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  /** 系统标识 */
  system: LogSystem;
  /** 模块名称（可选） */
  module?: string;
  /** 日志级别 */
  level?: LogLevel;
}

/**
 * 日志元数据
 */
export interface LogMeta {
  /** 时间戳 */
  timestamp?: string;
  /** 系统标识 */
  system?: LogSystem;
  /** 模块名称 */
  module?: string;
  /** 其他自定义字段 */
  [key: string]: any;
}
