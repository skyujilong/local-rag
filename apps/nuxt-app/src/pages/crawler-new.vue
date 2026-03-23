<template>
  <div class="crawler-view">
    <n-grid :cols="16" :x-gap="20">
      <n-grid-item :span="10">
        <!-- 创建任务表单 -->
        <n-card title="爬虫任务">
          <n-form :model="crawlerForm" label-placement="left" label-width="140px">
            <n-form-item label="目标 URL">
              <n-input
                v-model:value="crawlerForm.url"
                placeholder="https://example.com"
                :disabled="!!currentTask"
              />
            </n-form-item>
            <n-form-item>
              <n-button
                type="primary"
                @click="startCrawler"
                :loading="crawlerStore.loading"
                :disabled="!!currentTask"
              >
                <template #icon>
                  <n-icon :component="PlayOutline" />
                </template>
                打开浏览器
              </n-button>
              <n-button
                v-if="currentTask"
                style="margin-left: 12px"
                @click="cancelTask"
              >
                取消任务
              </n-button>
            </n-form-item>
          </n-form>

          <!-- 浏览器状态提示 -->
          <n-alert
            v-if="currentTask?.status === 'browser_ready'"
            type="info"
            style="margin-top: 16px"
          >
            <template #header>
              浏览器已打开
            </template>
            请在浏览器中完成所需操作（登录、导航等），然后选择下方操作：
          </n-alert>
        </n-card>

        <!-- 操作选择面板 -->
        <n-card
          v-if="currentTask?.status === 'browser_ready'"
          title="选择操作"
          style="margin-top: 20px"
        >
          <n-tabs type="line" animated>
            <n-tab-pane name="single" tab="提取当前页">
              <n-form label-placement="left" label-width="140px">
                <n-form-item label="内容 XPath（可选）">
                  <n-input
                    v-model:value="singleMode.xpath"
                    placeholder="//article 或 //div[@class='content']"
                    type="textarea"
                    :rows="3"
                  />
                  <template #feedback>
                    留空则使用智能提取
                  </template>
                </n-form-item>
                <n-form-item>
                  <n-button
                    type="primary"
                    @click="extractCurrentPage"
                    :loading="singleMode.loading"
                  >
                    提取内容
                  </n-button>
                </n-form-item>
              </n-form>
            </n-tab-pane>

            <n-tab-pane name="batch" tab="批量爬取">
              <n-form label-placement="left" label-width="140px">
                <n-form-item label="链接列表 XPath" required>
                  <n-input
                    v-model:value="batchMode.linksXPath"
                    placeholder="//div[@class='post-list']//a"
                    type="textarea"
                    :rows="2"
                  />
                  <template #feedback>
                    指向多个链接的 XPath
                  </template>
                </n-form-item>
                <n-form-item label="内容 XPath（可选）">
                  <n-input
                    v-model:value="batchMode.contentXPath"
                    placeholder="//article"
                    type="textarea"
                    :rows="2"
                  />
                  <template #feedback>
                    每个页面的内容提取 XPath，留空则智能提取
                  </template>
                </n-form-item>
                <n-form-item label="最大链接数">
                  <n-input-number
                    v-model:value="batchMode.maxLinks"
                    :min="1"
                    :max="200"
                    style="width: 200px"
                  />
                </n-form-item>
                <n-form-item>
                  <n-button
                    type="primary"
                    @click="startBatchCrawl"
                    :loading="batchMode.loading"
                    :disabled="!batchMode.linksXPath"
                  >
                    开始批量爬取
                  </n-button>
                </n-form-item>
              </n-form>
            </n-tab-pane>
          </n-tabs>
        </n-card>

        <!-- 内容预览面板 -->
        <n-card
          v-if="currentTask?.previewMarkdown"
          title="内容预览"
          style="margin-top: 20px"
        >
          <n-alert type="success" style="margin-bottom: 16px">
            已提取内容，请确认是否符合预期。确认后将保存为草稿。
          </n-alert>

          <div v-if="currentTask.previewMarkdown" class="markdown-info">
            <n-tag type="info" size="small">
              {{ currentTask.previewMarkdown.length }} 字符
            </n-tag>
          </div>

          <div class="markdown-preview">
            <div v-html="renderedMarkdown" class="markdown-content"></div>
          </div>

          <n-space style="margin-top: 16px">
            <n-button type="primary" @click="confirmContent(true)">
              确认并保存草稿
            </n-button>
            <n-button @click="confirmContent(false)">
              重新提取
            </n-button>
          </n-space>

          <n-alert v-if="draftId" type="info" style="margin-top: 16px">
            草稿已保存，ID: {{ draftId }}
          </n-alert>
        </n-card>

        <!-- 批量爬取进度 -->
        <n-card
          v-if="currentTask?.type === 'batch' && currentTask.status === 'running'"
          title="批量爬取进度"
          style="margin-top: 20px"
        >
          <n-progress
            type="line"
            :percentage="batchProgress"
            :status="progressStatus"
          />
          <div class="progress-details">
            <p>已完成: {{ currentTask.completedLinks || 0 }} / {{ currentTask.totalLinks || 0 }}</p>
          </div>
        </n-card>

        <!-- 批量爬取结果 -->
        <n-card
          v-if="currentTask?.batchResults && currentTask.batchResults.length > 0"
          title="批量爬取结果"
          style="margin-top: 20px"
        >
          <n-list bordered>
            <n-list-item
              v-for="(result, index) in currentTask.batchResults"
              :key="index"
            >
              <template #prefix>
                <n-tag
                  :type="result.status === 'success' ? 'success' : result.status === 'failed' ? 'error' : 'info'"
                  size="small"
                >
                  {{ getResultStatusLabel(result.status) }}
                </n-tag>
              </template>
              <n-thing :title="result.title || result.url">
                <template #description>
                  <a :href="result.url" target="_blank">{{ result.url }}</a>
                </template>
                <template #action>
                  <n-button
                    v-if="result.markdown"
                    text
                    type="primary"
                    @click="previewResult(result)"
                  >
                    预览
                  </n-button>
                </template>
              </n-thing>
            </n-list-item>
          </n-list>
        </n-card>

        <!-- 浏览器控制 -->
        <n-card
          v-if="showBrowserControl"
          title="浏览器控制"
          style="margin-top: 20px"
        >
          <n-alert type="info" style="margin-bottom: 16px">
            浏览器保持打开中，您可以继续使用或手动关闭
          </n-alert>
          <n-space>
            <n-button type="error" @click="handleCloseBrowser">
              关闭浏览器
            </n-button>
          </n-space>
        </n-card>

        <!-- 任务列表 -->
        <n-card title="任务列表" style="margin-top: 20px">
          <n-data-table
            :columns="taskColumns"
            :data="crawlerStore.tasks"
            :row-key="(row: any) => row.id"
          />
        </n-card>
      </n-grid-item>

      <n-grid-item :span="6">
        <!-- 会话列表 -->
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

    <!-- 预览弹窗 -->
    <n-modal
      v-model:show="previewModal.show"
      preset="card"
      title="内容预览"
      style="width: 80%; max-width: 1200px"
    >
      <div v-if="previewModal.content" class="markdown-preview">
        <div v-html="previewModal.renderedContent" class="markdown-content"></div>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, h, computed, onMounted, onUnmounted } from 'vue';
import { NButton, NTag, NIcon, type DataTableColumns } from 'naive-ui';
import { PlayOutline, GlobeOutline } from '@vicons/ionicons5';
import MarkdownIt from 'markdown-it';
import { message } from '@/utils/message';
import type { CrawlerTask, BatchCrawlResult } from '@local-rag/shared/types';
import { useCrawlerStore } from '@/stores/crawler';

const md = new MarkdownIt();
const crawlerStore = useCrawlerStore();

const crawlerForm = ref({
  url: '',
});

const singleMode = ref({
  xpath: '',
  loading: false,
});

const batchMode = ref({
  linksXPath: '',
  contentXPath: '',
  maxLinks: 100,
  loading: false,
});

const draftId = ref('');

const previewModal = ref({
  show: false,
  content: '',
  renderedContent: '',
});

const currentTask = computed(() => {
  return crawlerStore.tasks.find((t: CrawlerTask) =>
    t.status === 'running' ||
    t.status === 'browser_ready' ||
    t.status === 'waiting_confirm'
  );
});

const renderedMarkdown = computed(() => {
  const previewMarkdown = currentTask.value?.previewMarkdown;
  if (!previewMarkdown) {
    return '';
  }
  return md.render(previewMarkdown);
});

const batchProgress = computed(() => {
  if (!currentTask.value || currentTask.value.type !== 'batch') {
    return 0;
  }
  const total = currentTask.value.totalLinks || 0;
  const completed = currentTask.value.completedLinks || 0;
  return total > 0 ? Math.round((completed / total) * 100) : 0;
});

const progressStatus = computed(() => {
  const status = currentTask.value?.status;
  if (status === 'running') return 'info';
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'error';
  return 'default';
});

const showBrowserControl = computed(() => {
  return currentTask.value?.status === 'browser_ready' ||
         currentTask.value?.status === 'running';
});

async function startCrawler() {
  if (!crawlerForm.value.url) {
    message.error('请输入 URL');
    return;
  }

  try {
    await crawlerStore.startCrawler({
      url: crawlerForm.value.url,
      waitForAuth: false,
      useXPath: false,
    });
    message.success('浏览器已打开');
  } catch (error) {
    message.error('启动失败');
  }
}

async function extractCurrentPage() {
  if (!currentTask.value) {
    message.error('当前没有活动任务');
    return;
  }

  singleMode.value.loading = true;
  try {
    await crawlerStore.submitXPath(
      currentTask.value.id,
      singleMode.value.xpath || ''
    );
    message.success('开始提取内容');
  } catch (error) {
    message.error('提取失败');
  } finally {
    singleMode.value.loading = false;
  }
}

async function startBatchCrawl() {
  if (!currentTask.value) {
    message.error('当前没有活动任务');
    return;
  }

  if (!batchMode.value.linksXPath) {
    message.error('请输入链接列表 XPath');
    return;
  }

  batchMode.value.loading = true;
  try {
    await crawlerStore.batchCrawl({
      taskId: currentTask.value.id,
      linksXPath: batchMode.value.linksXPath,
      contentXPath: batchMode.value.contentXPath || undefined,
      maxLinks: batchMode.value.maxLinks,
    });
    message.success('开始批量爬取');
  } catch (error) {
    message.error('批量爬取失败');
  } finally {
    batchMode.value.loading = false;
  }
}

async function confirmContent(confirmed: boolean) {
  if (!currentTask.value) {
    message.error('当前没有活动任务');
    return;
  }

  try {
    const response = await crawlerStore.confirmContent(currentTask.value.id, confirmed);
    if (confirmed && response?.data?.draftId) {
      draftId.value = response.data.draftId;
      message.success('草稿已保存');
    } else if (!confirmed) {
      message.info('已取消，请重新提取');
    }
  } catch {
    message.error('操作失败');
  }
}

async function cancelTask() {
  if (!currentTask.value) return;
  try {
    await crawlerStore.cancelTask(currentTask.value.id);
    message.success('任务已取消');
    crawlerForm.value.url = '';
  } catch {
    message.error('取消失败');
  }
}

async function handleCloseBrowser() {
  if (!currentTask.value) return;
  try {
    await crawlerStore.closeBrowser(currentTask.value.id);
    message.success('浏览器已关闭');
  } catch {
    message.error('关闭失败');
  }
}

async function handleDeleteSession(domain: string) {
  try {
    await crawlerStore.deleteSession(domain);
    message.success('会话已删除');
  } catch {
    message.error('删除失败');
  }
}

function previewResult(result: BatchCrawlResult) {
  if (!result.markdown) return;
  previewModal.value.content = result.markdown;
  previewModal.value.renderedContent = md.render(result.markdown);
  previewModal.value.show = true;
}

function getResultStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '等待中',
    crawling: '爬取中',
    success: '成功',
    failed: '失败',
  };
  return labels[status] || status;
}

function formatDate(dateValue: string | Date) {
  return new Date(dateValue).toLocaleString('zh-CN');
}

const taskColumns: DataTableColumns<CrawlerTask> = [
  {
    title: 'URL',
    key: 'url',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: '类型',
    key: 'type',
    width: 80,
    render(row) {
      return row.type === 'batch' ? '批量' : '单页';
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 120,
    render(row) {
      return h(NTag, {
        type: row.status === 'completed' ? 'success' : row.status === 'failed' ? 'error' : 'info',
        size: 'small',
      }, { default: () => getStatusLabel(row.status) });
    },
  },
];

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    browser_ready: '浏览器就绪',
    waiting_confirm: '等待确认',
    completed: '已完成',
    failed: '失败',
  };
  return labels[status] || status;
}

onMounted(() => {
  crawlerStore.registerHandlers();
  crawlerStore.connectWebSocket();
  crawlerStore.loadSessions();
});

onUnmounted(() => {
  crawlerStore.unregisterHandlers();
});
</script>

<style scoped>
.crawler-view {
  max-width: 1400px;
  margin: 0 auto;
}

.markdown-info {
  margin-bottom: 12px;
}

.markdown-preview {
  max-height: 600px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  background: #fafafa;
}

.markdown-content {
  line-height: 1.6;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.markdown-content :deep(p) {
  margin-bottom: 1em;
}

.markdown-content :deep(code) {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}

.markdown-content :deep(pre) {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  overflow-x: auto;
}

.sessions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-item {
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.session-time {
  font-size: 12px;
  color: #909399;
}

.progress-details {
  margin-top: 12px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
}
</style>
