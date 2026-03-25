/**
 * WebSocket 管理器
 * 使用模块级单例模式管理 WebSocket 客户端连接
 */

import { createLogger, LogSystem } from '@local-rag/shared';
import type { CrawlerTask } from '@local-rag/shared/types';

const logger = createLogger(LogSystem.API, 'websocket-manager');

// 定义 WebSocket Peer 类型
export interface WebSocketPeer {
  readyState: number;
  send: (data: string | Buffer) => void;
  close: (code?: number, reason?: string) => void;
  url?: string;
}

// 状态快照接口
interface StateSnapshot {
  tasks: CrawlerTask[];
  timestamp: number;
  version: number;
}

/**
 * WebSocket 客户端管理器
 */
class WebSocketManager {
  private clients = new Set<WebSocketPeer>();
  private latestSnapshot: StateSnapshot | null = null;

  addClient(client: WebSocketPeer) {
    this.clients.add(client);
    logger.info('WebSocket 客户端已连接', {
      clientCount: this.clients.size,
      readyState: client.readyState,
    });

    // 客户端连接时推送最新状态
    this.pushLatestState(client);
  }

  /**
   * 更新状态快照
   * 每次任务状态变化时调用
   */
  updateSnapshot(tasks: CrawlerTask[]) {
    this.latestSnapshot = {
      tasks: tasks.map(t => ({ ...t })), // 深拷贝
      timestamp: Date.now(),
      version: (this.latestSnapshot?.version || 0) + 1,
    };

    logger.debug('任务快照已更新', {
      taskCount: tasks.length,
      version: this.latestSnapshot.version,
    });
  }

  /**
   * 推送最新状态给指定客户端
   * 在客户端连接/重连时调用
   */
  private pushLatestState(client: WebSocketPeer) {
    if (!this.latestSnapshot) {
      logger.debug('无状态快照可推送');
      return;
    }

    try {
      const message = JSON.stringify({
        type: 'state:sync',
        data: this.latestSnapshot,
      });

      client.send(message);

      logger.info('📤 [WS Manager] 推送最新状态给客户端', {
        version: this.latestSnapshot.version,
        taskCount: this.latestSnapshot.tasks.length,
        clientCount: this.clients.size,
      });
    } catch (error) {
      logger.error('推送状态失败', error as Error);
    }
  }

  removeClient(client: WebSocketPeer) {
    this.clients.delete(client);
    logger.info('WebSocket 客户端已断开', { clientCount: this.clients.size });
  }

  broadcast(type: string, data: unknown) {
    const message = JSON.stringify({ type, data });

    logger.info('📤 [WS Manager] 准备广播', {
      type,
      clientCount: this.clients.size,
      messageLength: message.length,
    });

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
        return;
      }
    }

    const failedClients: Set<WebSocketPeer> = new Set();
    let successCount = 0;

    for (const client of this.clients) {
      try {
        client.send(message);
        successCount++;
        logger.info('✅ [WS Manager] 消息已发送', {
          type,
          messagePreview: message.slice(0, 200),
        });
      } catch (error) {
        logger.error('❌ [WS Manager] 发送消息失败', error as Error);
        failedClients.add(client);
      }
    }

    logger.info('📊 [WS Manager] 广播完成', {
      totalClients: this.clients.size,
      successCount,
      failedCount: failedClients.size,
    });

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
