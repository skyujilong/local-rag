# Local RAG MCP Server

MCP Server 为 Claude CLI 提供本地知识库查询能力。

## 安装

```bash
pnpm install
pnpm build
```

## 配置

在项目根目录创建 `.claude/settings.json`:

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

## 使用

在 Claude CLI 中:

```
# 查询本地知识库
@local-rag local_rag_query(query="如何使用 React hooks?")

# 搜索文档
@local-rag knowledge_search(keywords=["React", "useState"])

# 查找笔记
@local-rag note_lookup(title="React 学习笔记")

# 爬取网页
@local-rag crawler_trigger(url="https://example.com/docs")
```

## 工具说明

### local_rag_query

查询本地知识库，获取相关文档片段。

**参数:**
- `query` (string, 必需): 查询问题
- `topK` (number, 可选): 返回结果数量，默认5

### knowledge_search

搜索知识库中的文档标题和内容。

**参数:**
- `keywords` (array, 必需): 搜索关键词列表

### note_lookup

查找特定笔记。

**参数:**
- `title` (string, 必需): 笔记标题或部分标题

### crawler_trigger

触发网页爬虫，将网页内容添加到知识库。

**参数:**
- `url` (string, 必需): 要爬取的网页 URL
- `waitForAuth` (boolean, 可选): 是否等待扫码登录，默认 false
