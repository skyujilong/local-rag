<template>
  <div class="note-editor">
    <!-- 顶部工具栏 -->
    <n-space justify="space-between" align="center" style="margin-bottom: 16px">
      <n-space align="center">
        <n-button text @click="goBack">
          <template #icon>
            <n-icon><ArrowBackIcon /></n-icon>
          </template>
          返回
        </n-button>
        <n-input
          v-model:value="note.title"
          placeholder="笔记标题"
          size="large"
          style="width: 400px"
          @input="onTitleChange"
        />
      </n-space>

      <n-space align="center">
        <n-tag v-if="saveStatus === 'saved'" type="success">💾 已保存</n-tag>
        <n-tag v-else-if="saveStatus === 'saving'" type="warning">💾 保存中...</n-tag>
        <n-tag v-else type="default">💾 未保存</n-tag>

        <n-dropdown :options="moreOptions" @select="handleMoreAction">
          <n-button circle>
            <template #icon>
              <n-icon><MoreHorizIcon /></n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </n-space>
    </n-space>

    <!-- 元数据区域 -->
    <n-card v-if="showMetadata" style="margin-bottom: 16px">
      <n-space vertical>
        <n-space align="center">
          <span style="font-weight: 500">标签:</span>
          <n-space align="center">
            <n-tag
              v-for="tag in note.tags"
              :key="tag"
              closable
              @close="removeTag(tag)"
            >
              {{ tag }}
            </n-tag>
            <n-input
              v-if="showTagInput"
              v-model:value="newTag"
              size="small"
              placeholder="输入标签名"
              style="width: 120px"
              @blur="addTag"
              @keyup.enter="addTag"
            />
            <n-button v-else size="small" @click="showTagInput = true">
              + 添加标签
            </n-button>
          </n-space>
        </n-space>

        <n-space align="center" style="font-size: 12px; color: #999">
          <span v-if="note.createdAt">📅 创建于: {{ formatDate(note.createdAt) }}</span>
          <span v-if="note.updatedAt">✏️ 更新于: {{ formatDate(note.updatedAt) }}</span>
        </n-space>
      </n-space>
    </n-card>

    <!-- Markdown 编辑器 -->
    <n-card style="min-height: 600px">
      <MdEditor
        v-model="note.content"
        :language="'zh-CN'"
        :toolbars="toolbars"
        @onChange="onContentChange"
        @onSave="handleSave"
      />
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  NButton,
  NTag,
  NInput,
  NSpace,
  NCard,
  NDropdown,
  NIcon,
  useDialog,
  useMessage,
} from 'naive-ui';
import { ArrowBack, EllipsisHorizontal } from '@vicons/ionicons5';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import type { Note } from '../../../../../shared/types/documents';

const router = useRouter();
const route = useRoute();
const dialog = useDialog();
const message = useMessage();

// 组件挂载状态（用于防止卸载后更新 ref）
let isMounted = true;

// 图标组件
const ArrowBackIcon = ArrowBack;
const MoreHorizIcon = EllipsisHorizontal;

// 笔记数据
const note = ref<Partial<Note>>({
  id: '',
  title: '',
  content: '',
  tags: [],
  filePath: '',
  createdAt: new Date(),
  updatedAt: new Date(),
});

// UI 状态
const saveStatus = ref<'unsaved' | 'saving' | 'saved'>('saved');
const showMetadata = ref(true);
const showTagInput = ref(false);
const newTag = ref('');

// 编辑器工具栏
const toolbars = [
  'bold',
  'underline',
  'italic',
  'strikeThrough',
  '-',
  'title',
  'sub',
  'sup',
  'quote',
  'unorderedList',
  'orderedList',
  'task',
  '-',
  'codeRow',
  'code',
  'link',
  'image',
  'table',
  '-',
  'revoke',
  'next',
  'save',
  '=',
  'pageFullscreen',
  'fullscreen',
  'preview',
  'htmlPreview',
  'catalog',
] as any;

// 更多操作菜单
const moreOptions = [
  {
    label: '保存',
    key: 'save',
  },
  {
    label: '删除',
    key: 'delete',
  },
  {
    label: '切换元数据显示',
    key: 'toggleMetadata',
  },
];

// 自动保存定时器
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 初始化
 */
onMounted(async () => {
  // 安全地提取路由参数 ID（处理 string | string[] 类型）
  const rawId = route.params.id;
  const noteId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (noteId && noteId !== 'new') {
    // 加载现有笔记
    // 防御性检查：防止字符串 'new' 被当作笔记 ID 传入
    await loadNote(noteId);
  } else {
    // 新建笔记，从 LocalStorage 恢复草稿
    restoreDraft();
  }

  // 启动自动保存（30秒）
  startAutoSave();

  // 添加键盘快捷键
  window.addEventListener('keydown', handleKeyDown);
});

/**
 * 清理
 */
onBeforeUnmount(() => {
  // 标记组件已卸载，防止异步操作更新 ref
  isMounted = false;

  if (autoSaveTimer) {
    clearInterval(autoSaveTimer);
  }
  window.removeEventListener('keydown', handleKeyDown);

  // 保存草稿到 LocalStorage
  saveDraft();
});

/**
 * 加载笔记
 */
const loadNote = async (id: string) => {
  // 输入校验：确保 ID 是有效的非空字符串
  if (!id || typeof id !== 'string' || id.trim() === '') {
    message.error('无效的笔记 ID');
    goBack();
    return;
  }

  try {
    const response = await fetch(`/api/documents/notes/${id}`);
    const data = await response.json();

    if (data.success && data.data) {
      note.value = data.data;
    } else {
      message.error('加载笔记失败');
      goBack();
    }
  } catch (error) {
    console.error('加载笔记失败:', error);
    message.error('加载笔记失败');
    goBack();
  }
};

/**
 * 标题变更
 */
const onTitleChange = () => {
  saveStatus.value = 'unsaved';
};

/**
 * 内容变更
 */
const onContentChange = () => {
  saveStatus.value = 'unsaved';
};

/**
 * 保存笔记
 */
const handleSave = async () => {
  if (!note.value.title?.trim()) {
    message.warning('请输入笔记标题');
    return;
  }

  if (!note.value.content?.trim()) {
    message.warning('请输入笔记内容');
    return;
  }

  saveStatus.value = 'saving';

  try {
    const isUpdate = !!note.value.id;
    const url = isUpdate ? `/api/documents/notes/${note.value.id}` : '/api/documents/notes';
    const method = isUpdate ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: note.value.title,
        content: note.value.content,
        tags: note.value.tags || [],
      }),
    });

    const data = await response.json();

    if (data.success) {
      note.value = data.data;
      saveStatus.value = 'saved';

      // 新建成功后更新 URL，防止刷新时以 /documents/new 重新打开
      if (!isUpdate && data.data.id) {
        router.replace(`/documents/${data.data.id}`);
      }

      message.success(isUpdate ? '更新成功' : '创建成功');

      // 清除草稿
      clearDraft();
    } else {
      message.error(data.error || '保存失败');
      saveStatus.value = 'unsaved';
    }
  } catch (error) {
    console.error('保存失败:', error);
    message.error('保存失败');
    saveStatus.value = 'unsaved';
  }
};

/**
 * 删除笔记
 */
const deleteNote = () => {
  if (!note.value.id) return;

  dialog.warning({
    title: '确认删除',
    content: `确定要删除笔记 "${note.value.title}" 吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const response = await fetch(`/api/documents/notes/${note.value.id}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (data.success) {
          message.success('删除成功');
          goBack();
        } else {
          message.error(data.error || '删除失败');
        }
      } catch (error) {
        console.error('删除失败:', error);
        message.error('删除失败');
      }
    },
  });
};

/**
 * 添加标签
 */
const addTag = () => {
  const tag = newTag.value.trim();
  if (!tag) return;

  if (!note.value.tags) {
    note.value.tags = [];
  }

  if (note.value.tags.includes(tag)) {
    message.warning('标签已存在');
    return;
  }

  note.value.tags.push(tag);
  newTag.value = '';
  showTagInput.value = false;
  saveStatus.value = 'unsaved';
};

/**
 * 移除标签
 */
const removeTag = (tag: string) => {
  if (!note.value.tags) return;

  const index = note.value.tags.indexOf(tag);
  if (index !== -1) {
    note.value.tags.splice(index, 1);
    saveStatus.value = 'unsaved';
  }
};

/**
 * 更多操作
 */
const handleMoreAction = (key: string) => {
  switch (key) {
    case 'save':
      handleSave();
      break;
    case 'delete':
      deleteNote();
      break;
    case 'toggleMetadata':
      showMetadata.value = !showMetadata.value;
      break;
  }
};

/**
 * 键盘快捷键
 */
const handleKeyDown = (e: KeyboardEvent) => {
  // Ctrl/Cmd + S 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    handleSave();
  }

  // Escape 返回
  if (e.key === 'Escape') {
    if (saveStatus.value === 'unsaved') {
      dialog.warning({
        title: '有未保存的更改',
        content: '确定要离开吗？未保存的更改将丢失。',
        positiveText: '离开',
        negativeText: '取消',
        onPositiveClick: goBack,
      });
    } else {
      goBack();
    }
  }
};

/**
 * 启动自动保存
 */
const startAutoSave = () => {
  autoSaveTimer = setInterval(() => {
    // 检查组件是否已卸载，防止更新已卸载的 ref
    if (!isMounted) {
      return;
    }

    // 只在有标题和内容时自动保存，避免对空笔记弹出警告
    if (
      saveStatus.value === 'unsaved' &&
      note.value.title?.trim() &&
      note.value.content?.trim()
    ) {
      handleSave();
    }
  }, 30000); // 30秒
};

/**
 * 保存草稿到 LocalStorage
 */
const saveDraft = () => {
  if (!note.value.id && (note.value.title || note.value.content)) {
    const draft = {
      title: note.value.title,
      content: note.value.content,
      tags: note.value.tags,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem('note-draft', JSON.stringify(draft));
  }
};

/**
 * 恢复草稿
 */
const restoreDraft = () => {
  const draftStr = localStorage.getItem('note-draft');
  if (draftStr) {
    try {
      const draft = JSON.parse(draftStr);
      dialog.info({
        title: '发现草稿',
        content: `是否恢复上次编辑的草稿？(${formatDate(new Date(draft.savedAt))})`,
        positiveText: '恢复',
        negativeText: '丢弃',
        onPositiveClick: () => {
          note.value.title = draft.title;
          note.value.content = draft.content;
          note.value.tags = draft.tags || [];
          saveStatus.value = 'unsaved';
          clearDraft();
        },
        onNegativeClick: () => {
          clearDraft();
        },
      });
    } catch (error) {
      console.error('恢复草稿失败:', error);
    }
  }
};

/**
 * 清除草稿
 */
const clearDraft = () => {
  localStorage.removeItem('note-draft');
};

/**
 * 格式化日期
 */
const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 返回列表
 */
const goBack = () => {
  router.push('/documents');
};
</script>

<style scoped>
.note-editor {
  max-width: 1200px;
  margin: 0 auto;
}

:deep(.md-editor) {
  height: 600px;
}
</style>
