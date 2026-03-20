/**
 * 查询处理管道
 */

import type { RAGQuery, RAGResult } from '@local-rag/shared/types';
import { query } from '../rag-service.js';

/**
 * 处理 RAG 查询
 */
export async function processQuery(queryParams: RAGQuery): Promise<RAGResult> {
  // 预处理查询
  const processedQuery = preprocessQuery(queryParams.query);

  // 执行查询
  const result = await query({
    ...queryParams,
    query: processedQuery,
  });

  // 后处理结果
  return postprocessResult(result);
}

/**
 * 预处理查询
 */
function preprocessQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * 后处理结果
 */
function postprocessResult(result: RAGResult): RAGResult {
  // 过滤低分结果
  const filteredResults = result.results.filter(r => r.score > 0.3);

  return {
    ...result,
    results: filteredResults,
    totalResults: filteredResults.length,
  };
}
