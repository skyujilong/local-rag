# 技术架构设计文档 - devrag-cli

| 文档版本 | 日期 | 作者 | 变更说明 |
|---------|------|------|---------|
| v1.0 | 2026-03-26 | 架构师 | 初始版本 |

---

## 1. 架构概览

### 1.1 系统定位

**devrag-cli** 是一个面向开发者的本地 RAG（检索增强生成）知识库系统，通过 MCP 协议与 Claude AI 集成，为开发者提供私有知识上下文增强能力。

**核心价值主张**
- 本地优先：所有数据存储在本地，保护隐私
- 零配置启动：开箱即用，最小化依赖
- AI 原生集成：通过 MCP 协议无缝接入 Claude Code
- 高性能查询：毫秒级语义搜索响应

### 1.2 系统分层架构

```
┌────────────────────────────────────────────────────────────────────┐
│                          用户交互层                                 │
├──────────────────┬──────────────────┬─────────────────────────────┤
│   CLI 终端接口    │   Web 管理界面   │   Claude Code (MCP 客户端)  │
│   (启动/管理)     │   (浏览器访问)   │   (stdio 通信)              │
└────────┬─────────┴────────┬─────────┴───────────┬─────────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                       API 网关层 (Hono)                            │
├────────────┬────────────┬────────────┬────────────┬───────────────┤
│  REST API  │  WebSocket │  静态资源  │  CORS 中间 │  日志中间件   │
│  路由组    │  (可选)    │  服务     │  件        │               │
└────────────┴────────────┴────────────┴────────────┴───────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                       业务服务层                                    │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│ 文档导入服务 │ 网页爬取服务 │ 向量化服务   │ 语义搜索服务         │
│ (Import)     │ (Crawler)    │ (Embedding)  │ (Search)             │
├──────────────┴──────────────┴──────────────┴──────────────────────┤
│ MCP Server 实现 (Model Context Protocol)                           │
└────────────────────────────────────────────────────────────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                       数据访问层                                    │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│ ChromaDB     │ 文件系统     │ Ollama       │ 任务队列             │
│ Client       │ (本地文档)   │ HTTP Client  │ (内存/持久化)        │
└──────────────┴──────────────┴──────────────┴──────────────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌────────────────────────────────────────────────────────────────────┐
│                       存储层                                        │
├──────────────┬──────────────┬──────────────┬──────────────────────┤
│ ChromaDB     │ 本地文件     │ Ollama 模型  │ SQLite (可选)        │
│ 向量数据库   │ 存储目录     │ 缓存         │ (任务/元数据)        │
└──────────────┴──────────────┴──────────────┴──────────────────────┘
```

### 1.3 核心组件说明

| 组件名称 | 技术选型 | 职责描述 |
|---------|---------|---------|
| **CLI 入口** | Commander.js | 提供命令行接口（start/stop/status/import） |
| **Web 服务器** | Hono + Node.js HTTP | 提供 REST API 和静态资源服务 |
| **向量数据库** | ChromaDB (JS Client) | 存储文档向量，支持语义搜索 |
| **爬虫引擎** | Playwright | 爬取动态网页，提取文档内容 |
| **Embedding 服务** | Ollama (nomic-embed-text) | 将文本转换为向量 |
| **LLM 服务** | Ollama (可选) | 生成回答（RAG 场景） |
| **MCP Server** | 自研实现 | 通过 stdio 与 Claude 通信 |
| **任务队列** | 内存队列 + 持久化 | 异步处理文档向量化任务 |
| **配置管理** | YAML + 环境变量 | 管理系统配置和用户偏好 |

### 1.4 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                     开发者机器                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │             devrag-cli 进程                       │  │
│  │  ┌────────┐  ┌────────┐  ┌─────────────────┐    │  │
│  │  │ Hono   │  │ChromaDB│  │  MCP Server     │    │  │
│  │  │ Server │──│Client  │──│  (stdio)        │    │  │
│  │  └────────┘  └────────┘  └─────────────────┘    │  │
│  └──────────────────────────────────────────────────┘  │
│           │                    │                       │
│           ▼                    ▼                       │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  Ollama 进程    │  │  本地文件系统   │              │
│  │  (外部依赖)     │  │  (文档/向量库)  │              │
│  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
           │
           │ stdio
           ▼
┌─────────────────────────────────────────────────────────┐
│              Claude Code CLI 进程                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  MCP Client (stdio 通信)                         │  │
│  │  - search_knowledge_base                         │  │
│  │  - add_document                                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**部署特点**
- 单机部署：所有组件运行在同一台机器
- 进程隔离：devrag-cli 和 Ollama 独立进程
- 本地通信：通过 stdio (MCP) 和 HTTP (Web)
- 无云依赖：完全离线运行

---

## 2. 技术栈详细说明

### 2.1 后端技术栈

#### 2.1.1 Web 框架：Hono

**选择理由**
- ✅ 轻量级：核心包 < 100KB，启动速度快
- ✅ TypeScript 原生：完整的类型推导
- ✅ 高性能：基于 Web Standard API
- ✅ 简洁 API：类似 Express 但更现代
- ✅ 中间件生态：支持 CORS、日志、鉴权等

**核心依赖**
```json
{
  "hono": "^4.0.0",
  "@hono/node-server": "^1.8.0"
}
```

**应用架构**
```typescript
// 主应用结构
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

// 中间件
app.use('*', logger())
app.use('*', cors())

// 路由组
app.route('/api/documents', documentRoutes)
app.route('/api/search', searchRoutes)
app.route('/api/crawler', crawlerRoutes)
app.route('/api/mcp', mcpRoutes)

// 静态资源
app.get('/*', serveStatic({ root: './public' }))

serve({ fetch: app.fetch, port: 3000 })
```

#### 2.1.2 向量数据库：ChromaDB

**选择理由**
- ✅ 轻量级：无需单独部署服务
- ✅ JavaScript 原生：与 Node.js 技术栈完美匹配
- ✅ 持久化存储：重启不丢失数据
- ✅ 元数据过滤：支持高级查询（按标签、来源过滤）
- ✅ 易于集成：API 简单，学习成本低

**技术限制**
- 性能：相比 Qdrant/Milvus 性能一般（但对个人场景足够）
- 扩展性：不支持分布式（MVP 不需要）
- 一致性：最终一致性模型

**数据模型设计**

```typescript
// Collection 结构
interface Collection {
  name: string;              // "documents"
  metadata?: {
    dimension: number;       // 384 (nomic-embed-text)
    model: string;           // "nomic-embed-text"
  };
}

// Document 结构
interface Document {
  id: string;                // UUID
  embedding: number[];       // [384] 向量
  metadata: {
    title: string;           // 文档标题
    source: string;          // "local" | "web"
    url?: string;            // 原始 URL
    tags: string[];          // 标签数组
    created_at: string;      // ISO 8601
    updated_at: string;      // ISO 8601
    chunk_index: number;     // 分片索引
    chunk_total: number;     // 总分片数
  };
}

// 查询结果
interface QueryResult {
  id: string;
  metadata: Document['metadata'];
  distance: number;          // 相似度距离 (0-1)
  document: string;          // 文本内容片段
}
```

**初始化代码**
```typescript
import { ChromaClient } from 'chromadb'

const client = new ChromaClient({
  path: 'http://localhost:8000'  // 或使用内存模式
})

// 创建 Collection
const collection = await client.getOrCreateCollection({
  name: 'documents',
  metadata: { dimension: 384 }
})
```

#### 2.1.3 爬虫引擎：Playwright

**选择理由**
- ✅ 动态网页支持：可执行 JavaScript，渲染 Vue/React 页面
- ✅ 多浏览器：支持 Chrome、Firefox、Safari
- ✅ 自动等待：智能等待元素加载，减少手动 sleep
- ✅ 反爬虫对抗：支持注入 Cookie、修改 User-Agent
- ✅ 易用性：API 设计优秀，文档完善

**核心配置**
```typescript
import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled']
})

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 ...',
  viewport: { width: 1920, height: 1080 }
})

// 注入认证信息
await context.addCookies([
  { name: 'session', value: 'xxx', domain: 'example.com' }
])
```

**内容提取策略**
```typescript
async function extractContent(page: Page): Promise<string> {
  // 1. 移除导航、侧边栏、广告
  await page.evaluate(() => {
    const selectors = ['nav', 'aside', '.advertisement', '.sidebar']
    selectors.forEach(s => document.querySelector(s)?.remove())
  })

  // 2. 提取主要内容
  const content = await page.evaluate(() => {
    // 优先级：article > main > body
    const article = document.querySelector('article')
    const main = document.querySelector('main')
    const body = document.body

    return (article || main || body)?.innerText || ''
  })

  return content
}
```

#### 2.1.4 Embedding 服务：Ollama

**选择理由**
- ✅ 本地运行：数据不上传，保护隐私
- ✅ 免费使用：无 API 调用成本
- ✅ 模型丰富：支持 nomic-embed-text、all-minilm 等
- ✅ 性能优化：支持 Apple Silicon GPU 加速

**模型选择**
```bash
# 安装模型
ollama pull nomic-embed-text
ollama pull llama2  # 可选，用于生成回答

# 验证安装
ollama list
```

**API 集成**
```typescript
async function embedText(text: string): Promise<number[]> {
  const response = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  })

  const data = await response.json()
  return data.embedding  // [384] 数组
}
```

**性能优化**
```typescript
// 批量向量化
async function batchEmbed(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(embedText))
}

// 缓存机制
const embeddingCache = new Map<string, number[]>()
```

### 2.2 前端技术栈

#### 2.2.1 纯静态 HTML/CSS/JS

**选择理由**
- ✅ 零构建步骤：无需 Webpack/Vite，快速迭代
- ✅ 轻量级：总大小 < 100KB
- ✅ 易维护：原生 JavaScript，学习成本低
- ✅ 性能：无框架开销，加载速度快

**技术栈**
```html
<!-- Tailwind CSS (CDN) -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Alpine.js (轻量级响应式) -->
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3"></script>

<!-- 图标库 -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

**应用结构**
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>DevRag CLI - 知识库管理</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3"></script>
</head>
<body>
  <div x-data="app()" x-init="init()">
    <!-- 导航栏 -->
    <nav>...</nav>

    <!-- 主内容区 -->
    <main>
      <!-- 文档列表 -->
      <div x-show="tab === 'documents'">...</div>

      <!-- 搜索界面 -->
      <div x-show="tab === 'search'">...</div>

      <!-- 系统状态 -->
      <div x-show="tab === 'status'">...</div>
    </main>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

**状态管理**
```javascript
function app() {
  return {
    tab: 'documents',
    documents: [],
    searchQuery: '',
    searchResults: [],

    async init() {
      await this.loadDocuments()
      await this.loadStats()
    },

    async loadDocuments() {
      const res = await fetch('/api/documents')
      this.documents = await res.json()
    },

    async search() {
      const res = await fetch(`/api/search?q=${this.searchQuery}`)
      this.searchResults = await res.json()
    }
  }
}
```

### 2.3 CLI 工具链

#### 2.3.1 Commander.js

**命令结构**
```typescript
#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()

program
  .name('devrag-cli')
  .description('本地 RAG 知识库 CLI')
  .version('1.0.0')

// 启动服务
program
  .command('start')
  .description('启动 Web 服务和 MCP Server')
  .option('-p, --port <number>', '端口号', '3000')
  .option('--mcp', '启用 MCP Server')
  .action(startCommand)

// 导入文档
program
  .command('import <path>')
  .description('导入本地 Markdown 文件')
  .option('-r, --recursive', '递归导入子目录')
  .action(importCommand)

// 爬取网页
program
  .command('crawl <url>')
  .description('爬取网页内容')
  .option('--cookies <path>', 'Cookie 文件路径')
  .action(crawlCommand)

// 查询知识库
program
  .command('search <query>')
  .description('查询知识库')
  .option('-n, --num <number>', '返回结果数', '3')
  .action(searchCommand)

program.parse()
```

---

## 3. 数据模型设计

### 3.1 ChromaDB Collection 结构

#### 3.1.1 主 Collection：documents

**用途**：存储所有文档的向量数据

```typescript
{
  name: "documents",
  metadata: {
    dimension: 384,           // nomic-embed-text 维度
    model: "nomic-embed-text",
    created_at: "2026-03-26T00:00:00Z"
  }
}
```

**Document Schema**
```typescript
interface ChromaDocument {
  // 主键（自动生成 UUID）
  id: string;

  // 向量数据（384 维）
  embedding: number[];

  // 文本内容（chunk 后的片段）
  document: string;

  // 元数据（用于过滤）
  metadata: {
    // 基础信息
    title: string;           // 文档标题
    source: 'local' | 'web'; // 数据源类型

    // 来源信息
    url?: string;            // 原始 URL（web 来源）
    path?: string;           // 本地路径（local 来源）

    // 标签和分类
    tags: string[];          // 用户定义的标签
    category?: string;       // 分类（可选）

    // 时间戳
    created_at: string;      // ISO 8601
    updated_at: string;      // ISO 8601

    // 分片信息
    chunk_index: number;     // 当前分片索引（从 0 开始）
    chunk_total: number;     // 总分片数

    // 统计信息
    word_count: number;      // 字数
    char_count: number;      // 字符数
  };
}
```

#### 3.1.2 元数据索引策略

**索引字段**（用于 where 过滤）
```typescript
// ChromaDB 支持的过滤查询
await collection.query({
  queryTexts: ['查询文本'],
  nResults: 3,
  where: {
    source: 'web',           // 精确匹配
    tags: { $in: ['typescript', 'nodejs'] },  // 数组包含
    created_at: { $gte: '2026-03-01' }        // 时间范围
  }
})
```

**不支持的操作**
- ❌ 文本搜索（如 where.title LIKE "%keyword%"）
- ❌ 正则表达式
- ❌ 数组长度过滤

### 3.2 文件系统存储结构

```
~/.devrag-cli/
├── config.yaml              # 配置文件
├── data/
│   ├── chromadb/            # ChromaDB 数据目录
│   │   ├── chroma.sqlite3   # SQLite 元数据库
│   │   └── collections/     # Collection 数据
│   ├── documents/           # 原始文档存储
│   │   ├── local/           # 本地导入的文档
│   │   │   └── {uuid}.md
│   │   └── web/             # 爬取的网页
│   │       └── {uuid}.html
│   └── cache/               # 向量缓存（可选）
│       └── embeddings.json
├── logs/
│   ├── app.log             # 应用日志
│   ├── error.log           # 错误日志
│   └── access.log          # 访问日志
└── tmp/                    # 临时文件
    └── uploads/
```

### 3.3 配置文件结构

```yaml
# ~/.devrag-cli/config.yaml
server:
  port: 3000
  host: "127.0.0.1"
  mcp:
    enabled: true
    transport: "stdio"

ollama:
  base_url: "http://localhost:11434"
  embedding_model: "nomic-embed-text"
  llm_model: "llama2"  # 可选
  timeout: 30000       # 30 秒

chromadb:
  path: "./data/chromadb"
  collection_name: "documents"
  dimension: 384

crawler:
  user_agent: "Mozilla/5.0 ..."
  timeout: 10000       # 10 秒
  headless: true
  cookies_file: ""

embedding:
  chunk_size: 1000      # 字符数
  chunk_overlap: 200    # 重叠字符数
  batch_size: 10        # 批量处理

search:
  default_top_k: 3
  min_score: 0.6        # 最低相似度
  max_results: 10

logging:
  level: "info"         # debug | info | warn | error
  file: "./logs/app.log"
  max_size: "10M"
  max_files: 5
```

### 3.4 数据流图

#### 3.4.1 文档写入流程

```
用户上传/导入
     │
     ▼
文档解析 (Parser)
  - Markdown → HTML
  - 提取元数据
     │
     ▼
文本切分 (Chunker)
  - chunk_size=1000
  - overlap=200
     │
     ▼
向量化 (Embedding)
  - 调用 Ollama API
  - 批量处理
     │
     ▼
存储到 ChromaDB
  - 生成 UUID
  - 保存元数据
     │
     ▼
返回成功
```

#### 3.4.2 RAG 查询流程

```
用户查询
     │
     ▼
查询向量化
  - Ollama Embedding
     │
     ▼
ChromaDB 相似度搜索
  - Top-K 检索
  - 元数据过滤
     │
     ▼
结果排序和过滤
  - 相似度阈值过滤
  - 去重（同一文档多 chunk）
     │
     ▼
可选：LLM 生成回答
  - 构建 Prompt
  - 调用 Ollama LLM
     │
     ▼
返回结果
```

---

## 4. API 设计

### 4.1 RESTful API 列表

#### 4.1.1 文档管理 API

**获取文档列表**
```http
GET /api/documents

Query Parameters:
  - source: 'local' | 'web' (可选)
  - tag: string (可选)
  - page: number (默认 1)
  - limit: number (默认 20)

Response 200:
{
  "total": 100,
  "page": 1,
  "limit": 20,
  "documents": [
    {
      "id": "uuid",
      "title": "文档标题",
      "source": "local",
      "tags": ["typescript"],
      "created_at": "2026-03-26T00:00:00Z",
      "chunk_total": 5
    }
  ]
}
```

**获取文档详情**
```http
GET /api/documents/:id

Response 200:
{
  "id": "uuid",
  "title": "文档标题",
  "content": "完整内容",
  "metadata": { ... },
  "chunks": [
    {
      "chunk_index": 0,
      "content": "片段内容",
      "embedding_id": "uuid"
    }
  ]
}

Response 404:
{ "error": "Document not found" }
```

**导入本地文档**
```http
POST /api/documents/import

Request Body:
{
  "type": "local",  // | "obsidian"
  "path": "/path/to/notes",
  "recursive": true,
  "tags": ["notes"]
}

Response 201:
{
  "success": true,
  "imported": 10,
  "failed": 0,
  "task_id": "uuid"
}
```

**删除文档**
```http
DELETE /api/documents/:id

Response 200:
{ "success": true }
```

**重新向量化**
```http
POST /api/documents/:id/re-embed

Response 202:
{
  "success": true,
  "task_id": "uuid"
}
```

#### 4.1.2 爬虫 API

**爬取网页**
```http
POST /api/crawler/crawl

Request Body:
{
  "url": "https://example.com/docs",
  "cookies": [
    { "name": "session", "value": "xxx", "domain": "example.com" }
  ],
  "wait_for": ".content",  // 等待选择器
  "tags": ["docs"]
}

Response 202:
{
  "success": true,
  "task_id": "uuid",
  "estimated_time": 30
}
```

**批量爬取**
```http
POST /api/crawler/batch

Request Body:
{
  "urls": ["url1", "url2", ...],
  "concurrency": 3  // 并发数
}

Response 202:
{
  "success": true,
  "task_id": "uuid",
  "total": 10
}
```

**查询任务状态**
```http
GET /api/crawler/tasks/:id

Response 200:
{
  "status": "processing",  // pending | processing | completed | failed
  "progress": 5,
  "total": 10,
  "results": [
    { "url": "url1", "status": "completed", "doc_id": "uuid" }
  ]
}
```

#### 4.1.3 搜索 API

**语义搜索**
```http
GET /api/search?q=typescript%20装饰器

Query Parameters:
  - q: string (查询文本，必需)
  - top_k: number (默认 3)
  - source: 'local' | 'web' (可选)
  - tags: string[] (可选)
  - min_score: number (默认 0.6)

Response 200:
{
  "query": "typescript 装饰器",
  "results": [
    {
      "id": "uuid",
      "title": "文档标题",
      "content": "匹配的文本片段...",
      "score": 0.85,
      "metadata": { ... }
    }
  ],
  "total": 3
}
```

**RAG 生成（可选）**
```http
POST /api/search/generate

Request Body:
{
  "query": "如何使用 TypeScript 装饰器？",
  "top_k": 3,
  "use_llm": true,
  "model": "llama2"
}

Response 200:
{
  "query": "如何使用 TypeScript 装饰器？",
  "context": [
    { "title": "...", "content": "..." }
  ],
  "answer": "根据知识库，TypeScript 装饰器的使用方法...",
  "model": "llama2",
  "tokens": {
    "prompt": 500,
    "completion": 200
  }
}
```

#### 4.1.4 系统 API

**获取系统状态**
```http
GET /api/status

Response 200:
{
  "version": "1.0.0",
  "uptime": 3600,
  "memory": {
    "used": 250,
    "total": 500
  },
  "chromadb": {
    "status": "connected",
    "document_count": 100,
    "vector_count": 500
  },
  "ollama": {
    "status": "connected",
    "models": ["nomic-embed-text", "llama2"]
  },
  "mcp": {
    "enabled": true,
    "clients": 1
  }
}
```

**获取配置**
```http
GET /api/config

Response 200:
{ "config": { ... } }
```

**更新配置**
```http
PATCH /api/config

Request Body:
{
  "search": { "default_top_k": 5 }
}

Response 200:
{ "success": true }
```

### 4.2 WebSocket API（可选）

**连接**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws')
```

**事件：任务进度更新**
```json
{
  "type": "task.progress",
  "data": {
    "task_id": "uuid",
    "status": "processing",
    "progress": 5,
    "total": 10,
    "current": "正在处理文档 5/10"
  }
}
```

**事件：文档更新**
```json
{
  "type": "document.added",
  "data": {
    "id": "uuid",
    "title": "新文档"
  }
}
```

---

## 5. MCP Server 实现

### 5.1 MCP 协议概述

**MCP (Model Context Protocol)** 是 Claude 与外部工具通信的标准协议，支持通过 stdio 进行 JSON-RPC 调用。

**通信方式**
- stdin/stdout（标准输入输出）
- JSON-RPC 2.0 协议
- 双向通信（服务器可主动推送通知）

### 5.2 MCP Server 实现

#### 5.2.1 初始化握手

```typescript
// MCP Server 启动
async function startMCPServer() {
  const stdin = process.stdin
  const stdout = process.stdout

  // 监听 stdin
  stdin.setEncoding('utf-8')
  stdin.on('data', async (data) => {
    const messages = data.toString().split('\n').filter(Boolean)

    for (const msgStr of messages) {
      const message = JSON.parse(msgStr)
      const response = await handleMessage(message)

      stdout.write(JSON.stringify(response) + '\n')
    }
  })

  // 发送初始化完成通知
  sendNotification('notifications/initialized', {
    serverInfo: {
      name: 'devrag-cli',
      version: '1.0.0'
    }
  })
}
```

#### 5.2.2 工具定义

```typescript
const tools = {
  search_knowledge_base: {
    name: 'search_knowledge_base',
    description: '搜索本地知识库，查找相关技术文档',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询（自然语言）'
        },
        top_k: {
          type: 'number',
          description: '返回结果数量（默认 3）',
          default: 3
        }
      },
      required: ['query']
    }
  },

  add_document: {
    name: 'add_document',
    description: '向知识库添加新文档',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        tags: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      required: ['title', 'content']
    }
  }
}
```

#### 5.2.3 工具调用处理

```typescript
async function handleMessage(message: JSONRPCMessage) {
  const { id, method, params } = message

  switch (method) {
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: Object.values(tools) }
      }

    case 'tools/call':
      const { name, arguments: args } = params

      try {
        const result = await callTool(name, args)
        return {
          jsonrpc: '2.0',
          id,
          result: { content: result }
        }
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: error.message
          }
        }
      }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      }
  }
}

async function callTool(name: string, args: any) {
  switch (name) {
    case 'search_knowledge_base':
      return await searchKnowledgeBase(args.query, args.top_k)

    case 'add_document':
      return await addDocument(args.title, args.content, args.tags)

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
```

#### 5.2.4 搜索工具实现

```typescript
async function searchKnowledgeBase(
  query: string,
  topK: number = 3
): Promise<string> {
  // 1. 向量化查询
  const embedding = await embedText(query)

  // 2. ChromaDB 搜索
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: topK
  })

  // 3. 格式化结果
  const formatted = results.documents[0].map((doc, i) => {
    const metadata = results.metadatas[0][i]
    const distance = results.distances[0][i]

    return `
## ${metadata.title}

**相关度**: ${(1 - distance).toFixed(2)}

${doc}

---
**来源**: ${metadata.source}
**标签**: ${metadata.tags.join(', ')}
`
  }).join('\n\n')

  return formatted || '未找到相关文档'
}
```

### 5.3 Claude Code 集成配置

**MCP 配置文件** (~/.config/claude/mcp.json)
```json
{
  "mcpServers": {
    "devrag-cli": {
      "command": "node",
      "args": ["/path/to/devrag-cli/dist/mcp-server.js"],
      "env": {
        "DEVRAG_CONFIG": "/Users/jilong5/.devrag-cli/config.yaml"
      }
    }
  }
}
```

**使用示例**
```
用户: 如何在我的项目中使用 TypeScript 装饰器？

Claude: [自动调用 search_knowledge_base 工具]
      搜索到 3 篇相关文档...
      [基于知识库内容回答]
```

---

## 6. 核心流程设计

### 6.1 笔记写入流程

#### 6.1.1 本地 Markdown 导入

```typescript
async function importMarkdownFiles(
  dirPath: string,
  options: { recursive?: boolean; tags?: string[] }
) {
  const files = await glob(dirPath, '**/*.md', { recursive: options.recursive })
  const results = { imported: 0, failed: 0, errors: [] }

  for (const file of files) {
    try {
      // 1. 读取文件
      const content = await fs.readFile(file, 'utf-8')
      const title = path.basename(file, '.md')

      // 2. 解析 Frontmatter（可选）
      const { data, content: body } = parseFrontmatter(content)

      // 3. 创建文档记录
      const doc = await createDocument({
        title: data.title || title,
        content: body,
        source: 'local',
        path: file,
        tags: data.tags || options.tags || []
      })

      results.imported++
    } catch (error) {
      results.failed++
      results.errors.push({ file, error: error.message })
    }
  }

  return results
}
```

#### 6.1.2 文档切分策略

```typescript
interface ChunkOptions {
  chunkSize: number    // 1000 字符
  overlap: number      // 200 字符
  separator: string    // "\n\n"
}

function splitText(text: string, options: ChunkOptions): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = start + options.chunkSize
    const chunk = text.slice(start, end)

    chunks.push(chunk)

    // 移动指针，保留重叠部分
    start = end - options.overlap
  }

  return chunks
}

// 优化：按段落切分
function splitByParagraph(text: string, maxChunkSize: number): string[] {
  const paragraphs = text.split(/\n\n+/)
  const chunks: string[] = []
  let currentChunk = ''

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxChunkSize) {
      if (currentChunk) chunks.push(currentChunk)
      currentChunk = para
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para
    }
  }

  if (currentChunk) chunks.push(currentChunk)

  return chunks
}
```

#### 6.1.3 向量化流程

```typescript
async function embedDocument(docId: string, content: string) {
  // 1. 文本切分
  const chunks = splitByParagraph(content, 1000)

  // 2. 批量向量化
  const embeddings = await batchEmbed(chunks)

  // 3. 存储到 ChromaDB
  const ids = []
  const documents = []
  const metadatas = []

  for (let i = 0; i < chunks.length; i++) {
    const id = uuid()
    ids.push(id)
    documents.push(chunks[i])
    metadatas.push({
      doc_id: docId,
      chunk_index: i,
      chunk_total: chunks.length,
      created_at: new Date().toISOString()
    })
  }

  await collection.add({
    ids,
    embeddings,
    documents,
    metadatas
  })

  return { chunkCount: chunks.length }
}
```

### 6.2 Wiki 爬取流程

#### 6.2.1 爬虫任务调度

```typescript
class CrawlerQueue {
  private queue: CrawlTask[] = []
  private processing = false
  private concurrency = 3

  async add(url: string, options: CrawlOptions) {
    const task: CrawlTask = {
      id: uuid(),
      url,
      options,
      status: 'pending',
      createdAt: Date.now()
    }

    this.queue.push(task)
    await this.process()
  }

  async process() {
    if (this.processing) return
    this.processing = true

    const tasks = this.queue
      .filter(t => t.status === 'pending')
      .slice(0, this.concurrency)

    await Promise.all(tasks.map(t => this.crawl(t)))

    this.processing = false
  }

  async crawl(task: CrawlTask) {
    try {
      task.status = 'processing'

      const browser = await playwright.chromium.launch({ headless: true })
      const page = await browser.newPage()

      // 注入 Cookie
      if (task.options.cookies) {
        await page.context().addCookies(task.options.cookies)
      }

      await page.goto(task.url, { waitUntil: 'networkidle' })

      // 等待主要内容加载
      if (task.options.waitFor) {
        await page.waitForSelector(task.options.waitFor)
      }

      // 提取内容
      const content = await extractContent(page)

      // 保存到知识库
      await createDocument({
        title: await page.title(),
        content,
        source: 'web',
        url: task.url,
        tags: task.options.tags || []
      })

      task.status = 'completed'
      task.result = { success: true }

      await browser.close()
    } catch (error) {
      task.status = 'failed'
      task.error = error.message
    }
  }
}
```

#### 6.2.2 内容提取策略

```typescript
async function extractContent(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // 移除无关元素
    const removeSelectors = [
      'nav', 'aside', 'footer', 'header',
      '.navigation', '.sidebar', '.advertisement',
      'script', 'style', 'noscript'
    ]

    removeSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => el.remove())
    })

    // 智能提取主要内容
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '#content',
      'body'
    ]

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector)
      if (element) {
        return element.innerText.trim()
      }
    }

    return ''
  })
}
```

### 6.3 RAG 查询流程

#### 6.3.1 语义搜索实现

```typescript
async function semanticSearch(
  query: string,
  options: {
    topK?: number
    minScore?: number
    filters?: Record<string, any>
  } = {}
) {
  const { topK = 3, minScore = 0.6, filters = {} } = options

  // 1. 向量化查询
  const embedding = await embedText(query)

  // 2. ChromaDB 搜索
  const results = await collection.query({
    queryEmbeddings: [embedding],
    nResults: topK * 2,  // 获取更多结果，用于去重
    where: filters
  })

  // 3. 处理结果
  const documents = []
  const seenDocIds = new Set<string>()

  for (let i = 0; i < results.ids[0].length; i++) {
    const docId = results.metadatas[0][i].doc_id
    const score = 1 - results.distances[0][i]

    // 过滤低分结果
    if (score < minScore) continue

    // 去重（同一文档只返回最相关的 chunk）
    if (seenDocIds.has(docId)) continue
    seenDocIds.add(docId)

    documents.push({
      id: docId,
      content: results.documents[0][i],
      metadata: results.metadatas[0][i],
      score
    })

    if (documents.length >= topK) break
  }

  return documents
}
```

#### 6.3.2 混合检索（语义 + 关键词）

```typescript
async function hybridSearch(
  query: string,
  options: SearchOptions
) {
  // 并行执行两种搜索
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(query, options),
    keywordSearch(query, options)  // 使用 ElasticSearch 或 SQLite FTS
  ])

  // 融合排序（Reciprocal Rank Fusion）
  const fusedResults = reciprocalRankFusion(
    semanticResults,
    keywordResults
  )

  return fusedResults.slice(0, options.topK)
}

function reciprocalRankFusion(
  results1: SearchResult[],
  results2: SearchResult[],
  k: number = 60
) {
  const scores = new Map<string, number>()

  // 计算第一组结果的 RRF 分数
  results1.forEach((result, index) => {
    const score = 1 / (k + index + 1)
    scores.set(result.id, (scores.get(result.id) || 0) + score)
  })

  // 计算第二组结果的 RRF 分数
  results2.forEach((result, index) => {
    const score = 1 / (k + index + 1)
    scores.set(result.id, (scores.get(result.id) || 0) + score)
  })

  // 合并去重
  const allResults = [...results1, ...results2]
  const uniqueResults = Array.from(
    new Map(allResults.map(r => [r.id, r])).values()
  )

  // 按融合分数排序
  return uniqueResults.sort((a, b) => {
    return (scores.get(b.id) || 0) - (scores.get(a.id) || 0)
  })
}
```

#### 6.3.3 RAG 生成流程

```typescript
async function ragGenerate(query: string, options: RAGOptions) {
  // 1. 检索相关文档
  const context = await semanticSearch(query, {
    topK: options.topK || 3
  })

  // 2. 构建 Prompt
  const prompt = buildPrompt(query, context)

  // 3. 调用 LLM
  const answer = await callOllama(prompt, options.model)

  return {
    query,
    context,
    answer,
    sources: context.map(c => ({ id: c.id, title: c.metadata.title }))
  }
}

function buildPrompt(query: string, context: SearchResult[]): string {
  const contextText = context
    .map((c, i) => `[文档 ${i + 1}] ${c.metadata.title}\n${c.content}`)
    .join('\n\n---\n\n')

  return `
你是一个技术助手。请根据以下知识库内容回答用户问题。

知识库内容：
${contextText}

用户问题：
${query}

请基于知识库内容回答，如果知识库中没有相关信息，请明确说明。
`
}
```

### 6.4 MCP 服务流程

```typescript
// MCP Server 主循环
async function runMCPServer() {
  process.stdin.setEncoding('utf-8')

  for await (const line of process.stdin) {
    const message = JSON.parse(line)

    try {
      const response = await handleMessage(message)
      process.stdout.write(JSON.stringify(response) + '\n')
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: error.message,
          data: error.stack
        }
      }
      process.stdout.write(JSON.stringify(errorResponse) + '\n')
    }
  }
}
```

---

## 7. 安全设计

### 7.1 数据隐私保护

#### 7.1.1 本地优先原则

**所有数据存储在本地**
- ✅ ChromaDB 数据库：~/.devrag-cli/data/chromadb/
- ✅ 文档原始文件：~/.devrag-cli/data/documents/
- ✅ 日志文件：~/.devrag-cli/logs/
- ❌ 不上传任何数据到云端
- ❌ 不包含遥测功能
- ❌ 不收集用户使用数据

**代码保证**
```typescript
// 启动时检查本地存储
async function ensureLocalDataDir() {
  const dataDir = path.join(homeDir, '.devrag-cli/data')

  // 确保目录存在
  await fs.mkdir(dataDir, { recursive: true })

  // 检查权限（仅用户可读写）
  const stats = await fs.stat(dataDir)
  const mode = stats.mode & 0o777

  if (mode !== 0o700) {
    await fs.chmod(dataDir, 0o700)
  }
}
```

#### 7.1.2 网络隔离

**Web 服务默认仅监听本地**
```typescript
const server = serve({
  fetch: app.fetch,
  port: 3000,
  hostname: '127.0.0.1'  // 仅本地访问
})
```

**可选远程访问（用户明确配置）**
```yaml
# config.yaml
server:
  host: "0.0.0.0"  # 允许远程访问（用户自行承担风险）
  auth:
    enabled: true
    password: "user-defined-password"
```

#### 7.1.3 敏感信息脱敏

**自动检测和脱敏**
```typescript
const SENSITIVE_PATTERNS = [
  { name: 'API Key', pattern: /(?:api[_-]?key|token)["\']?\s*[:=]\s*["\']?([a-zA-Z0-9_-]{20,})/gi },
  { name: 'Password', pattern: /password["\']?\s*[:=]\s*["\']?([^"'\s]+)/gi },
  { name: 'Email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g }
]

function redactSensitiveInfo(text: string): string {
  let redacted = text

  for (const { name, pattern } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, `[REDACTED ${name}]`)
  }

  return redacted
}
```

### 7.2 访问控制

#### 7.2.1 Web 服务认证（可选）

```typescript
// Basic Auth 中间件
async function authMiddleware(c: Context, next: Next) {
  const config = getConfig()

  if (!config.server.auth.enabled) {
    return next()
  }

  const authHeader = c.req.header('Authorization')

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return c.text('Unauthorized', 401, {
      'WWW-Authenticate': 'Basic realm="devrag-cli"'
    })
  }

  const base64 = authHeader.slice(6)
  const [username, password] = Buffer.from(base64, 'base64')
    .toString()
    .split(':')

  if (username !== 'admin' || password !== config.server.auth.password) {
    return c.text('Invalid credentials', 401)
  }

  return next()
}
```

#### 7.2.2 MCP 通信安全

**MCP 使用 stdio，天然安全**
- ✅ 本地进程间通信
- ✅ 无网络暴露
- ✅ 继承父进程（Claude Code）权限

**额外保护**
```typescript
// 验证 MCP 客户端身份
const MCP_ALLOWED_CLIENTS = [
  'claude-code',
  'cursor'
]

function validateMCPClient(clientInfo: string): boolean {
  return MCP_ALLOWED_CLIENTS.includes(clientInfo)
}
```

### 7.3 数据加密（可选）

#### 7.3.1 ChromaDB 加密

**使用 SQLite Encryption Extension (SEE)**
```typescript
// 需要用户配置密钥
const encryptionKey = process.env.DEVRAG_ENCRYPTION_KEY

if (encryptionKey) {
  // 使用加密模式启动 ChromaDB
  const client = new ChromaClient({
    path: `sqlite3://${path}?key=${encryptionKey}`
  })
}
```

#### 7.3.2 文档加密存储

```typescript
import crypto from 'crypto'

function encryptDocument(content: string, key: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv)

  let encrypted = cipher.update(content, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return JSON.stringify({
    iv: iv.toString('hex'),
    data: encrypted,
    authTag: authTag.toString('hex')
  })
}

function decryptDocument(encrypted: string, key: string): string {
  const { iv, data, authTag } = JSON.parse(encrypted)

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key),
    Buffer.from(iv, 'hex')
  )

  decipher.setAuthTag(Buffer.from(authTag, 'hex'))

  let decrypted = decipher.update(data, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

### 7.4 安全审计日志

```typescript
interface SecurityEvent {
  timestamp: string
  type: 'auth' | 'access' | 'data_operation'
  event: string
  details: Record<string, any>
}

function logSecurityEvent(event: SecurityEvent) {
  const logPath = path.join(homeDir, '.devrag-cli/logs/security.log')

  fs.appendFileSync(logPath, JSON.stringify(event) + '\n')
}

// 使用示例
logSecurityEvent({
  timestamp: new Date().toISOString(),
  type: 'auth',
  event: 'login_success',
  details: { ip: '127.0.0.1', user: 'admin' }
})
```

---

## 8. 性能优化

### 8.1 向量化性能优化

#### 8.1.1 批量处理

```typescript
// 批量向量化，减少网络开销
async function batchEmbed(texts: string[], batchSize = 10): Promise<number[][]> {
  const results: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)

    const embeddings = await Promise.all(
      batch.map(text => embedText(text))
    )

    results.push(...embeddings)
  }

  return results
}
```

#### 8.1.2 向量缓存

```typescript
const embeddingCache = new LRUCache<string, number[]>({ max: 1000 })

async function cachedEmbedText(text: string): Promise<number[]> {
  const cacheKey = crypto.createHash('sha256').update(text).digest('hex')

  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!
  }

  const embedding = await embedText(text)
  embeddingCache.set(cacheKey, embedding)

  return embedding
}
```

#### 8.1.3 并发控制

```typescript
import pLimit from 'p-limit'

const limit = pLimit(5)  // 最多 5 个并发请求

async function parallelEmbed(texts: string[]): Promise<number[][]> {
  return Promise.all(
    texts.map(text => limit(() => embedText(text)))
  )
}
```

### 8.2 搜索性能优化

#### 8.2.1 ChromaDB 索引优化

```typescript
// 创建 Collection 时配置索引
const collection = await client.getOrCreateCollection({
  name: 'documents',
  metadata: {
    dimension: 384,
    // HNSW 索引参数
    hnsw: {
      M: 16,              // 连接数
      ef_construction: 200 // 构建时搜索深度
    }
  }
})
```

#### 8.2.2 查询结果缓存

```typescript
const queryCache = new LRUCache<string, SearchResult[]>({ max: 100 })

async function cachedSearch(query: string, options: SearchOptions) {
  const cacheKey = `${query}:${JSON.stringify(options)}`

  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey)!
  }

  const results = await semanticSearch(query, options)
  queryCache.set(cacheKey, results)

  return results
}
```

#### 8.2.3 分页加载

```typescript
async function searchWithPagination(
  query: string,
  options: { page: number; pageSize: number }
) {
  const skip = (options.page - 1) * options.pageSize

  const results = await collection.query({
    queryTexts: [query],
    nResults: options.page * options.pageSize
  })

  const paginated = {
    data: results.documents[0].slice(skip),
    total: results.documents[0].length,
    page: options.page,
    pageSize: options.pageSize
  }

  return paginated
}
```

### 8.3 Web 服务性能优化

#### 8.3.1 静态资源缓存

```typescript
app.get('/*', serveStatic({
  root: './public',
  cache: {
    maxAge: 3600  // 1 小时
  }
}))
```

#### 8.3.2 响应压缩

```typescript
import { compress } from 'hono/compress'

app.use('*', compress())
```

#### 8.3.3 连接池

```typescript
// Ollama HTTP 连接池
import { Agent } from 'undici'

const ollamaAgent = new Agent({
  keepAliveTimeout: 60000,
  keepAliveMaxTimeout: 300000
})

async function callOllamaAPI(path: string, body: any) {
  return fetch(`http://localhost:11434${path}`, {
    body: JSON.stringify(body),
    dispatcher: ollamaAgent
  })
}
```

### 8.4 内存优化

#### 8.4.1 流式处理大文件

```typescript
import { createReadStream } from 'fs'

async function processLargeFile(filePath: string) {
  const stream = createReadStream(filePath)

  let buffer = ''
  let chunkIndex = 0

  for await (const chunk of stream) {
    buffer += chunk

    if (buffer.length >= 10000) {
      await processChunk(buffer, chunkIndex++)
      buffer = ''
    }
  }

  if (buffer) {
    await processChunk(buffer, chunkIndex)
  }
}
```

#### 8.4.2 向量数据库分片

```typescript
// 按时间分片，避免单个 Collection 过大
async function getShardedCollection(date: Date) {
  const shardName = `documents_${date.getFullYear()}_${date.getMonth() + 1}`

  return await client.getOrCreateCollection({
    name: shardName,
    metadata: { dimension: 384 }
  })
}

async function searchAcrossShards(query: string, topK: number) {
  const collections = await listCollections()

  const results = await Promise.all(
    collections.map(col => col.query({ queryTexts: [query], nResults: topK }))
  )

  // 合并和排序
  return mergeAndRankResults(results, topK)
}
```

### 8.5 性能监控

```typescript
// 性能指标收集
const metrics = {
  searchTimes: [] as number[],
  embedTimes: [] as number[],
  queryCounts: new Map<string, number>()
}

function recordMetric(type: 'search' | 'embed', duration: number) {
  if (type === 'search') {
    metrics.searchTimes.push(duration)
  } else {
    metrics.embedTimes.push(duration)
  }
}

function getPerformanceStats() {
  return {
    avgSearchTime: average(metrics.searchTimes),
    avgEmbedTime: average(metrics.embedTimes),
    totalQueries: Array.from(metrics.queryCounts.values()).reduce((a, b) => a + b, 0)
  }
}
```

---

## 9. 部署方案

### 9.1 CLI 工具部署

#### 9.1.1 安装方式

**方式 1：npm 全局安装**
```bash
npm install -g devrag-cli
devrag-cli start
```

**方式 2：npx 直接运行**
```bash
npx devrag-cli start
```

**方式 3：本地开发**
```bash
git clone https://github.com/xxx/devrag-cli.git
cd devrag-cli
npm install
npm run build
npm link
devrag-cli start
```

#### 9.1.2 目录结构

```
devrag-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli/
│   │   ├── index.ts          # CLI 入口
│   │   ├── commands/
│   │   │   ├── start.ts
│   │   │   ├── import.ts
│   │   │   ├── crawl.ts
│   │   │   └── search.ts
│   ├── server/
│   │   ├── index.ts          # Hono 服务器
│   │   ├── routes/
│   │   │   ├── documents.ts
│   │   │   ├── search.ts
│   │   │   └── crawler.ts
│   │   └── middleware/
│   ├── services/
│   │   ├── chroma.ts
│   │   ├── ollama.ts
│   │   ├── crawler.ts
│   │   └── embedding.ts
│   ├── mcp/
│   │   ├── server.ts         # MCP Server
│   │   └── tools.ts
│   └── utils/
│       ├── config.ts
│       ├── logger.ts
│       └── queue.ts
├── public/                   # 静态资源
│   ├── index.html
│   ├── app.js
│   └── styles.css
└── dist/                     # 编译输出
```

#### 9.1.3 打包和发布

**package.json 配置**
```json
{
  "name": "devrag-cli",
  "version": "1.0.0",
  "bin": {
    "devrag-cli": "./dist/cli/index.js"
  },
  "files": [
    "dist",
    "public"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli/index.ts",
    "start": "node dist/cli/index.js",
    "prepublishOnly": "npm run build"
  }
}
```

**发布到 npm**
```bash
npm publish
```

### 9.2 进程管理

#### 9.2.1 使用 PM2（推荐）

**安装 PM2**
```bash
npm install -g pm2
```

**配置文件 (ecosystem.config.js)**
```javascript
module.exports = {
  apps: [{
    name: 'devrag-cli',
    script: '/path/to/devrag-cli/dist/cli/index.js',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

**启动和停止**
```bash
pm2 start ecosystem.config.js
pm2 stop devrag-cli
pm2 restart devrag-cli
pm2 logs devrag-cli
pm2 monit
```

#### 9.2.2 使用 systemd (Linux)

**服务文件 (/etc/systemd/system/devrag-cli.service)**
```ini
[Unit]
Description=DevRag CLI Knowledge Base
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/devrag-cli
ExecStart=/usr/bin/node /home/ubuntu/devrag-cli/dist/cli/index.js start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**启用服务**
```bash
sudo systemctl daemon-reload
sudo systemctl enable devrag-cli
sudo systemctl start devrag-cli
sudo systemctl status devrag-cli
```

#### 9.2.3 使用 launchd (macOS)

**启动文件 (~/Library/LaunchAgents/com.devrag.cli.plist)**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.devrag.cli</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/devrag-cli/dist/cli/index.js</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/devrag-cli.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/devrag-cli.error.log</string>
</dict>
</plist>
```

**加载服务**
```bash
launchctl load ~/Library/LaunchAgents/com.devrag.cli.plist
launchctl unload ~/Library/LaunchAgents/com.devrag.cli.plist
```

### 9.3 依赖服务管理

#### 9.3.1 Ollama 安装和启动

**macOS**
```bash
brew install ollama
ollama serve  # 后台运行
```

**Linux**
```bash
curl -fsSL https://ollama.com/install.sh | sh
systemctl start ollama
systemctl enable ollama
```

**启动脚本**
```bash
#!/bin/bash
# start-devrag-cli.sh

# 检查 Ollama
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
  echo "Starting Ollama..."
  ollama serve &
  sleep 5
fi

# 启动 devrag-cli
devrag-cli start
```

#### 9.3.2 ChromaDB Docker（可选）

**如果使用 Docker 版本的 ChromaDB**
```bash
docker run -d \
  --name chromadb \
  -p 8000:8000 \
  -v ~/.devrag-cli/data/chromadb:/chroma/chroma \
  chromadb/chroma:latest
```

**docker-compose.yml**
```yaml
version: '3.8'
services:
  chromadb:
    image: chromadb/chroma:latest
    container_name: devrag-chromadb
    ports:
      - "8000:8000"
    volumes:
      - ~/.devrag-cli/data/chromadb:/chroma/chroma
    restart: unless-stopped

  devrag-cli:
    build: .
    container_name: devrag-cli
    depends_on:
      - chromadb
    ports:
      - "3000:3000"
    volumes:
      - ~/.devrag-cli:/app/data
    restart: unless-stopped
```

### 9.4 健康检查

```typescript
// 健康检查端点
app.get('/health', async (c) => {
  const checks = {
    server: 'ok',
    chromadb: await checkChromaDB(),
    ollama: await checkOllama(),
    disk: await checkDiskSpace()
  }

  const healthy = Object.values(checks).every(v => v === 'ok')

  return c.json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks
  }, healthy ? 200 : 503)
})

async function checkChromaDB(): Promise<string> {
  try {
    await client.heartbeat()
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkOllama(): Promise<string> {
  try {
    await fetch('http://localhost:11434/api/tags')
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkDiskSpace(): Promise<string> {
  const stats = await fs.statfs(homeDir)
  const free = stats.bavail * stats.bsize
  const freeGB = free / (1024 ** 3)

  return freeGB > 1 ? 'ok' : 'low'
}
```

---

## 10. 架构决策记录 (ADR)

### ADR-001: 选择 ChromaDB 作为向量数据库

**状态**: 已接受

**上下文**
需要选择一个向量数据库来存储文档向量，支持语义搜索。主要考虑因素包括：
- 本地部署（不上传云端）
- 轻量级（个人使用场景）
- 与 Node.js 技术栈兼容
- 易于集成和维护

**决策**
选择 **ChromaDB** 作为向量数据库。

**理由**
- ✅ 轻量级：无需单独部署服务，JavaScript 客户端直接集成
- ✅ 本地优先：数据存储在本地文件系统，保护隐私
- ✅ 易用性：API 简单，学习成本低
- ✅ 持久化：支持数据持久化，重启不丢失
- ✅ 元数据过滤：支持按标签、来源等过滤
- ✅ 技术栈匹配：原生 JavaScript 支持

**后果**
- 正面：
  - 部署简单，无需额外服务
  - 开发效率高
  - 满足个人使用场景的性能需求
- 负面：
  - 性能不如 Qdrant、Milvus 等专业向量数据库
  - 不支持分布式（未来如需团队协作需要迁移）
- 缓解措施：
  - MVP 阶段性能足够
  - 未来可迁移到 Qdrant（API 抽象层）

**替代方案**
- Qdrant：性能更强，但需要单独部署服务
- Milvus：企业级，过重，部署复杂
- Pinecone：云服务，不符合本地优先原则

### ADR-002: 选择 Ollama 作为 Embedding 和 LLM 服务

**状态**: 已接受

**上下文**
需要选择一个 Embedding 服务将文本向量化，以及可选的 LLM 服务生成回答。主要考虑因素包括：
- 本地运行（数据隐私）
- 成本（免费优先）
- 模型质量
- 部署复杂度

**决策**
选择 **Ollama** 作为 Embedding 和 LLM 服务。

**理由**
- ✅ 本地运行：完全在本地运行，数据不上传
- ✅ 免费：无 API 调用成本
- ✅ 模型丰富：支持 nomic-embed-text、llama2、qwen 等
- ✅ 性能优化：支持 Apple Silicon GPU 加速
- ✅ 易用性：一行命令安装和启动

**后果**
- 正面：
  - 完全本地，隐私保护
  - 零成本
  - 足够的模型质量（Embedding 质量 ≈ OpenAI）
- 负面：
  - LLM 生成速度较慢（相比 GPT-4）
  - 需要用户手动安装 Ollama
  - 模型质量略低于 GPT-4
- 缓解措施：
  - RAG 场景主要依赖 Embedding，LLM 质量影响较小
  - 提供详细安装文档
  - 未来可支持切换到 OpenAI API（可选）

**替代方案**
- OpenAI API：质量高，但收费且数据上传
- HuggingFace Transformers：开源，但需要 Python 环境
- Cohere API：收费，数据上传

### ADR-003: 选择 Playwright 作为爬虫引擎

**状态**: 已接受

**上下文**
需要爬取动态网页（JavaScript 渲染），特别是公司内部技术文档。主要考虑因素包括：
- 动态网页支持
- 反爬虫对抗能力
- 易用性和维护性
- 多浏览器支持

**决策**
选择 **Playwright** 作为爬虫引擎。

**理由**
- ✅ 动态网页：完美支持 JavaScript 渲染
- ✅ 自动等待：智能等待元素加载，减少手动 sleep
- ✅ 反爬虫：支持注入 Cookie、修改 User-Agent
- ✅ 多浏览器：支持 Chrome、Firefox、Safari
- ✅ 易用性：API 设计优秀，文档完善
- ✅ 官方支持：微软维护，活跃更新

**后果**
- 正面：
  - 可爬取几乎所有网页
  - 开发效率高
  - 社区支持好
- 负面：
  - 包体积较大（~200MB）
  - 资源占用较高（需要启动浏览器）
- 缓解措施：
  - 使用 headless 模式减少资源占用
  - 复用浏览器实例

**替代方案**
- Puppeteer：功能类似，但 Playwright API 更好
- Cheerio：轻量，但不支持动态网页
- Axios + HTML Parser：轻量，但不支持 JS 渲染

### ADR-004: 选择纯静态前端（无构建步骤）

**状态**: 已接受

**上下文**
需要开发一个 Web 管理界面，用于文档管理、搜索、监控。主要考虑因素包括：
- 开发效率
- 部署复杂度
- 性能
- 维护成本

**决策**
选择 **纯静态 HTML/CSS/JS**，不使用前端框架。

**理由**
- ✅ 零构建步骤：无需 Webpack/Vite，快速迭代
- ✅ 轻量级：总大小 < 100KB
- ✅ 易维护：原生 JavaScript，学习成本低
- ✅ 性能：无框架开销，加载速度快
- ✅ 适用场景：个人工具，不需要复杂状态管理

**技术栈**
- HTML5
- Tailwind CSS（CDN 引入）
- Alpine.js（轻量级响应式）
- Font Awesome（图标）

**后果**
- 正面：
  - 快速开发和迭代
  - 部署简单（静态文件）
  - 性能优秀
- 负面：
  - 缺少组件化（可用 Alpine.js 弥补）
  - 不适合大型应用（但个人工具足够）
- 缓解措施：
  - 使用 Alpine.js 实现轻量级组件化
  - 代码模块化（按功能拆分 JS 文件）

**替代方案**
- Vue.js：组件化好，但需要构建步骤
- React：生态丰富，但过重
- Svelte：现代，但需要编译

### ADR-005: 选择 Hono 作为 Web 框架

**状态**: 已接受

**上下文**
需要选择一个 Node.js Web 框架来提供 REST API 和 Web 服务。主要考虑因素包括：
- 性能
- TypeScript 支持
- API 设计
- 生态系统

**决策**
选择 **Hono** 作为 Web 框架。

**理由**
- ✅ 轻量级：核心包 < 100KB，启动速度快
- ✅ TypeScript 原生：完整的类型推导
- ✅ 高性能：基于 Web Standard API
- ✅ 简洁 API：类似 Express 但更现代
- ✅ 中间件生态：支持 CORS、日志、鉴权等
- ✅ 多运行时：支持 Node.js、Bun、Deno

**后果**
- 正面：
  - 开发体验好（TypeScript）
  - 性能优秀
  - 现代化设计
- 负面：
  - 生态不如 Express（但足够用）
  - 相对较新，社区较小
- 缓解措施：
  - 核心功能不依赖复杂中间件
  - 必要时可以自行实现中间件

**替代方案**
- Express：生态成熟，但性能较差，TypeScript 支持一般
- Fastify：性能好，但 API 设计不如 Hono
- Koa：优雅，但性能一般

### ADR-006: MCP 使用 stdio 通信而非 SSE/WebSocket

**状态**: 已接受

**上下文**
MCP 协议支持多种传输方式（stdio、SSE、WebSocket）。需要选择适合 devrag-cli 的通信方式。

**决策**
选择 **stdio** 作为 MCP 传输方式。

**理由**
- ✅ 本地通信：devrag-cli 和 Claude Code 在同一台机器
- ✅ 简单性：无需额外网络配置
- ✅ 安全性：无网络暴露风险
- ✅ 标准支持：MCP 官方推荐 stdio 用于本地工具
- ✅ 资源占用：无需维护 WebSocket 连接

**后果**
- 正面：
  - 实现简单
  - 安全可靠
  - 资源占用低
- 负面：
  - 不支持远程调用（但本地场景不需要）
  - 双向通信需要 JSON-RPC 轮询（但 MCP 协议已支持）
- 缓解措施：
  - 未来如需远程访问，可添加 WebSocket 支持

**替代方案**
- WebSocket：支持远程，但增加复杂度
- SSE：服务器推送，但不支持双向通信

### ADR-007: 选择内存队列 + 持久化而非 Redis

**状态**: 已接受

**上下文**
需要一个任务队列来异步处理文档向量化。主要考虑因素包括：
- 部署复杂度
- 持久化需求
- 性能要求

**决策**
选择 **内存队列 + 文件持久化**，不使用 Redis。

**理由**
- ✅ 零依赖：无需额外部署 Redis
- ✅ 简单性：实现和维护成本低
- ✅ 性能：内存队列足够快
- ✅ 持久化：支持重启恢复（通过文件）

**实现**
```typescript
class TaskQueue {
  private queue: Task[] = []
  private storage: FileStorage

  async add(task: Task) {
    this.queue.push(task)
    await this.storage.save(task)
  }

  async restore() {
    this.queue = await this.storage.load()
  }
}
```

**后果**
- 正面：
  - 部署简单
  - 开发效率高
  - 满足个人场景的性能需求
- 负面：
  - 不支持多进程共享
  - 持久化性能不如 Redis
- 缓解措施：
  - MVP 阶段单进程足够
  - 未来可迁移到 Redis/BullMQ

**替代方案**
- Redis + BullMQ：功能强大，但需要额外部署
- PostgreSQL：持久化好，但过重

### ADR-008: 选择 YAML 作为配置文件格式

**状态**: 已接受

**上下文**
需要一种配置文件格式来管理系统配置。主要考虑因素包括：
- 可读性
- 注释支持
- 解析性能

**决策**
选择 **YAML** 作为配置文件格式。

**理由**
- ✅ 可读性：比 JSON 更易读
- ✅ 注释支持：支持添加注释说明
- ✅ 层级结构：适合复杂配置
- ✅ 生态：广泛使用，用户熟悉

**配置示例**
```yaml
server:
  port: 3000
  host: "127.0.0.1"

ollama:
  base_url: "http://localhost:11434"
  model: "nomic-embed-text"
```

**后果**
- 正面：
  - 用户友好
  - 支持注释
  - 易于维护
- 负面：
  - 解析速度略慢于 JSON（可忽略）
  - 语法较严格（缩进）
- 缓解措施：
  - 提供配置示例
  - 启动时验证配置

**替代方案**
- JSON：简单，但不支持注释
- TOML：可读性好，但生态不如 YAML
- INI：简单，但不适合复杂配置

---

## 11. 附录

### 11.1 技术术语表

| 术语 | 解释 |
|------|------|
| RAG | Retrieval-Augmented Generation，检索增强生成 |
| MCP | Model Context Protocol，模型上下文协议 |
| Embedding | 文本向量化，将文本转换为数值向量 |
| Chunk | 文本切分后的片段 |
| Vector Database | 向量数据库，存储和检索向量数据 |
| Semantic Search | 语义搜索，基于向量相似度的搜索 |
| Hybrid Search | 混合检索，结合语义搜索和关键词匹配 |
| HNSW | Hierarchical Navigable Small World，向量索引算法 |
| stdio | 标准输入输出，进程间通信方式 |
| JSON-RPC | JSON Remote Procedure Call，远程调用协议 |

### 11.2 参考资源

**技术文档**
- [ChromaDB 官方文档](https://docs.trychroma.com/)
- [Ollama 官方文档](https://ollama.com/)
- [Playwright 官方文档](https://playwright.dev/)
- [Hono 官方文档](https://hono.dev/)
- [Claude MCP 规范](https://modelcontextprotocol.io/)

**竞品参考**
- PrivateGPT: https://github.com/zylon-ai/private-gpt
- Quivr: https://github.com/QuivrHQ/quivr
- Obsidian + Local GPT

### 11.3 版本历史

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-03-26 | 初始版本 | 架构师 |

---

**文档结束**
