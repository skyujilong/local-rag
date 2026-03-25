<template>
  <div class="crawler-view">
    <n-grid :cols="16" :x-gap="20">
      <n-grid-item :span="10">
        <n-card title="新建爬取任务">
          <n-form :model="crawlerForm" label-placement="left" label-width="140px">
            <n-form-item label="目标 URL">
              <n-input
                v-model:value="crawlerForm.url"
                placeholder="https://example.com"
              />
            </n-form-item>
            <n-form-item label="爬取模式">
              <n-radio-group v-model:value="crawlerForm.taskType">
                <n-radio value="single">单页爬取</n-radio>
                <n-radio value="batch">批量递归爬取</n-radio>
              </n-radio-group>
            </n-form-item>
            <n-form-item label="内容 XPath（可选）">
              <n-input
                v-model:value="crawlerForm.contentXPath"
                placeholder="//div[@class='content']"
                type="textarea"
                :rows="2"
              />
              <span class="hint">不填写则使用默认的 Readability 提取</span>
            </n-form-item>
            <!-- 批量模式专属配置 -->
            <template v-if="crawlerForm.taskType === 'batch'">
              <n-form-item label="链接列表 XPath">
                <n-input
                  v-model:value="crawlerForm.linksXPath"
                  placeholder="//div[@class='doc-list']//a[@href]"
                  type="textarea"
                  :rows="2"
                />
                <span class="hint">用于提取要爬取的链接列表</span>
              </n-form-item>
              <n-form-item label="最大链接数">
                <n-input-number v-model:value="crawlerForm.maxLinks" :min="1" :max="500" />
              </n-form-item>
            </template>
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

        <!-- 浏览器就绪确认面板 -->
        <n-card v-if="currentTask?.status === 'browser_ready'" title="浏览器已就绪" style="margin-top: 20px;">
          <n-alert type="info" style="margin-bottom: 16px;">
            浏览器已打开并导航到目标页面。请手动登录（如需要），然后点击下方按钮开始爬取。
          </n-alert>
          <n-space>
            <n-button type="primary" @click="confirmStartCrawl" :loading="confirming">
              确认开始爬取
            </n-button>
            <n-button @click="cancelTask">
              取消任务
            </n-button>
          </n-space>
        </n-card>

        <!-- 批量爬取进度面板 -->
        <n-card v-if="currentTask?.type === 'batch' && showBatchProgress" title="批量爬取进度" style="margin-top: 20px;">
          <n-progress :percentage="batchProgressPercentage" />
          <div class="batch-stats">
            <span>已完成：{{ currentTask.completedLinks || 0 }} / {{ currentTask.totalLinks || 0 }}</span>
            <span>成功：{{ successCount }} | 失败：{{ failedCount }}</span>
          </div>
          <!-- 批量结果列表（可折叠） -->
          <n-collapse v-if="currentTask.batchResults && currentTask.batchResults.length > 0" style="margin-top: 16px;">
            <n-collapse-item title="查看详细结果" name="results">
              <n-list>
                <n-list-item v-for="(result, idx) in currentTask.batchResults" :key="idx">
                  <template #prefix>
                    <n-tag
                      :type="result.status === 'success' ? 'success' : result.status === 'failed' ? 'error' : 'default'"
                      size="small"
                    >
                      {{ result.status === 'success' ? '成功' : result.status === 'failed' ? '失败' : '待处理' }}
                    </n-tag>
                  </template>
                  <div class="batch-result-item">
                    <div class="result-url">{{ result.url }}</div>
                    <div v-if="result.title" class="result-title">{{ result.title }}</div>
                    <div v-if="result.error" class="result-error">{{ result.error }}</div>
                  </div>
                </n-list-item>
              </n-list>
            </n-collapse-item>
          </n-collapse>
        </n-card>

        <!-- 内容确认面板 -->
        <n-card v-if="currentTask?.status === 'waiting_confirm'" title="确认爬取内容" style="margin-top: 20px;" :key="currentTask.id + '-' + currentTask.lastUpdatedAt">
          <n-alert type="success" style="margin-bottom: 16px;">
            已提取内容，请确认是否符合预期。确认后将保存为草稿。
          </n-alert>

          <!-- 添加：显示 Markdown 字符数 -->
          <div v-if="currentTask.previewMarkdown" class="markdown-info">
            <n-tag type="info" size="small">
              {{ currentTask.previewMarkdown.length }} 字符
            </n-tag>
          </div>

          <div class="markdown-preview">
            <div v-html="renderedMarkdown" class="markdown-content"></div>
          </div>
          <n-space style="margin-top: 16px;">
            <n-button type="primary" @click="confirmContent(true)">
              确认并保存草稿
            </n-button>
            <n-button @click="confirmContent(false)">
              重新提取
            </n-button>
          </n-space>
          <n-alert v-if="draftId" type="info" style="margin-top: 16px;">
            草稿已保存，ID: {{ draftId }}
          </n-alert>
        </n-card>

        <!-- 实时进度面板 -->
        <n-card v-if="showProgressPanel" title="任务进度" style="margin-top: 20px;">
          <n-progress
            type="line"
            :percentage="currentTaskProgress"
            :status="progressStatus"
            :show-indicator="true"
          />
          <div class="progress-details">
            <div class="step-info">
              <span class="step-label">当前步骤：</span>
              <span class="step-value">{{ currentTask?.progress?.currentStep }}</span>
            </div>
            <div class="step-stats">
              <span>步骤 {{ currentTask?.progress?.currentStepNumber }} / {{ currentTask?.progress?.totalSteps }}</span>
            </div>
            <div v-if="currentTask?.progress?.stepDetails" class="step-details">
              {{ currentTask.progress.stepDetails }}
            </div>
          </div>
        </n-card>

        <n-card title="任务列表" style="margin-top: 20px;">
          <n-data-table
            :columns="taskColumns"
            :data="tasksList"
            :row-key="(row: any) => row.id"
          />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="6">
        <n-card title="WebSocket 连接状态" style="margin-bottom: 20px;">
          <n-space vertical>
            <n-tag :type="crawlerStore.wsConnected ? 'success' : 'error'">
              {{ crawlerStore.wsConnected ? '已连接' : '未连接' }}
            </n-tag>
            <n-button size="small" @click="crawlerStore.connectWebSocket()">
              重新连接
            </n-button>
          </n-space>
        </n-card>

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
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, onMounted, onUnmounted, watch } from 'vue';
import { NButton, NTag, NIcon, type DataTableColumns } from 'naive-ui';
import { PlayOutline, GlobeOutline } from '@vicons/ionicons5';
import MarkdownIt from 'markdown-it';
import { message } from '@/utils/message';
import type { CrawlerTask } from '@local-rag/shared/types';
import { useCrawlerStore } from '@/stores/crawler';

const md = new MarkdownIt();
const crawlerStore = useCrawlerStore();

const crawlerForm = ref({
  url: '',
  taskType: 'single' as 'single' | 'batch',
  contentXPath: '',
  linksXPath: '',
  maxLinks: 100,
});

const confirming = ref(false);
const draftId = ref('');

// 安全的任务列表，确保始终是数组
const tasksList = computed(() => {
  const tasks = crawlerStore.tasks || [];
  if (!Array.isArray(tasks)) {
    console.warn('[CrawlerView] crawlerStore.tasks 不是数组:', tasks);
    return [];
  }
  return tasks;
});

const currentTask = computed(() => {
  // 过滤出活跃任务（排除已完成、失败、取消的任务）
  const activeTasks = tasksList.value.filter((t: CrawlerTask) =>
    t.status === 'running' ||
    t.status === 'browser_ready' ||
    t.status === 'waiting_confirm'
  );

  // 按创建时间倒序排列，最新的任务在最前面
  const sortedTasks = activeTasks.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime; // 降序，最新的在前
  });

  // 如果有多个 waiting_confirm 任务，只保留最新的
  // 这可以防止用户看到旧的未确认任务
  const waitingConfirmTasks = sortedTasks.filter(t => t.status === 'waiting_confirm');
  if (waitingConfirmTasks.length > 1) {
    // 只保留最新的 waiting_confirm 任务
    const latestWaitingTask = waitingConfirmTasks[0];
    const otherTasks = sortedTasks.filter(t => t.status !== 'waiting_confirm' || t.id === latestWaitingTask.id);
    sortedTasks.length = 0;
    sortedTasks.push(...otherTasks);
  }

  const task = sortedTasks[0] || null;

  if (import.meta.dev) {
    console.log('[DEBUG] currentTask 计算', {
      taskId: task?.id,
      status: task?.status,
      tasksListLength: tasksList.value.length,
      activeTasksCount: activeTasks.length,
      waitingConfirmCount: waitingConfirmTasks.length,
      allTasksStatus: tasksList.value.map(t => ({ id: t.id, status: t.status, createdAt: t.createdAt })),
    });
  }
  return task;
});

// 监听当前任务变化（深度监听整个对象）
watch(
  currentTask,
  (newTask, oldTask) => {
    if (import.meta.dev) {
      console.log('[CrawlerView] 当前任务变化:', {
        oldId: oldTask?.id,
        newId: newTask?.id,
        newStatus: newTask?.status,
        hasPreviewMarkdown: !!newTask?.previewMarkdown,
        previewMarkdownLength: newTask?.previewMarkdown?.length || 0,
      });
    }
  },
  { deep: true, immediate: true }
);

const renderedMarkdown = computed(() => {
  const previewMarkdown = currentTask.value?.previewMarkdown;
  if (!previewMarkdown) {
    return '';
  }

  if (import.meta.dev) {
    console.log('[CrawlerView] 渲染 Markdown:', previewMarkdown.length, '字符');
  }
  return md.render(previewMarkdown);
});

// 进度面板显示逻辑
const showProgressPanel = computed(() => {
  return currentTask.value?.status === 'running';
});

// 批量爬取进度面板显示逻辑
const showBatchProgress = computed(() => {
  return currentTask.value?.status === 'running' && currentTask.value.type === 'batch';
});

// 批量爬取进度百分比
const batchProgressPercentage = computed(() => {
  const task = currentTask.value;
  if (!task || !task.totalLinks || task.totalLinks === 0) return 0;
  return Math.round((task.completedLinks || 0) / task.totalLinks * 100);
});

// 批量爬取成功/失败统计
const successCount = computed(() => {
  const task = currentTask.value;
  if (!task || !task.batchResults) return 0;
  return task.batchResults.filter(r => r.status === 'success').length;
});

const failedCount = computed(() => {
  const task = currentTask.value;
  if (!task || !task.batchResults) return 0;
  return task.batchResults.filter(r => r.status === 'failed').length;
});

// 新增：当前任务进度百分比
const currentTaskProgress = computed(() => {
  return currentTask.value?.progress?.progressPercentage || 0;
});

// 进度状态
const progressStatus = computed(() => {
  return 'info' as const;
});

// 任务表格列配置
const taskColumns = computed<DataTableColumns<CrawlerTask>>(() => [
  {
    title: 'URL',
    key: 'url',
  },
  {
    title: '类型',
    key: 'type',
    width: 80,
    render: (row) => {
      return row.type === 'batch' ? '批量' : '单页';
    },
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
    title: '文档数',
    key: 'documentCount',
    width: 80,
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) => {
      if (row.status === 'running' || row.status === 'browser_ready' || row.status === 'waiting_confirm') {
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
    // 重置表单，但保留 contentXPath 和 linksXPath 方便下次使用
    const savedContentXPath = crawlerForm.value.contentXPath;
    const savedLinksXPath = crawlerForm.value.linksXPath;
    crawlerForm.value = {
      url: '',
      taskType: 'single',
      contentXPath: savedContentXPath,
      linksXPath: savedLinksXPath,
      maxLinks: 100,
    };
  } catch {
    message.error('启动爬虫失败');
  }
}

async function confirmStartCrawl() {
  if (!currentTask.value) {
    message.error('当前没有活动任务');
    return;
  }
  confirming.value = true;
  try {
    await crawlerStore.confirmStartCrawl(currentTask.value.id);
    message.success('开始爬取');
  } catch {
    message.error('操作失败');
  } finally {
    confirming.value = false;
  }
}

async function confirmContent(confirmed: boolean) {
  if (!currentTask.value) {
    message.error('当前没有活动任务');
    return;
  }

  // 确认前先同步一次状态，确保状态一致
  try {
    await crawlerStore.loadTasks();
  } catch {
    // 同步失败不影响继续操作
  }

  // 重新获取任务（从更新后的列表）
  const task = crawlerStore.tasks.find(t => t.id === currentTask.value.id);
  if (!task || task.status !== 'waiting_confirm') {
    message.error('任务状态已变更，请刷新页面');
    return;
  }

  // 详细的调试日志
  console.log('[DEBUG] confirmContent 被调用', {
    confirmed,
    taskId: task.id,
    taskStatus: task.status,
    taskUrl: task.url,
    taskLastUpdatedAt: task.lastUpdatedAt,
    hasPreviewMarkdown: !!task.previewMarkdown,
    previewMarkdownLength: task.previewMarkdown?.length || 0,
  });

  try {
    const response = await crawlerStore.confirmContent(task.id, confirmed);
    if (confirmed && response?.data?.draftId) {
      draftId.value = response.data.draftId;
      message.success('草稿已保存');
    } else if (!confirmed) {
      message.info('已取消，您可以重新创建爬取任务');
    }
  } catch {
    message.error('操作失败');
  }
}

async function cancelTask() {
  if (!currentTask.value) {
    message.error('当前没有活动任务');
    return;
  }
  try {
    await crawlerStore.cancelTask(currentTask.value.id);
    message.info('任务已取消');
  } catch {
    message.error('取消任务失败');
  }
}

function handleDeleteSession(domain: string) {
  crawlerStore.deleteSession(domain);
}

function getStatusTagType(status: string): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' {
  const types: Record<string, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
    pending: 'info',
    running: 'warning',
    browser_ready: 'primary',
    waiting_confirm: 'primary',
    completed: 'success',
    failed: 'error',
  };
  return types[status] || 'default';
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    browser_ready: '等待确认',
    waiting_confirm: '等待确认',
    completed: '已完成',
    failed: '失败',
  };
  return labels[status] || status;
}

function formatDate(dateValue: string | Date) {
  return new Date(dateValue).toLocaleString('zh-CN');
}

onMounted(async () => {
  console.log('[CrawlerView] 组件已挂载，开始初始化 WebSocket');

  // 先连接 WebSocket，确保连接建立后再注册处理器
  crawlerStore.connectWebSocket();

  // 等待一小段时间让 WebSocket 连接建立
  await new Promise(resolve => setTimeout(resolve, 100));

  // 注册 WebSocket 处理器
  crawlerStore.registerHandlers();

  // 加载会话列表
  crawlerStore.loadSessions();

  // 加载任务列表（确保即使 WebSocket 连接失败也能看到任务）
  await crawlerStore.loadTasks();

  console.log('[CrawlerView] WebSocket 初始化完成', {
    wsConnected: crawlerStore.wsConnected,
    tasksCount: crawlerStore.tasks.length,
  });
});

onUnmounted(() => {
  // 取消注册 WebSocket 处理器
  crawlerStore.unregisterHandlers();
  // 注意：不断开 WebSocket 连接，保持全局单例
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

.markdown-preview {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  background-color: #f9f9f9;
}

.markdown-content {
  color: #333;
  line-height: 1.6;
}

.markdown-content :deep(h1) {
  font-size: 24px;
  font-weight: 600;
  margin: 16px 0 8px;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.markdown-content :deep(h2) {
  font-size: 20px;
  font-weight: 600;
  margin: 14px 0 6px;
}

.markdown-content :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 12px 0 6px;
}

.markdown-content :deep(p) {
  margin: 8px 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
}

.markdown-content :deep(a) {
  color: #409eff;
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 4px solid #409eff;
  background-color: #f0f9ff;
  color: #666;
}

.markdown-content :deep(code) {
  padding: 2px 6px;
  background-color: #f5f5f5;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.markdown-content :deep(pre) {
  padding: 12px;
  background-color: #f5f5f5;
  border-radius: 4px;
  overflow-x: auto;
}

.markdown-content :deep(pre code) {
  padding: 0;
  background-color: transparent;
}

.markdown-info {
  margin-bottom: 12px;
}

/* 进度面板样式 */
.progress-details {
  margin-top: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 4px;
}

.step-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.step-label {
  font-weight: 500;
  color: #666;
}

.step-value {
  font-weight: 600;
  color: #333;
}

.step-stats {
  font-size: 14px;
  color: #909399;
  margin-bottom: 8px;
}

.step-details {
  font-size: 13px;
  color: #666;
  padding: 8px;
  background: #fff;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

/* XPath 使用指南样式 */
:deep(.n-alert__content) ol {
  margin: 8px 0;
  padding-left: 20px;
}

:deep(.n-alert__content) li {
  margin: 4px 0;
  line-height: 1.6;
}

:deep(.n-alert__content) code {
  padding: 2px 6px;
  background-color: #f5f5f5;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #e83e8c;
}

:deep(.n-alert__content) ul {
  margin: 4px 0;
  padding-left: 20px;
}

/* 批量爬取进度面板样式 */
.batch-stats {
  margin-top: 12px;
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #666;
}

.batch-result-item {
  width: 100%;
}

.result-url {
  font-size: 12px;
  color: #909399;
  word-break: break-all;
}

.result-title {
  font-size: 14px;
  color: #333;
  margin-top: 4px;
}

.result-error {
  font-size: 12px;
  color: #f56c6c;
  margin-top: 4px;
}
</style>
