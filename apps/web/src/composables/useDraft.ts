/**
 * 草稿管理 Composable
 * 提供草稿保存、恢复、删除等功能
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import {
  draftStorage,
  saveDraft,
  getDraft,
  getDraftByNoteId,
  deleteDraft,
  deleteDraftByNoteId,
  getAllDrafts,
  type DraftData,
} from '@/utils/draft-storage';

export interface UseDraftOptions {
  /** 是否自动保存草稿，默认 true */
  autoSave?: boolean;
  /** 草稿保存防抖延迟（毫秒），默认 1000ms */
  saveDelay?: number;
}

export interface UseDraftReturn {
  /** 当前草稿 */
  currentDraft: Ref<DraftData | null>;
  /** 所有草稿列表 */
  allDrafts: Ref<DraftData[]>;
  /** 是否有草稿 */
  hasDraft: ComputedRef<boolean>;
  /** 保存草稿 */
  saveDraft: (title: string, content: string, tags?: string[]) => DraftData | void;
  /** 加载草稿 */
  loadDraft: (id: string) => DraftData | null;
  /** 根据笔记 ID 加载草稿 */
  loadDraftByNoteId: (noteId: string) => DraftData | null;
  /** 删除当前草稿 */
  deleteCurrentDraft: () => boolean;
  /** 删除指定草稿 */
  deleteDraft: (id: string) => boolean;
  /** 根据笔记 ID 删除草稿 */
  deleteDraftByNoteId: (noteId: string) => boolean;
  /** 清空所有草稿 */
  clearAllDrafts: () => void;
  /** 刷新草稿列表 */
  refreshDrafts: () => void;
}

/**
 * 草稿管理 Hook
 *
 * @param noteId - 笔记 ID，null 表示新笔记
 * @param options - 配置选项
 *
 * @example
 * ```ts
 * const { currentDraft, saveDraft, loadDraft, hasDraft } = useDraft('note-123');
 *
 * // 自动保存草稿
 * watch([title, content], () => {
 *   saveDraft(title.value, content.value);
 * });
 * ```
 */
export function useDraft(
  noteId: string | null = null,
  options: UseDraftOptions = {}
): UseDraftReturn {
  const {
    autoSave = true,
    saveDelay = 1000,
  } = options;

  const currentDraft = ref<DraftData | null>(null);
  const allDrafts = ref<DraftData[]>([]);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * 刷新草稿列表
   */
  function refreshDrafts() {
    allDrafts.value = getAllDrafts();
  }

  /**
   * 加载当前笔记的草稿
   */
  function loadCurrentDraft() {
    if (noteId) {
      currentDraft.value = getDraftByNoteId(noteId);
    } else {
      // 对于新笔记，查找最新的未关联草稿
      const drafts = getAllDrafts();
      const newestUnlinkedDraft = drafts.find(d => d.noteId === null);
      currentDraft.value = newestUnlinkedDraft || null;
    }
    refreshDrafts();
  }

  /**
   * 保存草稿
   */
  function saveDraftFn(title: string, content: string, tags: string[] = []): DraftData {
    const draft = saveDraft(noteId, title, content, tags);
    currentDraft.value = draft;
    refreshDrafts();
    return draft;
  }

  /**
   * 防抖保存草稿
   */
  function debouncedSaveDraft(title: string, content: string, tags: string[] = []) {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveDraftFn(title, content, tags);
    }, saveDelay);
  }

  /**
   * 加载指定草稿
   */
  function loadDraft(id: string): DraftData | null {
    const draft = getDraft(id);
    if (draft) {
      currentDraft.value = draft;
      refreshDrafts();
    }
    return draft;
  }

  /**
   * 根据笔记 ID 加载草稿
   */
  function loadDraftByNoteId(noteId: string): DraftData | null {
    const draft = getDraftByNoteId(noteId);
    if (draft) {
      currentDraft.value = draft;
      refreshDrafts();
    }
    return draft;
  }

  /**
   * 删除当前草稿
   */
  function deleteCurrentDraft(): boolean {
    if (currentDraft.value) {
      const result = deleteDraft(currentDraft.value.id);
      if (result) {
        currentDraft.value = null;
        refreshDrafts();
      }
      return result;
    }
    return false;
  }

  /**
   * 删除指定草稿
   */
  function deleteDraftFn(id: string): boolean {
    const result = deleteDraft(id);
    if (result && currentDraft.value?.id === id) {
      currentDraft.value = null;
    }
    refreshDrafts();
    return result;
  }

  /**
   * 根据笔记 ID 删除草稿
   */
  function deleteDraftByNoteIdFn(noteId: string): boolean {
    const result = deleteDraftByNoteId(noteId);
    if (result && currentDraft.value?.noteId === noteId) {
      currentDraft.value = null;
    }
    refreshDrafts();
    return result;
  }

  /**
   * 清空所有草稿
   */
  function clearAllDraftsFn() {
    draftStorage.clear();
    currentDraft.value = null;
    refreshDrafts();
  }

  /**
   * 是否有草稿
   */
  const hasDraft = computed(() => currentDraft.value !== null);

  // 初始化时加载草稿
  loadCurrentDraft();

  return {
    currentDraft,
    allDrafts,
    hasDraft,
    saveDraft: autoSave ? debouncedSaveDraft : saveDraftFn,
    loadDraft,
    loadDraftByNoteId,
    deleteCurrentDraft,
    deleteDraft: deleteDraftFn,
    deleteDraftByNoteId: deleteDraftByNoteIdFn,
    clearAllDrafts: clearAllDraftsFn,
    refreshDrafts,
  };
}

/**
 * 草稿恢复对话框 Hook
 */
export function useDraftRestoreDialog() {
  const visible = ref(false);
  const draft = ref<DraftData | null>(null);

  function show(draftData: DraftData) {
    draft.value = draftData;
    visible.value = true;
  }

  function hide() {
    visible.value = false;
    draft.value = null;
  }

  function confirm() {
    const result = draft.value;
    hide();
    return result;
  }

  return {
    visible,
    draft,
    show,
    hide,
    confirm,
  };
}
