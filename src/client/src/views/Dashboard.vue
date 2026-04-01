<template>
  <div class="dashboard">
    <n-h1>Dashboard</n-h1>
    <n-grid :cols="4" :x-gap="16">
      <n-grid-item>
        <n-card title="Total Documents">
          <n-statistic :value="stats.documentCount" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card title="Total Vectors">
          <n-statistic :value="stats.vectorCount" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card title="Memory Usage">
          <n-statistic :value="(stats.memoryUsage.used / 1024 / 1024).toFixed(2)" suffix="MB" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card title="Uptime">
          <n-statistic :value="formatUptime(stats.uptime)" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-divider />

    <n-h2>Quick Actions</n-h2>
    <n-space>
      <n-button type="primary" @click="$router.push('/documents')">Manage Documents</n-button>
      <n-button type="info" @click="$router.push('/search')">Search Knowledge Base</n-button>
      <n-button type="success" @click="$router.push('/crawler')">
        <template #icon>
          <n-icon><GlobeOutline /></n-icon>
        </template>
        Import from Web
      </n-button>
    </n-space>

    <n-divider />

    <n-h2>System Status</n-h2>
    <n-card>
      <n-descriptions bordered :column="2">
        <n-descriptions-item label="Ollama Status">
          <n-tag :type="stats.ollamaConnected ? 'success' : 'error'">
            {{ stats.ollamaConnected ? 'Connected' : 'Disconnected' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="Ollama Model">
          {{ stats.ollamaModel || 'N/A' }}
        </n-descriptions-item>
        <n-descriptions-item label="MCP Connected">
          <n-tag :type="stats.mcpConnected ? 'success' : 'warning'">
            {{ stats.mcpConnected ? 'Yes' : 'No' }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item label="Memory Usage">
          {{ (stats.memoryUsage.used / 1024 / 1024).toFixed(2) }} MB /
          {{ (stats.memoryUsage.total / 1024 / 1024).toFixed(2) }} MB
        </n-descriptions-item>
      </n-descriptions>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NIcon } from 'naive-ui';
import { GlobeOutline } from '@vicons/ionicons5';

const stats = ref({
  documentCount: 0,
  vectorCount: 0,
  uptime: 0,
  memoryUsage: { used: 0, total: 0, percentage: 0 },
  ollamaConnected: false,
  ollamaModel: '',
  mcpConnected: false,
});

const fetchStats = async () => {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    stats.value = data;
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
};

const formatUptime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

onMounted(() => {
  fetchStats();
  setInterval(fetchStats, 10000);
});
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
