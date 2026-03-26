# DevRAG - 开发者知识库本地 RAG 产品设计 v2

> 基于团队协作报告优化的完整设计文档

## 产品概述

**目标用户**：使用 Claude AI 辅助开发的程序员（**个人工具**）

**核心价值**：将公司内部技术文档、wiki、本地笔记整合为本地 RAG，为 Claude 提供专业领域知识，提升开发效率

**产品形态**：
- 轻量化 CLI 工具
- 单命令启动本地 Web 服务
- 无需客户端安装

**核心设计原则**：
- ✅ **极简轻量**：最小依赖，快速启动
- ✅ **本地优先**：数据安全，无隐私泄露
- ✅ **灵活抓取**：Playwright + XPath 支持登录认证

---

## 核心功能模块

### 1. 本地笔记管理
- **支持格式**：Markdown (.md)
- **存储位置**：`~/.devrag/notes/`
- **功能**：
  - 创建/编辑/删除笔记
  - 标签分类
  - 全文搜索
  - 自动保存（防丢失）

### 2. 内部 Wiki 抓取
- **核心方案**：**Playwright + 选择器**（支持动态页面 + 登录认证）
- **支持场景**：
  - 自有 Wiki 平台（任意 HTTP/HTTPS 站点）
  - 需要登录的内部系统
  - 动态渲染的内容（SPA）
- **提取方式**：
  - **CSS 选择器**（简单场景）
  - **XPath**（复杂结构，参考团队报告）
  - 智能内容提取（去除导航、广告、脚本）
- **抓取策略**：
  - 增量更新（基于 URL 去重）
  - 认证支持（Cookie/脚本登录）
  - 并发控制（p-queue，避免过载）
  - 反爬虫处理（随机延迟、重试）

### 3. 向量化与索引
- **Embedding 模型**：
  - 默认：**Ollama** 本地模型（nomic-embed-text）
  - 可选：OpenAI API（需要配置）
- **向量存储**：**LanceDB**（嵌入式，轻量级）
- **全文检索**：**SQLite FTS5**（内置，无需额外服务）
- **索引策略**：
  - 分块索引（按段落/章节，500-1000 tokens）
  - 增量更新（只索引新增/修改内容）
  - 混合检索（全文 + 语义 RRF 融合）

### 4. RAG 查询接口
- **REST API**：`POST /api/rag/query`
- **查询模式**：
  - `fulltext`：全文检索
  - `semantic`：语义检索
  - `hybrid`：混合检索（RRF 算法）
- **输入**：用户问题/代码上下文
- **输出**：相关文档片段 + 相似度分数 + 来源
- **集成**：
  - Claude Code MCP Server
  - Claude API 直接调用

### 5. Web 管理界面
- **技术栈**：**纯静态 HTML + 原生 JS**（最轻量）
- **功能**：
  - 笔记管理（CRUD）
  - 爬虫任务管理
  - 知识库浏览与搜索
  - 系统状态监控
- **性能优化**：
  - 虚拟滚动（大列表）
  - 防抖搜索（300ms）
  - 懒加载

---

## 技术架构（最终方案）

### 后端核心
```
CLI 工具 (Node.js)
├── HTTP 服务器：Hono（超轻量，37KB）
├── Playwright 爬虫引擎
├── Ollama Embedding 集成
├── LanceDB 向量存储
├── SQLite FTS5 全文检索
└── REST API
```

### 前端
```
纯静态 HTML/CSS/JS（零框架）
├── 简单的 Markdown 编辑器
├── 任务管理界面
└── 搜索组件
```

### 数据存储
```
~/.devrag/
├── notes/           # Markdown 笔记
├── crawled/         # 抓取的内容（Markdown）
├── index/
│   ├── lancedb/     # 向量索引
│   └── sqlite.db    # 元数据 + 全文索引
├── config/
│   └── config.yaml  # 配置文件
└── cache/           # 爬虫缓存
```

---

## 核心工作流程

### 用户使用流程
```bash
# 1. 初始化
devrag init
# → 创建 ~/.devrag/ 目录结构
# → 生成默认配置文件

# 2. 启动服务
devrag start
# → 启动 Web 服务 (http://localhost:3000)
# → 自动加载已有索引

# 3. 添加知识源（通过 Web 界面或 CLI）
devrag source add --type local --path ~/docs/notes
devrag source add --type wiki --url https://wiki.company.com

# 4. 构建索引
devrag index build

# 5. 查询（API 或 Web 界面）
devrag query "如何配置 OAuth？"
```

### 抓取流程（参考团队报告优化）
```
配置抓取任务（URL + 选择器）
  ↓
认证登录（Cookie/脚本）
  ↓
并发抓取（p-queue 控制并发数）
  ↓
内容提取（CSS/XPath 选择器）
  ↓
清洗去噪（去除导航/广告）
  ↓
存储本地（Markdown 格式）
  ↓
构建索引（全文 + 向量）
```

### 混合检索流程（RRF 算法）
```javascript
// 参考：团队协作报告的 RRF 算法
function hybridSearch(query, alpha = 0.5, topK = 10) {
  // 1. 全文检索（SQLite FTS5）
  const fulltextResults = fts5Search(query, topK * 2)

  // 2. 语义检索（LanceDB）
  const queryVector = ollamaEmbed(query)
  const semanticResults = lanceDBSearch(queryVector, topK * 2)

  // 3. RRF 融合
  const scores = {}
  const k = 60

  fulltextResults.forEach((doc, rank) => {
    scores[doc.id] = (scores[doc.id] || 0) + alpha / (k + rank + 1)
  })

  semanticResults.forEach((doc, rank) => {
    scores[doc.id] = (scores[doc.id] || 0) + (1 - alpha) / (k + rank + 1)
  })

  // 4. 排序返回 Top-K
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id, score]) => ({ id, score }))
}
```

---

## 配置文件（参考团队报告）

```yaml
# ~/.devrag/config.yaml
server:
  port: 3000
  host: 127.0.0.1

storage:
  data_dir: ~/.devrag
  notes_dir: ~/.devrag/notes
  crawled_dir: ~/.devrag/crawled
  index_dir: ~/.devrag/index

embedding:
  provider: ollama  # ollama | openai
  model: nomic-embed-text
  ollama_base_url: http://localhost:11434
  openai_api_key: ${OPENAI_API_KEY}  # 可选

vector_db:
  type: lancedb
  path: ~/.devrag/index/lancedb

fulltext:
  type: sqlite_fts5
  path: ~/.devrag/index/sqlite.db

crawler:
  concurrency: 3  # 最大并发数
  delay: 1000     # 请求间隔（ms）
  timeout: 30000  # 单页超时（ms）
  max_depth: 5    # 最大递归深度
  user_agent: "DevRAG/1.0 (+https://github.com/user/devrag)"

# 知识源配置
sources:
  # 本地笔记目录
  - type: local_notes
    name: 我的笔记
    path: ~/Documents/notes
    enabled: true

  # Wiki 爬虫配置
  - type: crawler
    name: 内部 Wiki
    url: https://wiki.company.com
    enabled: true
    auth:
      type: cookie  # cookie | script | none
      cookies: "session=xxxx; token=yyyy"
    selectors:
      content: ".wiki-content, .markdown-body, article"
      links: "a[href^='/docs'], a[href^='/wiki']"
      exclude: ".nav, .sidebar, .footer"
    crawl_options:
      start_url: /docs/index
      max_pages: 1000
      delay: 1000
```

---

## CLI 命令接口

```bash
# 初始化
devrag init [--config-dir]

# 启动服务
devrag start [--port] [--host]

# 知识源管理
devrag source add <type> [options]
devrag source list
devrag source remove <id>
devrag source enable <id>
devrag source disable <id>

# 爬虫管理
devrag crawler start <source-id>
devrag crawler stop <task-id>
devrag crawler status
devrag crawler logs <task-id>

# 索引管理
devrag index build [--force]
devrag index status
devrag index rebuild <source-id>

# 查询
devrag query <query> [--mode] [--top-k]
devrag search <query>  # 别名

# 配置管理
devrag config get <key>
devrag config set <key> <value>
devrag config edit

# 系统管理
devrag doctor  # 健康检查
devrag version
devrag logs [--tail]
```

---

## MCP 服务设计（参考团队报告）

### MCP 工具列表

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `search_notes` | 搜索本地笔记 | `query`, `limit?` |
| `query_wiki` | 查询 Wiki 内容 | `query`, `source_filter?`, `limit?` |
| `semantic_search` | 语义搜索 | `query`, `top_k?`, `score_threshold?` |
| `hybrid_search` | 混合检索 | `query`, `alpha?`, `top_k?` |

### MCP 实现（核心代码）
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:3000/api'
const server = new McpServer({
  name: 'devrag-mcp',
  version: '1.0.0'
})

// 工具1: 搜索本地笔记
server.tool(
  'search_notes',
  '搜索本地 Markdown 笔记',
  {
    query: z.string().describe('搜索关键词'),
    limit: z.number().min(1).max(100).optional().describe('返回数量，默认10')
  },
  async ({ query, limit = 10 }) => {
    const response = await axios.get(`${API_BASE_URL}/notes/search`, {
      params: { q: query, limit }
    })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }]
    }
  }
)

// 工具2: 查询 Wiki
server.tool(
  'query_wiki',
  '查询爬取的 Wiki 内容',
  {
    query: z.string(),
    source_filter: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).optional()
  },
  async ({ query, source_filter, limit = 10 }) => {
    const response = await axios.get(`${API_BASE_URL}/wiki/search`, {
      params: { q: query, sources: source_filter, limit }
    })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }]
    }
  }
)

// 工具3: 语义搜索
server.tool(
  'semantic_search',
  '使用向量相似度搜索',
  {
    query: z.string().describe('自然语言查询'),
    top_k: z.number().min(1).max(20).optional().describe('返回数量，默认5'),
    score_threshold: z.number().min(0).max(1).optional().describe('相似度阈值，默认0.7')
  },
  async ({ query, top_k = 5, score_threshold = 0.7 }) => {
    const response = await axios.post(`${API_BASE_URL}/rag/semantic`, {
      query,
      top_k,
      score_threshold
    })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }]
    }
  }
)

// 工具4: 混合检索
server.tool(
  'hybrid_search',
  '混合检索（全文 + 语义）',
  {
    query: z.string(),
    alpha: z.number().min(0).max(1).optional().describe('全文检索权重，默认0.5'),
    top_k: z.number().min(1).max(20).optional()
  },
  async ({ query, alpha = 0.5, top_k = 10 }) => {
    const response = await axios.post(`${API_BASE_URL}/rag/hybrid`, {
      query,
      alpha,
      top_k
    })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data, null, 2)
      }]
    }
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
```

### Claude CLI 配置
```json
// ~/.claude/config.json
{
  "mcpServers": {
    "devrag": {
      "command": "node",
      "args": ["/path/to/devrag-mcp.js"],
      "env": {
        "DEVRAG_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

---

## API 接口设计

### 笔记管理
```
GET    /api/notes              # 获取笔记列表
POST   /api/notes              # 创建笔记
GET    /api/notes/:id          # 获取单个笔记
PUT    /api/notes/:id          # 更新笔记
DELETE /api/notes/:id          # 删除笔记
GET    /api/notes/search?q=    # 全文搜索
```

### 爬虫管理
```
POST   /api/crawler/start      # 启动爬虫任务
POST   /api/crawler/stop/:id   # 停止任务
GET    /api/crawler/status     # 获取任务状态
GET    /api/crawler/logs/:id   # 获取任务日志
```

### RAG 查询
```
POST   /api/rag/fulltext       # 全文检索
POST   /api/rag/semantic       # 语义检索
POST   /api/rag/hybrid         # 混合检索
```

### 索引管理
```
POST   /api/index/build        # 构建索引
GET    /api/index/status       # 索引状态
DELETE /api/index/:source-id   # 重建索引
```

---

## 性能优化策略（参考团队报告）

### 前端性能
- **虚拟滚动**：大列表只渲染可见项
- **防抖搜索**：300ms 防抖，减少无效请求
- **懒加载**：图片和内容按需加载

### 后端性能
- **并发控制**：p-queue 限制爬虫并发数
- **请求缓存**：LRU 缓存（100个查询，TTL=5分钟）
- **超时控制**：每个请求 30 秒超时
- **索引优化**：SQLite 添加索引，LanceDB 分片

### 数据库性能
- **向量数据库**：LanceDB 分片存储
- **全文检索**：SQLite FTS5 预构建索引
- **混合检索**：RRF 算法，O(n) 复杂度

---

## MVP 功能范围

### Phase 1 (MVP) - 核心功能
- [ ] 本地 Markdown 笔记管理（CRUD + 搜索）
- [ ] Playwright 通用爬虫（支持 Cookie 认证）
- [ ] Ollama 本地向量化（LanceDB）
- [ ] SQLite FTS5 全文检索
- [ ] 混合检索 API（RRF 算法）
- [ ] 纯静态 Web 界面
- [ ] Claude Code MCP 集成（4个工具）

### Phase 2 - 增强功能
- [ ] XPath 选择器支持
- [ ] 脚本登录认证
- [ ] 增量更新机制
- [ ] 笔记标签与分类
- [ ] 抓取任务调度

### Phase 3 - 高级功能（可选）
- [ ] 笔记版本历史
- [ ] 多种 Embedding 模型支持
- [ ] 导出/导入功能
- [ ] 插件系统

---

## 部署方案

### 本地安装
```bash
# NPM 全局安装
npm install -g devrag

# 或使用 npx（无需安装）
npx devrag start

# 或从源码运行
git clone https://github.com/user/devrag.git
cd devrag
npm install
npm link
devrag start
```

### 单文件分发（可选）
使用 pkg 或 nexe 打包成单个可执行文件：
```bash
# 打包
npm run build:exe

# 生成
devrag           # Linux/Mac
devrag.exe       # Windows
```

---

## 技术栈最终选型

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| **CLI** | Commander.js | 轻量级命令行框架 |
| **HTTP 服务器** | Hono | 超轻量（37KB），高性能 |
| **爬虫** | Playwright | 支持动态页面 + 登录 |
| **并发控制** | p-queue | 轻量级，无外部依赖 |
| **向量数据库** | LanceDB | 嵌入式，支持混合检索 |
| **全文检索** | SQLite FTS5 | 内置，无需额外服务 |
| **Embedding** | Ollama | 本地运行，隐私安全 |
| **前端** | 纯静态 HTML/JS | 零依赖，最轻量 |
| **MCP SDK** | @modelcontextprotocol/sdk | 官方 SDK |

---

## 与团队协作报告的差异

| 项目 | 团队协作报告 | DevRAG v2 | 理由 |
|------|-------------|-----------|------|
| **目标用户** | 团队协作 | 个人开发者 | 更聚焦 |
| **前端** | Vue3 + Element Plus | 纯静态 HTML | 更轻量 |
| **HTTP 服务器** | Express | Hono | 更轻量（37KB vs 200KB+） |
| **全文检索** | MeiliSearch | SQLite FTS5 | 无需额外服务 |
| **爬虫选择器** | XPath 优先 | CSS + XPath | 灵活兼容 |
| **认证方式** | 扫码 + Token | Cookie + 脚本 | 简化实现 |
| **产品形态** | 前后端分离 | CLI 单体 | 更易部署 |

---

## 验收标准

### MVP 验收
- [ ] `devrag init` 创建目录结构
- [ ] `devrag start` 启动 Web 服务
- [ ] 通过 Web 界面创建/编辑笔记
- [ ] 配置并启动 Wiki 爬虫（Cookie 认证）
- [ ] 构建向量索引和全文索引
- [ ] 混合检索返回正确结果
- [ ] MCP 工具在 Claude CLI 中可用

### 性能验收
- [ ] 笔记查询 < 500ms
- [ ] 知识库检索 < 500ms
- [ ] 爬虫速度 > 5页/分钟
- [ ] 前端首屏加载 < 1s

---

## 下一步

1. 确认技术栈选型
2. 设计项目结构
3. 开始 MVP 开发

预计开发周期：**2-3 周**
