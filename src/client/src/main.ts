import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import naive from 'naive-ui';
import App from './App.vue';
import Dashboard from './views/Dashboard.vue';
import Search from './views/Search.vue';
import NotesList from './features/documents/components/NotesList.vue';
import NoteEditor from './features/documents/components/NoteEditor.vue';
import TagsManager from './features/documents/components/TagsManager.vue';
import DocumentsSearch from './features/documents/components/Search.vue';
import { loggerPlugin } from './plugins/loggerPlugin.js';

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: Dashboard },
  { path: '/documents', component: NotesList },
  { path: '/documents/new', component: NoteEditor },
  { path: '/documents/tags/manage', component: TagsManager },
  { path: '/documents/search', component: DocumentsSearch },
  { path: '/documents/:id', component: NoteEditor },  // 动态路由放最后
  { path: '/search', component: Search }, // 旧的搜索页面（保留兼容）
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const app = createApp(App);

// 安装日志插件（在 mount 之前）
app.use(loggerPlugin);

app.use(naive);
app.use(router);
app.mount('#app');
