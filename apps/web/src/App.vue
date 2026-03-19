<template>
  <el-container class="app-container">
    <el-aside width="240px" class="sidebar">
      <div class="logo">
        <el-icon><Document /></el-icon>
        <span>Local RAG</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        router
        class="nav-menu"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>
        <el-menu-item index="/notes">
          <el-icon><Edit /></el-icon>
          <span>笔记</span>
        </el-menu-item>
        <el-menu-item index="/knowledge">
          <el-icon><Collection /></el-icon>
          <span>知识库</span>
        </el-menu-item>
        <el-menu-item index="/crawler">
          <el-icon><Connection /></el-icon>
          <span>爬虫</span>
        </el-menu-item>
        <el-menu-item index="/storage">
          <el-icon><FolderOpened /></el-icon>
          <span>文件存储</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <h2>{{ pageTitle }}</h2>
        <div class="header-actions">
          <el-tag v-if="apiStatus.connected" type="success" size="small">
            API 已连接
          </el-tag>
          <el-tag v-else type="danger" size="small">
            API 未连接
          </el-tag>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const apiStatus = ref({
  connected: false,
});

const activeMenu = computed(() => route.path);

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '首页',
    '/notes': '笔记管理',
    '/knowledge': '知识库',
    '/crawler': '网页爬虫',
    '/storage': '文件存储',
    '/settings': '设置',
  };
  return titles[route.path] || 'Local RAG';
});

// 检查 API 连接状态
const checkApiStatus = async () => {
  try {
    await axios.get('/health');
    apiStatus.value.connected = true;
  } catch {
    apiStatus.value.connected = false;
  }
};

onMounted(() => {
  checkApiStatus();
  setInterval(checkApiStatus, 30000);
});
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.sidebar {
  background-color: #f5f7fa;
  border-right: 1px solid #dcdfe6;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px;
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}

.nav-menu {
  border-right: none;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #dcdfe6;
  background-color: #fff;
}

.header h2 {
  margin: 0;
  font-size: 18px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.main-content {
  background-color: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}
</style>
