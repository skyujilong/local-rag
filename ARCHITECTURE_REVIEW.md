# 架构验证报告

## 验证日期
2026-03-20

## 架构评估

### ✅ 优点

1. **目录结构清晰**
   - 遵循 Nuxt 3 约定
   - 服务端和客户端代码分离良好
   - API Routes 按功能模块组织

2. **模块化设计**
   - 服务层、API Routes、组件分离
   - 共享类型在 packages/shared 中

3. **类型安全**
   - 使用 TypeScript
   - 共享类型定义

### ⚠️ 发现的问题

#### 1. API 客户端问题 (高优先级)

**问题描述**:
- 使用 `api<any>` 缺乏类型安全
- API 方法名与 stores 中使用的不一致
- `notesApi.search` 未定义但被 store 调用

**影响**: 类型不安全，运行时错误风险

**位置**:
- `src/api/index.ts`
- `src/stores/notes.ts:128`

#### 2. WebSocket 实现问题 (高优先级)

**问题描述**:
- store 中直接使用 WebSocket 连接，未使用新的 `useWebSocket` composable
- WebSocket URL 硬编码为 `localhost:3001`，应该使用相对路径
- 缺少 WebSocket composable 的实际使用

**影响**: WebSocket 连接失败，无法接收实时更新

**位置**:
- `src/stores/crawler.ts:120-164`
- `src/composables/useWebSocket.ts` (未使用)

#### 3. 服务层实例化问题 (中优先级)

**问题描述**:
- 每个 API Route 都创建新的服务实例 (`new NoteManager()`)
- 应该使用单例模式

**影响**: 资源浪费，状态不一致风险

**位置**:
- `server/api/notes/index.ts:10`
- 所有 API Routes

#### 4. 全局状态管理问题 (中优先级)

**问题描述**:
- 使用 `globalThis.__broadcastCrawlerUpdate` 不够优雅
- 缺少类型安全

**影响**: 维护困难，类型不安全

**位置**:
- `server/plugins/01-websocket.ts:87`
- `server/utils/crawler-tasks.ts:60`

#### 5. 类型导入路径问题 (低优先级)

**问题描述**:
- stores 使用 `@/api/...` 导入，但 API 客户端在 `src/api/index.ts`
- 路径可能解析失败

**影响**: 编译错误

**位置**:
- `src/stores/*.ts`

#### 6. 错误处理中间件未集成 (中优先级)

**问题描述**:
- 复制了中间件但未在 Nuxt 中集成
- 每个 API Route 重复错误处理代码

**影响**: 代码重复，维护困难

**位置**:
- `server/middleware/` (未使用)
- 所有 API Routes

#### 7. Nuxt 导入路径问题 (低优先级)

**问题描述**:
- 使用 `~/server/` 别名可能在某些上下文中无法正确解析
- 应该使用 `#` 别名或相对路径

**影响**: 潜在的运行时错误

**位置**:
- `server/api/**/*.ts`

## 修复优先级

### P0 - 必须修复
1. API 客户端类型安全问题
2. WebSocket 连接问题
3. API 方法名不一致

### P1 - 应该修复
4. 服务层单例模式
5. 错误处理中间件集成
6. 全局状态管理改进

### P2 - 可以优化
7. 导入路径优化
8. 类型定义完善

## 建议的修复方案

### 1. API 客户端重构
- 添加完整的类型定义
- 统一 API 方法名
- 添加响应类型包装

### 2. WebSocket 集成
- 在 stores 中使用 `useWebSocket` composable
- 使用相对路径连接 WebSocket
- 添加自动重连机制

### 3. 服务层单例化
- 创建服务工厂函数
- 使用 Nitro storage 存储单例

### 4. 错误处理统一
- 创建 Nitro 错误处理插件
- 统一错误响应格式

### 5. 类型安全增强
- 使用 Zod 进行运行时验证
- 添加 API 响应类型
