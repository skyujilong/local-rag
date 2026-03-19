/**
 * 爬虫服务
 */

import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { createLogger, LogSystem } from '@local-rag/shared';
import * as SessionManager from './session-manager.js';
import * as LoginDetector from './auth/login-detector.js';
import * as DocumentManager from '../services/knowledge-base/document-manager.js';
import { extractDomain } from '@local-rag/shared/utils';
import type { CrawlerSession } from '@local-rag/shared/types';
import { getCrawlerConfig } from '@local-rag/config/crawler';

const logger = createLogger(LogSystem.API, 'crawler');

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

  logger.info('开始爬取', { url, domain, waitForAuth: options.waitForAuth });

  let browser: any = null;
  let page: any = null;

  try {
    // 尝试加载已保存的会话
    const session = await SessionManager.loadSession(domain);
    if (session) {
      logger.info('加载已保存的会话', { domain });
    }

    // 启动浏览器
    browser = await chromium.launch({
      headless: !options.waitForAuth,
    });

    const context = await browser.newContext({
      viewport: config.browser.viewport,
      userAgent: config.request.userAgent,
    });

    page = await context.newPage();
    logger.info('浏览器已启动', { headless: !options.waitForAuth });

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

      // 切换到无头模式继续爬取
      await browser.close();
      browser = await chromium.launch({ headless: true });
      const newContext = await browser.newContext({
        viewport: config.browser.viewport,
        userAgent: config.request.userAgent,
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
    if (browser) {
      await browser.close();
      logger.debug('浏览器已关闭');
    }
  }
}

/**
 * 等待登录成功
 */
async function waitForLoginSuccess(page: any): Promise<void> {
  const maxWaitTime = 5 * 60 * 1000; // 5分钟
  const checkInterval = 2000;
  const startTime = Date.now();
  const startUrl = page.url();

  logger.info('开始等待登录', { startUrl, maxWaitTime: `${maxWaitTime / 1000}s` });

  let lastCheckUrl = startUrl;
  while (Date.now() - startTime < maxWaitTime) {
    // 检测 URL 变化（通常登录后会跳转）
    const currentUrl = page.url();

    if (currentUrl !== lastCheckUrl) {
      logger.info('检测到 URL 变化', { from: lastCheckUrl, to: currentUrl });
      lastCheckUrl = currentUrl;
    }

    // 检测特定元素（如用户头像、用户名等）
    const hasUserElement = await page.$('.user-avatar, .user-name, [data-user], .avatar, .user-info, [class*="user"]').then((el: any | null) => !!el);

    // 检测登录框消失
    const hasLoginBox = await LoginDetector.detectLoginRequired(page);

    // 更宽松的登录成功检测条件
    const urlChanged = currentUrl !== startUrl && !currentUrl.toLowerCase().includes('login');
    const loginBoxGone = !hasLoginBox;

    if (urlChanged || hasUserElement || loginBoxGone) {
      logger.info('登录成功条件满足', {
        urlChanged,
        hasUserElement,
        loginBoxGone,
        currentUrl
      });
      return;
    }

    await page.waitForTimeout(checkInterval);
  }

  logger.warn('等待登录超时', { elapsed: `${maxWaitTime / 1000}s`, currentUrl: page.url() });
  throw new Error('等待登录超时');
}

/**
 * 解析网页内容
 */
function parseContent(html: string, _url: string): {
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

// 会话管理功能由 SessionManager 模块提供
