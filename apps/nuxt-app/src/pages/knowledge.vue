<template>
  <div class="knowledge-view">
    <n-card>
      <template #header>
        <div class="header">
          <n-input
            v-model:value="searchInput"
            placeholder="输入关键词，用逗号分隔"
            clearable
            style="width: 400px;"
            @keyup.enter="handleSearch"
          >
            <template #suffix>
              <n-button text @click="handleSearch">
                <template #icon>
                  <n-icon :component="SearchOutline" />
                </template>
              </n-button>
            </template>
          </n-input>
          <n-button @click="showReindexConfirm = true">
            <template #icon>
              <n-icon :component="RefreshOutline" />
            </template>
            重新索引
          </n-button>
        </div>
      </template>

      <n-data-table
        :columns="columns"
        :data="documents"
        :loading="loading"
        :row-key="(row: any) => row.id"
      />

      <n-pagination
        v-if="pagination.total > 0"
        style="margin-top: 20px; display: flex; justify-content: center;"
        v-model:page="pagination.page"
        :page-size="pagination.pageSize"
        :item-count="pagination.total"
        show-quick-jumper
        @update:page="handlePageChange"
      />
    </n-card>

    <!-- 删除确认对话框 -->
    <n-modal
      v-model:show="showDeleteDialog"
      preset="dialog"
      title="确认删除"
      content="确定删除此文档吗？"
      :positive-text="'确定'"
      :negative-text="'取消'"
      @positive-click="confirmDelete"
    />

    <!-- 重新索引确认对话框 -->
    <n-modal
      v-model:show="showReindexConfirm"
      preset="dialog"
      title="确认重新索引"
      content="确定要重新索引所有文档吗？这可能需要一些时间。"
      :positive-text="'确定'"
      :negative-text="'取消'"
      @positive-click="handleReindex"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, computed } from 'vue';
import { knowledgeApi } from '@/api';
import { message } from '@/utils/message';
import type { KnowledgeKnowledgeDocument } from '@/api/types';
import { NButton, NTag, type DataTableColumns } from 'naive-ui';
import { SearchOutline, RefreshOutline } from '@vicons/ionicons5';

const documents = ref<KnowledgeDocument[]>([]);
const loading = ref(false);
const searchInput = ref('');
const showReindexConfirm = ref(false);
const showDeleteDialog = ref(false);
const deleteTargetId = ref<string | null>(null);

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
});

// 表格列配置
const columns = computed<DataTableColumns<any>>(() => [
  {
    title: '标题',
    key: 'title',
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render: (row) => {
      return h(NTag, {
        type: getTypeTagType(row.metadata.type),
        size: 'small',
        bordered: false,
      }, { default: () => getTypeLabel(row.metadata.type) });
    },
  },
  {
    title: '来源',
    key: 'source',
    width: 200,
    render: (row) => getSourceLabel(row),
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 180,
    render: (row) => formatDate(row.updatedAt),
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) => {
      return h(NButton, {
        text: true,
        type: 'error',
        onClick: () => showDeleteConfirmDialog(row.id),
      }, { default: () => '删除' });
    },
  },
]);

async function loadKnowledgeDocuments(page = 1) {
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
    loadKnowledgeDocuments();
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
      message.success('重新索引已启动');
      loadKnowledgeDocuments();
    }
  } catch {
    message.error('重新索引失败');
  }
}

function showDeleteConfirmDialog(id: string) {
  deleteTargetId.value = id;
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  if (deleteTargetId.value) {
    const response = await knowledgeApi.delete(deleteTargetId.value);
    if (response.success) {
      message.success('文档已删除');
      loadKnowledgeDocuments(pagination.value.page);
    }
    deleteTargetId.value = null;
  }
}

function handlePageChange(page: number) {
  loadKnowledgeDocuments(page);
}

function getTypeTagType(type: string): 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error' {
  const types: Record<string, 'default' | 'primary' | 'info' | 'success' | 'warning' | 'error'> = {
    note: 'primary',
    webpage: 'success',
    file: 'warning',
    code: 'info',
  };
  return types[type] || 'default';
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

function getSourceLabel(doc: KnowledgeDocument) {
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
  loadKnowledgeDocuments();
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
