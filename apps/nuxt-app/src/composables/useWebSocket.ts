/**
 * WebSocket Composable
 * 管理 WebSocket 连接和消息处理
 */

import { computed, ref } from 'vue'
import { useRuntimeConfig } from 'nuxt/app'

// 浏览器环境日志工具
const logger = {
  debug: (...args: unknown[]) => console.debug('[useWebSocket]', ...args),
  info: (...args: unknown[]) => console.info('[useWebSocket]', ...args),
  warn: (...args: unknown[]) => console.warn('[useWebSocket]', ...args),
  error: (...args: unknown[]) => console.error('[useWebSocket]', ...args),
}

export interface WebSocketMessage<T = unknown> {
  type: string
  data: T
}

export type WebSocketMessageType =
  | 'crawler:task:created'
  | 'crawler:task:updated'
  | 'crawler:task:deleted'
  | 'crawler:page:status'
  | 'connected'
  | 'ping'
  | 'pong'

export type WebSocketMessageHandler<T = unknown> = (data: T) => void

// 全局 WebSocket 状态（跨组件共享）
const globalWs = ref<WebSocket | null>(null)
const globalIsConnected = ref(false)
const globalReconnectAttempts = ref(0)
const globalHandlers = new Map<string, Map<symbol, WebSocketMessageHandler>>()

const maxReconnectAttempts = 5
const reconnectDelay = 3000

// 心跳相关状态
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let lastPongTime = 0
const HEARTBEAT_INTERVAL = 30000  // 30 秒
const PONG_TIMEOUT = 10000  // 10 秒内未收到 pong 视为连接失败

/**
 * 获取 WebSocket readyState 的文本描述
 */
function getReadyStateText(state?: number): string {
  if (state === undefined) return 'undefined'
  switch (state) {
    case WebSocket.CONNECTING: return 'CONNECTING (0)'
    case WebSocket.OPEN: return 'OPEN (1)'
    case WebSocket.CLOSING: return 'CLOSING (2)'
    case WebSocket.CLOSED: return 'CLOSED (3)'
    default: return `UNKNOWN (${state})`
  }
}

/**
 * 启动心跳检测
 */
function startHeartbeat() {
  stopHeartbeat()  // 先清理旧的 timer

  heartbeatTimer = setInterval(() => {
    if (!globalWs.value || globalWs.value.readyState !== WebSocket.OPEN) {
      logger.warn('WebSocket 未连接，停止心跳')
      stopHeartbeat()
      return
    }

    try {
      globalWs.value.send(JSON.stringify({ type: 'ping', data: {} }))
      logger.debug('发送心跳 ping')

      // 设置 pong 超时检查
      setTimeout(() => {
        const now = Date.now()
        if (now - lastPongTime > PONG_TIMEOUT && lastPongTime > 0) {
          logger.error('心跳超时，未收到 pong 响应', {
            lastPongTime,
            elapsed: now - lastPongTime,
          })
          // 触发重连
          disconnect()
          connect()
        }
      }, PONG_TIMEOUT)
    } catch (error) {
      logger.error('发送心跳失败', error as Error)
      // 触发重连
      disconnect()
      connect()
    }
  }, HEARTBEAT_INTERVAL)

  logger.info('心跳检测已启动', { interval: HEARTBEAT_INTERVAL })
}

/**
 * 停止心跳检测
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    logger.debug('心跳检测已停止')
  }
}

/**
 * 连接 WebSocket
 */
function connect() {
  if (import.meta.server) {
    logger.debug('服务端环境跳过 WebSocket 连接')
    return
  }

  if (globalWs.value && globalWs.value.readyState === WebSocket.OPEN) {
    logger.debug('WebSocket 已连接，跳过重复连接')
    return
  }

  // 优先使用运行时配置，否则使用当前端口
  const runtimeConfig = useRuntimeConfig()
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const runtimeWsUrl = typeof runtimeConfig.public.wsUrl === 'string' ? runtimeConfig.public.wsUrl : ''
  const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
  // Nitro WebSocket 路由: /_ws/{route} 其中 route 是 server/routes/ 下的文件名
  const wsUrl = runtimeWsUrl || `${protocol}//${window.location.hostname}:${port}/_ws/ws`

  // 验证 WebSocket URL 格式
  try {
    const url = new URL(wsUrl)
    if (!['ws:', 'wss:'].includes(url.protocol)) {
      logger.error('无效的 WebSocket URL 协议', { wsUrl, protocol: url.protocol })
      return
    }
  } catch (error) {
    logger.error('无效的 WebSocket URL', { wsUrl, error })
    return
  }

  logger.info('正在连接 WebSocket', { wsUrl })

  try {
    logger.info('创建 WebSocket 连接', { wsUrl, readyState: 'CONNECTING' })
    globalWs.value = new WebSocket(wsUrl)

    // 添加连接超时检查
    const connectionTimeout = setTimeout(() => {
      if (globalWs.value && globalWs.value.readyState !== WebSocket.OPEN) {
        logger.error('WebSocket 连接超时', {
          url: wsUrl,
          readyState: globalWs.value.readyState,
          readyStateText: getReadyStateText(globalWs.value.readyState),
        })
      }
    }, 5000) // 5 秒超时

    globalWs.value.onopen = () => {
      clearTimeout(connectionTimeout)

      // onopen 触发时 readyState 保证是 OPEN，无需检查
      logger.info('WebSocket 已连接', {
        url: wsUrl,
        readyState: globalWs.value.readyState,
        readyStateText: getReadyStateText(globalWs.value.readyState),
      })

      globalIsConnected.value = true
      globalReconnectAttempts.value = 0
      lastPongTime = Date.now()  // 初始化 pong 时间

      // 启动心跳
      startHeartbeat()

      // 发送初始 ping
      try {
        globalWs.value.send(JSON.stringify({ type: 'ping', data: {} }))
        logger.debug('已发送初始 ping 消息')
      } catch (error) {
        logger.error('发送初始 ping 失败', error as Error)
        globalIsConnected.value = false
      }
    }

    globalWs.value.onclose = (event: CloseEvent) => {
      logger.info('WebSocket 已断开', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })

      globalIsConnected.value = false
      stopHeartbeat()  // 停止心跳

      // 尝试重连
      if (globalReconnectAttempts.value < maxReconnectAttempts) {
        globalReconnectAttempts.value++
        logger.info(`尝试重连 WebSocket (${globalReconnectAttempts.value}/${maxReconnectAttempts})`)
        setTimeout(connect, reconnectDelay)
      } else {
        logger.error('WebSocket 重连失败，已达到最大重试次数')
      }
    }

    globalWs.value.onerror = (error: Event) => {
      logger.error('WebSocket 错误', {
        type: error.type,
        url: globalWs.value?.url,
        readyState: globalWs.value?.readyState,
        readyStateText: globalWs.value ? getReadyStateText(globalWs.value.readyState) : 'no connection',
      })

      globalIsConnected.value = false
      stopHeartbeat()  // 停止心跳
    }

    globalWs.value.onmessage = (event: MessageEvent<string>) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)

        // 显式处理 pong 响应
        if (message.type === 'pong') {
          lastPongTime = Date.now()
          logger.debug('收到 pong 响应', { timestamp: lastPongTime })
          return  // 不分发到业务处理器
        }

        // 显式处理 connected 消息
        if (message.type === 'connected') {
          logger.info('服务器确认连接', message.data)
          return
        }

        logger.debug('收到 WebSocket 消息', { type: message.type })
        handleMessage(message)
      } catch (error) {
        logger.error('解析 WebSocket 消息失败', error as Error)
      }
    }
  } catch (error) {
    logger.error('创建 WebSocket 连接失败', error as Error)
  }
}

/**
 * 断开 WebSocket 连接
 */
function disconnect() {
  stopHeartbeat()  // 停止心跳

  if (globalWs.value) {
    logger.info('断开 WebSocket 连接')
    globalWs.value.close()
    globalWs.value = null
    globalIsConnected.value = false
  }
}

/**
 * 处理收到的消息
 */
function handleMessage(message: WebSocketMessage) {
  const { type, data } = message
  const handlers = globalHandlers.get(type)

  if (handlers) {
    handlers.forEach((handler, id) => {
      try {
        handler(data)
      } catch (error) {
        logger.error('WebSocket 消息处理器错误', error as Error, { type, handlerId: id.toString() })
      }
    })
  } else {
    logger.debug('未找到消息类型处理器', { type })
  }
}

/**
 * 注册消息处理器
 * @returns 处理器 ID，用于后续取消注册
 */
function on<T = unknown>(type: string, handler: WebSocketMessageHandler<T>): symbol {
  const id = Symbol('ws-handler')

  if (!globalHandlers.has(type)) {
    globalHandlers.set(type, new Map())
  }

  globalHandlers.get(type)!.set(id, handler as WebSocketMessageHandler)

  logger.debug('注册 WebSocket 处理器', { type, handlerId: id.toString(), handlerCount: globalHandlers.get(type)!.size })

  // 如果尚未连接，自动连接
  if (!globalWs.value || globalWs.value.readyState !== WebSocket.OPEN) {
    connect()
  }

  return id
}

/**
 * 取消注册消息处理器
 */
function off(type: string, id: symbol): void {
  const handlers = globalHandlers.get(type)
  if (handlers && handlers.has(id)) {
    handlers.delete(id)
    logger.debug('取消注册 WebSocket 处理器', { type, handlerId: id.toString(), remainingCount: handlers.size })

    if (handlers.size === 0) {
      globalHandlers.delete(type)
    }
  }
}

export function useWebSocket() {
  return {
    isConnected: computed(() => globalIsConnected.value),
    connect,
    disconnect,
    on,
    off,
    // 添加调试方法
    getConnectionInfo: () => ({
      isConnected: globalIsConnected.value,
      readyState: globalWs.value ? getReadyStateText(globalWs.value.readyState) : 'no connection',
      url: globalWs.value?.url || 'no url',
      heartbeatActive: heartbeatTimer !== null,
      lastPongTime: lastPongTime > 0 ? new Date(lastPongTime).toISOString() : 'never',
    }),
  }
}
