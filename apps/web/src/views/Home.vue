<template>
  <div class="home-view">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="stat-card">
          <el-statistic title="笔记数量" :value="stats.notes" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <el-statistic title="文档数量" :value="stats.documents" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <el-statistic title="已索引文件" :value="stats.files" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <el-statistic title="活跃任务" :value="stats.tasks" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-top: 20px;">
      <el-col :span="12">
        <el-card header="快速操作">
          <div class="quick-actions">
            <el-button type="primary" @click="$router.push('/notes')">
              <el-icon><Edit /></el-icon>
              新建笔记
            </el-button>
            <el-button type="success" @click="$router.push('/crawler')">
              <el-icon><Connection /></el-icon>
              启动爬虫
            </el-button>
            <el-button type="warning" @click="$router.push('/storage')">
              <el-icon><FolderOpened /></el-icon>
              索引文件
            </el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card header="最近活动">
          <el-timeline>
            <el-timeline-item
              v-for="activity in recentActivities"
              :key="activity.id"
              :timestamp="activity.timestamp"
            >
              {{ activity.content }}
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { notesApi } from '@/api/notes';
import { knowledgeApi } from '@/api/knowledge';
import { crawlerApi } from '@/api/crawler';
import { storageApi } from '@/api/storage';

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

.quick-actions .el-button {
  width: 100%;
  justify-content: flex-start;
}
</style>
