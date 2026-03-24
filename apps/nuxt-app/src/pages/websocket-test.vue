<template>
  <div class="websocket-test">
    <h1>🔌 WebSocket 连接测试</h1>

    <div class="info-box">
      <strong>测试目的:</strong> 验证前端能否成功连接到后端 WebSocket 服务器<br>
      <strong>预期 URL:</strong> <code>ws://localhost:3000/_ws/ws</code>
    </div>

    <div class="test-section">
      <div :class="['status', statusClass]">状态: {{ statusText }}</div>
      <n-space>
        <n-button @click="connect" :disabled="isConnected" type="primary">
          连接
        </n-button>
        <n-button @click="disconnect" :disabled="!isConnected">
          断开
        </n-button>
        <n-button @click="clearLog">
          清空日志
        </n-button>
      </n-space>
    </div>

    <div class="test-section">
      <h3>连接信息</h3>
      <n-descriptions bordered :column="1">
        <n-descriptions-item label="URL">
          <n-code :code="connectionInfo.url || '未连接'" language="text" />
        </n-descriptions-item>
        <n-descriptions-item label="ReadyState">
          <n-code :code="connectionInfo.readyState || '-'" language="text" />
        </n-descriptions-item>
        <n-descriptions-item label="Protocol">
          <n-code :code="connectionInfo.protocol || '-'" language="text" />
        </n-descriptions-item>
      </n-descriptions>
    </div>

    <div class="test-section">
      <h3>日志</h3>
      <div class="log-container">
        <div v-for="(entry, index) in logs" :key="index" :class="['log-entry', `log-${entry.type}`]">
          <span class="log-time">[{{ entry.time }}]</span>
          <span>{{ entry.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface LogEntry {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warn'
}

const ws = ref<WebSocket | null>(null)
const logs = ref<LogEntry[]>([])
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 5

const isConnected = computed(() => ws.value?.readyState === WebSocket.OPEN)
const statusText = computed(() => {
  if (!ws.value) return '未连接'
  switch (ws.value.readyState) {
    case WebSocket.CONNECTING: return '连接中...'
    case WebSocket.OPEN: return '已连接'
    case WebSocket.CLOSING: return '断开中...'
    case WebSocket.CLOSED: return '已断开'
    default: return '未知状态'
  }
})

const statusClass = computed(() => {
  if (!ws.value) return 'disconnected'
  switch (ws.value.readyState) {
    case WebSocket.CONNECTING: return 'connecting'
    case WebSocket.OPEN: return 'connected'
    case WebSocket.CLOSING: return 'connecting'
    case WebSocket.CLOSED: return 'disconnected'
    default: return 'disconnected'
  }
})

const connectionInfo = computed(() => {
  if (!ws.value) {
    return { url: '', readyState: '', protocol: '' }
  }
  return {
    url: ws.value.url,
    readyState: getReadyStateText(ws.value.readyState),
    protocol: ws.value.protocol || '-',
  }
})

function getReadyStateText(state: number): string {
  switch (state) {
    case WebSocket.CONNECTING: return 'CONNECTING (0)'
    case WebSocket.OPEN: return 'OPEN (1)'
    case WebSocket.CLOSING: return 'CLOSING (2)'
    case WebSocket.CLOSED: return 'CLOSED (3)'
    default: return `UNKNOWN (${state})`
  }
}

function addLog(message: string, type: LogEntry['type'] = 'info') {
  const time = new Date().toLocaleTimeString('zh-CN')
  logs.value.push({ time, message, type })
  console.log(`[WebSocket Test] ${message}`)
  // 自动滚动到底部
  setTimeout(() => {
    const container = document.querySelector('.log-container')
    if (container) container.scrollTop = (container as HTMLElement).scrollHeight
  }, 0)
}

function connect() {
  if (ws.value && (ws.value.readyState === WebSocket.CONNECTING || ws.value.readyState === WebSocket.OPEN)) {
    addLog('WebSocket 已连接或正在连接中', 'warn')
    return
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const hostname = window.location.hostname
  const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')
  const wsUrl = `${protocol}//${hostname}:${port}/_ws/ws`

  addLog(`正在连接 WebSocket: ${wsUrl}`, 'info')

  try {
    ws.value = new WebSocket(wsUrl)

    // 连接超时检测
    const connectionTimeout = setTimeout(() => {
      if (ws.value && ws.value.readyState !== WebSocket.OPEN) {
        addLog('⚠️ WebSocket 连接超时（5秒）', 'error')
        addLog(`当前状态: ${getReadyStateText(ws.value.readyState)}`, 'warn')
      }
    }, 5000)

    ws.value.onopen = () => {
      clearTimeout(connectionTimeout)
      addLog('✅ WebSocket 已连接', 'success')
      addLog(`URL: ${wsUrl}`, 'info')
      addLog(`ReadyState: ${getReadyStateText(ws.value!.readyState)}`, 'info')
      reconnectAttempts.value = 0
    }

    ws.value.onclose = (event: CloseEvent) => {
      addLog(`❌ WebSocket 已断开`, 'error')
      addLog(`代码: ${event.code}, 原因: ${event.reason || '无'}`, 'info')
      addLog(`是否正常关闭: ${event.wasClean}`, 'info')

      // 尝试重连
      if (reconnectAttempts.value < maxReconnectAttempts) {
        reconnectAttempts.value++
        addLog(`尝试重连 (${reconnectAttempts.value}/${maxReconnectAttempts})...`, 'warn')
        setTimeout(connect, 3000)
      } else {
        addLog('❌ 已达到最大重试次数', 'error')
      }
    }

    ws.value.onerror = (error: Event) => {
      addLog(`❌ WebSocket 错误: ${error.type || '未知错误'}`, 'error')
      addLog('请检查:', 'warn')
      addLog('1. 开发服务器是否正在运行（npm run dev）', 'info')
      addLog('2. 服务器端口是否正确（应该是 3000）', 'info')
      addLog('3. 浏览器控制台是否有错误信息', 'info')
      addLog('4. 防火墙是否阻止了连接', 'info')
    }

    ws.value.onmessage = (event: MessageEvent<string>) => {
      try {
        const message = JSON.parse(event.data)
        addLog(`📨 收到消息: ${message.type}`, 'success')
        if (message.type === 'connected') {
          addLog(`服务器消息: ${message.data.message}`, 'info')
        } else if (message.type === 'crawler:task:updated') {
          addLog(`任务更新: ${message.data.id} - ${message.data.status}`, 'info')
        }
      } catch (e) {
        addLog(`📨 收到原始消息: ${event.data}`, 'info')
      }
    }
  } catch (error: any) {
    addLog(`❌ 创建 WebSocket 失败: ${error.message}`, 'error')
  }
}

function disconnect() {
  if (ws.value) {
    addLog('主动断开 WebSocket 连接', 'info')
    ws.value.close()
    ws.value = null
  }
}

function clearLog() {
  logs.value = []
  addLog('日志已清空', 'info')
}

// 页面加载时自动连接（仅在客户端）
onMounted(() => {
  addLog('页面已加载，准备连接 WebSocket', 'info')
  addLog(`当前页面 URL: ${window.location.href}`, 'info')
  addLog(`WebSocket URL: ws://${window.location.hostname}:${window.location.port || '3000'}/_ws/ws`, 'info')

  setTimeout(() => {
    addLog('开始自动连接...', 'info')
    connect()
  }, 500)
})

// 页面卸载时断开连接
onUnmounted(() => {
  if (ws.value) {
    ws.value.close()
  }
})
</script>

<style scoped>
.websocket-test {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: 'Monaco', 'Menlo', monospace;
}

h1 {
  color: #4ec9b0;
  margin-bottom: 20px;
}

.info-box {
  background: #264f78;
  border-left: 4px solid #4fc1ff;
  padding: 12px 16px;
  margin-bottom: 20px;
  border-radius: 4px;
  color: #d4d4d4;
}

.test-section {
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 16px;
}

.test-section h3 {
  margin-top: 0;
  color: #4ec9b0;
  margin-bottom: 12px;
}

.status {
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-weight: bold;
  text-align: center;
}

.status.connected {
  background: #1e3a1e;
  color: #4ec9b0;
  border: 1px solid #4ec9b0;
}

.status.disconnected {
  background: #3a1e1e;
  color: #f48771;
  border: 1px solid #f48771;
}

.status.connecting {
  background: #3a3a1e;
  color: #dcdcaa;
  border: 1px solid #dcdcaa;
}

.log-container {
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.6;
}

.log-entry {
  margin-bottom: 4px;
  padding: 4px 0;
  border-bottom: 1px solid #2d2d2d;
}

.log-entry:last-child {
  border-bottom: none;
}

.log-time {
  color: #858585;
  margin-right: 8px;
}

.log-info {
  color: #4fc1ff;
}

.log-success {
  color: #4ec9b0;
}

.log-error {
  color: #f48771;
}

.log-warn {
  color: #dcdcaa;
}

:deep(.n-descriptions) {
  --n-td-color: #1e1e1e;
  --n-border-color: #3e3e42;
  --n-td-text-color: #d4d4d4;
}

:deep(.n-code) {
  background: #1e1e1e;
  color: #d4d4d4;
}
</style>
