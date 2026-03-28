/**
 * Search Service - 混合查询策略服务
 *
 * 实现两阶段查询 + 智能降级的混合搜索策略
 */

import type {
  SearchResult,
  SearchRequest,
  SearchResponse,
} from '../../../../shared/types/documents.js';
import { createLogger } from '../../../../shared/utils/logger.js';
import { embeddingService } from '../../services/embeddings.js';
import { vectorStore } from '../../services/vectorstore.js';
import { notesService } from './notes.service.js';

const log = createLogger('features:documents:search');

/**
 * 搜索配置
 */
const SEARCH_CONFIG = {
  defaultLimit: 10,         // 默认返回结果数
  stage1Limit: 10,          // 阶段1 返回结果数
  stage2Limit: 20,          // 阶段2 返回结果数
  fallbackThreshold: 3,     // 降级触发：最小结果数
  scoreThreshold: 0.7,      // 降级触发：最低分数
  filteredBoost: 1.2,       // 过滤结果加权
} as const;

/**
 * Search Service 类
 */
export class SearchService {
  /**
   * 混合搜索 - 两阶段查询 + 智能降级
   */
  async hybridSearch(request: SearchRequest): Promise<SearchResponse> {
    const startTime = Date.now();
    const limit = request.limit || SEARCH_CONFIG.defaultLimit;
    const hasTags = request.tags && request.tags.length > 0;

    log.debug(`开始混合搜索: "${request.query}", tags: [${request.tags?.join(', ') || '无'}]`);

    // 提前生成查询向量，避免在多个搜索阶段中重复调用 embedding API
    const queryEmbedding = await embeddingService.embed(request.query);

    let finalResults: SearchResult[];
    let strategy: 'filtered' | 'hybrid' | 'full';
    let stage1Results = 0;
    let stage2Triggered = false;

    if (hasTags) {
      // 阶段 1: 标签预过滤 + 向量搜索
      const stage1Data = await this.stage1FilteredSearch(queryEmbedding, request.tags!);
      stage1Results = stage1Data.length;
      const shouldFallback = this.checkFallback(stage1Data);

      if (!shouldFallback) {
        // 不需要降级，直接返回阶段1结果
        finalResults = await this.mergeChunkResults(stage1Data, limit);
        strategy = 'filtered';
      } else {
        // 需要降级，执行阶段2全量搜索
        log.debug('触发降级: 阶段1结果不足，执行阶段2全量搜索');
        stage2Triggered = true;

        const stage2Data = await this.stage2FullSearch(queryEmbedding, limit);

        // 合并阶段1和阶段2结果，再转换为文档级别
        const mergedChunks = this.mergeAndDedupeResults(stage1Data, stage2Data, limit);
        finalResults = await this.mergeChunkResults(mergedChunks, limit);
        strategy = 'hybrid';
      }
    } else {
      // 无标签，直接执行全量搜索
      const stage2Data = await this.stage2FullSearch(queryEmbedding, limit);
      finalResults = await this.mergeChunkResults(stage2Data, limit);
      strategy = 'full';
    }

    const totalTime = Date.now() - startTime;

    log.debug(`搜索完成: ${finalResults.length} results, 耗时: ${totalTime}ms, 策略: ${strategy}`);

    return {
      query: request.query,
      strategy,
      data: {
        total: finalResults.length,
        results: finalResults,
      },
      meta: {
        stage1Results,
        stage2Triggered,
        totalTime,
      },
    };
  }

  /**
   * 阶段1: 标签预过滤 + 向量搜索
   * @param queryEmbedding 预计算的查询向量（由 hybridSearch 统一生成，避免重复调用）
   */
  private async stage1FilteredSearch(
    queryEmbedding: number[],
    tags: string[]
  ): Promise<Array<{ documentId: string; chunkId: string; content: string; score: number }>> {
    log.debug(`阶段1: 标签预过滤 + 向量搜索, tags: [${tags.join(', ')}]`);

    try {
      // 使用标签过滤进行向量搜索
      const results = await vectorStore.search(
        {
          query: '', // Query text is not used when embedding is provided
          topK: SEARCH_CONFIG.stage1Limit,
          filters: {
            tags, // ChromaDB metadata 过滤
          },
        },
        queryEmbedding
      );

      return results.map((result) => ({
        documentId: result.documentId,
        chunkId: result.chunkId,
        content: result.content,
        score: result.score,
      }));
    } catch (error) {
      log.error('阶段1搜索失败:', error);
      return [];
    }
  }

  /**
   * 阶段2: 全量向量搜索
   * @param queryEmbedding 预计算的查询向量（由 hybridSearch 统一生成，避免重复调用）
   */
  private async stage2FullSearch(
    queryEmbedding: number[],
    _limit: number
  ): Promise<Array<{ documentId: string; chunkId: string; content: string; score: number }>> {
    log.debug('阶段2: 全量向量搜索');

    try {
      // 全量向量搜索
      const results = await vectorStore.search(
        {
          query: '', // Query text is not used when embedding is provided
          topK: SEARCH_CONFIG.stage2Limit,
        },
        queryEmbedding
      );

      return results.map((result) => ({
        documentId: result.documentId,
        chunkId: result.chunkId,
        content: result.content,
        score: result.score,
      }));
    } catch (error) {
      log.error('阶段2搜索失败:', error);
      return [];
    }
  }

  /**
   * 检查是否需要降级
   */
  private checkFallback(
    results: Array<{ score: number }>
  ): boolean {
    if (results.length < SEARCH_CONFIG.fallbackThreshold) {
      return true; // 结果数量不足
    }

    if (results[0]?.score < SEARCH_CONFIG.scoreThreshold) {
      return true; // 最高分数太低
    }

    if (results.every((r) => r.score < 0.5)) {
      return true; // 所有结果分数都太低
    }

    return false;
  }

  /**
   * 合并和去重结果
   */
  private mergeAndDedupeResults(
    stage1: Array<{ documentId: string; chunkId: string; content: string; score: number }>,
    stage2: Array<{ documentId: string; chunkId: string; content: string; score: number }>,
    limit: number
  ): Array<{ documentId: string; chunkId: string; content: string; score: number }> {
    // 去重（按 chunkId）
    const seen = new Set(stage1.map((r) => r.chunkId));
    const additional = stage2.filter((r) => !seen.has(r.chunkId));

    // 加权（阶段1结果权重更高）
    const weighted = [
      ...stage1.map((r) => ({ ...r, boost: SEARCH_CONFIG.filteredBoost, source: 'filtered' as const })),
      ...additional.map((r) => ({ ...r, boost: 1.0, source: 'fuzzy' as const })),
    ];

    // 按加权分数排序
    const sorted = weighted
      .sort((a, b) => (b.score * b.boost) - (a.score * a.boost))
      .slice(0, limit);

    return sorted.map(({ boost, source, ...rest }) => rest);
  }

  /**
   * 合并同一文档的多个 chunk 结果
   */
  private async mergeChunkResults(
    chunkResults: Array<{ documentId: string; chunkId: string; content: string; score: number }>,
    limit: number
  ): Promise<SearchResult[]> {
    // 按文档 ID 分组
    const docGroups = new Map<string, Array<{
      chunkId: string;
      content: string;
      score: number;
    }>>();

    for (const chunk of chunkResults) {
      if (!docGroups.has(chunk.documentId)) {
        docGroups.set(chunk.documentId, []);
      }
      docGroups.get(chunk.documentId)!.push({
        chunkId: chunk.chunkId,
        content: chunk.content,
        score: chunk.score,
      });
    }

    // 为每个文档构建 SearchResult（并发获取笔记信息）
    const noteEntries = await Promise.all(
      Array.from(docGroups.entries()).map(async ([documentId, chunks]) => {
        const note = await notesService.getNote(documentId);
        return { documentId, chunks, note };
      })
    );

    const results: SearchResult[] = [];
    for (const { documentId, chunks, note } of noteEntries) {
      if (!note) {
        log.warn(`文档不存在: ${documentId}`);
        continue;
      }

      // 按分数排序 chunks
      const sortedChunks = chunks.sort((a, b) => b.score - a.score);

      // 取最高分作为聚合分数
      const aggregatedScore = sortedChunks[0].score;

      // 取 Top-3 chunks 作为高亮
      const topChunks = sortedChunks.slice(0, 3);

      results.push({
        documentId,
        document: note,
        aggregatedScore,
        matchedChunks: topChunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          content: chunk.content,
          score: chunk.score,
          highlight: this.generateHighlight(chunk.content),
        })),
      });
    }

    // 按聚合分数排序
    results.sort((a, b) => b.aggregatedScore - a.aggregatedScore);

    return results.slice(0, limit);
  }

  /**
   * 生成高亮片段
   */
  private generateHighlight(content: string, maxLength: number = 200): string {
    // 移除 Markdown 语法
    const plainText = content
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    return plainText.slice(0, maxLength) + (plainText.length > maxLength ? '...' : '');
  }
}

// 导出单例
export const searchService = new SearchService();
