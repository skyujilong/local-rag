/**
 * 爬虫服务
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { createLogger, LogSystem } from '@local-rag/shared';
import * as SessionManager from './session-manager.js';
import * as LoginDetector from './auth/login-detector.js';
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
  waitForAuth?: boolean;
  useXPath?: boolean;
  onAuthStatusChange?: (status: 'detected' | 'waiting_qrcode' | 'success' | 'failed') => void;
  onProgress?: (documentCount: number) => void;
  onLoginSuccess?: (page: Page) => void;
}

export interface CrawlResult {
  url: string;
  documentCount: number;
  success: boolean;
  waitingForXPath?: boolean;
  keepBrowserOpen?: boolean;
}

/**
 * 爬取网页
 */
export async function crawl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  // 验证 URL
  validateUrl(url);

  const config = getCrawlerConfig();
  const domain = extractDomain(url);

  logger.info('开始爬取', { url, domain, waitForAuth: options.waitForAuth, useXPath: options.useXPath });

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

    // 检测是否需要登录
    const needsLogin = await LoginDetector.detectLoginRequired(page);
    logger.info('登录检测结果', { needsLogin });

    if (needsLogin && options.waitForAuth) {
      logger.info('检测到登录需求，等待用户登录');
      options.onAuthStatusChange?.('detected');
      options.onAuthStatusChange?.('waiting_qrcode');

      // 等待登录成功（通过 URL 变化或特定元素出现检测）
      await waitForLoginSuccess(page);
      logger.info('用户登录成功');

      // 保存会话
      await SessionManager.saveSession(domain, page);
      logger.info('会话已保存', { domain });

      options.onAuthStatusChange?.('success');

      // 登录成功后调用回调，传递页面引用
      options.onLoginSuccess?.(page);

      // 如果启用了 useXPath，登录成功后停止执行，等待用户输入 XPath
      if (options.useXPath) {
        logger.info('等待用户输入 XPath，保持浏览器打开');
        keepBrowserOpen = true; // 标记需要保持浏览器打开
        return {
          url,
          documentCount: 0,
          success: true,
          waitingForXPath: true,
          keepBrowserOpen: true,
        };
      }

      // 登录成功后继续使用当前浏览器，不切换到无头模式
      logger.info('继续使用当前浏览器进行爬取');
    }

    // 获取页面内容
    const html = await page.content();
    logger.info('页面内容已获取', { htmlLength: html.length });

    // 解析内容
    const content = parseContent(html, url);
    logger.info('内容解析完成', { title: content.title, bodyLength: content.body.length });

    // 创建文档
    await DocumentManager.createDocument({
      title: content.title,
      content: content.body,
      source: url,
      metadata: {
        type: 'webpage',
        url,
        language: content.language,
      },
    });
    logger.info('文档已创建', { title: content.title });

    options.onProgress?.(1);

    logger.info('爬取成功', { url, documentCount: 1 });
    return {
      url,
      documentCount: 1,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('爬取失败', error instanceof Error ? error : new Error(errorMessage), { url });
    options.onAuthStatusChange?.('failed');
    throw error;
  } finally {
    // 只有在不需要保持浏览器打开时才关闭
    if (browser && !keepBrowserOpen) {
      await browser.close();
      logger.debug('浏览器已关闭');
    } else if (browser && keepBrowserOpen) {
      logger.info('保持浏览器打开，等待用户操作');
    }
  }
}

/**
 * 等待登录成功
 */
async function waitForLoginSuccess(page: Page): Promise<void> {
  const maxWaitTime = 5 * 60 * 1000; // 5分钟
  const checkInterval = 2000;
  const startTime = Date.now();
  const startUrl = page.url();

  logger.info('开始等待登录', { startUrl, maxWaitTime: `${maxWaitTime / 1000}s` });

  let lastCheckUrl = startUrl;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      // 检测 URL 变化（通常登录后会跳转）
      const currentUrl = page.url();

      if (currentUrl !== lastCheckUrl) {
        logger.info('检测到 URL 变化', { from: lastCheckUrl, to: currentUrl });
        lastCheckUrl = currentUrl;

        // URL 变化后等待页面稳定
        await page.waitForLoadState('domcontentloaded').catch((error) => {
          logger.debug('等待页面稳定超时（预期行为）', { error: error?.message });
        });
      }

      // 检测登录框是否仍然存在
      let hasLoginBox = false;
      try {
        hasLoginBox = await LoginDetector.detectLoginRequired(page);
      } catch (error) {
        // 登录检测失败，可能因为页面导航
        logger.debug('登录框检测失败', {
          error: error instanceof Error
            ? { message: error.message, stack: error.stack, name: error.name }
            : { message: String(error) }
        });
        // 检测失败时假定为未登录（保守策略）
        hasLoginBox = true;
      }

      // 登录成功检测条件：
      // 1. URL 必须变化且不再包含 login（从登录页跳转到其他页）
      // 2. 或者登录框消失且当前 URL 不包含 login
      const urlChanged = currentUrl !== startUrl && !currentUrl.toLowerCase().includes('login');
      const loginBoxGone = !hasLoginBox && !currentUrl.toLowerCase().includes('login');

      if (urlChanged || loginBoxGone) {
        logger.info('登录成功条件满足', {
          urlChanged,
          loginBoxGone,
          currentUrl
        });
        return;
      }

      // 记录当前状态用于调试
      logger.debug('等待登录中...', {
        currentUrl,
        hasLoginBox,
        urlChanged: currentUrl !== startUrl,
      });
    } catch (error) {
      // 捕获页面导航导致的执行上下文错误
      if (error instanceof Error && error.message.includes('Execution context was destroyed')) {
        logger.debug('页面导航中，等待页面稳定...', {
          error: { message: error.message, stack: error.stack, name: error.name }
        });
        // 等待页面稳定后继续
        await page.waitForLoadState('domcontentloaded').catch((err) => {
          logger.debug('等待页面稳定失败', {
            error: err instanceof Error
              ? { message: err.message, stack: err.stack, name: err.name }
              : { message: String(err) }
          });
        });
        continue;
      }
      // 其他错误继续抛出
      throw error;
    }

    await page.waitForTimeout(checkInterval);
  }

  logger.warn('等待登录超时', { elapsed: `${maxWaitTime / 1000}s`, currentUrl: page.url() });
  throw new Error('等待登录超时');
}

/**
 * 解析网页内容
 */
function parseContent(html: string, url: string): {
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
    const html = await firstElement.innerHTML();
    const text = await firstElement.textContent();
    const title = await page.title();

    return { html, text: text || '', title };
  } catch (error) {
    throw new Error(`XPath 提取失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 生成 Markdown
 */
export function generateMarkdown(
  html: string,
  title: string,
  url: string
): string {
  const $ = cheerio.load(html);

  // 移除不需要的元素
  $('script, style, nav, footer, .ad').remove();

  let markdown = `# ${title}\n\n`;
  markdown += `> 来源: ${url}\n\n`;

  // 转换标题
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tagName = el.tagName;
    const level = parseInt(tagName[1]);
    const text = $(el).text().trim();
    const prefix = '#'.repeat(level + 1);
    markdown += `${prefix} ${text}\n\n`;
    $(el).remove();
  });

  // 转换段落
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) {
      markdown += `${text}\n\n`;
    }
    $(el).remove();
  });

  // 转换列表
  $('ul, ol').each((_, el) => {
    const isOrdered = el.tagName === 'ol';
    $(el).find('li').each((index, li) => {
      const text = $(li).text().trim();
      const prefix = isOrdered ? `${index + 1}. ` : '- ';
      markdown += `${prefix}${text}\n`;
    });
    markdown += '\n';
    $(el).remove();
  });

  // 转换链接
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (text && href) {
      markdown += `[${text}](${href})`;
    }
    $(el).remove();
  });

  // 剩余文本
  const remainingText = $.root().text().trim();
  if (remainingText) {
    markdown += remainingText;
  }

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
