/**
 * 本地草稿存储工具
 * 使用 localStorage 存储笔记草稿，支持自动过期清理
 */

const DRAFT_STORAGE_KEY = 'local-rag:notes:drafts';
const DRAFT_EXPIRY_DAYS = 7; // 草稿过期天数

export interface DraftData {
  id: string;
  noteId: string | null; // 关联的笔记 ID，null 表示新笔记草稿
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DraftStorageData {
  drafts: Record<string, DraftData>;
}

/**
 * 草稿存储类
 */
export class DraftStorage {
  private storageKey: string;

  constructor(key = DRAFT_STORAGE_KEY) {
    this.storageKey = key;
  }

  /**
   * 获取所有草稿
   */
  getAll(): DraftData[] {
    try {
      const data = this.getStorageData();
      return this.cleanExpiredDrafts(data.drafts);
    } catch {
      return [];
    }
  }

  /**
   * 根据笔记 ID 获取草稿
   */
  getByNoteId(noteId: string): DraftData | null {
    const drafts = this.getAll();
    return drafts.find(d => d.noteId === noteId) || null;
  }

  /**
   * 根据 ID 获取草稿
   */
  get(id: string): DraftData | null {
    try {
      const data = this.getStorageData();
      return data.drafts[id] || null;
    } catch {
      return null;
    }
  }

  /**
   * 保存草稿
   */
  save(draft: Omit<DraftData, 'id' | 'createdAt' | 'updatedAt'>): DraftData {
    const data = this.getStorageData();
    const now = new Date().toISOString();

    // 查找是否已存在该笔记的草稿
    const existingDraftId = Object.keys(data.drafts).find(
      id => data.drafts[id].noteId === draft.noteId
    );

    const draftId = existingDraftId || `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const draftData: DraftData = {
      id: draftId,
      ...draft,
      createdAt: existingDraftId ? data.drafts[existingDraftId].createdAt : now,
      updatedAt: now,
    };

    data.drafts[draftId] = draftData;
    this.setStorageData(data);

    return draftData;
  }

  /**
   * 删除草稿
   */
  delete(id: string): boolean {
    try {
      const data = this.getStorageData();
      if (data.drafts[id]) {
        delete data.drafts[id];
        this.setStorageData(data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 根据笔记 ID 删除草稿
   */
  deleteByNoteId(noteId: string): boolean {
    try {
      const data = this.getStorageData();
      const draftId = Object.keys(data.drafts).find(
        id => data.drafts[id].noteId === noteId
      );

      if (draftId) {
        delete data.drafts[draftId];
        this.setStorageData(data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 清空所有草稿
   */
  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // 忽略错误
    }
  }

  /**
   * 获取存储数据
   */
  private getStorageData(): DraftStorageData {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return { drafts: {} };
    }
    return JSON.parse(raw);
  }

  /**
   * 设置存储数据
   */
  private setStorageData(data: DraftStorageData): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save draft to localStorage:', err);
    }
  }

  /**
   * 清理过期草稿
   */
  private cleanExpiredDrafts(drafts: Record<string, DraftData>): DraftData[] {
    const now = Date.now();
    const expiryMs = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const cleanedDrafts: Record<string, DraftData> = {};
    let hasExpired = false;

    for (const [id, draft] of Object.entries(drafts)) {
      const updatedAt = new Date(draft.updatedAt).getTime();
      if (now - updatedAt < expiryMs) {
        cleanedDrafts[id] = draft;
      } else {
        hasExpired = true;
      }
    }

    if (hasExpired) {
      this.setStorageData({ drafts: cleanedDrafts });
    }

    return Object.values(cleanedDrafts).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }
}

// 导出单例
export const draftStorage = new DraftStorage();

/**
 * 快捷方法：保存草稿
 */
export function saveDraft(
  noteId: string | null,
  title: string,
  content: string,
  tags: string[] = []
): DraftData {
  return draftStorage.save({ noteId, title, content, tags });
}

/**
 * 快捷方法：获取草稿
 */
export function getDraft(id: string): DraftData | null {
  return draftStorage.get(id);
}

/**
 * 快捷方法：根据笔记 ID 获取草稿
 */
export function getDraftByNoteId(noteId: string): DraftData | null {
  return draftStorage.getByNoteId(noteId);
}

/**
 * 快捷方法：删除草稿
 */
export function deleteDraft(id: string): boolean {
  return draftStorage.delete(id);
}

/**
 * 快捷方法：根据笔记 ID 删除草稿
 */
export function deleteDraftByNoteId(noteId: string): boolean {
  return draftStorage.deleteByNoteId(noteId);
}

/**
 * 快捷方法：获取所有草稿
 */
export function getAllDrafts(): DraftData[] {
  return draftStorage.getAll();
}

/**
 * 快捷方法：清空所有草稿
 */
export function clearAllDrafts(): void {
  draftStorage.clear();
}
