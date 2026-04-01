/**
 * Content Cleaner Service
 *
 * 负责清洗网页内容，提取正文，计算质量评分
 */

import DOMPurify from 'isomorphic-dompurify';
import { createLogger } from '../../shared/utils/logger.js';
import type { ContentCleanResult } from '../../shared/types/crawler.js';
import { JSDOM } from 'jsdom';

const log = createLogger('server:services:content-cleaner');

/**
 * Content Cleaner Service 类
 */
export class ContentCleanerService {
  /**
   * 需要移除的选择器列表
   */
  private readonly UNWANTED_SELECTORS = [
    // 导航
    'nav',
    'header',
    'footer',
    'aside',
    '.sidebar',
    '.navigation',
    '.menu',
    '.nav',
    '.navbar',
    '.header',
    '.footer',

    // 广告
    '.ads',
    '.advertisement',
    '.ad',
    '.banner',
    '.sponsor',

    // Cookie 提示
    '.cookie-banner',
    '.cookie-notice',
    '.cookie-consent',

    // 弹窗
    '.modal',
    '.popup',
    '.dialog',

    // 其他无关元素
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    '.comments',
    '.related-posts',
    '.social-share',
  ];

  /**
   * 主要内容选择器（优先级从高到低）
   */
  private readonly CONTENT_SELECTORS = [
    'main',
    'article',
    '[role="main"]',
    '#main',
    '#content',
    '.content',
    '.main-content',
    '.article',
    '.post',
    '.entry-content',
  ];

  /**
   * 从 HTML 内容中提取并清洗正文
   */
  async cleanContent(html: string, customSelector?: string): Promise<ContentCleanResult> {
    try {
      // 1. 创建临时 DOM
      const doc = this.createDocument(html);

      // 2. 移除不需要的元素
      this.removeUnwantedElements(doc);

      // 3. 提取标题
      const title = this.extractTitle(doc);

      // 4. 提取正文内容
      const content = customSelector
        ? this.extractBySelector(doc, customSelector)
        : this.extractMainContent(doc);

      // 5. 清洗文本
      const cleanedText = this.cleanText(content);

      // 6. 计算质量评分
      const qualityScore = this.calculateQualityScore(content, cleanedText);

      // 7. XSS 防护
      const sanitizedContent = DOMPurify.sanitize(cleanedText, {
        ALLOWED_TAGS: [
          'p',
          'br',
          'strong',
          'em',
          'b',
          'i',
          'u',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'ul',
          'ol',
          'li',
          'blockquote',
          'code',
          'pre',
          'a',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
        ],
        ALLOWED_ATTR: ['href'],
        KEEP_CONTENT: true,
      });

      // 8. 计算字数
      const wordCount = this.countWords(sanitizedContent);

      log.debug(
        `Content cleaned: ${title}, quality=${qualityScore.toFixed(2)}, words=${wordCount}`
      );

      return {
        content: sanitizedContent,
        qualityScore,
        wordCount,
        title,
      };
    } catch (error) {
      log.error('Failed to clean content', error);
      throw new Error('Content cleaning failed');
    }
  }

  /**
   * 创建临时 DOM 文档
   */
  private createDocument(html: string): Document {
    // 使用 JSDOM 或浏览器环境
    if (typeof window !== 'undefined' && window.DOMParser) {
      const parser = new DOMParser();
      return parser.parseFromString(html, 'text/html');
    }

    // Node.js 环境：使用 jsdom
    const dom = new JSDOM(html);
    return dom.window.document;
  }

  /**
   * 移除不需要的元素
   */
  private removeUnwantedElements(doc: Document): void {
    for (const selector of this.UNWANTED_SELECTORS) {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((el) => el.remove());
    }
  }

  /**
   * 提取标题
   */
  private extractTitle(doc: Document): string {
    // 尝试多种方式获取标题
    const titleSelectors = [
      'h1',
      'title',
      '[role="heading"]',
      '.title',
      '.page-title',
      '#title',
    ];

    for (const selector of titleSelectors) {
      const element = doc.querySelector(selector);
      if (element && element.textContent) {
        const title = element.textContent.trim();
        if (title.length > 0 && title.length < 200) {
          return title;
        }
      }
    }

    return 'Untitled';
  }

  /**
   * 提取主要内容（保留 HTML 结构）
   */
  private extractMainContent(doc: Document): string {
    // 尝试多个选择器
    for (const selector of this.CONTENT_SELECTORS) {
      const element = doc.querySelector(selector);
      if (element) {
        const html = element.innerHTML.trim();
        const text = element.textContent?.trim() || '';
        if (text.length > 100) {
          // 至少 100 字符
          return html;
        }
      }
    }

    // 如果没有找到主要内容，使用 body
    const body = doc.querySelector('body');
    return body?.innerHTML?.trim() || '';
  }

  /**
   * 使用自定义选择器提取内容（保留 HTML 结构）
   */
  private extractBySelector(doc: Document, selector: string): string {
    try {
      const element = doc.querySelector(selector);
      if (element) {
        return element.innerHTML.trim();
      }
    } catch (error) {
      log.warn(`Invalid selector: ${selector}`, error);
    }

    // Fallback to default extraction
    return this.extractMainContent(doc);
  }

  /**
   * 清洗 HTML（移除多余空白，但保留标签）
   */
  private cleanText(html: string): string {
    // 移除标签之间的多余空白
    return html
      .replace(/>\s+</g, '><') // 移除标签之间的空白
      .replace(/\s+/g, ' ') // 多个空白字符替换为单个空格
      .trim();
  }

  /**
   * 计算质量评分（正文占比）
   */
  private calculateQualityScore(rawHtml: string, cleanedHtml: string): number {
    if (!rawHtml || rawHtml.length === 0) {
      return 0;
    }

    // 提取纯文本进行比较
    const rawText = rawHtml.replace(/<[^>]*>/g, '').trim();
    const cleanedText = cleanedHtml.replace(/<[^>]*>/g, '').trim();

    if (rawText.length === 0) {
      return 0;
    }

    // 计算清洗后的文本内容占比
    const ratio = cleanedText.length / rawText.length;

    // 调整评分：理想比例为 0.4-0.7（更严格）
    if (ratio >= 0.4 && ratio <= 0.7) {
      return 1.0;
    } else if (ratio < 0.4) {
      // 清洗后内容太少，可能过度清洗或内容质量低
      return ratio; // 直接返回 ratio，对于 0.1-0.3 的范围会得到低分
    } else {
      // 清洗后内容太多，可能清洗不足
      return Math.max(0, 1 - (ratio - 0.7));
    }
  }

  /**
   * 计算字数
   */
  private countWords(text: string): number {
    // 移除 HTML 标签
    const plainText = text.replace(/<[^>]*>/g, '');
    // 分割为单词（支持中英文）
    const words = plainText.split(/[\s\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-.\/:;<=>?@\[\]^`{|}~]+/);
    return words.filter((w) => w.length > 0).length;
  }

  /**
   * 检测是否为登录页
   */
  isLoginPage(content: string): boolean {
    const loginKeywords = [
      'login',
      'sign in',
      'sign in to your account',
      'log in',
      'authentication',
      'password',
      'username',
      'email',
      'forgot password',
    ];

    const lowerContent = content.toLowerCase();

    // 检查是否包含登录关键词
    const loginKeywordCount = loginKeywords.filter((keyword) =>
      lowerContent.includes(keyword)
    ).length;

    // 如果包含 3 个以上登录关键词，可能是登录页
    return loginKeywordCount >= 3;
  }
}

// 导出单例
export const contentCleanerService = new ContentCleanerService();
