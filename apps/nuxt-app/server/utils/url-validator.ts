/**
 * URL 验证工具
 * 防止 SSRF 攻击和非法 URL 访问
 */

import { createLogger, LogSystem } from '@local-rag/shared';
import { URL } from 'node:url';

const logger = createLogger(LogSystem.API, 'url-validator');

/**
 * URL 验证配置
 */
const URL_CONFIG = {
  ALLOWED_PROTOCOLS: ['http:', 'https:'],
  MAX_URL_LENGTH: 2048,
  // 私有 IP 地址范围
  PRIVATE_IP_PATTERNS: [
    /^127\./,
    /^0\.0\.0\.0$/,
    /^localhost$/,
    /^::1$/,
    /^0:0:0:0:0:0:0:1$/,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^fc00:/i,  // IPv6 私有地址
    /^fe80:/i,  // IPv6 链路本地地址
  ],
  // 默认允许的端口范围（避免访问常见服务端口）
  // 如果需要更严格的控制，可以启用
  // RESTRICTED_PORTS: [22, 23, 25, 53, 135, 139, 445, 3389, 5432, 5900, 6379, 8080, 9200],
} as const;

/**
 * 检查是否为私有 IP 地址
 */
function isPrivateIP(hostname: string): boolean {
  // 移除端口号
  const hostWithoutPort = hostname.split(':')[0];

  // 检查是否匹配私有 IP 模式
  for (const pattern of URL_CONFIG.PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostWithoutPort)) {
      return true;
    }
  }

  return false;
}

/**
 * 验证爬取 URL 是否安全
 */
export function validateCrawlUrl(
  url: string,
  baseUrl: string,
  options: {
    allowPrivateIP?: boolean;
    allowedDomains?: string[];
    maxRedirects?: number;
  } = {}
): { valid: boolean; error?: string; sanitizedUrl?: string } {
  const {
    allowPrivateIP = false,
    allowedDomains,
    maxRedirects = 5,
  } = options;

  try {
    // 基础检查
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'URL 不能为空' };
    }

    const trimmed = url.trim();

    // 长度检查
    if (trimmed.length > URL_CONFIG.MAX_URL_LENGTH) {
      return { valid: false, error: `URL 长度不能超过 ${URL_CONFIG.MAX_URL_LENGTH} 字符` };
    }

    // 解析 URL
    let parsed: URL;
    try {
      parsed = new URL(trimmed, baseUrl);
    } catch (error) {
      return { valid: false, error: 'URL 格式不正确' };
    }

    // 协议检查
    if (!URL_CONFIG.ALLOWED_PROTOCOLS.includes(parsed.protocol as any)) {
      return { valid: false, error: `只允许 HTTP 和 HTTPS 协议，不支持: ${parsed.protocol}` };
    }

    // 主机名检查
    const hostname = parsed.hostname;
    if (!hostname) {
      return { valid: false, error: 'URL 必须包含有效的主机名' };
    }

    // SSRF 防护：检查私有 IP
    if (!allowPrivateIP && isPrivateIP(hostname)) {
      logger.warn('阻止访问私有 IP 地址', { hostname, url: trimmed });
      return { valid: false, error: '不允许访问私有 IP 地址或内网地址' };
    }

    // 域名白名单检查（如果提供）
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain => {
        // 完全匹配或子域名匹配
        return hostname === domain || hostname.endsWith(`.${domain}`);
      });

      if (!isAllowed) {
        logger.warn('域名不在白名单中', { hostname, allowedDomains });
        return { valid: false, error: `域名 ${hostname} 不在允许的白名单中` };
      }
    }

    // 端口检查（可选，如果启用 RESTRICTED_PORTS）
    // if (URL_CONFIG.RESTRICTED_PORTS.includes(parseInt(parsed.port) || 80)) {
    //   return { valid: false, error: '不允许访问该端口' };
    // }

    // 移除潜在的敏感参数
    parsed.searchParams.delete('token');
    parsed.searchParams.delete('api_key');
    parsed.searchParams.delete('password');
    parsed.searchParams.delete('secret');

    const sanitizedUrl = parsed.toString();

    return { valid: true, sanitizedUrl };
  } catch (error) {
    logger.error('URL 验证失败', error as Error, { url });
    return { valid: false, error: 'URL 验证过程中发生错误' };
  }
}

/**
 * 批量验证 URL 列表
 */
export function validateCrawlUrls(
  urls: string[],
  baseUrl: string,
  options?: Parameters<typeof validateCrawlUrl>[2]
): { valid: string[]; invalid: Array<{ url: string; error: string }> } {
  const valid: string[] = [];
  const invalid: Array<{ url: string; error: string }> = [];

  for (const url of urls) {
    const result = validateCrawlUrl(url, baseUrl, options || {});
    if (result.valid && result.sanitizedUrl) {
      valid.push(result.sanitizedUrl);
    } else {
      invalid.push({ url, error: result.error || '未知错误' });
    }
  }

  return { valid, invalid };
}

/**
 * 从 URL 提取域名
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return '';
  }
}

/**
 * 检查两个 URL 是否属于同一域名
 */
export function isSameDomain(url1: string, url2: string): boolean {
  const domain1 = extractDomain(url1);
  const domain2 = extractDomain(url2);
  return domain1 !== '' && domain1 === domain2;
}
