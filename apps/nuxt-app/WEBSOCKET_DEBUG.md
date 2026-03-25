# WebSocket 连接问题诊断指南

## 问题描述
根据日志分析，问题确定为：**前端 WebSocket 客户端没有成功连接到后端**

### 日志证据
```json
{
  "clientCount": 0,
  "message": "WebSocket 广播任务更新",
  "status": "browser_ready"
}
```
- `clientCount: 0` - 没有客户端连接
- 缺少 "WebSocket 客户端已连接" 日志

## 已实施的修复

### 1. 增强的日志记录
- **前端** (`useWebSocket.ts`):
  - WebSocket 连接 URL 详细日志
  - 连接状态变化日志
  - 连接超时检测（5秒）
  - ReadyState 文本描述

- **后端** (`server/routes/ws.ts`):
  - WebSocket 路由加载确认日志
  - 客户端连接时记录 readyState
  - 广播时警告没有连接的客户端

### 2. UI 改进
- **连接状态显示**: 右侧面板显示 WebSocket 连接状态
- **重新连接按钮**: 允许手动触发重新连接

### 3. 初始化改进
- **连接顺序优化**: 先连接 WebSocket，再注册处理器
- **任务列表加载**: 页面加载时同步任务列表，确保即使 WebSocket 失败也能看到任务

## 验证步骤

### 1. 重启开发服务器
```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
npm run dev
```

### 2. 打开浏览器控制台
```
1. 访问 http://localhost:3000/crawler
2. 打开浏览器开发者工具（F12）
3. 查看 Console 标签页
```

### 3. 检查日志输出

#### 预期的前端日志：
```
[CrawlerView] 组件已挂载，开始初始化 WebSocket
[useWebSocket] 正在连接 WebSocket { wsUrl: "ws://localhost:3000/ws" }
[useWebSocket] 创建 WebSocket 连接 { readyState: "CONNECTING" }
[useWebSocket] WebSocket 已连接 { readyState: "OPEN (1)" }
[crawler-store] WebSocket 连接状态变化 { connected: true }
```

#### 预期的后端日志：
```
WebSocket 路由已加载 { hasGlobalWsManager: true }
WebSocket 客户端已连接 { clientCount: 1, readyState: 1 }
```

### 4. 检查网络连接
```
1. 在开发者工具中，切换到 Network 标签页
2. 筛选 WS (WebSocket) 连接
3. 查找 ws://localhost:3000/ws
4. 检查状态码（应该是 101 Switching Protocols）
```

## 常见问题排查

### 问题 1: WebSocket 连接失败
**症状**: 浏览器控制台显示 WebSocket 连接错误

**可能原因**:
- 防火墙阻止了 WebSocket 连接
- 浏览器扩展阻止了连接
- 端口被其他应用占用

**解决方案**:
1. 检查防火墙设置
2. 尝试禁用浏览器扩展
3. 更换开发服务器端口（在 nuxt.config.ts 中修改 `devServer.port`）

### 问题 2: 连接超时
**症状**: 5秒后显示 "WebSocket 连接超时"

**可能原因**:
- Nitro WebSocket 功能未正确启用
- Nuxt 版本不支持实验性 WebSocket

**解决方案**:
1. 确认 nuxt.config.ts 中有 `nitro.experimental.websocket: true`
2. 更新 Nuxt 到最新版本
3. 检查 package.json 中是否有 `ws` 依赖

### 问题 3: 连接成功但收不到消息
**症状**: 前端显示"已连接"，但创建任务后没有收到更新

**可能原因**:
- WebSocket 消息处理器未正确注册
- 任务更新广播时机问题

**解决方案**:
1. 检查浏览器控制台是否有 "注册 WebSocket 处理器" 日志
2. 检查后端日志是否有 "WebSocket 广播任务更新"
3. 手动点击"重新连接"按钮

## 手动测试 WebSocket 连接

### 方法 1: 浏览器控制台测试
```javascript
// 在浏览器控制台执行
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => console.log('WebSocket 连接成功');
ws.onerror = (error) => console.error('WebSocket 错误:', error);
ws.onmessage = (event) => console.log('收到消息:', event.data);
```

### 方法 2: 使用 wscat 工具
```bash
# 安装 wscat
npm install -g wscat

# 连接测试
wscat -c ws://localhost:3000/ws
```

## 下一步行动

1. **重启开发服务器**
2. **打开浏览器控制台**
3. **检查连接状态**
4. **如果连接失败，提供以下信息**:
   - 浏览器控制台错误日志
   - Network 标签页中的 WebSocket 请求详情
   - 后端日志中的 WebSocket 相关记录

## 代码更改摘要

### 前端文件修改:
- `src/composables/useWebSocket.ts` - 增强日志和错误处理
- `src/stores/crawler.ts` - 添加连接状态日志
- `src/pages/crawler.vue` - 添加连接状态显示，改进初始化顺序

### 后端文件修改:
- `server/routes/ws.ts` - 添加详细的连接日志和警告

### 配置文件修改:
- `nuxt.config.ts` - 更新 WebSocket URL 注释
