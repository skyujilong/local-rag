/**
 * WebSocket 路由
 * 使用 Nitro 的实验性 WebSocket 支持
 */
import { createLogger, LogSystem } from '@local-rag/shared'
import { WebSocketServer } from 'ws'
import { IncomingMessage } from 'http'

const logger = createLogger(LogSystem.API, 'websocket-route')

// WebSocket 客户端管理器（简化版）
class WebSocketManager {
  private clients = new Set<any>()
  private wss: WebSocketServer | null = null

  init(wss: WebSocketServer) {
    this.wss = wss
    this.setupServer()
  }

  private setupServer() {
    if (!this.wss) return

    this.wss.on('connection', (ws: any, req: IncomingMessage) => {
      this.clients.add(ws)
      logger.info('WebSocket 客户端已连接', {
        clientCount: this.clients.size,
        url: req.url,
      })

      ws.on('message', (data: any) => {
        logger.debug('收到 WebSocket 消息', {
          data: data.toString(),
        })
      })

      ws.on('close', () => {
        this.clients.delete(ws)
        logger.info('WebSocket 客户端已断开', {
          clientCount: this.clients.size,
        })
      })

      ws.on('error', (error: Error) => {
        logger.error('WebSocket 连接错误', error, {
          clientCount: this.clients.size,
        })
        this.clients.delete(ws)
      })

      // 发送欢迎消息
      ws.send(JSON.stringify({
        type: 'connected',
        data: { message: 'WebSocket 连接已建立' }
      }))
    })
  }

  broadcast(type: string, data: any) {
    if (!this.wss) {
      logger.warn('WebSocket 服务器未初始化，无法广播', { type })
      return
    }

    const message = JSON.stringify({ type, data })

    if (type === 'crawler:task:updated') {
      logger.info('WebSocket 广播任务更新', {
        taskId: data.id,
        status: data.status,
        clientCount: this.clients.size,
      })
    }

    const failedClients: Set<any> = new Set()
    for (const client of this.clients) {
      if (client.readyState === 1) {
        try {
          client.send(message)
        } catch (error) {
          logger.error('WebSocket 发送消息失败', error as Error)
          failedClients.add(client)
        }
      }
    }

    for (const client of failedClients) {
      this.clients.delete(client)
    }
  }

  getClientCount() {
    return this.clients.size
  }
}

// 创建全局管理器实例
const wsManager = new WebSocketManager()

// 暴露给全局
;(globalThis as any).__wsManager = wsManager

// 导出 WebSocket 处理器
export default defineWebSocketHandler({
  async upgrade(req, socket, head) {
    logger.info('WebSocket 升级请求', { url: req.url })

    try {
      // 获取底层 HTTP 服务器
      const { event } = useWebSocket()
      const server = (event.node?.req as any)?.socket?.server

      if (!server) {
        logger.error('无法获取 HTTP 服务器')
        socket.destroy()
        return
      }

      // 创建 WebSocket 服务器（如果还没创建）
      const wss = new WebSocketServer({ noServer: true })
      wsManager.init(wss)

      // 处理升级请求
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })

      logger.info('WebSocket 升级成功')
    } catch (error) {
      logger.error('WebSocket 升级失败', error as Error)
      socket.destroy()
    }
  },
})
