/**
 * Nitro WebSocket API 类型定义
 * 为实验性 WebSocket API 提供类型支持
 */

import 'h3';

declare module 'h3' {
  /**
   * WebSocket Peer 接口
   * 代表一个 WebSocket 连接的对等端
   */
  export interface WebSocketPeer {
    /** 连接状态: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED */
    readyState: number;
    /** 发送消息到对等端 */
    send: (data: string | Buffer) => void;
    /** 关闭连接 */
    close: (code?: number, reason?: string) => void;
    /** WebSocket URL（可选） */
    url?: string;
  }

  /**
   * WebSocket 处理器选项
   */
  export interface WebSocketHandlerOptions {
    /** 处理接收到的消息 */
    message?: (peer: WebSocketPeer, message: Buffer) => void | Promise<void>;
    /** 处理连接打开 */
    open?: (peer: WebSocketPeer) => void | Promise<void>;
    /** 处理连接关闭 */
    close?: (peer: WebSocketPeer, details: { code: number; reason: string }) => void | Promise<void>;
    /** 处理连接错误 */
    error?: (peer: WebSocketPeer, error: Error) => void | Promise<void>;
  }

  /**
   * 定义 WebSocket 处理器
   * Nitro 实验性 WebSocket API
   */
  export function defineWebSocketHandler(options: WebSocketHandlerOptions): any;
}
