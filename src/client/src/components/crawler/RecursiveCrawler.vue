<template>
  <n-space vertical size="large">
    <!-- 起始 URL 输入 -->
    <n-card title="递归爬取" :bordered="false">
      <n-space vertical size="medium">
        <n-form-item label="起始 URL">
          <n-input-group>
            <n-input
              v-model:value="startUrl"
              placeholder="https://example.com/docs/index.html"
            />
          </n-input-group>
        </n-form-item>

        <n-form-item label="递归深度">
          <n-slider
            v-model:value="maxDepth"
            :min="1"
            :max="3"
            :marks="{ 1: '1级', 2: '2级', 3: '3级' }
          />
        </n-form-item>

        <!-- URL 过滤规则 -->
        <n-collapse>
          <n-collapse-item title="URL 过滤规则（可选）" name="filter">
            <n-space vertical>
              <n-form-item label="包含模式">
                <n-dynamic-tags v-model:value="includePatterns" />
              </n-form-item>

              <n-form-item label="排除模式">
                <n-dynamic-tags v-model:value="excludePatterns" />
              </n-form-item>
            </n-space>
          </n-collapse-item>
        </n-collapse>

        <n-space>
          <n-button
            type="primary"
            :loading="isDiscovering"
            :disabled="!startUrl"
            @click="handleDiscover"
          >
            发现链接
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <!-- 认证配置 -->
    <AuthConfigCollapse v-model:auth-profile-id="authProfileId" />

    <!-- 发现的 URL 列表 -->
    <n-card v-if="discoveredUrls.length > 0" title="发现的 URL" :bordered="false">
      <n-space vertical size="medium">
        <n-space justify="space-between">
          <n-text>共 {{ discoveredUrls.length }} 个 URL</n-text>
          <n-space>
            <n-button size="small" @click="selectAll">全选</n-button>
            <n-button size="small" @click="selectNone">取消全选</n-button>
          </n-space>
        </n-space>

        <n-scrollbar style="max-height: 300px">
          <n-list bordered>
            <n-list-item v-for="url in discoveredUrls" :key="url">
              <n-checkbox :checked="selectedUrls.has(url)" @update:checked="toggleUrl(url)">
                <n-text style="max-width: 500px" :truncate="{ tooltip: true }">
                  {{ url }}
                </n-text>
              </n-checkbox>
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
  NSlider,
  NCollapse,
  NCollapseItem,
  NDynamicTags,
  NButton,
  NList,
  NListItem,
  NCheckbox,
  NText,
  NScrollbar,
  useMessage,
} from 'naive-ui';
import AuthConfigCollapse from './AuthConfigCollapse.vue';
import CrawlProgress from './CrawlProgress.vue';
import { useCrawlApi } from '../composables/useCrawlApi';

const message = useMessage();
const crawlApi = useCrawlApi();

const startUrl = ref('');
const authProfileId = ref('');
const maxDepth = ref(2);
const includePatterns = ref<string[]>([]);
const excludePatterns = ref<string[]>([]);

const discoveredUrls = ref<string[]>([]);
const selectedUrls = ref<Set<string>>(new Set());

const isDiscovering = ref(false);
const taskId = ref('');

const handleDiscover = async () => {
  isDiscovering.value = true;

  try {
    const response = await crawlApi.discoverLinks({
      startUrl: startUrl.value,
      maxDepth: maxDepth.value,
      urlFilter: {
        include: includePatterns.value.length > 0 ? includePatterns.value : undefined,
        exclude: excludePatterns.value.length > 0 ? excludePatterns.value : undefined,
      },
      authProfileId: authProfileId.value || undefined,
    });

    discoveredUrls.value = response.urls;
    selectedUrls.value = new Set(response.urls);
    message.success(`发现 ${response.total} 个链接`);
  } catch (err: any) {
    message.error(err.message || '发现链接失败');
  } finally {
    isDiscovering.value = false;
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
  selectedUrls.value = new Set(discoveredUrls.value);
};

const selectNone = () => {
  selectedUrls.value.clear();
};

const handleStart = async () => {
  try {
    const response = await crawlApi.startRecursiveTask({
      startUrl: startUrl.value,
      maxDepth: maxDepth.value,
      urlFilter: {
        include: includePatterns.value.length > 0 ? includePatterns.value : undefined,
        exclude: excludePatterns.value.length > 0 ? excludePatterns.value : undefined,
      },
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
