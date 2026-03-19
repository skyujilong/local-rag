<template>
  <div class="note-detail-view" v-if="note">
    <el-card>
      <template #header>
        <div class="header">
          <div>
            <h1>{{ note.title }}</h1>
            <div class="meta">
              <el-tag
                v-for="tag in note.tags"
                :key="tag"
                size="small"
                style="margin-right: 8px;"
              >
                {{ tag }}
              </el-tag>
              <span class="time">{{ formatDate(note.updatedAt) }}</span>
            </div>
          </div>
          <div class="actions">
            <el-button @click="$router.push('/notes')">返回</el-button>
            <el-button type="primary" @click="isEditing = !isEditing">
              {{ isEditing ? '预览' : '编辑' }}
            </el-button>
          </div>
        </div>
      </template>

      <el-input
        v-if="isEditing"
        v-model="editContent"
        type="textarea"
        :rows="20"
        @blur="saveContent"
      />
      <div v-else class="markdown-content" v-html="renderedContent"></div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotesStore } from '@/stores';
import MarkdownIt from 'markdown-it';
import { useNotesStore } from '@/stores';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();

const note = ref<Note | null>(null);
const isEditing = ref(false);
const editContent = ref('');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight: (str, lang) => {
    if (lang && hl.getLanguage(lang)) {
      try {
        return hl.highlight(str, { language: lang }).value;
      } catch {}
    }
    return '';
  },
});

const renderedContent = computed(() => {
  return md.render(note.value?.content || '');
});

async function saveContent() {
  if (note.value && editContent.value !== note.value.content) {
    await notesStore.updateNote(note.value.id, {
      content: editContent.value,
    });
    note.value!.content = editContent.value;
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('zh-CN');
}

onMounted(async () => {
  const id = route.params.id as string;
  await notesStore.loadNote(id);
  note.value = notesStore.currentNote;
  if (note.value) {
    editContent.value = note.value.content;
  }
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
}

.header h1 {
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
