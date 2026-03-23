/**
 * 爬虫服务
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { createLogger, LogSystem } from '@local-rag/shared';
import * as SessionManager from './session-manager.js';
import * as DocumentManager from '../services/knowledge-base/document-manager.js';
import * as NoteManager from '../services/notes/note-manager.js';
import { extractDomain } from '@local-rag/shared/utils';
import type { CrawlerSession } from '@local-rag/shared/types';
import { getCrawlerConfig } from '@local-rag/config/crawler';
import { URL } from 'node:url';

const logger = createLogger(LogSystem.API, 'crawler');

// 全局超时配置（5分钟）
const XPATH_INPUT_TIMEOUT = 5 * 60 * 1000;

// 存储活跃的页面实例，用于 XPath 提取
export const activePages = new Map<string, Page>();

// 存储 XPath 等待超时定时器
export const xpathTimeouts = new Map<string, NodeJS.Timeout>();

/**
 * 验证 URL 格式和合法性
 */
function validateUrl(url: string): void {
  try {
    const parsed = new URL(url);
    // 只允许 http 和 https 协议
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`不支持的协议: ${parsed.protocol}`);
    }
  } catch {
    throw new Error(`无效的 URL: ${url}`);
  }
}

/**
 * 创建带会话的浏览器上下文
 */
async function createContextWithSession(domain: string, browser: Browser): Promise<BrowserContext> {
  const config = getCrawlerConfig();
  const context = await browser.newContext({
    viewport: config.browser.viewport,
    userAgent: config.request.userAgent,
  });

  // 加载并应用已保存的会话
  const session = await SessionManager.loadSession(domain);
  if (session) {
    await context.addCookies(session.cookies);
    await context.addInitScript((sessionData: CrawlerSession) => {
      if (sessionData.localStorage) {
        for (const [key, value] of Object.entries(sessionData.localStorage)) {
          localStorage.setItem(key, value as string);
        }
      }
    }, session);
    logger.info('会话已加载到上下文', { domain });
  }

  return context;
}

export interface CrawlOptions {
  contentXPath?: string;  // 内容提取 XPath（可选）
  onProgress?: (documentCount: number) => void;
  onBrowserReady?: (page: Page) => void;
}

export interface CrawlResult {
  url: string;
  success: boolean;
  browserReady?: boolean;  // 浏览器已就绪，等待用户确认开始爬取
  keepBrowserOpen?: boolean;
  markdown?: string;
  title?: string;
}

/**
 * 爬取网页
 */
export async function crawl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  // 验证 URL
  validateUrl(url);

  const config = getCrawlerConfig();
  const domain = extractDomain(url);

  logger.info('开始爬取', { url, domain, hasContentXPath: !!options.contentXPath });

  let browser: Browser | null = null;
  let page: Page | null = null;
  let keepBrowserOpen = false; // 是否保持浏览器打开

  try {
    // 检查是否有已保存的会话
    const session = await SessionManager.loadSession(domain);
    if (session) {
      logger.info('检测到已保存的会话', { domain });
    } else {
      logger.debug('未找到已保存的会话', { domain });
    }

    // 启动浏览器（始终使用非无头模式，方便用户操作）
    browser = await chromium.launch({
      headless: false,
    });

    // 创建带会话的上下文
    const context = await createContextWithSession(domain, browser);
    page = await context.newPage();
    logger.info('浏览器已启动', { mode: 'visible' });

    // 导航到目标 URL
    await page.goto(url, { waitUntil: 'networkidle', timeout: config.request.timeout });
    logger.info('页面已加载', { url: page.url() });

    // 保存页面引用供后续使用
    if (page) {
      activePages.set(`${url}_${Date.now()}`, page);
    }

    // 浏览器已就绪，等待用户确认开始爬取
    keepBrowserOpen = true;
    options.onBrowserReady?.(page);
    logger.info('浏览器已就绪，等待用户确认开始爬取');

    return {
      url,
      success: true,
      browserReady: true,
      keepBrowserOpen: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('爬取失败', error instanceof Error ? error : new Error(errorMessage), { url });
    throw error;
  } finally {
    // 保持浏览器打开，等待用户操作
    if (browser && keepBrowserOpen) {
      logger.info('保持浏览器打开，等待用户操作');
    }
  }
}

/**
 * 继续爬取（用户确认后）
 */
export async function continueCrawl(
  page: Page,
  url: string,
  contentXPath?: string
): Promise<{ markdown: string; title: string }> {
  logger.info('继续爬取', { url, hasContentXPath: !!contentXPath });

  try {
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

    return { markdown, title };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('继续爬取失败', error instanceof Error ? error : new Error(errorMessage), { url });
    throw error;
  }
}

/**
 * 解析网页内容
 */
export function parseContent(html: string, url: string): {
  title: string;
  body: string;
  language: string;
} {
  try {
    const $ = cheerio.load(html);
    const config = getCrawlerConfig();

    // 移除不需要的元素
    $(config.parsing.removeSelectors.join(',')).remove();

    // 使用 Readability 提取主要内容
    // Readability 需要 JSDOM document 对象
    const dom = new JSDOM(html, { url });
    const doc = new Readability(dom.window.document, {
      charThreshold: 100,
    }).parse();

    if (doc) {
      return {
        title: doc.title || $('title').text() || 'Untitled',
        body: doc.textContent || '',
        language: doc.lang || $('html').attr('lang') || 'unknown',
      };
    }

    // 回退：使用选择器提取
    const contentEl = $(config.parsing.contentSelector).first();
    const title = $('title').text() || $('h1').first().text() || 'Untitled';

    return {
      title,
      body: contentEl.text() || $.text(),
      language: $('html').attr('lang') || 'unknown',
    };
  } catch (error) {
    logger.error('内容解析失败', error instanceof Error ? error : new Error(String(error)));
    // 返回降级结果
    const $ = cheerio.load(html);
    const title = $('title').text() || $('h1').first().text() || 'Untitled';
    return {
      title,
      body: $.text(),
      language: $('html').attr('lang') || 'unknown',
    };
  }
}

// 会话管理功能由 SessionManager 模块提供

/**
 * 提取内容区域
 */
export async function extractContentByXPath(
  page: Page,
  xpath: string
): Promise<{ html: string; text: string; title: string }> {
  try {
    const elements = await page.locator(`xpath=${xpath}`).all();
    if (elements.length === 0) {
      throw new Error('未找到匹配的元素');
    }

    // 提取第一个匹配元素的内容
    const firstElement = elements[0];
    if (!firstElement) {
      throw new Error('无法获取第一个元素');
    }

    const html = await firstElement.innerHTML();
    const text = await firstElement.textContent();
    const title = await page.title();

    return { html, text: text || '', title };
  } catch (error) {
    throw new Error(`XPath 提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Turndown 单例实例
let turndownService: TurndownService | null = null;

/**
 * 获取 Turndown 服务实例（单例模式）
 */
function getTurndownService(): TurndownService {
  if (!turndownService) {
    turndownService = new TurndownService({
      headingStyle: 'atx',        // 使用 # 格式
      codeBlockStyle: 'fenced',   // 使用 ``` 代码块
      bulletListMarker: '-',       // 使用 - 作为列表标记
      emDelimiter: '*',           // 使用 * 作为斜体标记
      strongDelimiter: '**',       // 使用 ** 作为粗体标记
      linkStyle: 'inlined',       // 使用内联链接
    });

    // 自定义规则：处理代码块
    turndownService.addRule('codeBlock', {
      filter: (node) => {
        return (
          node.nodeName === 'PRE' &&
          node.firstChild !== null &&
          (node.firstChild as HTMLElement).nodeName === 'CODE'
        );
      },
      replacement: (content, node) => {
        const codeNode = node.firstChild as HTMLElement | null;
        const className = codeNode?.className || '';
        const language = className.match(/language-(\w+)/)?.[1] || '';
        return '\n\n```' + language + '\n' + content + '\n```\n\n';
      },
    });

    // 自定义规则：处理表格
    turndownService.addRule('table', {
      filter: 'table',
      replacement: (_content) => {
        return '\n\n' + _content + '\n\n';
      },
    });

    // 自定义规则：处理图片
    turndownService.addRule('image', {
      filter: 'img',
      replacement: (_content, node) => {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        return `![${alt}](${src})`;
      },
    });

    // 自定义规则：处理引用
    turndownService.addRule('blockquote', {
      filter: 'blockquote',
      replacement: (content) => {
        return '\n\n> ' + content.trim().replace(/\n/g, '\n> ') + '\n\n';
      },
    });

    // 自定义规则：跳过不需要的元素
    turndownService.addRule('removeScript', {
      filter: ['script', 'style', 'nav', 'footer', 'iframe', 'noscript'],
      replacement: () => '',
    });

    // 自定义规则：跳过广告元素（注意：已在 cheerio 预处理中移除，此处作为保险）
    turndownService.addRule('removeAd', {
      filter: (node) => {
        return node.nodeName === 'DIV' &&
               typeof node.className === 'string' &&
               node.className.includes('ad');
      },
      replacement: () => '',
    });
  }

  return turndownService;
}

/**
 * 生成 Markdown（使用 Turndown）
 */
export function generateMarkdown(
  html: string,
  title: string,
  url: string
): string {
  const turndown = getTurndownService();

  // 预处理 HTML：移除不需要的元素
  const $ = cheerio.load(html);
  $('script, style, nav, footer, .ad, iframe, noscript').remove();

  const cleanedHtml = $.html();

  // 转换为 Markdown
  let markdown = turndown.turndown(cleanedHtml);

  // 添加标题和来源信息
  markdown = `# ${title}\n\n> 来源: ${url}\n\n` + markdown;

  return markdown;
}

/**
 * 保存为草稿（Note）
 */
export async function saveAsDraft(
  title: string,
  markdown: string,
  _source: string
): Promise<string> {
  const note = await NoteManager.createNote({
    title: `[草稿] ${title}`,
    content: markdown,
    tags: ['draft', 'crawler'],
  });

  return note.id;
}

/**
 * 设置 XPath 输入超时
 */
export function setXPathTimeout(taskId: string, callback: () => void): void {
  const timeoutId = setTimeout(() => {
    callback();
    xpathTimeouts.delete(taskId);
  }, XPATH_INPUT_TIMEOUT);
  xpathTimeouts.set(taskId, timeoutId);
}

/**
 * 清除 XPath 超时
 */
export function clearXPathTimeout(taskId: string): void {
  const timeoutId = xpathTimeouts.get(taskId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    xpathTimeouts.delete(taskId);
  }
}
