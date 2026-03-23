/**
 * XPath 验证工具
 * 防止 XPath 注入攻击
 */

import { createLogger, LogSystem } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'xpath-validator');

/**
 * XPath 验证配置
 */
const XPATH_CONFIG = {
  MAX_LENGTH: 500,
  MAX_NESTING_DEPTH: 10,
  ALLOWED_AXIS: ['child', 'descendant', 'attribute', 'self', 'descendant-or-self'],
  DANGEROUS_PATTERNS: [
    'document(',
    'eval(',
    'script:',
    'javascript:',
    'import ',
    'include ',
    'xsl:',
    'fn:',
    'php:',
    'java:',
  ],
} as const;

/**
 * 验证 XPath 表达式是否安全
 */
export function validateXPath(xpath: string): { valid: boolean; error?: string } {
  // 基础检查
  if (!xpath || typeof xpath !== 'string') {
    return { valid: false, error: 'XPath 不能为空' };
  }

  const trimmed = xpath.trim();

  // 长度检查
  if (trimmed.length > XPATH_CONFIG.MAX_LENGTH) {
    return { valid: false, error: `XPath 长度不能超过 ${XPATH_CONFIG.MAX_LENGTH} 字符` };
  }

  // 空字符串检查
  if (trimmed.length === 0) {
    return { valid: false, error: 'XPath 不能为空' };
  }

  // 危险模式检查
  const lowerXPath = trimmed.toLowerCase();
  for (const pattern of XPATH_CONFIG.DANGEROUS_PATTERNS) {
    if (lowerXPath.includes(pattern)) {
      logger.warn('检测到危险 XPath 模式', { pattern, xpath: trimmed });
      return { valid: false, error: `XPath 包含危险内容: ${pattern}` };
    }
  }

  // 基础语法验证（白名单模式）
  // 允许的模式：//tagName, //tagName[@attr='value'], //tagName[@attr="value"]
  //                  /tagName, //tagName1//tagName2, //*[@attr='value']
  const basicXPathPattern = /^(?:(\/\/|\/)[\w*:*\-]*)+(?:\[@[\w:*\-]+(?:\s*=\s*['"][^'"]*['"])?\])?(?:\/[\/]?[\w:*\-]*)*$/;

  if (!basicXPathPattern.test(trimmed)) {
    // 尝试更宽松的验证（允许函数调用，但不包括危险函数）
    const relaxedPattern = /^(?:(\/\/|\/)[\w:*\-]*)+(?:\[@[\w:*\-]+(?:\s*=\s*['"][^'"]*['"])?\])?(?:\/[\/]?[\w:*\-]*)*(?:\[[\d]+\])?$/;
    if (!relaxedPattern.test(trimmed)) {
      return { valid: false, error: 'XPath 格式不正确，请使用基础 XPath 表达式' };
    }
  }

  // 嵌套深度检查
  const depth = (trimmed.match(/\//g) || []).length;
  if (depth > XPATH_CONFIG.MAX_NESTING_DEPTH) {
    return { valid: false, error: `XPath 嵌套深度不能超过 ${XPATH_CONFIG.MAX_NESTING_DEPTH} 层` };
  }

  return { valid: true };
}

/**
 * 清理和规范化 XPath 表达式
 */
export function sanitizeXPath(xpath: string): string {
  return xpath.trim().replace(/\s+/g, ' ');
}

/**
 * 验证并清理 XPath（便捷函数）
 */
export function validateAndSanitizeXPath(xpath: string): string {
  const result = validateXPath(xpath);
  if (!result.valid) {
    throw new Error(result.error);
  }
  return sanitizeXPath(xpath);
}
