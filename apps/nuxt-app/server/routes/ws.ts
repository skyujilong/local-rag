/**
 * WebSocket 路由
 * 使用 Nitro 的实验性 WebSocket 支持
 */
import { defineWebSocketHandler } from 'h3';
import { createLogger, LogSystem } from '@local-rag/shared';
import { getWebSocketManager, type WebSocketPeer } from '../utils/websocket-manager';

const logger = createLogger(LogSystem.API, 'websocket-route');

const wsManager = getWebSocketManager();

logger.info('WebSocket 路由已加载', {
  clientCount: wsManager.getClientCount(),
});

/**
 * 验证 WebSocket 消息的基本结构
 */
function validateMessage(data: unknown): { valid: boolean; error?: string } {
  // 检查是否为对象
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '消息必须是对象' };
  }

  const message = data as Record<string, unknown>;

  // 检查 type 字段
  if (typeof message.type !== 'string') {
    return { valid: false, error: 'type 字段必须是字符串' };
  }

  // 检查 data 字段（如果存在）
  if (message.data !== undefined && typeof message.data !== 'object') {
    return { valid: false, error: 'data 字段必须是对象' };
  }

  return { valid: true };
}

/**
 * 验证爬虫页面消息
 */
function validateCrawlerPageMessage(message: Record<string, unknown>): { valid: boolean; error?: string } {
  if (!message.data || typeof message.data !== 'object') {
    return { valid: false, error: '缺少 data 字段' };
  }

  const data = message.data as Record<string, unknown>;

  // 验证 taskId
  if (!data.taskId || typeof data.taskId !== 'string') {
    return { valid: false, error: 'taskId 必须是非空字符串' };
  }

  // 验证 url
  if (!data.url || typeof data.url !== 'string') {
    return { valid: false, error: 'url 必须是非空字符串' };
  }

  return { valid: true };
}

// 导出 WebSocket 处理器
// @ts-ignore - Nitro WebSocket experimental API
export default defineWebSocketHandler({
  message(peer: WebSocketPeer, message: Buffer) {
    try {
      const rawData = JSON.parse(message.toString());
      logger.debug('收到 WebSocket 消息', { type: rawData?.type });

      // 验证消息结构
      const validation = validateMessage(rawData);
      if (!validation.valid) {
        logger.warn('收到无效的 WebSocket 消息', {
          error: validation.error,
          rawMessage: rawData,
        });
        peer.send(JSON.stringify({
          type: 'error',
          data: { message: validation.error || '消息格式无效' },
        }));
        return;
      }

      const data = rawData as { type: string; data?: Record<string, unknown> };

      // 处理 ping 消息
      if (data.type === 'ping') {
        peer.send(JSON.stringify({ type: 'pong', data: {} }));
        logger.debug('已响应 ping 消息');
        return;
      }

      // 处理爬虫页面消息
      if (data.type === 'crawler:page:connected' ||
          data.type === 'crawler:page:navigated' ||
          data.type === 'crawler:page:unloading') {

        // 验证爬虫页面消息
        const crawlerValidation = validateCrawlerPageMessage(data);
        if (!crawlerValidation.valid) {
          logger.warn(`收到无效的 ${data.type} 消息`, {
            error: crawlerValidation.error,
          });
          return;
        }

        const crawlerData = data.data as { taskId: string; url: string; timestamp?: number };

        if (data.type === 'crawler:page:connected') {
          logger.info('爬虫页面已连接 WebSocket', {
            taskId: crawlerData.taskId,
            url: crawlerData.url,
          });
          wsManager.broadcast('crawler:page:status', {
            taskId: crawlerData.taskId,
            status: 'page_connected',
            url: crawlerData.url,
            timestamp: crawlerData.timestamp || Date.now(),
          });
          return;
        }

        if (data.type === 'crawler:page:navigated') {
          logger.info('爬虫页面导航', {
            taskId: crawlerData.taskId,
            url: crawlerData.url,
          });
          wsManager.broadcast('crawler:page:status', {
            taskId: crawlerData.taskId,
            status: 'page_navigated',
            url: crawlerData.url,
            timestamp: crawlerData.timestamp || Date.now(),
          });
          return;
        }

        if (data.type === 'crawler:page:unloading') {
          logger.info('爬虫页面即将卸载', {
            taskId: crawlerData.taskId,
            url: crawlerData.url,
          });
          wsManager.broadcast('crawler:page:status', {
            taskId: crawlerData.taskId,
            status: 'page_unloading',
            url: crawlerData.url,
          });
          return;
        }
      }

      logger.debug('未处理的 WebSocket 消息类型', { type: data.type });
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error('WebSocket 消息 JSON 解析失败', error, {
          message: message.toString(),
        });
      } else {
        logger.error('处理 WebSocket 消息失败', error as Error);
      }
    }
  },

  open(peer: WebSocketPeer) {
    wsManager.addClient(peer);
    // 发送欢迎消息
    peer.send(JSON.stringify({
      type: 'connected',
      data: { message: 'WebSocket 连接已建立' }
    }));
  },

  close(peer: WebSocketPeer, details: { code: number; reason: string }) {
    wsManager.removeClient(peer);
    logger.info('WebSocket 客户端已断开', {
      code: details.code,
      reason: details.reason,
    });
  },

  error(peer: WebSocketPeer, error: Error) {
    logger.error('WebSocket 连接错误', error);
    wsManager.removeClient(peer);
  },
});
