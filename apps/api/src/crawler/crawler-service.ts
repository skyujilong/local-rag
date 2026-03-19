/**
 * 爬虫服务
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import * as SessionManager from './session-manager.js';
import * as LoginDetector from './auth/login-detector.js';
import * as DocumentManager from '../services/knowledge-base/document-manager.js';
import { extractDomain } from '@local-rag/shared/utils';
import type { CrawlerSession } from '@local-rag/shared/types';
import { getCrawlerConfig } from '@local-rag/config/crawler';

export interface CrawlOptions {
  waitForAuth?: boolean;
  onAuthStatusChange?: (status: 'detected' | 'waiting_qrcode' | 'success' | 'failed') => void;
  onProgress?: (documentCount: number) => void;
}

export interface CrawlResult {
  url: string;
  documentCount: number;
  success: boolean;
}

/**
 * 爬取网页
 */
export async function crawl(url: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const config = getCrawlerConfig();
  const domain = extractDomain(url);

  let browser: any = null;
  let page: any = null;

  try {
    // 尝试加载已保存的会话
    const session = await SessionManager.loadSession(domain);

    // 启动浏览器
    browser = await chromium.launch({
      headless: !options.waitForAuth,
    });

    const context = await browser.newContext({
      viewport: config.browser.viewport,
      userAgent: config.browser.userAgent,
    });

    page = await context.newPage();

    // 加载会话（如果存在）
    if (session) {
      await context.addCookies(session.cookies);
      await context.addInitScript(() => {
        if (session.localStorage) {
          for (const [key, value] of Object.entries(session.localStorage)) {
            localStorage.setItem(key, value as string);
          }
        }
      });
    }

    // 导航到目标 URL
    await page.goto(url, { waitUntil: 'networkidle', timeout: config.request.timeout });

    // 检测是否需要登录
    const needsLogin = await LoginDetector.detectLoginRequired(page);

    if (needsLogin && options.waitForAuth) {
      options.onAuthStatusChange?.('detected');
      options.onAuthStatusChange?.('waiting_qrcode');

      // 等待登录成功（通过 URL 变化或特定元素出现检测）
      await waitForLoginSuccess(page);

      // 保存会话
      await SessionManager.saveSession(domain, page);

      options.onAuthStatusChange?.('success');

      // 切换到无头模式继续爬取
      await browser.close();
      browser = await chromium.launch({ headless: true });
      const newContext = await browser.newContext({
        viewport: config.browser.viewport,
        userAgent: config.browser.userAgent,
      });
      page = await newContext.newPage();

      // 重新加载会话
      const savedSession = await SessionManager.loadSession(domain);
      if (savedSession) {
        await newContext.addCookies(savedSession.cookies);
        await newContext.addInitScript((session: CrawlerSession) => {
          if (session.localStorage) {
            for (const [key, value] of Object.entries(session.localStorage)) {
              localStorage.setItem(key, value as string);
            }
          }
        }, savedSession);
      }

      await page.goto(url, { waitUntil: 'networkidle', timeout: config.request.timeout });
    }

    // 获取页面内容
    const html = await page.content();

    // 解析内容
    const content = parseContent(html, url);

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

    options.onProgress?.(1);

    return {
      url,
      documentCount: 1,
      success: true,
    };
  } catch (error) {
    options.onAuthStatusChange?.('failed');
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 等待登录成功
 */
async function waitForLoginSuccess(page: any): Promise<void> {
  // 检测登录成功的条件
  const maxWaitTime = 5 * 60 * 1000; // 5分钟
  const checkInterval = 2000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    // 检测 URL 变化（通常登录后会跳转）
    const currentUrl = page.url();

    // 检测特定元素（如用户头像、用户名等）
    const hasUserElement = await page.$('.user-avatar, .user-name, [data-user], .avatar').then(el => !!el);

    // 检测登录框消失
    const hasLoginBox = await LoginDetector.detectLoginRequired(page);

    if (!hasLoginBox || hasUserElement) {
      return;
    }

    await page.waitForTimeout(checkInterval);
  }

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
  const $ = cheerio.load(html);
  const config = getCrawlerConfig();

  // 移除不需要的元素
  $(config.parsing.removeSelectors.join(',')).remove();

  // 使用 Readability 提取主要内容
  const doc = new Readability(html as any, {
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
}

/**
 * 删除会话
 */
export async function deleteSession(domain: string): Promise<void> {
  await SessionManager.deleteSession(domain);
}

/**
 * 列出所有会话
 */
export async function listSessions(): Promise<CrawlerSession[]> {
  return SessionManager.listSessions();
}
