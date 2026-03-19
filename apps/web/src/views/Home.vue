<template>
  <div class="home-view">
    <n-grid :cols="4" :x-gap="20">
      <n-grid-item>
        <n-card class="stat-card">
          <n-statistic label="笔记数量" :value="stats.notes" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card class="stat-card">
          <n-statistic label="文档数量" :value="stats.documents" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card class="stat-card">
          <n-statistic label="已索引文件" :value="stats.files" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card class="stat-card">
          <n-statistic label="活跃任务" :value="stats.tasks" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-grid :cols="2" :x-gap="20" style="margin-top: 20px;">
      <n-grid-item>
        <n-card title="快速操作">
          <div class="quick-actions">
            <n-button type="primary" block @click="$router.push('/notes')">
              <template #icon>
                <n-icon :component="PencilOutline" />
              </template>
              新建笔记
            </n-button>
            <n-button type="success" block @click="$router.push('/crawler')">
              <template #icon>
                <n-icon :component="CloudDownloadOutline" />
              </template>
              启动爬虫
            </n-button>
            <n-button type="warning" block @click="$router.push('/storage')">
              <template #icon>
                <n-icon :component="FolderOpenOutline" />
              </template>
              索引文件
            </n-button>
          </div>
        </n-card>
      </n-grid-item>

      <n-grid-item>
        <n-card title="最近活动">
          <n-timeline>
            <n-timeline-item
              v-for="activity in recentActivities"
              :key="activity.id"
              :time="activity.timestamp"
            >
              {{ activity.content }}
            </n-timeline-item>
          </n-timeline>
        </n-card>
      </n-grid-item>
    </n-grid>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { notesApi } from '@/api/notes';
import { knowledgeApi } from '@/api/knowledge';
import { crawlerApi } from '@/api/crawler';
// import { storageApi } from '@/api/storage';
import { PencilOutline, CloudDownloadOutline, FolderOpenOutline } from '@vicons/ionicons5';

const stats = ref({
  notes: 0,
  documents: 0,
  files: 0,
  tasks: 0,
});

const recentActivities = ref<Array<{
  id: string;
  content: string;
  timestamp: string;
}>>([]);

async function loadStats() {
  try {
    const [notesRes, docsRes, tasksRes] = await Promise.all([
      notesApi.list({ page: 1, pageSize: 1 }),
      knowledgeApi.list({ page: 1, pageSize: 1 }),
      crawlerApi.getTasks(),
    ]);

    if (notesRes.success && notesRes.data) {
      stats.value.notes = notesRes.data.total;
    }
    if (docsRes.success && docsRes.data) {
      stats.value.documents = docsRes.data.total;
    }
    if (tasksRes.success && tasksRes.data) {
      stats.value.tasks = tasksRes.data.filter(t => t.status === 'running').length;
    }
  } catch (error) {
    console.error('加载统计数据失败:', error);
  }
}

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.home-view {
  max-width: 1200px;
  margin: 0 auto;
}

.stat-card {
  text-align: center;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-actions .n-button {
  justify-content: flex-start;
}
</style>
