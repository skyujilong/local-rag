# MCP 服务设计文档 - 知识库系统

## 1. 概述

本文档定义了知识库系统的 MCP (Model Context Protocol) 服务接口规范,为 Claude CLI 提供本地笔记、内网 Wiki 和向量知识库的查询能力。

### 1.1 系统架构

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Claude CLI │ ◄─────► │  MCP Server  │ ◄─────► │  后端 API   │
└─────────────┘  stdio  └──────────────┘   HTTP  └─────────────┘
                                                         │
                                                         ▼
                                           ┌──────────────────────┐
                                           │  • 笔记数据库        │
                                           │  • Wiki 索引         │
                                           │  • 向量数据库        │
                                           └──────────────────────┘
```

### 1.2 核心特性

- **多源检索**: 支持笔记、Wiki、向量数据库的统一查询
- **混合搜索**: 融合全文检索和语义搜索,提升召回率
- **类型安全**: 使用 Zod 进行严格的参数验证
- **容错设计**: 优雅处理 API 错误,不中断服务
- **性能优化**: 请求超时控制,避免阻塞

---

## 2. 工具定义与 Schema

### 2.1 工具 1: search_notes

**功能**: 搜索本地笔记(全文检索)

**适用场景**:
- 查找特定关键词的笔记
- 快速定位个人知识库内容
- 精确匹配查询

**输入参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `query` | string | 是 | - | 搜索关键词,支持空格分隔多个词 |
| `limit` | number | 否 | 10 | 返回结果数量(1-100) |

**输入 Schema (Zod)**:
```typescript
{
  query: z.string().min(1).describe('搜索关键词'),
  limit: z.number().int().min(1).max(100).optional().default(10)
    .describe('返回结果数量(默认 10)')
}
```

**输出 Schema**:
```json
{
  "success": true,
  "data": [
    {
      "id": "note_20260320_vue3",
      "title": "Vue3 响应式原理深度解析",
      "snippet": "...Vue3 使用 Proxy 替代 Object.defineProperty 实现响应式,通过 Reflect 进行属性操作...",
      "source": "notes",
      "created_at": "2026-03-20T10:30:00Z",
      "updated_at": "2026-03-25T14:00:00Z",
      "url": "file:///Users/jilong5/notes/frontend/vue3-reactive.md",
      "tags": ["Vue3", "响应式", "前端"]
    }
  ],
  "total": 5,
  "query_time_ms": 45
}
```

**错误输出**:
```json
{
  "success": false,
  "error": {
    "code": "API_ERROR",
    "message": "connect ECONNREFUSED 127.0.0.1:3000",
    "details": "后端 API 不可用,请检查服务是否启动"
  }
}
```

---

### 2.2 工具 2: query_wiki

**功能**: 查询内网 Wiki 内容(全文检索)

**适用场景**:
- 查找团队共享的技术文档
- 搜索公司内部规范和流程
- 检索项目相关文档

**输入参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `query` | string | 是 | - | 搜索关键词 |
| `limit` | number | 否 | 10 | 返回结果数量(1-100) |

**输入 Schema (Zod)**:
```typescript
{
  query: z.string().min(1).describe('搜索关键词'),
  limit: z.number().int().min(1).max(100).optional().default(10)
    .describe('返回结果数量(默认 10)')
}
```

**输出 Schema**:
```json
{
  "success": true,
  "data": [
    {
      "id": "wiki_responsive_system",
      "title": "响应式系统设计规范",
      "snippet": "...本文档定义了前端响应式系统的设计原则和实现规范,包括数据劫持、依赖收集、派发更新...",
      "source": "wiki",
      "created_at": "2026-03-15T14:00:00Z",
      "updated_at": "2026-03-22T16:30:00Z",
      "url": "https://wiki.company.com/docs/frontend/reactive-system",
      "author": "张三",
      "tags": ["响应式", "设计规范", "前端架构"]
    }
  ],
  "total": 8,
  "query_time_ms": 62
}
```

---

### 2.3 工具 3: semantic_search

**功能**: 语义搜索(向量检索,跨笔记 + Wiki)

**适用场景**:
- 自然语言提问(如"如何优化 Vue3 性能?")
- 概念性查询(不依赖精确关键词)
- 跨文档的相关内容发现

**输入参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `query` | string | 是 | - | 自然语言查询 |
| `top_k` | number | 否 | 5 | 返回最相似的 top-k 结果(1-50) |

**输入 Schema (Zod)**:
```typescript
{
  query: z.string().min(1).describe('自然语言查询'),
  top_k: z.number().int().min(1).max(50).optional().default(5)
    .describe('返回最相似的 top-k 结果(默认 5)')
}
```

**输出 Schema**:
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_456",
      "title": "响应式系统深度解析",
      "snippet": "...Proxy 与 Reflect 是 ES6 引入的新特性,Vue3 利用它们实现了更高效的响应式系统...",
      "source": "wiki",
      "score": 0.92,
      "created_at": "2026-03-15T14:00:00Z",
      "url": "https://wiki.company.com/docs/reactive",
      "tags": ["Proxy", "Reflect", "响应式"]
    },
    {
      "id": "note_789",
      "title": "Vue3 性能优化实践",
      "snippet": "...通过 Proxy 的懒代理特性,Vue3 可以避免深层对象的递归遍历,显著提升初始化性能...",
      "source": "notes",
      "score": 0.87,
      "created_at": "2026-03-20T10:00:00Z",
      "url": "file:///Users/jilong5/notes/vue3-performance.md",
      "tags": ["Vue3", "性能优化"]
    }
  ],
  "total": 12,
  "query_time_ms": 120
}
```

**说明**:
- `score`: 相似度评分(0-1),值越大表示越相关
- 结果按相似度降序排列
- 自动跨 notes 和 wiki 数据源检索

---

### 2.4 工具 4: hybrid_search

**功能**: 混合检索(全文 + 语义融合)

**适用场景**:
- 需要综合关键词匹配和语义理解的查询
- 提升召回率和准确率
- 平衡精确匹配和模糊检索

**输入参数**:

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `query` | string | 是 | - | 查询文本 |
| `mode` | enum | 否 | "hybrid" | 检索模式: `fulltext`(仅全文), `semantic`(仅语义), `hybrid`(混合) |
| `top_k` | number | 否 | 10 | 返回结果数量(1-100) |

**输入 Schema (Zod)**:
```typescript
{
  query: z.string().min(1).describe('查询文本'),
  mode: z.enum(['fulltext', 'semantic', 'hybrid'])
    .optional()
    .default('hybrid')
    .describe('检索模式: fulltext(仅全文), semantic(仅语义), hybrid(混合)'),
  top_k: z.number().int().min(1).max(100).optional().default(10)
    .describe('返回结果数量(默认 10)')
}
```

**输出 Schema**:
```json
{
  "success": true,
  "mode": "hybrid",
  "data": [
    {
      "id": "note_123",
      "title": "Vue3 响应式原理",
      "snippet": "...Vue3 的响应式系统基于 Proxy 实现,相比 Vue2 的 Object.defineProperty 更加高效...",
      "source": "notes",
      "score": 0.95,
      "fulltext_score": 0.88,
      "semantic_score": 0.92,
      "created_at": "2026-03-20T10:00:00Z",
      "url": "file:///Users/jilong5/notes/vue3-reactive.md"
    }
  ],
  "total": 15,
  "query_time_ms": 145,
  "algorithm": "RRF"
}
```

**说明**:
- `mode`: 实际使用的检索模式
- `score`: 融合后的综合评分(仅 hybrid 模式)
- `fulltext_score`: 全文检索评分(仅 hybrid 模式)
- `semantic_score`: 语义检索评分(仅 hybrid 模式)
- `algorithm`: 融合算法(RRF = Reciprocal Rank Fusion)

---

## 3. MCP 服务器实现

### 3.1 完整代码 (TypeScript)

**文件**: `src/mcp-server.ts`

```typescript
#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import axios, { AxiosError } from 'axios';

// 环境配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '10000', 10);

// 日志工具(使用 stderr 避免干扰 stdio)
const log = {
  info: (msg: string) => console.error(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg: string, err?: unknown) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`);
    if (err) console.error(err);
  }
};

// 创建 MCP 服务器实例
const server = new McpServer({
  name: 'knowledge-base-mcp',
  version: '1.0.0',
  description: '本地知识库 MCP 服务,提供笔记、Wiki 和知识库查询功能'
});

// 通用错误处理器
function handleError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    return {
      success: false,
      error: {
        code: 'API_ERROR',
        message: axiosError.message,
        details: axiosError.response?.status
          ? `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`
          : '后端 API 不可用,请检查服务是否启动'
      }
    };
  }

  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: error instanceof Error ? error.message : String(error),
      details: '未知错误,请查看日志'
    }
  };
}

// 工具 1: 搜索笔记
server.tool(
  'search_notes',
  {
    query: z.string().min(1).describe('搜索关键词'),
    limit: z.number().int().min(1).max(100).optional().default(10)
      .describe('返回结果数量(默认 10)')
  },
  async ({ query, limit }) => {
    log.info(`search_notes called: query="${query}", limit=${limit}`);

    try {
      const startTime = Date.now();
      const response = await axios.get(`${API_BASE_URL}/notes/search`, {
        params: { q: query, limit },
        timeout: REQUEST_TIMEOUT
      });

      const duration = Date.now() - startTime;
      log.info(`search_notes completed in ${duration}ms, found ${response.data.total || 0} results`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      log.error(`search_notes failed: query="${query}"`, error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(handleError(error), null, 2)
        }],
        isError: true
      };
    }
  }
);

// 工具 2: 查询 Wiki
server.tool(
  'query_wiki',
  {
    query: z.string().min(1).describe('搜索关键词'),
    limit: z.number().int().min(1).max(100).optional().default(10)
      .describe('返回结果数量(默认 10)')
  },
  async ({ query, limit }) => {
    log.info(`query_wiki called: query="${query}", limit=${limit}`);

    try {
      const startTime = Date.now();
      const response = await axios.get(`${API_BASE_URL}/wiki/search`, {
        params: { q: query, limit },
        timeout: REQUEST_TIMEOUT
      });

      const duration = Date.now() - startTime;
      log.info(`query_wiki completed in ${duration}ms, found ${response.data.total || 0} results`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      log.error(`query_wiki failed: query="${query}"`, error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(handleError(error), null, 2)
        }],
        isError: true
      };
    }
  }
);

// 工具 3: 语义搜索
server.tool(
  'semantic_search',
  {
    query: z.string().min(1).describe('自然语言查询'),
    top_k: z.number().int().min(1).max(50).optional().default(5)
      .describe('返回最相似的 top-k 结果(默认 5)')
  },
  async ({ query, top_k }) => {
    log.info(`semantic_search called: query="${query}", top_k=${top_k}`);

    try {
      const startTime = Date.now();
      const response = await axios.post(
        `${API_BASE_URL}/kb/search`,
        {
          query,
          mode: 'semantic',
          top_k
        },
        {
          timeout: REQUEST_TIMEOUT,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const duration = Date.now() - startTime;
      log.info(`semantic_search completed in ${duration}ms, found ${response.data.total || 0} results`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      log.error(`semantic_search failed: query="${query}"`, error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(handleError(error), null, 2)
        }],
        isError: true
      };
    }
  }
);

// 工具 4: 混合检索
server.tool(
  'hybrid_search',
  {
    query: z.string().min(1).describe('查询文本'),
    mode: z.enum(['fulltext', 'semantic', 'hybrid'])
      .optional()
      .default('hybrid')
      .describe('检索模式: fulltext(仅全文), semantic(仅语义), hybrid(混合)'),
    top_k: z.number().int().min(1).max(100).optional().default(10)
      .describe('返回结果数量(默认 10)')
  },
  async ({ query, mode, top_k }) => {
    log.info(`hybrid_search called: query="${query}", mode="${mode}", top_k=${top_k}`);

    try {
      const startTime = Date.now();
      const response = await axios.post(
        `${API_BASE_URL}/kb/search`,
        {
          query,
          mode,
          top_k
        },
        {
          timeout: REQUEST_TIMEOUT,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const duration = Date.now() - startTime;
      log.info(`hybrid_search completed in ${duration}ms, mode=${mode}, found ${response.data.total || 0} results`);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      log.error(`hybrid_search failed: query="${query}", mode="${mode}"`, error);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(handleError(error), null, 2)
        }],
        isError: true
      };
    }
  }
);

// 启动服务器
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    log.info('MCP server started successfully');
    log.info(`API Base URL: ${API_BASE_URL}`);
    log.info(`Request Timeout: ${REQUEST_TIMEOUT}ms`);

  } catch (error) {
    log.error('Failed to start MCP server', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', () => {
  log.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

main();
```

### 3.2 依赖配置

**文件**: `package.json`

```json
{
  "name": "knowledge-base-mcp",
  "version": "1.0.0",
  "description": "MCP server for local knowledge base system",
  "type": "module",
  "main": "dist/mcp-server.js",
  "bin": {
    "knowledge-base-mcp": "./dist/mcp-server.js"
  },
  "scripts": {
    "dev": "tsx src/mcp-server.ts",
    "build": "tsc",
    "start": "node dist/mcp-server.js",
    "inspect": "npx @modelcontextprotocol/inspector tsx src/mcp-server.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "axios": "^1.6.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**文件**: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 4. 配置与集成

### 4.1 Claude CLI 配置文件

**方式 1: 全局配置** (推荐用于多项目共享)

文件路径: `~/.claude/config.json`

```json
{
  "mcpServers": {
    "knowledge-base": {
      "command": "node",
      "args": [
        "--loader",
        "tsx",
        "/Users/jilong5/projects/mcp-servers/knowledge-base/src/mcp-server.ts"
      ],
      "env": {
        "API_BASE_URL": "http://localhost:3000/api",
        "REQUEST_TIMEOUT": "10000"
      }
    }
  }
}
```

**方式 2: 项目配置** (推荐用于特定项目)

文件路径: `<项目根目录>/mcp_servers.json`

```json
{
  "knowledge-base": {
    "command": "node",
    "args": [
      "--loader",
      "tsx",
      "./src/mcp-server.ts"
    ],
    "env": {
      "API_BASE_URL": "http://localhost:3000/api",
      "REQUEST_TIMEOUT": "10000"
    }
  }
}
```

**方式 3: 使用编译后的 JS** (推荐用于生产环境)

```json
{
  "mcpServers": {
    "knowledge-base": {
      "command": "node",
      "args": [
        "/Users/jilong5/projects/mcp-servers/knowledge-base/dist/mcp-server.js"
      ],
      "env": {
        "API_BASE_URL": "http://localhost:3000/api",
        "REQUEST_TIMEOUT": "10000"
      }
    }
  }
}
```

### 4.2 启动命令

**开发模式** (直接运行 TypeScript):
```bash
# 在项目目录下
cd /Users/jilong5/projects/mcp-servers/knowledge-base

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

**生产模式** (编译后运行):
```bash
# 编译 TypeScript
npm run build

# 运行编译后的代码
npm start
```

**使用 PM2 管理进程**:
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/mcp-server.js --name mcp-kb

# 查看日志
pm2 logs mcp-kb

# 重启服务
pm2 restart mcp-kb

# 停止服务
pm2 stop mcp-kb
```

### 4.3 调试方法

**方法 1: 使用 MCP Inspector** (推荐)

```bash
# 安装 Inspector
npm install -g @modelcontextprotocol/inspector

# 启动 Inspector
npx @modelcontextprotocol/inspector tsx src/mcp-server.ts
```

Inspector 会启动一个 Web 界面(http://localhost:5173),可以:
- 查看所有工具定义
- 测试工具调用
- 查看请求/响应日志
- 调试错误

**方法 2: 查看 Claude CLI 日志**

```bash
# Claude CLI 日志路径
tail -f ~/Library/Logs/Claude/mcp-*.log
```

**方法 3: 使用自定义日志**

MCP 服务器日志会输出到 stderr,可以重定向到文件:

```bash
# 在配置文件中添加日志重定向
{
  "command": "sh",
  "args": [
    "-c",
    "node dist/mcp-server.js 2>> /tmp/mcp-kb.log"
  ]
}
```

---

## 5. 测试用例

### 5.1 基本查询测试

**测试 1: 搜索笔记**

输入:
```json
{
  "tool": "search_notes",
  "arguments": {
    "query": "Vue3",
    "limit": 5
  }
}
```

期望输出:
```json
{
  "success": true,
  "data": [
    {
      "id": "note_20260320_vue3",
      "title": "Vue3 响应式原理深度解析",
      "snippet": "...Vue3 使用 Proxy...",
      "source": "notes",
      "created_at": "2026-03-20T10:30:00Z",
      "url": "file:///Users/jilong5/notes/vue3-reactive.md"
    }
  ],
  "total": 5,
  "query_time_ms": 45
}
```

**测试 2: 查询 Wiki**

输入:
```json
{
  "tool": "query_wiki",
  "arguments": {
    "query": "响应式系统",
    "limit": 10
  }
}
```

期望输出:
```json
{
  "success": true,
  "data": [
    {
      "id": "wiki_responsive_system",
      "title": "响应式系统设计规范",
      "snippet": "...本文档定义了前端响应式系统的设计原则...",
      "source": "wiki",
      "url": "https://wiki.company.com/docs/frontend/reactive-system"
    }
  ],
  "total": 8,
  "query_time_ms": 62
}
```

### 5.2 语义搜索测试

**测试 3: 自然语言查询**

输入:
```json
{
  "tool": "semantic_search",
  "arguments": {
    "query": "如何实现响应式系统?",
    "top_k": 5
  }
}
```

期望输出:
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_456",
      "title": "响应式系统深度解析",
      "snippet": "...Proxy 与 Reflect...",
      "source": "wiki",
      "score": 0.92,
      "url": "https://wiki.company.com/docs/reactive"
    },
    {
      "id": "note_789",
      "title": "Vue3 性能优化实践",
      "snippet": "...通过 Proxy 的懒代理特性...",
      "source": "notes",
      "score": 0.87,
      "url": "file:///Users/jilong5/notes/vue3-performance.md"
    }
  ],
  "total": 12,
  "query_time_ms": 120
}
```

### 5.3 混合检索测试

**测试 4: Hybrid 模式**

输入:
```json
{
  "tool": "hybrid_search",
  "arguments": {
    "query": "Vue3 响应式原理",
    "mode": "hybrid",
    "top_k": 10
  }
}
```

期望输出:
```json
{
  "success": true,
  "mode": "hybrid",
  "data": [
    {
      "id": "note_123",
      "title": "Vue3 响应式原理",
      "score": 0.95,
      "fulltext_score": 0.88,
      "semantic_score": 0.92,
      "source": "notes",
      "url": "file:///Users/jilong5/notes/vue3-reactive.md"
    }
  ],
  "total": 15,
  "query_time_ms": 145,
  "algorithm": "RRF"
}
```

**测试 5: Fulltext 模式**

输入:
```json
{
  "tool": "hybrid_search",
  "arguments": {
    "query": "Proxy Reflect",
    "mode": "fulltext",
    "top_k": 10
  }
}
```

期望输出:
```json
{
  "success": true,
  "mode": "fulltext",
  "data": [
    {
      "id": "note_123",
      "title": "Vue3 响应式原理",
      "score": 0.88,
      "source": "notes"
    }
  ],
  "total": 7,
  "query_time_ms": 52
}
```

### 5.4 边界情况测试

**测试 6: 空结果**

输入:
```json
{
  "tool": "search_notes",
  "arguments": {
    "query": "不存在的关键词XYZ123",
    "limit": 10
  }
}
```

期望输出:
```json
{
  "success": true,
  "data": [],
  "total": 0,
  "query_time_ms": 12
}
```

**测试 7: 超长查询**

输入:
```json
{
  "tool": "semantic_search",
  "arguments": {
    "query": "这是一个非常非常长的查询文本,包含多个关键词...(省略 500 字)",
    "top_k": 5
  }
}
```

期望行为:
- 正常处理(后端应支持长文本查询)
- 或返回错误: `"查询文本超过限制(最大 1000 字符)"`

**测试 8: 参数边界**

输入:
```json
{
  "tool": "search_notes",
  "arguments": {
    "query": "Vue3",
    "limit": 0  // 无效值
  }
}
```

期望行为:
- Zod 验证失败,返回错误:
  ```json
  {
    "error": "Validation error: limit must be at least 1"
  }
  ```

### 5.5 错误处理测试

**测试 9: API 不可用**

模拟场景:
```bash
# 停止后端 API
killall -9 node
```

输入:
```json
{
  "tool": "search_notes",
  "arguments": {
    "query": "Vue3"
  }
}
```

期望输出:
```json
{
  "success": false,
  "error": {
    "code": "API_ERROR",
    "message": "connect ECONNREFUSED 127.0.0.1:3000",
    "details": "后端 API 不可用,请检查服务是否启动"
  }
}
```

**测试 10: API 超时**

模拟场景:
```bash
# 设置极短的超时时间
export REQUEST_TIMEOUT=10
```

期望输出:
```json
{
  "success": false,
  "error": {
    "code": "API_ERROR",
    "message": "timeout of 10ms exceeded",
    "details": "后端 API 不可用,请检查服务是否启动"
  }
}
```

**测试 11: API 返回错误状态码**

模拟场景: 后端返回 500 错误

期望输出:
```json
{
  "success": false,
  "error": {
    "code": "API_ERROR",
    "message": "Request failed with status code 500",
    "details": "HTTP 500: Internal Server Error"
  }
}
```

### 5.6 并发测试

**测试 12: 并发查询**

模拟场景: 同时发起 10 个查询请求

期望行为:
- 所有请求独立处理
- 不会相互阻塞
- 每个请求正常返回结果或错误

**压力测试脚本**:
```bash
#!/bin/bash
# 并发测试脚本

for i in {1..10}; do
  {
    echo "Request $i started"
    # 使用 Claude CLI 调用 MCP 工具
    claude mcp call knowledge-base search_notes '{"query":"Vue3","limit":10}'
    echo "Request $i completed"
  } &
done

wait
echo "All requests completed"
```

---

## 6. 安全性与限制

### 6.1 权限控制

✅ **只读权限**:
- 仅暴露查询接口(`search`, `query`)
- 不提供写入/删除/修改功能
- 降低安全风险

❌ **禁止的操作**:
- 写入笔记或 Wiki
- 删除文档
- 修改知识库索引
- 执行任意代码

### 6.2 输入验证

**使用 Zod 进行严格验证**:

```typescript
// 示例:限制查询长度,防止注入攻击
{
  query: z.string()
    .min(1, '查询不能为空')
    .max(1000, '查询文本超过限制(最大 1000 字符)')
    .regex(/^[^<>]*$/, '查询包含非法字符')
    .describe('搜索关键词'),

  limit: z.number()
    .int('limit 必须为整数')
    .min(1, 'limit 至少为 1')
    .max(100, 'limit 最大为 100')
    .optional()
    .default(10)
}
```

**防御措施**:
- 过滤 HTML 标签和脚本
- 限制查询长度
- 验证参数类型和范围
- 防止 SQL 注入(后端负责)

### 6.3 超时控制

**默认超时设置**:
- 全文检索: 5 秒
- 语义搜索: 10 秒
- 混合检索: 10 秒

**配置方式**:
```bash
# 环境变量
export REQUEST_TIMEOUT=10000  # 单位:毫秒
```

**超时后行为**:
- 中止 HTTP 请求
- 返回结构化错误信息
- 不阻塞其他请求

### 6.4 错误隔离

**错误处理原则**:
1. **捕获所有异常**: 使用 try-catch 包裹所有 API 调用
2. **结构化错误**: 返回统一的错误格式
3. **不崩溃**: 错误不会导致 MCP 服务器进程退出
4. **日志记录**: 记录所有错误到 stderr

**错误类型**:
- `API_ERROR`: 后端 API 错误
- `VALIDATION_ERROR`: 参数验证失败
- `TIMEOUT_ERROR`: 请求超时
- `UNKNOWN_ERROR`: 未知错误

### 6.5 资源限制

**限制措施**:
- 单次查询最多返回 100 条结果
- 查询文本最大 1000 字符
- 并发请求数由 Node.js 事件循环管理(无硬性限制)

**建议配置**:
```json
{
  "env": {
    "NODE_OPTIONS": "--max-old-space-size=512"  // 限制内存使用
  }
}
```

---

## 7. 部署与维护

### 7.1 使用 PM2 管理进程

**安装 PM2**:
```bash
npm install -g pm2
```

**配置文件**: `ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'mcp-kb-server',
    script: './dist/mcp-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      API_BASE_URL: 'http://localhost:3000/api',
      REQUEST_TIMEOUT: '10000'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

**启动命令**:
```bash
# 启动服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs mcp-kb-server

# 重启服务
pm2 restart mcp-kb-server

# 停止服务
pm2 stop mcp-kb-server

# 删除服务
pm2 delete mcp-kb-server

# 保存配置(开机自启)
pm2 save
pm2 startup
```

### 7.2 日志记录

**日志级别**:
- `INFO`: 启动、请求、完成等正常事件
- `ERROR`: API 错误、异常、失败等

**日志示例**:
```
[INFO] 2026-03-26T10:00:00.000Z - MCP server started successfully
[INFO] 2026-03-26T10:00:05.123Z - search_notes called: query="Vue3", limit=10
[INFO] 2026-03-26T10:00:05.168Z - search_notes completed in 45ms, found 5 results
[ERROR] 2026-03-26T10:01:00.000Z - semantic_search failed: query="如何优化性能?"
Error: connect ECONNREFUSED 127.0.0.1:3000
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1595:16)
```

**日志存储**:
- 开发环境: stderr 输出到终端
- 生产环境: PM2 管理,输出到 `./logs/err.log` 和 `./logs/out.log`

**日志轮转** (防止日志文件过大):
```bash
# 安装 PM2 日志轮转模块
pm2 install pm2-logrotate

# 配置
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### 7.3 健康检查

**方法 1: 检查进程状态**
```bash
pm2 status mcp-kb-server
```

**方法 2: 检查日志**
```bash
# 查看最近的错误日志
tail -n 50 ./logs/err.log
```

**方法 3: 手动测试工具**
```bash
# 使用 MCP Inspector 测试
npx @modelcontextprotocol/inspector node dist/mcp-server.js
```

### 7.4 更新与回滚

**更新流程**:
```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖
npm install

# 3. 编译
npm run build

# 4. 重启服务
pm2 restart mcp-kb-server

# 5. 查看日志,确认正常
pm2 logs mcp-kb-server --lines 50
```

**回滚流程**:
```bash
# 1. 切换到上一个稳定版本
git checkout <上一个稳定 commit>

# 2. 重新编译和重启
npm run build
pm2 restart mcp-kb-server
```

### 7.5 性能监控

**使用 PM2 监控**:
```bash
# 启动 Web 监控面板
pm2 web

# 访问 http://localhost:9615
```

**监控指标**:
- CPU 使用率
- 内存使用量
- 请求响应时间
- 错误率
- 重启次数

**性能优化建议**:
- 使用 HTTP 连接池(axios 默认支持)
- 后端 API 启用缓存
- 限制并发请求数
- 定期重启进程(PM2 `cron_restart` 配置)

---

## 8. 故障排查

### 8.1 常见问题

**问题 1: MCP 服务器无法启动**

症状:
```
Error: Cannot find module '@modelcontextprotocol/sdk'
```

解决方案:
```bash
# 重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

---

**问题 2: Claude CLI 无法连接到 MCP 服务器**

症状:
```
Failed to connect to MCP server: knowledge-base
```

解决方案:
1. 检查配置文件路径是否正确
2. 验证 `command` 和 `args` 是否正确
3. 手动运行命令,查看错误信息:
   ```bash
   node --loader tsx src/mcp-server.ts
   ```

---

**问题 3: API 调用失败**

症状:
```json
{
  "success": false,
  "error": {
    "code": "API_ERROR",
    "message": "connect ECONNREFUSED 127.0.0.1:3000"
  }
}
```

解决方案:
1. 检查后端 API 是否启动:
   ```bash
   curl http://localhost:3000/api/health
   ```
2. 验证 `API_BASE_URL` 环境变量是否正确
3. 检查防火墙/网络配置

---

**问题 4: 查询超时**

症状:
```json
{
  "error": {
    "code": "API_ERROR",
    "message": "timeout of 10000ms exceeded"
  }
}
```

解决方案:
1. 增加超时时间:
   ```bash
   export REQUEST_TIMEOUT=20000  # 20 秒
   ```
2. 优化后端 API 性能
3. 检查网络延迟

---

**问题 5: 内存溢出**

症状:
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

解决方案:
1. 增加 Node.js 内存限制:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=1024"
   ```
2. 检查是否存在内存泄漏
3. 限制查询结果数量

---

### 8.2 调试技巧

**技巧 1: 使用 MCP Inspector**
```bash
npx @modelcontextprotocol/inspector tsx src/mcp-server.ts
```

**技巧 2: 启用详细日志**
```typescript
// 在 mcp-server.ts 中添加
const DEBUG = process.env.DEBUG === 'true';

if (DEBUG) {
  log.info(`Request payload: ${JSON.stringify(payload)}`);
  log.info(`Response: ${JSON.stringify(response.data)}`);
}
```

**技巧 3: 使用 curl 测试后端 API**
```bash
# 测试笔记搜索 API
curl -X GET "http://localhost:3000/api/notes/search?q=Vue3&limit=10"

# 测试语义搜索 API
curl -X POST "http://localhost:3000/api/kb/search" \
  -H "Content-Type: application/json" \
  -d '{"query":"如何优化性能?","mode":"semantic","top_k":5}'
```

**技巧 4: 检查 Claude CLI 日志**
```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp-*.log

# Linux
tail -f ~/.local/state/Claude/logs/mcp-*.log
```

---

## 9. 最佳实践

### 9.1 工具命名

✅ **好的命名**:
- `search_notes`: 清晰表达功能
- `semantic_search`: 描述性强
- `hybrid_search`: 区分不同模式

❌ **不好的命名**:
- `query`: 太模糊
- `search1`, `search2`: 无意义
- `search_all_documents_with_filters`: 过长

### 9.2 参数设计

**原则**:
1. **必填参数尽量少**: 只保留核心参数
2. **提供合理默认值**: 如 `limit=10`, `mode='hybrid'`
3. **使用枚举类型**: 限制可选值,避免错误输入
4. **明确参数约束**: 如范围限制、长度限制

**示例**:
```typescript
{
  query: z.string().min(1).max(1000),  // 明确长度限制
  mode: z.enum(['fulltext', 'semantic', 'hybrid']),  // 枚举
  top_k: z.number().int().min(1).max(100).optional().default(10)  // 范围 + 默认值
}
```

### 9.3 错误处理

**原则**:
1. **捕获所有异常**: 不让错误导致进程崩溃
2. **返回结构化错误**: 便于 Agent 解析和处理
3. **记录详细日志**: 便于排查问题
4. **提供友好提示**: 告诉用户如何解决

**示例**:
```typescript
try {
  // API 调用
} catch (error) {
  log.error('API call failed', error);

  return {
    success: false,
    error: {
      code: 'API_ERROR',
      message: error.message,
      details: '后端 API 不可用,请检查服务是否启动'
    }
  };
}
```

### 9.4 性能优化

**建议**:
1. **设置合理超时**: 避免长时间等待
2. **使用连接池**: axios 默认支持
3. **限制返回结果数**: 避免大量数据传输
4. **后端启用缓存**: 减少重复查询

### 9.5 安全性

**建议**:
1. **输入验证**: 使用 Zod 严格验证
2. **最小权限**: 只暴露只读接口
3. **错误信息脱敏**: 不泄露敏感信息
4. **日志脱敏**: 不记录用户隐私数据

---

## 10. 附录

### 10.1 API 接口规范 (后端)

**接口 1: 搜索笔记**

```
GET /api/notes/search?q={query}&limit={limit}
```

响应示例:
```json
{
  "success": true,
  "data": [
    {
      "id": "note_123",
      "title": "Vue3 响应式原理",
      "snippet": "...",
      "source": "notes",
      "created_at": "2026-03-20T10:00:00Z",
      "url": "file:///path/to/note.md"
    }
  ],
  "total": 5,
  "query_time_ms": 45
}
```

---

**接口 2: 查询 Wiki**

```
GET /api/wiki/search?q={query}&limit={limit}
```

响应格式同上,但 `source` 为 `"wiki"`,`url` 为 Wiki 页面 URL。

---

**接口 3: 知识库检索**

```
POST /api/kb/search
Content-Type: application/json

{
  "query": "如何优化性能?",
  "mode": "semantic",  // 或 "fulltext", "hybrid"
  "top_k": 5
}
```

响应示例:
```json
{
  "success": true,
  "mode": "semantic",
  "data": [
    {
      "id": "doc_456",
      "title": "响应式系统深度解析",
      "snippet": "...",
      "source": "wiki",
      "score": 0.92,
      "created_at": "2026-03-15T14:00:00Z",
      "url": "https://wiki.company.com/docs/reactive"
    }
  ],
  "total": 12,
  "query_time_ms": 120,
  "algorithm": "RRF"  // 仅 hybrid 模式
}
```

---

### 10.2 环境变量说明

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `API_BASE_URL` | 后端 API 基础 URL | `http://localhost:3000/api` | `http://192.168.1.100:8080/api` |
| `REQUEST_TIMEOUT` | HTTP 请求超时时间(毫秒) | `10000` | `20000` |
| `NODE_ENV` | 运行环境 | `development` | `production` |
| `DEBUG` | 是否启用调试日志 | `false` | `true` |

---

### 10.3 参考资料

- **MCP 官方文档**: https://modelcontextprotocol.io/
- **MCP SDK (TypeScript)**: https://github.com/modelcontextprotocol/sdk-typescript
- **MCP Inspector**: https://github.com/modelcontextprotocol/inspector
- **Zod 文档**: https://zod.dev/
- **Axios 文档**: https://axios-http.com/
- **PM2 文档**: https://pm2.keymetrics.io/

---

## 11. 总结

本文档提供了完整的 MCP 服务设计方案,包括:

✅ **工具定义**: 4 个工具,覆盖笔记、Wiki、语义搜索、混合检索
✅ **完整实现**: TypeScript 代码,包含错误处理和日志
✅ **配置示例**: Claude CLI 配置文件,支持多种部署方式
✅ **测试用例**: 12 个测试场景,覆盖正常和异常情况
✅ **安全机制**: 输入验证、超时控制、错误隔离
✅ **部署指南**: PM2 进程管理,日志记录,健康检查
✅ **故障排查**: 常见问题及解决方案

**下一步行动**:
1. 搭建后端 API(按照附录 10.1 的接口规范)
2. 部署 MCP 服务器(按照第 7 章的部署指南)
3. 配置 Claude CLI(按照第 4 章的配置文件)
4. 运行测试用例(按照第 5 章的测试方法)
5. 监控和优化(按照第 7.5 章的性能监控)

**关键原则**:
- **描述性工具名**: Agent 根据名称选择工具
- **类型安全**: Zod 验证所有输入
- **结构化输出**: JSON 格式,便于解析
- **优雅失败**: 返回错误,不崩溃
- **无状态设计**: 每次调用独立

---

**文档版本**: v1.0.0
**最后更新**: 2026-03-26
**作者**: MCP Builder
**联系方式**: -
