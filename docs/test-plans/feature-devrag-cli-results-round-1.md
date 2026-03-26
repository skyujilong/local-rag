# Test Results - DevRAG CLI - Round 1

**Date**: 2026-03-26
**Branch**: rewrite
**Runner**: Vitest
**Total**: 260 passed, 0 failed, 0 skipped

---

## Summary

| Metric | Value |
|--------|-------|
| Total tests | 260 |
| Passed | 260 |
| Failed | 0 |
| Skipped | 0 |
| Test files | 12 |

---

## Test Suites

### 1. `src/shared/utils/text.test.ts` - 19 tests

Describe blocks:
- `splitText` - chunk splitting with overlap and sentence boundary handling
- `stripMarkdown` - removal of headers, bold/italic markers, inline code
- `extractTags` - frontmatter tags, inline hashtags, deduplication
- `extractTitle` - frontmatter, first heading, first-line fallback
- `countWords` - English and Chinese word counting, whitespace handling
- `detectLanguage` - English, Chinese, mixed content detection

### 2. `src/server/services/search.test.ts` - 6 tests

Describe blocks:
- `SearchService > semanticSearch`
- `SearchService > keywordSearch`
- `SearchService > hybridSearch`
- `SearchService > getSearchSuggestions`

### 3. `src/server/services/documents.test.ts` - 20 tests

Describe blocks:
- `DocumentService > generateId`
- `DocumentService > getAllDocuments`
- `DocumentService > getDocument`
- `DocumentService > addDocumentFromText`
- `DocumentService > deleteDocument`
- `DocumentService > getOptimalChunkSize`
- `DocumentService > importMarkdownFile - path traversal protection`
- `DocumentService > vectorization progress`
- `DocumentService > persistent metadata`

### 4. `src/server/services/embeddings.test.ts` - 18 tests

Describe blocks:
- `EmbeddingService > initialize`
- `EmbeddingService > getDimension / getModel / isReady`
- `EmbeddingService > embed`
- `EmbeddingService > embedBatch`
- `EmbeddingService > retryConnection`

### 5. `src/server/services/crawler.test.ts` - 20 tests

Describe blocks:
- `CrawlerService > initialize`
- `CrawlerService > crawlUrl`
- `CrawlerService > XSS protection via DOMPurify`
- `CrawlerService > screenshot with cross-platform path (os.tmpdir)`
- `CrawlerService > crawlUrls (batch crawling)`
- `CrawlerService > crawlAndImport`
- `CrawlerService > close`

### 6. `src/server/mcp/server.test.ts` - 30 tests

Describe blocks:
- `MCPServer > isActive`
- `MCPServer > searchKnowledgeBase input validation`
- `MCPServer > listDocuments input validation`
- `MCPServer > getDocument input validation`
- `MCPServer > addDocument input validation`
- `MCPServer > unknown tool`

### 7. `src/server/api/index.test.ts` - 23 tests

Describe blocks:
- `API Routes > GET /api/health`
- `API Routes > GET /api/documents`
- `API Routes > GET /api/documents/:id`
- `API Routes > DELETE /api/documents/:id`
- `API Routes > POST /api/search`
- `API Routes > Request body size limit`
- `API Routes > GET /api/suggestions`
- `API Routes > POST /api/import/markdown`
- `API Routes > POST /api/import/text`
- `API Routes > POST /api/import/obsidian`
- `API Routes > POST /api/crawl`
- `API Routes > 404 handler`

### 8. `src/shared/utils/config.test.ts` - 15 tests

Describe blocks:
- `ConfigManager > default configuration values`
- `ConfigManager > save with secure file permissions`
- `ConfigManager > get and set operations`
- `ConfigManager > config merging`
- `ConfigManager > chromadb configuration`

### 9. `src/server/services/vectorstore.test.ts` - 23 tests

Describe blocks:
- `VectorStoreService > initialize`
- `VectorStoreService > addDocumentEmbeddings`
- `VectorStoreService > search`
- `VectorStoreService > deleteDocument`
- `VectorStoreService > getDocumentCount and getVectorCount`
- `VectorStoreService > isReady`

### 10. `src/server/services/search.additional.test.ts` - 19 tests

Describe blocks:
- `SearchService - RRF Algorithm > reciprocalRankFusion`
- `SearchService - RRF Algorithm > keywordSearch - filtering`
- `SearchService - RRF Algorithm > getSimilarDocuments`
- `SearchService - RRF Algorithm > getSearchSuggestions`

### 11. `src/shared/utils/text.additional.test.ts` - 36 tests

Describe blocks:
- `splitText - detailed behavior`
- `extractTitle - comprehensive scenarios`
- `extractTags - security and edge cases`
- `stripMarkdown - security edge cases`
- `countWords - edge cases`
- `detectLanguage - edge cases`

### 12. `src/security.test.ts` - 31 tests

Describe blocks:
- `Security: UUID-based ID Generation (no collision risk)`
- `Security: Path Traversal Protection (documents.ts)`
- `Security: XSS Prevention (DOMPurify)`
- `Security: Input Validation Logic > MCP search query validation rules`
- `Security: Input Validation Logic > UUID validation for document IDs`
- `Security: Input Validation Logic > Content size limits`
- `Security: Config File Permission (0o600)`

---

## Conclusion

全部通过。

12 个测试文件，260 个测试用例，0 失败，0 跳过。覆盖范围包括核心服务层（文档、搜索、向量存储、爬虫、嵌入）、API 路由层、MCP 服务器、工具函数（文本处理、配置管理），以及专项安全测试（路径穿越防护、XSS 防护、输入校验、文件权限）。
