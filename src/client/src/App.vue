<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-layout has-sider style="height: 100vh">
      <n-layout-sider
        bordered
        collapse-mode="width"
        :collapsed-width="64"
        :width="240"
        :collapsed="collapsed"
        show-trigger
        @collapse="collapsed = true"
        @expand="collapsed = false"
      >
        <div class="logo">
          <h2 v-if="!collapsed">devrag-cli</h2>
          <h2 v-else>DR</h2>
        </div>
        <n-menu
          :collapsed="collapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
          :value="activeKey"
          @update:value="handleMenuSelect"
        />
      </n-layout-sider>
      <n-layout>
        <n-layout-header bordered style="height: 60px; padding: 0 24px; display: flex; align-items: center">
          <n-space>
            <n-tag type="success" v-if="status.ollamaConnected">Ollama Connected</n-tag>
            <n-tag type="error" v-else>Ollama Disconnected</n-tag>
            <n-tag>{{ status.documentCount }} Documents</n-tag>
            <n-tag>{{ status.vectorCount }} Vectors</n-tag>
          </n-space>
        </n-layout-header>
        <n-layout-content content-style="padding: 24px;">
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-layout>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, h, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  NConfigProvider,
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NTag,
  NSpace,
  darkTheme,
  type MenuOption,
} from 'naive-ui';
import {
  DashboardOutline as DashboardIcon,
  DocumentOutline as DocumentIcon,
  SearchOutline as SearchIcon,
} from '@vicons/ionicons5';

const router = useRouter();
const route = useRoute();
const collapsed = ref(false);
const activeKey = ref('dashboard');
const status = ref({
  ollamaConnected: false,
  documentCount: 0,
  vectorCount: 0,
});

const menuOptions: MenuOption[] = [
  {
    label: 'Dashboard',
    key: 'dashboard',
    icon: () => h(DashboardIcon),
  },
  {
    label: 'Documents',
    key: 'documents',
    icon: () => h(DocumentIcon),
  },
  {
    label: 'Search',
    key: 'search',
    icon: () => h(SearchIcon),
  },
];

const themeOverrides = {
  common: {
    primaryColor: '#58a6ff',
    primaryColorHover: '#79c0ff',
    primaryColorPressed: '#1f6feb',
  },
};

const handleMenuSelect = (key: string) => {
  activeKey.value = key;
  router.push(`/${key}`);
};

const fetchStatus = async () => {
  try {
    const response = await fetch('/api/status');
    const data = await response.json();
    status.value = {
      ollamaConnected: data.ollamaConnected,
      documentCount: data.documentCount,
      vectorCount: data.vectorCount,
    };
  } catch (error) {
    console.error('Failed to fetch status:', error);
  }
};

onMounted(() => {
  activeKey.value = route.path.slice(1) || 'dashboard';
  fetchStatus();
  setInterval(fetchStatus, 5000);
});
</script>

<style scoped>
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid #30363d;
}

.logo h2 {
  margin: 0;
  color: #58a6ff;
  font-size: 20px;
  font-weight: 600;
}
</style>
