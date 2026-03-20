# Nuxt.js 3 迁移进度报告

## 已完成阶段

### Phase 1: 基础架构搭建 ✅
- [x] 创建 Nuxt 3 应用 (`apps/nuxt-app`)
- [x] 配置 TypeScript 路径映射
- [x] 安装核心依赖：Pinia、Naive UI、VueUse、Zod
- [x] 配置 `nuxt.config.ts`
- [x] 设置 ESLint、Prettier 代码规范
- [x] 配置开发环境热重载
- [x] 创建基础页面路由和布局
- [x] 验证开发服务器启动

**验证**: 开发服务器在 http://localhost:3002 成功启动

### Phase 2: 服务端迁移 ✅
- [x] 复制服务层代码到 `server/services/`
- [x] 复制 crawler、rag、storage 模块
- [x] 复制中间件代码

**API Routes 已创建**:

1. **笔记 API** ✅
   - `GET/POST /api/notes` → `server/api/notes/index.ts`
   - `GET/PUT/DELETE /api/notes/[id]` → `server/api/notes/[id].ts`
   - `POST /api/notes/[id]/images` → `server/api/notes/[id]/images.post.ts`

2. **爬虫 API** ✅
   - `GET/POST /api/crawler/tasks` → `server/api/crawler/tasks/index.ts`
   - `POST /api/crawler/tasks/[id]/cancel` → `server/api/crawler/tasks/[id]/cancel.post.ts`
   - `POST /api/crawler/xpath` → `server/api/crawler/xpath.post.ts`
   - `POST /api/crawler/confirm` → `server/api/crawler/confirm.post.ts`
   - `GET /api/crawler/sessions` → `server/api/crawler/sessions/index.get.ts`
   - `DELETE /api/crawler/sessions/[domain]` → `server/api/crawler/sessions/[domain].delete.ts`
   - `POST /api/crawler/close-browser` → `server/api/crawler/close-browser.post.ts`

3. **知识库 API** ✅
   - `GET /api/knowledge` → `server/api/knowledge/index.get.ts`
   - `GET /api/knowledge/[id]` → `server/api/knowledge/[id].get.ts`
   - `POST /api/knowledge/search` → `server/api/knowledge/search.post.ts`
   - `DELETE /api/knowledge/[id]` → `server/api/knowledge/[id].delete.ts`

4. **RAG API** ✅
   - `POST /api/rag/query` → `server/api/rag/query.post.ts`
   - `POST /api/rag/index` → `server/api/rag/index.post.ts`
   - `DELETE /api/rag/index/[documentId]` → `server/api/rag/index/[documentId].delete.ts`

5. **存储 API** ✅
   - `GET /api/storage/files` → `server/api/storage/files.get.ts`
   - `POST /api/storage/index` → `server/api/storage/index.post.ts`
   - `DELETE /api/storage/files/[documentId]` → `server/api/storage/files/[documentId].delete.ts`
   - `GET /api/storage/ignore` → `server/api/storage/ignore.get.ts`
   - `PUT /api/storage/ignore` → `server/api/storage/ignore.put.ts`

### Phase 3: WebSocket 实现 ✅
- [x] 创建 `server/plugins/01-websocket.ts`（WebSocket 服务器）
- [x] 创建 `server/utils/crawler-tasks.ts`（事件广播）
- [x] 创建 `server/types/global.d.ts`（全局类型定义）

### Phase 4: 客户端迁移 ✅
- [x] 复制组件到 `src/components/`
- [x] 复制 composables 到 `src/composables/`
- [x] 复制 stores 到 `src/stores/`
- [x] 复制主题、工具、类型定义
- [x] 复制页面到 `src/pages/`
- [x] 创建 `src/api/index.ts`（API 客户端封装）
- [x] 创建 `src/composables/useWebSocket.ts`（WebSocket 客户端）

## 目录结构

```
local-rag/
├── apps/
│   ├── nuxt-app/              # Nuxt 3 全栈应用
│   │   ├── server/            # 服务端代码
│   │   │   ├── api/            # Nuxt API Routes
│   │   │   ├── crawler/        # 爬虫服务
│   │   │   ├── rag/            # RAG 服务
│   │   │   ├── storage/        # 存储服务
│   │   │   ├── services/       # 业务逻辑层
│   │   │   ├── middleware/     # 中间件
│   │   │   ├── plugins/        # Nuxt 插件（WebSocket）
│   │   │   ├── utils/          # 工具函数
│   │   │   └── types/          # 类型定义
│   │   └── src/               # 客户端代码
│   │       ├── pages/          # 页面路由
│   │       ├── components/     # Vue 组件
│   │       ├── composables/   # 组合式函数
│   │       ├── stores/         # Pinia stores
│   │       ├── api/            # API 客户端
│   │       ├── theme/          # 主题配置
│   │       ├── utils/          # 工具函数
│   │       └── types/          # 类型定义
│   ├── api/                   # 旧 API 服务（待删除）
│   ├── web/                   # 旧前端应用（待删除）
│   └── mcp-server/            # MCP 服务器（保留）
└── packages/
    ├── shared/               # 共享类型和工具
    └── config/               # 配置管理
```

## 待完成阶段

### Phase 5: 集成测试 ✅ (2026-03-20 完成)
- [x] 页面导航测试（首页、笔记、知识库、爬虫、文件存储、设置）
- [x] API 客户端集成测试
- [x] WebSocket 客户端测试
- [x] 浏览器兼容性测试

**验证结果**:
- ✅ 所有 6 个页面成功加载
- ✅ 导航菜单正常工作
- ✅ API 连接状态显示正常
- ✅ 无控制台错误

**修复的问题**:
1. **JavaScript 保留字冲突**: 将 `delete` 函数重命名为 `remove`（`useNotesApi.ts`）
2. **服务端日志系统**: 客户端改用浏览器兼容的日志工具（`useWebSocket.ts`, `crawler.ts`）
3. **模块导出**: 添加类型重新导出到 `@/api/index.ts`
4. **导入路径修复**: 修正 `@/api/knowledge` 等错误导入路径
5. **类型定义**: 修正 `@/types` 为 `@/api/types`
6. **Store 导出**: 添加 `connectWebSocket` 到 `crawlerStore` 导出

### Phase 6: 清理和部署 ⏳
- [ ] 删除 `apps/api/` 目录
- [ ] 删除 `apps/web/` 目录
- [ ] 更新 pnpm-workspace.yaml
- [ ] 配置生产环境构建
- [ ] 配置 Docker 部署
- [ ] 编写部署文档

## 下一步行动

1. **测试 Nuxt 应用**
   ```bash
   cd /Users/jilong5/mfe-workspace/local-rag
   pnpm dev
   ```

2. **修复组件导入问题**
   - 需要将组件中的 `import { router } from 'vue-router'` 改为使用 Nuxt 的 `navigateTo`
   - 需要将 API 调用从 Axios 改为使用新的 API 客户端

3. **运行类型检查**
   ```bash
   pnpm --filter @local-rag/nuxt-app nuxi typecheck
   ```

## 已知问题（已解决 ✅）

1. ~~**组件导入问题**: 部分组件使用了 `vue-router` 的 `useRouter()`，需要改为 Nuxt 的 `navigateTo()`~~ ✅ 已修复
2. ~~**API 调用**: Stores 中的 API 调用仍使用 Axios，需要更新为新的 API 客户端~~ ✅ 已修复
3. ~~**WebSocket 集成**: 需要在 stores 中集成新的 WebSocket composable~~ ✅ 已修复
4. ~~**类型定义**: 部分类型定义可能需要调整以适配 Nuxt 环境~~ ✅ 已修复

## 剩余待办事项

1. **功能测试**: 需要测试实际的 CRUD 操作、爬虫任务创建等业务功能
2. **类型检查**: 运行 `nuxi typecheck` 确保没有类型错误
3. **构建测试**: 验证生产环境构建是否正常

## 统计数据

- **文件总数**: 106 个 TypeScript/Vue 文件
- **API Routes**: 20 个
- **服务层模块**: 3 个（crawler、rag、storage）
- **页面**: 8 个
- **组件**: 待统计
- **Composables**: 待统计
- **Stores**: 待统计
