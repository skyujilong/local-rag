/**
 * 笔记 API
 */

import { request } from './client';
import type { Note, ApiResponse, PaginatedResponse } from '@/types';

export const notesApi = {
  /**
   * 获取笔记列表
   */
  async list(params?: {
    page?: number;
    pageSize?: number;
    tag?: string;
    search?: string;
  }): Promise<ApiResponse<PaginatedResponse<Note>>> {
    return request({
      method: 'get',
      url: '/notes',
      params,
    });
  },

  /**
   * 获取单个笔记
   */
  async get(id: string): Promise<ApiResponse<Note>> {
    return request({
      method: 'get',
      url: `/notes/${id}`,
    });
  },

  /**
   * 创建笔记
   */
  async create(data: {
    title: string;
    content: string;
    tags?: string[];
  }): Promise<ApiResponse<Note>> {
    return request({
      method: 'post',
      url: '/notes',
      data,
    });
  },

  /**
   * 更新笔记
   */
  async update(
    id: string,
    data: {
      title?: string;
      content?: string;
      tags?: string[];
    }
  ): Promise<ApiResponse<Note>> {
    return request({
      method: 'put',
      url: `/notes/${id}`,
      data,
    });
  },

  /**
   * 删除笔记
   */
  async delete(id: string): Promise<ApiResponse> {
    return request({
      method: 'delete',
      url: `/notes/${id}`,
    });
  },

  /**
   * 搜索笔记
   */
  async search(title: string): Promise<ApiResponse<Note[]>> {
    return request({
      method: 'get',
      url: '/notes/search',
      params: { title },
    });
  },

  /**
   * 上传图片
   */
  async uploadImage(noteId: string, file: File): Promise<ApiResponse<Note>> {
    const formData = new FormData();
    formData.append('image', file);

    return request({
      method: 'post',
      url: `/notes/${noteId}/images`,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * 删除图片
   */
  async deleteImage(noteId: string, imageId: string): Promise<ApiResponse<Note>> {
    return request({
      method: 'delete',
      url: `/notes/${noteId}/images/${imageId}`,
    });
  },
};
