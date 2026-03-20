/**
 * 统一错误处理工具
 */
import { createLogger, LogSystem } from '@local-rag/shared'

const logger = createLogger(LogSystem.API, 'error-handler')

const isDev = process.env.NODE_ENV === 'development'

/**
 * 处理 API 错误
 */
export function handleApiError(error: unknown, context: string) {
  logger.error(`${context} 错误`, error as Error)

  // 开发环境返回详细错误信息
  if (error instanceof Error) {
    const statusCode = (error as any).statusCode || 500

    throw createError({
      statusCode,
      statusMessage: isDev
        ? error.message
        : getGenericErrorMessage(statusCode),
    })
  }

  throw createError({
    statusCode: 500,
    statusMessage: isDev
      ? String(error)
      : '服务器内部错误，请稍后重试',
  })
}

/**
 * 根据状态码返回通用错误信息
 */
function getGenericErrorMessage(statusCode: number): string {
  const messages: Record<number, string> = {
    400: '请求参数错误',
    401: '未授权访问',
    403: '无权访问',
    404: '请求的资源不存在',
    409: '请求冲突',
    429: '请求过于频繁，请稍后重试',
    500: '服务器内部错误，请稍后重试',
    502: '网关错误',
    503: '服务暂时不可用',
  }

  return messages[statusCode] || '请求失败，请稍后重试'
}

/**
 * 创建 API 错误响应
 */
export function createErrorResponse(
  statusCode: number,
  code: string,
  message: string
) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  }
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    data,
  }
}
