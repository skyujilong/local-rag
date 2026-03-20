<template>
  <div class="note-detail-view" v-if="note">
    <n-card>
      <template #header>
        <div class="header">
          <div>
            <n-h1>{{ note.title }}</n-h1>
            <div class="meta">
              <n-space>
                <n-tag
                  v-for="tag in note.tags"
                  :key="tag"
                  size="small"
                  :bordered="false"
                  type="info"
                >
                  {{ tag }}
                </n-tag>
                <span class="time">{{ formatDate(note.updatedAt) }}</span>
              </n-space>
            </div>
          </div>
          <div class="actions">
            <n-space>
              <n-button @click="navigateTo('/notes')">返回</n-button>
              <n-button type="primary" @click="navigateTo(`/notes/${note.id}/edit`)">
                <template #icon>
                  <n-icon :component="PencilOutline" />
                </template>
                编辑
              </n-button>
            </n-space>
          </div>
        </div>
      </template>

      <div class="markdown-content" v-html="renderedContent"></div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MarkdownIt from 'markdown-it';
import { PencilOutline } from '@vicons/ionicons5';
import type { Note } from '@local-rag/shared/types';
import { useNotesStore } from '@/stores/notes';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();

const note = ref<Note | null>(null);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight: (str, lang) => {
    if (lang && typeof window !== 'undefined') {
      const hl = (window as Window & { hl?: any }).hl;
      if (hl && hl.getLanguage && hl.getLanguage(lang)) {
        try {
          return hl.highlight(str, { language: lang }).value;
        } catch {}
      }
    }
    return '';
  },
});

const renderedContent = computed(() => {
  return md.render(note.value?.content || '');
});

function navigateTo(path: string) {
  router.push(path);
}

function formatDate(dateStr: string | Date) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

onMounted(async () => {
  const id = route.params.id as string;
  await notesStore.loadNote(id);
  note.value = notesStore.currentNote;
});
</script>

<style scoped>
.note-detail-view {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header :deep(.n-h1) {
  margin: 0 0 8px 0;
  font-size: 24px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #909399;
}

.time {
  font-size: 14px;
}

.markdown-content {
  line-height: 1.8;
  font-size: 16px;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin-top: 24px;
  margin-bottom: 16px;
}

.markdown-content :deep(pre) {
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
}

.markdown-content :deep(code) {
  background-color: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Monaco', 'Courier New', monospace;
}

.markdown-content :deep(img) {
  max-width: 100%;
  border-radius: 4px;
}
</style>
