/**
 * Notes Service - 笔记业务逻辑层
 *
 * 负责处理笔记的 CRUD 操作、标签管理、向量化触发等核心业务逻辑。
 */

import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import type {
  Note,
  NoteListItem,
  CreateNoteRequest,
  UpdateNoteRequest,
  NotesListQuery,
  NotesListResponse,
  Tag,
  CreateTagRequest,
  UpdateTagRequest,
  TagsListResponse,
} from '../../../../shared/types/documents.js';
import { createLogger } from '../../../../shared/utils/logger.js';
import { chunkingService } from './chunking.service.js';
import { vectorizationService } from './vectorization.service.js';
import { vectorStore } from '../../services/vectorstore.js';

const log = createLogger('features:documents:notes');

// 笔记存储目录
const NOTES_DIR = join(process.cwd(), '.devrag', 'notes');

// 标签存储文件
const TAGS_STORAGE_PATH = join(process.cwd(), '.devrag', 'tags-metadata.json');

/**
 * Notes Service 类
 */
export class NotesService {
  private notesCache: Map<string, Note> = new Map();
  private tagsCache: Map<string, Tag> = new Map();
  private cacheLoaded = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // 触发后台预加载，但不强制等待（通过 ensureInitialized 在公开方法中保证）
    this.initPromise = this.loadMetadata().catch((error) => {
      log.warn('Failed to load metadata on startup:', error);
      this.initPromise = null; // 允许下次调用重试
    });
  }

  /**
   * 确保元数据已加载完成（所有公开方法调用前的守卫）
   */
  private async ensureInitialized(): Promise<void> {
    if (this.cacheLoaded) {
      return;
    }
    if (!this.initPromise) {
      this.initPromise = this.loadMetadata();
    }
    await this.initPromise;
  }

  /**
   * 验证文件路径是否安全（防止路径遍历攻击）
   */
  private validateFilePath(title: string): string {
    // 长度限制
    const truncated = title.slice(0, 50);
    // 替换非法字符，合并连续 -
    const sanitized = truncated
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return sanitized || 'untitled';
  }

  /**
   * 创建新笔记
   */
  async createNote(request: CreateNoteRequest): Promise<Note> {
    await this.ensureInitialized();

    const id = crypto.randomUUID();
    const now = new Date();

    // 生成文件路径（使用 validateFilePath 防止路径遍历）
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedTitle = this.validateFilePath(request.title);
    const fileName = `${dateStr}-${id}-${sanitizedTitle}.md`;
    const filePath = join(NOTES_DIR, fileName);

    // 路径遍历校验
    const resolvedPath = resolve(filePath);
    const resolvedNotesDir = resolve(NOTES_DIR);
    if (!resolvedPath.startsWith(resolvedNotesDir + '/') && resolvedPath !== resolvedNotesDir) {
      throw new Error('Invalid file path: path traversal detected');
    }

    // 创建笔记对象
    const note: Note = {
      id,
      title: request.title,
      content: request.content,
      tags: request.tags || [],
      filePath,
      createdAt: now,
      updatedAt: now,
    };

    // 确保目录存在
    await mkdir(NOTES_DIR, { recursive: true });

    // 写入文件
    await writeFile(filePath, request.content, 'utf-8');

    // 缓存笔记
    this.notesCache.set(id, note);

    // 保存元数据
    await this.saveNoteMetadata();

    // 异步触发向量化
    setImmediate(() => {
      this.vectorizeNote(id).catch((error) => {
        log.error(`向量化失败: ${id}`, error);
      });
    });

    log.info(`笔记创建成功: ${note.title} (${id})`);

    return note;
  }

  /**
   * 更新笔记
   */
  async updateNote(id: string, request: UpdateNoteRequest): Promise<Note> {
    await this.ensureInitialized();

    const note = this.notesCache.get(id);
    if (!note) {
      throw new Error(`笔记不存在: ${id}`);
    }

    // 确保 content 已从文件加载，避免写入 undefined
    if (note.content === undefined) {
      try {
        note.content = await readFile(note.filePath, 'utf-8');
      } catch (error) {
        log.error(`读取笔记文件失败: ${note.filePath}`, error);
        throw new Error(`无法读取笔记文件: ${id}`);
      }
    }

    // 更新字段
    if (request.title !== undefined) {
      note.title = request.title;
    }
    if (request.content !== undefined) {
      note.content = request.content;
    }
    if (request.tags !== undefined) {
      note.tags = request.tags;
    }
    note.updatedAt = new Date();

    // 写入文件
    await writeFile(note.filePath, note.content, 'utf-8');

    // 保存元数据
    await this.saveNoteMetadata();

    // 异步触发重新向量化
    setImmediate(() => {
      this.revectorizeNote(id).catch((error) => {
        log.error(`重新向量化失败: ${id}`, error);
      });
    });

    log.info(`笔记更新成功: ${note.title} (${id})`);

    return note;
  }

  /**
   * 删除笔记
   */
  async deleteNote(id: string): Promise<void> {
    await this.ensureInitialized();

    const note = this.notesCache.get(id);
    if (!note) {
      throw new Error(`笔记不存在: ${id}`);
    }

    // 删除文件
    try {
      await unlink(note.filePath);
    } catch (error) {
      log.warn(`删除文件失败: ${note.filePath}`, error);
    }

    // 删除向量索引
    try {
      await vectorStore.deleteDocument(id);
    } catch (error) {
      log.warn(`删除向量索引失败: ${id}`, error);
    }

    // 从缓存移除
    this.notesCache.delete(id);

    // 保存元数据
    await this.saveNoteMetadata();

    log.info(`笔记删除成功: ${note.title} (${id})`);
  }

  /**
   * 获取笔记详情
   */
  async getNote(id: string): Promise<Note | null> {
    await this.ensureInitialized();

    const note = this.notesCache.get(id);
    if (!note) {
      return null;
    }

    // 如果缓存中没有内容，从文件读取
    if (!note.content) {
      try {
        const content = await readFile(note.filePath, 'utf-8');
        note.content = content;
      } catch (error) {
        log.error(`读取笔记文件失败: ${note.filePath}`, error);
        return null;
      }
    }

    return note;
  }

  /**
   * 获取笔记列表
   */
  async getNotesList(query: NotesListQuery): Promise<NotesListResponse> {
    await this.ensureInitialized();

    let notes = Array.from(this.notesCache.values());

    // 标签过滤（AND 逻辑）
    if (query.tags) {
      const filterTags = query.tags.split(',').map((t) => t.trim());
      notes = notes.filter((note) =>
        filterTags.every((tag) => note.tags.includes(tag))
      );
    }

    // 排序
    const sortField = query.sort || 'updatedAt';
    const sortOrder = query.order || 'desc';

    notes.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === bValue) return 0;

      if (sortField === 'title') {
        // title is always string
        const aStr = aValue as string;
        const bStr = bValue as string;
        return sortOrder === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      }

      // Date 字段
      const aTime = aValue instanceof Date ? aValue.getTime() : new Date(aValue as string).getTime();
      const bTime = bValue instanceof Date ? bValue.getTime() : new Date(bValue as string).getTime();
      return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
    });

    // 分页
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const paginatedNotes = notes.slice(offset, offset + limit);

    // 转换为列表项格式
    const documents: NoteListItem[] = paginatedNotes.map((note) => ({
      id: note.id,
      title: note.title,
      tags: note.tags,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      excerpt: this.generateExcerpt(note.content),
    }));

    return {
      total: notes.length,
      page,
      limit,
      documents,
    };
  }

  /**
   * 创建标签
   */
  async createTag(request: CreateTagRequest): Promise<Tag> {
    await this.ensureInitialized();

    // 检查标签是否已存在
    const existingTag = Array.from(this.tagsCache.values()).find(
      (tag) => tag.name === request.name
    );

    if (existingTag) {
      throw new Error(`标签已存在: ${request.name}`);
    }

    const tag: Tag = {
      id: crypto.randomUUID(),
      name: request.name,
      color: request.color,
      createdAt: new Date(),
    };

    this.tagsCache.set(tag.id, tag);
    await this.saveTagsMetadata();

    log.info(`标签创建成功: ${tag.name} (${tag.id})`);

    return tag;
  }

  /**
   * 更新标签
   */
  async updateTag(id: string, request: UpdateTagRequest): Promise<Tag> {
    await this.ensureInitialized();

    const tag = this.tagsCache.get(id);
    if (!tag) {
      throw new Error(`标签不存在: ${id}`);
    }

    const oldName = tag.name;

    // 更新字段
    if (request.name !== undefined) {
      tag.name = request.name;
    }
    if (request.color !== undefined) {
      tag.color = request.color;
    }

    // 更新所有笔记中的标签（只更新内存缓存和元数据，标签不存储在 Markdown 文件中）
    if (request.name !== undefined && request.name !== oldName) {
      for (const note of this.notesCache.values()) {
        const index = note.tags.indexOf(oldName);
        if (index !== -1) {
          note.tags[index] = request.name;
          // 不写入 Markdown 文件：标签存储在元数据 JSON 中，而非 Markdown 内容
        }
      }
      await this.saveNoteMetadata();
    }

    await this.saveTagsMetadata();

    log.info(`标签更新成功: ${tag.name} (${id})`);

    return tag;
  }

  /**
   * 删除标签
   */
  async deleteTag(id: string): Promise<number> {
    await this.ensureInitialized();

    const tag = this.tagsCache.get(id);
    if (!tag) {
      throw new Error(`标签不存在: ${id}`);
    }

    let updatedCount = 0;

    // 从所有笔记中移除该标签（只更新内存缓存，标签不存储在 Markdown 文件中）
    const notesToUpdate = Array.from(this.notesCache.values())
      .filter(note => note.tags.includes(tag.name));

    for (const note of notesToUpdate) {
      const index = note.tags.indexOf(tag.name);
      if (index !== -1) {
        note.tags.splice(index, 1);
        // 不写入 Markdown 文件：标签存储在元数据 JSON 中，而非 Markdown 内容
        updatedCount++;
      }
    }

    // 从缓存移除
    this.tagsCache.delete(id);

    // 保存元数据
    await this.saveTagsMetadata();
    await this.saveNoteMetadata();

    log.info(`标签删除成功: ${tag.name} (${id}), 影响了 ${updatedCount} 个笔记`);

    return updatedCount;
  }

  /**
   * 获取所有标签
   */
  async getTagsList(): Promise<TagsListResponse> {
    await this.ensureInitialized();

    // 计算每个标签的笔记数量
    const tagCounts = new Map<string, number>();

    for (const note of this.notesCache.values()) {
      for (const tag of note.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    const tags = Array.from(this.tagsCache.values())
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        count: tagCounts.get(tag.name) || 0,
      }))
      .sort((a, b) => b.count - a.count); // 按使用频率降序

    return {
      total: tags.length,
      tags,
    };
  }

  /**
   * 向量化笔记
   */
  private async vectorizeNote(noteId: string): Promise<void> {
    const note = this.notesCache.get(noteId);
    if (!note) {
      throw new Error(`笔记不存在: ${noteId}`);
    }

    log.info(`开始向量化笔记: ${note.title} (${noteId})`);

    // 分块
    const chunks = await chunkingService.chunkNote(note);

    // 向量化
    await vectorizationService.vectorizeChunks(noteId, note.title, chunks, note.tags);

    log.info(`向量化完成: ${note.title} (${noteId}), ${chunks.length} chunks`);
  }

  /**
   * 重新向量化笔记
   */
  private async revectorizeNote(noteId: string): Promise<void> {
    // 删除旧向量
    try {
      await vectorStore.deleteDocument(noteId);
    } catch (error) {
      log.warn(`删除旧向量失败: ${noteId}`, error);
    }

    // 向量化新内容
    await this.vectorizeNote(noteId);
  }

  /**
   * 加载元数据
   */
  private async loadMetadata(): Promise<void> {
    if (this.cacheLoaded) {
      return;
    }

    // 加载笔记元数据
    try {
      const notesData = await readFile(join(NOTES_DIR, '.metadata.json'), 'utf-8');
      const notesList = JSON.parse(notesData) as Note[];

      for (const note of notesList) {
        note.createdAt = new Date(note.createdAt);
        note.updatedAt = new Date(note.updatedAt);
        this.notesCache.set(note.id, note);
      }

      log.info(`加载了 ${notesList.length} 个笔记元数据`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn('加载笔记元数据失败:', error);
      }
    }

    // 加载标签元数据
    try {
      const tagsData = await readFile(TAGS_STORAGE_PATH, 'utf-8');
      const tagsList = JSON.parse(tagsData) as Tag[];

      for (const tag of tagsList) {
        tag.createdAt = new Date(tag.createdAt);
        this.tagsCache.set(tag.id, tag);
      }

      log.info(`加载了 ${tagsList.length} 个标签元数据`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.warn('加载标签元数据失败:', error);
      }
    }

    this.cacheLoaded = true;
  }

  /**
   * 保存笔记元数据
   */
  private async saveNoteMetadata(): Promise<void> {
    try {
      const notesList = Array.from(this.notesCache.values()).map((note) => ({
        id: note.id,
        title: note.title,
        tags: note.tags,
        filePath: note.filePath,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      }));

      await mkdir(NOTES_DIR, { recursive: true });
      await writeFile(
        join(NOTES_DIR, '.metadata.json'),
        JSON.stringify(notesList, null, 2),
        'utf-8'
      );
    } catch (error) {
      log.error('保存笔记元数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存标签元数据
   */
  private async saveTagsMetadata(): Promise<void> {
    try {
      const tagsList = Array.from(this.tagsCache.values());

      await mkdir(dirname(TAGS_STORAGE_PATH), { recursive: true });
      await writeFile(
        TAGS_STORAGE_PATH,
        JSON.stringify(tagsList, null, 2),
        'utf-8'
      );
    } catch (error) {
      log.error('保存标签元数据失败:', error);
      throw error;
    }
  }

  /**
   * 生成内容摘要
   */
  private generateExcerpt(content: string | undefined, maxLength: number = 100): string {
    if (!content) return '';
    // 移除 Markdown 语法
    const plainText = content
      .replace(/^#{1,6}\s+/gm, '') // 标题
      .replace(/\*\*/g, '') // 粗体
      .replace(/\*/g, '') // 斜体
      .replace(/`/g, '') // 代码
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接
      .replace(/\n+/g, ' ') // 换行
      .trim();

    return plainText.slice(0, maxLength) + (plainText.length > maxLength ? '...' : '');
  }
}

// 导出单例
export const notesService = new NotesService();
