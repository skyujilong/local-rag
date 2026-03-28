# Documents 功能审查修复日志

## 修复摘要
- 修复日期：2026-03-28
- 修复 Blocker：4 个
- 修复 Warning：4 个（#13 NotesList, #13 Search, #14 search.service, #15 notes.service, #16 NoteEditor, #11 NoteEditor）

---

## Blocker 修复

### B1. 路由冲突
- 文件：`src/server/api/index.ts`
- 问题：旧路由 `app.get('/api/documents/:id', ...)` 在第 130 行注册，而新 documents feature 路由 `app.route('/api/documents', documentsRoutes)` 在第 310 行注册。Hono 按注册顺序匹配路由，导致 `GET /api/documents/notes`、`/api/documents/tags`、`/api/documents/search` 等请求被 `:id` 通配符先行捕获，新功能 API 全部不可用。
- 修复：将 `app.route('/api/documents', documentsRoutes)` 移至旧路由注册之前（第 113 行，紧接 `/api/status` 之后），并删除原位于第 310 行的重复注册。Hono 现在会先将 `/api/documents/notes`、`/tags`、`/search` 等路径匹配到 feature 子路由，剩余路径（如裸 UUID）才落到旧 `:id` 通配路由。
- 状态：✅ 已修复

### B2. 竞态条件
- 文件：`src/server/features/documents/services/notes.service.ts`
- 问题：构造函数调用 `this.loadMetadata()` 但无法 await，若服务器启动后立即收到请求，元数据尚未加载完毕，导致所有公开方法操作空缓存（返回空列表、抛出"笔记不存在"等）。
- 修复：
  1. 新增 `initPromise: Promise<void> | null` 字段，在构造函数中将加载 Promise 保存到该字段（而非丢弃）。
  2. 新增私有方法 `ensureInitialized()`：若 `cacheLoaded` 为 false 则等待 `initPromise`，若 `initPromise` 为 null 则重新发起加载（支持失败后重试）。
  3. 在所有公开方法（`createNote`、`updateNote`、`deleteNote`、`getNote`、`getNotesList`、`createTag`、`updateTag`、`deleteTag`、`getTagsList`）的第一行添加 `await this.ensureInitialized()`。
- 状态：✅ 已修复

### B3. 路径遍历风险
- 文件：`src/server/features/documents/services/notes.service.ts`
- 问题：`createNote` 中文件路径基于用户输入的 `title` 直接拼接，缺少：(1) 文件名长度限制（超长标题会触发 `ENAMETOOLONG` 崩溃），(2) 连续 `-` 清理，(3) 对最终路径是否在 `NOTES_DIR` 内的校验。
- 修复：
  1. 新增 `validateFilePath(title: string): string` 方法：截断 title 为前 50 字符，替换非法字符为 `-`，合并连续 `-`，去除首尾 `-`，空串兜底为 `'untitled'`。
  2. `createNote` 中改用 `this.validateFilePath(request.title)` 生成 `sanitizedTitle`。
  3. 在 `writeFile` 前添加路径遍历校验：用 `resolve()` 解析最终路径，验证其以 `resolvedNotesDir + '/'` 开头，否则抛出 `'Invalid file path: path traversal detected'`。
  4. 在 `import` 语句中补充了 `resolve` 的导入（`from 'path'`）。
- 状态：✅ 已修复

### B4. 重复 embedding 调用
- 文件：`src/server/features/documents/services/search.service.ts`
- 问题：`hybridSearch` 触发降级时，`stage1FilteredSearch` 和 `stage2FullSearch` 各自独立调用 `embeddingService.embed(query)`，同一次搜索产生两次 embedding 请求，搜索延迟翻倍（约 +500ms），不满足 PRD 要求。
- 修复：
  1. 在 `hybridSearch` 顶部提前执行 `const queryEmbedding = await embeddingService.embed(request.query)`，一次生成查询向量。
  2. `stage1FilteredSearch` 签名改为 `(queryEmbedding: number[], tags: string[])`，直接接收向量不再内部生成。
  3. `stage2FullSearch` 签名改为 `(queryEmbedding: number[], limit: number)`，直接接收向量不再内部生成。
  4. 三处调用点均传入预计算的 `queryEmbedding`。
- 状态：✅ 已修复

---

## Warning 修复

### W1. mergeAndDedupeResults 返回 chunk 级别未转换为文档级别（Warning #14）
- 文件：`src/server/features/documents/services/search.service.ts`
- 问题：`hybridSearch` 的降级分支（`shouldFallback === true`）直接将 `mergeAndDedupeResults` 的返回值（chunk 级别 `{ documentId, chunkId, content, score }[]`）赋值给 `finalResults: SearchResult[]`，类型不匹配，返回给前端的数据结构错误（缺少 `document`、`aggregatedScore`、`matchedChunks` 等字段）。
- 修复：降级分支中调用 `mergeAndDedupeResults` 后，将结果传给已有的 `mergeChunkResults` 方法转换为文档级 `SearchResult[]`。改前：`finalResults = this.mergeAndDedupeResults(...)`；改后：`const mergedChunks = this.mergeAndDedupeResults(...); finalResults = await this.mergeChunkResults(mergedChunks, limit)`。
- 状态：✅ 已修复

### W2. 标签操作时误写入 undefined 到笔记文件（Warning #15）
- 文件：`src/server/features/documents/services/notes.service.ts`
- 问题：`updateTag` 和 `deleteTag` 方法在更新笔记标签后执行 `await writeFile(note.filePath, note.content, 'utf-8')`。标签信息存储在元数据 JSON 而非 Markdown 文件中，此写入毫无意义；更严重的是，若 `note.content` 为 `undefined`（元数据加载时不含 content），将把字符串 `"undefined"` 写入文件，彻底损坏笔记内容。
- 修复：在 `updateTag` 和 `deleteTag` 的循环内移除所有 `await writeFile(note.filePath, note.content, 'utf-8')` 调用，只保留内存缓存更新（`note.tags[index] = request.name` / `note.tags.splice(index, 1)`）和元数据 JSON 保存（`await this.saveNoteMetadata()`）。代码注释明确说明标签不存储在 Markdown 文件中。
- 状态：✅ 已修复

### W3. Vue 模板 `:size="small"` 绑定错误（Warning #13）
- 文件：`src/client/src/features/documents/components/NotesList.vue`（第 86 行）、`src/client/src/features/documents/components/Search.vue`（第 69 行）
- 问题：`:size="small"` 使用了 v-bind 语法，`small` 被解析为 JavaScript 变量引用而非字符串，运行时报 "small is not defined"。
- 修复：两处均改为不带冒号的静态属性 `size="small"`。
- 状态：✅ 已修复

### W4. NoteEditor 多处问题修复（Warning #11、#12、#16）
- 文件：`src/client/src/features/documents/components/NoteEditor.vue`
- 问题 #16：`handleSave` 中 `note.value.title.trim()` 和 `note.value.content.trim()` 直接调用，当值为 `undefined` 时抛出运行时错误（note 类型为 `Partial<Note>`）。
- 问题 #11：新建笔记保存成功后未更新 URL，刷新页面仍为 `/documents/new`，导致重新以新建模式打开。
- 问题 #12：自动保存定时器无条件调用 `handleSave()`，当标题为空时每 30 秒弹出"请输入笔记标题"警告，影响用户体验。
- 修复：
  1. 将 `note.value.title.trim()` 和 `note.value.content.trim()` 改为可选链：`note.value.title?.trim()` 和 `note.value.content?.trim()`。
  2. 在 `handleSave` 的 `data.success` 分支中，新建成功时（`!isUpdate && data.data.id`）调用 `router.replace(\`/documents/\${data.data.id}\`)` 更新 URL。
  3. 自动保存定时器增加前置条件：`note.value.title?.trim() && note.value.content?.trim()` 均为真才调用 `handleSave()`。
- 状态：✅ 已修复
