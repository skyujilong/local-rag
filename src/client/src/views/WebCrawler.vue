<template>
  <n-space vertical size="large" class="web-crawler">
    <!-- 页面标题 -->
    <n-space align="center" justify="space-between">
      <n-h1>Web Crawler</n-h1>
      <n-space>
        <n-button @click="$router.push('/crawler/history')">
          <template #icon>
            <n-icon><HistoryIcon /></n-icon>
          </template>
          爬取历史
        </n-button>
      </n-space>
    </n-space>

    <!-- Tab 切换 -->
    <n-tabs
      v-model:value="activeTab"
      type="line"
      animated
    >
      <!-- 单页面爬取 -->
      <n-tab-pane name="single" tab="单页面爬取">
        <SinglePageCrawler />
      </n-tab-pane>

      <!-- 站点地图爬取 -->
      <n-tab-pane name="sitemap" tab="站点地图">
        <SitemapCrawler />
      </n-tab-pane>

      <!-- 递归爬取 -->
      <n-tab-pane name="recursive" tab="递归爬取">
        <RecursiveCrawler />
      </n-tab-pane>
    </n-tabs>
  </n-space>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  NButton,
  NH1,
  NSpace,
  NTabs,
  NTabPane,
  NIcon,
} from 'naive-ui';
import { TimeOutline as HistoryIcon } from '@vicons/ionicons5';
import SinglePageCrawler from '../components/crawler/SinglePageCrawler.vue';
import SitemapCrawler from '../components/crawler/SitemapCrawler.vue';
import RecursiveCrawler from '../components/crawler/RecursiveCrawler.vue';

const activeTab = ref('single');
</script>

<style scoped>
.web-crawler {
  padding: 24px;
}
</style>
