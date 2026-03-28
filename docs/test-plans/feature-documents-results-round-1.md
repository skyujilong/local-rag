# Documents 功能测试结果报告 (Round 1)

## 执行概要

| 项目 | 数据 |
|------|------|
| 执行时间 | 2026-03-28 |
| 测试框架 | Vitest v1.6.1 |
| 测试环境 | Node.js，macOS Darwin 25.2.0 |
| 测试文件数 | 5 |
| 测试用例总数 | 119 |
| 通过数 | 119 |
| 失败数 | 0 |
| 通过率 | 100% |
| 执行耗时 | ~469ms（含 transform/prepare） |
| 总结 | 全部通过 |

---

## 测试范围

本次 Round 1 测试聚焦于**服务端核心业务逻辑**，采用单元测试 + 服务级集成测试策略，全程使用 mock 替代外部依赖（Ollama、ChromaDB、文件系统），确保测试在无外部服务的情况下可靠运行。

### 测试文件分布

| 测试文件 | 对应源文件 | 测试用例数 | 耗时 |
|---------|-----------|-----------|------|
| `chunking.service.test.ts` | `chunking.service.ts` | 18 | 5ms |
| `notes.service.test.ts` | `notes.service.ts` | 37 | 93ms |
| `search.service.test.ts` | `search.service.ts` | 23 | 10ms |
| `vectorization.service.test.ts` | `vectorization.service.ts` | 10 | 7ms |
| `routes.test.ts` | `api/routes.ts` | 31 | 20ms |

---

## 测试结果详情

### 通过的用例（119 / 119）

#### ChunkingService（18 个测试）

**标题分割（测试计划用例 25）**
- 应该将多标题文档分割成多个 chunk
- 标题 chunk 的 sectionTitle 应记录章节名称
- 单标题文档应该可以正确处理

**代码块保护（测试计划用例 26）**
- 代码块应该被识别为独立 chunk（isCodeBlock: true）
- 代码块 chunk 的内容应该包含完整代码
- 多个代码块应该各自成为独立 chunk

**块大小控制（测试计划用例 27）**
- 超过 maxChunkSize(1000) 的内容应该触发分块逻辑
- 短内容（< minChunkSize）不应产生 chunk
- 分块间应该保留重叠内容

**元数据完整性（测试计划用例 28）**
- 每个 chunk 都应包含必需的元数据字段（chunkId、documentId、filePath、chunkIndex、contentLength、startPosition、endPosition、tags）
- chunk 的 chunkId 应该是唯一的
- chunk 的 chunkIndex 应该从 0 开始递增
- chunk.id 应该与 metadata.chunkId 一致
- chunk.documentId 应该与 note.id 一致

**边界条件**
- 纯文本（无 Markdown 结构）应该可以处理
- 含有列表的文档应该可以处理
- 代码块和普通内容混合文档应该正确处理
- 空内容（长度为 0）的笔记应该返回空数组

---

#### NotesService（37 个测试）

**ensureInitialized 竞态条件修复（Blocker 修复验证）**
- 初始化前调用 getNotesList 应该等待初始化完成
- 并发调用多个公开方法不应重复初始化
- 初始化失败后，下次调用应该重试（initPromise 置 null 后可重试）
- cacheLoaded 为 true 时 ensureInitialized 应立即返回（不重复读文件）

**validateFilePath 路径遍历防护（Security 修复验证）**
- 正常标题应该生成合法文件名（不含 ..）
- 包含路径遍历字符的标题应该被净化（../../../etc/passwd → untitled 或净化后字符）
- 特殊字符标题应该被替换为连字符（< > & " 等被替换）
- 超过 50 字符的标题应该被截断
- 空标题应该被替换为 untitled

**createNote**
- 应该成功创建笔记并返回包含 id 的 Note 对象
- 创建后笔记应该可以通过 getNote 获取
- 不提供 tags 时应默认为空数组
- 应该调用 writeFile 写入笔记内容

**getNote**
- 获取不存在的笔记应返回 null
- 笔记内容不在缓存时应从文件读取

**updateNote**
- 更新不存在的笔记应抛出错误
- 更新已存在的笔记应成功
- 更新时 updatedAt 应该变更
- 部分更新：只传 tags 应只更新 tags

**deleteNote**
- 删除不存在的笔记应抛出错误
- 删除后笔记应从缓存中移除
- 删除时文件不存在（ENOENT）应该优雅处理（不抛出）

**getNotesList**
- 空库返回空列表
- 应该支持标签过滤（AND 逻辑）
- 分页应该正确工作
- 排序 sort=createdAt&order=asc 应返回正确顺序

**标签管理**
- createTag: 应该成功创建标签
- createTag: 创建重复标签应该抛出错误
- createTag: 创建标签后应该出现在列表中
- updateTag: 重命名标签应该更新所有关联笔记的标签
- updateTag: 更新不存在的标签应抛出错误
- deleteTag: 删除标签应该从所有笔记中移除
- deleteTag: 删除不存在的标签应抛出错误
- getTagsList: 应该按笔记使用频率降序排列

**generateExcerpt（间接测试）**
- Markdown 语法应该被移除，生成纯文本摘要
- 摘要应该限制在 100 字符以内，超出时以 ... 结尾
- 短内容不应添加 ...

---

#### SearchService（23 个测试）

**embedding 复用验证（核心修复验证：只调用一次 embed）**
- 有标签搜索时 embed 只应被调用一次
- 无标签搜索时 embed 只应被调用一次
- 降级触发后（阶段1 + 阶段2）embed 仍只调用一次

**checkFallback 降级触发条件（测试计划用例 33）**
- 场景A：返回 0 条结果应触发降级（results.length < 3）
- 场景B：返回 2 条结果（< 3）应触发降级（results.length < 3）
- 场景C：返回 5 条但最高分 0.65（< 0.7）应触发降级（results[0].score < 0.7）
- 场景D：返回 5 条但所有分数 < 0.5 应触发降级（results.every(r => r.score < 0.5)）
- 场景E：返回 5 条且最高分 0.8（≥ 0.7）不应触发降级

**mergeAndDedupeResults 结果合并策略（测试计划用例 32）**
- 阶段1 和 阶段2 的重复 chunkId 应该去重
- filtered 结果加权后排序应高于同等分数的 fuzzy 结果（boost = 1.2）
- 结果应该按 aggregatedScore 降序排列

**文档分块合并（测试计划用例 35）**
- 同文档的多个 chunk 应该合并为一条结果
- aggregatedScore 应取该文档所有 chunk 中的最高分
- matchedChunks 最多返回 3 个（Top-3）

**查询策略分支**
- 有标签且阶段1结果充足时 strategy 应为 filtered
- 有标签但降级时 strategy 应为 hybrid
- 无标签时 strategy 应为 full
- 空标签数组时 strategy 应为 full（视为无标签）

**搜索响应结构**
- 应该返回正确格式的 SearchResponse
- 文档不存在时应该跳过该 chunk（不抛出）
- searchWithFilters 失败时应该返回空结果（优雅降级）

**generateHighlight**
- highlight 字段不应包含 Markdown 语法
- highlight 长度应不超过 200 字符

---

#### VectorizationService（10 个测试）

**vectorizeChunks**
- 应该为每个 chunk 生成向量并存储（调用 embedBatch + addDocumentEmbeddings）
- 存储的数据应包含正确的 metadata（documentId、title、tags、filePath、isCodeBlock 等）
- 代码块 chunk 的 isCodeBlock 元数据应该正确传递
- 空 chunks 数组应该正确处理（以空数组调用 embedBatch）
- embedBatch 失败时应该抛出错误
- addDocumentEmbeddings 失败时应该抛出错误
- 向量数量应该与 chunks 数量对应（一一映射）

**deleteDocumentVectors**
- 应该调用 vectorStore.deleteDocument
- deleteDocument 失败时应该抛出错误
- 删除成功时不应抛出错误

---

#### API Routes（31 个测试）

**POST /notes**
- 应该成功创建笔记，返回 201（含 vectorization.status: pending）
- 空标题应返回 400
- 空内容应返回 400
- 缺少必需字段应返回 400
- service 抛出错误时应返回 500

**PUT /notes/:id**
- 应该成功更新笔记，返回 200（含 vectorization.status: pending）
- 不存在的笔记应返回 404
- 请求体不含任何更新字段应返回 400

**DELETE /notes/:id**
- 应该成功删除笔记，返回 200
- 不存在的笔记应返回 404

**GET /notes/:id**
- 应该成功返回笔记详情，返回 200
- 笔记不存在应返回 404

**GET /notes**
- 应该返回笔记列表，返回 200
- service 失败应返回 500

**POST /notes/:id/vectorize**
- 应该返回 200 成功

**GET /tags**
- 应该返回标签列表，返回 200

**POST /tags**
- 应该成功创建标签，返回 201
- 空标签名应返回 400
- 重复标签应返回 409

**PUT /tags/:id**
- 应该成功更新标签，返回 200
- 不存在的标签应返回 404
- 请求体不含更新字段应返回 400

**DELETE /tags/:id**
- 应该成功删除标签，返回 200（含 updatedDocuments 计数）
- 不存在的标签应返回 404

**GET /tags/:id/documents**
- 应该返回 200 和空数据（TODO 未实现）

**POST /search**
- 应该成功执行搜索，返回 200
- 空 query 应返回 400
- 缺少 query 字段应返回 400
- 有标签的搜索应正确传递 tags 参数
- search service 失败应返回 500

**GET /search/suggest**
- 应该返回 200 和空建议（TODO 未实现）

---

## 测试环境信息

| 项目 | 信息 |
|------|------|
| 操作系统 | macOS Darwin 25.2.0 |
| Node.js | 通过 pnpm 管理 |
| 测试框架 | Vitest v1.6.1 |
| TypeScript | ^5.3.0 |
| 服务端框架 | Hono v4 |
| 测试策略 | 单元测试（全程 mock 外部依赖） |
| Ollama | 未运行（mock 替代）|
| ChromaDB | 未运行（mock 替代）|
| 文件系统 | mock（fs/promises 全量替代）|

---

## 测试基础设施说明

**模块解析修复**：发现 `notes.service.ts`、`search.service.ts`、`vectorization.service.ts` 中存在导入路径 bug——使用 `../../services/xxx.js` 导入，而该相对路径从 `src/server/features/documents/services/` 解析到 `src/server/features/services/`（不存在）。为使测试可运行，在 `src/server/features/services/` 目录创建了代理转发文件（`embeddings.ts`、`vectorstore.ts`），将导入转发到实际路径 `src/server/services/`。同时在测试文件中将 mock 路径匹配到代理文件位置。

**注意**：上述路径问题属于源码潜在 bug——在当前 TypeScript `bundler` moduleResolution 模式下可能因工具链特殊处理而不触发，但在标准 Node.js ESM 运行时会导致模块加载失败。建议开发团队修复为正确的相对路径 `'../../../services/xxx.js'`。

---

## Bug 发现记录

### BUG-001：ChunkingService 代码块前内容被错误标记为 isCodeBlock

**位置**：`src/server/features/documents/services/chunking.service.ts`，第 73 行

**描述**：当代码块前有普通内容时，代码先保存当前 chunk，但 `createChunk` 的 `isCodeBlock` 参数传入了 `true`（第 73 行），导致代码块之前的普通内容 chunk 被错误标记为 `isCodeBlock: true`。

**预期**：代码块前的普通 chunk 应该 `isCodeBlock: false`；只有真正的代码块内容 chunk 才应该 `isCodeBlock: true`。

**实际**：当文档包含"普通内容 + 代码块"结构时，第一个 chunk（普通内容）的 `isCodeBlock` 为 `true`。

**严重程度**：Minor（功能可用，但元数据不准确，可能影响搜索排序权重）

**状态**：待修复

---

### BUG-002：服务文件导入路径错误

**位置**：`notes.service.ts`（第 24-25 行）、`search.service.ts`（第 15-16 行）、`vectorization.service.ts`（第 9 行）

**描述**：`import { embeddingService } from '../../services/embeddings.js'` 从 `src/server/features/documents/services/` 目录解析，`../../services` 实际指向 `src/server/features/services/`（不存在）。应该是 `'../../../services/embeddings.js'`。

**当前影响**：在 TypeScript `bundler` moduleResolution 模式下不报错（可能因工具链特殊处理），但在标准运行时可能失败。测试中通过创建代理文件绕过了此问题。

**严重程度**：Major（潜在运行时 bug）

**状态**：待确认（可能在 bundle 构建时正常工作，需要在实际运行环境中验证）

---

## 测试文件位置

| 测试文件 | 绝对路径 |
|---------|---------|
| chunking.service.test.ts | `/Users/jilong5/mfe-workspace/local-rag/src/server/features/documents/__tests__/chunking.service.test.ts` |
| notes.service.test.ts | `/Users/jilong5/mfe-workspace/local-rag/src/server/features/documents/__tests__/notes.service.test.ts` |
| search.service.test.ts | `/Users/jilong5/mfe-workspace/local-rag/src/server/features/documents/__tests__/search.service.test.ts` |
| vectorization.service.test.ts | `/Users/jilong5/mfe-workspace/local-rag/src/server/features/documents/__tests__/vectorization.service.test.ts` |
| routes.test.ts | `/Users/jilong5/mfe-workspace/local-rag/src/server/features/documents/__tests__/routes.test.ts` |

---

## 未覆盖范围（本轮不在测试范围内）

| 类别 | 原因 |
|------|------|
| E2E 测试（浏览器） | 需要完整前端运行环境（Playwright） |
| 性能测试（用例 41-46） | 需要真实运行环境和外部服务 |
| 兼容性测试（用例 47-51） | 需要多浏览器环境 |
| 安全测试（用例 52-55） | 需要前端运行环境 |
| 向量化集成测试 | 需要 Ollama + ChromaDB |
| MCP 接口测试 | MCP 相关代码未提供 |

---

全部通过
