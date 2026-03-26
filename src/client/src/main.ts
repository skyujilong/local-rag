import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import naive from 'naive-ui';
import App from './App.vue';
import Dashboard from './views/Dashboard.vue';
import Documents from './views/Documents.vue';
import Search from './views/Search.vue';
import { loggerPlugin } from './plugins/loggerPlugin.js';

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: Dashboard },
  { path: '/documents', component: Documents },
  { path: '/search', component: Search },
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
