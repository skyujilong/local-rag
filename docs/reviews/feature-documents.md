# Documents (本地笔记) 代码审查报告

## 审查概要
- **审查日期**: 2026-03-28
- **审查分支**: rewrite
- **代码文件数**: 11 (后端 6 + 前端 4 + 类型定义 1)
- **代码行数**: 3,518 行 (新增)
- **审查人**: Code Reviewer (Opus 4.6)

### 审查范围

| 层级 | 文件 | 行数 |
|------|------|------|
| 后端 | notes.service.ts | 519 |
| 后端 | chunking.service.ts | 323 |
| 后端 | vectorization.service.ts | 82 |
| 后端 | search.service.ts | 293 |
| 后端 | routes.ts (Documents API) | 519 |
| 后端 | index.ts (路由挂载) | 430 |
| 前端 | NoteEditor.vue | 506 |
| 前端 | NotesList.vue | 423 |
| 前端 | Search.vue | 282 |
| 前端 | TagsManager.vue | 349 |
| 共享 | documents.ts (类型定义) | 222 |

---

## 问题汇总

- **Blocker**: 4 个
- **Warning**: 12 个
- **Info**: 6 个

---

## 详细问题

### Blocker 问题

#### 1. [index.ts:114+310] 路由冲突 -- 新旧 documents 路由互相覆盖

**严重程度**: Blocker

**问题描述**: `src/server/api/index.ts` 中第 114 行已有 `app.get('/api/documents', ...)` 和 `app.get('/api/documents/:id', ...)` 等路由处理旧的文档管理功能。第 310 行又通过 `app.route('/api/documents', documentsRoutes)` 挂载了新的 documents feature 路由（包含 `/notes`、`/tags`、`/search` 等子路径）。

虽然 Hono 的 `route()` 方法会将子路由挂载到前缀下，新路由实际路径为 `/api/documents/notes`、`/api/documents/tags` 等，与旧路由 `/api/documents`、`/api/documents/:id` 不直接冲突。但关键问题在于：**旧路由 `app.get('/api/documents/:id', ...)` 和 `app.delete('/api/documents/:id', ...)` 会先于子路由匹配**。当请求 `GET /api/documents/notes` 时，Hono 可能将 `notes` 匹配为旧路由的 `:id` 参数，导致新功能的笔记列表 API 被旧路由拦截。同理 `tags` 和 `search` 路径也会被旧路由的 `:id` 参数捕获。

**修复建议**: 将新 documents feature 的路由挂载路径改为独立前缀（如 `/api/notes`），或者将旧文档路由迁移到不冲突的路径（如 `/api/sources`）。如果两者必须共存于 `/api/documents` 下，确保 `app.route()` 在具体路由 `app.get('/api/documents/:id')` 之前注册，并在旧路由中排除 `notes`、`tags`、`search` 等保留词。

```typescript
// 方案 A: 分离路径
app.route('/api/notes', documentsRoutes);

// 方案 B: 确保 route() 在 :id 路由之前
app.route('/api/documents', documentsRoutes);  // 先挂载子路由
app.get('/api/documents/:id', (c) => { ... }); // 后注册通配路由

// 方案 C: 在旧路由中排除保留词
app.get('/api/documents/:id', (c) => {
  const id = c.req.param('id');
  if (['notes', 'tags', 'search'].includes(id!)) {
    return next(); // 跳过，让子路由处理
  }
  // ... 旧逻辑
});
```

---

#### 2. [notes.service.ts:39-48] 竞态条件 -- 构造函数中异步加载元数据未完成即可接受请求

**严重程度**: Blocker

**问题描述**: `NotesService` 在构造函数中调用 `this.loadMetadata()` 但没有 await（构造函数也无法 await）。由于服务是单例模式，在模块导入时就实例化（第 519 行 `export const notesService = new NotesService()`），元数据加载在后台异步进行。如果 API 请求在元数据加载完成之前到达（例如服务器启动后立即收到请求），`notesCache` 和 `tagsCache` 为空，会导致：
- `getNotesList` 返回空列表
- `getNote` 返回 null
- `updateNote` 和 `deleteNote` 抛出"笔记不存在"错误

这是一个隐式的竞态条件，在快速重启或高并发场景下尤为明显。

**修复建议**: 提供显式的 `initialize()` 方法，在服务器启动时确保元数据加载完成后再开始接受请求。或者在每个公共方法开头添加 `await this.ensureLoaded()` 守卫。

```typescript
// 方案 A: 显式初始化
export class NotesService {
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadMetadata();
    }
    return this.initPromise;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.cacheLoaded) {
      await this.initialize();
    }
  }

  async getNote(id: string): Promise<Note | null> {
    await this.ensureLoaded();
    // ... 原有逻辑
  }
}
```

---

#### 3. [notes.service.ts:30-33] 路径遍历风险 -- 文件路径基于用户输入的 title 拼接

**严重程度**: Blocker

**问题描述**: `createNote` 方法中（第 59-61 行），`sanitizedTitle` 通过正则替换字符后直接用于拼接文件路径：

```typescript
const sanitizedTitle = request.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-');
const fileName = `${dateStr}-${id}-${sanitizedTitle}.md`;
const filePath = join(NOTES_DIR, fileName);
```

虽然已做了基础字符过滤，但存在以下问题：
1. 替换后的 `sanitizedTitle` 仍可能包含连续的 `-`，生成不规范的文件名
2. 更重要的是 `title` 可以是极长字符串，导致文件名超过操作系统限制（大多数文件系统限制 255 字节），`writeFile` 将抛出 ENAMETOOLONG 错误
3. 虽然当前正则过滤了 `..`，但**没有验证最终 `filePath` 是否仍然在 `NOTES_DIR` 目录下**。架构文档明确要求进行路径遍历防护（validateFilePath），但实际代码未实现

**修复建议**:
1. 对 `sanitizedTitle` 进行长度截断（如最多 50 字符）
2. 在 `writeFile` 前验证最终路径是否在 `NOTES_DIR` 下
3. 将标题相关文件名部分完全改用 UUID，标题仅存在元数据中

```typescript
const sanitizedTitle = request.title
  .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')
  .replace(/-+/g, '-')
  .slice(0, 50);
const fileName = `${dateStr}-${id}-${sanitizedTitle}.md`;
const filePath = join(NOTES_DIR, fileName);

// 路径遍历校验
const resolvedPath = resolve(filePath);
const resolvedNotesDir = resolve(NOTES_DIR);
if (!resolvedPath.startsWith(resolvedNotesDir)) {
  throw new Error('Invalid file path');
}
```

---

#### 4. [search.service.ts:102-131 + 136-162] 搜索阶段1和阶段2对同一查询重复生成 embedding

**严重程度**: Blocker

**问题描述**: 在 `hybridSearch` 方法中，当触发降级时，`stage1FilteredSearch` (第 110 行) 和 `stage2FullSearch` (第 144 行) 各自独立调用 `embeddingService.embed(query)` 生成查询向量。这意味着同一个搜索请求会向 Ollama 发送**两次相同的 embedding 请求**，这不仅浪费计算资源（embedding 调用是 IO 密集型操作），还直接导致搜索延迟加倍（~500ms 额外延迟）。对于 PRD 要求的 "50-550ms 搜索响应时间"，这是一个严重的性能缺陷。

**修复建议**: 在 `hybridSearch` 方法顶部提前生成查询向量，传递给后续两个阶段方法复用。

```typescript
async hybridSearch(request: SearchRequest): Promise<SearchResponse> {
  const startTime = Date.now();
  // 提前生成查询向量，避免重复调用
  const queryEmbedding = await embeddingService.embed(request.query);

  if (hasTags) {
    const stage1Data = await this.stage1FilteredSearch(queryEmbedding, request.tags!);
    // ...
    if (shouldFallback) {
      const stage2Data = await this.stage2FullSearch(queryEmbedding, limit);
      // ...
    }
  }
  // ...
}
```

---

### Warning 问题

#### 5. [notes.service.ts:458-478] 并发写入风险 -- 元数据文件无写锁保护

**严重程度**: Warning

**问题描述**: `saveNoteMetadata` 和 `saveTagsMetadata` 直接写入 JSON 文件，没有任何并发保护机制。当多个请求同时触发元数据保存时（如自动保存 + 手动保存同时触发），可能导致数据损坏或丢失。虽然 Node.js 单线程特性降低了风险，但 `writeFile` 本身是异步的，多个并发的 `saveNoteMetadata` 调用可能交叉写入同一文件。

**修复建议**: 使用写入队列或互斥锁确保元数据文件的原子写入。可以先写入临时文件再重命名（原子替换），或使用 debounce 合并频繁的保存请求。

```typescript
// 方案: 原子写入
import { rename } from 'fs/promises';

private async saveNoteMetadata(): Promise<void> {
  const tempPath = join(NOTES_DIR, '.metadata.json.tmp');
  const targetPath = join(NOTES_DIR, '.metadata.json');

  await writeFile(tempPath, JSON.stringify(notesList, null, 2), 'utf-8');
  await rename(tempPath, targetPath); // 原子操作
}
```

---

#### 6. [notes.service.ts:460-467] 元数据保存未包含 content 字段但 loadMetadata 依赖缓存中的 content

**严重程度**: Warning

**问题描述**: `saveNoteMetadata`（第 460 行）保存元数据时有意排除了 `content` 字段，只保存 `id, title, tags, filePath, createdAt, updatedAt`。然而 `loadMetadata`（第 420 行）加载后将数据设入 `notesCache`，此时 `note.content` 为 `undefined`。`getNote`（第 179 行）做了 `!note.content` 判断来懒加载内容，这是正确的。但 `getNotesList`（第 235 行）调用 `generateExcerpt(note.content)` 时，如果 `content` 为空字符串或 `undefined`，excerpt 生成将失败或返回空串。此外，`updateNote` 不检查 `note.content` 是否已加载就直接写入文件（第 120 行），如果 content 是 `undefined` 将写入 "undefined" 字符串到文件。

**修复建议**: 在 `updateNote` 和 `getNotesList` 中确保 content 已从文件加载。或在 `loadMetadata` 时预加载所有笔记内容。

```typescript
// 在 updateNote 中确保内容已加载
async updateNote(id: string, request: UpdateNoteRequest): Promise<Note> {
  const note = this.notesCache.get(id);
  if (!note) throw new Error(`笔记不存在: ${id}`);

  // 确保内容已加载
  if (!note.content) {
    note.content = await readFile(note.filePath, 'utf-8');
  }
  // ... 后续逻辑
}
```

---

#### 7. [routes.ts:206-233] 笔记列表查询参数缺少输入验证

**严重程度**: Warning

**问题描述**: `GET /notes` 端点中，`sort` 和 `order` 参数直接通过 `as any` 类型断言传入，没有经过 Zod 验证。`page` 和 `limit` 使用 `parseInt` 但未校验结果是否为有效正整数。恶意用户可以传入：
- `sort=__proto__` 或其他非预期值
- `page=-1` 或 `page=NaN`
- `limit=999999` 导致一次性加载大量数据

对比其他 POST 端点都使用了 Zod 验证，GET 端点的验证缺失不一致。

**修复建议**: 为查询参数添加 Zod 验证。

```typescript
routes.get('/notes', async (c) => {
  const querySchema = z.object({
    tags: z.string().optional(),
    sort: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  });

  const query = querySchema.parse({
    tags: c.req.query('tags'),
    sort: c.req.query('sort'),
    order: c.req.query('order'),
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  });
  // ...
});
```

---

#### 8. [routes.ts:36-42] 创建笔记缺少标题和内容长度限制

**严重程度**: Warning

**问题描述**: `POST /notes` 的 Zod 验证只检查 `min(1)` 非空，但没有最大长度限制。用户可以提交极长的标题或内容：
- 超长标题导致文件名过长（与 Blocker 3 相关）
- 超大内容可能导致内存溢出或写文件超时

虽然外层有 10MB 请求体大小限制中间件，但缺少字段级别的精细化验证。

**修复建议**: 添加字段长度限制。

```typescript
const schema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题最长 200 字符'),
  content: z.string().min(1, '内容不能为空').max(1_000_000, '内容最大 1MB'),
  tags: z.array(z.string().max(50)).max(20).optional(),
});
```

---

#### 9. [notes.service.ts:293-311] 标签重命名时未同步更新 ChromaDB 中 chunk 的元数据

**严重程度**: Warning

**问题描述**: `updateTag` 方法在重命名标签时，正确更新了 `notesCache` 中所有笔记的标签，也保存了笔记文件和元数据。但**没有更新 ChromaDB 中已存储的 chunk metadata 里的 tags 字段**。这意味着标签重命名后：
- 搜索时使用新标签名过滤将找不到旧数据（因为 ChromaDB 中仍是旧标签名）
- 必须对受影响的所有笔记重新向量化才能修复

同理，`deleteTag` 方法也存在相同问题。

**修复建议**: 标签重命名/删除后，触发受影响笔记的重新向量化。

```typescript
// 在 updateTag 中，标签名变更后重新向量化
if (request.name !== undefined && request.name !== oldName) {
  for (const note of this.notesCache.values()) {
    if (note.tags.includes(request.name)) {
      setImmediate(() => {
        this.revectorizeNote(note.id).catch(err =>
          log.error(`标签重命名后重新向量化失败: ${note.id}`, err)
        );
      });
    }
  }
}
```

---

#### 10. [chunking.service.ts:146-159] 最后一个 chunk 被丢弃的边界条件

**严重程度**: Warning

**问题描述**: 第 146 行检查 `currentChunk.content.length > CHUNK_CONFIG.minChunkSize` 来决定是否保留最后一个 chunk。如果一篇笔记的内容总长度小于 `minChunkSize`（100 字符），整篇笔记将不会产生任何 chunk，导致该笔记**完全不被向量化，无法通过搜索找到**。对于短笔记（如快速灵感记录）这是一个严重的功能缺陷。

**修复建议**: 对最后一个 chunk 放宽限制，只要有内容就保留。或者在 `chunkNote` 方法末尾添加兜底逻辑。

```typescript
// 保存最后一个块 -- 放宽条件
if (currentChunk.content.trim().length > 0) {
  chunks.push(this.createChunk(/* ... */));
}

// 兜底：如果整篇文档都没有产生 chunk，作为整体创建一个
if (chunks.length === 0 && note.content.trim().length > 0) {
  chunks.push(this.createChunk(
    note.id, note.filePath, 0,
    note.content, 0, note.content.length,
    undefined, undefined, false, note.tags
  ));
}
```

---

#### 11. [NoteEditor.vue:253-267] 新建笔记保存后未更新 URL 路由

**严重程度**: Warning

**问题描述**: 新建笔记 (`noteId === 'new'`) 保存成功后，第 284 行 `note.value = data.data` 更新了笔记数据（此时 `note.value.id` 已有值），但当前 URL 仍然是 `/documents/new`。如果用户此后继续编辑并触发自动保存，`isUpdate` 判断为 `true`（因为 id 有值），会正确发送 PUT 请求。但如果用户刷新页面，URL 仍为 `/documents/new`，会导致编辑器以"新建模式"打开而不是加载已保存的笔记。

**修复建议**: 创建成功后使用 `router.replace` 更新 URL。

```typescript
if (data.success) {
  note.value = data.data;
  saveStatus.value = 'saved';

  // 新建成功后更新 URL
  if (!isUpdate) {
    router.replace(`/documents/${data.data.id}`);
  }

  message.success(isUpdate ? '更新成功' : '创建成功');
  clearDraft();
}
```

---

#### 12. [NoteEditor.vue:416-421] 自动保存使用 setInterval 但新笔记首次保存可能失败

**严重程度**: Warning

**问题描述**: 自动保存定时器（第 416 行）每 30 秒检查 `saveStatus === 'unsaved'` 就调用 `handleSave()`。但 `handleSave` 在第 254 行检查 `note.value.title.trim()`，如果用户刚打开编辑器还没输入标题，`title` 为空字符串，`trim()` 结果为空，`handleSave` 会弹出 "请输入笔记标题" 的警告。这意味着用户刚开始在内容区输入时（还没输入标题），每 30 秒会弹出一次烦人的警告。

**修复建议**: 自动保存时跳过空标题/空内容的情况，不弹出警告。

```typescript
const startAutoSave = () => {
  autoSaveTimer = setInterval(() => {
    if (saveStatus.value === 'unsaved' &&
        note.value.title?.trim() &&
        note.value.content?.trim()) {
      handleSave();
    }
  }, 30000);
};
```

---

#### 13. [NotesList.vue:86] Vue 模板绑定错误 -- `:size="small"` 应为 `:size="'small'"`

**严重程度**: Warning

**问题描述**: 第 86 行 `<n-space v-if="note.tags.length > 0" :size="small">` 中 `:size="small"` 使用了 `v-bind` 语法但 `small` 会被当作一个未定义的 JavaScript 变量引用，而不是字符串 `"small"`。这会导致 Vue 运行时报错 "small is not defined"。

同样的问题出现在 Search.vue 第 69 行。

**修复建议**: 使用字符串字面量 `size="small"`（不带冒号）或 `:size="'small'"`。

```html
<!-- 修复前 -->
<n-space :size="small">

<!-- 修复后 -->
<n-space size="small">
```

---

#### 14. [search.service.ts:188-209] mergeAndDedupeResults 返回 chunk 级别结果但调用者期望文档级别

**严重程度**: Warning

**问题描述**: `hybridSearch` 第 70 行调用 `this.mergeAndDedupeResults(stage1Data, stage2Data, limit)` 后将结果赋值给 `finalResults`（类型为 `SearchResult[]`）。但 `mergeAndDedupeResults` 返回的是 chunk 级别的 `Array<{ documentId, chunkId, content, score }>` 而不是 `SearchResult[]`。后续直接返回这些数据到前端，类型不匹配。正确做法应该像 `strategy === 'filtered'` 分支那样，先调用 `mergeChunkResults` 将 chunk 结果合并为文档级别的 `SearchResult[]`。

**修复建议**: `hybrid` 分支中合并后应调用 `mergeChunkResults`。

```typescript
if (shouldFallback) {
  stage2Triggered = true;
  const stage2Data = await this.stage2FullSearch(request.query, limit);
  const mergedChunks = this.mergeAndDedupeResults(stage1Data, stage2Data, limit);
  finalResults = await this.mergeChunkResults(mergedChunks, limit);
  strategy = 'hybrid';
}
```

---

#### 15. [notes.service.ts:293-304] 标签更新时无意义地重新写入笔记文件

**严重程度**: Warning

**问题描述**: `updateTag` 方法在更新标签名后（第 299-300 行），对每个受影响的笔记执行 `await writeFile(note.filePath, note.content, 'utf-8')`。但标签信息存储在元数据 JSON 中而非 Markdown 文件中。写入 Markdown 文件的是 `note.content`，其中不包含标签信息，所以这次写入完全没有意义。更严重的是，如果 `note.content` 为 `undefined`（因为元数据加载时不包含 content），会将 `"undefined"` 字符串写入文件，破坏笔记内容。

`deleteTag` 方法（第 329-330 行）存在同样的问题。

**修复建议**: 移除标签操作中不必要的文件写入。

```typescript
// 更新标签名，只需更新内存缓存和元数据文件
if (request.name !== undefined && request.name !== oldName) {
  for (const note of this.notesCache.values()) {
    const index = note.tags.indexOf(oldName);
    if (index !== -1) {
      note.tags[index] = request.name;
      // 移除: await writeFile(note.filePath, note.content, 'utf-8');
    }
  }
  await this.saveNoteMetadata(); // 只保存元数据即可
}
```

---

#### 16. [NoteEditor.vue:254] note.value.title 可能为 undefined 导致运行时错误

**严重程度**: Warning

**问题描述**: `note` 的类型是 `ref<Partial<Note>>`（第 114 行），`title` 可能为 `undefined`。但 `handleSave` 第 254 行直接调用 `note.value.title.trim()`，当 `title` 为 `undefined` 时会抛出 `Cannot read properties of undefined (reading 'trim')` 错误。

**修复建议**: 使用可选链操作符。

```typescript
if (!note.value.title?.trim()) {
  message.warning('请输入笔记标题');
  return;
}
```

---

### Info 问题

#### 17. [search.service.ts:278-289 + notes.service.ts:503-515] Markdown 清理逻辑重复

**严重程度**: Info

**问题描述**: `SearchService.generateHighlight` 和 `NotesService.generateExcerpt` 包含几乎完全相同的 Markdown 清理代码（移除标题、粗体、斜体、代码、链接、换行）。违反 DRY 原则。

**修复建议**: 提取为共享工具函数 `stripMarkdown(content: string): string`。

---

#### 18. [routes.ts:239-259] 手动向量化端点未实现

**严重程度**: Info

**问题描述**: `POST /notes/:id/vectorize` 端点标注为 TODO，直接返回成功但实际未触发任何操作。前端如果依赖此端点来重试失败的向量化，将无法正常工作。

**修复建议**: 实现实际的向量化触发逻辑，或在响应中明确标注为未实现（501 状态码）。

---

#### 19. [routes.ts:419-442 + 497-517] 两个 TODO 端点返回空数据

**严重程度**: Info

**问题描述**: `GET /tags/:id/documents` 和 `GET /search/suggest` 两个端点均标注 TODO 并返回空数据。建议在 API 文档中标注为 "coming soon" 或返回 501 Not Implemented 状态码，避免前端误以为功能正常但数据为空。

---

#### 20. [documents.ts:103] ChromaDBMetadata 中 tags 类型与 ChromaDB 实际限制不符

**严重程度**: Info

**问题描述**: `ChromaDBMetadata` 接口中 `tags` 定义为 `string[]`，但 ChromaDB 的 metadata 实际上**不支持数组类型**。ChromaDB metadata 只支持 `string | number | boolean` 标量值。使用数组存储标签需要序列化为逗号分隔字符串或使用 ChromaDB 的 `$contains` 操作符。

**修复建议**: 确认 `vectorStore` 层是否已处理了数组到字符串的序列化。如果没有，需要将 `tags` 改为 `string`（JSON 序列化或逗号分隔），并在查询时相应调整过滤逻辑。

---

#### 21. [NoteEditor.vue:101] md-editor-v3 的 MdEditor 组件引入了但未引入 `md-editor-v3/lib/style.css` 的深色模式样式

**严重程度**: Info

**问题描述**: 架构文档和 PRD 都提到需要支持深色模式，但编辑器组件只引入了基础样式 `md-editor-v3/lib/style.css`，没有配置 md-editor-v3 的 `theme` 属性来响应系统主题。

**修复建议**: 根据系统或应用级暗色模式设置，传递 `theme="dark"` 属性给 MdEditor 组件。

---

#### 22. [TagsManager.vue:162] 表格渲染函数中引用了 `row.color` 但数据结构中不包含 color

**严重程度**: Info

**问题描述**: 第 162 行 `render: (row) => h('span', { style: { color: row.color || '#2080f0' } }, row.name)` 引用了 `row.color`，但 `tags` 的数据类型是 `Array<{ id: string; name: string; count: number }>`，不包含 `color` 字段。虽然不会报错（`row.color` 为 `undefined` 时使用默认值），但这是一个类型不一致的问题。

**修复建议**: 如果需要标签颜色功能，后端 `getTagsList` 应返回 color 字段。否则移除 `row.color` 引用。

---

## Blocker 汇总

| 编号 | 文件 | 问题 | 影响 |
|------|------|------|------|
| **#1** | `api/index.ts` | 新旧 documents 路由冲突，`:id` 通配符会拦截 `/notes`、`/tags`、`/search` | **整个 Documents 功能的 API 不可用** |
| **#2** | `notes.service.ts` | 构造函数异步加载未完成即接受请求，竞态条件 | **服务启动后短时间内所有操作返回错误数据** |
| **#3** | `notes.service.ts` | 文件路径基于 title 拼接，缺少长度限制和路径遍历校验 | **文件系统安全风险 + 超长标题导致崩溃** |
| **#4** | `search.service.ts` | 搜索降级时对同一查询重复调用 embedding API | **搜索延迟翻倍，不满足 PRD 性能要求** |

---

## 正面反馈

1. **类型定义完善**: `src/shared/types/documents.ts` 的类型设计层次清晰，前后端共享类型是良好的工程实践，`ApiResponse<T>` 泛型包装器统一了响应格式。

2. **分块策略设计合理**: `ChunkingService` 的混合分块策略（结构分割 + 大小控制 + 重叠）忠实实现了架构文档的设计，代码块完整保留的逻辑正确。

3. **搜索策略架构清晰**: `SearchService` 的两阶段查询 + 智能降级策略设计良好，`checkFallback` 方法的三个降级条件覆盖了主要场景。

4. **Zod 输入验证**: POST/PUT 端点统一使用 Zod 进行请求体验证，验证规则清晰，错误处理规范。

5. **前端交互体验**: NoteEditor 组件实现了完整的用户体验闭环：自动保存、键盘快捷键（Ctrl+S 保存、Escape 返回）、草稿恢复、未保存离开提示。

6. **错误处理模式一致**: 所有路由处理器都采用了统一的 try-catch 模式，区分 ZodError（400）、业务错误（404/409）和服务器错误（500）。

7. **笔记列表 UX**: NotesList 组件实现了标签栏快速筛选、下拉多选、分页、相对时间显示等用户友好特性。

8. **异步向量化设计**: 使用 `setImmediate` 将向量化操作放到微任务队列执行，不阻塞 API 响应，符合 PRD 的异步向量化设计决策。
