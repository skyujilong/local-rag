/**
 * Documents feature - Shared type definitions
 *
 * This file contains all type definitions for the Documents (本地笔记) feature,
 * used by both frontend and backend.
 */

/**
 * Note (笔记) - Core entity for user-created notes
 */
export interface Note {
  id: string;                  // 笔记唯一 ID (UUID)
  title: string;               // 笔记标题
  content: string;             // Markdown 内容
  tags: string[];              // 标签数组，如 ["javascript", "tutorial"]
  filePath: string;            // 文件路径，如 ".devrag/notes/2024-03-27-{uuid}-note.md"
  createdAt: Date;             // 创建时间
  updatedAt: Date;             // 更新时间
}

/**
 * Note (笔记) - 用于 API 响应的简化版本
 */
export interface NoteListItem {
  id: string;
  title: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  excerpt: string;             // 前 100 字内容预览
}

/**
 * Chunk (文档分块) - 文档分割后的一个片段
 */
export interface Chunk {
  id: string;                  // chunk 唯一 ID (UUID)
  documentId: string;          // 所属文档 ID
  content: string;             // chunk 内容
  index: number;               // chunk 序号（从 0 开始）
  embedding?: number[];        // 向量数据（可选，查询时返回）
  metadata: ChunkMetadata;     // 元数据
}

/**
 * ChunkMetadata (分块元数据)
 */
export interface ChunkMetadata {
  chunkId: string;             // chunk 唯一 ID
  documentId: string;          // 所属文档 ID
  filePath: string;            // 文件路径

  // 位置信息
  chunkIndex: number;          // chunk 序号（从 0 开始）
  startPosition: number;       // 在原文档中的起始位置
  endPosition: number;         // 在原文档中的结束位置

  // 内容信息
  contentLength: number;       // 内容长度

  // 结构信息
  sectionTitle?: string;       // 所属章节标题
  sectionLevel?: number;       // 章节层级（H1-H6）
  isCodeBlock?: boolean;       // 是否代码块

  // 标签（从文档继承）
  tags: string[];              // 标签数组
}

/**
 * Tag (标签)
 */
export interface Tag {
  id: string;                  // 标签唯一 ID
  name: string;                // 标签名称
  color?: string;              // 标签颜色（v1.1）
  createdAt: Date;             // 创建时间
}

/**
 * SearchResult (搜索结果) - 合并后的搜索结果
 */
export interface SearchResult {
  documentId: string;          // 文档 ID
  document: Note;              // 完整文档
  aggregatedScore: number;     // 聚合分数（取最高分）
  matchedChunks: Array<{
    chunkId: string;           // chunk ID
    content: string;           // chunk 内容
    score: number;             // 相似度分数
    highlight: string;         // 高亮片段
  }>;
}

/**
 * ChromaDB Metadata (向量数据库元数据)
 */
export interface ChromaDBMetadata {
  filePath: string;            // 文件路径，用于读取完整内容
  chunkIndex: number;          // chunk 索引
  documentId: string;          // 文档 ID
  title: string;               // 笔记标题
  tags: string[];              // 多标签数组，用于预过滤查询
  createdAt: string;           // ISO 时间戳
  sectionTitle?: string;       // 章节标题
  isCodeBlock?: boolean;       // 是否代码块
}

/**
 * 创建笔记请求
 */
export interface CreateNoteRequest {
  title: string;
  content: string;
  tags?: string[];
}

/**
 * 更新笔记请求
 */
export interface UpdateNoteRequest {
  title?: string;
  content?: string;
  tags?: string[];
}

/**
 * 笔记列表查询参数
 */
export interface NotesListQuery {
  tags?: string;               // 逗号分隔的标签列表，AND 逻辑
  sort?: 'createdAt' | 'updatedAt' | 'title';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * 笔记列表响应
 */
export interface NotesListResponse {
  total: number;
  page: number;
  limit: number;
  documents: NoteListItem[];
}

/**
 * 搜索请求
 */
export interface SearchRequest {
  query: string;
  tags?: string[];              // 标签过滤（AND 逻辑）
  limit?: number;
}

/**
 * 搜索响应
 */
export interface SearchResponse {
  query: string;
  strategy: 'filtered' | 'hybrid' | 'full';
  data: {
    total: number;
    results: SearchResult[];
  };
  meta: {
    stage1Results: number;
    stage2Triggered: boolean;
    totalTime: number;
  };
}

/**
 * 创建标签请求
 */
export interface CreateTagRequest {
  name: string;
  color?: string;
}

/**
 * 更新标签请求
 */
export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

/**
 * 标签列表响应
 */
export interface TagsListResponse {
  total: number;
  tags: Array<{
    id: string;
    name: string;
    count: number;             // 关联的笔记数量
  }>;
}

/**
 * 向量化状态
 */
export interface VectorizationStatus {
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message?: string;
  chunks?: {
    total: number;
    processed: number;
  };
}

/**
 * API 响应包装
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  vectorization?: VectorizationStatus;
}
