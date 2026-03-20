<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    title="发现草稿"
    :style="{ width: '540px' }"
    :mask-closable="false"
    :closable="true"
    :bordered="false"
  >
    <div class="draft-restore-content">
      <n-icon class="draft-icon" :size="48" :component="DocumentTextOutline" />

      <div class="draft-info">
        <p class="draft-message">
          发现此笔记的本地草稿（保存于 {{ timeAgo }}）
        </p>
        <div class="draft-preview">
          <div class="draft-preview-title">
            {{ draft?.title || '无标题' }}
          </div>
          <div class="draft-preview-content">
            {{ previewContent }}
          </div>
          <div v-if="draft?.tags.length" class="draft-preview-tags">
            <n-tag
              v-for="tag in draft.tags"
              :key="tag"
              size="small"
              :bordered="false"
            >
              {{ tag }}
            </n-tag>
          </div>
        </div>
      </div>

      <div class="draft-actions">
        <n-button @click="handleDiscard">
          <template #icon>
            <n-icon :component="TrashOutline" />
          </template>
          放弃草稿
        </n-button>
        <n-button type="primary" @click="handleRestore">
          <template #icon>
            <n-icon :component="RefreshOutline" />
          </template>
          恢复草稿
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DocumentTextOutline, TrashOutline, RefreshOutline } from '@vicons/ionicons5';
import type { DraftData } from '@/utils/draft-storage';

interface Props {
  modelValue?: boolean;
  draft: DraftData | null;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: true,
  draft: null,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'restore': [draft: DraftData];
  'discard': [];
  'cancel': [];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const previewContent = computed(() => {
  if (!props.draft) return '';

  const text = props.draft.content.replace(/<[^>]*>/g, '').trim();
  return text.length > 150 ? text.slice(0, 150) + '...' : text;
});

const timeAgo = computed(() => {
  if (!props.draft) return '';

  const date = new Date(props.draft.updatedAt);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days} 天前`;

  return date.toLocaleDateString('zh-CN');
});

function handleRestore() {
  if (props.draft) {
    emit('restore', props.draft);
  }
}

function handleDiscard() {
  emit('discard');
}
</script>

<style scoped>
.draft-restore-content {
  padding: 20px 0;
}

.draft-icon {
  display: block;
  margin: 0 auto 16px;
  color: #18a058;
}

.draft-info {
  text-align: center;
  margin-bottom: 24px;
}

.draft-message {
  font-size: 16px;
  color: #303133;
  margin: 0 0 16px;
}

.draft-preview {
  background-color: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  text-align: left;
}

.draft-preview-title {
  font-weight: 600;
  font-size: 16px;
  color: #303133;
  margin-bottom: 8px;
}

.draft-preview-content {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 12px;
}

.draft-preview-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.draft-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
