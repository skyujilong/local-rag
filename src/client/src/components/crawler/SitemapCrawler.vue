<template>
  <n-space vertical size="large">
    <!-- Sitemap URL 输入 -->
    <n-card title="站点地图" :bordered="false">
      <n-form-item label="Sitemap URL">
        <n-input-group>
          <n-input
            v-model:value="sitemapUrl"
            placeholder="https://example.com/sitemap.xml"
          />
          <n-button
            type="primary"
            :loading="isParsing"
            :disabled="!sitemapUrl"
            @click="handleParse"
          >
            解析
          </n-button>
        </n-input-group>
      </n-form-item>
    </n-card>

    <!-- 认证配置 -->
    <AuthConfigCollapse v-model:auth-profile-id="authProfileId" />

    <!-- URL 列表 -->
    <n-card v-if="urls.length > 0" title="发现 URL" :bordered="false">
      <n-space vertical size="medium">
        <n-space justify="space-between">
          <n-text>共 {{ urls.length }} 个 URL</n-text>
          <n-space>
            <n-button size="small" @click="selectAll">全选</n-button>
            <n-button size="small" @click="selectNone">取消全选</n-button>
            <n-button size="small" @click="selectHighQuality">仅选择高质量</n-button>
          </n-space>
        </n-space>

        <n-scrollbar style="max-height: 300px">
          <n-list bordered>
            <n-list-item v-for="url in urls" :key="url">
              <n-space align="center" justify="space-between" style="width: 100%">
                <n-checkbox :checked="selectedUrls.has(url)" @update:checked="toggleUrl(url)">
                  <n-text style="max-width: 500px" :truncate="{ tooltip: true }">
                    {{ url }}
                  </n-text>
                </n-checkbox>
                <n-tag v-if="importedUrls.has(url)" type="info" size="small">
                  已导入
                </n-tag>
              </n-space>
            </n-list-item>
          </n-list>
        </n-scrollbar>

        <n-space justify="end">
          <n-button type="primary" :disabled="selectedUrls.size === 0" @click="handleStart">
            开始爬取 ({{ selectedUrls.size }})
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <!-- 爬取进度 -->
    <CrawlProgress
      v-if="taskId"
      :task-id="taskId"
      @completed="handleCompleted"
    />
  </n-space>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  NSpace,
  NCard,
  NFormItem,
  NInput,
  NInputGroup,
  NButton,
  NList,
  NListItem,
  NCheckbox,
  NTag,
  NText,
  NScrollbar,
  useMessage,
} from 'naive-ui';
import AuthConfigCollapse from './AuthConfigCollapse.vue';
import CrawlProgress from './CrawlProgress.vue';
import { useCrawlApi } from '../composables/useCrawlApi';

const message = useMessage();
const crawlApi = useCrawlApi();

const sitemapUrl = ref('');
const authProfileId = ref('');
const urls = ref<string[]>([]);
const importedUrls = ref<Set<string>>(new Set());
const selectedUrls = ref<Set<string>>(new Set());

const isParsing = ref(false);
const taskId = ref('');

const handleParse = async () => {
  isParsing.value = true;

  try {
    const response = await crawlApi.parseSitemap({
      sitemapUrl: sitemapUrl.value,
      authProfileId: authProfileId.value || undefined,
    });

    urls.value = response.urls;
    selectedUrls.value = new Set(response.urls);
    message.success(`解析成功，发现 ${response.total} 个 URL`);
  } catch (err: any) {
    message.error(err.message || '解析失败');
  } finally {
    isParsing.value = false;
  }
};

const toggleUrl = (url: string) => {
  if (selectedUrls.value.has(url)) {
    selectedUrls.value.delete(url);
  } else {
    selectedUrls.value.add(url);
  }
};

const selectAll = () => {
  selectedUrls.value = new Set(urls.value);
};

const selectNone = () => {
  selectedUrls.value.clear();
};

const selectHighQuality = () => {
  // TODO: 实现质量评分过滤
  selectAll();
};

const handleStart = async () => {
  try {
    const response = await crawlApi.startSitemapTask({
      sitemapUrl: sitemapUrl.value,
      urls: Array.from(selectedUrls.value),
      authProfileId: authProfileId.value || undefined,
    });

    taskId.value = response.taskId;
    message.success('爬取任务已启动');
  } catch (err: any) {
    message.error(err.message || '启动失败');
  }
};

const handleCompleted = () => {
  message.info('爬取完成，进入导入确认');
};
</script>
