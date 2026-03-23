/**
 * 批量爬取辅助函数
 */
import type { Page } from 'playwright';
import { createLogger, LogSystem } from '@local-rag/shared';
import { extractContentByXPath, generateMarkdown, parseContent } from './crawler-service.js';
import type { BatchCrawlResult } from '@local-rag/shared/types';

const logger = createLogger(LogSystem.API, 'batch-utils');

/**
 * 使用 XPath 提取链接列表
 */
export async function extractLinksByXPath(
  page: Page,
  xpath: string,
  maxLinks: number
): Promise<string[]> {
  try {
    const elements = await page.locator(`xpath=${xpath}`).all();
    logger.info('提取到链接元素', { count: elements.length, maxLinks });

    const links: string[] = [];

    for (const element of elements.slice(0, maxLinks)) {
      try {
        const href = await element.getAttribute('href');
        if (href) {
          // 处理相对 URL
          const absoluteUrl = new URL(href, page.url()).toString();
          links.push(absoluteUrl);
        }
      } catch (error) {
        logger.debug('提取链接失败', {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          } : { message: String(error) }
        });
      }
    }

    logger.info('链接提取完成', { total: links.length });
    return links;
  } catch (error) {
    throw new Error(`链接提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 爬取单个页面
 */
export async function crawlSinglePage(
  page: Page,
  url: string,
  contentXPath?: string
): Promise<{ url: string; title: string; markdown: string }> {
  try {
    logger.info('开始爬取单个页面', { url, hasContentXPath: !!contentXPath });

    // 导航到目标页面
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('单个页面爬取失败', error instanceof Error ? error : new Error(errorMessage), { url });
    throw error;
  }
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
