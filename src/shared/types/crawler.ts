/**
 * Web Crawler 类型定义
 *
 * 定义爬虫功能相关的所有类型，包括任务管理、认证配置、爬取模式等
 */

/**
 * 爬取模式枚举
 */
export enum CrawlMode {
  SINGLE = 'single',       // 单页面爬取
  SITEMAP = 'sitemap',     // 站点地图爬取
  RECURSIVE = 'recursive', // 递归爬取
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  AUTH_EXPIRED = 'auth_expired', // 认证过期
}

/**
 * 认证类型枚举
 */
export enum AuthType {
  COOKIE = 'cookie',   // Cookie 注入
  HEADER = 'header',   // HTTP Header 注入
  BROWSER = 'browser', // 浏览器登录
}

/**
 * 认证配置
 */
export interface AuthProfile {
  id: string;
  domain: string;
  type: AuthType;
  name: string;
  encryptedData: string; // 加密存储的认证数据
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
}

/**
 * Cookie 认证数据（加密前）
 */
export interface CookieAuthData {
  cookies: string; // Cookie 字符串，格式：key1=value1; key2=value2
}

/**
 * Header 认证数据（加密前）
 */
export interface HeaderAuthData {
  headerName: string; // 例如：Authorization
  headerValue: string; // 例如：Bearer xxx
}

/**
 * 浏览器登录认证数据（加密前）
 */
export interface BrowserAuthData {
  cookies: Array<{ name: string; value: string; domain: string; path: string }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

/**
 * 单页面爬取配置
 */
export interface SinglePageConfig {
  url: string;
  authProfileId?: string;
  timeout?: number;
  waitForSelector?: string;
  cssSelector?: string; // CSS 选择器提取特定区域
}

/**
 * 站点地图爬取配置
 */
export interface SitemapConfig {
  sitemapUrl: string;
  urls?: string[]; // 解析后的 URL 列表
  authProfileId?: string;
  timeout?: number;
  interval?: number; // 请求间隔（秒），默认 1 秒，最小 1 秒
}

/**
 * 递归爬取配置
 */
export interface RecursiveConfig {
  startUrl: string;
  maxDepth: number; // 递归深度（1-3），默认 2
  urlFilter?: {
    include?: string[]; // 包含模式
    exclude?: string[]; // 排除模式
  };
  authProfileId?: string;
  timeout?: number;
  interval?: number;
}

/**
 * 爬取任务
 */
export interface CrawlTask {
  taskId: string;
  mode: CrawlMode;
  status: TaskStatus;
  currentIndex: number; // 当前爬取索引
  totalUrls: number;
  urls: string[]; // 待爬取 URL 列表
  authProfileId?: string;
  config: SinglePageConfig | SitemapConfig | RecursiveConfig;
  createdAt: Date;
  updatedAt: Date;
  pausedAt?: Date;
  error?: string;
}

/**
 * 爬取结果
 */
export interface CrawlResult {
  resultId: string;
  taskId: string;
  url: string;
  status: 'success' | 'failed' | 'pending' | 'auth_expired';
  title?: string;
  content?: string;
  wordCount?: number;
  qualityScore?: number; // 质量评分 0-1
  importedAt?: Date;
  retryCount: number;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * 批量导入确认项
 */
export interface ImportConfirmItem {
  resultId: string;
  url: string;
  title?: string;
  content?: string;
  wordCount?: number;
  qualityScore?: number;
  selected: boolean;
  alreadyImported?: boolean; // 是否已导入过
  originalImportDate?: Date; // 首次导入日期
  tags?: string[];
}

/**
 * 批量导入请求
 */
export interface BatchImportRequest {
  taskId: string;
  items: ImportConfirmItem[];
  batchTags?: string[]; // 批量设置的标签
}

/**
 * 批量导入响应
 */
export interface BatchImportResponse {
  imported: number;
  failed: number;
  skipped: number;
  documentIds: string[];
}

/**
 * URL 标准化选项
 */
export interface UrlNormalizeOptions {
  removeHash: boolean; // 移除 hash
  removeTrackingParams: boolean; // 移除追踪参数（如 utm_*）
  removeTrailingSlash: boolean; // 移除尾部斜杠
}

/**
 * 内容清洗结果
 */
export interface ContentCleanResult {
  content: string;
  qualityScore: number; // 0-1，正文占比
  wordCount: number;
  title: string;
}

/**
 * 浏览器登录会话
 */
export interface BrowserLoginSession {
  sessionId: string;
  url: string;
  status: 'launching' | 'launched' | 'completed' | 'failed' | 'cancelled';
  browserContextId?: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * 浏览器登录事件（SSE）
 */
export interface BrowserLoginEvent {
  event: 'browser_launched' | 'login_detected' | 'timeout' | 'error';
  data: {
    sessionId: string;
    message: string;
    browserContextId?: string;
    timestamp: Date;
  };
}

/**
 * 检查点数据（用于断点续爬）
 */
export interface CheckpointData {
  completedUrls: string[]; // 已完成的 URL
  failedUrls: Array<{ url: string; error: string; retryCount: number }>; // 失败的 URL
  currentUrl?: string; // 当前正在爬取的 URL
}

/**
 * 任务检查点
 */
export interface TaskCheckpoint {
  taskId: string;
  urlIndex: number;
  checkpointData: CheckpointData;
  updatedAt: Date;
}

/**
 * URL 索引项（用于重复检测）
 */
export interface UrlIndexItem {
  url: string; // 标准化后的 URL
  noteId?: string; // 关联的笔记 ID
  firstSeenAt: Date;
  lastSeenAt: Date;
  crawlCount: number; // 爬取次数
}

/**
 * 爬取统计信息
 */
export interface CrawlStats {
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalCrawled: number;
  successRate: number; // 成功率 0-1
}
