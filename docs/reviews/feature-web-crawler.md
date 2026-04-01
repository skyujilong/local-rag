# Web Crawler 代码审查报告

## 审查概要
- 审查日期：2026-04-01
- 代码文件数：14
- 代码行数：~3,800 行
- 审查范围：src/ 目录下后端服务和前端组件

## 问题汇总
- 🔴 Blocker：5 个
- 🟡 Warning：14 个
- 🟢 Info：10 个

---

## 详细问题

### 🔴 Blocker 问题

#### 1. [crawl.ts:690-693] complete-login API 泄露敏感认证信息到响应体

**严重程度**：🔴 Blocker
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/api/crawl.ts` 第 690-693 行
**问题描述**：`/auth/complete-login` 接口在返回 `cookieCount` 时，通过方括号访问私有属性 `authSessionManagerService['encryptionUtil']`，直接解密认证数据并解析 Cookie 数量。这不仅违反了封装原则（访问其他类的私有属性），更重要的是在响应中暴露了解密后的认证数据结构。如果后续代码修改导致更多字段被暴露，将构成严重的安全隐患。

**修复建议**：在 `AuthSessionManagerService` 类中新增一个公共方法 `getProfileCookieCount(profileId: string)` 来安全地获取 Cookie 数量，避免在 API 层直接操作解密逻辑。

**代码示例**：
```javascript
// 当前代码（不安全）
cookieCount: JSON.parse(
  await authSessionManagerService['encryptionUtil'].decrypt(profile.encryptedData)
).cookies.length,

// 建议修改为
cookieCount: await authSessionManagerService.getProfileCookieCount(profile.id),
```

---

#### 2. [auth-session-manager.service.ts:385-408] macOS 环境下 GUI 检测始终返回 false

**严重程度**：🔴 Blocker
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/auth-session-manager.service.ts` 第 385-408 行
**问题描述**：`hasGuiEnvironment()` 方法的检测逻辑存在致命缺陷。在 macOS（本项目的主要开发环境，文档标明 macOS 为 P0 测试优先级）上，`process.env.DISPLAY` 和 `process.env.WAYLAND_DISPLAY` 通常都为 `undefined`。当前代码在两者都为 `undefined` 时直接返回 `false`，导致 macOS 桌面环境被误判为无 GUI 环境。PRD 第 US-9 节明确要求浏览器登录在桌面环境可用，而此 Bug 导致 macOS 用户无法使用浏览器登录功能。

**修复建议**：增加 `process.platform === 'darwin'` 的检测。macOS 始终有 GUI 环境（除非是 SSH 远程连接，但 SSH 场景通常也不会有 `TERM` 环境变量为空）。

**代码示例**：
```javascript
// 当前代码（macOS 误判为无 GUI）
if (process.env.DISPLAY === undefined && process.env.WAYLAND_DISPLAY === undefined) {
  return false; // macOS 在此错误返回 false
}

// 建议修改为
if (process.platform === 'darwin') {
  // macOS 桌面环境始终支持 GUI
  return true;
}
if (process.env.DISPLAY === undefined && process.env.WAYLAND_DISPLAY === undefined) {
  return false;
}
```

---

#### 3. [crawler-enhanced.service.ts:207-230] Sitemap Index 嵌套解析未实现

**严重程度**：🔴 Blocker
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-enhanced.service.ts` 第 207-230 行
**问题描述**：`extractUrlsFromSitemap` 方法发现了嵌套 Sitemap URL（存入 `sitemaps` 数组），但方法在 return 时只返回了 `urls`，完全忽略了 `sitemaps` 数组中的嵌套 Sitemap URL。对于使用 Sitemap Index（如 `sitemap-index.xml` 引用多个子 Sitemap）的大型站点，解析结果将为空或严重不完整。PRD 测试计划 P1-1 要求"解析成功显示 URL 总数"，Sitemap Index 是常见的 Sitemap 格式。

**修复建议**：递归解析嵌套 Sitemap，或将嵌套 Sitemap URL 合并到结果中并进行二次请求解析。

**代码示例**：
```javascript
// 当前代码
const sitemaps: string[] = [];
// ... 解析嵌套 Sitemap URL 到 sitemaps 数组
return urls; // sitemaps 被完全忽略

// 建议修改为
// 递归解析嵌套 Sitemap
for (const sitemapUrl of sitemaps) {
  const nestedUrls = await this.parseNestedSitemap(sitemapUrl);
  urls.push(...nestedUrls);
}
return urls;
```

---

#### 4. [crawler-enhanced.service.ts:691-700] 检查点创建未恢复已有数据

**严重程度**：🔴 Blocker
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-enhanced.service.ts` 第 691-700 行
**问题描述**：`createCheckpoint` 方法总是创建一个空的检查点（`completedUrls: []`, `failedUrls: []`），但在 `executeSitemapTask` 第 292 行被调用时，即使数据库中已有检查点数据（例如任务恢复场景），也会用空数据覆盖。结合 `resumeTask` 方法（第 536-549 行）直接调用 `executeSitemapTask` 而未先加载检查点数据，导致任务恢复后 `checkpoint.urlIndex` 虽然正确，但 `checkpoint.checkpointData.completedUrls` 和 `failedUrls` 为空，造成数据丢失。PRD 明确要求"不重复爬取已成功的页面"。

**修复建议**：在 `executeSitemapTask` 开始时先尝试加载已有的检查点数据，仅在检查点不存在时才创建新检查点。

---

#### 5. [content-cleaner.service.ts:161] 使用 require('jsdom') 导致 ESM 兼容性问题

**严重程度**：🔴 Blocker
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/content-cleaner.service.ts` 第 161 行
**问题描述**：代码在 Node.js 环境分支中使用了 `require('jsdom')`。如果项目使用 ESM 模块系统（从其他文件使用 `.js` 扩展名导入可以看出），`require` 调用会导致运行时错误（`require is not defined in ES module scope`）。此外，项目 `package.json` 中如果 `"type": "module"`，此代码将直接崩溃。即使项目使用 CJS，`jsdom` 也不在 PRD 附录 6.3 中列出的依赖项中，可能未安装。

**修复建议**：将 `jsdom` 改为顶部静态 `import`，或使用 Playwright 已有的页面 DOM 操作能力来解析 HTML，避免引入额外依赖。也可以使用 `linkedom` 等更轻量的替代方案。

---

### 🟡 Warning 问题

#### 6. [encryption.ts:55-74] 密钥生成未基于机器唯一标识

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/utils/encryption.ts` 第 55-74 行
**问题描述**：PRD 第 4.2 节明确要求"加密密钥基于机器唯一标识（MAC 地址 + 主机名的 SHA-256 哈希）自动生成"。但实际实现使用 `randomBytes(32)` 生成随机密钥。这意味着如果密钥文件被意外删除，系统无法根据机器标识重新生成相同的密钥，所有已加密的认证数据将永久丢失。虽然随机密钥在安全性上不弱于基于机器标识的密钥，但不符合 PRD 的密钥恢复要求。

**修复建议**：按 PRD 要求，基于 MAC 地址 + 主机名的 SHA-256 哈希生成密钥。

---

#### 7. [crawler-enhanced.service.ts:300-346] 批量爬取串行执行时未复用浏览器上下文

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-enhanced.service.ts` 第 300-346 行
**问题描述**：批量爬取的循环中，每次调用 `crawlSinglePage` 都会创建新的浏览器上下文和页面（第 95-98 行），然后关闭。这意味着每爬一个页面都要经历"创建上下文 -> 创建页面 -> 导航 -> 关闭页面 -> 关闭上下文"的完整生命周期。对于 200 页的批量任务，会创建 200 个独立的浏览器上下文，严重影响性能。PRD 要求"批量爬取吞吐 >= 5 页/分钟"，频繁创建/销毁上下文的开销可能使吞吐量达不到目标。

**修复建议**：在批量爬取任务级别复用一个浏览器上下文，仅在每 50 页强制 GC 时重建。

---

#### 8. [crawler-enhanced.service.ts:578-633] 批量导入未设置 source 元数据

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-enhanced.service.ts` 第 598-607 行
**问题描述**：PRD US-7 要求"文档自动标记来源（source: 'web'）和原始 URL"。但 `batchImport` 方法调用 `notesService.createNote` 时只传入了 `title`、`content`、`tags`，没有设置 `source` 和 `sourceUrl` 元数据。这导致爬取导入的文档与手动创建的笔记无法区分，违反了 US-7 的核心需求。

**修复建议**：在创建笔记时传入元数据字段 `source: 'webpage'` 和 `sourceUrl: result.url`（需确认 notesService 是否支持扩展元数据）。

---

#### 9. [crawler-enhanced.service.ts:578-633] 单页面爬取导入未走统一导入 API

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/components/crawler/SinglePageCrawler.vue` 第 192-206 行
**问题描述**：单页面爬取的导入逻辑直接调用 `crawlApi.createNote`，绕过了后端的 `POST /api/crawl/import` 接口和 `crawlerEnhancedService.batchImport` 方法。这导致：(1) 未更新 `url_index` 表，重复导入检测功能失效；(2) 未设置 `source` 元数据；(3) 前后端导入逻辑不一致，增加维护成本。

**修复建议**：单页面导入也应调用统一的 `/api/crawl/import` 接口，或在后端新增单页面导入专用接口。

---

#### 10. [content-cleaner.service.ts:254-272] 质量评分算法逻辑不合理

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/content-cleaner.service.ts` 第 254-272 行
**问题描述**：`calculateQualityScore` 方法的逻辑存在缺陷。它比较的是"清洗后的纯文本内容长度"与"DOM 元素的 textContent 长度"的比例。但 `extractMainContent` 返回的已经是 `textContent`，而 `cleanText` 只做空白字符压缩，所以 `ratio` 几乎总是接近 1.0。当 ratio > 0.7 时，评分公式 `1 - (ratio - 0.7)` 会导致 ratio = 1.0 时评分为 0.7，这意味着质量越高的内容反而评分越低，逻辑完全反了。正确的做法应该是比较"提取的主内容长度"与"原始 HTML 总长度"的比例。

---

#### 11. [content-cleaner.service.ts:288-310] 登录页检测逻辑过于简单，误报率高

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/content-cleaner.service.ts` 第 288-310 行
**问题描述**：`isLoginPage` 方法仅通过关键词计数（3 个以上匹配就判定为登录页）来检测。关键词列表包含 "password"、"email" 等在正常文章中也频繁出现的词。例如，一篇关于"密码安全最佳实践"的技术博客会包含 "password"、"email"、"authentication" 等词，很可能被误判为登录页。这会导致正常的爬取结果被标记为 `auth_expired`。

**修复建议**：结合页面结构特征检测（如是否存在 `<form>` 包含 `<input type="password">`、页面 URL 是否包含 "login"、"signin" 等），并检查正文长度是否异常短。

---

#### 12. [auth-session-manager.service.ts:335-348] Cookie 解析未处理值中包含等号的情况

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/auth-session-manager.service.ts` 第 339-347 行
**问题描述**：`parseCookieString` 方法使用 `cookie.trim().split('=')` 分割 Cookie 的 name 和 value。但许多 Cookie 的 value 本身包含 `=` 字符（如 Base64 编码的 token、JWT 等）。`split('=')` 会在第一个 `=` 处分割，导致 value 被截断。例如 `token=abc=def` 会解析为 `{ name: 'token', value: 'abc' }` 而不是正确的 `{ name: 'token', value: 'abc=def' }`。

**修复建议**：使用 `split('=')` 后取第一个元素为 name，其余用 `=` 重新连接为 value。

---

#### 13. [crawler-enhanced.service.ts:36-39] 任务状态存储在内存中，服务重启后丢失

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-enhanced.service.ts` 第 36-39 行
**问题描述**：`activeTasks`、`pauseSignals`、`terminateSignals` 都是内存 Map。虽然 `recoverRunningTasks` 方法会在启动时恢复数据库中的运行中任务为 `paused` 状态，但 `pauseSignals` 和 `terminateSignals` 无法持久化。如果用户在暂停任务后服务重启，恢复任务后 `pauseSignals` 中没有记录，任务可以正常恢复执行——这是可以接受的。但 `activeTasks` 中存储的任务对象（含 URLs 列表）在重启后丢失，`executeSitemapTask` 方法从 `this.activeTasks.get(taskId)` 获取任务时会返回 undefined，直接导致恢复失败。

**修复建议**：在 `resumeTask` 方法中，先从数据库加载任务（含 URLs），并将其放入 `activeTasks` 后再启动执行。

---

#### 14. [auth-session-manager.service.ts:40-48] 认证浏览器实例在 initialize 时启动 headless: false

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/auth-session-manager.service.ts` 第 40-48 行
**问题描述**：`initialize` 方法在创建认证浏览器实例时就使用 `headless: false`。如果用户只是进行单页面或站点地图爬取（不需要浏览器登录），也会尝试启动有头浏览器。在无 GUI 的服务器环境中，这会导致初始化失败，进而阻止所有爬取功能（包括不需要认证的功能）。

**修复建议**：延迟浏览器实例化到实际需要浏览器登录时才启动，避免影响不需要认证的爬取功能。

---

#### 15. [useCrawlApi.ts:49-53] composable 中大量使用 `any` 类型

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/composables/useCrawlApi.ts` 多处
**问题描述**：所有 API 方法（`crawlSinglePage`、`parseSitemap`、`saveCookieAuth` 等）的参数和返回值都使用 `any` 类型。这不仅丧失了 TypeScript 的类型安全保护，还使 IDE 无法提供代码补全和参数提示。已定义的类型（`SinglePageConfig`、`SitemapConfig`、`AuthProfile` 等）存在于 `shared/types/crawler.ts` 中但未被使用。

**修复建议**：导入并使用 `shared/types/crawler.ts` 中已定义的类型。

---

#### 16. [crawl.ts:28] URL 验证 Schema 不限制协议类型

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/api/crawl.ts` 第 28 行
**问题描述**：`singlePageSchema` 使用 `z.string().url()` 验证 URL，但 Zod 的 `.url()` 验证器接受任何有效 URL 协议（包括 `ftp://`、`file://`、`javascript:` 等）。PRD 明确要求"仅支持 HTTP/HTTPS 协议"。虽然 Playwright 的 `page.goto()` 会对非法协议报错，但应尽早验证。

**修复建议**：添加自定义验证器检查 URL 协议是否为 `http:` 或 `https:`。

---

#### 17. [crawler-db.service.ts:345-366] 认证配置 domain 设为 UNIQUE 但未考虑多认证场景

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-db.service.ts` 第 127 行
**问题描述**：`auth_profiles` 表的 `domain` 字段设为 `UNIQUE` 索引，意味着同一域名只能保存一个认证配置。但 PRD v1.1 中期目标提到"多认证配置管理（同一网站多账户切换）"。即使当前 MVP 只支持单配置，用户也可能需要同时保存 Cookie 和 Header 两种认证方式用于同一域名的不同路径。`UNIQUE` 约束会导致保存第二个配置时失败。

**修复建议**：将 UNIQUE 约束改为 `(domain, type)` 联合唯一索引，或移除 domain 的 UNIQUE 约束。

---

#### 18. [crawler-enhanced.service.ts:85-162] 单页面爬取未在数据库中记录

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-enhanced.service.ts` 第 85-162 行
**问题描述**：单页面爬取的结果 `taskId` 被设为空字符串，且不创建数据库记录。这意味着单页面爬取不会出现在爬取历史列表中，违反了 PRD WC-8"查看和管理爬取任务历史"的需求。此外，单页面爬取没有 URL 重复检测，重复导入同一 URL 不会被拦截。

**修复建议**：为单页面爬取也创建任务记录，并在爬取前检查 `url_index` 表进行重复检测。

---

#### 19. [ContentPreview.vue:93] editableTitle 初始化不响应 props 变化

**严重程度**：🟡 Warning
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/components/crawler/ContentPreview.vue` 第 93 行
**问题描述**：`editableTitle` 用 `ref(props.preview.title)` 初始化，但 Vue 的 ref 只在初始化时取值。如果 `preview` prop 后续变化（例如用户重新爬取另一个页面），`editableTitle` 不会自动更新为新标题。应使用 `watch` 或 `computed` 来同步。

---

### 🟢 Info 问题

#### 20. [WebCrawler.vue:42-49] 组件未使用自动导入，显式导入 Naive UI 组件

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/views/WebCrawler.vue` 第 42-49 行
**问题描述**：如果项目配置了 Naive UI 自动导入插件（如 `unplugin-auto-import`），则不需要显式导入每个组件。当前写法增加了模板代码量。不过这种写法在类型推断上更明确，两种风格均可接受。

---

#### 21. [CrawlerHistory.vue:188-189] 查看结果功能标记为 TODO 未实现

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/views/CrawlerHistory.vue` 第 188-189 行
**问题描述**：`viewResults` 方法中 `message.info('查看结果功能待实现')` 是一个占位实现。这影响用户从历史列表查看爬取结果的功能完整性。

---

#### 22. [SitemapCrawler.vue:140-143] selectHighQuality 功能为 TODO 占位

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/components/crawler/SitemapCrawler.vue` 第 140-143 行
**问题描述**：`selectHighQuality` 方法实际调用了 `selectAll()`，注释为 `// TODO: 实现质量评分过滤`。在解析 Sitemap 阶段还没有质量评分数据，这个按钮应该在爬取完成后的导入确认界面才有意义。

---

#### 23. [crawler-enhanced.service.ts:68-76] 恢复运行中任务时未恢复 urls 列表

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-enhanced.service.ts` 第 68-76 行
**问题描述**：`recoverRunningTasks` 从数据库加载任务后放入 `activeTasks`，但数据库中的 `urls` 字段为空（`mapRowToTask` 方法第 572 行硬编码 `urls: []`）。这意味着恢复的任务无法获取待爬取的 URL 列表。

---

#### 24. [auth-session-manager.service.ts:436-438] import 语句放在文件末尾

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/auth-session-manager.service.ts` 第 436-438 行
**问题描述**：`import { readFile } from 'fs/promises'` 和 `import { existsSync } from 'fs'` 放在文件最末尾。虽然 JavaScript 的 import 语句会被提升（hoisting），但这是不规范的代码风格，会降低可读性。

---

#### 25. [crawler-db.service.ts:565] mapRowToTask 中 urls 字段硬编码为空数组

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/services/crawler-db.service.ts` 第 572 行
**问题描述**：注释说"URLs 存储在单独的表中"，但实际上数据库中并没有 `task_urls` 表。URL 列表仅在内存的 `activeTasks` Map 中保存，服务重启后无法恢复。建议将 URL 列表序列化后存储在 `crawl_tasks` 表的 `config` 字段中。

---

#### 26. [ContentPreview.vue:83-86] preview props 使用 any 类型

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/components/crawler/ContentPreview.vue` 第 83-86 行
**问题描述**：`preview` prop 类型为 `any`。应在 `shared/types/crawler.ts` 中定义对应的前端类型并引用。

---

#### 27. [encryption.ts:172-174] regenerateKey 先清空文件再生成新密钥，存在时间窗口

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/server/utils/encryption.ts` 第 172-174 行
**问题描述**：`regenerateKey` 方法先清空密钥文件内容为空字符串，然后生成新密钥。如果在这两步之间发生崩溃，密钥文件将为空，导致后续启动时无法加载任何密钥。虽然 `ensureKeyLoaded` 会回退到生成新密钥，但旧数据的不可恢复状态可能不够明确。

---

#### 28. [CrawlProgress.vue:267] 任务加载失败时轮询不停止

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/components/crawler/CrawlProgress.vue` 第 266-268 行
**问题描述**：`loadTask` 方法的 catch 分支中只显示错误消息，但没有停止轮询。如果任务 API 持续失败，轮询会一直运行，产生大量无效请求。

---

#### 29. [useCrawlApi.ts:18-43] 共享的 loading 和 error 状态可能导致 UI 混乱

**严重程度**：🟢 Info
**文件**：`/Users/jilong5/mfe-workspace/local-rag/src/client/src/composables/useCrawlApi.ts` 第 12-13 行
**问题描述**：`useCrawlApi()` 每次调用都创建新的 `loading` 和 `error` 状态。但如果多个组件同时调用不同的 API 方法，由于 `request` 方法共享同一个 `loading` 引用，一个请求的完成会把另一个请求的 loading 状态也设为 false。建议每个方法独立管理自己的 loading 状态，或使用单次请求级别的 loading 追踪。

---

## Blocker 汇总

| # | 文件 | 问题描述 |
|---|------|---------|
| 1 | crawl.ts:690-693 | complete-login API 通过方括号访问私有属性解密认证数据，违反封装和安全原则 |
| 2 | auth-session-manager.service.ts:385-408 | macOS 环境下 GUI 检测始终返回 false，浏览器登录功能在主要开发环境不可用 |
| 3 | crawler-enhanced.service.ts:207-230 | Sitemap Index 嵌套解析结果被丢弃，大型站点解析结果不完整 |
| 4 | crawler-enhanced.service.ts:691-700 | 检查点创建总是覆盖已有数据，任务恢复时已完成 URL 数据丢失 |
| 5 | content-cleaner.service.ts:161 | 使用 require('jsdom') 在 ESM 模块中会导致运行时崩溃 |

---

## 正面反馈

1. **类型定义完善**：`shared/types/crawler.ts` 中的类型定义覆盖了爬取模式、任务状态、认证配置、检查点等核心概念，枚举使用合理，接口边界清晰。

2. **加密实现规范**：`encryption.ts` 使用 AES-256-GCM 算法，配合随机 IV 和盐值派生密钥，认证标签验证完整性，密钥文件权限设为 0o600，整体实现符合安全最佳实践。

3. **URL 工具类设计良好**：`url.ts` 提供了标准化、验证、去重、域名检测等功能，追踪参数移除列表完整，`normalize` 方法的选项配置灵活。

4. **API 层 Zod 验证**：所有 POST 接口都使用 Zod Schema 进行请求体验证，包括 URL 格式、数值范围、可选字段等，有效防止了无效输入。

5. **数据库设计合理**：SQLite WAL 模式、外键约束、索引设计、CHECK 约束等都体现了良好的数据库实践。断点续爬的 checkpoint 机制设计思路正确。

6. **前端组件拆分合理**：`WebCrawler.vue` 作为主页面使用 Tab 切换三种模式，各模式组件独立，`AuthConfigCollapse` 作为共享组件复用，符合单一职责原则。

7. **SSR 兼容**：`content-cleaner.service.ts` 的 `createDocument` 方法区分了浏览器和 Node.js 环境，考虑了同构渲染场景。
