<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-layout has-sider class="app-container">
        <n-layout-sider
          bordered
          :width="240"
          :collapsed-width="0"
          :collapsed="false"
          show-trigger="arrow-circle"
          class="sidebar"
        >
          <div class="logo">
            <n-icon :component="DocumentTextOutline" />
            <span>Local RAG</span>
          </div>
          <n-menu
            :value="activeMenu"
            :options="menuOptions"
            @update:value="handleMenuSelect"
          />
        </n-layout-sider>

        <n-layout>
          <n-layout-header bordered class="header">
            <h2>{{ pageTitle }}</h2>
            <div class="header-actions">
              <n-tag
                v-if="apiStatus.connected"
                type="success"
                size="small"
                :bordered="false"
              >
                API 已连接
              </n-tag>
              <n-tag
                v-else
                type="error"
                size="small"
                :bordered="false"
              >
                API 未连接
              </n-tag>
            </div>
          </n-layout-header>

          <n-layout-content class="main-content">
            <router-view />
          </n-layout-content>
        </n-layout>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NIcon } from 'naive-ui';
import {
  HomeOutline,
  DocumentTextOutline,
  SettingsOutline,
  FolderOpenOutline,
  CloudDownloadOutline,
  GridOutline,
} from '@vicons/ionicons5';
import axios from 'axios';

const router = useRouter();
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

// 主题覆盖配置（使用亮色主题）
const themeOverrides = {
  common: {
    primaryColor: '#18a058',
    primaryColorHover: '#36ad6a',
    primaryColorPressed: '#0c7a46',
  },
};

// 渲染图标的辅助函数
const renderIcon = (icon: any) => {
  return () => h(NIcon, null, { default: () => h(icon) });
};

// 菜单配置
const menuOptions = computed(() => [
  {
    label: '首页',
    key: '/',
    icon: renderIcon(HomeOutline),
  },
  {
    label: '笔记',
    key: '/notes',
    icon: renderIcon(DocumentTextOutline),
  },
  {
    label: '知识库',
    key: '/knowledge',
    icon: renderIcon(GridOutline),
  },
  {
    label: '爬虫',
    key: '/crawler',
    icon: renderIcon(CloudDownloadOutline),
  },
  {
    label: '文件存储',
    key: '/storage',
    icon: renderIcon(FolderOpenOutline),
  },
  {
    label: '设置',
    key: '/settings',
    icon: renderIcon(SettingsOutline),
  },
]);

// 处理菜单选择
const handleMenuSelect = (key: string) => {
  router.push(key);
};

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
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px;
  font-size: 18px;
  font-weight: bold;
  color: #18a058;
}

.logo .n-icon {
  font-size: 24px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 60px;
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
}
</style>
