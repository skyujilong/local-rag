/**
 * 本地文件存储服务
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import * as IgnoreRules from './ignore-rules.js';
import * as TextIndexer from './indexer/text-indexer.js';
import * as MarkdownIndexer from './indexer/markdown-indexer.js';
import * as CodeIndexer from './indexer/code-indexer.js';
import { isTextFile } from '@local-rag/shared/utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 文件信息
 */
export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: string;
  modifiedAt: Date;
  isDirectory: boolean;
}

/**
 * 列出已索引的文件
 */
export async function listIndexedFiles(targetPath?: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  if (!targetPath) {
    // 列出所有已索引的文件
    const { items: documents } = await import('../services/knowledge-base/document-manager.js').then(m => m.listDocuments({ page: 1, pageSize: 10000 }));

    for (const doc of documents) {
      if (doc.metadata.filePath) {
        try {
          const stat = await fs.stat(doc.metadata.filePath);
          files.push({
            path: doc.metadata.filePath,
            name: path.basename(doc.metadata.filePath),
            size: stat.size,
            type: path.extname(doc.metadata.filePath),
            modifiedAt: stat.mtime,
            isDirectory: stat.isDirectory(),
          });
        } catch {
          // 文件可能已被删除
        }
      }
    }
  } else {
    // 列出指定目录的文件
    await listFilesRecursive(targetPath, files);
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * 递归列出文件
 */
async function listFilesRecursive(dirPath: string, files: FileInfo[]): Promise<void> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // 检查忽略规则
      if (IgnoreRules.shouldIgnore(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await listFilesRecursive(fullPath, files);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          files.push({
            path: fullPath,
            name: entry.name,
            size: stat.size,
            type: path.extname(fullPath),
            modifiedAt: stat.mtime,
            isDirectory: false,
          });
        } catch {
          // 无法获取文件信息，跳过
        }
      }
    }
  } catch {
    // 目录无法访问，跳过
  }
}

/**
 * 索引文件路径
 */
export async function indexPath(targetPath: string, recursive = true): Promise<{
  indexed: number;
  failed: number;
  errors: string[];
}> {
  const ignorePatterns = IgnoreRules.getAllIgnorePatterns();
  let indexed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function processPath(filePath: string) {
    // 检查是否应该忽略
    if (IgnoreRules.shouldIgnore(filePath, ignorePatterns)) {
      return;
    }

    try {
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        if (recursive) {
          const entries = await fs.readdir(filePath, { withFileTypes: true });
          for (const entry of entries) {
            await processPath(path.join(filePath, entry.name));
          }
        }
      } else if (stat.isFile() && isTextFile(filePath)) {
        await indexFile(filePath);
        indexed++;
      }
    } catch (error) {
      failed++;
      errors.push(`${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await processPath(targetPath);

  return { indexed, failed, errors };
}

/**
 * 索引单个文件
 */
async function indexFile(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();

  let content: string;
  let language: string | undefined;

  if (ext === '.md' || ext === '.markdown') {
    const result = await MarkdownIndexer.indexMarkdown(filePath);
    content = result.content;
    language = result.language;
  } else if (
    ['.js', '.ts', '.jsx', '.tsx', '.vue', '.py', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp'].includes(ext)
  ) {
    const result = await CodeIndexer.indexCode(filePath);
    content = result.content;
    language = result.language;
  } else {
    content = await TextIndexer.indexText(filePath);
  }

  // 创建文档
  const { createDocument } = await import('../services/knowledge-base/document-manager.js');
  await createDocument({
    title: path.basename(filePath),
    content,
    source: 'file',
    metadata: {
      type: 'file',
      filePath,
      language,
    },
  });
}

/**
 * 移除已索引的文件
 */
export async function removeIndexedFile(documentId: string): Promise<void> {
  const { deleteDocument } = await import('../services/knowledge-base/document-manager.js');
  await deleteDocument(documentId);
}

/**
 * 获取忽略规则
 */
export async function getIgnoreRules() {
  return IgnoreRules.getIgnoreConfig();
}

/**
 * 更新忽略规则
 */
export async function updateIgnoreRules(rules: { custom?: string[] }) {
  return IgnoreRules.updateIgnoreConfig(rules);
}
