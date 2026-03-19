/**
 * 日志级别（符合 ECS 标准）
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
 * 服务配置
 */
export interface ServiceConfig {
  /** 服务名称 */
  name: string;
  /** 服务类型 */
  type: LogSystem;
  /** 服务版本 */
  version?: string;
  /** 环境 */
  environment?: string;
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
  /** 服务配置 */
  service?: ServiceConfig;
}

/**
 * HTTP 请求信息（ECS 标准）
 */
export interface HttpInfo {
  /** 请求方法 */
  method?: string;
  /** 请求路径 */
  path?: string;
  /** 状态码 */
  status?: number;
  /** 请求耗时（毫秒） */
  duration?: number;
  /** 客户端 IP */
  ip?: string;
  /** User Agent */
  userAgent?: string;
  /** 请求 ID */
  requestId?: string;
}

/**
 * 错误信息（ECS 标准）
 */
export interface ErrorInfo {
  /** 错误消息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
  /** 错误名称 */
  name?: string;
  /** 错误代码 */
  code?: string;
}

/**
 * 结构化日志元数据（基于 ECS 标准）
 */
export interface LogMeta {
  /** 机器可读时间戳（ISO 8601）- ECS: @timestamp */
  '@timestamp'?: string;
  /** 人类可读时间戳 */
  readableTime?: string;
  /** 日志级别 - ECS: log.level */
  level?: LogLevel;
  /** 日志消息 - ECS: message */
  message?: string;
  /** 服务名称 - ECS: service.name */
  service?: string;
  /** 服务类型 - ECS: labels.system */
  system?: LogSystem;
  /** 事件模块 - ECS: event.module */
  module?: string;
  /** 主机名 - ECS: host.name */
  host?: string;
  /** 进程 ID - ECS: process.pid */
  pid?: number;
  /** 追踪 ID - ECS: trace.id */
  traceId?: string;
  /** 请求 ID - ECS: transaction.id */
  requestId?: string;
  /** HTTP 请求信息 */
  http?: HttpInfo;
  /** 错误信息 */
  error?: ErrorInfo;
  /** 其他自定义字段 */
  [key: string]: any;
}

/**
 * 日志条目（完整的 ECS 格式）
 */
export interface LogEntry extends LogMeta {
  '@timestamp': string;
  level: LogLevel;
  message: string;
  service: string;
  system: LogSystem;
  module?: string;
  host: string;
  pid: number;
}
