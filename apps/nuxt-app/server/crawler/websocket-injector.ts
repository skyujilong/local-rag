/**
 * WebSocket 注入器
 * 向 Playwright 打开的页面注入 WebSocket 客户端
 */

import { createLogger, LogSystem } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'websocket-injector');

export interface WebSocketInjectorConfig {
  wsUrl: string;
  taskId: string;
}

/**
 * 创建 WebSocket 注入脚本
 * 这个脚本会在 Playwright 打开的页面中执行
 */
export function createWebSocketInjectScript(config: WebSocketInjectorConfig): string {
  const script = `
    (function() {
      try {
        // 防止重复注入
        if (window.__crawlerWebSocketInjected) {
          console.log('[Crawler WebSocket] 已注入，跳过重复注入');
          return;
        }
        window.__crawlerWebSocketInjected = true;

        const taskId = '${config.taskId}';
        let ws;

        // 尝试创建 WebSocket 连接
        try {
          ws = new WebSocket('${config.wsUrl}');
        } catch (error) {
          console.error('[Crawler WebSocket] 创建 WebSocket 失败:', error);
          return;  // 提前退出，不影响页面其他功能
        }

        // 连接成功
        ws.onopen = () => {
          console.log('[Crawler WebSocket] 已连接到服务器');
          try {
            ws.send(JSON.stringify({
              type: 'crawler:page:connected',
              data: {
                taskId,
                url: window.location.href,
                timestamp: Date.now()
              }
            }));
          } catch (error) {
            console.error('[Crawler WebSocket] 发送连接消息失败:', error);
          }
        };

        // 监听消息
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('[Crawler WebSocket] 收到消息:', message.type);
          } catch (error) {
            console.error('[Crawler WebSocket] 解析消息失败:', error);
          }
        };

        // 连接错误
        ws.onerror = (error) => {
          console.error('[Crawler WebSocket] 连接错误:', error);
        };

        // 连接关闭
        ws.onclose = (event) => {
          console.log('[Crawler WebSocket] 连接已关闭:', event.code, event.reason);
        };

        // 监听页面导航
        let lastUrl = window.location.href;
        const checkNavigation = () => {
          if (window.location.href !== lastUrl) {
            const oldUrl = lastUrl;
            lastUrl = window.location.href;
            console.log('[Crawler WebSocket] 页面导航:', oldUrl, '->', lastUrl);

            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({
                  type: 'crawler:page:navigated',
                  data: {
                    taskId,
                    url: lastUrl,
                    timestamp: Date.now()
                  }
                }));
              } catch (error) {
                console.error('[Crawler WebSocket] 发送导航消息失败:', error);
              }
            }
          }
        };

        // 使用多种方式监听导航
        // 1. popstate 事件（前进/后退）
        window.addEventListener('popstate', checkNavigation);

        // 2. pushState/replaceState 拦截
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function(...args) {
          originalPushState.apply(this, args);
          checkNavigation();
        };

        history.replaceState = function(...args) {
          originalReplaceState.apply(this, args);
          checkNavigation();
        };

        // 3. MutationObserver 监听 DOM 变化（单页应用）
        let rafId = null;
        let observer = null;

        const initObserver = () => {
          if (!document.body) {
            console.warn('[Crawler WebSocket] document.body 不存在，跳过 MutationObserver 初始化');
            return;
          }

          observer = new MutationObserver(() => {
            // 使用 requestAnimationFrame 节流，避免频繁调用
            if (rafId !== null) {
              cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(() => {
              checkNavigation();
              rafId = null;
            });
          });

          observer.observe(document.body, {
            subtree: true,
            childList: true,
          });
          console.log('[Crawler WebSocket] MutationObserver 已初始化');
        };

        // 等待 DOM 就绪后初始化 observer
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initObserver);
        } else {
          // DOM 已经加载完成
          initObserver();
        }

        // 4. 页面卸载时通知并清理资源
        window.addEventListener('beforeunload', () => {
          try {
            // 清理 MutationObserver
            if (rafId !== null) {
              cancelAnimationFrame(rafId);
            }
            if (observer) {
              observer.disconnect();
            }

            // 恢复 history API
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;

            // 发送卸载通知
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'crawler:page:unloading',
                data: { taskId, url: window.location.href }
              }));
            }

            // 关闭 WebSocket
            ws.close();

            console.log('[Crawler WebSocket] 资源已清理');
          } catch (error) {
            console.error('[Crawler WebSocket] 清理资源失败:', error);
          }
        });

        // 暴露到全局，方便调试
        window.__crawlerWebSocket = ws;
        console.log('[Crawler WebSocket] 初始化完成');
      } catch (error) {
        // 捕获所有未处理的异常
        console.error('[Crawler WebSocket] 初始化失败:', error);
        // 确保标记为已尝试注入，避免重复尝试
        window.__crawlerWebSocketInjected = true;
      }
    })();
  `;

  logger.debug('创建 WebSocket 注入脚本', {
    wsUrl: config.wsUrl,
    taskId: config.taskId,
    scriptLength: script.length,
  });

  return script;
}
