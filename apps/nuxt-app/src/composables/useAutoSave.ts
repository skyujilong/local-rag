/**
 * 自动保存 Composable
 * 实现防抖自动保存、保存状态跟踪、失败重试机制
 */

import { ref, watch, onUnmounted, computed, type Ref, type ComputedRef } from 'vue';
import { useDebounceFn } from '@vueuse/core';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutoSaveOptions {
  /** 防抖延迟时间（毫秒），默认 2000ms */
  delay?: number;
  /** 最大重试次数，默认 3 次 */
  maxRetries?: number;
  /** 重试延迟基数（毫秒），指数退避，默认 1000ms */
  retryDelay?: number;
  /** 是否在组件卸载时强制保存，默认 true */
  saveOnUnmount?: boolean;
}

export interface UseAutoSaveReturn {
  /** 当前保存状态 */
  status: Ref<SaveStatus>;
  /** 最后保存时间 */
  lastSavedAt: Ref<Date | null>;
  /** 保存错误信息 */
  error: Ref<Error | null>;
  /** 手动触发保存 */
  save: () => Promise<void>;
  /** 是否正在保存 */
  isSaving: ComputedRef<boolean>;
}

/**
 * 自动保存 Hook
 *
 * @param source - 响应式数据源
 * @param saveFn - 保存函数，返回 Promise
 * @param options - 配置选项
 *
 * @example
 * ```ts
 * const content = ref('initial content');
 * const { status, save, isSaving } = useAutoSave(
 *   content,
 *   async (value) => {
 *     await api.saveNote(value);
 *   },
 *   { delay: 2000 }
 * );
 * ```
 */
export function useAutoSave<T>(
  source: ReturnType<typeof ref<T>>,
  saveFn: (value: T) => Promise<void>,
  options: AutoSaveOptions = {}
): UseAutoSaveReturn {
  const {
    delay = 2000,
    maxRetries = 3,
    retryDelay = 1000,
    saveOnUnmount = true,
  } = options;

  const status = ref<SaveStatus>('idle');
  const lastSavedAt = ref<Date | null>(null);
  const error = ref<Error | null>(null);
  const retryCount = ref(0);

  /**
   * 执行保存操作（带重试机制）
   */
  async function performSave(value: T): Promise<void> {
    status.value = 'saving';
    error.value = null;

    try {
      await saveFn(value);
      status.value = 'saved';
      lastSavedAt.value = new Date();
      retryCount.value = 0;
    } catch (err) {
      error.value = err as Error;

      // 重试逻辑
      if (retryCount.value < maxRetries) {
        retryCount.value++;
        const backoffDelay = retryDelay * Math.pow(2, retryCount.value - 1);

        status.value = 'error';
        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        return performSave(value);
      } else {
        status.value = 'error';
        throw err;
      }
    }
  }

  /**
   * 防抖保存函数
   */
  const debouncedSave = useDebounceFn(async () => {
    const value = source.value;
    if (value !== undefined) {
      await performSave(value);
    }
  }, delay);

  /**
   * 手动触发保存（立即执行，不防抖）
   */
  async function save(): Promise<void> {
    const value = source.value;
    if (value !== undefined) {
      await performSave(value);
    }
  }

  /**
   * 监听数据变化，触发自动保存
   */
  const stopWatch = watch(source, () => {
    if (status.value !== 'saving') {
      status.value = 'idle';
      debouncedSave();
    }
  }, { deep: true });

  /**
   * 组件卸载时处理
   */
  onUnmounted(() => {
    if (saveOnUnmount && status.value !== 'saved') {
      const value = source.value;
      if (value !== undefined) {
        performSave(value);
      }
    }
    stopWatch();
  });

  return {
    status,
    lastSavedAt,
    error,
    save,
    isSaving: computed(() => status.value === 'saving'),
  };
}

/**
 * 创建保存状态文本
 */
export function useSaveStatusText(status: ReturnType<typeof ref<SaveStatus>>) {
  return computed(() => {
    switch (status.value) {
      case 'idle':
        return '输入中...';
      case 'saving':
        return '保存中...';
      case 'saved':
        return '已保存';
      case 'error':
        return '保存失败';
      default:
        return '';
    }
  });
}

/**
 * 创建保存状态图标
 */
export function useSaveStatusIcon(status: ReturnType<typeof ref<SaveStatus>>) {
  return computed(() => {
    switch (status.value) {
      case 'idle':
        return 'Edit';
      case 'saving':
        return 'Loading';
      case 'saved':
        return 'CircleCheck';
      case 'error':
        return 'CircleClose';
      default:
        return 'Edit';
    }
  });
}
