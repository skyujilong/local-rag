/**
 * WebSocket 消息类型定义
 */

import type { CrawlerTask } from '@local-rag/shared/types';

/**
 * WebSocket 消息类型
 */
export type WebSocketMessageType =
  // 系统消息
  | 'connected'
  | 'error'
  | 'ping'
  | 'pong'
  // 任务消息
  | 'crawler:task:created'
  | 'crawler:task:updated'
  | 'crawler:task:deleted';

/**
 * 基础 WebSocket 消息接口
 */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType | string;
  data: T;
}

/**
 * 连接成功消息
 */
export interface ConnectedMessage {
  type: 'connected';
  data: { message: string };
}

/**
 * Ping 消息
 */
export interface PingMessage {
  type: 'ping';
  data: Record<string, never>; // 空对象
}

/**
 * Pong 消息
 */
export interface PongMessage {
  type: 'pong';
  data: Record<string, never>; // 空对象
}

/**
 * 爬虫任务消息
 */
export interface CrawlerTaskMessage {
  type: 'crawler:task:created' | 'crawler:task:updated' | 'crawler:task:deleted';
  data: CrawlerTask;
}

/**
 * 错误消息
 */
export interface ErrorMessage {
  type: 'error';
  data: { message: string };
}

/**
 * 联合类型：所有可能的 WebSocket 消息
 */
export type TypedWebSocketMessage =
  | ConnectedMessage
  | PingMessage
  | PongMessage
  | CrawlerTaskMessage
  | ErrorMessage;
