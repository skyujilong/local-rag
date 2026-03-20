/**
 * Ollama 嵌入向量生成
 */

import { getLlamaConfig } from '@local-rag/config/llama';

let embeddingCache = new Map<string, number[]>();

/**
 * 生成单个文本的嵌入向量
 */
export async function embed(text: string): Promise<number[]> {
  // 检查缓存
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text)!;
  }

  const config = getLlamaConfig();
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.embeddings.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API 错误: ${response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.embedding;

    // 缓存结果
    embeddingCache.set(text, embedding);

    // 限制缓存大小
    if (embeddingCache.size > 1000) {
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }

    return embedding;
  } catch (error) {
    console.error('生成嵌入向量失败:', error);
    throw error;
  }
}

/**
 * 批量生成嵌入向量
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const config = getLlamaConfig();
  const results: number[][] = [];

  // 分批处理
  for (let i = 0; i < texts.length; i += config.embeddings.batchSize) {
    const batch = texts.slice(i, i + config.embeddings.batchSize);
    const embeddings = await Promise.all(
      batch.map(text => embed(text))
    );
    results.push(...embeddings);
  }

  return results;
}

/**
 * 清空缓存
 */
export function clearCache(): void {
  embeddingCache.clear();
}
