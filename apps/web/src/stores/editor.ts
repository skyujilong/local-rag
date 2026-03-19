/**
 * 编辑器状态管理
 * 管理编辑器相关的状态和操作
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { notesApi } from '@/api/notes';
import type { Note } from '@/types';

export const useEditorStore = defineStore('editor', () => {
  // 当前编辑的笔记
  const currentNote = ref<Note | null>(null);
  const isNewNote = ref(false);

  // 编辑器内容
  const title = ref('');
  const content = ref('');
  const tags = ref<string[]>([]);

  // 编辑器状态
  const isReady = ref(false);
  const wordCount = ref(0);
  const charCount = ref(0);

  // 侧边栏状态
  const sidebarCollapsed = ref(false);

  // 计算属性
  const hasContent = computed(() => {
    return title.value.trim() !== '' || content.value.trim() !== '';
  });

  const isEmpty = computed(() => {
    return title.value.trim() === '' && content.value.trim() === '';
  });

  /**
   * 加载笔记进行编辑
   */
  async function loadNote(id: string) {
    try {
      const response = await notesApi.get(id);
      if (response.success && response.data) {
        currentNote.value = response.data;
        title.value = response.data.title;
        content.value = response.data.content;
        tags.value = [...response.data.tags];
        isNewNote.value = false;
        isReady.value = true;
        return response.data;
      }
    } catch (err) {
      console.error('加载笔记失败:', err);
      throw err;
    }
  }

  /**
   * 创建新笔记
   */
  function createNew() {
    currentNote.value = null;
    title.value = '';
    content.value = '';
    tags.value = [];
    isNewNote.value = true;
    isReady.value = true;
  }

  /**
   * 保存笔记
   */
  async function save(): Promise<Note> {
    const data = {
      title: title.value || '无标题',
      content: content.value,
      tags: tags.value,
    };

    if (currentNote.value) {
      // 更新现有笔记
      const response = await notesApi.update(currentNote.value.id, data);
      if (response.success && response.data) {
        currentNote.value = response.data;
        return response.data;
      }
      throw new Error('保存失败');
    } else {
      // 创建新笔记
      const response = await notesApi.create(data);
      if (response.success && response.data) {
        currentNote.value = response.data;
        isNewNote.value = false;
        return response.data;
      }
      throw new Error('创建失败');
    }
  }

  /**
   * 更新标题
   */
  function setTitle(newTitle: string) {
    title.value = newTitle;
  }

  /**
   * 更新内容
   */
  function setContent(newContent: string) {
    content.value = newContent;
    updateCounts();
  }

  /**
   * 更新标签
   */
  function setTags(newTags: string[]) {
    tags.value = newTags;
  }

  /**
   * 添加标签
   */
  function addTag(tag: string) {
    if (!tags.value.includes(tag)) {
      tags.value.push(tag);
    }
  }

  /**
   * 移除标签
   */
  function removeTag(tag: string) {
    const index = tags.value.indexOf(tag);
    if (index !== -1) {
      tags.value.splice(index, 1);
    }
  }

  /**
   * 更新字数统计
   */
  function updateCounts() {
    // 纯文本内容
    const text = content.value.replace(/<[^>]*>/g, '');
    charCount.value = text.length;

    // 分词统计（中文按字符，英文按单词）
    const words = text
      .trim()
      .split(/[\s\u4e00-\u9fa5]+/)
      .filter(w => w.trim().length > 0);
    wordCount.value = words.length;
  }

  /**
   * 重置编辑器
   */
  function reset() {
    currentNote.value = null;
    title.value = '';
    content.value = '';
    tags.value = [];
    isNewNote.value = false;
    isReady.value = false;
    wordCount.value = 0;
    charCount.value = 0;
  }

  /**
   * 切换侧边栏
   */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  /**
   * 设置侧边栏状态
   */
  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed.value = collapsed;
  }

  return {
    // 状态
    currentNote,
    isNewNote,
    title,
    content,
    tags,
    isReady,
    wordCount,
    charCount,
    sidebarCollapsed,

    // 计算属性
    hasContent,
    isEmpty,

    // 方法
    loadNote,
    createNew,
    save,
    setTitle,
    setContent,
    setTags,
    addTag,
    removeTag,
    updateCounts,
    reset,
    toggleSidebar,
    setSidebarCollapsed,
  };
});
