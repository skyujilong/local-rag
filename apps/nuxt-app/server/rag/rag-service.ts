/**
 * RAG 服务 - 主要的查询和索引逻辑
 */

import type { Document, RAGQuery, RAGResult } from '@local-rag/shared/types';
import { getLlamaConfig } from '@local-rag/config/llama';
import * as VectorStore from './vector-store/index.js';
import * as Embeddings from './embeddings/index.js';
import * as DocumentManager from '../services/knowledge-base/document-manager.js';

/**
 * RAG 查询
 */
export async function query(queryParams: RAGQuery): Promise<RAGResult> {
  const startTime = Date.now();

  const config = getLlamaConfig();

  // 生成查询向量
  const queryEmbedding = await Embeddings.embed(queryParams.query);

  // 检索相关文档
  const searchResults = await VectorStore.search({
    embedding: queryEmbedding,
    topK: queryParams.topK || config.retrieval.topK,
    threshold: queryParams.threshold || config.retrieval.similarityThreshold,
  });

  const queryTime = Date.now() - startTime;

  return {
    query: queryParams.query,
    results: searchResults,
    totalResults: searchResults.length,
    queryTime,
  };
}

/**
 * 索引文档
 */
export async function indexDocument(document: Document): Promise<void> {
  const config = getLlamaConfig();

  // 分块
  const chunks = await splitDocument(document, config.chunking.chunkSize, config.chunking.chunkOverlap);

  // 为每个块生成嵌入向量并存储
  for (const chunk of chunks) {
    const embedding = await Embeddings.embed(chunk.content);
    await VectorStore.store({
      documentId: document.id,
      chunkId: chunk.chunkId,
      content: chunk.content,
      embedding,
      metadata: document.metadata,
    });
  }
}

/**
 * 从索引中删除文档
 */
export async function removeFromIndex(documentId: string): Promise<void> {
  await VectorStore.deleteDocument(documentId);
}

/**
 * 重建索引
 */
export async function rebuildIndex(): Promise<void> {
  // 清空向量存储
  await VectorStore.clear();

  // 重新索引所有文档
  const { items: documents } = await DocumentManager.listDocuments({ page: 1, pageSize: 10000 });

  for (const doc of documents) {
    await indexDocument(doc);
  }
}

/**
 * 分割文档为块
 */
async function splitDocument(
  document: Document,
  chunkSize: number,
  chunkOverlap: number
): Promise<Array<{ chunkId: string; content: string }>> {
  const chunks: Array<{ chunkId: string; content: string }> = [];

  // 简单的句子分割
  const sentences = document.content.match(/[^.!?。！？]+[.!?。！？]*/g) || [document.content];

  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push({
        chunkId: `${document.id}_chunk${chunkIndex}`,
        content: currentChunk.trim(),
      });
      chunkIndex++;

      // 保留重叠部分
      const overlapSentences = currentChunk.split(' ').slice(-chunkOverlap / 10).join(' ');
      currentChunk = overlapSentences + ' ' + sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }

  // 添加最后一个块
  if (currentChunk.trim().length > 0) {
    chunks.push({
      chunkId: `${document.id}_chunk${chunkIndex}`,
      content: currentChunk.trim(),
    });
  }

  return chunks;
}
