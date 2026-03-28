/**
 * Console 代理模块
 * 劫持 console 对象，在保持控制台输出的同时发送日志到后端
 */

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  module?: string;
  url?: string;
  stack?: string;
  retryCount?: number;
}

export class ConsoleProxy {
  private originalConsole: typeof console;
  private logQueue: LogEntry[] = [];
  private readonly batchSize = 10;
  private readonly flushInterval = 5000;
  private readonly apiEndpoint = '/api/logs';
  private flushTimer: number | null = null;
  private maxQueueSize = 100;
  private isFlushing = false;
  private retryCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 2000, 5000]; // 指数退避

  constructor() {
    this.originalConsole = { ...console };
  }

  /**
   * 获取当前路由/模块名
   */
  private getCurrentModule(): string {
    const path = window.location.pathname;
    const moduleMap: Record<string, string> = {
      '/dashboard': 'Dashboard',
      '/documents': 'Documents',
      '/search': 'Search',
    };
    return moduleMap[path] || path.slice(1) || 'Unknown';
  }

  /**
   * 安全地将参数转换为字符串
   */
  private argsToString(args: unknown[]): string {
    return args.map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'bigint') return `${arg.toString()}n`;
      if (typeof arg === 'function') return '[Function]';
      if (typeof arg === 'symbol') return arg.toString();

      try {
        // 限制序列化深度和长度
        return JSON.stringify(arg, (_key, value) => {
          if (typeof value === 'bigint') return value.toString();
          if (typeof value === 'function') return '[Function]';
          if (typeof value === 'symbol') return value.toString();
          return value;
        }, '  ').slice(0, 500);
      } catch {
        return String(arg);
      }
    }).join(' ');
  }

  /**
   * 获取错误堆栈
   */
  private getStack(error?: Error): string | undefined {
    if (!error || !error.stack) return undefined;
    // 只保留堆栈的前几行
    const lines = error.stack.split('\n').slice(0, 5);
    return lines.join('\n');
  }

  /**
   * 添加日志到队列
   */
  private enqueue(level: LogEntry['level'], message: string, error?: Error): void {
    // 队列已满，移除最旧的日志
    if (this.logQueue.length >= this.maxQueueSize) {
      this.logQueue.shift();
    }

    const entry: LogEntry = {
      level,
      message: typeof message === 'string' ? message : String(message),
      module: this.getCurrentModule(),
      url: window.location.pathname,
    };

    if (error) {
      entry.stack = this.getStack(error);
    }

    this.logQueue.push(entry);

    // 达到批量大小时立即发送
    if (this.logQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * 备份日志到 localStorage
   */
  private backupLogsToStorage(logs: LogEntry[]): void {
    try {
      const backedUp = localStorage.getItem('failedLogs') || '[]';
      const allLogs = [...JSON.parse(backedUp), ...logs].slice(-100);
      localStorage.setItem('failedLogs', JSON.stringify(allLogs));
    } catch (e) {
      // localStorage 可能已满或不可用
      console.warn('无法备份日志到 localStorage:', e);
    }
  }

  /**
   * 从 localStorage 恢复日志
   */
  private restoreLogsFromStorage(): LogEntry[] {
    try {
      const backedUp = localStorage.getItem('failedLogs');
      if (backedUp) {
        localStorage.removeItem('failedLogs');
        return JSON.parse(backedUp);
      }
    } catch (e) {
      // 忽略解析错误
    }
    return [];
  }

  /**
   * 发送队列中的日志到后端
   */
  private async flush(): Promise<void> {
    if (this.isFlushing || this.logQueue.length === 0) {
      return;
    }

    this.isFlushing = true;

    // 恢复之前失败的日志
    const restoredLogs = this.restoreLogsFromStorage();
    if (restoredLogs.length > 0) {
      this.logQueue.unshift(...restoredLogs);
    }

    // 只发送一批日志
    const logsToSend = this.logQueue.splice(0, Math.min(this.batchSize, this.logQueue.length));

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsToSend }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      await response.json();
      // 成功发送，重置重试计数
      this.retryCount = 0;
    } catch (error) {
      // 失败时增加重试计数
      this.retryCount++;

      // 如果重试次数未超限，放回队列前面
      if (this.retryCount <= this.maxRetries) {
        logsToSend.forEach(log => {
          log.retryCount = (log.retryCount || 0) + 1;
        });
        this.logQueue.unshift(...logsToSend);

        // 使用指数退避重试
        const delay = this.retryDelays[Math.min(this.retryCount - 1, this.retryDelays.length - 1)];
        setTimeout(() => {
          this.isFlushing = false;
          this.flush();
        }, delay);
        return;
      } else {
        // 超过重试次数，备份到 localStorage
        this.backupLogsToStorage(logsToSend);
        this.retryCount = 0;
      }
    } finally {
      if (this.retryCount === 0) {
        this.isFlushing = false;
      }
    }
  }

  /**
   * 使用 sendBeacon 发送日志（页面卸载时）
   */
  private sendBeacon(): void {
    if (this.logQueue.length === 0) return;

    // 恢复之前失败的日志
    const restoredLogs = this.restoreLogsFromStorage();
    if (restoredLogs.length > 0) {
      this.logQueue.unshift(...restoredLogs);
    }

    const data = JSON.stringify({ logs: this.logQueue });
    const blob = new Blob([data], { type: 'application/json' });

    // sendBeacon 返回 boolean 表示是否成功
    const success = navigator.sendBeacon(this.apiEndpoint, blob);

    if (!success) {
      // 失败时备份到 localStorage
      this.backupLogsToStorage(this.logQueue);
    } else {
      this.logQueue = [];
    }
  }

  /**
   * 安装代理
   */
  intercept(): void {
    const self = this;

    // 统一的代理函数
    function createProxy(method: 'log' | 'info' | 'warn' | 'error' | 'debug', level: LogEntry['level']) {
      console[method] = function (...args: unknown[]) {
        // 调用原始 console 方法
        self.originalConsole[method](...args);

        // 提取消息
        const message = self.argsToString(args);

        // 对于 error 级别，尝试提取 Error 对象
        const error = level === 'error'
          ? args.find(arg => arg instanceof Error) as Error
          : undefined;

        self.enqueue(level, message, error);
      };
    }

    // 为每个 console 方法创建代理
    createProxy('log', 'info');
    createProxy('info', 'info');
    createProxy('warn', 'warn');
    createProxy('error', 'error');
    createProxy('debug', 'debug');

    // 定期刷新日志队列
    this.flushTimer = window.setInterval(() => {
      if (!this.isFlushing) {
        this.flush();
      }
    }, this.flushInterval);

    // 页面卸载时发送剩余日志
    window.addEventListener('beforeunload', () => {
      this.sendBeacon();
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
    });

    // 页面隐藏时也发送日志
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.isFlushing) {
        this.flush();
      }
    });
  }

  /**
   * 移除代理
   */
  restore(): void {
    // 只恢复我们代理的方法
    const methods: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = ['log', 'info', 'warn', 'error', 'debug'];
    methods.forEach(method => {
      console[method] = this.originalConsole[method] as any;
    });

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 手动触发日志发送
   */
  triggerFlush(): void {
    if (!this.isFlushing) {
      this.flush();
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): { queueSize: number; isFlushing: boolean; retryCount: number } {
    return {
      queueSize: this.logQueue.length,
      isFlushing: this.isFlushing,
      retryCount: this.retryCount,
    };
  }
}

// 单例实例
let consoleProxyInstance: ConsoleProxy | null = null;

/**
 * 设置控制台代理
 */
export function setupConsoleProxy(): ConsoleProxy {
  if (!consoleProxyInstance) {
    consoleProxyInstance = new ConsoleProxy();
    consoleProxyInstance.intercept();
  }
  return consoleProxyInstance;
}

/**
 * 移除控制台代理
 */
export function teardownConsoleProxy(): void {
  if (consoleProxyInstance) {
    consoleProxyInstance.restore();
    consoleProxyInstance = null;
  }
}

/**
 * 手动触发日志发送
 */
export function flushLogs(): void {
  consoleProxyInstance?.triggerFlush();
}

/**
 * 获取日志统计信息
 */
export function getLogStats(): ReturnType<ConsoleProxy['getStats']> | null {
  return consoleProxyInstance?.getStats() || null;
}
