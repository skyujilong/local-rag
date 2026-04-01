# Web Crawler 技术架构设计

| 文档版本 | 日期 | 作者 | 变更说明 |
|---------|------|------|---------|
| v1.0 | 2026-04-01 | Architect | 初始版本 |

---

## 1. 架构概览

### 1.1 系统分层图

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端层 (Vue 3 + Naive UI)                  │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ WebCrawler   │ CrawlProgress│ ContentPreview│ CrawlHistory        │
│ 主页面组件   │ 进度显示组件  │ 内容预览组件  │ 历史列表组件        │
├──────────────┴──────────────┴──────────────┴─────────────────────┤
│ 认证管理：AuthConfig / BrowserLogin / CookieInput / HeaderInput │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                        API 层 (Hono)                             │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ POST /crawl  │ POST /crawl  │ GET  /crawl  │ POST /crawl/auth    │
│ /single      │ /sitemap     │ /tasks       │ /launch-browser     │
├──────────────┴──────────────┴──────────────┴─────────────────────┤
│ 认证管理：POST /auth/cookie / /auth/header / /auth/extract-cookies│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        业务服务层                                │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ SinglePage   │ Sitemap      │ Recursive    │ AuthSessionManager  │
│ Crawler      │ Parser       │ Crawler      │ 认证会话管理        │
├──────────────┴──────────────┴──────────────┴─────────────────────┤
│ TaskScheduler：任务调度、进度跟踪、资源管理                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        共享基础层                                │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ Content      │ Playwright   │ Document     │ Embedding           │
│ Cleaner      │ BrowserPool  │ Importer     │ Service             │
│ 内容清洗     │ 浏览器实例池 │ 文档导入     │ 向量化服务          │
├──────────────┴──────────────┴──────────────┴─────────────────────┤
│ CryptoUtil：加密工具、TokenEncryptor：认证信息加密               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        数据存储层                                │
├──────────────┬──────────────┬──────────────┬─────────────────────┤
│ Notes Store  │ Vector Store │ SQLite DB    │ BrowserContext      │
│ 文件系统存储  │ ChromaDB     │ 任务/认证/URL │ Playwright 持久化   │
└──────────────┴──────────────┴──────────────┴─────────────────────┘
```

### 1.2 核心组件

**前端组件**
- **WebCrawler.vue**：主页面，路由入口，Tab 切换单页/Sitemap/递归模式
- **UrlInput.vue**：URL 输入组件，支持验证和格式化
- **CrawlProgress.vue**：批量爬取进度显示，支持暂停/继续
- **ContentPreview.vue**：爬取结果预览，支持编辑标题/内容/标签
- **ImportConfirm.vue**：批量导入确认界面，列表展示+质量评分
- **CrawlHistory.vue**：爬取历史列表，支持筛选和重试
- **AuthConfig.vue**：认证配置面板，Tab 切换 Cookie/Header/浏览器登录
- **BrowserLogin.vue**：浏览器登录流程组件，SSE 状态监听

**后端服务**
- **CrawlerService**：核心爬取服务，支持三种模式
- **SitemapParser**：Sitemap XML 解析服务
- **RecursiveCrawler**：递归爬取服务，链接发现和去重
- **ContentCleaner**：内容清洗服务，DOM 清理和正文提取
- **AuthSessionManager**：认证会话管理，加密存储和自动注入
- **TaskScheduler**：任务调度器，进度跟踪和资源管理
- **BrowserPool**：浏览器实例池，自动回收和内存管理

---

## 2. 技术栈

### 2.1 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vue 3** | ^3.4.0 | 前端框架，Composition API |
| **Naive UI** | ^2.38.0 | UI 组件库 |
| **Vue Router** | ^4.2.0 | 路由管理 |
| **TypeScript** | ^5.3.0 | 类型安全 |
| **Vite** | ^5.1.0 | 构建工具 |

**前端架构模式**
- 采用 **Composition API** + `<script setup>` 语法
- 状态管理：使用 `reactive` + `ref` 本地状态，复杂场景引入 Pinia
- API 通信：基于 `fetch` 的封装函数，统一错误处理
- 实时通信：SSE (Server-Sent Events) 用于浏览器登录状态推送

### 2.2 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js** | >= 20 | 运行时 |
| **Hono** | ^4.0.0 | Web 框架，轻量高性能 |
| **Playwright** | ^1.42.0 | 浏览器自动化，爬取引擎 |
| **better-sqlite3** | ^9.0.0 | SQLite 同步/异步 API，任务/认证存储 |
| **Zod** | ^3.25.76 | 请求参数校验 |
| **isomorphic-dompurify** | ^3.7.1 | HTML 清洗，XSS 防护 |
| **TypeScript** | ^5.3.0 | 类型安全 |

**后端架构模式**
- **分层架构**：API 层 → 业务服务层 → 基础层
- **依赖注入**：服务单例模式，通过 `export const xxxService = new XxxService()`
- **错误处理**：统一异常类继承 `AppError`，中间件捕获并格式化响应
- **异步任务**：使用 `setImmediate` 触发后台向量化，避免阻塞主流程

### 2.3 数据库

| 数据存储 | 技术 | 用途 |
|---------|------|------|
| **向量存储** | ChromaDB | 文档向量索引和语义搜索 |
| **关系存储** | SQLite | 爬取任务、认证信息、重复 URL 索引 |
| **文件系统** | `.devrag/notes/` | Markdown 笔记文件 |
| **文件系统** | `.devrag/auth/contexts/` | Playwright BrowserContext 持久化 |

**为什么选择 SQLite**
- ✅ 轻量级，无需额外服务进程
- ✅ 支持事务和并发访问
- ✅ 索引加速查询（重复 URL 检查 O(1) → O(log n)）
- ✅ 天然支持断点续爬（任务状态原子更新）
- ✅ 更好的性能（避免大 JSON 文件读写）

**数据一致性**
- 向量化失败不影响笔记保存，仅标记 `vectorizationStatus: failed`
- 认证信息加密后存储于 SQLite，密钥丢失时需重新登录
- 任务状态事务更新，服务重启后可从断点恢复

### 2.4 第三方服务

| 服务 | 用途 | 依赖方式 |
|------|------|---------|
| **Ollama** | 向量化嵌入模型 | HTTP API |
| **ChromaDB** | 向量数据库 | HTTP API |
| **Playwright Chromium** | 浏览器引擎 | 本地进程 |

---

## 3. 数据模型

### 3.1 实体关系图

```
┌────────────────────────────────────────────────────────────┐
│                    SQLite Database                         │
│                    (.devrag/crawl.db)                      │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐│
│  |  CrawlTask   │    | CrawlResult  │    | AuthProfile  ││
│  ├──────────────┤    ├──────────────┤    ├──────────────┤│
│  | taskId (PK)  │───<│ resultId (PK)│    │ id (PK)      ││
│  | mode         │    │ taskId (FK)  │    │ domain (UNIQ)││
│  | status       │    │ url (UNIQUE) │    │ type         ││
│  | currentIndex │◄───│ status       │    │ encryptedData││
│  | totalUrls    │    │ title        │    │ name         ││
│  | authProfileId │    │ content      │    │ createdAt    ││
│  | createdAt    │    │ wordCount    │    │ lastUsedAt   ││
│  | pausedAt     │    │ qualityScore │    └──────────────┘│
│  | error        │    │ importedAt   │                    │
│  └──────────────┘    │ retryCount   │    ┌──────────────┐│
│                      │ errorMessage │    │  UrlIndex   ││
│  ┌──────────────┐    └──────────────┘    ├──────────────┤│
│  |TaskCheckpoint│                        │ url (PK)     ││
│  ├──────────────┤                        │ noteId       ││
│  | taskId (FK)  │                        │ firstSeenAt  ││
│  | urlIndex     │                        └──────────────┘│
│  | checkpointData│                                        │
│  └──────────────┘                                        │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    文件系统                                 │
│  .devrag/notes/          .devrag/auth/contexts/            │
│  └── {noteId}.md         └── {authProfileId}/             │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    ChromaDB                                │
│  VectorChunk (embedding[], documentId, content)            │
└────────────────────────────────────────────────────────────┘
```

### 3.2 核心数据结构

**CrawlTask（爬取任务）**
```typescript
interface CrawlTask {
  taskId: string;
  mode: 'single' | 'sitemap' | 'recursive';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    completed: number;
    total: number;
    failed: number;
  };
  config: {
    urls?: string[];
    sitemapUrl?: string;
    startUrl?: string;
    maxDepth?: number;
    options: CrawlOptions;
  };
  results: CrawlResult[];
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}
```

**CrawlResult（爬取结果）**
```typescript
interface CrawlResult {
  url: string;
  title: string;
  content: string;
  metadata: {
    crawledAt: Date;
    wordCount: number;
    language?: string;
    qualityScore: number; // 0-1，正文占比
  };
  status: 'success' | 'failed' | 'auth_expired';
  error?: string;
  imported: boolean; // 是否已导入为 Note
}
```

**AuthProfile（认证配置）**
```typescript
interface AuthProfile {
  id: string;
  domain: string; // 域名，如 'github.com'
  type: 'cookie' | 'header' | 'browser';
  name: string; // 用户自定义别名，如"公司 GitLab"
  encryptedData: {
    // 加密后的认证信息
    cookies?: string; // Cookie 注入模式
    headerName?: string; // Header 注入模式
    headerValue?: string;
    browserContextPath?: string; // 浏览器登录模式
  };
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt?: Date; // 可选的过期时间
}
```

**Note（笔记，扩展字段）**
```typescript
interface Note {
  // ... 现有字段 ...
  source?: 'markdown' | 'webpage' | 'api';
  sourceUrl?: string; // 爬取来源 URL
  crawlMetadata?: {
    crawledAt: Date;
    qualityScore: number;
    authProfileId?: string; // 使用的认证配置
  };
}
```

### 3.3 SQLite 数据库表结构

**数据库文件**：`.devrag/crawl.db`

```sql
-- 爬取任务表
CREATE TABLE crawl_tasks (
  task_id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('single', 'sitemap', 'recursive')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed', 'auth_expired')),
  current_index INTEGER DEFAULT 0,
  total_urls INTEGER NOT NULL,
  auth_profile_id TEXT,
  config TEXT NOT NULL, -- JSON: { urls: [], options: {} }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  paused_at TEXT,
  error TEXT,
  FOREIGN KEY (auth_profile_id) REFERENCES auth_profiles(id)
);
CREATE INDEX idx_tasks_status ON crawl_tasks(status);
CREATE INDEX idx_tasks_created ON crawl_tasks(created_at DESC);

-- 爬取结果表
CREATE TABLE crawl_results (
  result_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'pending', 'auth_expired')),
  title TEXT,
  content TEXT,
  word_count INTEGER,
  quality_score REAL CHECK(quality_score BETWEEN 0 AND 1),
  imported_at TEXT,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES crawl_tasks(task_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_results_url ON crawl_results(task_id, url);
CREATE INDEX idx_results_status ON crawl_results(task_id, status);

-- 认证配置表
CREATE TABLE auth_profiles (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('cookie', 'header', 'browser')),
  name TEXT NOT NULL,
  encrypted_data TEXT NOT NULL, -- JSON: { cookies: "..." }
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  expires_at TEXT
);
CREATE UNIQUE INDEX idx_auth_domain ON auth_profiles(domain);
CREATE INDEX idx_auth_last_used ON auth_profiles(last_used_at DESC);

-- 断点续爬检查点表
CREATE TABLE task_checkpoints (
  task_id TEXT PRIMARY KEY,
  url_index INTEGER NOT NULL,
  checkpoint_data TEXT NOT NULL, -- JSON: { completedUrls: [], failedUrls: {} }
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES crawl_tasks(task_id) ON DELETE CASCADE
);

-- URL 索引表（用于重复检测）
CREATE TABLE url_index (
  url TEXT PRIMARY KEY,
  note_id TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  crawl_count INTEGER DEFAULT 1
);
CREATE INDEX idx_url_seen ON url_index(last_seen_at DESC);
```

**加密密钥存储** (`/.devrag/auth/key.json`, 权限 0600)
```json
{
  "keyId": "sha256(mac+hostname)",
  "encryptedKey": "AES-256-GCM(encrypted)",
  "salt": "random-salt"
}
```

**BrowserContext 持久化目录** (`.devrag/auth/contexts/{authProfileId}/`)
- `cookies.json`: Playwright Cookie 数据
- `storageState.json`: 完整的 BrowserContext 状态

---

## 4. API 设计

### 4.1 RESTful 接口列表

#### 单页面爬取

**POST /api/crawl/single**
```typescript
// Request
interface CrawlSingleRequest {
  url: string;
  options?: {
    timeout?: number; // 默认 30000ms
    waitForSelector?: string;
    cssSelector?: string; // 自定义 CSS 选择器
  };
  authProfileId?: string; // 可选，自动匹配域名
}

// Response (同步阻塞)
interface CrawlSingleResponse {
  taskId: string;
  result: CrawlResult;
}

// Error Response
interface CrawlSingleError {
  error: string;
  code: 'CRAWL_ERROR' | 'TIMEOUT' | 'AUTH_EXPIRED';
  url: string;
  message: string;
}
```

#### 站点地图爬取

**POST /api/crawl/sitemap/parse**
```typescript
// Request
interface ParseSitemapRequest {
  sitemapUrl: string;
  authProfileId?: string;
}

// Response
interface ParseSitemapResponse {
  urls: string[];
  total: number;
  sitemapUrl: string;
}
```

**POST /api/crawl/sitemap/start**
```typescript
// Request
interface StartSitemapCrawlRequest {
  urls: string[];
  options?: {
    timeout?: number;
    interval?: number; // 默认 1000ms，最小 1000ms
    maxPages?: number; // 默认 200，硬上限 500
  };
  authProfileId?: string;
}

// Response
interface StartSitemapCrawlResponse {
  taskId: string;
  total: number;
  estimatedDuration: number; // 秒
}
```

**GET /api/crawl/tasks/:taskId**
```typescript
// Response
interface GetTaskResponse {
  taskId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    completed: number;
    total: number;
    failed: number;
  };
  results: CrawlResult[];
  currentUrl?: string; // 当前正在爬取的 URL
  error?: string;
}
```

#### 递归爬取

**POST /api/crawl/recursive/discover**
```typescript
// Request
interface DiscoverLinksRequest {
  startUrl: string;
  maxDepth: number; // 1-3
  urlFilter?: {
    include?: string[]; // 包含模式（正则）
    exclude?: string[]; // 排除模式
  };
  authProfileId?: string;
}

// Response
interface DiscoverLinksResponse {
  urls: string[];
  total: number;
  depth: number;
}
```

**POST /api/crawl/recursive/start**
```typescript
// Request (同 Sitemap)
interface StartRecursiveCrawlRequest {
  urls: string[];
  options?: CrawlOptions;
  authProfileId?: string;
}

// Response
interface StartRecursiveCrawlResponse {
  taskId: string;
  total: number;
}
```

#### 任务管理

**GET /api/crawl/tasks**
```typescript
// Query
interface GetTasksQuery {
  status?: 'pending' | 'running' | 'completed' | 'failed';
  limit?: number;
  offset?: number;
}

// Response
interface GetTasksResponse {
  tasks: CrawlTask[];
  total: number;
}
```

**POST /api/crawl/tasks/:taskId/pause**
```typescript
// Response
interface PauseTaskResponse {
  success: true;
  savedProgress: number;
}
```

**POST /api/crawl/tasks/:taskId/resume**
```typescript
// Response
interface ResumeTaskResponse {
  success: true;
}
```

**POST /api/crawl/tasks/:taskId/retry**
```typescript
// Request
interface RetryTaskRequest {
  failedOnly?: boolean; // 仅重试失败的页面
}

// Response
interface RetryTaskResponse {
  success: true;
  newTaskId: string;
}
```

**DELETE /api/crawl/tasks/:taskId**
```typescript
// Response
interface DeleteTaskResponse {
  success: true;
}
```

#### 导入确认

**POST /api/crawl/import**
```typescript
// Request
interface ImportRequest {
  taskId: string;
  items: Array<{
    url: string;
    title: string;
    content: string;
    tags?: string[];
    overwrite?: boolean; // 覆盖已存在的 URL
  }>;
}

// Response
interface ImportResponse {
  imported: number;
  documentIds: string[];
  skipped: number; // 重复 URL 未覆盖
  failed: number;
  errors?: Array<{ url: string; error: string }>;
}
```

**POST /api/crawl/check-duplicates**
```typescript
// Request
interface CheckDuplicatesRequest {
  urls: string[];
}

// Response
interface CheckDuplicatesResponse {
  duplicates: Record<string, { // url -> info
    exists: boolean;
    noteId?: string;
    importedAt?: Date;
    title?: string;
  }>;
}
```

#### 认证管理

**POST /api/crawl/auth/launch-browser**
```typescript
// Request
interface LaunchBrowserRequest {
  url: string; // 登录页 URL
  name?: string; // 认证配置别名（如"个人 GitHub"）
}

// Response (成功)
interface LaunchBrowserResponse {
  sessionId: string;
  message: "浏览器已启动，请在窗口中完成登录操作";
}

// Response (无 GUI 环境)
interface LaunchBrowserNoDisplayResponse {
  error: "no_display";
  message: "当前环境不支持弹出浏览器，请使用 Cookie 注入方式";
}
```

**GET /api/crawl/auth/launch-browser/:sessionId/events** (SSE)
```typescript
// SSE Events (仅用于连接状态通知，不推送登录成功事件)
type BrowserLoginEvent =
  | { event: 'browser_launched'; data: {} }  // 浏览器已启动
  | { event: 'browser_closed'; data: {} }     // 浏览器已关闭
  | { event: 'timeout'; data: { message: string } }  // 5分钟超时
  | { event: 'error'; data: { error: string } };
```

**POST /api/crawl/auth/extract-cookies**
```typescript
// Request (用户点击"我已完成登录"后调用)
interface ExtractCookiesRequest {
  sessionId: string;
  name?: string; // 认证配置别名
}

// Response
interface ExtractCookiesResponse {
  success: true;
  authProfile: {
    id: string;
    domain: string;  // 从 URL 自动提取
    name: string;
    type: 'browser';
    cookieCount: number;
  };
  message: "认证已保存";
}

// Error Response
interface ExtractCookiesErrorResponse {
  error: string;
  code: 'SESSION_EXPIRED' | 'BROWSER_CLOSED' | 'INVALID_SESSION';
  message: "浏览器会话已失效，请重新启动";
}
```

**POST /api/crawl/auth/cookie**
```typescript
// Request
interface SaveCookieRequest {
  domain: string;
  cookie: string; // Cookie 字符串
  name?: string;
}

// Response
interface SaveCookieResponse {
  success: true;
  authProfile: {
    id: string;
    domain: string;
    name: string;
  };
}
```

**POST /api/crawl/auth/header**
```typescript
// Request
interface SaveHeaderRequest {
  domain: string;
  headerName: string; // 'Authorization'
  headerValue: string; // 'Bearer xxx'
  name?: string;
}

// Response
interface SaveHeaderResponse {
  success: true;
  authProfile: {
    id: string;
    domain: string;
    name: string;
  };
}
```

**GET /api/crawl/auth/profiles**
```typescript
// Response
interface GetAuthProfilesResponse {
  profiles: Array<{
    id: string;
    domain: string;
    type: 'cookie' | 'header' | 'browser';
    name: string;
    createdAt: Date;
    lastUsedAt: Date;
  }>;
}
```

**DELETE /api/crawl/auth/profiles/:profileId**
```typescript
// Response
interface DeleteAuthProfileResponse {
  success: true;
}
```

### 4.2 请求/响应格式

**统一响应格式**
```typescript
// 成功响应
interface SuccessResponse<T> {
  data: T;
}

// 错误响应
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

**分页响应**
```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

---

## 5. 核心流程

### 5.1 单页面爬取流程

```
用户输入 URL
    ↓
前端验证 URL 格式
    ↓
POST /api/crawl/single (同步阻塞)
    ↓
后端 CrawlerService.crawlUrl()
    ├─ 创建 BrowserContext（注入认证信息）
    ├─ Page.goto(url, { waitUntil: 'networkidle' })
    ├─ 等待 waitForSelector（可选）
    ├─ ContentCleaner.extractMainContent()
    │   ├─ 移除 nav/header/footer/aside 等元素
    │   ├─ 提取 main/article/[role="main"]
    │   ├─ DOMPurify.sanitize()
    │   └─ 计算质量评分（正文占比）
    ├─ 提取元数据（title, language, wordCount）
    └─ 返回 CrawlResult
    ↓
前端显示 ContentPreview 组件
    ├─ 展示标题、内容、字数、来源 URL
    ├─ 支持编辑标题和添加标签
    └─ 检测重复 URL（提示覆盖/副本）
    ↓
用户确认导入
    ↓
POST /api/crawl/import
    ├─ NotesService.createNote()
    │   ├─ 生成 Note ID 和文件路径
    │   ├─ 写入 Markdown 文件
    │   ├─ 保存元数据（source: 'webpage', sourceUrl）
    │   └─ 异步触发向量化
    └─ 返回 documentId
    ↓
前端跳转到笔记详情页
```

### 5.2 站点地图批量爬取流程

```
用户输入 Sitemap URL
    ↓
POST /api/crawl/sitemap/parse
    ↓
后端 SitemapParser.parse()
    ├─ Fetch Sitemap XML
    ├─ DOMParser 解析 <url><loc> 元素
    ├─ 提取所有 URL
    └─ 返回 URL 列表
    ↓
前端显示 URL 列表
    ├─ 总数统计
    ├─ 支持 URL 预览
    └─ 用户选择全部/部分
    ↓
POST /api/crawl/sitemap/start
    ↓
后端 TaskScheduler.createTask()
    ├─ 创建 CrawlTask（status: 'running'）
    ├─ 持久化任务状态
    └─ 启动后台爬取流程
    ↓
后台批量爬取（串行，间隔 >= 1s）
    ├─ FOR EACH url:
    │   ├─ GET /api/crawl/tasks/:taskId 轮询进度
    │   ├─ CrawlerService.crawlUrl()
    │   ├─ 更新 CrawlResult[]
    │   ├─ 更新 progress
    │   ├─ 每 50 页：关闭 BrowserContext → GC → 创建新实例
    │   ├─ 检测 RSS 内存：> 800MB 告警，> 1GB 暂停
    │   └─ 失败重试 2 次，仍失败则标记 failed
    └─ 所有页面完成
    ↓
前端显示 ImportConfirm 组件
    ├─ 列表展示所有 CrawlResult
    ├─ 质量评分高/中/低标记
    ├─ 标注已导入 URL（灰色）
    ├─ 默认全选，用户取消勾选
    └─ 批量设置标签
    ↓
POST /api/crawl/import
    ├─ 批量创建 Note
    ├─ 跳过重复 URL（未勾选覆盖）
    └─ 返回导入统计
    ↓
前端显示导入结果汇总
```

### 5.3 浏览器登录认证流程（用户手动确认）

**设计原则**：
- 不自动检测登录成功状态（各网站登录后行为差异太大）
- 用户自行判断是否登录成功，点击确认按钮
- 系统直接提取当前 Cookie/Session，无论用户是否真的登录成功
- SSE 仅用于连接状态通知，不推送登录成功事件

```
用户选择"浏览器登录"模式
    ↓
前端输入登录页 URL（如 https://github.com/login）
    ↓
输入认证配置别名（如"个人 GitHub"）
    ↓
POST /api/crawl/auth/launch-browser
    ↓
后端 AuthSessionManager.launchBrowser()
    ├─ 检测 GUI 环境（process.env.DISPLAY）
    │   ├─ 无 DISPLAY：返回 { noDisplay: true, message: "当前环境不支持弹出浏览器..." }
    │   └─ 有 DISPLAY：继续
    ├─ 启动 Playwright 有头浏览器（headless: false）
    ├─ 导航到登录页 URL
    ├─ 创建 SSE 通道（用于连接状态通知）
    └─ 返回 { sessionId, message: "浏览器已启动，请在窗口中完成登录" }
    ↓
前端连接 SSE: GET /auth/launch-browser/:sessionId/events
    ↓
后端推送 { event: 'browser_launched' }
    ↓
前端显示登录引导界面
    ├─ <n-alert type="info"> 浏览器窗口已打开，请在窗口中完成登录操作 </n-alert>
    ├─ <n-alert type="warning"> 完成登录后，请点击下方按钮提取认证信息 </n-alert>
    ├─ 显示当前浏览器状态（运行中 / 已关闭）
    └─ 主要按钮：<n-button type="primary" size="large"> 我已完成登录，提取认证信息 </n-button>
    ↓
用户在本地浏览器窗口中手动登录
    ├─ 输入账号密码
    ├─ 处理验证码
    ├─ 完成 2FA
    └─ 登录成功，跳转到任意页面
    ↓
用户返回应用，点击"我已完成登录"按钮
    ↓
POST /api/crawl/auth/extract-cookies
    ↓
后端 AuthSessionManager.extractCookies()
    ├─ 提取 BrowserContext.cookies()
    ├─ 提取 BrowserContext.storageState()
    ├─ 加密 Cookie 数据
    ├─ 保存 AuthProfile（type: 'browser', domain: 从 URL 提取）
    ├─ 持久化 BrowserContext 到 .devrag/auth/contexts/{id}/
    ├─ 关闭浏览器窗口
    └─ 返回 { authProfileId, domain, cookieCount }
    ↓
前端显示"认证已保存"
    ├─ 添加到认证配置列表
    └─ 自动选中该认证用于后续爬取
```

**错误处理**：
- 用户取消登录：点击"取消"按钮 → 关闭浏览器，SSE 连接断开
- 浏览器意外关闭：SSE 推送 `{ event: 'browser_closed' }` → 前端提示"浏览器已关闭，请重新启动"
- 超时未确认：5 分钟后自动关闭浏览器，提示"登录超时，请重试"

### 5.4 批量爬取断点续爬与异常处理

**断点续爬机制**：
- 任务状态持久化到 SQLite（`crawl_tasks` 和 `task_checkpoints` 表）
- 每完成 1 页，原子更新 `currentIndex` 和 `checkpoint_data`
- 任务暂停/失败后，重启服务可从断点恢复

```
批量爬取任务启动
    ↓
TaskScheduler.createTask()
    ├─ INSERT INTO crawl_tasks (status='pending', total_urls=N)
    ├─ INSERT INTO task_checkpoints (url_index=0, checkpoint_data='{}')
    └─ 返回 taskId
    ↓
TaskScheduler.startCrawl(taskId)
    ├─ UPDATE crawl_tasks SET status='running', current_index=0
    └─ 启动后台爬取循环
    ↓
批量爬取循环（串行，间隔 >= 1s）
    │
    ├─ FOR i IN range(currentIndex, totalUrls):
    │   │
    │   ├─ 从 checkpoints 读取已完成/失败 URL 列表
    │   │
    │   ├─ IF url IN completedUrls: CONTINUE  // 跳过已完成
    │   │
    │   ├─ 调用 CrawlerService.crawlUrl(urls[i])
    │   │   ├─ 成功：INSERT/UPDATE crawl_results (status='success')
    │   │   ├─ 失败（网络）：INSERT/UPDATE crawl_results (status='failed', retry_count++)
    │   │   └─ 失败（认证过期）：→ 进入认证过期处理（见下方）
    │   │
    │   ├─ UPDATE task_checkpoints
    │   │   SET checkpoint_data = JSON.stringify({ completedUrls, failedUrls })
    │   │
    │   ├─ UPDATE crawl_tasks SET current_index = i + 1
    │   │
    │   ├─ IF i % 50 == 0: BrowserPool.forceRecycle()  // 每 50 页强制 GC
    │   │
    │   └─ IF process.memoryUsage().rss > 1GB: 暂停任务，等待内存回收
    │
    └─ 全部完成
        ├─ UPDATE crawl_tasks SET status='completed'
        └─ 进入导入确认流程
```

**异常场景处理**：

#### 场景 1：认证过期
```
第 N 页爬取失败：检测到登录页（URL 包含 'login' 或 title 包含 'Sign in'）
    ↓
CrawlerService 标记 CrawlResult.status = 'auth_expired'
    ↓
TaskScheduler 暂停任务（事务操作）
    ├─ BEGIN TRANSACTION
    ├─ UPDATE crawl_tasks SET status='auth_expired', paused_at=datetime('now')
    ├─ UPDATE task_checkpoints SET checkpoint_data = '{...}'  // 保存当前进度
    └─ COMMIT
    ↓
前端显示认证过期提示
    ├─ <n-alert type="warning"> 认证已过期，请重新登录后继续 </n-alert>
    ├─ 进度信息：已完成 X / 总 Y 页（当前第 X+1 页认证失败）
    └─ 操作按钮：
        ├─ [重新登录并继续]  → 打开浏览器登录流程，完成后自动恢复
        ├─ [跳过该页继续]    → 标记当前页为 failed，继续下一页
        └─ [终止任务]        → 保存已完成结果，进入导入确认
    ↓
用户选择"重新登录并继续"
    ├─ 浏览器登录流程（同 5.3）
    ├─ 登录成功后自动调用 POST /api/crawl/tasks/:taskId/resume
    └─ 任务从 currentIndex 继续执行
```

#### 场景 2：网络超时/错误
```
第 N 页爬取失败：网络超时（timeout）或连接错误
    ↓
CrawlerService 标记 CrawlResult.status = 'failed'
    ├─ retry_count++
    └─ error_message = 'Network timeout after 30s'
    ↓
IF retry_count < 3:
    └─ 稍后重试（间隔 5 秒）
ELSE:
    └─ 标记为永久失败，继续下一页
    └─ checkpoints.failedUrls[url] = { error: 'Network timeout', retries: 3 }
```

#### 场景 3：服务崩溃/重启
```
批量爬取进行中，后端服务崩溃
    ↓
服务重启后
    ↓
TaskScheduler.recoverRunningTasks()
    ├─ SELECT * FROM crawl_tasks WHERE status = 'running'
    ├─ FOR EACH task:
    │   ├─ 读取 task_checkpoints.checkpoint_data
    │   ├─ 重置状态为 'paused'
    │   └─ 通知前端：任务因服务重启而暂停
    └─ 前端显示"任务已暂停，点击继续恢复"
    ↓
用户点击"继续"
    ├─ POST /api/crawl/tasks/:taskId/resume
    └─ 任务从 currentIndex 继续执行
```

#### 场景 4：内存超限
```
批量爬取进行中，RSS 内存 > 1GB
    ↓
MemoryMonitor 检测到超限
    ↓
TaskScheduler.pauseTask()
    ├─ UPDATE crawl_tasks SET status='paused', error='Memory limit exceeded'
    ├─ BrowserPool.forceRecycle()  // 强制回收浏览器实例
    └─ global.gc?.()  // 触发 Node.js 垃圾回收
    ↓
前端显示"内存超限，任务已暂停，点击继续恢复"
    ↓
用户点击"继续"
    ├─ POST /api/crawl/tasks/:taskId/resume
    └─ 任务从 currentIndex 继续执行（内存已释放）
```

**断点续爬数据结构**：
```typescript
interface TaskCheckpoint {
  taskId: string;
  urlIndex: number;  // 下一次要爬取的 URL 索引
  checkpointData: {
    completedUrls: string[];      // 已完成的 URL
    failedUrls: Record<string, {  // 失败的 URL 及原因
      error: string;
      retries: number;
    }>;
    skippedUrls: string[];         // 用户选择跳过的 URL
  };
  updatedAt: Date;
}
```

---

## 6. 安全设计

### 6.1 认证授权

**访问控制**
- 绑定 `localhost:PORT`，不暴露公网访问
- 无用户认证系统（本地工具，单用户）
- 未来扩展：支持 Basic Auth 或 API Token

**认证信息加密**
```typescript
// 加密流程
class CryptoUtil {
  // 1. 生成密钥（基于机器标识）
  generateKey(): Buffer {
    const mac = getMacAddress();
    const hostname = os.hostname();
    const keyId = createHash('sha256').update(mac + hostname).digest('hex');

    // 检查密钥是否已存在
    const existingKey = this.loadKey(keyId);
    if (existingKey) return existingKey;

    // 生成新密钥
    const key = randomBytes(32); // AES-256
    const salt = randomBytes(16);
    this.saveKey(keyId, key, salt);
    return key;
  }

  // 2. 加密数据
  encrypt(plaintext: string): string {
    const key = this.generateKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    });
  }

  // 3. 解密数据
  decrypt(ciphertext: string): string {
    const key = this.generateKey();
    const { iv, authTag, data } = JSON.parse(ciphertext);

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

**密钥管理**
- 密钥文件路径：`.devrag/auth/key.json`
- 文件权限：`0600`（仅当前用户可读写）
- 密钥丢失场景：机器标识变化时，提示"认证数据已失效，请重新配置"

### 6.2 数据加密

**Cookie/Token 加密存储**
```typescript
interface AuthProfile {
  encryptedData: {
    cookies?: string; // AES-256-GCM 加密
    headerName?: string;
    headerValue?: string; // AES-256-GCM 加密
  };
}
```

**日志脱敏**
```typescript
// 敏感信息不明文输出到日志
const sanitizeLog = (data: unknown): unknown => {
  if (typeof data === 'string' && data.includes('cookie')) {
    return '[REDACTED]';
  }
  // ... 递归处理对象
};
```

### 6.3 输入验证

**URL 验证**
```typescript
import { z } from 'zod';

const urlSchema = z.string().url().refine(
  (url) => {
    const parsed = new URL(url);
    // 仅允许 http/https 协议
    return ['http:', 'https:'].includes(parsed.protocol);
  },
  { message: '仅支持 HTTP/HTTPS 协议' }
);
```

**CSS 选择器验证**
```typescript
const cssSelectorSchema = z.string().max(200).refine(
  (selector) => {
    try {
      document.querySelector(selector);
      return true;
    } catch {
      return false;
    }
  },
  { message: '无效的 CSS 选择器' }
);
```

**Cookie 格式验证**
```typescript
const cookieSchema = z.string().refine(
  (cookie) => {
    // 简单验证：包含 '='
    return cookie.includes('=');
  },
  { message: 'Cookie 格式无效' }
);
```

### 6.4 XSS 防护

**HTML 清洗**
```typescript
import DOMPurify from 'isomorphic-dompurify';

const cleanHtml = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });
};
```

**内容转义**
```typescript
// 导入前转义 Markdown 特殊字符
const escapeMarkdown = (text: string): string => {
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\|/g, '\\|');
};
```

---

## 7. 性能优化

### 7.1 缓存策略

**浏览器实例池**
```typescript
class BrowserPool {
  private contexts: Map<string, BrowserContext> = new Map();
  private maxInstances = 2; // 硬上限

  async getContext(authProfileId?: string): Promise<BrowserContext> {
    // 复用已存在的实例
    const key = authProfileId || 'default';
    if (this.contexts.has(key)) {
      return this.contexts.get(key)!;
    }

    // 检查实例数上限
    if (this.contexts.size >= this.maxInstances) {
      // 等待或清理最久未使用的实例
      await this.waitOrEvict();
    }

    // 创建新实例
    const context = await this.createContext(authProfileId);
    this.contexts.set(key, context);
    return context;
  }

  // 每 50 页强制回收
  async forceRecycle(): Promise<void> {
    for (const [key, context] of this.contexts) {
      await context.close();
      this.contexts.delete(key);
    }
    global.gc?.(); // 触发垃圾回收
  }
}
```

**Sitemap 解析缓存**
```typescript
const sitemapCache = new Map<string, { urls: string[]; timestamp: number }>();

const getCachedSitemap = (sitemapUrl: string): string[] | null => {
  const cached = sitemapCache.get(sitemapUrl);
  if (cached && Date.now() - cached.timestamp < 3600000) { // 1 小时
    return cached.urls;
  }
  return null;
};
```

### 7.2 数据库优化

**向量存储优化**
- 批量向量化：积累多个文档后批量调用 Embedding API
- 异步向量化：使用 `setImmediate` 避免阻塞主流程
- 失败重试：向量化失败后自动重试 3 次

**文件存储优化**
- 元数据缓存：内存缓存笔记元数据，减少文件读取
- 延迟加载：笔记内容按需从文件读取
- 批量写入：元数据变更批量写入文件

### 7.3 前端优化

**虚拟滚动**
```vue
<template>
  <n-virtual-list
    :items="crawlResults"
    :item-size="80"
    :item-resizable="true"
  >
    <template #default="{ item }">
      <CrawlResultItem :result="item" />
    </template>
  </n-virtual-list>
</template>
```

**防抖和节流**
```typescript
// URL 输入防抖
const debouncedValidateUrl = useDebounceFn((url: string) => {
  validateUrl(url);
}, 500);

// 进度轮询节流
const throttledPollProgress = useThrottleFn(async () => {
  const progress = await fetchProgress(taskId);
  updateProgress(progress);
}, 1000);
```

**代码分割**
```typescript
// 路由懒加载
const routes = [
  {
    path: '/crawler',
    component: () => import('./views/WebCrawler.vue'),
  },
];
```

### 7.4 批量爬取性能约束

**资源限制**
| 约束项 | 限制值 | 实现 |
|--------|--------|------|
| 同时活跃浏览器实例数 | <= 2 | BrowserPool 强制限制 |
| 批量爬取默认并发数 | 1（串行） | TaskScheduler 逐页调度 |
| 单个批量任务最大页面数 | 默认 200，硬上限 500 | 前端校验 + 后端拦截 |
| 每页爬取后强制 GC 间隔 | 50 页 | BrowserPool.forceRecycle() |
| 爬取任务总内存上限 | 1GB | RSS 监控 + 自动熔断 |
| 请求间隔 | >= 1 秒 | 前端最小值限制 + 后端强制等待 |

**内存监控**
```typescript
class MemoryMonitor {
  private checkInterval = 10000; // 10 秒

  start() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const rssMB = usage.rss / 1024 / 1024;

      if (rssMB > 1000) {
        log.warn(`内存超限: ${rssMB.toFixed(2)}MB`);
        taskScheduler.pauseCurrentTask();
      }

      if (rssMB > 800) {
        log.warn(`内存告警: ${rssMB.toFixed(2)}MB`);
        browserPool.forceRecycle();
      }
    }, this.checkInterval);
  }
}
```

---

## 8. 部署方案

### 8.1 环境配置

**开发环境**
```bash
# 安装依赖
pnpm install

# 安装 Playwright 浏览器
npx playwright install chromium

# 启动开发服务器
pnpm dev
```

**生产环境**
```bash
# 构建
pnpm build

# 启动
pnpm start
```

**环境变量**
```bash
# .env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=nomic-embed-text
CHROMADB_PATH=./.devrag/chromadb
SERVER_PORT=3000
LOG_LEVEL=info
```

### 8.2 部署流程

**本地部署**
```bash
# 1. 克隆仓库
git clone <repo>
cd local-rag

# 2. 安装依赖
pnpm install

# 3. 初始化 Ollama
ollama pull nomic-embed-text

# 4. 启动服务
pnpm start
```

**Docker 部署**
```dockerfile
# Dockerfile
FROM node:20-alpine

# 安装 Playwright 依赖
RUN apk add --no-cache chromium

# 安装应用依赖
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# 复制源码
COPY . .

# 构建
RUN pnpm build

# 启动
CMD ["pnpm", "start"]
```

**注意**：Docker 容器无 GUI 环境，不支持浏览器登录模式，仅支持 Cookie/Header 注入。

### 8.3 监控和日志

**日志配置**
```typescript
// winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: '.devrag/logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: '.devrag/logs/combined.log',
    }),
  ],
});
```

**性能监控**
```typescript
// 爬取性能指标
class CrawlerMetrics {
  private metrics = {
    totalCrawls: 0,
    successfulCrawls: 0,
    failedCrawls: 0,
    averageTime: 0,
  };

  record(duration: number, success: boolean) {
    this.metrics.totalCrawls++;
    if (success) this.metrics.successfulCrawls++;
    else this.metrics.failedCrawls++;

    // 更新平均时间
    this.metrics.averageTime =
      (this.metrics.averageTime * (this.metrics.totalCrawls - 1) + duration) /
      this.metrics.totalCrawls;
  }

  getStats() {
    return {
      ...this.metrics,
      successRate: this.metrics.successfulCrawls / this.metrics.totalCrawls,
    };
  }
}
```

---

### 8.4 数据库迁移策略

**从 JSON 迁移到 SQLite**

**迁移触发条件**：
- 首次启动时检查 `.devrag/crawl.db` 是否存在
- 如果不存在且检测到旧 JSON 文件（`.devrag/crawl/tasks.json`），自动触发迁移
- 迁移完成后备份旧 JSON 文件到 `.devrag/crawl/migration-backup/`

**迁移脚本实现**：
```typescript
// src/server/services/migrate-to-sqlite.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

interface JsonTask {
  taskId: string;
  mode: 'single' | 'sitemap' | 'recursive';
  status: string;
  results: Array<{
    url: string;
    title: string;
    content: string;
    status: string;
    // ...
  }>;
  createdAt: string;
  // ...
}

export class JsonToSqliteMigrator {
  private db: Database.Database;
  private jsonDir: string;

  constructor(dbPath: string, jsonDir: string) {
    this.db = new Database(dbPath);
    this.jsonDir = jsonDir;
  }

  async migrate(): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    const errors: string[] = [];
    let migrated = 0;

    try {
      // 1. 检查是否需要迁移
      const tasksJsonPath = path.join(this.jsonDir, 'tasks.json');
      if (!fs.existsSync(tasksJsonPath)) {
        return { success: true, migrated: 0, errors: [] };
      }

      // 2. 读取旧 JSON 数据
      const jsonContent = fs.readFileSync(tasksJsonPath, 'utf-8');
      const tasks: JsonTask[] = JSON.parse(jsonContent);

      // 3. 开始事务迁移
      const migrate = this.db.transaction((taskList: JsonTask[]) => {
        for (const task of taskList) {
          try {
            // 插入任务
            this.db.prepare(`
              INSERT INTO crawl_tasks (
                task_id, mode, status, current_index, total_urls, config, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              task.taskId,
              task.mode,
              task.status,
              0,
              task.results.length,
              JSON.stringify({ urls: task.results.map(r => r.url) }),
              task.createdAt,
              task.createdAt
            );

            // 插入结果
            const insertResult = this.db.prepare(`
              INSERT INTO crawl_results (
                result_id, task_id, url, status, title, content, word_count, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const result of task.results) {
              insertResult.run(
                `${task.taskId}-${result.url}`,
                task.taskId,
                result.url,
                result.status,
                result.title,
                result.content,
                result.content.length,
                task.createdAt
              );
            }

            migrated++;
          } catch (err) {
            errors.push(`Task ${task.taskId}: ${err}`);
          }
        }
      });

      // 执行迁移
      migrate(tasks);

      // 4. 备份旧文件
      if (migrated > 0) {
        const backupDir = path.join(this.jsonDir, 'migration-backup');
        fs.mkdirSync(backupDir, { recursive: true });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        fs.copyFileSync(
          tasksJsonPath,
          path.join(backupDir, `tasks-${timestamp}.json`)
        );

        // 5. 删除旧文件（可选，先备份）
        // fs.unlinkSync(tasksJsonPath);
      }

      return { success: true, migrated, errors };
    } catch (err) {
      return { success: false, migrated, errors: [String(err)] };
    }
  }
}
```

**版本管理**：
```sql
-- 版本控制表
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  description TEXT
);

-- 初始版本
INSERT INTO schema_migrations (version, description) VALUES (1, 'Initial schema with SQLite storage');
```

**启动时检查迁移**：
```typescript
// src/server/index.ts
export async function initializeDatabase() {
  const dbPath = path.join(process.cwd(), '.devrag', 'crawl.db');
  const jsonDir = path.join(process.cwd(), '.devrag', 'crawl');

  // 初始化数据库
  initDatabaseSchema(dbPath);

  // 检查是否需要迁移
  const migrator = new JsonToSqliteMigrator(dbPath, jsonDir);
  const result = await migrator.migrate();

  if (result.migrated > 0) {
    logger.info(`Migrated ${result.migrated} tasks from JSON to SQLite`);
    if (result.errors.length > 0) {
      logger.warn(`Migration errors: ${result.errors.join(', ')}`);
    }
  }
}
```

---

## 9. ADR（架构决策记录）

| 决策 | 背景 | 方案 | 权衡 |
|------|------|------|------|
| **爬取引擎选择** | 需要支持动态页面渲染 | 继续使用 Playwright（已集成） | 优势：支持 JS 渲染、API 完善<br>劣势：资源消耗大（200MB/实例） |
| **批量爬取并发策略** | 避免内存耗尽和反爬 | 串行爬取（并发 1），硬限 <= 2 实例 | 优势：稳定可控，避免卡死<br>劣势：速度较慢（5 页/分钟） |
| **认证信息加密方案** | 本地存储敏感 Cookie/Token | AES-256-GCM + 机器标识密钥 | 优势：无需用户管理密钥<br>劣势：机器变化需重新登录 |
| **浏览器登录实现** | 支持复杂登录流程（验证码、2FA） | Playwright 有头浏览器 + 用户手动确认 | 优势：无需适配各网站、不依赖登录检测<br>劣势：依赖 GUI 环境、需用户手动确认 |
| **浏览器登录流程简化** | 自动检测登录成功不可靠 | 用户手动点击"我已完成登录"按钮 | 优势：简单可靠，避免误判<br>劣势：多一步用户操作 |
| **与 Documents 集成方式** | 统一知识库管理 | 爬取内容作为 Note 存储，通过 source 区分 | 优势：复用基础设施，体验一致<br>劣势：需扩展 Note 数据模型 |
| **Sitemap 解析方案** | 避免引入额外依赖 | 使用浏览器 DOMParser 解析 XML | 优势：无新增依赖<br>劣势：性能略逊专用 XML 解析库 |
| **内容清洗策略** | 提高搜索质量 | CSS 选择器优先级 + DOMPurify 清洗 | 优势：可控可配置，准确率 90%<br>劣势：需维护选择器规则 |
| **任务状态存储** | 支持服务重启恢复 + 断点续爬 | SQLite 事务持久化 | 优势：事务安全、索引查询、断点续爬<br>劣势：需引入 better-sqlite3 依赖 |
| **URL 重复检测** | 快速判断 URL 是否已导入 | SQLite url_index 表 + 唯一索引 | 优势：O(log n) 查询，支持大数据量<br>劣势：需维护额外索引表 |
| **前端实时通信** | 浏览器登录状态推送 | SSE (Server-Sent Events) | 优势：单向推送，实现简单<br>劣势：不支持双向通信（足够用） |
| **向量化触发时机** | 避免阻塞导入流程 | 异步触发（setImmediate） | 优势：用户体验流畅<br>劣势：向量化失败需额外处理 |

---

## 附录

### A. 技术术语表

| 术语 | 解释 |
|------|------|
| **Playwright** | Node.js 浏览器自动化工具，支持 Chromium、Firefox、WebKit |
| **BrowserContext** | Playwright 的浏览器上下文，支持独立的 Cookie/Session 管理 |
| **Sitemap** | 网站地图文件（XML 格式），列出站点所有页面 URL |
| **递归爬取** | 从起始 URL 出发，自动发现并爬取子链接的爬取方式 |
| **内容清洗** | 去除网页中的导航、广告等无关内容，提取正文 |
| **DOMPurify** | HTML 清洗库，防止 XSS 攻击 |
| **SSE** | Server-Sent Events，服务器推送技术 |
| **AES-256-GCM** | 对称加密算法，提供认证加密 |
| **RSS** | Resident Set Size，进程常驻内存大小 |
| **SQLite** | 轻量级嵌入式关系数据库，无需独立服务进程 |
| **better-sqlite3** | Node.js 的同步/异步 SQLite 绑定库，高性能类型安全 |
| **断点续爬** | 任务暂停后可从断点恢复，不重复已完成的工作 |
| **检查点 (Checkpoint)** | 保存任务当前进度的快照，用于恢复执行 |
| **数据库迁移** | 将旧版本数据结构升级到新版本的过程，保留历史数据 |
| **版本管理** | 使用 schema_migrations 表跟踪数据库模式版本，支持增量升级 |

### B. 参考资料

**内部文档**
- `/docs/prd/feature-web-crawler.md` - Web Crawler PRD
- `/src/server/services/crawler.ts` - 现有爬取服务实现
- `/src/shared/types/index.ts` - 类型定义

**外部资源**
- [Playwright 官方文档](https://playwright.dev/)
- [Hono 官方文档](https://hono.dev/)
- [DOMPurify 官方文档](https://github.com/cure53/DOMPurify)
- [Naive UI 官方文档](https://www.naiveui.com/)

---

**文档结束**
