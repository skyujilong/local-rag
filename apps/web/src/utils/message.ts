/**
 * Naive UI 消息提示工具
 * 提供统一的消息提示接口
 */

import { useMessage, type MessageOptions } from 'naive-ui';

/**
 * 消息提示实例
 */
let messageApi: ReturnType<typeof useMessage> | null = null;

/**
 * 初始化消息提示
 * 应该在应用根组件中调用
 */
export function setupMessage() {
  messageApi = useMessage();
}

/**
 * 消息提示工具
 */
export const message = {
  /**
   * 成功消息
   */
  success: (content: string, duration = 3000) => {
    if (!messageApi) {
      console.warn('Message API not initialized. Call setupMessage() first.');
      return;
    }
    return messageApi.success(content, { duration });
  },

  /**
   * 错误消息
   */
  error: (content: string, duration = 4000) => {
    if (!messageApi) {
      console.warn('Message API not initialized. Call setupMessage() first.');
      return;
    }
    return messageApi.error(content, { duration });
  },

  /**
   * 警告消息
   */
  warning: (content: string, duration = 3000) => {
    if (!messageApi) {
      console.warn('Message API not initialized. Call setupMessage() first.');
      return;
    }
    return messageApi.warning(content, { duration });
  },

  /**
   * 信息消息
   */
  info: (content: string, duration = 3000) => {
    if (!messageApi) {
      console.warn('Message API not initialized. Call setupMessage() first.');
      return;
    }
    return messageApi.info(content, { duration });
  },

  /**
   * 加载消息
   */
  loading: (content: string, duration = 3000) => {
    if (!messageApi) {
      console.warn('Message API not initialized. Call setupMessage() first.');
      return;
    }
    return messageApi.loading(content, { duration });
  },

  /**
   * 自定义消息
   */
  create: (options: MessageOptions) => {
    if (!messageApi) {
      console.warn('Message API not initialized. Call setupMessage() first.');
      return;
    }
    return messageApi.create(options as any);
  },
};
