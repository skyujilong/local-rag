/**
 * API 客户端
 */

import axios from 'axios';
import type { ApiResponse } from '@/types';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { data } = error.response;
      return Promise.reject({
        code: data?.error?.code || 'API_ERROR',
        message: data?.error?.message || '请求失败',
        details: data?.error?.details,
      });
    }
    return Promise.reject(error);
  }
);

/**
 * 通用请求方法
 */
export async function request<T = any>(config: {
  method: 'get' | 'post' | 'put' | 'delete';
  url: string;
  data?: any;
  params?: any;
  headers?: Record<string, string>;
}): Promise<ApiResponse<T>> {
  const response = await apiClient.request<ApiResponse<T>>(config);
  return response.data;
}

export default apiClient;
