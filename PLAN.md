# Local RAG 本地知识库系统 - 实现计划

## Context

构建一个基于 Vite + Vue3 + Node.js + TypeScript 的本地知识库系统，使用 llama_index 作为核心 RAG 引擎。通过 MCP Server 为 Claude CLI 提供 tools/skills，使 Claude CLI 能够调用本地知识库进行编程辅助。

**核心特性：**
- 单用户本地应用，SQLite + 文件存储（代码上 GitHub，数据留本地）
- MCP Server 适配 Claude CLI
- 多嵌入模型：GLM / Gemini / transformers.js（本地无需 Key）
- 网页爬虫支持内网扫码登录会话持久化（playwright-core 复用系统浏览器）
- Markdown 笔记系统，支持图片上传
- 敏感文件自动忽略

## 项目结构

```
local-rag/
├── apps/
│   ├── web/                    # Vue3 前端应用
│   │   ├── src/
│   │   │   ├── components/     # UI 组件
│   │   │   ├── views/          # 页面视图
│   │   │   ├── stores/         # Pinia 状态管理
│   │   │   ├── api/            # API 客户端
│   │   │   ├── composables/    # 组合式函数
│   │   │   └── types/          # TypeScript 类型
│   │   ├── public/
│   │   │   └── uploads/        # 上传的图片存储
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── api/                     # Node.js 后端服务
│   │   ├── src/
│   │   │   ├── routes/          # API 路由
│   │   │   ├── services/        # 业务逻辑
│   │   │   ├── rag/             # LlamaIndex RAG 引擎
│   │   │   ├── crawler/         # 网页爬虫
│   │   │   ├── storage/         # 文件存储
│   │   │   ├── middleware/      # 中间件
│   │   │   └── types/           # TypeScript 类型
│   │   ├── uploads/             # 服务端上传文件
│   │   ├── data/                # 知识库数据存储
│   │   │   ├── documents/       # 文档索引
│   │   │   ├── vector_store/    # 向量存储
│   │   │   ├── sessions/        # 爬虫会话存储
│   │   │   └── notes/           # 笔记存储
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── mcp-server/              # MCP Server (适配 Claude CLI)
│       ├── src/
│       │   ├── index.ts         # MCP Server 入口
│       │   ├── tools/           # MCP 工具定义
│       │   │   ├── rag-query.ts       # RAG 查询工具
│       │   │   ├── knowledge-search.ts # 知识库搜索
│       │   │   ├── note-lookup.ts      # 笔记查找
│       │   │   └── crawler-trigger.ts  # 触发爬虫
│       │   ├── handlers/        # 工具处理器
│       │   └── types.ts         # MCP 类型定义
│       ├── package.json
│       └── README.md            # MCP 配置说明
│
├── packages/
│   ├── shared/                  # 共享类型和工具
│   │   ├── src/
│   │   │   ├── types/           # 共享类型定义
│   │   │   └── utils/           # 共享工具函数
│   │   └── package.json
│   │
│   └── config/                  # 共享配置
│       ├── src/
│       │   ├── llama.config.ts  # LlamaIndex 配置
│       │   ├── crawler.config.ts # 爬虫配置
│       │   └── mcp.config.ts    # MCP 配置
│       └── package.json
│
├── .gitignore
├── .env.example
├── .claude/
│   └── settings.json            # Claude CLI MCP 配置
├── package.json                 # Monorepo 根配置
├── pnpm-workspace.yaml
└── README.md
```

## 核心功能模块设计

### 0. MCP Server (apps/mcp-server/) - Claude CLI 适配层

**文件结构：**
```
mcp-server/
├── src/
│   ├── index.ts                 # MCP Server 入口 (stdio 通信)
│   ├── tools/                   # 工具定义
│   │   ├── rag-query.ts         # RAG 查询: {query: string, topK?: number}
│   │   ├── knowledge-search.ts  # 知识库搜索: {keywords: string[]}
│   │   ├── note-lookup.ts       # 笔记查找: {title: string}
│   │   ├── crawler-trigger.ts   # 触发爬虫: {url: string}
│   │   └── index.ts             # 工具注册
│   ├── handlers/                # 工具处理器 (调用 API 服务)
│   │   ├── rag-handler.ts
│   │   ├── knowledge-handler.ts
│   │   └── crawler-handler.ts
│   └── types.ts                 # MCP 协议类型
├── package.json
└── README.md                    # 配置说明
```

**MCP 工具定义：**

```typescript
// tools/rag-query.ts
export const ragQueryTool = {
  name: "local_rag_query",
  description: "查询本地知识库，获取相关文档片段",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "查询问题"
      },
      topK: {
        type: "number",
        description: "返回结果数量，默认5",
        default: 5
      }
    },
    required: ["query"]
  }
};

// tools/knowledge-search.ts
export const knowledgeSearchTool = {
  name: "knowledge_search",
  description: "搜索知识库中的文档标题和内容",
  inputSchema: {
    type: "object",
    properties: {
      keywords: {
        type: "array",
        items: { type: "string" },
        description: "搜索关键词"
      }
    },
    required: ["keywords"]
  }
};

// tools/note-lookup.ts
export const noteLookupTool = {
  name: "note_lookup",
  description: "查找特定笔记",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "笔记标题或部分标题"
      }
    },
    required: ["title"]
  }
};

// tools/crawler-trigger.ts
export const crawlerTriggerTool = {
  name: "crawler_trigger",
  description: "触发网页爬虫，将内容添加到知识库",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "要爬取的网页URL"
      },
      waitForAuth: {
        type: "boolean",
        description: "是否等待扫码登录，默认false",
        default: false
      }
    },
    required: ["url"]
  }
};
```

**Claude CLI 配置 (.claude/settings.json)：**

```json
{
  "mcpServers": {
    "local-rag": {
      "command": "node",
      "args": ["./apps/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3001"
      }
    }
  }
}
```

### 1. RAG 引擎 (apps/api/src/rag/)

**文件结构：**
```
rag/
├── index.ts                     # RAG 引擎入口
├── embeddings/
│   ├── index.ts                 # 嵌入模型适配层（多 provider）
│   ├── glm-embeddings.ts        # 智谱 GLM embedding-3
│   ├── gemini-embeddings.ts     # Google Gemini text-embedding-004
│   └── local-embeddings.ts      # transformers.js 本地嵌入（无需 API Key）
├── vector-store/
│   ├── index.ts                 # 向量存储入口
│   └── sqlite-store.ts          # SQLite + sqlite-vss 向量存储
├── retriever/
│   ├── index.ts                 # 检索器配置
│   └── dense-retriever.ts       # 稠密检索
└── pipeline/
    ├── index.ts                 # 处理管道
    └── query-pipeline.ts        # 查询处理管道
```

**关键实现：**
- 多嵌入模型支持：GLM embedding-3、Gemini text-embedding-004、transformers.js 本地模型（无需 Key）
- 向量存储：SQLite + sqlite-vss（单文件、零外部服务依赖）
- 混合检索：稠密检索 + BM25 稀疏检索
- 注意：Claude (Anthropic) 不提供 embedding API，不可用于嵌入；Claude 可作为 RAG 的 LLM 层（查询理解/生成回答）

### 2. 网页爬虫 (apps/api/src/crawler/)

**文件结构：**
```
crawler/
├── index.ts                     # 爬虫入口
├── fetchers/
│   ├── index.ts                 # 获取器入口
│   ├── basic-fetcher.ts         # 基础 HTTP 获取
│   ├── playwright-fetcher.ts    # Playwright 浏览器获取
│   └── authenticated-fetcher.ts # 带认证的获取器
├── parsers/
│   ├── index.ts                 # 解析器入口
│   ├── html-parser.ts           # HTML 解析
│   ├── markdown-parser.ts       # Markdown 提取
│   └── article-parser.ts        # 文章内容提取
├── auth/
│   ├── index.ts                 # 认证管理
│   ├── session-manager.ts       # 会话管理
│   ├── qrcode-handler.ts        # 二维码登录处理
│   └── session-store.ts         # 会话存储 (文件)
├── detectors/
│   ├── index.ts                 # 登录检测器
│   └── login-detector.ts        # 检测是否需要登录
└── queue/
    ├── index.ts                 # 爬取队列
    └── task-queue.ts            # 任务队列管理
```

**扫码登录流程：**

```
┌─────────────────────────────────────────────────────────────┐
│                    扫码登录流程                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 用户触发爬虫，目标 URL 需要登录                          │
│     └── API: POST /api/crawler/start {url, waitForAuth: true} │
│                                                             │
│  2. 启动有头浏览器 (headless: false)                        │
│     └-> Playwright launch({headless: false})                │
│                                                             │
│  3. 导航到目标 URL，检测登录页面                             │
│     └-> 检测常见登录元素: .login, #login, [data-login]      │
│                                                             │
│  4. 发现登录页面 → 等待用户扫码                              │
│     └-> 返回 "waiting_for_qrcode" 状态给前端                │
│     └-> 前端显示二维码/提示用户扫码                          │
│     └-> WebSocket 推送登录状态变化                          │
│                                                             │
│  5. 用户扫码成功 → 检测登录成功                              │
│     └-> 检测 URL 变化 / 特定元素出现                        │
│     └-> 保存 cookies, localStorage 到文件                   │
│     └-> data/sessions/{domain}.json                         │
│                                                             │
│  6. 切换到无头模式，继续爬取                                 │
│     └-> 加载保存的会话                                      │
│     └-> 开始爬取内容                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**会话存储格式 (data/sessions/example.com.json)：**
```json
{
  "domain": "example.com",
  "createdAt": "2026-03-18T10:00:00Z",
  "updatedAt": "2026-03-18T11:30:00Z",
  "cookies": [
    {
      "name": "session_id",
      "value": "xxx",
      "domain": ".example.com",
      "path": "/",
      "expires": 1734567890
    }
  ],
  "localStorage": {
    "auth_token": "xxx",
    "user_id": "123"
  },
  "userAgent": "Mozilla/5.0..."
}
```

**关键实现：**
- playwright-core 复用系统浏览器（不捆绑 ~200MB 浏览器二进制），通过 BROWSER_EXECUTABLE_PATH 配置
- 支持内网系统扫码/SSO 登录
- 智能登录检测：识别登录页面元素
- 会话持久化：保存 cookies 和 localStorage
- 智能解析：提取主要内容，去除广告/导航

### 3. 笔记系统 (apps/api/src/services/)

**文件结构：**
```
services/
├── notes/
│   ├── index.ts                 # 笔记服务入口
│   ├── note-manager.ts          # 笔记 CRUD (纯文件存储)
│   ├── markdown-handler.ts      # Markdown 处理
│   ├── image-handler.ts         # 图片处理
│   └── indexer.ts               # 笔记索引到 RAG
└── knowledge-base/
    ├── index.ts                 # 知识库服务
    ├── document-manager.ts      # 文档管理
    └── tag-manager.ts           # 标签管理
```

**关键实现：**
- Markdown 编辑和预览
- 图片上传：本地文件引用
- 自动索引：笔记变更自动更新 RAG 索引
- 版本控制：每次保存时在 `data/notes/{id}/history/` 下创建时间戳快照，保留最近 N 个版本

### 4. 文件存储 (apps/api/src/storage/)

**文件结构：**
```
storage/
├── index.ts                     # 存储入口
├── local-storage.ts             # 本地文件存储
├── ignore-rules.ts              # 敏感文件忽略规则
└── indexer/
    ├── index.ts                 # 索引入口
    ├── text-indexer.ts          # 文本文件索引
    ├── markdown-indexer.ts      # Markdown 索引
    └── code-indexer.ts          # 代码文件索引
```

**关键实现：**
- 默认忽略规则：.git、node_modules、.env、dist、build
- 自定义忽略规则：用户可配置额外忽略模式
- 增量索引：只索引变更文件

### 5. API 路由 (apps/api/src/routes/)

**文件结构：**
```
routes/
├── index.ts                     # 路由入口
├── notes.ts                     # 笔记 API
├── knowledge.ts                 # 知识库 API
├── crawler.ts                   # 爬虫 API
├── rag.ts                       # RAG 查询 API
└── storage.ts                   # 存储管理 API
```

### 6. 前端界面 (apps/web/src/)

**文件结构：**
```
web/src/
├── App.vue
├── main.ts
├── components/
│   ├── MarkdownEditor.vue       # Markdown 编辑器
│   ├── ImageUpload.vue          # 图片上传组件
│   ├── NoteList.vue             # 笔记列表
│   ├── NoteViewer.vue           # 笔记查看器
│   ├── CrawlerPanel.vue         # 爬虫面板
│   └── KnowledgeBase.vue        # 知识库管理
├── views/
│   ├── Home.vue                 # 首页
│   ├── NotesView.vue            # 笔记页面
│   ├── CrawlerView.vue          # 爬虫页面 (含扫码登录状态)
│   └── SettingsView.vue         # 设置页面
├── stores/
│   ├── notes.ts                 # 笔记状态
│   └── settings.ts              # 设置状态
└── api/
    ├── client.ts                # API 客户端
    ├── notes.ts                 # 笔记 API
    └── crawler.ts               # 爬虫 API
```

## 关键配置文件

### 1. LlamaIndex 优化配置 (packages/config/src/llama.config.ts)

```typescript
export const llamaConfig = {
  // 嵌入模型配置（多 provider，按优先级 fallback）
  embeddings: {
    // 当前使用的 provider: 'glm' | 'gemini' | 'transformers_js'
    provider: 'glm',
    providers: {
      glm: {
        model: 'embedding-3',
        dimension: 1024,
        batchSize: 32,
        // API Key 从环境变量 GLM_API_KEY 读取
      },
      gemini: {
        model: 'text-embedding-004',
        dimension: 768,
        batchSize: 32,
        // API Key 从环境变量 GEMINI_API_KEY 读取
      },
      transformers_js: {
        model: 'Xenova/all-MiniLM-L6-v2',
        dimension: 384,
        batchSize: 16,
        // 无需 API Key，本地运行，首次使用自动下载模型（~100MB）
      },
    },
  },

  // 向量存储配置（SQLite + sqlite-vss）
  vectorStore: {
    type: 'sqlite',
    dbPath: './data/vector_store/rag.db',
  },

  // 检索配置
  retrieval: {
    topK: 5,
    similarityThreshold: 0.7,
    searchType: 'hybrid',
  },

  // 分块配置
  chunking: {
    chunkSize: 512,
    chunkOverlap: 50,
    splitter: 'sentence',
  },
};
```

### 2. 爬虫配置 (packages/config/src/crawler.config.ts)

```typescript
export const crawlerConfig = {
  // 请求配置
  request: {
    timeout: 30000,
    retries: 3,
    userAgent: 'Local-RAG-Bot/1.0',
  },

  // 浏览器配置
  browser: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
  },

  // 认证配置
  auth: {
    sessionPath: './data/sessions',
  },

  // 解析配置
  parsing: {
    removeSelectors: ['.ad', '.sidebar', 'nav', 'footer'],
    contentSelector: 'main, article, .content',
    extractImages: true,
  },
};
```

### 3. 忽略规则配置 (apps/api/src/storage/ignore-rules.ts)

```typescript
export const ignoreRules = {
  // 默认忽略
  default: [
    'node_modules/**',
    '.git/**',
    '.gitignore',
    'dist/**',
    'build/**',
    '.env',
    '.env.*',
    '*.log',
    '.DS_Store',
    'coverage/**',
    '.vscode/**',
    '.idea/**',
    '*.swp',
    '*.swo',
  ],

  // 敏感文件模式
  sensitive: [
    '**/*password*',
    '**/*secret*',
    '**/*private*',
    '**/*key*',
    '**/.aws/**',
    '**/.ssh/**',
  ],

  // 用户自定义
  custom: [] as string[],
};
```

## 技术栈

### 前端
- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **UI 组件**: Element Plus / Naive UI
- **Markdown**: @vueuse/components + markdown-it
- **HTTP 客户端**: Axios

### 后端
- **运行时**: Node.js
- **框架**: Express
- **类型**: TypeScript
- **文件处理**: multer
- **WebSocket**: ws (推送爬虫登录状态)

### RAG 核心
- **LlamaIndex (TS)**: `llamaindex`
- **嵌入模型**: 智谱 GLM embedding-3 / Gemini text-embedding-004 / transformers.js 本地模型
- **向量存储**: SQLite + sqlite-vss（单文件，零外部服务依赖）

### 爬虫
- **playwright-core**: 浏览器自动化 + 扫码登录（不捆绑浏览器，复用系统 Chrome/Edge，省 ~200MB）
- **Cheerio**: HTML 解析
- **Readability**: 文章内容提取

### MCP Server
- **MCP SDK**: `@modelcontextprotocol/sdk`
- **通信**: stdio (与 Claude CLI 通信)

## 开发阶段

### Phase 1: 项目初始化
- [ ] 创建 monorepo 结构
- [ ] 配置 pnpm workspace
- [ ] 初始化前端 Vite + Vue3 项目
- [ ] 初始化后端 Node.js + Express 项目
- [ ] 初始化 MCP Server 项目
- [ ] 配置 TypeScript
- [ ] 设置 ESLint + Prettier

### Phase 2: 核心 RAG 引擎
- [ ] 集成 LlamaIndex
- [ ] 实现嵌入模型适配层（GLM / Gemini / transformers.js 三选一，可切换）
- [ ] 实现 SQLite + sqlite-vss 向量存储
- [ ] 实现检索器（稠密检索 + BM25）
- [ ] 查询管道

### Phase 3: MCP Server
- [ ] 实现 MCP Server 入口 (stdio)
- [ ] 定义 MCP 工具
- [ ] 实现工具处理器
- [ ] Claude CLI 配置测试
- [ ] 集成测试

### Phase 4: 文件存储与索引
- [ ] 实现本地文件扫描
- [ ] 实现敏感文件忽略
- [ ] 实现文档解析（Markdown、TXT、代码）
- [ ] 实现增量索引

### Phase 5: 笔记系统
- [ ] 笔记 CRUD API (纯文件存储)
- [ ] Markdown 处理
- [ ] 图片上传
- [ ] 自动索引

### Phase 6: 网页爬虫
- [ ] playwright-core 集成（复用系统浏览器，支持内网登录）
- [ ] 登录页面检测
- [ ] 扫码登录流程
- [ ] 会话持久化
- [ ] 内容解析

### Phase 7: 前端界面
- [ ] 布局与路由
- [ ] 笔记界面
- [ ] 爬虫界面 (含扫码登录状态)
- [ ] 知识库管理界面
- [ ] 设置界面

### Phase 8: 优化与测试
- [ ] 性能优化
- [ ] 错误处理
- [ ] 端到端测试
- [ ] 文档编写

## 验证计划

1. **MCP Server 验证**
   - 启动 MCP Server
   - 在 Claude CLI 中调用工具
   - 验证返回结果格式

2. **RAG 功能验证**
   - 创建测试文档
   - 执行索引
   - 测试查询检索准确性
   - 通过 MCP 工具查询

3. **爬虫功能验证**
   - 测试简单网页爬取
   - 测试登录页面检测
   - 测试扫码登录流程
   - 测试会话持久化
   - 测试内容解析准确性

4. **笔记功能验证**
   - 创建/编辑/删除笔记
   - 图片上传和显示
   - 笔记自动索引
   - 通过 MCP 工具查找笔记

## MCP 配置说明

### Claude CLI 配置文件

在项目根目录创建 `.claude/settings.json`：

```json
{
  "mcpServers": {
    "local-rag": {
      "command": "node",
      "args": ["./apps/mcp-server/dist/index.js"],
      "env": {
        "API_BASE_URL": "http://localhost:3001",
        "DATA_PATH": "./apps/api/data"
      }
    }
  }
}
```

### MCP Server 使用示例

在 Claude CLI 中：

```
# 查询本地知识库
@local-rag local_rag_query(query="如何使用 React hooks?")

# 搜索文档
@local-rag knowledge_search(keywords=["React", "useState"])

# 查找笔记
@local-rag note_lookup(title="React 学习笔记")

# 爬取网页
@local-rag crawler_trigger(url="https://example.com/docs", waitForAuth=true)
```

## 依赖包清单

### 根目录
```json
{
  "name": "local-rag",
  "private": true,
  "scripts": {
    "dev": "concurrently \"pnpm --filter web dev\" \"pnpm --filter api dev\"",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "concurrently": "^9.1.0"
  }
}
```

### packages/shared
```json
{
  "name": "@local-rag/shared",
  "main": "./src/index.ts",
  "dependencies": {
    "typescript": "^5.6.3"
  }
}
```

### packages/config
```json
{
  "name": "@local-rag/config",
  "main": "./src/index.ts",
  "dependencies": {
    "@local-rag/shared": "workspace:*"
  }
}
```

### apps/web
```json
{
  "name": "@local-rag/web",
  "dependencies": {
    "vue": "^3.5.13",
    "vue-router": "^4.5.0",
    "pinia": "^2.2.8",
    "axios": "^1.7.9",
    "element-plus": "^2.9.1",
    "@vueuse/core": "^12.0.0",
    "markdown-it": "^14.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "vite": "^6.0.3",
    "typescript": "^5.6.3"
  }
}
```

### apps/api
```json
{
  "name": "@local-rag/api",
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "ws": "^8.18.0",
    "llamaindex": "^0.7.17",
    "better-sqlite3": "^11.7.0",
    "sqlite-vss": "^0.1.2",
    "playwright-core": "^1.49.1",
    "@xenova/transformers": "^2.17.0",
    "cheerio": "^1.0.0",
    "@mozilla/readability": "^0.5.0",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/multer": "^1.4.12",
    "@types/ws": "^8.5.13",
    "typescript": "^5.6.3",
    "ts-node": "^10.9.2"
  }
}
```

### apps/mcp-server
```json
{
  "name": "@local-rag/mcp-server",
  "type": "module",
  "bin": "./dist/index.js",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "axios": "^1.7.9"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "tsx": "^4.19.2"
  }
}
```

## 数据隔离与隐私

**核心原则：代码上 GitHub，数据留本地。**

所有用户数据（笔记、会话、向量库、上传文件）**绝不提交**到 Git 仓库。

### .gitignore 必须包含的数据目录

```gitignore
# 用户数据 - 绝不提交
apps/api/data/
apps/api/uploads/
apps/web/public/uploads/

# 敏感配置
.env
.env.*
!.env.example

# 嵌入模型缓存（transformers.js 下载的模型）
.cache/
```

### 数据目录结构

```
apps/api/data/              # 所有用户数据在此目录下
├── vector_store/           # SQLite 向量库文件
│   └── rag.db
├── documents/              # 文档索引元数据
├── sessions/               # 爬虫登录会话（含 cookies）
├── notes/                  # 用户笔记（Markdown + 历史版本）
│   └── {id}/
│       ├── content.md
│       └── history/        # 历史版本快照
└── config.json             # 用户本地配置
```

### 如果需要备份数据

- 手动复制 `apps/api/data/` 目录
- 或使用独立的私有 Git 仓库管理 data 目录
- **不要**将数据目录推送到代码仓库所在的 GitHub repo

## 环境变量

```bash
# .env.example
API_PORT=3001
WEB_PORT=5173

# 嵌入模型 provider: glm | gemini | transformers_js
EMBEDDING_PROVIDER=glm

# 智谱 GLM API（使用 GLM 嵌入时必填）
GLM_API_KEY=your_glm_api_key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# Google Gemini API（使用 Gemini 嵌入时必填）
GEMINI_API_KEY=your_gemini_api_key

# transformers.js（无需 API Key，本地运行）
# 首次使用会自动下载模型文件（~100MB）

# 浏览器路径（playwright-core 需要指定系统浏览器）
BROWSER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome

# 存储
DATA_PATH=./data
UPLOAD_PATH=./uploads

# MCP Server
API_BASE_URL=http://localhost:3001
```
