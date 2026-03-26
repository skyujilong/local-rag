/**
 * Web crawler service using Playwright
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink } from 'fs/promises';
import DOMPurify from 'isomorphic-dompurify';
import type { CrawlerConfig, CrawlerResult } from '../../shared/types/index.js';
import { logger } from '../../shared/utils/logger.js';
import { documentService } from './documents.js';
import { CrawlerError } from '../../shared/types/index.js';

export class CrawlerService {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  /**
   * Initialize browser with proper error handling and resource cleanup
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({
        headless: true,
      });

      // Verify browser is responsive
      const version = await browser.version();
      this.browser = browser;

      logger.info(`Crawler browser initialized (Chromium version: ${version})`);
    } catch (error) {
      // Clean up browser if initialization failed
      if (browser) {
        try {
          await browser.close();
          logger.info('Cleaned up failed browser instance');
        } catch (closeError) {
          logger.warn('Failed to cleanup browser after initialization failure:', closeError);
        }
      }

      logger.error('Failed to initialize crawler browser', error);
      throw new CrawlerError('', 'Browser initialization failed');
    }
  }

  /**
   * Crawl a single URL
   */
  async crawlUrl(config: CrawlerConfig): Promise<CrawlerResult> {
    if (!this.browser) {
      await this.initialize();
    }

    const context = await this.createContext(config);
    const page = await context.newPage();

    try {
      logger.info(`Crawling URL: ${config.url}`);

      // Navigate to URL
      const response = await page.goto(config.url, {
        waitUntil: 'networkidle',
        timeout: config.timeout || 30000,
      });

      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response?.status() || 'Error'}`);
      }

      // Wait for specific selector if provided
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
      }

      // Extract content
      const content = await this.extractMainContent(page);

      // Extract metadata
      const title = await page.title();
      const language = await page.evaluate((): string => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ((globalThis as any).document?.documentElement?.lang) || 'en';
      });

      // Take screenshot if requested
      let screenshotPath: string | undefined;
      if (config.screenshot) {
        screenshotPath = join(tmpdir(), `devrag-screenshot-${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath });

        // Auto-cleanup after 1 minute
        setTimeout(() => {
          unlink(screenshotPath!).catch(() => {
            logger.warn(`Failed to cleanup screenshot: ${screenshotPath}`);
          });
        }, 60000);
      }

      // Extract links
      const links = await this.extractLinks(page);

      const result: CrawlerResult = {
        url: config.url,
        title,
        content,
        metadata: {
          crawledAt: new Date(),
          wordCount: content.split(/\s+/).length,
          language,
          screenshotPath,
        },
        links,
      };

      logger.info(`Successfully crawled: ${config.url} (${result.metadata.wordCount} words)`);

      return result;
    } catch (error) {
      logger.error(`Failed to crawl URL: ${config.url}`, error);
      throw new CrawlerError(
        config.url,
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      await page.close();
    }
  }

  /**
   * Crawl multiple URLs
   */
  async crawlUrls(configs: CrawlerConfig[]): Promise<CrawlerResult[]> {
    const results: CrawlerResult[] = [];

    for (const config of configs) {
      try {
        const result = await this.crawlUrl(config);
        results.push(result);
      } catch (error) {
        logger.warn(`Failed to crawl ${config.url}, continuing...`);
      }
    }

    return results;
  }

  /**
   * Crawl URL and add to document store
   */
  async crawlAndImport(config: CrawlerConfig): Promise<void> {
    const result = await this.crawlUrl(config);

    // Add as document
    await documentService.addDocumentFromText(
      result.content,
      result.title,
      {
        tags: ['webpage', 'crawled'],
      }
    );

    logger.info(`Imported crawled content from: ${config.url}`);
  }

  /**
   * Extract main content from page with XSS protection
   */
  private async extractMainContent(page: Page): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content = await page.evaluate((): string => {
      // These globals (document, HTMLElement) exist in the browser context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = (globalThis as any).document;
      // Remove unwanted elements
      const unwantedSelectors = [
        'nav',
        'header',
        'footer',
        'aside',
        '.sidebar',
        '.navigation',
        '.menu',
        '.ads',
        '.advertisement',
        'script',
        'style',
        'noscript',
      ];

      unwantedSelectors.forEach((selector) => {
        const elements = doc.querySelectorAll(selector);
        elements.forEach((el: any) => el.remove());
      });

      // Try to find main content
      const mainContent =
        doc.querySelector('main')?.textContent ||
        doc.querySelector('article')?.textContent ||
        doc.querySelector('[role="main"]')?.textContent ||
        doc.body?.textContent ||
        '';

      // Clean up text
      return mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    });

    // Sanitize content to prevent XSS attacks
    const sanitizedContent = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });

    return sanitizedContent;
  }

  /**
   * Extract links from page
   */
  private async extractLinks(page: Page): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const links = await page.evaluate((): string[] => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = (globalThis as any).document;
      const anchorTags = doc.querySelectorAll('a[href]');
      return Array.from(anchorTags)
        .map((a: any) => a.href as string)
        .filter((href: string) => href.startsWith('http'));
    });

    return links;
  }

  /**
   * Create browser context with cookies if provided
   */
  private async createContext(config: CrawlerConfig): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const contextId = JSON.stringify(config.cookies || {});

    if (!this.contexts.has(contextId)) {
      const context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      // Add cookies if provided
      if (config.cookies) {
        await context.addCookies(
          Object.entries(config.cookies).map(([name, value]) => ({
            name,
            value,
            domain: new URL(config.url).hostname,
            path: '/',
          }))
        );
      }

      this.contexts.set(contextId, context);
    }

    return this.contexts.get(contextId)!;
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.contexts.clear();
      logger.info('Crawler browser closed');
    }
  }
}

export const crawlerService = new CrawlerService();
