import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import naive from 'naive-ui';
import App from './App.vue';
import Dashboard from './views/Dashboard.vue';
import Documents from './views/Documents.vue';
import Search from './views/Search.vue';

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
app.use(naive);
app.use(router);
app.mount('#app');
