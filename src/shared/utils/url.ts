/**
 * URL 工具类
 *
 * 提供 URL 标准化、验证、重复检测等功能
 */

import { createLogger } from './logger.js';

const log = createLogger('shared:utils:url');

/**
 * 追踪参数列表（用于标准化时移除）
 */
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  '_ga',
  '_gid',
];

/**
 * URL 标准化选项
 */
export interface UrlNormalizeOptions {
  removeHash?: boolean;
  removeTrackingParams?: boolean;
  removeTrailingSlash?: boolean;
  lowerCase?: boolean;
}

/**
 * URL 工具类
 */
export class UrlUtil {
  /**
   * 标准化 URL（用于重复检测）
   */
  static normalize(url: string, options: UrlNormalizeOptions = {}): string {
    const {
      removeHash = true,
      removeTrackingParams = true,
      removeTrailingSlash = false,
      lowerCase = false,
    } = options;

    try {
      let normalizedUrl = new URL(url);

      // 移除 hash
      if (removeHash) {
        normalizedUrl.hash = '';
      }

      // 移除追踪参数
      if (removeTrackingParams) {
        const searchParams = normalizedUrl.searchParams;
        for (const param of TRACKING_PARAMS) {
          searchParams.delete(param);
        }
        normalizedUrl.search = searchParams.toString();
      }

      // 移除尾部斜杠
      if (removeTrailingSlash && normalizedUrl.pathname.endsWith('/')) {
        normalizedUrl.pathname = normalizedUrl.pathname.slice(0, -1);
      }

      // 转小写（仅对 hostname 和 protocol）
      if (lowerCase) {
        normalizedUrl = new URL(normalizedUrl.toString());
        // URL 构造函数会自动将 hostname 和 protocol 转小写
      }

      return normalizedUrl.toString();
    } catch (error) {
      log.warn(`Failed to normalize URL: ${url}`, error);
      return url; // 返回原始 URL
    }
  }

  /**
   * 验证 URL 格式
   */
  static isValid(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * 提取域名
   */
  static extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return '';
    }
  }

  /**
   * 检查两个 URL 是否重复（忽略 hash 和追踪参数）
   */
  static isDuplicate(url1: string, url2: string): boolean {
    const normalized1 = this.normalize(url1);
    const normalized2 = this.normalize(url2);
    return normalized1 === normalized2;
  }

  /**
   * 从 Sitemap URL 提取基础 URL
   */
  static extractBaseUrl(sitemapUrl: string): string {
    try {
      const parsed = new URL(sitemapUrl);
      return `${parsed.protocol}//${parsed.hostname}`;
    } catch {
      return '';
    }
  }

  /**
   * 检查 URL 是否属于同一域名
   */
  static isSameDomain(url1: string, url2: string): boolean {
    const domain1 = this.extractDomain(url1);
    const domain2 = this.extractDomain(url2);
    return domain1 !== '' && domain1 === domain2;
  }

  /**
   * 过滤同域名 URL
   */
  static filterSameDomain(baseUrl: string, urls: string[]): string[] {
    const baseDomain = this.extractDomain(baseUrl);
    return urls.filter((url) => this.extractDomain(url) === baseDomain);
  }

  /**
   * 从 URL 列表中移除重复
   * 保留第一次出现的 URL
   */
  static deduplicateUrls(urls: string[]): string[] {
    const seen = new Set<string>();
    const uniqueUrls: string[] = [];

    for (const url of urls) {
      const normalized = this.normalize(url);
      // 只保留第一次出现的 URL
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueUrls.push(url);
      }
    }

    return uniqueUrls;
  }

  /**
   * 应用 URL 过滤规则
   */
  static applyFilters(
    url: string,
    filters: { include?: string[]; exclude?: string[] }
  ): boolean {
    // 排除规则优先
    if (filters.exclude) {
      for (const pattern of filters.exclude) {
        if (url.includes(pattern)) {
          return false;
        }
      }
    }

    // 包含规则
    if (filters.include && filters.include.length > 0) {
      return filters.include.some((pattern) => url.includes(pattern));
    }

    return true;
  }
}
