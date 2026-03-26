# DevRAG 产品设计 v3 - ChromaDB 方案

## 向量数据库最终选型：ChromaDB

**核心理由：**
- ✅ **完整的数据管理**：Collection + 元数据 + 持久化
- ✅ **简单 API**：一行代码完成添加/查询
- ✅ **成熟稳定**：30k+ stars，LangChain.js 默认向量库
- ⚠️ **接受额外复杂度**：需要管理独立服务

---

## ChromaDB 轻量化部署方案

### 方案 1：嵌入式模式（推荐）

ChromaDB 支持**嵌入式运行**，不需要显式启动服务：

```javascript
import { ChromaClient } from "chromadb";

// 嵌入式模式，自动管理服务
const client = new ChromaClient({
  path: "~/.devrag/chroma"  // 数据存储路径
});

// 一行代码创建 collection
const collection = await client.getOrCreateCollection({
  name: "notes",
  metadata: { description: "本地笔记" }
});

// 添加文档（自动持久化）
await collection.add({
  ids: ["note_1"],
  documents: ["这是笔记内容..."],
  metadatas: [{ title: "Vue3 笔记", tags: "frontend", created_at: "2026-03-26" }],
  embeddings: [[0.1, 0.2, ...]]
});

// 查询（返回完整数据）
const results = await collection.query({
  queryEmbeddings: [[0.1, 0.2, ...]],
  nResults: 5
});
// 返回: { ids, documents, metadatas, distances }
```

**优势：**
- ✅ 无需手动启动服务
- ✅ 自动管理持久化
- ✅ API 简洁

**劣势：**
- ⚠️ 首次启动稍慢（~2-3秒）
- ⚠️ 仍有一定资源占用（~50MB 内存）

---

### 方案 2：CLI 集成启动

在 `devrag start` 时自动启动 ChromaDB 服务：

```bash
#!/usr/bin/env node
// devrag CLI

const { spawn } = require('child_process');

// 启动 ChromaDB（后台进程）
const chroma = spawn('chroma-server', [
  '--host', '127.0.0.1',
  '--port', '8000',
  '--log-path', '~/.devrag/logs/chroma.log'
]);

// 启动 API 服务器
const api = spawn('node', ['api-server.js']);

// 监听退出信号，清理进程
process.on('SIGTERM', () => {
  chroma.kill();
  api.kill();
});
```

---

## 完整技术栈（更新）

| 组件 | 技术选型 | 理由 |
|------|----------|------|
| **向量数据库** | **ChromaDB** | 完整数据管理能力 |
| **全文检索** | **ChromaDB 内置** | 元数据过滤 + where 子句 |
| **Embedding** | **Ollama** | 本地模型，隐私安全 |
| **爬虫** | **Playwright** | 动态页面 + 登录支持 |
| **HTTP 服务器** | **Hono** | 轻量级（37KB） |
| **前端** | **纯静态 HTML/JS** | 零依赖 |

---

## ChromaDB 使用示例

### 1. 初始化

```javascript
// src/db/vector.ts
import { ChromaClient } from "chromadb";

export class VectorStore {
  private client: ChromaClient;
  private notesCollection: any;
  private wikiCollection: any;

  async init() {
    this.client = new ChromaClient({
      path: process.env.CHROMA_PATH || "~/.devrag/chroma"
    });

    this.notesCollection = await this.client.getOrCreateCollection({
      name: "notes",
      metadata: { description: "本地笔记" }
    });

    this.wikiCollection = await this.client.getOrCreateCollection({
      name: "wiki",
      metadata: { description: "爬取的 Wiki" }
    });
  }
}
```

### 2. 添加文档

```javascript
async addNote(note: Note) {
  // 1. 生成 Embedding
  const embedding = await ollama.embed(note.content);

  // 2. 添加到 ChromaDB
  await this.notesCollection.add({
    ids: [note.id],
    documents: [note.content],
    metadatas: [{
      title: note.title,
      tags: note.tags.join(','),
      created_at: note.created_at,
      updated_at: note.updated_at,
      source: 'local'
    }],
    embeddings: [embedding]
  });
}
```

### 3. 混合检索

```javascript
async hybridSearch(query: string, topK: number = 10) {
  // 1. 生成查询向量
  const queryEmbedding = await ollama.embed(query);

  // 2. 语义检索
  const semanticResults = await this.notesCollection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK * 2,
    where: { source: 'local' }  // 元数据过滤
  });

  // 3. 全文检索（ChromaDB 支持 where 文本匹配）
  const fulltextResults = await this.notesCollection.query({
    queryTexts: [query],
    nResults: topK * 2
  });

  // 4. RRF 融合
  return this.rrfMerge(semanticResults, fulltextResults, topK);
}
```

### 4. 元数据过滤

```javascript
// ChromaDB 强大的元数据过滤能力
await this.notesCollection.query({
  queryEmbeddings: [queryEmbedding],
  nResults: 10,
  where: {
    source: 'local',
    tags: { $in: ['frontend', 'vue'] },  // 标签过滤
    created_at: { $gte: '2026-01-01' }   // 日期过滤
  }
});
```

---

## 部署架构（更新）

```
┌─────────────────────────────────────────────────┐
│                  devrag start                   │
│                                                     │
│  ┌──────────────────┐    ┌──────────────────┐   │
│  │  ChromaDB 进程   │    │   API 服务器     │   │
│  │  (端口 8000)     │    │   (端口 3000)    │   │
│  │  ~50MB 内存      │    │   ~20MB 内存     │   │
│  └──────────────────┘    └──────────────────┘   │
│                                                     │
│  ~/.devrag/                                        │
│  ├── chroma/           # ChromaDB 数据            │
│  ├── notes/            # 本地笔记 Markdown         │
│  ├── crawled/          # 爬取的内容               │
│  └── config.yaml       # 配置文件                  │
└─────────────────────────────────────────────────┘
```

**总资源占用：~70MB 内存**（可接受）

---

## CLI 命令（更新）

```bash
# 启动服务（自动启动 ChromaDB + API）
devrag start

# 停止服务（自动清理所有进程）
devrag stop

# 查看状态
devrag status
# 输出:
# ✓ ChromaDB: 运行中 (PID: 12345, 内存: 52MB)
# ✓ API 服务: 运行中 (PID: 12346, 内存: 18MB)
# ✓ Web 界面: http://localhost:3000
```

---

## 配置文件（更新）

```yaml
# ~/.devrag/config.yaml
server:
  port: 3000
  host: 127.0.0.1

# ChromaDB 配置
chroma:
  enabled: true
  host: 127.0.0.1
  port: 8000
  data_path: ~/.devrag/chroma
  log_path: ~/.devrag/logs/chroma.log

# Embedding
embedding:
  provider: ollama
  model: nomic-embed-text
  ollama_base_url: http://localhost:11434

# 知识源
sources:
  - type: local_notes
    name: 我的笔记
    path: ~/Documents/notes

  - type: crawler
    name: 内部 Wiki
    url: https://wiki.company.com
    auth:
      type: cookie
      cookies: "session=xxxx"
```

---

## 数据模型（ChromaDB Collection）

### Collection: notes
```javascript
{
  ids: ["note_1", "note_2"],
  documents: ["笔记内容...", "另一篇笔记..."],
  metadatas: [
    {
      title: "Vue3 响应式原理",
      tags: "frontend,vue",
      created_at: "2026-03-26T10:00:00Z",
      updated_at: "2026-03-26T15:30:00Z",
      source: "local",
      file_path: "/Users/xxx/notes/vue3.md"
    },
    // ...
  ],
  embeddings: [[0.1, 0.2, ...], [0.3, 0.4, ...]]
}
```

### Collection: wiki
```javascript
{
  ids: ["wiki_1", "wiki_2"],
  documents: ["Wiki 页面内容...", "..."],
  metadatas: [
    {
      title: "OAuth 配置指南",
      url: "https://wiki.company.com/oauth",
      domain: "wiki.company.com",
      crawled_at: "2026-03-26T10:00:00Z",
      source: "wiki",
      depth: 2
    },
    // ...
  ],
  embeddings: [[0.1, 0.2, ...], [0.3, 0.4, ...]]
}
```

---

## MCP 工具（ChromaDB 集成）

```typescript
import { ChromaClient } from "chromadb";

const chroma = new ChromaClient({ path: "~/.devrag/chroma" });

// 工具1: 搜索笔记
server.tool('search_notes', async ({ query, limit = 10 }) => {
  const collection = await chroma.getCollection({ name: "notes" });
  const queryEmbedding = await ollama.embed(query);

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
  };
});

// 工具2: 混合检索
server.tool('hybrid_search', async ({ query, alpha = 0.5, topK = 10 }) => {
  const notesCollection = await chroma.getCollection({ name: "notes" });
  const wikiCollection = await chroma.getCollection({ name: "wiki" });

  const queryEmbedding = await ollama.embed(query);

  // 并行检索
  const [notesResults, wikiResults] = await Promise.all([
    notesCollection.query({ queryEmbeddings: [queryEmbedding], nResults: topK }),
    wikiCollection.query({ queryEmbeddings: [queryEmbedding], nResults: topK })
  ]);

  // 合并结果
  return {
    content: [{ type: 'text', text: JSON.stringify({
      notes: notesResults,
      wiki: wikiResults
    }, null, 2) }]
  };
});
```

---

## 安装依赖（更新）

```json
{
  "dependencies": {
    "chromadb": "^1.8.0",          // ~50MB
    "ollama": "^0.5.0",           // 轻量
    "playwright": "^1.40.0",       // ~100MB（爬虫）
    "hono": "^4.0.0",             // 37KB
    "yaml": "^2.3.0",             // 配置解析
    "commander": "^12.0.0"        // CLI 框架
  }
}
```

---

## 总结

### 接受 ChromaDB 的理由

| 方面 | 说明 |
|------|------|
| **数据管理** | ✅ Collection + 元数据 + 持久化，开箱即用 |
| **开发效率** | ✅ API 简洁，减少 50%+ 代码量 |
| **维护成本** | ✅ 成熟稳定，社区支持好 |
| **资源成本** | ⚠️ 额外 50MB 内存（可接受） |
| **部署复杂度** | ⚠️ 需管理额外进程（CLI 集成解决） |

### 技术栈最终确定

```
DevRAG = CLI 工具
  ├── ChromaDB（向量 + 元数据）
  ├── Ollama（Embedding）
  ├── Playwright（爬虫）
  └── Hono（API 服务器）
  └── 纯静态 HTML（前端）

总内存占用: ~70MB
启动时间: ~3秒
```

**结论：ChromaDB 虽然增加了一些复杂度，但换来了完整的数据管理能力，值得！**
