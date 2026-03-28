<template>
  <div class="search">
    <n-space vertical size="large">
      <!-- 搜索栏 -->
      <n-card>
        <n-space vertical :size="16">
          <n-h1>语义搜索</n-h1>

          <n-input
            v-model:value="query"
            size="large"
            placeholder="输入搜索内容..."
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <n-icon><SearchIcon /></n-icon>
            </template>
            <template #suffix>
              <n-button type="primary" @click="handleSearch" :loading="searching">
                搜索
              </n-button>
            </template>
          </n-input>

          <n-space align="center">
            <span style="font-weight: 500">标签筛选:</span>
            <n-select
              v-model:value="selectedTags"
              multiple
              placeholder="选择标签（可选）"
              :options="tagOptions"
              style="width: 400px"
            />
          </n-space>
        </n-space>
      </n-card>

      <!-- 搜索结果 -->
      <n-spin :show="searching">
        <n-space v-if="searchResults.length > 0" vertical :size="16">
          <!-- 搜索信息 -->
          <n-text depth="3">
            找到 {{ searchResults.length }} 个结果，耗时 {{ searchTime }}ms，
            策略: {{ strategyText }}
          </n-text>

          <!-- 结果列表 -->
          <n-card
            v-for="result in searchResults"
            :key="result.documentId"
            hoverable
            @click="openDocument(result.documentId)"
            class="result-card"
          >
            <n-space vertical :size="12">
              <!-- 标题和分数 -->
              <n-space justify="space-between" align="start">
                <n-text strong style="font-size: 18px">
                  {{ result.document.title }}
                </n-text>

                <n-tag type="info" size="small">
                  相似度: {{ (result.aggregatedScore * 100).toFixed(1) }}%
                </n-tag>
              </n-space>

              <!-- 标签 -->
              <n-space v-if="result.document.tags.length > 0" size="small">
                <n-tag
                  v-for="tag in result.document.tags"
                  :key="tag"
                  size="small"
                  type="info"
                >
                  {{ tag }}
                </n-tag>
              </n-space>

              <!-- 高亮片段 -->
              <n-space vertical :size="8">
                <n-text depth="3" style="font-weight: 500">
                  匹配的段落:
                </n-text>
                <n-card
                  v-for="(chunk, _index) in result.matchedChunks.slice(0, 3)"
                  :key="chunk.chunkId"
                  size="small"
                  :bordered="false"
                  style="background: #f5f5f5"
                >
                  <n-text style="font-size: 14px; line-height: 1.6">
                    {{ chunk.highlight }}
                  </n-text>
                </n-card>
              </n-space>
            </n-space>
          </n-card>
        </n-space>

        <!-- 空状态 -->
        <n-empty
          v-else-if="!searching && hasSearched"
          description="没有找到匹配的结果"
          style="margin-top: 100px"
        >
          <template #extra>
            <n-space vertical>
              <n-text depth="3">尝试:</n-text>
              <n-ul>
                <n-li>使用不同的关键词</n-li>
                <n-li>减少标签筛选条件</n-li>
                <n-li>使用更通用的描述</n-li>
              </n-ul>
            </n-space>
          </template>
        </n-empty>

        <!-- 初始状态 -->
        <n-empty
          v-else
          description="输入关键词开始搜索"
          style="margin-top: 100px"
        />
      </n-spin>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  NSpace,
  NCard,
  NH1,
  NInput,
  NButton,
  NIcon,
  NSelect,
  NTag,
  NText,
  NSpin,
  NEmpty,
  NUl,
  NLi,
  useMessage,
} from 'naive-ui';
import { Search } from '@vicons/ionicons5';
import type { SearchResult } from '../../../../../shared/types/documents';

const router = useRouter();
const message = useMessage();

// 图标组件
const SearchIcon = Search;

// 状态
const query = ref('');
const selectedTags = ref<string[]>([]);
const searching = ref(false);
const hasSearched = ref(false);

// 搜索结果
const searchResults = ref<SearchResult[]>([]);
const searchTime = ref(0);
const searchStrategy = ref<'filtered' | 'hybrid' | 'full'>('full');

// 标签选项
const tagOptions = ref<Array<{ label: string; value: string }>>([]);

/**
 * 策略文本
 */
const strategyText = computed(() => {
  switch (searchStrategy.value) {
    case 'filtered':
      return '标签过滤（快速）';
    case 'hybrid':
      return '混合查询（降级）';
    case 'full':
      return '全量搜索';
    default:
      return '未知';
  }
});

/**
 * 初始化
 */
onMounted(() => {
  loadTags();
});

/**
 * 加载标签列表
 */
const loadTags = async () => {
  try {
    const response = await fetch('/api/documents/tags');
    const data = await response.json();

    if (data.success && data.data) {
      tagOptions.value = data.data.tags.map((tag: any) => ({
        label: tag.name,
        value: tag.name,
      }));
    }
  } catch (error) {
    console.error('加载标签失败:', error);
  }
};

/**
 * 执行搜索
 */
const handleSearch = async () => {
  if (!query.value.trim()) {
    message.warning('请输入搜索内容');
    return;
  }

  searching.value = true;
  hasSearched.value = true;
  searchResults.value = [];

  try {
    const startTime = Date.now();

    const response = await fetch('/api/documents/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.value,
        tags: selectedTags.value.length > 0 ? selectedTags.value : undefined,
        limit: 10,
      }),
    });

    const data = await response.json();

    searchTime.value = Date.now() - startTime;

    if (data.success && data.data) {
      searchResults.value = data.data.results;
      searchStrategy.value = data.strategy;

      message.success(`找到 ${data.data.total} 个结果`);
    } else {
      message.error(data.error || '搜索失败');
    }
  } catch (error) {
    console.error('搜索失败:', error);
    message.error('搜索失败');
  } finally {
    searching.value = false;
  }
};

/**
 * 打开文档
 */
const openDocument = (documentId: string) => {
  router.push(`/documents/${documentId}`);
};
</script>

<style scoped>
.search {
  max-width: 1200px;
  margin: 0 auto;
}

.result-card {
  cursor: pointer;
  transition: box-shadow 0.3s;
}

.result-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
