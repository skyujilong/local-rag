# Local RAG - 本地知识库系统

基于 Vite + Vue3 + Node.js + TypeScript 的本地知识库系统，使用 LlamaIndex 作为核心 RAG 引擎。通过 MCP Server 为 Claude CLI 提供本地知识库查询能力。

## 核心特性

- **本地优先**: 单用户本地应用，纯文件存储，数据完全掌控
- **MCP Server**: 适配 Claude CLI，实现本地知识库工具调用
- **网页爬虫**: 支持 Playwright 浏览器自动化，扫码登录会话持久化
- **笔记系统**: Markdown 编辑，支持图片上传
- **敏感文件保护**: 自动忽略敏感文件

## 项目结构

```
local-rag/
├── apps/
│   ├── web/              # Vue3 前端应用
│   ├── api/              # Node.js 后端服务
│   └── mcp-server/       # MCP Server
├── packages/
│   ├── shared/           # 共享类型和工具
│   └── config/           # 共享配置
└── .claude/              # Claude CLI 配置
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置 Ollama

确保 Ollama 已安装并运行：

```bash
# 安装 Ollama (macOS)
brew install ollama

# 拉取嵌入模型
ollama pull nomic-embed-text

# 启动 Ollama 服务
ollama serve
```

### 3. 启动服务

```bash
# 同时启动前端和后端
pnpm dev

# 或分别启动
pnpm dev:api   # 后端 API (http://localhost:3001)
pnpm dev:web   # 前端界面 (http://localhost:5173)
```

### 4. 构建 MCP Server

```bash
pnpm build:mcp
```

### 5. 配置 Claude CLI

项目根目录的 `.claude/settings.json` 已配置好 MCP Server。在 Claude CLI 中即可使用：

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

## 功能模块

### 笔记管理

- 创建、编辑、删除 Markdown 笔记
- 标签分类
- 图片上传支持
- 自动索引到 RAG

### 知识库

- 查看所有已索引文档
- 按类型、关键词搜索
- 重新索引功能

### 网页爬虫

- Playwright 浏览器自动化
- 智能登录页面检测
- 扫码登录支持（WebSocket 实时推送状态）
- 会话持久化（cookies + localStorage）
- 智能内容提取

### 文件存储

- 本地文件扫描索引
- 敏感文件自动忽略
- 支持文本、Markdown、代码文件

## MCP 工具说明

| 工具 | 描述 | 参数 |
|------|------|------|
| `local_rag_query` | 查询本地知识库 | `query`, `topK` |
| `knowledge_search` | 搜索文档 | `keywords[]` |
| `note_lookup` | 查找笔记 | `title` |
| `crawler_trigger` | 触发爬虫 | `url`, `waitForAuth` |

## 技术栈

### 前端
- Vue 3 + TypeScript
- Vite
- Pinia (状态管理)
- Element Plus (UI 组件)
- Vue Router
- Axios

### 后端
- Node.js + Express
- TypeScript
- Playwright (浏览器自动化)
- Cheerio (HTML 解析)
- ws (WebSocket)
- Multer (文件上传)

### RAG 核心
- LlamaIndex (TS)
- Ollama (本地嵌入模型)
- 简单 JSON 文件向量存储

## 环境变量

创建 `.env` 文件（参考 `.env.example`）：

```bash
API_PORT=3001
WEB_PORT=5173
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text
DATA_PATH=./apps/api/data
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 清理
pnpm clean
```

## 注意事项

1. **Ollama 要求**: 使用前需确保 Ollama 服务运行并拉取了嵌入模型
2. **浏览器驱动**: 首次使用爬虫功能时，Playwright 会自动下载浏览器驱动
3. **文件权限**: 确保应用有读写 `apps/api/data` 目录的权限

## License

MIT
