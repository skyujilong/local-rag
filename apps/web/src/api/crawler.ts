/**
 * 爬虫 API
 */

import { request } from './client';
import type { CrawlerTask, CrawlerSession, ApiResponse } from '@/types';

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
