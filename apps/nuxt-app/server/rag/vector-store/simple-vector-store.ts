/**
 * 简单向量存储 - 基于 JSON 文件
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import type { RAGDocumentChunk } from '@local-rag/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VECTOR_DIR = path.join(__dirname, '../../../data/vector_store');

/**
 * 向量数据结构
 */
interface VectorData {
  documentId: string;
  chunkId: string;
  content: string;
  embedding: number[];
  metadata: any;
}

/**
 * 计算余弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('向量维度不匹配');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 存储向量
 */
export async function store(data: VectorData): Promise<void> {
  await ensureVectorDir();

  const filePath = path.join(VECTOR_DIR, `${data.documentId}.json`);

  let vectors: VectorData[] = [];

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    vectors = JSON.parse(content);
  } catch {
    // 文件不存在，创建新数组
  }

  vectors.push(data);

  await fs.writeFile(filePath, JSON.stringify(vectors, null, 2), 'utf-8');
}

/**
 * 搜索相似向量
 */
export async function search(options: {
  embedding: number[];
  topK: number;
  threshold: number;
}): Promise<RAGDocumentChunk[]> {
  await ensureVectorDir();

  const files = await fs.readdir(VECTOR_DIR);
  const results: Array<{ vector: VectorData; score: number }> = [];

  // 读取所有向量文件并计算相似度
  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    try {
      const content = await fs.readFile(path.join(VECTOR_DIR, file), 'utf-8');
      const vectors: VectorData[] = JSON.parse(content);

      for (const vector of vectors) {
        const score = cosineSimilarity(options.embedding, vector.embedding);

        if (score >= options.threshold) {
          results.push({
            vector,
            score,
          });
        }
      }
    } catch (error) {
      console.error(`读取向量文件 ${file} 失败:`, error);
    }
  }

  // 按相似度排序并返回 topK
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, options.topK).map(r => ({
    documentId: r.vector.documentId,
    chunkId: r.vector.chunkId,
    content: r.vector.content,
    score: r.score,
    metadata: r.vector.metadata,
  }));
}

/**
 * 删除文档的所有向量
 */
export async function deleteDocument(documentId: string): Promise<void> {
  await ensureVectorDir();

  const filePath = path.join(VECTOR_DIR, `${documentId}.json`);

  try {
    await fs.unlink(filePath);
  } catch {
    // 文件不存在，忽略
  }
}

/**
 * 清空所有向量
 */
export async function clear(): Promise<void> {
  await ensureVectorDir();

  const files = await fs.readdir(VECTOR_DIR);

  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        await fs.unlink(path.join(VECTOR_DIR, file));
      } catch (error) {
        console.error(`删除向量文件 ${file} 失败:`, error);
      }
    }
  }
}

/**
 * 确保向量目录存在
 */
async function ensureVectorDir() {
  try {
    await fs.access(VECTOR_DIR);
  } catch {
    await fs.mkdir(VECTOR_DIR, { recursive: true });
  }
}
