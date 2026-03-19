<template>
  <div class="notes-view">
    <el-card>
      <template #header>
        <div class="header">
          <el-input
            v-model="searchQuery"
            placeholder="搜索笔记..."
            clearable
            style="width: 300px;"
            @input="handleSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            新建笔记
          </el-button>
        </div>
      </template>

      <el-table :data="notesStore.notes" v-loading="notesStore.loading">
        <el-table-column prop="title" label="标题" />
        <el-table-column label="标签" width="200">
          <template #default="{ row }">
            <el-tag
              v-for="tag in row.tags"
              :key="tag"
              size="small"
              style="margin-right: 4px;"
            >
              {{ tag }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="editNote(row)">
              编辑
            </el-button>
            <el-popconfirm
              title="确定删除此笔记吗？"
              @confirm="notesStore.deleteNote(row.id)"
            >
              <template #reference>
                <el-button link type="danger">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="notesStore.pagination.total > 0"
        style="margin-top: 20px; justify-content: center;"
        :current-page="notesStore.pagination.page"
        :page-size="notesStore.pagination.pageSize"
        :total="notesStore.pagination.total"
        layout="prev, pager, next, total"
        @current-change="handlePageChange"
      />
    </el-card>

    <!-- 创建/编辑笔记对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingNote ? '编辑笔记' : '新建笔记'"
      width="800px"
    >
      <el-form :model="noteForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="noteForm.title" placeholder="输入笔记标题" />
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="noteForm.tags"
            multiple
            filterable
            allow-create
            placeholder="选择或创建标签"
            style="width: 100%;"
          >
            <el-option
              v-for="tag in allTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="noteForm.content"
            type="textarea"
            :rows="15"
            placeholder="支持 Markdown 格式"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveNote">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useNotesStore } from '@/stores';
import type { Note } from '@/types';

const notesStore = useNotesStore();
const searchQuery = ref('');
const showCreateDialog = ref(false);
const editingNote = ref<Note | null>(null);

const noteForm = ref({
  title: '',
  content: '',
  tags: [] as string[],
});

const allTags = computed(() => {
  const tags = new Set<string>();
  notesStore.notes.forEach(note => {
    note.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags);
});

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

function editNote(note: Note) {
  editingNote.value = note;
  noteForm.value = {
    title: note.title,
    content: note.content,
    tags: [...note.tags],
  };
  showCreateDialog.value = true;
}

async function saveNote() {
  if (!noteForm.value.title) {
    return;
  }

  if (editingNote.value) {
    await notesStore.updateNote(editingNote.value.id, noteForm.value);
  } else {
    await notesStore.createNote(noteForm.value);
  }

  showCreateDialog.value = false;
  editingNote.value = null;
  noteForm.value = { title: '', content: '', tags: [] };
  notesStore.loadNotes();
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
