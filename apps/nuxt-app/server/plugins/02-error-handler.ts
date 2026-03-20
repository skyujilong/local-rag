/**
 * 全局错误处理插件
 * 统一处理 API 错误响应
 */
import { createLogger, LogSystem } from '@local-rag/shared'

const logger = createLogger(LogSystem.API, 'error-handler')

const isDev = process.env.NODE_ENV === 'development'

export default defineNitroPlugin((nitroApp) => {
  // 全局错误处理
  nitroApp.hooks.hook('error', (error: any, { event }) => {
    const url = event?.node?.req?.url || 'unknown'
    logger.error('Nitro 错误', error, { url })

    // 如果已经有响应，不处理
    if (!event || !event.node) {
      return
    }

    const statusCode = error.statusCode || 500
    const errorCode = error.code || 'INTERNAL_ERROR'

    // 根据环境返回不同的错误信息
    const message = isDev
      ? (error.message || 'Internal Server Error')
      : getGenericErrorMessage(statusCode)

    // 设置响应
    event.node.res.statusCode = statusCode
    event.node.res.setHeader('Content-Type', 'application/json')

    const response = {
      success: false,
      error: {
        code: errorCode,
        message,
        // 开发环境添加堆栈跟踪
        ...(isDev && { stack: error.stack }),
      },
    }

    event.node.res.end(JSON.stringify(response))
  })
})

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
