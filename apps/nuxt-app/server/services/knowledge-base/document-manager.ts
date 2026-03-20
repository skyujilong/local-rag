/**
 * 知识库文档管理服务
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import type { Document, PaginatedResponse } from '@local-rag/shared/types';
import { generateId, parseDate } from '@local-rag/shared/utils';
import * as TagManager from './tag-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.join(__dirname, '../../../data/documents');

/**
 * 确保文档目录存在
 */
async function ensureDocsDir() {
  try {
    await fs.access(DOCS_DIR);
  } catch {
    await fs.mkdir(DOCS_DIR, { recursive: true });
  }
}

/**
 * 获取文档文件路径
 */
function getDocPath(id: string): string {
  return path.join(DOCS_DIR, `${id}.json`);
}

/**
 * 列出文档
 */
export async function listDocuments(options: {
  page: number;
  pageSize: number;
  type?: string;
  search?: string;
}): Promise<PaginatedResponse<Document>> {
  await ensureDocsDir();

  const files = await fs.readdir(DOCS_DIR);
  const docFiles = files.filter(f => f.endsWith('.json'));

  let documents: Document[] = [];

  for (const file of docFiles) {
    try {
      const content = await fs.readFile(path.join(DOCS_DIR, file), 'utf-8');
      const doc = JSON.parse(content) as Document;
      doc.createdAt = parseDate(doc.createdAt as any);
      doc.updatedAt = parseDate(doc.updatedAt as any);
      documents.push(doc);
    } catch (error) {
      console.error(`读取文档文件 ${file} 失败:`, error);
    }
  }

  // 按更新时间降序排序
  documents.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  // 类型过滤
  if (options.type) {
    documents = documents.filter(d => d.metadata.type === options.type);
  }

  // 搜索过滤
  if (options.search) {
    const searchLower = options.search.toLowerCase();
    documents = documents.filter(d =>
      d.title.toLowerCase().includes(searchLower) ||
      d.content.toLowerCase().includes(searchLower)
    );
  }

  const total = documents.length;
  const start = (options.page - 1) * options.pageSize;
  const end = start + options.pageSize;
  const items = documents.slice(start, end);

  return {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    hasMore: end < total,
  };
}

/**
 * 获取单个文档
 */
export async function getDocument(id: string): Promise<Document | null> {
  await ensureDocsDir();

  try {
    const docPath = getDocPath(id);
    const content = await fs.readFile(docPath, 'utf-8');
    const doc = JSON.parse(content) as Document;
    doc.createdAt = parseDate(doc.createdAt as any);
    doc.updatedAt = parseDate(doc.updatedAt as any);
    return doc;
  } catch {
    return null;
  }
}

/**
 * 创建文档
 */
export async function createDocument(data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>): Promise<Document> {
  await ensureDocsDir();

  const now = new Date();
  const doc: Document = {
    id: generateId('doc'),
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const docPath = getDocPath(doc.id);
  await fs.writeFile(docPath, JSON.stringify(doc, null, 2), 'utf-8');

  // 更新标签
  if (doc.metadata.tags) {
    for (const tag of doc.metadata.tags) {
      await TagManager.addTag(tag, doc.id);
    }
  }

  // 异步索引到 RAG
  const { indexDocument } = await import('../../rag/index.js');
  indexDocument(doc).catch(error => {
    console.error(`索引文档 ${doc.id} 失败:`, error);
  });

  return doc;
}

/**
 * 更新文档
 */
export async function updateDocument(
  id: string,
  data: Partial<Omit<Document, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Document | null> {
  await ensureDocsDir();

  const doc = await getDocument(id);
  if (!doc) return null;

  Object.assign(doc, data);
  doc.updatedAt = new Date();

  const docPath = getDocPath(id);
  await fs.writeFile(docPath, JSON.stringify(doc, null, 2), 'utf-8');

  // 异步重新索引
  const { indexDocument } = await import('../../rag/index.js');
  indexDocument(doc).catch(error => {
    console.error(`重新索引文档 ${doc.id} 失败:`, error);
  });

  return doc;
}

/**
 * 删除文档
 */
export async function deleteDocument(id: string): Promise<boolean> {
  await ensureDocsDir();

  try {
    const docPath = getDocPath(id);
    await fs.unlink(docPath);

    // 从 RAG 索引中删除
    const { removeFromIndex } = await import('../../rag/index.js');
    removeFromIndex(id).catch(error => {
      console.error(`从索引中删除文档 ${id} 失败:`, error);
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * 搜索文档
 */
export async function searchDocuments(keywords: string[]): Promise<Document[]> {
  await ensureDocsDir();

  const files = await fs.readdir(DOCS_DIR);
  const docFiles = files.filter(f => f.endsWith('.json'));

  const documents: Document[] = [];
  const searchLower = keywords.map(k => k.toLowerCase());

  for (const file of docFiles) {
    try {
      const content = await fs.readFile(path.join(DOCS_DIR, file), 'utf-8');
      const doc = JSON.parse(content) as Document;
      doc.createdAt = parseDate(doc.createdAt as any);
      doc.updatedAt = parseDate(doc.updatedAt as any);

      const searchText = `${doc.title} ${doc.content}`.toLowerCase();
      const matches = searchLower.some(keyword => searchText.includes(keyword));

      if (matches) {
        documents.push(doc);
      }
    } catch (error) {
      console.error(`读取文档文件 ${file} 失败:`, error);
    }
  }

  return documents;
}

/**
 * 重新索引所有文档
 */
export async function reindexAll(): Promise<void> {
  const { rebuildIndex } = await import('../../rag/index.js');
  await rebuildIndex();
}
