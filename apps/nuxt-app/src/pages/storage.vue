<template>
  <div class="storage-view">
    <n-card>
      <template #header>
        <div class="header">
          <span>文件索引</span>
          <n-button type="primary" @click="showIndexModal = true">
            <template #icon>
              <n-icon :component="FolderOpenOutline" />
            </template>
            索引文件
          </n-button>
        </div>
      </template>

      <n-data-table
        :columns="columns"
        :data="files"
        :loading="loading"
        :row-key="(row: any) => row.id"
      />
    </n-card>

    <!-- 索引文件对话框 -->
    <n-modal
      v-model:show="showIndexModal"
      preset="card"
      title="索引文件"
      :style="{ width: '500px' }"
      :bordered="false"
    >
      <n-form :model="indexForm" label-placement="left" label-width="100px">
        <n-form-item label="文件路径">
          <n-input
            v-model:value="indexForm.path"
            placeholder="/path/to/directory"
          />
        </n-form-item>
        <n-form-item label="递归索引">
          <n-switch v-model:value="indexForm.recursive" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showIndexModal = false">取消</n-button>
          <n-button type="primary" @click="handleIndex">
            开始索引
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { storageApi } from '@/api';
import { message } from '@/utils/message';
import type { DataTableColumns } from 'naive-ui';
import { FolderOpenOutline } from '@vicons/ionicons5';

const files = ref<any[]>([]);
const loading = ref(false);
const showIndexModal = ref(false);

const indexForm = ref({
  path: '',
  recursive: true,
});

// 表格列配置
const columns = computed<DataTableColumns<any>>(() => [
  {
    title: '文件名',
    key: 'name',
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
  },
  {
    title: '大小',
    key: 'size',
    width: 100,
    render: (row) => formatSize(row.size),
  },
  {
    title: '修改时间',
    key: 'modifiedAt',
    width: 180,
    render: (row) => formatDate(row.modifiedAt),
  },
]);

async function loadFiles() {
  loading.value = true;
  try {
    const response = await storageApi.getFiles();
    if (response.success && response.data) {
      files.value = response.data;
    }
  } finally {
    loading.value = false;
  }
}

async function handleIndex() {
  if (!indexForm.value.path) {
    message.warning('请输入文件路径');
    return;
  }

  try {
    const response = await storageApi.indexPath(indexForm.value);
    if (response.success) {
      message.success(`已索引 ${response.data?.indexed || 0} 个文件`);
      showIndexModal.value = false;
      loadFiles();
    }
  } catch {
    message.error('索引失败');
  }
}

function formatSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

onMounted(() => {
  loadFiles();
});
</script>

<style scoped>
.storage-view {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
