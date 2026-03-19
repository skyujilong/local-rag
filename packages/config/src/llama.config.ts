import type { LlamaConfig } from '@local-rag/shared/types';

export function getLlamaConfig(): LlamaConfig {
  return {
    embeddings: {
      provider: (process.env.EMBEDDINGS_PROVIDER as 'ollama' | 'openai' | 'local') || 'ollama',
      model: process.env.OLLAMA_MODEL || 'nomic-embed-text',
      dimension: parseInt(process.env.EMBEDDING_DIMENSION || '768'),
      batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE || '32'),
    },
    vectorStore: {
      type: (process.env.VECTOR_STORE_TYPE as 'chroma' | 'simple') || 'simple',
      path: process.env.VECTOR_STORE_PATH || './apps/api/data/vector_store',
      collectionName: process.env.VECTOR_COLLECTION_NAME || 'local_rag',
    },
    retrieval: {
      topK: parseInt(process.env.TOP_K || '5'),
      similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
      searchType: (process.env.SEARCH_TYPE as 'dense' | 'sparse' | 'hybrid') || 'hybrid',
    },
    chunking: {
      chunkSize: parseInt(process.env.CHUNK_SIZE || '512'),
      chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '50'),
      splitter: (process.env.CHUNK_SPLITTER as 'sentence' | 'paragraph' | 'token') || 'sentence',
    },
  };
}
