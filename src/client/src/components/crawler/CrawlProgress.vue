<template>
  <n-card title="爬取进度" :bordered="false">
    <n-space vertical size="large">
      <n-space vertical>
        <n-space justify="space-between">
          <n-text>进度</n-text>
          <n-text>{{ progress.completed }} / {{ progress.total }}</n-text>
        </n-space>
        <n-progress
          type="line"
          :percentage="percentage"
          :indicator-placement="'inside'"
          :processing="task.status === 'running'"
        />
      </n-space>

      <!-- 统计信息 -->
      <n-grid :cols="3" :x-gap="12">
        <n-grid-item>
          <n-statistic label="成功" :value="stats.success">
            <template #prefix>
              <n-icon color="#18a058"><CheckmarkIcon /></n-icon>
            </template>
          </n-statistic>
        </n-grid-item>
        <n-grid-item>
          <n-statistic label="失败" :value="stats.failed">
            <template #prefix>
              <n-icon color="#d03050"><CloseIcon /></n-icon>
            </template>
          </n-statistic>
        </n-grid-item>
        <n-grid-item>
          <n-statistic label="剩余" :value="stats.remaining">
            <template #prefix>
              <n-icon color="#2080f0"><TimeIcon /></n-icon>
            </template>
          </n-statistic>
        </n-grid-item>
      </n-grid>

      <!-- 当前任务 -->
      <n-alert v-if="task.status === 'running'" type="info" :bordered="false">
        <n-space align="center">
          <n-spin :size="16" />
          <n-text>正在爬取: {{ currentUrl }}</n-text>
        </n-space>
      </n-alert>

      <!-- 认证过期提示 -->
      <n-alert v-if="task.status === 'auth_expired'" type="warning" :bordered="false">
        <template #header>
          <n-space align="center">
            <n-icon><WarningIcon /></n-icon>
            <span>认证已过期</span>
          </n-space>
        </template>
        批量爬取任务已暂停，请重新配置认证后继续。
      </n-alert>

      <!-- 操作按钮 -->
      <n-space>
        <n-button
          v-if="task.status === 'running'"
          type="warning"
          @click="handlePause"
        >
          暂停
        </n-button>
        <n-button
          v-if="task.status === 'paused'"
          type="info"
          @click="handleResume"
        >
          继续
        </n-button>
        <n-button
          type="error"
          :disabled="['completed', 'failed'].includes(task.status)"
          @click="handleTerminate"
        >
          终止
        </n-button>
        <n-button
          v-if="task.status === 'completed'"
          type="primary"
          @click="showImportConfirm"
        >
          导入确认
        </n-button>
      </n-space>

      <!-- 导入确认弹窗 -->
      <n-modal
        v-model:show="showImportModal"
        preset="card"
        title="批量导入确认"
        :style="{ width: '90vw' }"
        :mask-closable="false"
      >
        <n-scrollbar style="max-height: 60vh">
          <n-data-table
            :columns="columns"
            :data="importItems"
            :row-key="(row: any) => row.resultId"
            :max-height="400"
          />
        </n-scrollbar>

        <template #footer>
          <n-space justify="space-between">
            <n-space>
              <n-button @click="selectAll">全选</n-button>
              <n-button @click="selectNone">取消全选</n-button>
              <n-button @click="selectHighQuality">仅选择高质量</n-button>
            </n-space>
            <n-space>
              <n-button @click="showImportModal = false">取消</n-button>
              <n-button
                type="primary"
                :disabled="selectedCount === 0"
                @click="handleBatchImport"
              >
                导入 ({{ selectedCount }})
              </n-button>
            </n-space>
          </n-space>
        </template>
      </n-modal>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  NSpace,
  NCard,
  NText,
  NProgress,
  NGrid,
  NGridItem,
  NStatistic,
  NIcon,
  NAlert,
  NSpin,
  NButton,
  NModal,
  NScrollbar,
  NDataTable,
  useMessage,
  type DataTableColumns,
} from 'naive-ui';
import {
  CheckmarkCircle as CheckmarkIcon,
  CloseCircle as CloseIcon,
  TimeOutline as TimeIcon,
  Warning as WarningIcon,
} from '@vicons/ionicons5';
import { useCrawlApi } from '../composables/useCrawlApi';

const props = defineProps<{
  taskId: string;
}>();

const emit = defineEmits<{
  completed: [];
}>();

const message = useMessage();
const crawlApi = useCrawlApi();

const task = ref<any>({ status: 'pending' });
const progress = ref({ completed: 0, total: 0 });
const currentUrl = ref('');
const results = ref<any[]>([]);
const showImportModal = ref(false);
const importItems = ref<any[]>([]);
const selectedItems = ref<Set<string>>(new Set());

let pollingInterval: number | null = null;

const percentage = computed(() => {
  if (progress.value.total === 0) return 0;
  return Math.round((progress.value.completed / progress.value.total) * 100);
});

const stats = computed(() => {
  const success = results.value.filter((r) => r.status === 'success').length;
  const failed = results.value.filter((r) => r.status === 'failed').length;
  const remaining = progress.value.total - progress.value.completed;
  return { success, failed, remaining };
});

const selectedCount = computed(() => selectedItems.value.size);

const columns: DataTableColumns<any> = [
  {
    type: 'selection',
    multiple: true,
    checkedRowKeys: selectedItems,
    onUpdateCheckedRowKeys: (keys: string[]) => {
      selectedItems.value = new Set(keys);
    },
  },
  { title: '标题', key: 'title', width: 200, ellipsis: { tooltip: true } },
  { title: 'URL', key: 'url', width: 300, ellipsis: { tooltip: true } },
  { title: '字数', key: 'wordCount', width: 100 },
  {
    title: '质量',
    key: 'qualityScore',
    width: 100,
    render: (row) => {
      const score = row.qualityScore || 0;
      const type = score >= 0.8 ? 'success' : score >= 0.5 ? 'warning' : 'error';
      return `${(score * 100).toFixed(0)}%`;
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) => {
      const statusMap: Record<string, string> = {
        success: '成功',
        failed: '失败',
        pending: '待处理',
      };
      return statusMap[row.status] || row.status;
    },
  },
];

const loadTask = async () => {
  try {
    const response = await crawlApi.getTask(props.taskId);
    task.value = response.task;
    results.value = response.results || [];

    if (response.checkpoint) {
      progress.value.completed = response.checkpoint.urlIndex;
      progress.value.total = response.task.totalUrls;
    }

    // 获取当前 URL
    if (task.value.status === 'running' && results.value.length > 0) {
      const lastResult = results.value[results.value.length - 1];
      currentUrl.value = lastResult.url || '';
    }

    // 轮询控制
    if (task.value.status === 'running') {
      if (!pollingInterval) {
        pollingInterval = window.setInterval(loadTask, 2000);
      }
    } else {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }

      if (task.value.status === 'completed') {
        emit('completed');
      }
    }
  } catch (err) {
    message.error('加载任务失败');
  }
};

const handlePause = async () => {
  try {
    await crawlApi.pauseTask(props.taskId);
    message.success('任务已暂停');
  } catch (err) {
    message.error('暂停失败');
  }
};

const handleResume = async () => {
  try {
    await crawlApi.resumeTask(props.taskId);
    message.success('任务已恢复');
    loadTask();
  } catch (err) {
    message.error('恢复失败');
  }
};

const handleTerminate = async () => {
  try {
    await crawlApi.terminateTask(props.taskId);
    message.success('任务已终止');
  } catch (err) {
    message.error('终止失败');
  }
};

const showImportConfirm = () => {
  importItems.value = results.value
    .filter((r) => r.status === 'success')
    .map((r) => ({
      ...r,
      selected: true,
      tags: ['webpage'],
    }));

  selectedItems.value = new Set(importItems.value.map((item) => item.resultId));
  showImportModal.value = true;
};

const selectAll = () => {
  selectedItems.value = new Set(importItems.value.map((item) => item.resultId));
};

const selectNone = () => {
  selectedItems.value.clear();
};

const selectHighQuality = () => {
  const highQualityIds = importItems.value
    .filter((item) => (item.qualityScore || 0) >= 0.8)
    .map((item) => item.resultId);
  selectedItems.value = new Set(highQualityIds);
};

const handleBatchImport = async () => {
  try {
    const items = importItems.value
      .filter((item) => selectedItems.value.has(item.resultId))
      .map((item) => ({
        resultId: item.resultId,
        selected: true,
        tags: item.tags,
      }));

    await crawlApi.batchImport({
      taskId: props.taskId,
      items,
      batchTags: ['webpage'],
    });

    message.success('导入成功');
    showImportModal.value = false;
  } catch (err) {
    message.error('导入失败');
  }
};

onMounted(() => {
  loadTask();
});

onUnmounted(() => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
});
</script>
