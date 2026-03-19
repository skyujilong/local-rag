<template>
  <div class="crawler-view">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card header="新建爬取任务">
          <el-form :model="crawlerForm" label-width="120px">
            <el-form-item label="目标 URL">
              <el-input
                v-model="crawlerForm.url"
                placeholder="https://example.com"
              />
            </el-form-item>
            <el-form-item label="等待登录">
              <el-switch v-model="crawlerForm.waitForAuth" />
              <span class="hint">开启后会打开浏览器等待扫码登录</span>
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                @click="startCrawler"
                :loading="crawlerStore.loading"
              >
                <el-icon><VideoPlay /></el-icon>
                开始爬取
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card header="任务列表" style="margin-top: 20px;">
          <el-table :data="crawlerStore.tasks">
            <el-table-column prop="url" label="URL" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">
                  {{ getStatusLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="认证状态" width="120">
              <template #default="{ row }">
                <el-tag v-if="row.authStatus" :type="getAuthStatusType(row.authStatus)">
                  {{ getAuthStatusLabel(row.authStatus) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="documentCount" label="文档数" width="80" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'running' || row.status === 'waiting_auth'"
                  link
                  type="warning"
                  @click="crawlerStore.cancelTask(row.id)"
                >
                  取消
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card header="已保存的会话">
          <el-empty v-if="crawlerStore.sessions.length === 0" description="暂无会话" />
          <div v-else class="sessions">
            <div
              v-for="session in crawlerStore.sessions"
              :key="session.domain"
              class="session-item"
            >
              <div class="session-info">
                <el-icon><Globe /></el-icon>
                <span>{{ session.domain }}</span>
              </div>
              <div class="session-time">
                {{ formatDate(session.updatedAt) }}
              </div>
              <el-button
                link
                type="danger"
                size="small"
                @click="handleDeleteSession(session.domain)"
              >
                删除
              </el-button>
            </div>
          </div>
        </el-card>

        <el-card header="登录状态" style="margin-top: 20px;">
          <el-alert
            v-if="currentTask?.authStatus === 'waiting_qrcode'"
            title="等待扫码登录"
            type="info"
            description="请在打开的浏览器窗口中扫描二维码登录"
            :closable="false"
            show-icon
          />
          <el-alert
            v-else-if="currentTask?.authStatus === 'success'"
            title="登录成功"
            type="success"
            :closable="false"
            show-icon
          />
          <el-alert
            v-else-if="currentTask?.authStatus === 'failed'"
            title="登录失败"
            type="error"
            :closable="false"
            show-icon
          />
          <el-empty v-else description="无活动登录" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCrawlerStore } from '@/stores';
import { ElMessage } from 'element-plus';
import type { CrawlerTask } from '@/types';

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

async function startCrawler() {
  if (!crawlerForm.value.url) {
    ElMessage.warning('请输入目标 URL');
    return;
  }

  try {
    await crawlerStore.startCrawler(crawlerForm.value);
    ElMessage.success('爬虫任务已创建');
    crawlerForm.value.url = '';
  } catch (error) {
    ElMessage.error('启动爬虫失败');
  }
}

function handleDeleteSession(domain: string) {
  crawlerStore.deleteSession(domain);
}

function getStatusType(status: string) {
  const types: Record<string, any> = {
    pending: 'info',
    running: 'warning',
    waiting_auth: 'warning',
    completed: 'success',
    failed: 'danger',
  };
  return types[status] || '';
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

function getAuthStatusType(status: string) {
  const types: Record<string, any> = {
    detected: 'warning',
    waiting_qrcode: 'info',
    success: 'success',
    failed: 'danger',
  };
  return types[status] || '';
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
