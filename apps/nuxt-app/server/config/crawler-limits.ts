/**
 * 爬虫限制配置
 */

export const CRAWLER_LIMITS = {
  // 批量爬取相关
  BATCH_CONCURRENCY: 3,          // 批量爬取并发数
  MAX_BATCH_LINKS: 500,          // 批量爬取最大链接数
  MAX_IN_MEMORY_RESULTS: 100,    // 内存中保存的最大结果数量

  // 页面加载相关
  PAGE_LOAD_TIMEOUT: 30000,      // 页面加载超时 (30秒)
  NETWORK_IDLE_TIMEOUT: 5000,    // networkidle 超时

  // 重试相关
  MAX_RETRY_ATTEMPTS: 2,         // 最大重试次数
  RETRY_DELAY: 1000,             // 重试延迟 (1秒)

  // WebSocket 广播节流
  BROADCAST_THROTTLE: 500,       // 广播节流时间 (500ms)

  // XPath 验证
  MAX_XPATH_LENGTH: 500,         // XPath 最大长度
  MAX_XPATH_DEPTH: 10,           // XPath 最大嵌套深度

  // URL 验证
  MAX_URL_LENGTH: 2048,          // URL 最大长度

  // 任务清理
  TASK_CLEANUP_INTERVAL: 300000, // 任务清理间隔 (5分钟)
  MAX_TASK_AGE: 3600000,         // 最大任务年龄 (1小时)
} as const;
