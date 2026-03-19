/**
 * 爬虫状态管理
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { crawlerApi } from '@/api/crawler';
import type { CrawlerTask, CrawlerSession } from '@/types';
import { message } from '@/utils/message';

export const useCrawlerStore = defineStore('crawler', () => {
  const tasks = ref<CrawlerTask[]>([]);
  const sessions = ref<CrawlerSession[]>([]);
  const loading = ref(false);
  const wsConnected = ref(false);

  /**
   * 加载任务列表
   */
  async function loadTasks() {
    loading.value = true;
    try {
      const response = await crawlerApi.getTasks();
      if (response.success && response.data) {
        tasks.value = response.data;
      }
    } finally {
      loading.value = false;
    }
  }

  /**
   * 启动爬虫
   */
  async function startCrawler(data: {
    url: string;
    waitForAuth?: boolean;
    useXPath?: boolean;
  }) {
    const response = await crawlerApi.start(data);
    // 注意：不再手动添加任务到列表，由 WebSocket 消息统一管理
    // 这样可以避免重复添加
    return response.data;
  }

  /**
   * 取消任务
   */
  async function cancelTask(id: string) {
    const response = await crawlerApi.cancel(id);
    if (response.success && response.data) {
      const index = tasks.value.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks.value[index] = response.data!;
      }
    }
  }

  /**
   * 提交 XPath
   */
  async function submitXPath(taskId: string, xpath: string) {
    const response = await crawlerApi.submitXPath({ taskId, xpath });
    if (response.success && response.data) {
      const index = tasks.value.findIndex(t => t.id === taskId);
      if (index !== -1) {
        tasks.value[index] = response.data;
      }
    }
  }

  /**
   * 确认内容
   */
  async function confirmContent(taskId: string, confirmed: boolean) {
    const response = await crawlerApi.confirmContent({ taskId, confirmed });
    if (response.success && response.data) {
      const index = tasks.value.findIndex(t => t.id === taskId);
      if (index !== -1) {
        tasks.value[index] = response.data;
      }
      return response.data;
    }
    return undefined;
  }

  /**
   * 关闭浏览器
   */
  async function closeBrowser(taskId: string) {
    const response = await crawlerApi.closeBrowser(taskId);
    if (response.success) {
      message.success('浏览器已关闭');
    }
  }

  /**
   * 加载会话列表
   */
  async function loadSessions() {
    const response = await crawlerApi.getSessions();
    if (response.success && response.data) {
      sessions.value = response.data;
    }
  }

  /**
   * 删除会话
   */
  async function deleteSession(domain: string) {
    const response = await crawlerApi.deleteSession(domain);
    if (response.success) {
      sessions.value = sessions.value.filter(s => s.domain !== domain);
    }
  }

  /**
   * 连接 WebSocket
   */
  function connectWebSocket() {
    const ws = new WebSocket('ws://localhost:3001/ws');

    ws.onopen = () => {
      wsConnected.value = true;
      console.log('WebSocket 已连接');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('解析 WebSocket 消息失败:', error);
      }
    };

    ws.onclose = () => {
      wsConnected.value = false;
      console.log('WebSocket 已断开，3秒后重连...');
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket 错误:', error);
    };
  }

  /**
   * 处理 WebSocket 消息
   */
  function handleWebSocketMessage(message: { type: string; data: any }) {
    switch (message.type) {
      case 'crawler:task:created':
      case 'crawler:task:updated':
        const index = tasks.value.findIndex(t => t.id === message.data.id);
        if (index !== -1) {
          tasks.value[index] = message.data;
        } else {
          tasks.value.unshift(message.data);
        }
        break;
    }
  }

  return {
    tasks,
    sessions,
    loading,
    wsConnected,
    loadTasks,
    startCrawler,
    cancelTask,
    submitXPath,
    confirmContent,
    closeBrowser,
    loadSessions,
    deleteSession,
    connectWebSocket,
  };
});
