/**
 * 笔记 API Composable
 * 封装笔记相关的 API 调用
 */
import type { FetchOptions } from 'ofetch'
import type { Note } from '@local-rag/shared/types'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const baseURL = '/api' as const

export function useNotesApi() {
  /**
   * 获取笔记列表
   */
  async function list(params?: { page?: number; pageSize?: number; tag?: string; search?: string }) {
    return $fetch<ApiResponse<PaginatedResponse<Note>>>('/notes', {
      baseURL,
      query: params,
    })
  }

  /**
   * 获取单个笔记
   */
  async function get(id: string) {
    return $fetch<ApiResponse<Note>>(`/notes/${id}`, { baseURL })
  }

  /**
   * 创建笔记
   */
  async function create(data: { title: string; content: string; tags?: string[] }) {
    return $fetch<ApiResponse<Note>>('/notes', {
      baseURL,
      method: 'POST',
      body: data,
    })
  }

  /**
   * 更新笔记
   */
  async function update(id: string, data: { title?: string; content?: string; tags?: string[] }) {
    return $fetch<ApiResponse<Note>>(`/notes/${id}`, {
      baseURL,
      method: 'PUT',
      body: data,
    })
  }

  /**
   * 删除笔记
   */
  async function remove(id: string) {
    return $fetch<ApiResponse<void>>(`/notes/${id}`, {
      baseURL,
      method: 'DELETE',
    })
  }

  /**
   * 搜索笔记
   */
  async function search(title: string) {
    return $fetch<ApiResponse<Note[]>>('/notes', {
      baseURL,
      query: { search: title },
    })
  }

  /**
   * 上传图片
   */
  async function uploadImage(id: string, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return $fetch<ApiResponse<{ url: string }>>(`/notes/${id}/images`, {
      baseURL,
      method: 'POST',
      body: formData,
    })
  }

  return {
    list,
    get,
    create,
    update,
    remove,
    search,
    uploadImage,
  }
}
