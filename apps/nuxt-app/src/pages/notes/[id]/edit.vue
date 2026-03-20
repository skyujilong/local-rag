<template>
  <div class="note-editor-page">
    <!-- 顶部导航栏 -->
    <div class="editor-header">
      <div class="header-left">
        <n-button text @click="goBack">
          <template #icon>
            <n-icon :component="ChevronBackOutline" />
          </template>
          返回
        </n-button>
        <n-divider vertical />
        <span class="breadcrumb">
          笔记 > {{ editorStore.title || '新笔记' }}
        </span>
      </div>

      <div class="header-right">
        <SaveStatus v-if="saveStatus" :status="saveStatus" :last-saved-at="lastSavedAt" />
        <n-divider vertical />
        <n-button type="primary" :loading="isSaving" @click="handleManualSave">
          <template #icon>
            <n-icon :component="CheckmarkOutline" />
          </template>
          保存
        </n-button>
      </div>
    </div>

    <!-- 主体内容 -->
    <div class="editor-body">
      <!-- 侧边栏：笔记列表 -->
      <div class="editor-sidebar" :class="{ collapsed: editorStore.sidebarCollapsed }">
        <div class="sidebar-header">
          <span v-if="!editorStore.sidebarCollapsed">笔记列表</span>
          <n-button text @click="editorStore.toggleSidebar">
            <template #icon>
              <n-icon :component="editorStore.sidebarCollapsed ? ChevronForwardOutline : ChevronBackOutline" />
            </template>
          </n-button>
        </div>

        <div v-if="!editorStore.sidebarCollapsed" class="sidebar-content">
          <div class="sidebar-actions">
            <n-button type="primary" size="small" @click="handleNewNote">
              <template #icon>
                <n-icon :component="AddOutline" />
              </template>
              新建笔记
            </n-button>
          </div>

          <n-scrollbar style="height: calc(100vh - 180px);">
            <div
              v-for="note in notesStore.notes"
              :key="note.id"
              class="note-item"
              :class="{ active: note.id === editorStore.currentNote?.id }"
              @click="handleSelectNote(note.id)"
            >
              <div class="note-item-title">{{ note.title }}</div>
              <div class="note-item-meta">
                <span class="note-item-time">{{ formatDate(note.updatedAt) }}</span>
                <n-icon v-if="note.id === editorStore.currentNote?.id" class="note-item-active-icon">
                  <CheckmarkCircleOutline />
                </n-icon>
              </div>
            </div>
          </n-scrollbar>
        </div>
      </div>

      <!-- 编辑器区域 -->
      <div class="editor-main">
        <n-scrollbar style="height: calc(100vh - 120px);">
          <div class="editor-container">
            <!-- 标题输入 -->
            <n-input
              v-model:value="editorStore.title"
              class="note-title-input"
              placeholder="输入笔记标题..."
              size="large"
              :maxlength="200"
              show-count
              @update:value="handleTitleInput"
            />

            <!-- 标签输入 -->
            <div class="note-tags-input">
              <n-select
                v-model:value="editorStore.tags"
                multiple
                filterable
                tag
                placeholder="添加标签..."
                size="small"
                :options="tagOptions"
                @update:value="handleTagsChange"
              />
            </div>

            <!-- TipTap 编辑器 -->
            <TipTapEditor
              v-if="editorStore.isReady"
              v-model="editorStore.content"
              placeholder="开始输入内容..."
              @ready="handleEditorReady"
            />

            <!-- 底部状态栏 -->
            <div class="editor-footer">
              <span class="word-count">
                {{ editorStore.wordCount }} 字 | {{ editorStore.charCount }} 字符
              </span>
              <span v-if="lastSavedAt" class="last-saved">
                上次保存: {{ formatTime(lastSavedAt) }}
              </span>
            </div>
          </div>
        </n-scrollbar>
      </div>
    </div>

    <!-- 草稿恢复对话框 -->
    <DraftRestoreDialog
      v-if="showDraftDialog && currentDraft"
      :draft="currentDraft"
      @restore="handleRestoreDraft"
      @discard="handleDiscardDraft"
      @cancel="showDraftDialog = false"
    />

    <!-- 离开确认对话框 -->
    <UnsavedChangesWarning
      v-if="showUnsavedWarning"
      @save="handleSaveAndLeave"
      @discard="handleDiscardAndLeave"
      @cancel="handleCancelLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NIcon } from 'naive-ui';
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  CheckmarkOutline,
  CheckmarkCircleOutline,
  AddOutline,
} from '@vicons/ionicons5';
import { useNotesStore } from '@/stores/notes';
import { useEditorStore } from '@/stores/editor';
import { useAutoSave } from '@/composables/useAutoSave';
import { useDraft } from '@/composables/useDraft';
import { useUnsavedChanges } from '@/composables/useUnsavedChanges';
import type { DraftData } from '@/utils/draft-storage';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();
const editorStore = useEditorStore();

// 自动保存
const { status: saveStatus, lastSavedAt, save: autoSave } = useAutoSave(
  computed(() => ({
    title: editorStore.title,
    content: editorStore.content,
    tags: editorStore.tags,
  })),
  async (data) => {
    editorStore.title = data.title;
    editorStore.content = data.content;
    editorStore.tags = data.tags;
    await editorStore.save();
  },
  { delay: 2000 }
);

// 草稿管理
const draftResult = useDraft(editorStore.currentNote?.id || null);
const currentDraft = draftResult.currentDraft;
const hasDraft = draftResult.hasDraft;
const deleteCurrentDraft = draftResult.deleteCurrentDraft;

// 离开确认
const { hasUnsavedChanges, setUnsaved, setSaved } = useUnsavedChanges({
  message: '您有未保存的更改，确定要离开吗？',
});

// UI 状态
const showDraftDialog = ref(false);
const showUnsavedWarning = ref(false);
const pendingNavigation = ref<string | null>(null);

// 计算属性
const isSaving = computed(() => saveStatus.value === 'saving');
const allTags = computed(() => {
  const tags = new Set<string>();
  notesStore.notes.forEach(note => {
    note.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags);
});

// 标签选项
const tagOptions = computed(() => {
  return allTags.value.map(tag => ({
    label: tag,
    value: tag,
  }));
});

/**
 * 初始化
 */
onMounted(async () => {
  await notesStore.loadNotes();

  const noteId = route.params.id as string;
  if (noteId && noteId !== 'new') {
    // 加载现有笔记
    await editorStore.loadNote(noteId);

    // 检查是否有草稿
    if (hasDraft.value) {
      showDraftDialog.value = true;
    }
  } else {
    // 新建笔记
    editorStore.createNew();

    // 检查是否有新笔记草稿
    if (hasDraft.value) {
      showDraftDialog.value = true;
    }
  }
});

/**
 * 编辑器准备就绪
 */
function handleEditorReady(editor: any) {
  // 设置键盘快捷键
  editor
    .on('keydown', ({ event }: { event: KeyboardEvent }) => {
      // Ctrl+S / Cmd+S 保存
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleManualSave();
      }
    });
}

/**
 * 标题输入处理
 */
function handleTitleInput() {
  setUnsaved();
}

/**
 * 标签变化处理
 */
function handleTagsChange() {
  setUnsaved();
}

/**
 * 手动保存
 */
async function handleManualSave() {
  try {
    await autoSave();
    setSaved();

    // 清除草稿
    if (hasDraft.value) {
      deleteCurrentDraft();
    }
  } catch (err) {
    console.error('保存失败:', err);
  }
}

/**
 * 新建笔记
 */
async function handleNewNote() {
  if (hasUnsavedChanges.value) {
    pendingNavigation.value = '/notes/new/edit';
    showUnsavedWarning.value = true;
  } else {
    await navigateToNewNote();
  }
}

/**
 * 导航到新建笔记
 */
async function navigateToNewNote() {
  editorStore.reset();
  router.push('/notes/new/edit');
}

/**
 * 选择笔记
 */
async function handleSelectNote(noteId: string) {
  if (hasUnsavedChanges.value) {
    pendingNavigation.value = `/notes/${noteId}/edit`;
    showUnsavedWarning.value = true;
  } else {
    await navigateToNote(noteId);
  }
}

/**
 * 导航到笔记
 */
async function navigateToNote(noteId: string) {
  router.push(`/notes/${noteId}/edit`);
}

/**
 * 返回
 */
function goBack() {
  if (hasUnsavedChanges.value) {
    pendingNavigation.value = '/notes';
    showUnsavedWarning.value = true;
  } else {
    router.push('/notes');
  }
}

/**
 * 恢复草稿
 */
function handleRestoreDraft(draft: DraftData) {
  editorStore.title = draft.title;
  editorStore.content = draft.content;
  editorStore.tags = [...draft.tags];
  showDraftDialog.value = false;
  setUnsaved();
}

/**
 * 放弃草稿
 */
function handleDiscardDraft() {
  deleteCurrentDraft();
  showDraftDialog.value = false;
}

/**
 * 保存并离开
 */
async function handleSaveAndLeave() {
  try {
    await handleManualSave();
    showUnsavedWarning.value = false;
    if (pendingNavigation.value) {
      router.push(pendingNavigation.value);
    }
  } catch (err) {
    console.error('保存失败:', err);
  }
}

/**
 * 放弃更改并离开
 */
function handleDiscardAndLeave() {
  setSaved();
  showUnsavedWarning.value = false;
  if (pendingNavigation.value) {
    router.push(pendingNavigation.value);
  }
}

/**
 * 取消离开
 */
function handleCancelLeave() {
  pendingNavigation.value = null;
  showUnsavedWarning.value = false;
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string | Date) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;

  return date.toLocaleDateString('zh-CN');
}

/**
 * 格式化时间
 */
function formatTime(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} 小时前`;

  return date.toLocaleString('zh-CN');
}
</script>

<style scoped>
.note-editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  height: 56px;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.breadcrumb {
  color: #606266;
  font-size: 14px;
}

.editor-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-sidebar {
  width: 280px;
  background-color: #fff;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  transition: width 0.3s;
}

.editor-sidebar.collapsed {
  width: 48px;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
  font-weight: 600;
}

.sidebar-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.sidebar-actions {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.note-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f7fa;
  transition: background-color 0.3s;
}

.note-item:hover {
  background-color: #f5f7fa;
}

.note-item.active {
  background-color: #ecf5ff;
}

.note-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-item-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}

.note-item-time {
  font-size: 12px;
  color: #909399;
}

.note-item-active-icon {
  color: #67c23a;
  font-size: 16px;
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 32px;
  width: 100%;
}

.note-title-input :deep(.n-input__input) {
  border: none;
  box-shadow: none;
  padding: 8px 0;
  font-size: 28px;
  font-weight: 700;
}

.note-title-input :deep(.n-input__border),
.note-title-input :deep(.n-input__state-border) {
  border: none !important;
}

.note-title-input :deep(.n-input) {
  border: none !important;
}

.note-tags-input {
  margin: 16px 0;
}

.note-tags-input :deep(.n-select) {
  width: 100%;
}

.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-top: 1px solid #e4e7ed;
  margin-top: 32px;
  font-size: 14px;
  color: #909399;
}

.word-count,
.last-saved {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
