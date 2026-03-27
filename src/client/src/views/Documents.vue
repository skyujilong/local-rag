<template>
  <div class="documents">
    <n-space vertical size="large">
      <n-space>
        <n-h1>Documents</n-h1>
        <n-button type="primary" @click="showImportModal = true">Import Document</n-button>
        <n-button @click="loadDocuments">Refresh</n-button>
      </n-space>

      <n-data-table
        :columns="columns"
        :data="documents"
        :loading="loading"
        :pagination="pagination"
        striped
      />

      <n-modal v-model:show="showImportModal" preset="card" title="Import Document" style="width: 600px">
        <n-tabs type="line" animated>
          <n-tab-pane name="markdown" tab="Markdown File">
            <n-form ref="formRef" :model="importForm" label-placement="left" label-width="auto">
              <n-form-item label="File Path" path="path">
                <n-input v-model:value="importForm.path" placeholder="/path/to/document.md" />
              </n-form-item>
            </n-form>
            <template #footer>
              <n-button type="primary" @click="importMarkdown" :loading="importing">Import</n-button>
            </template>
          </n-tab-pane>

          <n-tab-pane name="text" tab="Text Content">
            <n-form ref="formRef" :model="importForm" label-placement="left" label-width="auto">
              <n-form-item label="Title" path="title">
                <n-input v-model:value="importForm.title" placeholder="Document title" />
              </n-form-item>
              <n-form-item label="Content" path="content">
                <n-input
                  v-model:value="importForm.content"
                  type="textarea"
                  placeholder="Paste your content here..."
                  :rows="10"
                />
              </n-form-item>
            </n-form>
            <template #footer>
              <n-button type="primary" @click="importText" :loading="importing">Import</n-button>
            </template>
          </n-tab-pane>

          <n-tab-pane name="url" tab="Web URL">
            <n-form ref="formRef" :model="importForm" label-placement="left" label-width="auto">
              <n-form-item label="URL" path="url">
                <n-input v-model:value="importForm.url" placeholder="https://example.com/article" />
              </n-form-item>
            </n-form>
            <template #footer>
              <n-button type="primary" @click="importUrl" :loading="importing">Crawl & Import</n-button>
            </template>
          </n-tab-pane>
        </n-tabs>
      </n-modal>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import type { Document } from '../../../shared/types';
import {NTag,NButton,NSpace} from 'naive-ui'

const loading = ref(false);
const importing = ref(false);
const showImportModal = ref(false);
const documents = ref<Document[]>([]);
const importForm = ref({
  path: '',
  title: '',
  content: '',
  url: '',
});

const columns: DataTableColumns<Document> = [
  {
    title: 'Title',
    key: 'metadata.title',
    ellipsis: { tooltip: true },
  },
  {
    title: 'Source',
    key: 'metadata.source',
    render: (row) => h(NTag, { type: 'info' }, { default: () => row.metadata.source }),
  },
  {
    title: 'Status',
    key: 'vectorizationStatus',
    render: (row) => {
      const type = row.vectorizationStatus === 'completed' ? 'success' : 'warning';
      return h(NTag, { type }, { default: () => row.vectorizationStatus });
    },
  },
  {
    title: 'Tags',
    key: 'metadata.tags',
    render: (row) =>
      h(
        NSpace,
        { size: 'small' },
        {
          default: () =>
            row.metadata.tags?.map((tag) =>
              h(NTag, { size: 'small', type: 'default' }, { default: () => tag })
            ),
        }
      ),
  },
  {
    title: 'Created',
    key: 'metadata.createdAt',
    render: (row) => new Date(row.metadata.createdAt).toLocaleDateString(),
  },
  {
    title: 'Actions',
    key: 'actions',
    render: (row) =>
      h(
        NButton,
        {
          size: 'small',
          type: 'error',
          onClick: () => deleteDocument(row.metadata.id),
        },
        { default: () => 'Delete' }
      ),
  },
];

const pagination = {
  pageSize: 10,
};

const loadDocuments = async () => {
  loading.value = true;
  try {
    const response = await fetch('/api/documents');
    const data = await response.json();
    documents.value = data.documents;
  } catch (error) {
    console.error('Failed to load documents:', error);
  } finally {
    loading.value = false;
  }
};

const importMarkdown = async () => {
  importing.value = true;
  try {
    const response = await fetch('/api/import/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: importForm.value.path }),
    });
    const data = await response.json();
    if (data.success) {
      showImportModal.value = false;
      await loadDocuments();
    }
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    importing.value = false;
  }
};

const importText = async () => {
  importing.value = true;
  try {
    const response = await fetch('/api/import/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: importForm.value.title,
        content: importForm.value.content,
      }),
    });
    const data = await response.json();
    if (data.success) {
      showImportModal.value = false;
      await loadDocuments();
    }
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    importing.value = false;
  }
};

const importUrl = async () => {
  importing.value = true;
  try {
    const response = await fetch('/api/crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: importForm.value.url }),
    });
    const data = await response.json();
    if (data.success) {
      showImportModal.value = false;
      await loadDocuments();
    }
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    importing.value = false;
  }
};

const deleteDocument = async (id: string) => {
  if (!confirm('Are you sure you want to delete this document?')) return;

  try {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    await loadDocuments();
  } catch (error) {
    console.error('Delete failed:', error);
  }
};

onMounted(() => {
  loadDocuments();
});
</script>

<style scoped>
.documents {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
