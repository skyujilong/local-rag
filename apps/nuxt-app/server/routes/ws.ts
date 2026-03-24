/**
 * WebSocket 路由
 * 使用 Nitro 的实验性 WebSocket 支持
 */
import { defineWebSocketHandler } from 'h3'
import { createLogger, LogSystem } from '@local-rag/shared'

const logger = createLogger(LogSystem.API, 'websocket-route')

// WebSocket 客户端管理器
class WebSocketManager {
  private clients = new Set<any>()

  addClient(client: any) {
    this.clients.add(client)
    logger.info('WebSocket 客户端已连接', {
      clientCount: this.clients.size,
      readyState: client.readyState,
    })
  }

  removeClient(client: any) {
    this.clients.delete(client)
    logger.info('WebSocket 客户端已断开', { clientCount: this.clients.size })
  }

  broadcast(type: string, data: any) {
    const message = JSON.stringify({ type, data })

    if (type === 'crawler:task:updated') {
      logger.info('WebSocket 广播任务更新', {
        taskId: (data as any).id,
        status: (data as any).status,
        clientCount: this.clients.size,
      })

      // 如果没有客户端连接，记录警告
      if (this.clients.size === 0) {
        logger.warn('WebSocket 没有连接的客户端，消息无法发送', {
          type,
          taskId: (data as any).id,
        })
      }
    }

    const failedClients: Set<any> = new Set()
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message)
        } catch (error) {
          logger.error('WebSocket 发送消息失败', error as Error)
          failedClients.add(client)
        }
      }
    }

    for (const client of failedClients) {
      this.removeClient(client)
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

logger.info('WebSocket 路由已加载', {
  hasGlobalWsManager: !!(globalThis as any).__wsManager,
})

// 导出 WebSocket 处理器
// @ts-ignore - Nitro WebSocket experimental API
export default defineWebSocketHandler({
  message(peer, message) {
    logger.debug('收到 WebSocket 消息', {
      data: message.toString(),
    })
  },
  open(peer) {
    wsManager.addClient(peer)
    // 发送欢迎消息
    peer.send(JSON.stringify({
      type: 'connected',
      data: { message: 'WebSocket 连接已建立' }
    }))
  },
  close(peer, details) {
    wsManager.removeClient(peer)
    logger.info('WebSocket 客户端已断开', {
      code: details.code,
      reason: details.reason,
    })
  },
  error(peer, error) {
    logger.error('WebSocket 连接错误', error)
    wsManager.removeClient(peer)
  },
})
