<template>
  <div class="knowledge-view">
    <el-card>
      <template #header>
        <div class="header">
          <el-input
            v-model="searchInput"
            placeholder="输入关键词，用逗号分隔"
            clearable
            style="width: 400px;"
            @keyup.enter="handleSearch"
          >
            <template #append>
              <el-button @click="handleSearch">
                <el-icon><Search /></el-icon>
              </el-button>
            </template>
          </el-input>
          <el-button @click="showReindexConfirm = true">
            <el-icon><Refresh /></el-icon>
            重新索引
          </el-button>
        </div>
      </template>

      <el-table :data="documents" v-loading="loading">
        <el-table-column prop="title" label="标题" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getTypeColor(row.metadata.type)">
              {{ getTypeLabel(row.metadata.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="200">
          <template #default="{ row }">
            {{ getSourceLabel(row) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-popconfirm
              title="确定删除此文档吗？"
              @confirm="deleteDocument(row.id)"
            >
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="pagination.total > 0"
        style="margin-top: 20px; justify-content: center;"
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="prev, pager, next, total"
        @current-change="handlePageChange"
      />
    </el-card>

    <el-popconfirm
      v-model="showReindexConfirm"
      title="确定要重新索引所有文档吗？这可能需要一些时间。"
      @confirm="handleReindex"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { knowledgeApi } from '@/api/knowledge';
import { ElMessage } from 'element-plus';
import type { Document } from '@/types';

const documents = ref<Document[]>([]);
const loading = ref(false);
const searchInput = ref('');
const showReindexConfirm = ref(false);

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
});

async function loadDocuments(page = 1) {
  loading.value = true;
  try {
    const response = await knowledgeApi.list({ page, pageSize: pagination.value.pageSize });
    if (response.success && response.data) {
      documents.value = response.data.items;
      pagination.value.total = response.data.total;
      pagination.value.page = response.data.page;
    }
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  if (!searchInput.value.trim()) {
    loadDocuments();
    return;
  }

  loading.value = true;
  try {
    const keywords = searchInput.value.split(',').map(k => k.trim()).filter(k => k);
    const response = await knowledgeApi.search(keywords);
    if (response.success && response.data) {
      documents.value = response.data;
      pagination.value.total = response.data.length;
    }
  } finally {
    loading.value = false;
  }
}

async function handleReindex() {
  try {
    const response = await knowledgeApi.reindex();
    if (response.success) {
      ElMessage.success('重新索引已启动');
      loadDocuments();
    }
  } catch (error) {
    ElMessage.error('重新索引失败');
  }
}

async function deleteDocument(id: string) {
  const response = await knowledgeApi.delete(id);
  if (response.success) {
    ElMessage.success('文档已删除');
    loadDocuments(pagination.value.page);
  }
}

function handlePageChange(page: number) {
  loadDocuments(page);
}

function getTypeColor(type: string) {
  const colors: Record<string, any> = {
    note: 'primary',
    webpage: 'success',
    file: 'warning',
    code: 'info',
  };
  return colors[type] || '';
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    note: '笔记',
    webpage: '网页',
    file: '文件',
    code: '代码',
  };
  return labels[type] || type;
}

function getSourceLabel(doc: Document) {
  if (doc.metadata.url) {
    return new URL(doc.metadata.url).hostname;
  }
  if (doc.metadata.filePath) {
    return doc.metadata.filePath.split('/').pop();
  }
  return doc.source;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

onMounted(() => {
  loadDocuments();
});
</script>

<style scoped>
.knowledge-view {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
