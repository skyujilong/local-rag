/**
 * 存储管理 API
 */

import { request } from './client';
import type { ApiResponse } from '@/types';

export const storageApi = {
  /**
   * 获取已索引文件列表
   */
  async getFiles(path?: string): Promise<ApiResponse> {
    return request({
      method: 'get',
      url: '/storage/files',
      params: { path },
    });
  },

  /**
   * 索引文件或目录
   */
  async indexPath(data: {
    path: string;
    recursive?: boolean;
  }): Promise<ApiResponse> {
    return request({
      method: 'post',
      url: '/storage/index',
      data,
    });
  },

  /**
   * 删除已索引文件
   */
  async deleteFile(documentId: string): Promise<ApiResponse> {
    return request({
      method: 'delete',
      url: `/storage/files/${documentId}`,
    });
  },

  /**
   * 获取忽略规则
   */
  async getIgnoreRules(): Promise<ApiResponse> {
    return request({
      method: 'get',
      url: '/storage/ignore',
    });
  },

  /**
   * 更新忽略规则
   */
  async updateIgnoreRules(data: {
    custom: string[];
  }): Promise<ApiResponse> {
    return request({
      method: 'put',
      url: '/storage/ignore',
      data,
    });
  },
};
