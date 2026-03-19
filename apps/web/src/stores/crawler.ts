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
    if (response.success) {
      const index = tasks.value.findIndex(t => t.id === taskId);
      if (index !== -1 && response.data) {
        tasks.value[index] = response.data;
      }
      return response; // 返回完整响应，包含 message
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
    const isDev = import.meta.env.DEV;
    // 根据环境动态选择 WebSocket URL
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      wsConnected.value = true;
      if (isDev) {
        console.log('[WebSocket] 已连接');
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (isDev) {
          console.log('[WebSocket] 消息接收:', message.type);
        }
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('[WebSocket] 解析消息失败:', error);
      }
    };

    ws.onclose = () => {
      wsConnected.value = false;
      if (isDev) {
        console.log('[WebSocket] 已断开，3秒后重连...');
      }
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] 错误:', error);
    };
  }

  /**
   * 处理 WebSocket 消息
   */
  function handleWebSocketMessage(message: { type: string; data: any }) {
    const isDev = import.meta.env.DEV;
    if (isDev) {
      console.log('[WebSocket] 处理消息:', message.type);
    }

    switch (message.type) {
      case 'crawler:task:created':
      case 'crawler:task:updated': {
        const taskData = message.data;
        if (isDev) {
          console.log('[WebSocket] 任务数据详情:', {
            id: taskData.id,
            status: taskData.status,
            hasPreviewMarkdown: !!taskData.previewMarkdown,
            previewMarkdownLength: taskData.previewMarkdown?.length || 0,
            progress: taskData.progress,
            lastUpdatedAt: taskData.lastUpdatedAt,
          });
        }

        const index = tasks.value.findIndex(t => t.id === message.data.id);

        if (index !== -1) {
          // 使用 Vue 3 的响应式 API 确保更新
          const updatedTask = {
            ...tasks.value[index],
            ...message.data,
            // 确保 previewMarkdown 被正确更新
            previewMarkdown: message.data.previewMarkdown,
            // 确保 progress 对象被正确合并（使用 ?? 只在 undefined 时回退）
            progress: message.data.progress ?? tasks.value[index].progress,
          };

          // 使用 splice 触发响应式更新
          tasks.value.splice(index, 1, updatedTask);

          if (isDev) {
            console.log('[WebSocket] 任务已更新:', updatedTask.id, updatedTask.status, {
              previewMarkdownLength: updatedTask.previewMarkdown?.length,
              progress: updatedTask.progress,
            });
          }
        } else {
          // 新任务，添加到列表开头
          tasks.value.unshift(message.data);
          if (isDev) {
            console.log('[WebSocket] 新任务已创建:', message.data.id);
          }
        }
        break;
      }
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
