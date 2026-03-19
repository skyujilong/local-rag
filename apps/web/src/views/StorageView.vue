<template>
  <div class="storage-view">
    <el-card>
      <template #header>
        <div class="header">
          <span>文件索引</span>
          <el-button type="primary" @click="showIndexDialog = true">
            <el-icon><FolderOpened /></el-icon>
            索引文件
          </el-button>
        </div>
      </template>

      <el-table :data="files" v-loading="loading">
        <el-table-column prop="name" label="文件名" />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column prop="size" label="大小" width="100">
          <template #default="{ row }">
            {{ formatSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column prop="modifiedAt" label="修改时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.modifiedAt) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showIndexDialog" title="索引文件" width="500px">
      <el-form :model="indexForm" label-width="100px">
        <el-form-item label="文件路径">
          <el-input
            v-model="indexForm.path"
            placeholder="/path/to/directory"
          />
        </el-form-item>
        <el-form-item label="递归索引">
          <el-switch v-model="indexForm.recursive" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showIndexDialog = false">取消</el-button>
        <el-button type="primary" @click="handleIndex">
          开始索引
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { storageApi } from '@/api/storage';
import { ElMessage } from 'element-plus';

const files = ref<any[]>([]);
const loading = ref(false);
const showIndexDialog = ref(false);

const indexForm = ref({
  path: '',
  recursive: true,
});

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
    ElMessage.warning('请输入文件路径');
    return;
  }

  try {
    const response = await storageApi.indexPath(indexForm.value);
    if (response.success) {
      ElMessage.success(`已索引 ${response.data?.indexed || 0} 个文件`);
      showIndexDialog.value = false;
      loadFiles();
    }
  } catch (error) {
    ElMessage.error('索引失败');
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
