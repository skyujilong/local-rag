/**
 * 知识库 API
 */

import { request } from './client';
import type { Document, ApiResponse, PaginatedResponse } from '@/types';

export const knowledgeApi = {
  /**
   * 获取文档列表
   */
  async list(params?: {
    page?: number;
    pageSize?: number;
    type?: string;
    search?: string;
  }): Promise<ApiResponse<PaginatedResponse<Document>>> {
    return request({
      method: 'get',
      url: '/knowledge',
      params,
    });
  },

  /**
   * 获取单个文档
   */
  async get(id: string): Promise<ApiResponse<Document>> {
    return request({
      method: 'get',
      url: `/knowledge/${id}`,
    });
  },

  /**
   * 搜索文档
   */
  async search(keywords: string[]): Promise<ApiResponse<Document[]>> {
    return request({
      method: 'post',
      url: '/knowledge/search',
      data: { keywords },
    });
  },

  /**
   * 删除文档
   */
  async delete(id: string): Promise<ApiResponse> {
    return request({
      method: 'delete',
      url: `/knowledge/${id}`,
    });
  },

  /**
   * 重新索引
   */
  async reindex(): Promise<ApiResponse> {
    return request({
      method: 'post',
      url: '/knowledge/reindex',
    });
  },
};
