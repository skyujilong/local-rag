/**
 * Vue 应用入口
 */

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import naive from 'naive-ui';
import { darkTheme } from 'naive-ui';
import App from './App.vue';
import router from './router';
import { lightThemeOverrides, darkThemeOverrides } from './theme';
import { setupMessage } from './utils/message';

const app = createApp(App);
const pinia = createPinia();

// 初始化消息提示
setupMessage();

app.use(pinia);
app.use(router);
app.use(naive);

// 主题配置到全局属性，供组件使用
app.config.globalProperties.$naiveDarkTheme = darkTheme;
app.config.globalProperties.$naiveLightThemeOverrides = lightThemeOverrides;
app.config.globalProperties.$naiveDarkThemeOverrides = darkThemeOverrides;

app.mount('#app');
