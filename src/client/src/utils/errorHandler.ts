/**
 * 全局错误处理器
 * 捕获未处理的错误和 Promise 拒绝
 */

type ErrorCallback = (error: Error, context?: string) => void;

class ErrorHandler {
  private callbacks: ErrorCallback[] = [];
  private consoleProxy: any = null;

  constructor() {
    this.setupGlobalHandlers();
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalHandlers(): void {
    // 捕获未处理的错误
    window.addEventListener('error', (event) => {
      this.handleError(
        new Error(event.message),
        `window.error at ${event.filename}:${event.lineno}`
      );
    });

    // 捕获未处理的 Promise 拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        'unhandledrejection'
      );
    });
  }

  /**
   * 设置控制台代理引用
   */
  setConsoleProxy(proxy: any): void {
    this.consoleProxy = proxy;
  }

  /**
   * 处理错误
   */
  private handleError(error: Error, context?: string): void {
    const message = context ? `${context}: ${error.message}` : error.message;

    // 输出到控制台
    console.error(message, error);

    // 发送到后端日志系统
    if (this.consoleProxy && typeof this.consoleProxy.enqueue === 'function') {
      try {
        this.consoleProxy.enqueue('error', message, error);
      } catch (e) {
        // 如果发送失败，只记录到控制台
        console.warn('发送错误日志失败:', e);
      }
    }

    // 通知所有注册的回调
    for (const callback of this.callbacks) {
      try {
        callback(error, context);
      } catch (err) {
        console.error('Error in error callback:', err);
      }
    }
  }

  /**
   * 注册错误回调
   */
  onError(callback: ErrorCallback): () => void {
    this.callbacks.push(callback);
    // 返回取消注册函数
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }
}

// 单例实例
let errorHandlerInstance: ErrorHandler | null = null;

/**
 * 初始化全局错误处理
 */
export function setupErrorHandler(): ErrorHandler {
  if (!errorHandlerInstance) {
    errorHandlerInstance = new ErrorHandler();
  }
  return errorHandlerInstance;
}

/**
 * 设置控制台代理到错误处理器
 */
export function linkErrorHandlerToConsoleProxy(consoleProxy: any): void {
  if (errorHandlerInstance) {
    errorHandlerInstance.setConsoleProxy(consoleProxy);
  }
}

/**
 * Vue 错误处理器工厂
 * 返回可用于 app.config.errorHandler 的函数
 */
export function createVueErrorHandler(): (error: unknown, instance: any, info: string) => void {
  return (error: unknown, instance: any, info: string) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = `Vue error: ${info}`;
    console.error(message, err);

    // 发送到后端日志系统
    if (errorHandlerInstance) {
      try {
        // 直接使用 console 输出，会被控制台代理捕获
        console.error(`[Vue] ${info}`, err);
      } catch (e) {
        // 忽略
      }
    }
  };
}
