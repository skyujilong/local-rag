/**
 * 笔记状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Note } from '@local-rag/shared/types'

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const currentNote = ref<Note | null>(null)
  const loading = ref(false)
  const pagination = ref({
    page: 1,
    pageSize: 20,
    total: 0,
  })

  const hasMore = computed(() => {
    return pagination.value.page * pagination.value.pageSize < pagination.value.total
  })

  /**
   * 加载笔记列表
   */
  async function loadNotes(params?: {
    page?: number
    pageSize?: number
    tag?: string
    search?: string
  }) {
    loading.value = true
    const notesApi = useNotesApi()
    try {
      const response = await notesApi.list({
        page: params?.page || pagination.value.page,
        pageSize: params?.pageSize || pagination.value.pageSize,
        tag: params?.tag,
        search: params?.search,
      })

      if (response.success && response.data) {
        notes.value = response.data.items
        pagination.value.total = response.data.total
        pagination.value.page = response.data.page
        pagination.value.pageSize = response.data.pageSize
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载单个笔记
   */
  async function loadNote(id: string) {
    loading.value = true
    const notesApi = useNotesApi()
    try {
      const response = await notesApi.get(id)
      if (response.success && response.data) {
        currentNote.value = response.data
      }
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建笔记
   */
  async function createNote(data: {
    title: string
    content: string
    tags?: string[]
  }) {
    const notesApi = useNotesApi()
    const response = await notesApi.create(data)
    if (response.success && response.data) {
      notes.value.unshift(response.data)
      return response.data
    }
    return undefined
  }

  /**
   * 更新笔记
   */
  async function updateNote(
    id: string,
    data: {
      title?: string
      content?: string
      tags?: string[]
    }
  ) {
    const notesApi = useNotesApi()
    const response = await notesApi.update(id, data)
    if (response.success && response.data) {
      const index = notes.value.findIndex(n => n.id === id)
      if (index !== -1) {
        notes.value[index] = response.data
      }
      if (currentNote.value?.id === id) {
        currentNote.value = response.data
      }
      return response.data
    }
    return undefined
  }

  /**
   * 删除笔记
   */
  async function deleteNote(id: string) {
    const notesApi = useNotesApi()
    const response = await notesApi.remove(id)
    if (response.success) {
      notes.value = notes.value.filter(n => n.id !== id)
      if (currentNote.value?.id === id) {
        currentNote.value = null
      }
    }
  }

  /**
   * 搜索笔记
   */
  async function searchNotes(title: string) {
    loading.value = true
    const notesApi = useNotesApi()
    try {
      const response = await notesApi.search(title)
      if (response.success && response.data) {
        notes.value = response.data
      }
    } finally {
      loading.value = false
    }
  }

  return {
    notes,
    currentNote,
    loading,
    pagination,
    hasMore,
    loadNotes,
    loadNote,
    createNote,
    updateNote,
    deleteNote,
    searchNotes,
  }
})
