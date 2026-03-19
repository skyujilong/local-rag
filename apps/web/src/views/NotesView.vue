<template>
  <div class="notes-view">
    <n-card>
      <template #header>
        <div class="header">
          <n-input
            v-model:value="searchQuery"
            placeholder="搜索笔记..."
            clearable
            style="width: 300px;"
            @update:value="handleSearch"
          >
            <template #prefix>
              <n-icon :component="SearchOutline" />
            </template>
          </n-input>
          <n-button type="primary" @click="$router.push('/notes/new/edit')">
            <template #icon>
              <n-icon :component="AddOutline" />
            </template>
            新建笔记
          </n-button>
        </div>
      </template>

      <n-data-table
        :columns="columns"
        :data="notesStore.notes"
        :loading="notesStore.loading"
        :row-key="(row: any) => row.id"
        :pagination="paginationConfig"
      />

      <n-pagination
        v-if="notesStore.pagination.total > 0"
        style="margin-top: 20px; display: flex; justify-content: center;"
        v-model:page="notesStore.pagination.page"
        :page-size="notesStore.pagination.pageSize"
        :item-count="notesStore.pagination.total"
        show-quick-jumper
        @update:page="handlePageChange"
      />
    </n-card>

    <!-- 删除确认对话框 -->
    <n-modal
      v-model:show="showDeleteConfirm"
      preset="dialog"
      title="确认删除"
      content="确定删除此笔记吗？"
      :positive-text="'确定'"
      :negative-text="'取消'"
      @positive-click="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, h, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useNotesStore } from '@/stores';
import { NButton, NIcon, NTag, type DataTableColumns } from 'naive-ui';
import { SearchOutline, AddOutline } from '@vicons/ionicons5';

const router = useRouter();
const notesStore = useNotesStore();

const searchQuery = ref('');
const deleteTargetId = ref<string | null>(null);
const showDeleteConfirm = ref(false);

// 表格列配置
const columns = computed<DataTableColumns<any>>(() => [
  {
    title: '标题',
    key: 'title',
  },
  {
    title: '标签',
    key: 'tags',
    width: 200,
    render: (row) => {
      if (!row.tags || row.tags.length === 0) return '-';
      return h('div', { style: { display: 'flex', gap: '4px' } },
        row.tags.map((tag: string) =>
          h(NTag, { size: 'small', bordered: false }, { default: () => tag })
        )
      );
    },
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
    width: 150,
    render: (row) => {
      return h('div', { style: { display: 'flex', gap: '8px' } }, [
        h(NButton, {
          text: true,
          type: 'primary',
          onClick: () => router.push(`/notes/${row.id}/edit`),
        }, { default: () => '编辑' }),
        h(NButton, {
          text: true,
          type: 'error',
          onClick: () => showDeleteDialog(row.id),
        }, { default: () => '删除' }),
      ]);
    },
  },
]);

// 内置分页配置（禁用，使用外部分页）
const paginationConfig = computed(() => ({
  pageSize: notesStore.pagination.pageSize,
}));

function handleSearch() {
  if (searchQuery.value) {
    notesStore.searchNotes(searchQuery.value);
  } else {
    notesStore.loadNotes();
  }
}

function handlePageChange(page: number) {
  notesStore.loadNotes({ page });
}

function showDeleteDialog(id: string) {
  deleteTargetId.value = id;
  showDeleteConfirm.value = true;
}

function confirmDelete() {
  if (deleteTargetId.value) {
    notesStore.deleteNote(deleteTargetId.value);
    deleteTargetId.value = null;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

onMounted(() => {
  notesStore.loadNotes();
});
</script>

<style scoped>
.notes-view {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
