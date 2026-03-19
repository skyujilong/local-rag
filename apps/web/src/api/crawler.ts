/**
 * 爬虫 API
 */

import { request } from './client';
import type { CrawlerTask, CrawlerSession, ApiResponse, XPathSubmitRequest, ContentConfirmRequest } from '@/types';

export const crawlerApi = {
  /**
   * 获取任务列表
   */
  async getTasks(): Promise<ApiResponse<CrawlerTask[]>> {
    return request({
      method: 'get',
      url: '/crawler/tasks',
    });
  },

  /**
   * 获取单个任务
   */
  async getTask(id: string): Promise<ApiResponse<CrawlerTask>> {
    return request({
      method: 'get',
      url: `/crawler/tasks/${id}`,
    });
  },

  /**
   * 启动爬虫
   */
  async start(data: {
    url: string;
    waitForAuth?: boolean;
    useXPath?: boolean;
  }): Promise<ApiResponse<CrawlerTask>> {
    return request({
      method: 'post',
      url: '/crawler/start',
      data,
    });
  },

  /**
   * 取消任务
   */
  async cancel(id: string): Promise<ApiResponse<CrawlerTask>> {
    return request({
      method: 'post',
      url: `/crawler/tasks/${id}/cancel`,
    });
  },

  /**
   * 提交 XPath
   */
  async submitXPath(data: XPathSubmitRequest): Promise<ApiResponse<CrawlerTask>> {
    return request({
      method: 'post',
      url: '/crawler/xpath',
      data,
    });
  },

  /**
   * 确认内容
   */
  async confirmContent(data: ContentConfirmRequest): Promise<ApiResponse<CrawlerTask>> {
    return request({
      method: 'post',
      url: '/crawler/confirm',
      data,
    });
  },

  /**
   * 关闭浏览器
   */
  async closeBrowser(taskId: string): Promise<ApiResponse> {
    return request({
      method: 'post',
      url: '/crawler/close-browser',
      data: { taskId },
    });
  },

  /**
   * 获取会话列表
   */
  async getSessions(): Promise<ApiResponse<CrawlerSession[]>> {
    return request({
      method: 'get',
      url: '/crawler/sessions',
    });
  },

  /**
   * 删除会话
   */
  async deleteSession(domain: string): Promise<ApiResponse> {
    return request({
      method: 'delete',
      url: `/crawler/sessions/${domain}`,
    });
  },
};
