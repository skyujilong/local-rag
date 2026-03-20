/**
 * 笔记管理服务
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import type { Note, PaginatedResponse, CreateNoteInput } from '@local-rag/shared/types';
import { generateId, formatDate, parseDate } from '@local-rag/shared/utils';
import * as Indexer from './indexer';
import { uploadImage } from './image-handler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NOTES_DIR = path.join(__dirname, '../../../data/notes');

/**
 * 确保笔记目录存在
 */
async function ensureNotesDir() {
  try {
    await fs.access(NOTES_DIR);
  } catch {
    await fs.mkdir(NOTES_DIR, { recursive: true });
  }
}

/**
 * 获取笔记文件路径
 */
function getNotePath(id: string): string {
  return path.join(NOTES_DIR, `${id}.json`);
}

/**
 * 列出笔记
 */
export async function listNotes(options: {
  page: number;
  pageSize: number;
  tag?: string;
  search?: string;
}): Promise<PaginatedResponse<Note>> {
  await ensureNotesDir();

  const files = await fs.readdir(NOTES_DIR);
  const noteFiles = files.filter(f => f.endsWith('.json'));

  let notes: Note[] = [];

  for (const file of noteFiles) {
    try {
      const content = await fs.readFile(path.join(NOTES_DIR, file), 'utf-8');
      const note = JSON.parse(content) as Note;
      note.createdAt = parseDate(note.createdAt as any);
      note.updatedAt = parseDate(note.updatedAt as any);
      notes.push(note);
    } catch (error) {
      console.error(`读取笔记文件 ${file} 失败:`, error);
    }
  }

  // 按更新时间降序排序
  notes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  // 标签过滤
  if (options.tag) {
    notes = notes.filter(n => n.tags.includes(options.tag!));
  }

  // 搜索过滤
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    notes = notes.filter(n =>
      n.title.toLowerCase().includes(searchLower) ||
      n.content.toLowerCase().includes(searchLower)
    );
  }

  const total = notes.length;
  const start = (options.page - 1) * options.pageSize;
  const end = start + options.pageSize;
  const items = notes.slice(start, end);

  return {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    hasMore: end < total,
  };
}

/**
 * 获取单个笔记
 */
export async function getNote(id: string): Promise<Note | null> {
  await ensureNotesDir();

  try {
    const notePath = getNotePath(id);
    const content = await fs.readFile(notePath, 'utf-8');
    const note = JSON.parse(content) as Note;
    note.createdAt = parseDate(note.createdAt as any);
    note.updatedAt = parseDate(note.updatedAt as any);
    return note;
  } catch (error) {
    return null;
  }
}

/**
 * 创建笔记
 */
export async function createNote(data: {
  title: string;
  content: string;
  tags: string[];
}): Promise<Note> {
  await ensureNotesDir();

  const now = new Date();
  const note: Note = {
    id: generateId('note'),
    title: data.title,
    content: data.content,
    tags: data.tags,
    images: [],
    createdAt: now,
    updatedAt: now,
  };

  const notePath = getNotePath(note.id);
  await fs.writeFile(notePath, JSON.stringify(note, null, 2), 'utf-8');

  // 异步索引到 RAG
  Indexer.indexNote(note).catch(error => {
    console.error(`索引笔记 ${note.id} 失败:`, error);
  });

  return note;
}

/**
 * 更新笔记
 */
export async function updateNote(
  id: string,
  data: {
    title?: string;
    content?: string;
    tags?: string[];
  }
): Promise<Note | null> {
  await ensureNotesDir();

  const note = await getNote(id);
  if (!note) return null;

  if (data.title !== undefined) note.title = data.title;
  if (data.content !== undefined) note.content = data.content;
  if (data.tags !== undefined) note.tags = data.tags;
  note.updatedAt = new Date();

  const notePath = getNotePath(id);
  await fs.writeFile(notePath, JSON.stringify(note, null, 2), 'utf-8');

  // 异步重新索引
  Indexer.indexNote(note).catch(error => {
    console.error(`重新索引笔记 ${note.id} 失败:`, error);
  });

  return note;
}

/**
 * 删除笔记
 */
export async function deleteNote(id: string): Promise<boolean> {
  await ensureNotesDir();

  try {
    const notePath = getNotePath(id);
    await fs.unlink(notePath);

    // 从 RAG 索引中删除
    Indexer.removeNoteFromIndex(id).catch(error => {
      console.error(`从索引中删除笔记 ${id} 失败:`, error);
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * 按标题搜索笔记
 */
export async function searchNotesByTitle(title: string): Promise<Note[]> {
  await ensureNotesDir();

  const files = await fs.readdir(NOTES_DIR);
  const noteFiles = files.filter(f => f.endsWith('.json'));

  const notes: Note[] = [];
  const searchLower = title.toLowerCase();

  for (const file of noteFiles) {
    try {
      const content = await fs.readFile(path.join(NOTES_DIR, file), 'utf-8');
      const note = JSON.parse(content) as Note;
      note.createdAt = parseDate(note.createdAt as any);
      note.updatedAt = parseDate(note.updatedAt as any);

      if (note.title.toLowerCase().includes(searchLower)) {
        notes.push(note);
      }
    } catch (error) {
      console.error(`读取笔记文件 ${file} 失败:`, error);
    }
  }

  return notes;
}

/**
 * 添加图片到笔记
 */
export async function addImageToNote(
  noteId: string,
  imageData: {
    id: string;
    filename: string;
    path: string;
    size: number;
    mimeType: string;
  }
): Promise<Note | null> {
  const note = await getNote(noteId);
  if (!note) return null;

  note.images.push(imageData);
  note.updatedAt = new Date();

  const notePath = getNotePath(noteId);
  await fs.writeFile(notePath, JSON.stringify(note, null, 2), 'utf-8');

  return note;
}

/**
 * 从笔记中删除图片
 */
export async function removeImageFromNote(
  noteId: string,
  imageId: string
): Promise<Note | null> {
  const note = await getNote(noteId);
  if (!note) return null;

  note.images = note.images.filter(img => img.id !== imageId);
  note.updatedAt = new Date();

  const notePath = getNotePath(noteId);
  await fs.writeFile(notePath, JSON.stringify(note, null, 2), 'utf-8');

  return note;
}

/**
 * NoteManager 类 - 封装所有笔记管理功能
 */
export class NoteManager {
  /**
   * 获取所有笔记
   */
  async getAllNotes(): Promise<Note[]> {
    const result = await listNotes({ page: 1, pageSize: 1000 });
    return result.items;
  }

  /**
   * 分页获取笔记
   */
  async list(options: { page: number; pageSize: number; tag?: string; search?: string }): Promise<PaginatedResponse<Note>> {
    return listNotes(options);
  }

  /**
   * 获取单个笔记
   */
  async getNote(id: string): Promise<Note | null> {
    return getNote(id);
  }

  /**
   * 创建笔记
   */
  async createNote(data: CreateNoteInput): Promise<Note> {
    return createNote(data);
  }

  /**
   * 更新笔记
   */
  async updateNote(id: string, data: Partial<Note>): Promise<Note | null> {
    return updateNote(id, data);
  }

  /**
   * 删除笔记
   */
  async deleteNote(id: string): Promise<boolean> {
    return deleteNote(id);
  }

  /**
   * 搜索笔记
   */
  async searchNotes(title: string): Promise<Note[]> {
    return searchNotesByTitle(title);
  }

  /**
   * 上传笔记图片
   */
  async uploadNoteImage(noteId: string, filename: string, data: Buffer): Promise<string> {
    return addImageToNote(noteId, {
      id: generateId('img'),
      filename,
      path: `/images/notes/${noteId}/${filename}`,
      size: data.length,
      mimeType: filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
    }).then(() => `/images/notes/${noteId}/${filename}`);
  }
}
