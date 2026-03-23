/**
 * 批量爬取辅助函数
 */
import type { Page } from 'playwright';
import { createLogger, LogSystem } from '@local-rag/shared';
import { extractContentByXPath, generateMarkdown, parseContent } from './crawler-service.js';
import { validateCrawlUrl } from '../utils/url-validator.js';
import { CRAWLER_LIMITS } from '../config/crawler-limits.js';
import type { BatchCrawlResult } from '@local-rag/shared/types';

const logger = createLogger(LogSystem.API, 'batch-utils');

/**
 * 使用 XPath 提取链接列表
 */
export async function extractLinksByXPath(
  page: Page,
  xpath: string,
  maxLinks: number,
  baseUrl?: string
): Promise<string[]> {
  try {
    const elements = await page.locator(`xpath=${xpath}`).all();
    logger.info('提取到链接元素', { count: elements.length, maxLinks });

    const links: string[] = [];
    const invalidLinks: Array<{ url: string; error: string }> = [];
    const currentUrl = baseUrl || page.url();

    for (const element of elements.slice(0, maxLinks)) {
      try {
        const href = await element.getAttribute('href');
        if (href) {
          // 验证 URL
          const validationResult = validateCrawlUrl(href, currentUrl, {
            allowPrivateIP: false,
          });

          if (validationResult.valid && validationResult.sanitizedUrl) {
            links.push(validationResult.sanitizedUrl);
          } else {
            invalidLinks.push({ url: href, error: validationResult.error || '无效的 URL' });
            logger.debug('跳过无效链接', { url: href, error: validationResult.error });
          }
        }
      } catch (error) {
        logger.debug('提取链接失败', {
          error: error instanceof Error ? {
            message: error.message,
            name: error.name,
          } : { message: String(error) }
        });
      }
    }

    if (invalidLinks.length > 0) {
      logger.info('部分链接被过滤', {
        total: elements.length,
        valid: links.length,
        invalid: invalidLinks.length,
        samples: invalidLinks.slice(0, 3),
      });
    }

    logger.info('链接提取完成', { total: links.length });
    return links;
  } catch (error) {
    throw new Error(`链接提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 错误类型枚举
 */
export enum CrawlErrorType {
  TIMEOUT = 'timeout',
  NOT_FOUND = 'not_found',
  FORBIDDEN = 'forbidden',
  SERVER_ERROR = 'server_error',
  NETWORK_ERROR = 'network_error',
  XPATH_ERROR = 'xpath_error',
  UNKNOWN = 'unknown',
}

/**
 * 从错误中提取错误类型
 */
function getErrorType(error: Error | string): CrawlErrorType {
  const message = typeof error === 'string' ? error : error.message;

  if (message.includes('timeout') || message.includes('Timeout')) {
    return CrawlErrorType.TIMEOUT;
  }
  if (message.includes('404') || message.includes('Not Found')) {
    return CrawlErrorType.NOT_FOUND;
  }
  if (message.includes('403') || message.includes('Forbidden')) {
    return CrawlErrorType.FORBIDDEN;
  }
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return CrawlErrorType.SERVER_ERROR;
  }
  if (message.includes('ECONNREFUSED') || message.includes('network')) {
    return CrawlErrorType.NETWORK_ERROR;
  }
  if (message.includes('XPath') || message.includes('xpath')) {
    return CrawlErrorType.XPATH_ERROR;
  }

  return CrawlErrorType.UNKNOWN;
}

/**
 * 获取用户友好的错误消息
 */
function getErrorMessage(errorType: CrawlErrorType, originalMessage: string): string {
  const messages = {
    [CrawlErrorType.TIMEOUT]: '请求超时',
    [CrawlErrorType.NOT_FOUND]: '页面不存在 (404)',
    [CrawlErrorType.FORBIDDEN]: '访问被拒绝 (403)',
    [CrawlErrorType.SERVER_ERROR]: '服务器错误',
    [CrawlErrorType.NETWORK_ERROR]: '网络错误',
    [CrawlErrorType.XPATH_ERROR]: 'XPath 提取失败',
    [CrawlErrorType.UNKNOWN]: '未知错误',
  };

  return messages[errorType] || '未知错误';
}

/**
 * 爬取单个页面（带重试）
 */
export async function crawlSinglePage(
  page: Page,
  url: string,
  contentXPath?: string,
  retries: number = CRAWLER_LIMITS.MAX_RETRY_ATTEMPTS
): Promise<{ url: string; title: string; markdown: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      logger.info('开始爬取单个页面', {
        url,
        hasContentXPath: !!contentXPath,
        attempt: attempt + 1,
        maxRetries: retries + 1,
      });

      // 导航到目标页面
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: CRAWLER_LIMITS.PAGE_LOAD_TIMEOUT
      });
      logger.info('页面已加载', { url: page.url() });

      let html: string;
      let title: string;

      if (contentXPath) {
        // 使用 XPath 提取内容
        const result = await extractContentByXPath(page, contentXPath);
        html = result.html;
        title = result.title;
        logger.info('XPath 提取完成', { title, htmlLength: html.length });
      } else {
        // 获取整个页面内容
        html = await page.content();
        logger.info('页面内容已获取', { htmlLength: html.length });

        // 解析内容获取标题
        const content = parseContent(html, url);
        title = content.title;
        logger.info('内容解析完成', { title });
      }

      // 使用 Turndown 将 HTML 转换为 Markdown
      const markdown = generateMarkdown(html, title, url);
      logger.info('Markdown 已生成', { markdownLength: markdown.length });

      return { url, title, markdown };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorType = getErrorType(lastError);
      const errorMessage = getErrorMessage(errorType, lastError.message);

      logger.warn('页面爬取失败', {
        url,
        attempt: attempt + 1,
        errorType,
        errorMessage,
        willRetry: attempt < retries,
      });

      // 最后一次尝试失败，抛出错误
      if (attempt >= retries) {
        const enhancedError = new Error(errorMessage);
        (enhancedError as any).originalError = lastError;
        (enhancedError as any).errorType = errorType;
        throw enhancedError;
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, CRAWLER_LIMITS.RETRY_DELAY));
    }
  }

  // 理论上不会到这里，但 TypeScript 需要返回
  throw lastError || new Error('爬取失败');
}

/**
 * 合并多个 Markdown
 */
export function mergeMarkdown(results: BatchCrawlResult[]): string {
  const markdowns: string[] = [];

  for (const result of results) {
    if (result.status === 'success' && result.markdown && result.title) {
      markdowns.push(`## ${result.title}\n\n> 来源: ${result.url}\n\n${result.markdown}\n\n---\n\n`);
    }
  }

  if (markdowns.length === 0) {
    return '# 批量爬取结果\n\n没有成功爬取到任何内容。';
  }

  return `# 批量爬取结果\n\n共爬取 ${markdowns.length} 个页面。\n\n---\n\n` + markdowns.join('');
}
