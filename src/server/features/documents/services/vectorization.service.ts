/**
 * Vectorization Service - 向量化服务
 *
 * 负责将文档分块向量化并存储到向量数据库
 */

import type { Chunk } from '../../../../shared/types/documents.js';
import { createLogger } from '../../../../shared/utils/logger.js';
import { embeddingService } from '../../services/embeddings.js';
import { vectorStore } from '../../services/vectorstore.js';

const log = createLogger('features:documents:vectorization');

/**
 * Vectorization Service 类
 */
export class VectorizationService {
  /**
   * 向量化文档分块
   */
  async vectorizeChunks(
    documentId: string,
    title: string,
    chunks: Chunk[],
    tags: string[]
  ): Promise<void> {
    log.debug(`开始向量化: ${documentId}, ${chunks.length} chunks`);

    try {
      // 批量生成向量
      const chunkTexts = chunks.map((c) => c.content);
      const embeddings = await embeddingService.embedBatch(chunkTexts);

      // 准备向量数据库数据
      const embeddingData = chunks.map((chunk, index) => {
        const metadata: Record<string, unknown> = {
          filePath: chunk.metadata.filePath,
          chunkIndex: chunk.metadata.chunkIndex,
          documentId,
          title,
          tags,
          createdAt: new Date().toISOString(),
          sectionTitle: chunk.metadata.sectionTitle,
          isCodeBlock: chunk.metadata.isCodeBlock,
        };

        return {
          id: chunk.id,
          content: chunk.content,
          embedding: embeddings[index],
          metadata,
        };
      });

      // 添加到向量存储
      await vectorStore.addDocumentEmbeddings(documentId, embeddingData);

      log.debug(`向量化完成: ${documentId}`);
    } catch (error) {
      log.error(`向量化失败: ${documentId}`, error);
      throw error;
    }
  }

  /**
   * 删除文档的向量
   */
  async deleteDocumentVectors(documentId: string): Promise<void> {
    log.debug(`删除向量: ${documentId}`);

    try {
      await vectorStore.deleteDocument(documentId);
      log.debug(`向量删除完成: ${documentId}`);
    } catch (error) {
      log.error(`删除向量失败: ${documentId}`, error);
      throw error;
    }
  }
}

// 导出单例
export const vectorizationService = new VectorizationService();
