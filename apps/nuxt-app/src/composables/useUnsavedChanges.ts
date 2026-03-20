/**
 * 未保存更改检测 Composable
 * 提供路由守卫和浏览器离开确认功能
 */

import { ref, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

export interface UnsavedChangesOptions {
  /** 是否启用路由守卫，默认 true */
  routeGuard?: boolean;
  /** 是否启用浏览器离开确认，默认 true */
  browserConfirm?: boolean;
  /** 自定义确认消息 */
  message?: string;
}

export interface UseUnsavedChangesReturn {
  /** 是否有未保存的更改 */
  hasUnsavedChanges: ReturnType<typeof ref<boolean>>;
  /** 设置有未保存更改 */
  setUnsaved: () => void;
  /** 设置已保存 */
  setSaved: () => void;
  /** 显示离开确认对话框 */
  showConfirmDialog: () => Promise<boolean>;
}

/**
 * 未保存更改检测 Hook
 *
 * @param options - 配置选项
 *
 * @example
 * ```ts
 * const { hasUnsavedChanges, setUnsaved, setSaved } = useUnsavedChanges({
 *   message: '您有未保存的更改，确定要离开吗？',
 * });
 *
 * // 监听内容变化
 * watch(content, () => {
 *   setUnsaved();
 * });
 *
 * // 保存后调用
 * async function save() {
 *   await api.save();
 *   setSaved();
 * }
 * ```
 */
export function useUnsavedChanges(
  options: UnsavedChangesOptions = {}
): UseUnsavedChangesReturn {
  const {
    routeGuard = true,
    browserConfirm = true,
    message = '您有未保存的更改，确定要离开吗？',
  } = options;

  const hasUnsavedChanges = ref(false);
  const nextRoute = ref<any>(null);

  /**
   * 设置有未保存更改
   */
  function setUnsaved() {
    hasUnsavedChanges.value = true;
  }

  /**
   * 设置已保存
   */
  function setSaved() {
    hasUnsavedChanges.value = false;
  }

  /**
   * 显示离开确认对话框
   */
  function showConfirmDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      // 这里可以使用 Element Plus 的 ElMessageBox
      // 为了简化，先使用原生 confirm
      const result = window.confirm(message);
      resolve(result);
    });
  }

  /**
   * 浏览器离开确认
   */
  function handleBeforeUnload(e: BeforeUnloadEvent) {
    if (hasUnsavedChanges.value && browserConfirm) {
      e.preventDefault();
      e.returnValue = message;
      return message;
    }
    return undefined;
  }

  /**
   * 路由守卫
   */
  onBeforeRouteLeave((to, _from, next) => {
    if (hasUnsavedChanges.value && routeGuard) {
      nextRoute.value = to;
      showConfirmDialog().then((confirmed) => {
        if (confirmed) {
          // 放弃更改，继续导航
          hasUnsavedChanges.value = false;
          next();
        } else {
          // 留在当前页面
          next(false);
        }
      });
    } else {
      next();
    }
  });

  /**
   * 监听浏览器离开事件
   */
  if (browserConfirm) {
    window.addEventListener('beforeunload', handleBeforeUnload);

    onBeforeUnmount(() => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    });
  }

  return {
    hasUnsavedChanges,
    setUnsaved,
    setSaved,
    showConfirmDialog,
  };
}

/**
 * 带保存选项的离开确认 Hook
 */
export function useUnsavedChangesWithSave(
  saveFn: () => Promise<void>,
  options: UnsavedChangesOptions = {}
) {
  const { hasUnsavedChanges, setUnsaved, setSaved } = useUnsavedChanges(options);

  const showDialog = ref(false);
  const isSaving = ref(false);

  /**
   * 显示确认对话框（三选项：保存并离开 / 放弃更改 / 留在页面）
   */
  async function handleLeaveConfirmation(next: () => void) {
    if (!hasUnsavedChanges.value) {
      next();
      return;
    }

    showDialog.value = true;

    // 这里应该显示一个自定义对话框
    // 为了简化，使用三个 confirm 模拟
    const choice = window.prompt(
      '您有未保存的更改：\n1. 输入 "save" 保存并离开\n2. 输入 "leave" 放弃更改\n3. 点击取消留在页面'
    );

    if (choice === 'save') {
      isSaving.value = true;
      try {
        await saveFn();
        setSaved();
        showDialog.value = false;
        next();
      } catch (err) {
        console.error('保存失败:', err);
        alert('保存失败，请稍后重试');
      } finally {
        isSaving.value = false;
      }
    } else if (choice === 'leave') {
      setSaved();
      showDialog.value = false;
      next();
    } else {
      showDialog.value = false;
    }
  }

  return {
    hasUnsavedChanges,
    setUnsaved,
    setSaved,
    showDialog,
    isSaving,
    handleLeaveConfirmation,
  };
}
