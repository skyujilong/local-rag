<template>
  <div class="save-status" :class="`status-${actualStatus}`">
    <n-icon :size="16" class="status-icon">
      <component :is="statusIconComponent" />
    </n-icon>
    <span class="status-text">{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Ref } from 'vue';
import { NIcon } from 'naive-ui';
import {
  PencilOutline,
  RefreshOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
} from '@vicons/ionicons5';
import type { SaveStatus } from '@/composables/useAutoSave';

interface Props {
  status: SaveStatus | Ref<SaveStatus>;
  lastSavedAt?: Date | null;
}

const props = defineProps<Props>();

const actualStatus = computed(() => {
  return typeof props.status === 'object' && 'value' in props.status
    ? props.status.value
    : props.status;
});

const statusIconComponent = computed(() => {
  switch (actualStatus.value) {
    case 'idle':
      return PencilOutline;
    case 'saving':
      return RefreshOutline;
    case 'saved':
      return CheckmarkCircleOutline;
    case 'error':
      return CloseCircleOutline;
    default:
      return PencilOutline;
  }
});

const statusText = computed(() => {
  switch (actualStatus.value) {
    case 'idle':
      return '输入中...';
    case 'saving':
      return '保存中...';
    case 'saved':
      return props.lastSavedAt ? getTimeAgo(props.lastSavedAt) : '已保存';
    case 'error':
      return '保存失败';
    default:
      return '';
  }
});

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return '刚刚保存';
  if (minutes < 60) return `${minutes} 分钟前保存`;

  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} 小时前保存`;

  const days = Math.floor(diff / 86400000);
  if (days < 7) return `${days} 天前保存`;

  return date.toLocaleDateString('zh-CN');
}
</script>

<style scoped>
.save-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  transition: color 0.3s;
}

.save-status.status-idle {
  color: #909399;
}

.save-status.status-saving {
  color: #18a058;
}

.save-status.status-saving .status-icon {
  animation: spin 1s linear infinite;
}

.save-status.status-saved {
  color: #67c23a;
}

.save-status.status-error {
  color: #f56c6c;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
