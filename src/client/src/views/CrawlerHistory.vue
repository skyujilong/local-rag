<template>
  <n-space vertical class="crawler-history" size="large">
    <n-space align="center" justify="space-between">
      <n-h1>爬取历史</n-h1>
      <n-button @click="$router.push('/crawler')">返回爬虫</n-button>
    </n-space>

    <!-- 筛选工具栏 -->
    <n-card :bordered="false">
      <n-space>
        <n-select
          v-model:value="statusFilter"
          :options="statusOptions"
          placeholder="筛选状态"
          clearable
          style="width: 150px"
          @update:value="loadTasks"
        />
        <n-button @click="loadTasks">刷新</n-button>
      </n-space>
    </n-card>

    <!-- 任务列表 -->
    <n-data-table
      :columns="columns"
      :data="tasks"
      :loading="loading"
      :pagination="pagination"
      :bordered="false"
    />
  </n-space>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import {
  NSpace,
  NH1,
  NCard,
  NSelect,
  NButton,
  NDataTable,
  NTag,
  NText,
  NSpin,
  useMessage,
  type DataTableColumns,
  type SelectOption,
} from 'naive-ui';
import { useCrawlApi } from '../composables/useCrawlApi';
import { useRouter } from 'vue-router';

const router = useRouter();
const message = useMessage();
const crawlApi = useCrawlApi();

const loading = ref(false);
const tasks = ref<any[]>([]);
const statusFilter = ref<string | null>(null);

const statusOptions: SelectOption[] = [
  { label: '运行中', value: 'running' },
  { label: '已完成', value: 'completed' },
  { label: '已暂停', value: 'paused' },
  { label: '失败', value: 'failed' },
];

const pagination = ref({
  pageSize: 20,
});

const columns: DataTableColumns<any> = [
  {
    title: 'Task ID',
    key: 'taskId',
    width: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: '模式',
    key: 'mode',
    width: 100,
    render: (row) => {
      const modeMap: Record<string, string> = {
        single: '单页面',
        sitemap: '站点地图',
        recursive: '递归',
      };
      return h(NTag, { type: 'info' }, { default: () => modeMap[row.mode] || row.mode });
    },
  },
  {
    title: 'URL 数量',
    key: 'totalUrls',
    width: 100,
  },
  {
    title: '进度',
    key: 'progress',
    width: 150,
    render: (row) => {
      if (row.mode === 'single') {
        return '-';
      }
      return h(NText, {}, { default: () => `${row.currentIndex} / ${row.totalUrls}` });
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) => {
      const statusMap: Record<string, { text: string; type: any }> = {
        pending: { text: '待处理', type: 'default' },
        running: { text: '运行中', type: 'info' },
        paused: { text: '已暂停', type: 'warning' },
        completed: { text: '已完成', type: 'success' },
        failed: { text: '失败', type: 'error' },
        auth_expired: { text: '认证过期', type: 'error' },
      };
      const status = statusMap[row.status] || { text: row.status, type: 'default' };
      return h(NTag, { type: status.type }, { default: () => status.text });
    },
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (row) => {
      return h(NSpace, {}, {
        default: () => [
          h(
            NButton,
            {
              size: 'small',
              onClick: () => viewResults(row.taskId),
            },
            { default: () => '查看结果' }
          ),
          row.status === 'running'
            ? h(
                NButton,
                {
                  size: 'small',
                  type: 'warning',
                  onClick: () => pauseTask(row.taskId),
                },
                { default: () => '暂停' }
              )
            : null,
          row.status === 'paused'
            ? h(
                NButton,
                {
                  size: 'small',
                  type: 'info',
                  onClick: () => resumeTask(row.taskId),
                },
                { default: () => '继续' }
              )
            : null,
        ],
      });
    },
  },
];

const loadTasks = async () => {
  loading.value = true;

  try {
    const response = await crawlApi.getTasks(statusFilter.value || undefined);
    tasks.value = response.tasks;
  } catch (err) {
    message.error('加载任务失败');
  } finally {
    loading.value = false;
  }
};

const viewResults = (taskId: string) => {
  // TODO: 实现结果查看详情
  message.info('查看结果功能待实现');
};

const pauseTask = async (taskId: string) => {
  try {
    await crawlApi.pauseTask(taskId);
    message.success('任务已暂停');
    await loadTasks();
  } catch (err) {
    message.error('暂停失败');
  }
};

const resumeTask = async (taskId: string) => {
  try {
    await crawlApi.resumeTask(taskId);
    message.success('任务已恢复');
    await loadTasks();
  } catch (err) {
    message.error('恢复失败');
  }
};

onMounted(() => {
  loadTasks();
});
</script>

<style scoped>
.crawler-history {
  padding: 24px;
}
</style>
