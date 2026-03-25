/**
 * 爬虫状态管理
 */

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { CrawlerTask, CrawlerSession } from '@local-rag/shared/types';
import { useCrawlerApi } from '@/composables/useCrawlerApi';
import { useWebSocket } from '@/composables/useWebSocket';

// 浏览器环境日志工具
const logger = {
  debug: (...args: unknown[]) => console.debug('[crawler-store]', ...args),
  info: (...args: unknown[]) => console.info('[crawler-store]', ...args),
  warn: (...args: unknown[]) => console.warn('[crawler-store]', ...args),
  error: (...args: unknown[]) => console.error('[crawler-store]', ...args),
};

let createdHandlerId: symbol | null = null;
let updatedHandlerId: symbol | null = null;

export const useCrawlerStore = defineStore('crawler', () => {
  const tasks = ref<CrawlerTask[]>([]);
  const sessions = ref<CrawlerSession[]>([]);
  const loading = ref(false);
  const wsConnected = ref(false);

  // 使用 WebSocket composable
  const { isConnected, on, off, connect: connectWebSocket } = useWebSocket();

  // 监听 WebSocket 连接状态
  watch(isConnected, (connected) => {
    wsConnected.value = connected;
    logger.info('WebSocket 连接状态变化', { connected });

    // 如果连接成功，记录连接信息
    if (connected) {
      const ws = (useWebSocket() as any).getConnectionInfo?.();
      logger.info('WebSocket 连接信息', ws);
    }
  });

  /**
   * 注册 WebSocket 消息处理器
   * 只注册一次，避免重复处理消息
   */
  function registerHandlers() {
    if (createdHandlerId && updatedHandlerId) {
      logger.debug('WebSocket 处理器已注册，跳过重复注册');
      return;
    }

    logger.info('📋 [Store] 注册 WebSocket 处理器');
    createdHandlerId = on('crawler:task:created', handleTaskUpdate);
    updatedHandlerId = on('crawler:task:updated', handleTaskUpdate);
    logger.info('✅ [Store] 处理器注册完成', {
      createdId: createdHandlerId.toString(),
      updatedId: updatedHandlerId.toString(),
    });
  }

  /**
   * 取消注册 WebSocket 消息处理器
   */
  function unregisterHandlers() {
    logger.info('取消注册 WebSocket 处理器');
    if (createdHandlerId) {
      off('crawler:task:created', createdHandlerId);
      createdHandlerId = null;
    }
    if (updatedHandlerId) {
      off('crawler:task:updated', updatedHandlerId);
      updatedHandlerId = null;
    }
  }

  /**
   * 处理任务更新
   */
  function handleTaskUpdate(taskData: CrawlerTask) {
    logger.info('[DEBUG] ===== handleTaskUpdate 开始 =====', {
      taskId: taskData.id,
      status: taskData.status,
      lastUpdatedAt: taskData.lastUpdatedAt,
    });

    const index = tasks.value.findIndex(t => t.id === taskData.id);

    if (index !== -1) {
      // 更新现有任务
      const oldTask = tasks.value[index]!;
      logger.info('[DEBUG] 更新现有任务', {
        id: oldTask.id,
        oldStatus: oldTask.status,
        newStatus: taskData.status,
        hadPreviewMarkdown: !!oldTask.previewMarkdown,
        hasPreviewMarkdown: !!taskData.previewMarkdown,
      });

      // 使用 Vue 3 的响应式 API 确保更新
      const updatedTask = {
        ...oldTask,
        ...taskData,
        // 确保 previewMarkdown 被正确更新
        previewMarkdown: taskData.previewMarkdown,
        // 确保 progress 对象被正确合并
        progress: taskData.progress ?? oldTask.progress,
      };

      // 使用 splice 触发响应式更新
      tasks.value.splice(index, 1, updatedTask);

      logger.info('[DEBUG] 任务状态更新完成', {
        id: updatedTask.id,
        status: updatedTask.status,
        hasPreviewMarkdown: !!updatedTask.previewMarkdown,
        previewMarkdownLength: updatedTask.previewMarkdown?.length || 0,
        tasksListLength: tasks.value.length,
      });
    } else {
      // 新任务，添加到列表开头
      tasks.value.unshift(taskData);
      logger.info('[DEBUG] 新任务已添加', { id: taskData.id, status: taskData.status });
    }

    logger.info('[DEBUG] ===== handleTaskUpdate 结束 =====');
  }

  /**
   * 加载任务列表
   */
  async function loadTasks() {
    loading.value = true;
    const crawlerApi = useCrawlerApi();
    try {
      const response = await crawlerApi.getTasks();
      if (response.success && Array.isArray(response.data)) {
        tasks.value = response.data;
        logger.info('任务列表加载完成', { count: tasks.value.length });
      } else {
        // 确保始终是数组
        tasks.value = [];
        logger.warn('任务列表 API 返回非数组数据', { response });
      }
    } catch (error) {
      logger.error('加载任务列表失败', error as Error);
      tasks.value = [];
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 启动爬虫
   */
  async function startCrawler(data: {
    url: string;
    taskType?: 'single' | 'batch';
    contentXPath?: string;
    linksXPath?: string;
    maxLinks?: number;
  }) {
    logger.info('启动爬虫', { url: data.url, taskType: data.taskType });
    const crawlerApi = useCrawlerApi();
    const response = await crawlerApi.start(data);
    // 注意：不再手动添加任务到列表，由 WebSocket 消息统一管理
    return response.data;
  }

  /**
   * 确认开始爬取（用户点击"确认开始爬取"按钮）
   */
  async function confirmStartCrawl(taskId: string) {
    logger.info('确认开始爬取', { taskId });
    const crawlerApi = useCrawlerApi();
    const response = await crawlerApi.confirmStartCrawl(taskId);
    if (response.success && response.data) {
      const index = tasks.value.findIndex(t => t.id === taskId);
      if (index !== -1) {
        tasks.value[index] = response.data;
      }
    }
    return response;
  }

  /**
   * 取消任务
   */
  async function cancelTask(id: string) {
    logger.info('取消任务', { taskId: id });
    const crawlerApi = useCrawlerApi();
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
    logger.info('提交 XPath', { taskId, xpathLength: xpath.length });
    const crawlerApi = useCrawlerApi();
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
    logger.info('确认内容', { taskId, confirmed });
    const crawlerApi = useCrawlerApi();
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
    logger.info('关闭浏览器', { taskId });
    const crawlerApi = useCrawlerApi();
    const response = await crawlerApi.closeBrowser(taskId);
    if (response.success) {
      // 浏览器已关闭
    }
  }

  /**
   * 加载会话列表
   */
  async function loadSessions() {
    const crawlerApi = useCrawlerApi();
    try {
      const response = await crawlerApi.getSessions();
      if (response.success && response.data) {
        sessions.value = response.data;
        logger.info('会话列表加载完成', { count: sessions.value.length });
      }
    } catch (error) {
      logger.error('加载会话列表失败', error as Error);
      throw error;
    }
  }

  /**
   * 删除会话
   */
  async function deleteSession(domain: string) {
    logger.info('删除会话', { domain });
    const crawlerApi = useCrawlerApi();
    const response = await crawlerApi.deleteSession(domain);
    if (response.success) {
      sessions.value = sessions.value.filter(s => s.domain !== domain);
    }
  }

  /**
   * 批量爬取
   */
  async function batchCrawl(params: {
    taskId: string;
    linksXPath: string;
    contentXPath?: string;
    maxLinks?: number;
  }) {
    logger.info('批量爬取', params);
    const crawlerApi = useCrawlerApi();
    const response = await crawlerApi.batchCrawl(params);
    if (response.success && response.data) {
      const index = tasks.value.findIndex(t => t.id === params.taskId);
      if (index !== -1) {
        tasks.value[index] = response.data;
      }
    }
    return response;
  }

  return {
    tasks,
    sessions,
    loading,
    wsConnected,
    loadTasks,
    startCrawler,
    confirmStartCrawl,
    cancelTask,
    submitXPath,
    confirmContent,
    closeBrowser,
    loadSessions,
    deleteSession,
    connectWebSocket,
    registerHandlers,
    unregisterHandlers,
    batchCrawl,
  };
});
