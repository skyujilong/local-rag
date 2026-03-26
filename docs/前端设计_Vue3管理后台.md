# Vue3 知识库管理后台 - 前端设计文档

## 1. 技术栈选型

### 核心框架
- **Vue 3.4+** (Composition API + `<script setup>`)
- **Vite 5+** (构建工具,HMR 快速)
- **TypeScript 5+** (类型安全)

### 路由与状态管理
- **Vue Router 4** (官方路由)
- **Pinia 2** (Vue3 官方推荐状态管理)

### UI 组件库
- **Element Plus 2.5+**
  - 理由:组件丰富、文档完善、社区活跃、支持 Tree-shaking
  - 替代方案:Ant Design Vue 4(更企业化风格)

### Markdown 编辑器
- **Vditor 3.10+**
  - 理由:
    1. 支持所见即所得/即时渲染/分屏预览三种模式
    2. 工具栏可定制,支持图片上传、代码高亮
    3. 原生支持数学公式、流程图、甘特图
    4. 自带自动保存(localStorage)
    5. 轻量级(~200KB gzipped),性能优秀
  - 替代方案:Milkdown(更现代但学习曲线陡)

### 工具库
- **Axios 1.6+** (HTTP 客户端)
- **vue-virtual-scroller** (虚拟列表)
- **VueUse** (Vue Composition API 工具集)
- **Day.js** (日期处理,轻量级)

---

## 2. 项目结构

```
src/
├── assets/                 # 静态资源
│   ├── styles/             # 全局样式
│   │   ├── variables.scss  # CSS 变量
│   │   └── global.scss     # 全局样式
│   └── icons/              # 图标资源
├── components/             # 公共组件
│   ├── Layout/
│   │   ├── AppLayout.vue           # 主布局(侧边栏+顶栏+内容区)
│   │   ├── AppSidebar.vue          # 侧边栏导航
│   │   └── AppHeader.vue           # 顶栏(面包屑、用户信息)
│   ├── Common/
│   │   ├── SearchBar.vue           # 通用搜索框
│   │   ├── Pagination.vue          # 分页组件
│   │   ├── EmptyState.vue          # 空状态占位
│   │   └── LoadingSpinner.vue      # 加载动画
│   └── Markdown/
│       ├── MarkdownEditor.vue      # Vditor 封装
│       └── MarkdownPreview.vue     # 纯预览组件
├── views/                  # 页面组件
│   ├── Dashboard/
│   │   └── index.vue               # 首页仪表盘
│   ├── Notes/
│   │   ├── index.vue               # 笔记列表页
│   │   ├── components/
│   │   │   ├── NoteList.vue        # 笔记列表
│   │   │   ├── NoteCard.vue        # 笔记卡片
│   │   │   └── NoteToolbar.vue     # 工具栏(搜索、筛选)
│   │   ├── NoteEditor.vue          # 笔记编辑页
│   │   └── NoteCreate.vue          # 新建笔记页
│   ├── Crawler/
│   │   ├── Config/
│   │   │   ├── index.vue           # 爬虫配置页
│   │   │   └── components/
│   │   │       ├── LoginConfig.vue     # 登录配置
│   │   │       ├── QrCodeLogin.vue     # 二维码登录
│   │   │       ├── TokenInput.vue      # Token 输入
│   │   │       ├── XPathRuleEditor.vue # XPath 规则编辑器
│   │   │       ├── RuleCard.vue        # 单条规则卡片
│   │   │       └── ConcurrencySettings.vue # 并发设置
│   │   └── Tasks/
│   │       ├── index.vue           # 任务监控页
│   │       └── components/
│   │           ├── TaskBoard.vue       # 任务看板
│   │           ├── TaskCard.vue        # 任务卡片
│   │           └── TaskTimeline.vue    # 任务时间线
│   └── Search/
│       ├── index.vue               # 知识库检索页
│       └── components/
│           ├── UnifiedSearchBar.vue    # 统一搜索框
│           ├── SearchModeSwitch.vue    # 搜索模式切换
│           ├── SearchResults.vue       # 结果列表
│           ├── ResultCard.vue          # 结果卡片
│           └── FilterSidebar.vue       # 筛选侧边栏
├── stores/                 # Pinia 状态管理
│   ├── notes.ts            # 笔记相关状态
│   ├── crawler.ts          # 爬虫相关状态
│   ├── search.ts           # 搜索相关状态
│   └── user.ts             # 用户信息
├── api/                    # API 接口
│   ├── client.ts           # Axios 实例配置
│   ├── notes.ts            # 笔记接口
│   ├── crawler.ts          # 爬虫接口
│   └── search.ts           # 搜索接口
├── router/                 # 路由配置
│   └── index.ts            # 路由定义
├── types/                  # TypeScript 类型定义
│   ├── note.ts
│   ├── crawler.ts
│   └── search.ts
├── utils/                  # 工具函数
│   ├── debounce.ts         # 防抖函数
│   ├── highlight.ts        # 关键词高亮
│   └── format.ts           # 格式化工具
├── App.vue                 # 根组件
└── main.ts                 # 入口文件
```

---

## 3. 路由设计

### 路由规划

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    component: () => import('@/components/Layout/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard/index.vue'),
        meta: { title: '仪表盘', icon: 'dashboard' }
      },
      {
        path: 'notes',
        name: 'Notes',
        component: () => import('@/views/Notes/index.vue'),
        meta: { title: '笔记管理', icon: 'document' }
      },
      {
        path: 'notes/new',
        name: 'NoteCreate',
        component: () => import('@/views/Notes/NoteCreate.vue'),
        meta: { title: '新建笔记', parent: 'Notes' }
      },
      {
        path: 'notes/:id/edit',
        name: 'NoteEditor',
        component: () => import('@/views/Notes/NoteEditor.vue'),
        meta: { title: '编辑笔记', parent: 'Notes' }
      },
      {
        path: 'crawler/config',
        name: 'CrawlerConfig',
        component: () => import('@/views/Crawler/Config/index.vue'),
        meta: { title: '爬虫配置', icon: 'setting' }
      },
      {
        path: 'crawler/tasks',
        name: 'CrawlerTasks',
        component: () => import('@/views/Crawler/Tasks/index.vue'),
        meta: { title: '爬虫任务', icon: 'list' }
      },
      {
        path: 'search',
        name: 'Search',
        component: () => import('@/views/Search/index.vue'),
        meta: { title: '知识库检索', icon: 'search' }
      }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
```

### 路由守卫

```typescript
// 全局前置守卫:设置页面标题
router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '加载中'} - 知识库管理后台`;
  next();
});
```

---

## 4. 状态管理设计(Pinia)

### 4.1 笔记 Store

```typescript
// stores/notes.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Note, NoteQuery } from '@/types/note';
import * as notesAPI from '@/api/notes';

export const useNotesStore = defineStore('notes', () => {
  // 状态
  const notes = ref<Note[]>([]);
  const currentNote = ref<Note | null>(null);
  const loading = ref(false);
  const total = ref(0);
  const query = ref<NoteQuery>({
    keyword: '',
    page: 1,
    pageSize: 20
  });

  // 计算属性
  const hasNotes = computed(() => notes.value.length > 0);

  // 操作
  const fetchNotes = async (params?: Partial<NoteQuery>) => {
    loading.value = true;
    try {
      if (params) {
        query.value = { ...query.value, ...params };
      }
      const res = await notesAPI.getNotes(query.value);
      notes.value = res.data;
      total.value = res.total;
    } catch (error) {
      console.error('获取笔记失败:', error);
    } finally {
      loading.value = false;
    }
  };

  const fetchNoteById = async (id: string) => {
    loading.value = true;
    try {
      currentNote.value = await notesAPI.getNoteById(id);
    } catch (error) {
      console.error('获取笔记详情失败:', error);
    } finally {
      loading.value = false;
    }
  };

  const createNote = async (note: Partial<Note>) => {
    try {
      const newNote = await notesAPI.createNote(note);
      notes.value.unshift(newNote);
      return newNote;
    } catch (error) {
      console.error('创建笔记失败:', error);
      throw error;
    }
  };

  const updateNote = async (id: string, note: Partial<Note>) => {
    try {
      const updated = await notesAPI.updateNote(id, note);
      const index = notes.value.findIndex(n => n.id === id);
      if (index !== -1) {
        notes.value[index] = updated;
      }
      if (currentNote.value?.id === id) {
        currentNote.value = updated;
      }
      return updated;
    } catch (error) {
      console.error('更新笔记失败:', error);
      throw error;
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await notesAPI.deleteNote(id);
      notes.value = notes.value.filter(n => n.id !== id);
    } catch (error) {
      console.error('删除笔记失败:', error);
      throw error;
    }
  };

  return {
    // 状态
    notes,
    currentNote,
    loading,
    total,
    query,
    // 计算属性
    hasNotes,
    // 操作
    fetchNotes,
    fetchNoteById,
    createNote,
    updateNote,
    deleteNote
  };
});
```

### 4.2 爬虫 Store

```typescript
// stores/crawler.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CrawlerConfig, CrawlerTask, XPathRule } from '@/types/crawler';
import * as crawlerAPI from '@/api/crawler';

export const useCrawlerStore = defineStore('crawler', () => {
  // 状态
  const config = ref<CrawlerConfig | null>(null);
  const tasks = ref<CrawlerTask[]>([]);
  const loading = ref(false);
  const qrCodeUrl = ref('');
  const loginStatus = ref<'idle' | 'scanning' | 'success'>('idle');

  // 计算属性
  const runningTasks = computed(() =>
    tasks.value.filter(t => t.status === 'running')
  );
  const completedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'completed')
  );
  const failedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'failed')
  );

  // 操作
  const fetchConfig = async () => {
    loading.value = true;
    try {
      config.value = await crawlerAPI.getConfig();
    } catch (error) {
      console.error('获取爬虫配置失败:', error);
    } finally {
      loading.value = false;
    }
  };

  const saveConfig = async (newConfig: CrawlerConfig) => {
    try {
      config.value = await crawlerAPI.saveConfig(newConfig);
      return config.value;
    } catch (error) {
      console.error('保存爬虫配置失败:', error);
      throw error;
    }
  };

  const generateQrCode = async () => {
    loginStatus.value = 'scanning';
    try {
      const res = await crawlerAPI.generateQrCode();
      qrCodeUrl.value = res.qrCodeUrl;
      // 开始轮询检查登录状态
      pollLoginStatus(res.sessionId);
    } catch (error) {
      console.error('生成二维码失败:', error);
      loginStatus.value = 'idle';
    }
  };

  const pollLoginStatus = async (sessionId: string) => {
    const maxAttempts = 60; // 最多轮询 60 次(5 分钟)
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        loginStatus.value = 'idle';
        return;
      }

      try {
        const res = await crawlerAPI.checkLoginStatus(sessionId);
        if (res.status === 'success') {
          loginStatus.value = 'success';
          qrCodeUrl.value = '';
          // 更新配置中的 token
          if (config.value) {
            config.value.token = res.token;
          }
        } else {
          attempts++;
          setTimeout(poll, 5000); // 每 5 秒轮询一次
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
        loginStatus.value = 'idle';
      }
    };

    poll();
  };

  const verifyToken = async (token: string) => {
    try {
      const res = await crawlerAPI.verifyToken(token);
      return res.valid;
    } catch (error) {
      console.error('验证 Token 失败:', error);
      return false;
    }
  };

  const fetchTasks = async () => {
    loading.value = true;
    try {
      tasks.value = await crawlerAPI.getTasks();
    } catch (error) {
      console.error('获取爬虫任务失败:', error);
    } finally {
      loading.value = false;
    }
  };

  const startCrawler = async () => {
    try {
      const task = await crawlerAPI.startCrawler(config.value!);
      tasks.value.unshift(task);
      return task;
    } catch (error) {
      console.error('启动爬虫失败:', error);
      throw error;
    }
  };

  const stopTask = async (taskId: string) => {
    try {
      await crawlerAPI.stopTask(taskId);
      const task = tasks.value.find(t => t.id === taskId);
      if (task) {
        task.status = 'stopped';
      }
    } catch (error) {
      console.error('停止任务失败:', error);
      throw error;
    }
  };

  return {
    // 状态
    config,
    tasks,
    loading,
    qrCodeUrl,
    loginStatus,
    // 计算属性
    runningTasks,
    completedTasks,
    failedTasks,
    // 操作
    fetchConfig,
    saveConfig,
    generateQrCode,
    verifyToken,
    fetchTasks,
    startCrawler,
    stopTask
  };
});
```

### 4.3 搜索 Store

```typescript
// stores/search.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SearchResult, SearchQuery, SearchMode } from '@/types/search';
import * as searchAPI from '@/api/search';

export const useSearchStore = defineStore('search', () => {
  // 状态
  const results = ref<SearchResult[]>([]);
  const loading = ref(false);
  const total = ref(0);
  const query = ref<SearchQuery>({
    keyword: '',
    mode: 'hybrid',
    source: 'all',
    dateRange: null,
    page: 1,
    pageSize: 20
  });
  const history = ref<string[]>([]);

  // 操作
  const search = async (params?: Partial<SearchQuery>) => {
    loading.value = true;
    try {
      if (params) {
        query.value = { ...query.value, ...params };
      }

      // 添加到搜索历史
      if (query.value.keyword && !history.value.includes(query.value.keyword)) {
        history.value.unshift(query.value.keyword);
        if (history.value.length > 10) {
          history.value = history.value.slice(0, 10);
        }
      }

      const res = await searchAPI.search(query.value);
      results.value = res.data;
      total.value = res.total;
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      loading.value = false;
    }
  };

  const clearHistory = () => {
    history.value = [];
  };

  return {
    // 状态
    results,
    loading,
    total,
    query,
    history,
    // 操作
    search,
    clearHistory
  };
});
```

---

## 5. 核心页面设计

### 5.1 笔记管理页面(`/notes`)

#### 组件结构
```
NotesPage (views/Notes/index.vue)
├── NoteToolbar (工具栏)
│   ├── SearchBar (搜索框)
│   └── FilterDropdown (筛选下拉)
├── NoteList (笔记列表)
│   └── NoteCard (笔记卡片) × N
├── Pagination (分页)
└── FloatingActionButton (悬浮新建按钮)
```

#### 伪代码

```vue
<!-- views/Notes/index.vue -->
<template>
  <div class="notes-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <SearchBar
        v-model="searchKeyword"
        placeholder="搜索笔记标题或内容..."
        @search="handleSearch"
      />
      <el-button type="primary" @click="createNote">
        <el-icon><Plus /></el-icon>
        新建笔记
      </el-button>
    </div>

    <!-- 笔记列表 -->
    <el-skeleton :loading="loading" :rows="5" animated>
      <NoteList
        :notes="notes"
        @click="editNote"
        @delete="confirmDelete"
      />
    </el-skeleton>

    <!-- 空状态 -->
    <EmptyState
      v-if="!loading && !hasNotes"
      icon="document"
      message="还没有笔记,点击右上角创建第一篇吧"
    />

    <!-- 分页 -->
    <Pagination
      v-if="hasNotes"
      :total="total"
      :page="query.page"
      :page-size="query.pageSize"
      @change="handlePageChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useNotesStore } from '@/stores/notes';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useDebounceFn } from '@vueuse/core';

const router = useRouter();
const notesStore = useNotesStore();

// 状态
const searchKeyword = ref('');
const notes = computed(() => notesStore.notes);
const loading = computed(() => notesStore.loading);
const total = computed(() => notesStore.total);
const query = computed(() => notesStore.query);
const hasNotes = computed(() => notesStore.hasNotes);

// 生命周期
onMounted(() => {
  notesStore.fetchNotes();
});

// 防抖搜索
const handleSearch = useDebounceFn((keyword: string) => {
  notesStore.fetchNotes({ keyword, page: 1 });
}, 300);

// 分页处理
const handlePageChange = (page: number) => {
  notesStore.fetchNotes({ page });
};

// 新建笔记
const createNote = () => {
  router.push('/notes/new');
};

// 编辑笔记
const editNote = (id: string) => {
  router.push(`/notes/${id}/edit`);
};

// 删除笔记
const confirmDelete = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这篇笔记吗?此操作不可恢复。',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    await notesStore.deleteNote(id);
    ElMessage.success('删除成功');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};
</script>

<style scoped lang="scss">
.notes-page {
  padding: 24px;

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
}
</style>
```

```vue
<!-- views/Notes/components/NoteCard.vue -->
<template>
  <el-card
    class="note-card"
    :body-style="{ padding: '20px' }"
    shadow="hover"
    @click="handleClick"
  >
    <div class="card-header">
      <h3 class="note-title">{{ note.title }}</h3>
      <el-tag :type="getTagType(note.category)">
        {{ note.category }}
      </el-tag>
    </div>

    <div class="note-excerpt">
      {{ note.excerpt }}
    </div>

    <div class="card-footer">
      <div class="meta-info">
        <el-icon><Calendar /></el-icon>
        <span>{{ formatDate(note.updatedAt) }}</span>
        <el-icon><Document /></el-icon>
        <span>{{ note.wordCount }} 字</span>
      </div>

      <div class="actions" @click.stop>
        <el-button
          type="primary"
          text
          @click="handleEdit"
        >
          编辑
        </el-button>
        <el-button
          type="danger"
          text
          @click="handleDelete"
        >
          删除
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import type { Note } from '@/types/note';
import { formatDate } from '@/utils/format';

const props = defineProps<{
  note: Note;
}>();

const emit = defineEmits<{
  click: [id: string];
  delete: [id: string];
}>();

const handleClick = () => {
  emit('click', props.note.id);
};

const handleEdit = () => {
  emit('click', props.note.id);
};

const handleDelete = () => {
  emit('delete', props.note.id);
};

const getTagType = (category: string) => {
  const typeMap: Record<string, string> = {
    '技术': 'primary',
    '生活': 'success',
    '工作': 'warning'
  };
  return typeMap[category] || 'info';
};
</script>

<style scoped lang="scss">
.note-card {
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .note-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }

  .note-excerpt {
    color: #606266;
    line-height: 1.6;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .meta-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #909399;
      font-size: 14px;
    }

    .actions {
      display: flex;
      gap: 8px;
    }
  }
}
</style>
```

---

### 5.2 笔记编辑器页面(`/notes/:id/edit`)

#### 组件结构
```
NoteEditor (views/Notes/NoteEditor.vue)
├── EditorToolbar (工具栏)
│   ├── SaveButton (保存按钮)
│   ├── PreviewToggle (预览切换)
│   └── SettingsDropdown (设置下拉:分类、标签)
└── MarkdownEditor (Vditor 编辑器)
```

#### 伪代码

```vue
<!-- views/Notes/NoteEditor.vue -->
<template>
  <div class="note-editor-page">
    <!-- 顶部工具栏 -->
    <div class="editor-toolbar">
      <el-input
        v-model="title"
        placeholder="请输入笔记标题..."
        size="large"
        class="title-input"
      />

      <div class="toolbar-actions">
        <el-select v-model="category" placeholder="选择分类" style="width: 120px">
          <el-option label="技术" value="技术" />
          <el-option label="生活" value="生活" />
          <el-option label="工作" value="工作" />
        </el-select>

        <el-button
          @click="handleSave"
          :loading="saving"
          type="primary"
        >
          保存
        </el-button>

        <el-button @click="handleCancel">取消</el-button>
      </div>
    </div>

    <!-- Markdown 编辑器 -->
    <MarkdownEditor
      v-model="content"
      :auto-save="true"
      @save="handleAutoSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNotesStore } from '@/stores/notes';
import { ElMessage, ElMessageBox } from 'element-plus';
import MarkdownEditor from '@/components/Markdown/MarkdownEditor.vue';

const route = useRoute();
const router = useRouter();
const notesStore = useNotesStore();

// 状态
const title = ref('');
const content = ref('');
const category = ref('技术');
const saving = ref(false);
const isDirty = ref(false);

// 生命周期
onMounted(async () => {
  const noteId = route.params.id as string;
  if (noteId) {
    await notesStore.fetchNoteById(noteId);
    const note = notesStore.currentNote;
    if (note) {
      title.value = note.title;
      content.value = note.content;
      category.value = note.category;
    }
  }
});

// 离开前提示
onBeforeUnmount(() => {
  if (isDirty.value) {
    const confirm = window.confirm('有未保存的更改,确定要离开吗?');
    if (!confirm) {
      return false;
    }
  }
});

// 保存
const handleSave = async () => {
  if (!title.value.trim()) {
    ElMessage.warning('请输入笔记标题');
    return;
  }

  saving.value = true;
  try {
    const noteId = route.params.id as string;
    const noteData = {
      title: title.value,
      content: content.value,
      category: category.value
    };

    if (noteId) {
      await notesStore.updateNote(noteId, noteData);
      ElMessage.success('保存成功');
    } else {
      const newNote = await notesStore.createNote(noteData);
      ElMessage.success('创建成功');
      router.replace(`/notes/${newNote.id}/edit`);
    }

    isDirty.value = false;
  } catch (error) {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

// 自动保存(本地)
const handleAutoSave = (text: string) => {
  isDirty.value = true;
  localStorage.setItem('draft_note', JSON.stringify({
    title: title.value,
    content: text,
    category: category.value,
    timestamp: Date.now()
  }));
};

// 取消
const handleCancel = async () => {
  if (isDirty.value) {
    try {
      await ElMessageBox.confirm(
        '有未保存的更改,确定要取消吗?',
        '提示',
        {
          confirmButtonText: '确定',
          cancelButtonText: '再想想',
          type: 'warning'
        }
      );
      router.push('/notes');
    } catch {
      // 用户取消
    }
  } else {
    router.push('/notes');
  }
};
</script>

<style scoped lang="scss">
.note-editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;

  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid #e4e7ed;
    background: white;

    .title-input {
      flex: 1;

      :deep(.el-input__inner) {
        font-size: 20px;
        font-weight: 600;
      }
    }

    .toolbar-actions {
      display: flex;
      gap: 12px;
    }
  }
}
</style>
```

```vue
<!-- components/Markdown/MarkdownEditor.vue -->
<template>
  <div class="markdown-editor-wrapper">
    <div id="vditor" ref="vditorRef"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

const props = defineProps<{
  modelValue: string;
  autoSave?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  save: [value: string];
}>();

const vditorRef = ref<HTMLElement>();
let vditor: Vditor | null = null;
let autoSaveTimer: NodeJS.Timeout | null = null;

onMounted(() => {
  vditor = new Vditor('vditor', {
    height: 'calc(100vh - 120px)',
    mode: 'wysiwyg', // 所见即所得模式
    placeholder: '开始写作...',
    theme: 'classic',
    toolbar: [
      'emoji',
      'headings',
      'bold',
      'italic',
      'strike',
      '|',
      'line',
      'quote',
      'list',
      'ordered-list',
      'check',
      '|',
      'code',
      'inline-code',
      'insert-before',
      'insert-after',
      '|',
      'upload',
      'link',
      'table',
      '|',
      'undo',
      'redo',
      '|',
      'edit-mode',
      'fullscreen',
      'outline'
    ],
    upload: {
      url: '/api/upload/image', // 图片上传接口
      max: 5 * 1024 * 1024, // 5MB
      accept: 'image/*',
      fieldName: 'file'
    },
    after: () => {
      if (vditor) {
        vditor.setValue(props.modelValue);
      }
    },
    input: (value: string) => {
      emit('update:modelValue', value);

      // 自动保存
      if (props.autoSave) {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
        autoSaveTimer = setTimeout(() => {
          emit('save', value);
        }, 2000);
      }
    }
  });
});

onBeforeUnmount(() => {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  if (vditor) {
    vditor.destroy();
  }
});

// 监听外部值变化
watch(() => props.modelValue, (newValue) => {
  if (vditor && vditor.getValue() !== newValue) {
    vditor.setValue(newValue);
  }
});
</script>

<style scoped lang="scss">
.markdown-editor-wrapper {
  flex: 1;
  overflow: hidden;

  :deep(.vditor) {
    border: none;
  }
}
</style>
```

---

### 5.3 爬虫配置页面(`/crawler/config`)

#### 组件结构
```
CrawlerConfigPage (views/Crawler/Config/index.vue)
├── LoginConfig (登录配置)
│   ├── QrCodeLogin (二维码登录)
│   └── TokenInput (Token 输入)
├── XPathRuleEditor (XPath 规则编辑器)
│   └── RuleCard (规则卡片) × N
├── ConcurrencySettings (并发设置)
└── ActionButtons (操作按钮)
```

#### 伪代码

```vue
<!-- views/Crawler/Config/index.vue -->
<template>
  <div class="crawler-config-page">
    <el-form
      ref="formRef"
      :model="config"
      label-width="120px"
      class="config-form"
    >
      <!-- 登录配置 -->
      <el-card class="config-section" header="登录配置">
        <el-tabs v-model="loginMethod">
          <el-tab-pane label="扫码登录" name="qrcode">
            <QrCodeLogin
              :qr-code-url="qrCodeUrl"
              :status="loginStatus"
              @generate="handleGenerateQrCode"
            />
          </el-tab-pane>

          <el-tab-pane label="Token 登录" name="token">
            <TokenInput
              v-model="config.token"
              @verify="handleVerifyToken"
            />
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- XPath 规则配置 -->
      <el-card class="config-section" header="爬取规则">
        <XPathRuleEditor
          v-model="config.rules"
          @add="handleAddRule"
          @delete="handleDeleteRule"
        />
      </el-card>

      <!-- 并发设置 -->
      <el-card class="config-section" header="并发设置">
        <ConcurrencySettings v-model="config.concurrency" />
      </el-card>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button
          type="primary"
          size="large"
          @click="handleSaveConfig"
          :loading="saving"
        >
          保存配置
        </el-button>

        <el-button
          type="success"
          size="large"
          @click="handleStartCrawler"
          :disabled="!isConfigValid"
        >
          启动爬虫
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCrawlerStore } from '@/stores/crawler';
import { ElMessage } from 'element-plus';
import type { CrawlerConfig, XPathRule } from '@/types/crawler';

const crawlerStore = useCrawlerStore();

// 状态
const loginMethod = ref<'qrcode' | 'token'>('qrcode');
const saving = ref(false);
const config = ref<CrawlerConfig>({
  token: '',
  rules: [],
  concurrency: {
    maxConcurrent: 5,
    requestInterval: 1000
  }
});

// 计算属性
const qrCodeUrl = computed(() => crawlerStore.qrCodeUrl);
const loginStatus = computed(() => crawlerStore.loginStatus);
const isConfigValid = computed(() => {
  return config.value.token && config.value.rules.length > 0;
});

// 生命周期
onMounted(async () => {
  await crawlerStore.fetchConfig();
  if (crawlerStore.config) {
    config.value = { ...crawlerStore.config };
  }
});

// 生成二维码
const handleGenerateQrCode = () => {
  crawlerStore.generateQrCode();
};

// 验证 Token
const handleVerifyToken = async (token: string) => {
  const valid = await crawlerStore.verifyToken(token);
  if (valid) {
    ElMessage.success('Token 验证成功');
  } else {
    ElMessage.error('Token 验证失败,请检查后重试');
  }
};

// 添加规则
const handleAddRule = () => {
  config.value.rules.push({
    id: Date.now().toString(),
    targetUrl: '',
    contentXPath: '',
    linkXPath: '',
    depth: 1,
    enabled: true
  });
};

// 删除规则
const handleDeleteRule = (id: string) => {
  config.value.rules = config.value.rules.filter(r => r.id !== id);
};

// 保存配置
const handleSaveConfig = async () => {
  saving.value = true;
  try {
    await crawlerStore.saveConfig(config.value);
    ElMessage.success('配置保存成功');
  } catch (error) {
    ElMessage.error('配置保存失败');
  } finally {
    saving.value = false;
  }
};

// 启动爬虫
const handleStartCrawler = async () => {
  try {
    // 先保存配置
    await crawlerStore.saveConfig(config.value);
    // 启动爬虫
    await crawlerStore.startCrawler();
    ElMessage.success('爬虫已启动,请前往任务监控页面查看进度');
  } catch (error) {
    ElMessage.error('启动爬虫失败');
  }
};
</script>

<style scoped lang="scss">
.crawler-config-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;

  .config-section {
    margin-bottom: 24px;
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-top: 32px;
  }
}
</style>
```

```vue
<!-- views/Crawler/Config/components/XPathRuleEditor.vue -->
<template>
  <div class="xpath-rule-editor">
    <div class="rules-list">
      <RuleCard
        v-for="(rule, index) in modelValue"
        :key="rule.id"
        :rule="rule"
        :index="index"
        @update="handleUpdateRule"
        @delete="handleDeleteRule"
      />
    </div>

    <el-button
      type="primary"
      :icon="Plus"
      @click="handleAddRule"
      class="add-button"
    >
      添加规则
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue';
import type { XPathRule } from '@/types/crawler';

const props = defineProps<{
  modelValue: XPathRule[];
}>();

const emit = defineEmits<{
  'update:modelValue': [rules: XPathRule[]];
  add: [];
  delete: [id: string];
}>();

const handleUpdateRule = (index: number, updated: XPathRule) => {
  const newRules = [...props.modelValue];
  newRules[index] = updated;
  emit('update:modelValue', newRules);
};

const handleDeleteRule = (id: string) => {
  emit('delete', id);
};

const handleAddRule = () => {
  emit('add');
};
</script>
```

```vue
<!-- views/Crawler/Config/components/RuleCard.vue -->
<template>
  <el-card class="rule-card" :body-style="{ padding: '20px' }">
    <template #header>
      <div class="card-header">
        <span>规则 {{ index + 1 }}</span>
        <div>
          <el-switch
            v-model="localRule.enabled"
            @change="handleUpdate"
          />
          <el-button
            type="danger"
            text
            :icon="Delete"
            @click="handleDelete"
          >
            删除
          </el-button>
        </div>
      </div>
    </template>

    <el-form :model="localRule" label-width="120px">
      <el-form-item label="目标 URL" required>
        <el-input
          v-model="localRule.targetUrl"
          placeholder="https://example.com/page"
          @blur="handleUpdate"
        />
      </el-form-item>

      <el-form-item label="内容 XPath" required>
        <el-input
          v-model="localRule.contentXPath"
          placeholder="//div[@class='content']//text()"
          @blur="handleUpdate"
        >
          <template #append>
            <el-tooltip content="用于提取页面正文内容的 XPath 表达式">
              <el-icon><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="链接 XPath">
        <el-input
          v-model="localRule.linkXPath"
          placeholder="//a[@class='link']/@href"
          @blur="handleUpdate"
        >
          <template #append>
            <el-tooltip content="用于提取需要递归爬取的链接的 XPath 表达式">
              <el-icon><QuestionFilled /></el-icon>
            </el-tooltip>
          </template>
        </el-input>
      </el-form-item>

      <el-form-item label="递归深度">
        <el-input-number
          v-model="localRule.depth"
          :min="1"
          :max="10"
          @change="handleUpdate"
        />
        <span class="help-text">从当前页面开始向下爬取的层级数</span>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Delete, QuestionFilled } from '@element-plus/icons-vue';
import type { XPathRule } from '@/types/crawler';

const props = defineProps<{
  rule: XPathRule;
  index: number;
}>();

const emit = defineEmits<{
  update: [index: number, rule: XPathRule];
  delete: [id: string];
}>();

const localRule = ref<XPathRule>({ ...props.rule });

watch(() => props.rule, (newRule) => {
  localRule.value = { ...newRule };
}, { deep: true });

const handleUpdate = () => {
  emit('update', props.index, localRule.value);
};

const handleDelete = () => {
  emit('delete', props.rule.id);
};
</script>

<style scoped lang="scss">
.rule-card {
  margin-bottom: 16px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .help-text {
    margin-left: 12px;
    color: #909399;
    font-size: 14px;
  }
}
</style>
```

---

### 5.4 知识库检索页面(`/search`)

#### 组件结构
```
SearchPage (views/Search/index.vue)
├── UnifiedSearchBar (统一搜索框)
│   └── SearchModeSwitch (搜索模式切换)
├── FilterSidebar (筛选侧边栏)
│   ├── SourceFilter (来源过滤)
│   └── DateRangeFilter (日期范围)
└── SearchResults (结果列表)
    └── ResultCard (结果卡片) × N
```

#### 伪代码

```vue
<!-- views/Search/index.vue -->
<template>
  <div class="search-page">
    <!-- 搜索栏 -->
    <div class="search-header">
      <UnifiedSearchBar
        v-model="keyword"
        v-model:mode="searchMode"
        @search="handleSearch"
      />
    </div>

    <div class="search-content">
      <!-- 筛选侧边栏 -->
      <FilterSidebar
        v-model:source="sourceFilter"
        v-model:date-range="dateRange"
        @change="handleFilterChange"
      />

      <!-- 搜索结果 -->
      <div class="results-container">
        <!-- 结果统计 -->
        <div v-if="hasSearched" class="result-stats">
          找到 <strong>{{ total }}</strong> 个结果,
          耗时 {{ searchTime }}ms
        </div>

        <!-- 加载中 -->
        <el-skeleton
          v-if="loading"
          :rows="5"
          animated
        />

        <!-- 结果列表 -->
        <SearchResults
          v-else-if="hasResults"
          :results="results"
          :keyword="keyword"
          @click="handleResultClick"
        />

        <!-- 空状态 -->
        <EmptyState
          v-else-if="hasSearched"
          icon="search"
          message="未找到相关结果,试试其他关键词吧"
        />

        <!-- 初始状态 -->
        <div v-else class="search-tips">
          <el-icon :size="64" color="#909399"><Search /></el-icon>
          <p>输入关键词开始搜索</p>
          <div class="search-history" v-if="history.length > 0">
            <h4>搜索历史</h4>
            <el-tag
              v-for="item in history"
              :key="item"
              @click="handleHistoryClick(item)"
              class="history-tag"
            >
              {{ item }}
            </el-tag>
          </div>
        </div>

        <!-- 分页 -->
        <Pagination
          v-if="hasResults"
          :total="total"
          :page="query.page"
          :page-size="query.pageSize"
          @change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSearchStore } from '@/stores/search';
import { Search } from '@element-plus/icons-vue';

const searchStore = useSearchStore();

// 状态
const keyword = ref('');
const searchMode = ref<'fulltext' | 'semantic' | 'hybrid'>('hybrid');
const sourceFilter = ref<'all' | 'note' | 'wiki'>('all');
const dateRange = ref<[Date, Date] | null>(null);
const hasSearched = ref(false);
const searchTime = ref(0);

// 计算属性
const results = computed(() => searchStore.results);
const loading = computed(() => searchStore.loading);
const total = computed(() => searchStore.total);
const query = computed(() => searchStore.query);
const history = computed(() => searchStore.history);
const hasResults = computed(() => results.value.length > 0);

// 搜索
const handleSearch = async () => {
  if (!keyword.value.trim()) return;

  const startTime = Date.now();
  hasSearched.value = true;

  await searchStore.search({
    keyword: keyword.value,
    mode: searchMode.value,
    source: sourceFilter.value,
    dateRange: dateRange.value,
    page: 1
  });

  searchTime.value = Date.now() - startTime;
};

// 筛选变化
const handleFilterChange = () => {
  if (hasSearched.value) {
    handleSearch();
  }
};

// 分页
const handlePageChange = (page: number) => {
  searchStore.search({ page });
};

// 结果点击
const handleResultClick = (result: any) => {
  // 根据来源跳转
  if (result.source === 'note') {
    router.push(`/notes/${result.id}/edit`);
  } else {
    // 打开 Wiki 页面详情
    window.open(result.url, '_blank');
  }
};

// 历史记录点击
const handleHistoryClick = (item: string) => {
  keyword.value = item;
  handleSearch();
};
</script>

<style scoped lang="scss">
.search-page {
  padding: 24px;

  .search-header {
    max-width: 800px;
    margin: 0 auto 32px;
  }

  .search-content {
    display: flex;
    gap: 24px;

    .results-container {
      flex: 1;

      .result-stats {
        margin-bottom: 16px;
        color: #606266;
        font-size: 14px;
      }

      .search-tips {
        text-align: center;
        padding: 80px 0;
        color: #909399;

        .search-history {
          margin-top: 32px;

          h4 {
            margin-bottom: 12px;
            color: #606266;
          }

          .history-tag {
            margin: 0 8px 8px 0;
            cursor: pointer;
          }
        }
      }
    }
  }
}
</style>
```

```vue
<!-- views/Search/components/UnifiedSearchBar.vue -->
<template>
  <div class="unified-search-bar">
    <div class="search-input-wrapper">
      <el-input
        v-model="keyword"
        size="large"
        placeholder="搜索知识库..."
        clearable
        @keyup.enter="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>

        <template #append>
          <el-button
            type="primary"
            @click="handleSearch"
          >
            搜索
          </el-button>
        </template>
      </el-input>
    </div>

    <SearchModeSwitch
      v-model="mode"
      class="mode-switch"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { Search } from '@element-plus/icons-vue';

const props = defineProps<{
  modelValue: string;
  mode: 'fulltext' | 'semantic' | 'hybrid';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:mode': [mode: 'fulltext' | 'semantic' | 'hybrid'];
  search: [];
}>();

const keyword = ref(props.modelValue);
const mode = ref(props.mode);

watch(() => props.modelValue, (val) => {
  keyword.value = val;
});

watch(keyword, (val) => {
  emit('update:modelValue', val);
});

watch(mode, (val) => {
  emit('update:mode', val);
});

const handleSearch = () => {
  emit('search');
};
</script>

<style scoped lang="scss">
.unified-search-bar {
  .search-input-wrapper {
    margin-bottom: 16px;
  }

  .mode-switch {
    display: flex;
    justify-content: center;
  }
}
</style>
```

```vue
<!-- views/Search/components/ResultCard.vue -->
<template>
  <el-card
    class="result-card"
    shadow="hover"
    @click="handleClick"
  >
    <div class="card-header">
      <h3 class="result-title" v-html="highlightedTitle"></h3>
      <div class="meta-info">
        <el-tag :type="getSourceType(result.source)" size="small">
          {{ getSourceLabel(result.source) }}
        </el-tag>
        <span v-if="result.score" class="score">
          相似度: {{ (result.score * 100).toFixed(1) }}%
        </span>
      </div>
    </div>

    <div class="result-excerpt" v-html="highlightedExcerpt"></div>

    <div class="card-footer">
      <span class="date">
        <el-icon><Calendar /></el-icon>
        {{ formatDate(result.updatedAt) }}
      </span>
      <span v-if="result.category" class="category">
        {{ result.category }}
      </span>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SearchResult } from '@/types/search';
import { highlightKeyword } from '@/utils/highlight';
import { formatDate } from '@/utils/format';
import { Calendar } from '@element-plus/icons-vue';

const props = defineProps<{
  result: SearchResult;
  keyword: string;
}>();

const emit = defineEmits<{
  click: [result: SearchResult];
}>();

const highlightedTitle = computed(() => {
  return highlightKeyword(props.result.title, props.keyword);
});

const highlightedExcerpt = computed(() => {
  return highlightKeyword(props.result.excerpt, props.keyword);
});

const handleClick = () => {
  emit('click', props.result);
};

const getSourceType = (source: string) => {
  return source === 'note' ? 'primary' : 'success';
};

const getSourceLabel = (source: string) => {
  return source === 'note' ? '笔记' : 'Wiki';
};
</script>

<style scoped lang="scss">
.result-card {
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;

    .result-title {
      flex: 1;
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #303133;

      :deep(mark) {
        background-color: #ffd700;
        padding: 2px 4px;
        border-radius: 2px;
      }
    }

    .meta-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: 16px;

      .score {
        font-size: 14px;
        color: #67c23a;
        font-weight: 600;
      }
    }
  }

  .result-excerpt {
    color: #606266;
    line-height: 1.6;
    margin-bottom: 16px;

    :deep(mark) {
      background-color: #ffd700;
      padding: 2px 4px;
      border-radius: 2px;
    }
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #909399;
    font-size: 14px;

    .date {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .category {
      padding: 2px 8px;
      background-color: #f4f4f5;
      border-radius: 4px;
    }
  }
}
</style>
```

---

## 6. API 接口设计

### 统一 HTTP 客户端

```typescript
// api/client.ts
import axios from 'axios';
import { ElMessage } from 'element-plus';

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
client.interceptors.request.use(
  (config) => {
    // 添加 Token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
client.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const message = error.response?.data?.message || '请求失败';
    ElMessage.error(message);

    // 401 跳转登录
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default client;
```

### 笔记 API

```typescript
// api/notes.ts
import client from './client';
import type { Note, NoteQuery } from '@/types/note';

export const getNotes = (params: NoteQuery) => {
  return client.get('/notes', { params });
};

export const getNoteById = (id: string): Promise<Note> => {
  return client.get(`/notes/${id}`);
};

export const createNote = (data: Partial<Note>): Promise<Note> => {
  return client.post('/notes', data);
};

export const updateNote = (id: string, data: Partial<Note>): Promise<Note> => {
  return client.put(`/notes/${id}`, data);
};

export const deleteNote = (id: string): Promise<void> => {
  return client.delete(`/notes/${id}`);
};
```

### 爬虫 API

```typescript
// api/crawler.ts
import client from './client';
import type { CrawlerConfig, CrawlerTask } from '@/types/crawler';

export const getConfig = (): Promise<CrawlerConfig> => {
  return client.get('/crawler/config');
};

export const saveConfig = (data: CrawlerConfig): Promise<CrawlerConfig> => {
  return client.post('/crawler/config', data);
};

export const generateQrCode = (): Promise<{ qrCodeUrl: string; sessionId: string }> => {
  return client.post('/crawler/qrcode');
};

export const checkLoginStatus = (sessionId: string): Promise<{ status: string; token?: string }> => {
  return client.get(`/crawler/qrcode/${sessionId}/status`);
};

export const verifyToken = (token: string): Promise<{ valid: boolean }> => {
  return client.post('/crawler/verify-token', { token });
};

export const getTasks = (): Promise<CrawlerTask[]> => {
  return client.get('/crawler/tasks');
};

export const startCrawler = (config: CrawlerConfig): Promise<CrawlerTask> => {
  return client.post('/crawler/start', config);
};

export const stopTask = (taskId: string): Promise<void> => {
  return client.post(`/crawler/tasks/${taskId}/stop`);
};
```

### 搜索 API

```typescript
// api/search.ts
import client from './client';
import type { SearchQuery, SearchResult } from '@/types/search';

export const search = (params: SearchQuery) => {
  return client.get('/kb/search', { params });
};
```

---

## 7. 性能优化方案

### 7.1 长列表虚拟滚动

```vue
<!-- 使用 vue-virtual-scroller -->
<template>
  <RecycleScroller
    class="scroller"
    :items="notes"
    :item-size="120"
    key-field="id"
    v-slot="{ item }"
  >
    <NoteCard :note="item" />
  </RecycleScroller>
</template>

<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
</script>
```

### 7.2 图片懒加载

```vue
<!-- 使用 VueUse 的 useIntersectionObserver -->
<template>
  <img
    ref="imgRef"
    :src="isVisible ? src : placeholder"
    :alt="alt"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useIntersectionObserver } from '@vueuse/core';

const props = defineProps<{
  src: string;
  alt: string;
}>();

const imgRef = ref<HTMLImageElement>();
const isVisible = ref(false);
const placeholder = '/placeholder.png';

useIntersectionObserver(
  imgRef,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      isVisible.value = true;
    }
  }
);
</script>
```

### 7.3 路由懒加载

```typescript
// router/index.ts
const routes = [
  {
    path: '/notes',
    component: () => import('@/views/Notes/index.vue'), // 动态 import
    meta: { title: '笔记管理' }
  }
];
```

### 7.4 防抖与节流

```typescript
// utils/debounce.ts
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout | null = null;

  return function(this: any, ...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

// 使用 VueUse 的 useDebounceFn
import { useDebounceFn } from '@vueuse/core';

const debouncedSearch = useDebounceFn((keyword: string) => {
  // 执行搜索
}, 300);
```

---

## 8. 无障碍设计

### 8.1 语义化 HTML

```vue
<template>
  <div class="app-layout">
    <!-- 使用语义化标签 -->
    <nav class="sidebar" role="navigation" aria-label="主导航">
      <ul>
        <li><a href="/notes">笔记管理</a></li>
      </ul>
    </nav>

    <main class="main-content" role="main" aria-label="主要内容">
      <router-view />
    </main>
  </div>
</template>
```

### 8.2 键盘导航

```vue
<template>
  <div
    tabindex="0"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    <NoteCard :note="note" />
  </div>
</template>
```

### 8.3 ARIA 标签

```vue
<template>
  <button
    aria-label="搜索笔记"
    aria-describedby="search-hint"
    @click="handleSearch"
  >
    <el-icon><Search /></el-icon>
  </button>
  <span id="search-hint" class="sr-only">
    输入关键词搜索笔记标题或内容
  </span>
</template>

<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
```

---

## 9. 类型定义

```typescript
// types/note.ts
export interface Note {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteQuery {
  keyword: string;
  category?: string;
  page: number;
  pageSize: number;
}
```

```typescript
// types/crawler.ts
export interface XPathRule {
  id: string;
  targetUrl: string;
  contentXPath: string;
  linkXPath: string;
  depth: number;
  enabled: boolean;
}

export interface CrawlerConfig {
  token: string;
  rules: XPathRule[];
  concurrency: {
    maxConcurrent: number;
    requestInterval: number;
  };
}

export interface CrawlerTask {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startTime: string;
  endTime?: string;
  progress: {
    total: number;
    completed: number;
    failed: number;
  };
}
```

```typescript
// types/search.ts
export type SearchMode = 'fulltext' | 'semantic' | 'hybrid';

export interface SearchQuery {
  keyword: string;
  mode: SearchMode;
  source: 'all' | 'note' | 'wiki';
  dateRange: [Date, Date] | null;
  page: number;
  pageSize: number;
}

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  source: 'note' | 'wiki';
  url?: string;
  category?: string;
  score?: number; // 相似度评分(0-1)
  updatedAt: string;
}
```

---

## 10. 工具函数

```typescript
// utils/highlight.ts
export function highlightKeyword(text: string, keyword: string): string {
  if (!keyword) return text;

  const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

```typescript
// utils/format.ts
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export function formatDate(date: string | Date): string {
  return dayjs(date).fromNow();
}

export function formatFullDate(date: string | Date): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}
```

---

## 11. 响应式设计

### 断点设置

```scss
// assets/styles/variables.scss
$breakpoint-mobile: 768px;
$breakpoint-tablet: 1024px;
$breakpoint-desktop: 1440px;

@mixin mobile {
  @media (max-width: #{$breakpoint-mobile - 1px}) {
    @content;
  }
}

@mixin tablet {
  @media (min-width: #{$breakpoint-mobile}) and (max-width: #{$breakpoint-tablet - 1px}) {
    @content;
  }
}

@mixin desktop {
  @media (min-width: #{$breakpoint-desktop}) {
    @content;
  }
}
```

### 响应式布局

```vue
<style scoped lang="scss">
.search-content {
  display: flex;
  gap: 24px;

  @include tablet {
    flex-direction: column;
  }

  @include mobile {
    flex-direction: column;
    gap: 16px;
  }
}
</style>
```

---

## 12. 部署与构建

### Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'element-plus': ['element-plus'],
          'vditor': ['vditor']
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

---

## 总结

本设计文档提供了一套完整的 Vue3 知识库管理后台原型,涵盖:

1. **技术栈**: Vue3 + Vite + TypeScript + Pinia + Element Plus
2. **核心页面**: 笔记管理、Markdown 编辑器、爬虫配置、知识库检索
3. **组件化设计**: 高度模块化,易于维护和扩展
4. **性能优化**: 虚拟滚动、懒加载、防抖节流
5. **用户体验**: 响应式设计、无障碍支持、友好的交互反馈
6. **状态管理**: Pinia Store 统一管理应用状态
7. **API 集成**: Axios 统一封装,错误处理完善

### 下一步行动

1. **环境搭建**: 使用 `npm create vite@latest` 初始化项目
2. **依赖安装**: 安装 Vue Router、Pinia、Element Plus、Vditor 等
3. **组件开发**: 按照组件树结构逐步实现各个页面
4. **API 对接**: 与后端接口联调
5. **测试优化**: 单元测试、E2E 测试、性能优化

### 可选增强功能

- **协作编辑**: 使用 WebSocket 实现实时协作
- **版本控制**: 笔记历史版本管理
- **数据可视化**: 使用 ECharts 展示统计数据
- **PWA 支持**: 离线可用,桌面端应用
- **深色模式**: 支持浅色/深色主题切换
