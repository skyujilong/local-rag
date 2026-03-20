/**
 * 标签管理服务
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TAGS_DIR = path.join(__dirname, '../../../data/tags');

/**
 * 获取标签文件路径
 */
function getTagPath(tag: string): string {
  // 标签名转换为安全的文件名
  const safeName = tag.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  return path.join(TAGS_DIR, `${safeName}.json`);
}

/**
 * 确保标签目录存在
 */
async function ensureTagsDir() {
  try {
    await fs.access(TAGS_DIR);
  } catch {
    await fs.mkdir(TAGS_DIR, { recursive: true });
  }
}

/**
 * 添加标签
 */
export async function addTag(tag: string, documentId: string): Promise<void> {
  await ensureTagsDir();

  const tagPath = getTagPath(tag);

  try {
    const content = await fs.readFile(tagPath, 'utf-8');
    const data = JSON.parse(content);
    if (!data.documents.includes(documentId)) {
      data.documents.push(documentId);
      data.count = data.documents.length;
      await fs.writeFile(tagPath, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch {
    // 标签不存在，创建新标签
    const data = {
      tag,
      documents: [documentId],
      count: 1,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(tagPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

/**
 * 移除标签
 */
export async function removeTag(tag: string, documentId: string): Promise<void> {
  await ensureTagsDir();

  const tagPath = getTagPath(tag);

  try {
    const content = await fs.readFile(tagPath, 'utf-8');
    const data = JSON.parse(content);
    data.documents = data.documents.filter((id: string) => id !== documentId);
    data.count = data.documents.length;

    if (data.count === 0) {
      await fs.unlink(tagPath);
    } else {
      await fs.writeFile(tagPath, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch {
    // 标签不存在，忽略
  }
}

/**
 * 获取所有标签
 */
export async function getAllTags(): Promise<Array<{ tag: string; count: number }>> {
  await ensureTagsDir();

  try {
    const files = await fs.readdir(TAGS_DIR);
    const tagFiles = files.filter(f => f.endsWith('.json'));

    const tags: Array<{ tag: string; count: number }> = [];

    for (const file of tagFiles) {
      try {
        const content = await fs.readFile(path.join(TAGS_DIR, file), 'utf-8');
        const data = JSON.parse(content);
        tags.push({ tag: data.tag, count: data.count });
      } catch (error) {
        console.error(`读取标签文件 ${file} 失败:`, error);
      }
    }

    return tags.sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

/**
 * 获取标签下的文档
 */
export async function getDocumentsByTag(tag: string): Promise<string[]> {
  await ensureTagsDir();

  const tagPath = getTagPath(tag);

  try {
    const content = await fs.readFile(tagPath, 'utf-8');
    const data = JSON.parse(content);
    return data.documents || [];
  } catch {
    return [];
  }
}
