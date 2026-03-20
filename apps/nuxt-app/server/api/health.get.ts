/**
 * GET /health - API 健康检查
 */
import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  }
})
