# DevRAG - 开发者知识库本地 RAG 产品设计

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
- ✅ **灵活抓取**：Playwright 支持登录认证

---

## 核心功能模块

### 1. 本地笔记管理
- **支持格式**：Markdown (.md)
- **存储位置**：用户指定的本地目录
- **功能**：
  - 创建/编辑/删除笔记
  - 标签分类
  - 全文搜索
  - 自动保存版本历史

### 2. 内部 Wiki 抓取
- **核心方案**：**Playwright 爬虫**（支持动态页面 + 登录认证）
- **支持场景**：
  - 自有 Wiki 平台（任意 HTTP/HTTPS 站点）
  - 需要登录的内部系统
  - 动态渲染的内容（SPA）
- **抓取策略**：
  - 增量更新（基于 URL 去重）
  - 认证支持（Cookie/脚本登录）
  - 反爬虫处理（随机延迟、重试）
  - 内容提取（智能去除导航、广告、脚本）

### 3. 向量化与索引
- **Embedding 模型**：
  - 默认：Ollama 本地模型
  - 可选：OpenAI API
- **向量存储**：轻量级本地向量数据库
- **索引策略**：
  - 分块索引（按段落/章节）
  - 增量更新
  - 相似度搜索 (Top-K)

### 4. RAG 查询接口
- **REST API**：`POST /api/rag/query`
- **输入**：用户问题/代码上下文
- **输出**：相关文档片段 + 向量检索结果
- **集成**：
  - Claude Code MCP Server
  - Claude API 直接调用

### 5. Web 管理界面
- **技术栈**：轻量级（如 Nuxt/Vite + 静态 HTML）
- **功能**：
  - 笔记管理（CRUD）
  - 抓取任务管理
  - 知识库浏览
  - 搜索与预览
  - 系统状态监控

---

## 技术架构建议

### 后端核心
```
CLI 工具
├── HTTP 服务器（轻量级）
├── Playwright 爬虫引擎
├── Ollama Embedding 集成
├── 向量存储（轻量级方案）
└── REST API
```

### 前端
```
Web 界面（极简优先）
├── 轻量级框架或纯静态
├── Markdown 编辑器
├── 任务管理
└── 搜索组件
```

### 数据存储
```
~/.devrag/
├── notes/           # Markdown 笔记
├── crawled/         # 抓取的内容
├── index/           # 向量索引
├── config/          # 配置文件
└── cache/           # 爬虫缓存
```

**技术栈选型原则**：
- 优先选择轻量、启动快的方案
- 避免重型框架和依赖
- 考虑单文件分发的可能性

---

## 核心工作流程

### 用户使用流程
1. **初始化**：`devrag init` → 创建数据目录、配置文件
2. **启动服务**：`devrag start` → 启动 Web 服务 (默认 http://localhost:3000)
3. **添加知识源**：
   - 上传/创建本地笔记
   - 配置 wiki 抓取任务
4. **构建索引**：自动或手动触发向量化
5. **查询**：通过 API 或 Web 界面搜索相关内容

### 抓取流程
```
配置抓取任务 → 认证登录 → 抓取内容 → 清洗提取 → 存储本地 → 向量化索引
```

---

## 产品差异点

### vs 传统文档管理工具
- ✅ **RAG 原生**：为 AI 查询优化，不是简单的文档搜索
- ✅ **开发者友好**：CLI + Web，无需离开终端
- ✅ **本地优先**：数据安全，无隐私担忧

### vs 现有 RAG 方案
- ✅ **轻量化**：单命令启动，无需 Docker/复杂部署
- ✅ **开箱即用**：内置 Ollama 支持，无需外部 API
- ✅ **专注开发者场景**：针对技术文档、代码知识优化

---

## MVP 功能范围

### Phase 1 (MVP) - 核心功能
- [ ] 本地 Markdown 笔记管理（CRUD + 搜索）
- [ ] Playwright 通用爬虫（支持登录）
- [ ] Ollama 本地向量化
- [ ] 轻量级 Web 界面
- [ ] REST API 查询接口
- [ ] Claude Code MCP 集成

### Phase 2 - 增强功能
- [ ] 增量更新机制
- [ ] 笔记标签与分类
- [ ] 抓取任务调度
- [ ] 导出/导入功能

### Phase 3 - 高级功能（可选）
- [ ] 笔记版本历史
- [ ] 多种 Embedding 模型支持
- [ ] 插件系统

---

## 配置示例

```yaml
# ~/.devrag/config.yaml
server:
  port: 3000

storage:
  data_dir: ~/.devrag/data

embedding:
  provider: ollama
  model: nomic-embed-text
  ollama_base_url: http://localhost:11434

sources:
  # 本地笔记目录
  - type: local_notes
    path: ~/docs/notes

  # 通用爬虫配置（支持任意网站）
  - type: crawler
    name: 内部 Wiki
    url: https://wiki.company.com
    start_url: /docs
    selectors:
      content: '.wiki-content, .markdown-body'
      links: 'a[href^="/docs"]'
    auth:
      type: cookie
      cookies: 'session=xxxx;'
    crawl_options:
      delay: 1000
      max_pages: 1000
```

---

## 命令行接口

```bash
# 初始化
devrag init

# 启动服务
devrag start
devrag start --port 8080

# 知识库管理
devrag source add --type wiki --url https://wiki.company.com
devrag source list
devrag source remove <id>

# 索引管理
devrag index build
devrag index status

# 查询测试
devrag query "如何配置 OAuth？"
```

---

## 产品定位确认

| 项目 | 确认 |
|------|------|
| **目标用户** | 个人开发者（非团队协作） |
| **Wiki 抓取** | Playwright 通用爬虫，支持登录 |
| **设计原则** | 极简轻量，最小依赖 |
| **技术栈** | 待定（优先轻量方案） |

## 核心差异点

### vs 传统文档工具
- ✅ **RAG 原生**：为 AI 查询优化
- ✅ **开发者友好**：CLI + Web，不离终端
- ✅ **本地优先**：数据安全，无隐私担忧

### vs 现有 RAG 方案
- ✅ **更轻量**：单命令启动，无复杂部署
- ✅ **开箱即用**：内置 Ollama，无需外部 API
- ✅ **通用抓取**：Playwright 支持任意 + 登录的站点
