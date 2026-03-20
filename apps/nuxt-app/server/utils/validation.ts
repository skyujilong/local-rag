/**
 * 输入验证工具
 */
import { createLogger, LogSystem } from '@local-rag/shared'

const logger = createLogger(LogSystem.API, 'validation')

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * 验证 URL 并抛出错误
 */
export function validateUrl(url: string, fieldName = 'URL'): void {
  if (!url || typeof url !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 不能为空`,
    })
  }

  if (!isValidUrl(url)) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 格式无效，必须以 http:// 或 https:// 开头`,
    })
  }
}

/**
 * 验证字符串长度
 */
export function validateStringLength(
  value: string,
  minLength: number,
  maxLength: number,
  fieldName = '值'
): void {
  if (typeof value !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 必须是字符串`,
    })
  }

  if (value.length < minLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 长度不能少于 ${minLength} 个字符`,
    })
  }

  if (value.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 长度不能超过 ${maxLength} 个字符`,
    })
  }
}

/**
 * 验证 XPath 表达式
 */
export function validateXPath(xpath: string): void {
  if (!xpath || typeof xpath !== 'string' || xpath.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: '请提供有效的 XPath 表达式',
    })
  }

  const trimmed = xpath.trim()

  // 检查长度
  if (trimmed.length > 1000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'XPath 表达式过长（最大 1000 字符）',
    })
  }

  // 检查危险模式
  const dangerousPatterns = [
    'document(',
    'system-property(',
    'import ',
    'eval(',
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:',
  ]

  for (const pattern of dangerousPatterns) {
    if (trimmed.includes(pattern)) {
      throw createError({
        statusCode: 400,
        statusMessage: `包含不安全的 XPath 表达式（禁止使用: ${pattern}）`,
      })
    }
  }
}

/**
 * 验证 ID 格式
 */
export function validateId(id: string, fieldName = 'ID'): void {
  if (!id || typeof id !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 不能为空`,
    })
  }

  if (id.length < 1 || id.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 长度无效`,
    })
  }
}

/**
 * 验证分页参数
 */
export function validatePaginationParams(params: { page?: number; pageSize?: number }) {
  const page = params.page ? Number(params.page) : 1
  const pageSize = params.pageSize ? Number(params.pageSize) : 20

  if (isNaN(page) || page < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: '页码必须大于 0',
    })
  }

  if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: '每页数量必须在 1-100 之间',
    })
  }

  return { page, pageSize }
}
