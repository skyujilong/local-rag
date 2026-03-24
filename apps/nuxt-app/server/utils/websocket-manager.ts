/**
 * WebSocket 管理器
 * 使用模块级单例模式管理 WebSocket 客户端连接
 */

import { createLogger, LogSystem } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'websocket-manager');

// 定义 WebSocket Peer 类型
export interface WebSocketPeer {
  readyState: number;
  send: (data: string | Buffer) => void;
  close: (code?: number, reason?: string) => void;
  url?: string;
}

/**
 * WebSocket 客户端管理器
 */
class WebSocketManager {
  private clients = new Set<WebSocketPeer>();

  addClient(client: WebSocketPeer) {
    this.clients.add(client);
    logger.info('WebSocket 客户端已连接', {
      clientCount: this.clients.size,
      readyState: client.readyState,
    });
  }

  removeClient(client: WebSocketPeer) {
    this.clients.delete(client);
    logger.info('WebSocket 客户端已断开', { clientCount: this.clients.size });
  }

  broadcast(type: string, data: unknown) {
    const message = JSON.stringify({ type, data });

    if (type === 'crawler:task:updated') {
      const taskData = data as { id?: string; status?: string };
      logger.info('WebSocket 广播任务更新', {
        taskId: taskData.id,
        status: taskData.status,
        clientCount: this.clients.size,
      });

      if (this.clients.size === 0) {
        logger.warn('WebSocket 没有连接的客户端，消息无法发送', {
          type,
          taskId: taskData.id,
        });
      }
    }

    const failedClients: Set<WebSocketPeer> = new Set();
    for (const client of this.clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message);
        } catch (error) {
          logger.error('WebSocket 发送消息失败', error as Error);
          failedClients.add(client);
        }
      }
    }

    for (const client of failedClients) {
      this.removeClient(client);
    }
  }

  getClientCount() {
    return this.clients.size;
  }
}

// 模块级单例
let wsManagerInstance: WebSocketManager | null = null;

/**
 * 获取 WebSocket 管理器实例（单例）
 */
export function getWebSocketManager(): WebSocketManager {
  if (!wsManagerInstance) {
    wsManagerInstance = new WebSocketManager();
    logger.info('WebSocketManager 实例已创建');
  }
  return wsManagerInstance;
}

/**
 * 重置 WebSocket 管理器（用于测试或热重载）
 */
export function resetWebSocketManager() {
  wsManagerInstance = null;
  logger.info('WebSocketManager 实例已重置');
}
