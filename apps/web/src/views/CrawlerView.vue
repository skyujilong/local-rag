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
            <n-form-item label="等待登录">
              <n-switch v-model:value="crawlerForm.waitForAuth" />
              <span class="hint">开启后会打开浏览器等待扫码登录</span>
            </n-form-item>
            <n-form-item label="使用 XPath 精确提取">
              <n-switch v-model:value="crawlerForm.useXPath" />
              <span class="hint">开启后登录成功需手动输入 XPath 提取内容</span>
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

        <!-- XPath 输入面板 -->
        <n-card v-if="currentTask?.status === 'waiting_xpath'" title="设置内容提取区域" style="margin-top: 20px;">
          <n-alert type="info" style="margin-bottom: 16px;">
            <template #header>
              如何获取 XPath？
            </template>
            <ol style="margin: 8px 0; padding-left: 20px;">
              <li>在打开的浏览器窗口中，找到要提取的内容区域</li>
              <li>右键点击该内容，选择"检查"或"审查元素"</li>
              <li>在开发者工具中，右键点击高亮的 HTML 元素</li>
              <li>选择 Copy → Copy XPath（复制 XPath）</li>
              <li>将复制的 XPath 粘贴到下方输入框</li>
            </ol>
            <div style="margin-top: 12px; padding: 8px 12px; background: #f0f9ff; border-radius: 4px;">
              <strong>常用 XPath 示例：</strong>
              <ul style="margin: 4px 0; padding-left: 20px;">
                <li><code>//article</code> - 提取文章内容</li>
                <li><code>//div[@class='content']</code> - 提取 class 为 content 的 div</li>
                <li><code>//main</code> - 提取主要内容区域</li>
                <li><code>//div[@id='post-content']</code> - 提取 id 为 post-content 的元素</li>
              </ul>
            </div>
          </n-alert>
          <n-form-item label="XPath 表达式">
            <n-input
              v-model:value="xpathInput"
              placeholder="//div[@class='content']"
              type="textarea"
              :rows="3"
            />
          </n-form-item>
          <n-space>
            <n-button type="primary" @click="submitXPath" :loading="submitting">
              提取预览
            </n-button>
            <n-button @click="cancelTask">
              取消任务
            </n-button>
          </n-space>
        </n-card>

        <!-- 内容确认面板 -->
        <n-card v-if="currentTask?.status === 'waiting_confirm'" title="确认爬取内容" style="margin-top: 20px;">
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

        <!-- 新增：实时进度面板 -->
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

        <!-- 浏览器控制面板 -->
        <n-card v-if="showBrowserControl" title="浏览器控制" style="margin-top: 20px;" class="browser-control-card">
          <n-alert type="info" style="margin-bottom: 16px;">
            浏览器保持打开中，您可以继续使用或手动关闭
          </n-alert>
          <n-space>
            <n-button type="error" @click="handleCloseBrowser">
              关闭浏览器
            </n-button>
          </n-space>
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
import { ref, h, computed, onMounted, onUnmounted, watch } from 'vue';
import { useCrawlerStore } from '@/stores';
import { message } from '@/utils/message';
// import type { CrawlerTask } from '@/types';
import { NButton, NTag, NIcon, type DataTableColumns } from 'naive-ui';
import { PlayOutline, GlobeOutline } from '@vicons/ionicons5';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();
const crawlerStore = useCrawlerStore();

const crawlerForm = ref({
  url: '',
  waitForAuth: false,
  useXPath: false,
});

const xpathInput = ref('');
const submitting = ref(false);
const draftId = ref('');

const currentTask = computed(() => {
  return crawlerStore.tasks.find(t =>
    t.status === 'running' ||
    t.status === 'waiting_auth' ||
    t.status === 'waiting_xpath' ||
    t.status === 'waiting_confirm'
  );
});

// 监听当前任务变化，确保预览更新
watch(
  () => currentTask.value?.previewMarkdown,
  (newMarkdown) => {
    if (newMarkdown && import.meta.env.DEV) {
      console.log('[CrawlerView] 预览 Markdown 已更新:', newMarkdown.length, '字符');
    }
  },
  { immediate: true }
);

const renderedMarkdown = computed(() => {
  if (!currentTask.value?.previewMarkdown) {
    return '';
  }

  if (import.meta.env.DEV) {
    console.log('[CrawlerView] 渲染 Markdown:', currentTask.value.previewMarkdown.length, '字符');
  }
  return md.render(currentTask.value.previewMarkdown);
});

// 新增：进度面板显示逻辑
const showProgressPanel = computed(() => {
  return currentTask.value?.status === 'running' ||
         currentTask.value?.status === 'waiting_auth' ||
         currentTask.value?.status === 'waiting_xpath';
});

// 新增：当前任务进度百分比
const currentTaskProgress = computed(() => {
  return currentTask.value?.progress?.progressPercentage || 0;
});

// 新增：进度状态
const progressStatus = computed(() => {
  const status = currentTask.value?.status;
  if (status === 'running' || status === 'waiting_auth') {
    return 'info' as const;
  }
  if (status === 'waiting_xpath') {
    return 'warning' as const;
  }
  return 'default' as const;
});

// 显示浏览器控制面板：任务已完成且使用了 XPath 模式
const showBrowserControl = computed(() => {
  return crawlerStore.tasks.some(t =>
    (t.status === 'completed' || t.status === 'waiting_confirm') && t.useXPath === true
  );
});

// 获取已完成的 XPath 任务
const completedXPathTask = computed(() => {
  return crawlerStore.tasks.find(t =>
    (t.status === 'completed' || t.status === 'waiting_confirm') && t.useXPath === true
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
      if (row.status === 'running' || row.status === 'waiting_auth' || row.status === 'waiting_xpath' || row.status === 'waiting_confirm') {
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

async function submitXPath() {
  if (!xpathInput.value) {
    message.warning('请输入 XPath');
    return;
  }
  if (!currentTask.value) {
    message.error('当前没有活动任务');
    return;
  }
  submitting.value = true;
  try {
    await crawlerStore.submitXPath(currentTask.value.id, xpathInput.value);
    message.success('内容提取成功');
  } catch {
    message.error('提取失败，请检查 XPath 是否正确');
  } finally {
    submitting.value = false;
  }
}

async function confirmContent(confirmed: boolean) {
  if (!currentTask.value) {
    message.error('当前没有活动任务');
    return;
  }
  try {
    const response = await crawlerStore.confirmContent(currentTask.value.id, confirmed);
    if (confirmed && response.data?.draftId) {
      draftId.value = response.data.draftId;
      message.success('草稿已保存');
    } else if (!confirmed) {
      // 用户取消，显示相应消息
      if (currentTask.value.useXPath) {
        message.info('请重新输入 XPath');
      } else {
        message.info('已取消，您可以重新创建爬取任务');
      }
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
    xpathInput.value = '';
  } catch {
    message.error('取消任务失败');
  }
}

function handleDeleteSession(domain: string) {
  crawlerStore.deleteSession(domain);
}

async function handleCloseBrowser() {
  if (!completedXPathTask.value) {
    message.error('没有找到需要关闭浏览器的任务');
    return;
  }
  try {
    await crawlerStore.closeBrowser(completedXPathTask.value.id);
  } catch {
    message.error('关闭浏览器失败');
  }
}

function getStatusTagType(status: string): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' {
  const types: Record<string, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
    pending: 'info',
    running: 'warning',
    waiting_auth: 'warning',
    waiting_xpath: 'info',
    ready_crawl: 'primary',
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
    waiting_auth: '等待登录',
    waiting_xpath: '等待输入 XPath',
    ready_crawl: '准备爬取',
    waiting_confirm: '等待确认',
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

/* 浏览器控制面板样式 */
.browser-control-card {
  border: 2px solid #409eff;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}

.browser-control-card :deep(.n-card__header) {
  color: #409eff;
  font-weight: 600;
}
</style>
