<template>
  <div class="notes-list">
    <!-- 顶部操作栏 -->
    <n-space justify="space-between" align="center" style="margin-bottom: 24px">
      <n-space align="center">
        <n-input
          v-model:value="searchQuery"
          placeholder="搜索笔记..."
          clearable
          style="width: 300px"
          @input="onSearchInput"
        >
          <template #prefix>
            <n-icon><SearchIcon /></n-icon>
          </template>
        </n-input>

        <n-select
          v-model:value="selectedTags"
          multiple
          placeholder="选择标签筛选"
          :options="tagOptions"
          style="width: 250px"
          @update:value="onTagFilterChange"
        />
      </n-space>

      <n-space align="center">
        <n-select
          v-model:value="sortBy"
          :options="sortOptions"
          style="width: 150px"
          @update:value="loadNotes"
        />

        <n-button type="primary" @click="createNote">
          <template #icon>
            <n-icon><AddIcon /></n-icon>
          </template>
          新建笔记
        </n-button>
      </n-space>
    </n-space>

    <!-- 标签栏 -->
    <n-space v-if="allTags.length > 0" style="margin-bottom: 16px" :wrap="false">
      <n-tag
        :type="selectedTags.length === 0 ? 'primary' : 'default'"
        checkable
        :checked="selectedTags.length === 0"
        @click="clearTags"
      >
        全部 ({{ totalNotes }})
      </n-tag>

      <n-tag
        v-for="tag in allTags"
        :key="tag.id"
        :type="selectedTags.includes(tag.name) ? 'primary' : 'default'"
        checkable
        :checked="selectedTags.includes(tag.name)"
        @click="toggleTag(tag.name)"
      >
        {{ tag.name }} ({{ tag.count }})
      </n-tag>
    </n-space>

    <!-- 笔记列表 -->
    <n-spin :show="loading">
      <n-space v-if="notes.length > 0" vertical :size="16">
        <n-card
          v-for="note in notes"
          :key="note.id"
          hoverable
          @click="openNote(note.id)"
          class="note-card"
        >
          <n-space vertical :size="12">
            <!-- 标题和标签 -->
            <n-space justify="space-between" align="start">
              <n-space vertical :size="8">
                <n-text strong style="font-size: 18px">
                  {{ note.title || '无标题' }}
                </n-text>

                <n-space v-if="note.tags && note.tags.length > 0" size="small">
                  <n-tag
                    v-for="tag in note.tags"
                    :key="tag"
                    size="small"
                    type="info"
                  >
                    {{ tag }}
                  </n-tag>
                </n-space>
              </n-space>

              <n-dropdown :options="cardMenuOptions" @select="(key) => handleCardAction(key, note.id)">
                <n-button text>
                  <template #icon>
                    <n-icon><MoreVertIcon /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </n-space>

            <!-- 内容预览 -->
            <n-text depth="3" style="font-size: 14px; line-height: 1.6">
              {{ note.excerpt }}
            </n-text>

            <!-- 时间信息 -->
            <n-space align="center" style="font-size: 12px; color: #999">
              <span>📅 {{ formatDate(note.createdAt) }}</span>
              <span v-if="note.updatedAt !== note.createdAt">
                ✏️ {{ formatDate(note.updatedAt) }}
              </span>
            </n-space>
          </n-space>
        </n-card>
      </n-space>

      <!-- 空状态 -->
      <n-empty
        v-else
        description="还没有笔记"
        style="margin-top: 100px"
      >
        <template #extra>
          <n-button type="primary" @click="createNote">
            创建第一条笔记
          </n-button>
        </template>
      </n-empty>
    </n-spin>

    <!-- 分页 -->
    <n-pagination
      v-if="totalNotes > pageSize"
      v-model:page="currentPage"
      :page-count="Math.ceil(totalNotes / pageSize)"
      :page-size="pageSize"
      style="margin-top: 24px; display: flex; justify-content: center"
      @update:page="loadNotes"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  NSpace,
  NInput,
  NSelect,
  NButton,
  NTag,
  NCard,
  NText,
  NIcon,
  NSpin,
  NEmpty,
  NPagination,
  NDropdown,
  useDialog,
  useMessage,
  type SelectOption,
} from 'naive-ui';
import { Search, Add, EllipsisVertical } from '@vicons/ionicons5';
import type { NoteListItem } from '../../../../../shared/types/documents';

const router = useRouter();
const dialog = useDialog();
const message = useMessage();

// 图标组件
const SearchIcon = Search;
const AddIcon = Add;
const MoreVertIcon = EllipsisVertical;

// 状态
const loading = ref(false);
const notes = ref<NoteListItem[]>([]);
const totalNotes = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

// 搜索和筛选
const searchQuery = ref('');
const selectedTags = ref<string[]>([]);
const sortBy = ref<'updatedAt' | 'createdAt' | 'title'>('updatedAt');

// 标签
const allTags = ref<Array<{ id: string; name: string; count: number }>>([]);

// 排序选项
const sortOptions: SelectOption[] = [
  { label: '更新时间', value: 'updatedAt' },
  { label: '创建时间', value: 'createdAt' },
  { label: '标题', value: 'title' },
];

// 卡片菜单
const cardMenuOptions = [
  {
    label: '编辑',
    key: 'edit',
  },
  {
    label: '删除',
    key: 'delete',
  },
];

/**
 * 初始化
 */
onMounted(() => {
  loadNotes();
  loadTags();
});

/**
 * 加载笔记列表
 */
const loadNotes = async () => {
  loading.value = true;

  try {
    const params = new URLSearchParams({
      sort: sortBy.value,
      order: 'desc',
      page: currentPage.value.toString(),
      limit: pageSize.value.toString(),
    });

    if (selectedTags.value.length > 0) {
      params.append('tags', selectedTags.value.join(','));
    }

    const response = await fetch(`/api/documents/notes?${params}`);
    const data = await response.json();

    if (data.success && data.data) {
      notes.value = data.data.documents;
      totalNotes.value = data.data.total;
    } else {
      message.error('加载笔记失败');
    }
  } catch (error) {
    console.error('加载笔记失败:', error);
    message.error('加载笔记失败');
  } finally {
    loading.value = false;
  }
};

/**
 * 加载标签列表
 */
const loadTags = async () => {
  try {
    const response = await fetch('/api/documents/tags');
    const data = await response.json();

    if (data.success && data.data) {
      allTags.value = data.data.tags;
    }
  } catch (error) {
    console.error('加载标签失败:', error);
  }
};

// 搜索防抖定时器
let searchTimer: ReturnType<typeof setTimeout>;

/**
 * 搜索输入
 */
const onSearchInput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentPage.value = 1;
    loadNotes();
  }, 300);
};

/**
 * 标签筛选变更
 */
const onTagFilterChange = () => {
  currentPage.value = 1;
  loadNotes();
};

/**
 * 切换标签
 */
const toggleTag = (tagName: string) => {
  const index = selectedTags.value.indexOf(tagName);
  if (index !== -1) {
    selectedTags.value.splice(index, 1);
  } else {
    selectedTags.value.push(tagName);
  }
  currentPage.value = 1;
  loadNotes();
};

/**
 * 清除标签筛选
 */
const clearTags = () => {
  selectedTags.value = [];
  currentPage.value = 1;
  loadNotes();
};

/**
 * 创建笔记
 */
const createNote = () => {
  router.push('/documents/new');
};

/**
 * 打开笔记
 */
const openNote = (id: string) => {
  router.push(`/documents/${id}`);
};

/**
 * 卡片操作
 */
const handleCardAction = (key: string, id: string) => {
  switch (key) {
    case 'edit':
      openNote(id);
      break;
    case 'delete':
      deleteNote(id);
      break;
  }
};

/**
 * 删除笔记
 */
const deleteNote = (id: string) => {
  const note = notes.value.find((n) => n.id === id);
  if (!note) return;

  dialog.warning({
    title: '确认删除',
    content: `确定要删除笔记 "${note.title}" 吗？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const response = await fetch(`/api/documents/notes/${id}`, {
          method: 'DELETE',
        });

        const data = await response.json();

        if (data.success) {
          message.success('删除成功');
          loadNotes();
          loadTags();
        } else {
          message.error(data.error || '删除失败');
        }
      } catch (error) {
        console.error('删除失败:', error);
        message.error('删除失败');
      }
    },
  });
};

/**
 * 格式化日期
 */
const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return '今天';
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days} 天前`;
  } else {
    return d.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
    });
  }
};

// 标签选项（用于下拉筛选）
const tagOptions = computed(() => {
  return allTags.value.map((tag) => ({
    label: tag.name,
    value: tag.name,
  }));
});
</script>

<style scoped>
.notes-list {
  max-width: 1200px;
  margin: 0 auto;
}

.note-card {
  cursor: pointer;
  transition: box-shadow 0.3s;
}

.note-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
