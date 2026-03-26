<template>
  <div class="search">
      <n-space vertical size="large">
        <n-h1>Search Knowledge Base</n-h1>

      <n-card>
        <n-space vertical>
          <n-input
            v-model:value="searchQuery"
            type="text"
            placeholder="Enter your search query..."
            size="large"
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <n-icon :component="SearchIcon" />
            </template>
          </n-input>

          <n-space>
            <n-slider
              v-model:value="topK"
              :min="1"
              :max="10"
              :step="1"
              style="width: 200px"
            />
            <n-text>Top {{ topK }} Results</n-text>
          </n-space>

          <n-button type="primary" size="large" @click="handleSearch" :loading="searching">
            Search
          </n-button>
        </n-space>
      </n-card>

      <n-card v-if="searchResults.length > 0" title="Search Results">
        <n-space vertical size="large">
          <n-card
            v-for="(result, index) in searchResults"
            :key="result.chunkId"
            size="small"
            :title="`${index + 1}. ${result.metadata.title}`"
          >
            <template #header-extra>
              <n-tag :type="result.method === 'hybrid' ? 'success' : 'info'">
                {{ result.method }}
              </n-tag>
              <n-tag type="default">Score: {{ result.combinedScore.toFixed(3) }}</n-tag>
            </template>

            <n-p>{{ result.content }}</n-p>

            <n-space size="small">
              <n-tag v-for="tag in result.metadata.tags" :key="tag" size="small">
                {{ tag }}
              </n-tag>
            </n-space>
          </n-card>
        </n-space>
      </n-card>

        <n-empty v-else-if="searched && searchResults.length === 0" description="No results found" />
      </n-space>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { SearchOutline as SearchIcon } from '@vicons/ionicons5';
import type { HybridSearchResult } from '../../../shared/types';

const searchQuery = ref('');
const topK = ref(3);
const searching = ref(false);
const searched = ref(false);
const searchResults = ref<HybridSearchResult[]>([]);
const message = useMessage();

const handleSearch = async () => {
  if (!searchQuery.value.trim()) return;

  searching.value = true;
  searched.value = true;

  try {
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: searchQuery.value,
        topK: topK.value,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    searchResults.value = data.results || [];

    // Show success message with result count
    if (searchResults.value.length > 0) {
      message.success(`Found ${searchResults.value.length} results`);
    } else {
      message.info('No results found for your query');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    message.error(`Search failed: ${errorMessage}`);
    console.error('Search failed:', error);
    searchResults.value = [];
  } finally {
    searching.value = false;
  }
};
</script>

<style scoped>
.search {
  max-width: 900px;
  margin: 0 auto;
}
</style>
