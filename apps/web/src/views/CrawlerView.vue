<template>
  <div class="crawler-view">
    <n-grid :cols="16" :x-gap="20">
      <n-grid-item :span="10">
        <n-card title="新建爬取任务">
          <n-form :model="crawlerForm" label-placement="left" label-width="120px">
            <n-form-item label="目标 URL">
              <n-input
                v-model:value="crawlerForm.url"
                placeholder="https://example.com"
              />
            </n-form-item>
            <n-form-item label="等待登录">
              <n-switch v-model:value="crawlerForm.waitForAuth" />
              <span class="hint">开启后会打开浏览器等待扫码登录</span>
            </n-form-item>
            <n-form-item>
              <n-button
                type="primary"
                @click="startCrawler"
                :loading="crawlerStore.loading"
              >
                <template #icon>
                  <n-icon :component="PlayOutline" />
                </template>
                开始爬取
              </n-button>
            </n-form-item>
          </n-form>
        </n-card>

        <n-card title="任务列表" style="margin-top: 20px;">
          <n-data-table
            :columns="taskColumns"
            :data="crawlerStore.tasks"
            :row-key="(row: any) => row.id"
          />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="6">
        <n-card title="已保存的会话">
          <n-empty v-if="crawlerStore.sessions.length === 0" description="暂无会话" />
          <div v-else class="sessions">
            <div
              v-for="session in crawlerStore.sessions"
              :key="session.domain"
              class="session-item"
            >
              <div class="session-info">
                <n-icon :component="GlobeOutline" />
                <span>{{ session.domain }}</span>
              </div>
              <div class="session-time">
                {{ formatDate(session.updatedAt) }}
              </div>
              <n-button
                text
                type="error"
                size="small"
                @click="handleDeleteSession(session.domain)"
              >
                删除
              </n-button>
            </div>
          </div>
        </n-card>

        <n-card title="登录状态" style="margin-top: 20px;">
          <n-alert
            v-if="currentTask?.authStatus === 'waiting_qrcode'"
            type="info"
            title="等待扫码登录"
          >
            请在打开的浏览器窗口中扫描二维码登录
          </n-alert>
          <n-alert
            v-else-if="currentTask?.authStatus === 'success'"
            type="success"
            title="登录成功"
          />
          <n-alert
            v-else-if="currentTask?.authStatus === 'failed'"
            type="error"
            title="登录失败"
          />
          <n-empty v-else description="无活动登录" />
        </n-card>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, onMounted, onUnmounted } from 'vue';
import { useCrawlerStore } from '@/stores';
import { message } from '@/utils/message';
// import type { CrawlerTask } from '@/types';
import { NButton, NTag, NIcon, type DataTableColumns } from 'naive-ui';
import { PlayOutline, GlobeOutline } from '@vicons/ionicons5';

const crawlerStore = useCrawlerStore();

const crawlerForm = ref({
  url: '',
  waitForAuth: false,
});

const currentTask = computed(() => {
  return crawlerStore.tasks.find(t =>
    t.status === 'running' || t.status === 'waiting_auth'
  );
});

// 任务表格列配置
const taskColumns = computed<DataTableColumns<any>>(() => [
  {
    title: 'URL',
    key: 'url',
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render: (row) => {
      return h(NTag, {
        type: getStatusTagType(row.status),
        size: 'small',
        bordered: false,
      }, { default: () => getStatusLabel(row.status) });
    },
  },
  {
    title: '认证状态',
    key: 'authStatus',
    width: 120,
    render: (row) => {
      if (!row.authStatus) return '-';
      return h(NTag, {
        type: getAuthStatusTagType(row.authStatus),
        size: 'small',
        bordered: false,
      }, { default: () => getAuthStatusLabel(row.authStatus) });
    },
  },
  {
    title: '文档数',
    key: 'documentCount',
    width: 80,
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) => {
      if (row.status === 'running' || row.status === 'waiting_auth') {
        return h(NButton, {
          text: true,
          type: 'warning',
          onClick: () => crawlerStore.cancelTask(row.id),
        }, { default: () => '取消' });
      }
      return null;
    },
  },
]);

async function startCrawler() {
  if (!crawlerForm.value.url) {
    message.warning('请输入目标 URL');
    return;
  }

  try {
    await crawlerStore.startCrawler(crawlerForm.value);
    message.success('爬虫任务已创建');
    crawlerForm.value.url = '';
  } catch {
    message.error('启动爬虫失败');
  }
}

function handleDeleteSession(domain: string) {
  crawlerStore.deleteSession(domain);
}

function getStatusTagType(status: string): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' {
  const types: Record<string, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
    pending: 'info',
    running: 'warning',
    waiting_auth: 'warning',
    completed: 'success',
    failed: 'error',
  };
  return types[status] || 'default';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    waiting_auth: '等待登录',
    completed: '已完成',
    failed: '失败',
  };
  return labels[status] || status;
}

function getAuthStatusTagType(status: string): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' {
  const types: Record<string, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
    detected: 'warning',
    waiting_qrcode: 'info',
    success: 'success',
    failed: 'error',
  };
  return types[status] || 'default';
}

function getAuthStatusLabel(status: string) {
  const labels: Record<string, string> = {
    detected: '检测到登录',
    waiting_qrcode: '等待扫码',
    success: '登录成功',
    failed: '登录失败',
  };
  return labels[status] || status;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

onMounted(() => {
  crawlerStore.loadTasks();
  crawlerStore.loadSessions();
  crawlerStore.connectWebSocket();
});

onUnmounted(() => {
  // WebSocket 连接会在 store 中管理重连
});
</script>

<style scoped>
.crawler-view {
  max-width: 1400px;
  margin: 0 auto;
}

.hint {
  margin-left: 12px;
  color: #909399;
  font-size: 14px;
}

.sessions {
  max-height: 400px;
  overflow-y: auto;
}

.session-item {
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-bottom: 8px;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  margin-bottom: 4px;
}

.session-time {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}
</style>
