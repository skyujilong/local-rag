/**
 * Crawler API Composable
 *
 * 提供爬虫相关的 API 调用方法
 */

import { ref } from 'vue';
import type {
  SinglePageConfig,
  SitemapConfig,
  RecursiveConfig,
  BatchImportRequest,
  BatchImportResponse,
} from '../../../shared/types/crawler';

const API_BASE = '/api/crawl';

export function useCrawlApi() {
  const loading = ref(false);
  const error = ref<Error | null>(null);

  /**
   * 通用请求方法
   */
  const request = async (url: string, options?: RequestInit) => {
    loading.value = true;
    error.value = null;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Request failed');
      }

      return data;
    } catch (err) {
      error.value = err as Error;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 单页面爬取
   */
  const crawlSinglePage = async (config: SinglePageConfig) => {
    return request(`${API_BASE}/single`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 解析站点地图
   */
  const parseSitemap = async (config: SitemapConfig) => {
    return request(`${API_BASE}/sitemap/parse`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 启动站点地图爬取任务
   */
  const startSitemapTask = async (config: SitemapConfig) => {
    return request(`${API_BASE}/sitemap/start`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 发现链接（递归爬取）
   */
  const discoverLinks = async (config: RecursiveConfig) => {
    return request(`${API_BASE}/recursive/discover`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 启动递归爬取任务
   */
  const startRecursiveTask = async (config: RecursiveConfig) => {
    return request(`${API_BASE}/recursive/start`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 获取任务列表
   */
  const getTasks = async (status?: string) => {
    const url = status ? `${API_BASE}/tasks?status=${status}` : `${API_BASE}/tasks`;
    return request(url);
  };

  /**
   * 获取任务详情
   */
  const getTask = async (taskId: string) => {
    return request(`${API_BASE}/tasks/${taskId}`);
  };

  /**
   * 暂停任务
   */
  const pauseTask = async (taskId: string) => {
    return request(`${API_BASE}/tasks/${taskId}/pause`, {
      method: 'POST',
    });
  };

  /**
   * 恢复任务
   */
  const resumeTask = async (taskId: string) => {
    return request(`${API_BASE}/tasks/${taskId}/resume`, {
      method: 'POST',
    });
  };

  /**
   * 终止任务
   */
  const terminateTask = async (taskId: string) => {
    return request(`${API_BASE}/tasks/${taskId}/terminate`, {
      method: 'POST',
    });
  };

  /**
   * 删除任务
   */
  const deleteTask = async (taskId: string) => {
    return request(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
    });
  };

  /**
   * 保存认证配置（Cookie）
   */
  const saveCookieAuth = async (config: { domain: string; cookies: string; name?: string }) => {
    return request(`${API_BASE}/auth/cookie`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 保存认证配置（Header）
   */
  const saveHeaderAuth = async (config: { domain: string; headerName: string; headerValue: string; name?: string }) => {
    return request(`${API_BASE}/auth/header`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 启动浏览器登录
   */
  const launchBrowser = async (config: { domain: string }) => {
    return request(`${API_BASE}/auth/launch-browser`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 完成浏览器登录
   */
  const completeBrowserLogin = async (config: { sessionId: string; name?: string }) => {
    return request(`${API_BASE}/auth/complete-login`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  };

  /**
   * 获取所有认证配置
   */
  const getAuthProfiles = async () => {
    return request(`${API_BASE}/auth/profiles`);
  };

  /**
   * 删除认证配置
   */
  const deleteAuthProfile = async (profileId: string) => {
    return request(`${API_BASE}/auth/profiles/${profileId}`, {
      method: 'DELETE',
    });
  };

  /**
   * 创建笔记
   */
  const createNote = async (note: { title: string; content: string; tags?: string[] }) => {
    return request('/api/documents/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    });
  };

  /**
   * 批量导入
   */
  const batchImport = async (requestBody: BatchImportRequest): Promise<BatchImportResponse> => {
    return request(`${API_BASE}/import`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  };

  /**
   * 获取统计信息
   */
  const getStats = async () => {
    return request(`${API_BASE}/stats`);
  };

  return {
    loading,
    error,
    crawlSinglePage,
    parseSitemap,
    startSitemapTask,
    discoverLinks,
    startRecursiveTask,
    getTasks,
    getTask,
    pauseTask,
    resumeTask,
    terminateTask,
    deleteTask,
    saveCookieAuth,
    saveHeaderAuth,
    launchBrowser,
    completeBrowserLogin,
    getAuthProfiles,
    deleteAuthProfile,
    createNote,
    batchImport,
    getStats,
  };
}
