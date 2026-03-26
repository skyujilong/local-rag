/**
 * Vue 日志插件
 * 在 Vue 应用生命周期中管理日志系统
 */

import type { App, InjectionKey } from 'vue';
import { setupConsoleProxy, teardownConsoleProxy, flushLogs, getLogStats, type ConsoleProxy } from '../utils/consoleProxy.js';
import { setupErrorHandler, linkErrorHandlerToConsoleProxy, createVueErrorHandler } from '../utils/errorHandler.js';

export const loggerPluginKey: InjectionKey<LoggerPluginApi> = Symbol('loggerPlugin');

interface LoggerPluginApi {
  flush: () => void;
  getStats: () => { queueSize: number; isFlushing: boolean; retryCount: number } | null;
}

export const loggerPlugin = {
  install(app: App) {
    // 设置控制台代理
    const consoleProxy = setupConsoleProxy();

    // 设置全局错误处理
    const errorHandler = setupErrorHandler();

    // 链接错误处理器到控制台代理
    linkErrorHandlerToConsoleProxy(consoleProxy);

    // 设置 Vue 错误处理器
    app.config.errorHandler = createVueErrorHandler();

    // 提供日志 API 给全局属性
    const api: LoggerPluginApi = {
      flush: () => {
        flushLogs();
      },
      getStats: () => {
        return getLogStats();
      },
    };

    // 挂载到 app 实例上
    app.config.globalProperties.$logger = api;

    // 提供 API 供组合式 API 使用
    app.provide(loggerPluginKey, api);

    // 在应用卸载时清理
    const originalUnmount = app.unmount;
    app.unmount = () => {
      flushLogs();
      teardownConsoleProxy();
      originalUnmount.call(app);
    };
  },
};

/**
 * 从 Vue 应用实例获取日志 API
 * 用于组合式 API 中
 */
export function useLogger(): LoggerPluginApi | null {
  // 这个函数需要在 Vue 组件的 setup 中调用
  // 由于我们不能直接访问 inject，这里返回 null
  // 实际使用时应该使用 inject(loggerPluginKey)
  return null;
}

// 导出类型以便在 Vue 组件中使用
declare module 'vue' {
  export interface ComponentCustomProperties {
    $logger: LoggerPluginApi;
  }
}

// 重新导出供外部使用
export { flushLogs, getLogStats };
