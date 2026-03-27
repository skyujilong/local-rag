/**
 * Simple in-memory vector store implementation
 * Stores embeddings and performs similarity search using cosine similarity
 */

import type {
  SearchResult,
  SearchQuery,
} from '../../shared/types/index.js';
import { DocumentSource } from '../../shared/types/index.js';
import { config } from '../../shared/utils/config.js';
import { createLogger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/types/index.js';

const log = createLogger('services:simple-vectorstore');

interface VectorEntry {
  id: string;
  documentId: string;
  chunkId: string;
  content: string;
  embedding: number[];
  metadata: {
    title: string;
    source: DocumentSource;
    path?: string;
    url?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
  };
}

export class SimpleVectorStore {
  private vectors: Map<string, VectorEntry> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load from file if exists
      const fs = await import('fs/promises');
      const path = await import('path');

      const dataPath = path.join(process.cwd(), '.devrag', 'vectors.json');

      try {
        const data = await fs.readFile(dataPath, 'utf-8');
        const entries = JSON.parse(data) as VectorEntry[];
        for (const entry of entries) {
          this.vectors.set(entry.id, entry);
        }
        log.info(`Loaded ${this.vectors.size} vectors from ${dataPath}`);
      } catch (error) {
        // File doesn't exist, start fresh
        log.info('Starting with empty vector store');
      }

      this.initialized = true;
      log.info('Simple vector store initialized successfully');
    } catch (error) {
      log.error('Failed to initialize simple vector store', error);
      throw new AppError('Vector store initialization failed', 'VECTORSTORE_INIT_ERROR');
    }
  }

  async addDocumentEmbeddings(
    documentId: string,
    chunks: Array<{ id: string; content: string; embedding: number[]; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      for (const chunk of chunks) {
        const entry: VectorEntry = {
          id: `${documentId}-${chunk.id}`,
          documentId,
          chunkId: chunk.id,
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: {
            title: (chunk.metadata?.title as string) || 'Untitled',
            source: (chunk.metadata?.source as DocumentSource) || DocumentSource.API,
            path: chunk.metadata?.path as string | undefined,
            url: chunk.metadata?.url as string | undefined,
            tags: chunk.metadata?.tags as string[] | undefined,
            createdAt: (chunk.metadata?.createdAt as Date)?.toISOString() || new Date().toISOString(),
            updatedAt: (chunk.metadata?.updatedAt as Date)?.toISOString() || new Date().toISOString(),
          },
        };
        this.vectors.set(entry.id, entry);
      }

      await this.saveToDisk();
      log.debug(`Added ${chunks.length} embeddings for document ${documentId}`);
    } catch (error) {
      log.error(`Failed to add embeddings for document ${documentId}`, error);
      throw new AppError('Failed to add embeddings', 'ADD_EMBEDDINGS_ERROR');
    }
  }

  async search(query: SearchQuery, queryEmbedding: number[]): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const results: Array<{ result: SearchResult; score: number }> = [];

      for (const entry of this.vectors.values()) {
        // Apply filters
        if (query.filters) {
          if (query.filters.sources && query.filters.sources.length > 0) {
            if (!query.filters.sources.includes(entry.metadata.source)) {
              continue;
            }
          }

          if (query.filters.tags && query.filters.tags.length > 0) {
            const entryTags = entry.metadata.tags || [];
            if (!query.filters.tags.some(tag => entryTags.includes(tag))) {
              continue;
            }
          }

          if (query.filters.dateRange) {
            const entryDate = new Date(entry.metadata.createdAt);
            if (entryDate < query.filters.dateRange.start || entryDate > query.filters.dateRange.end) {
              continue;
            }
          }
        }

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(queryEmbedding, entry.embedding);

        // Apply threshold
        if (query.threshold !== undefined && similarity < query.threshold) {
          continue;
        }

        results.push({
          result: {
            documentId: entry.documentId,
            chunkId: entry.chunkId,
            content: entry.content,
            score: similarity,
            metadata: {
              id: entry.documentId,
              title: entry.metadata.title,
              source: entry.metadata.source,
              path: entry.metadata.path,
              url: entry.metadata.url,
              tags: entry.metadata.tags,
              createdAt: new Date(entry.metadata.createdAt),
              updatedAt: new Date(entry.metadata.updatedAt),
            },
          },
          score: similarity,
        });
      }

      // Sort by similarity (descending) and take top K
      results.sort((a, b) => b.score - a.score);
      const topK = query.topK || 5;
      const topResults = results.slice(0, topK);

      log.debug(`Found ${topResults.length} results for query`);
      return topResults.map(r => r.result);
    } catch (error) {
      log.error('Search failed', error);
      throw new AppError('Search operation failed', 'SEARCH_ERROR');
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const keysToDelete: string[] = [];
      for (const [key, entry] of this.vectors.entries()) {
        if (entry.documentId === documentId) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.vectors.delete(key);
      }

      await this.saveToDisk();
      log.debug(`Deleted ${keysToDelete.length} embeddings for document ${documentId}`);
    } catch (error) {
      log.error(`Failed to delete embeddings for document ${documentId}`, error);
      throw new AppError('Failed to delete embeddings', 'DELETE_EMBEDDINGS_ERROR');
    }
  }

  async getDocumentCount(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    const documentIds = new Set<string>();
    for (const entry of this.vectors.values()) {
      documentIds.add(entry.documentId);
    }
    return documentIds.size;
  }

  async getVectorCount(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.vectors.size;
  }

  isReady(): boolean {
    return this.initialized;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  private async saveToDisk(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const dataPath = path.join(process.cwd(), '.devrag', 'vectors.json');
      const dataDir = path.dirname(dataPath);

      // Ensure directory exists
      await fs.mkdir(dataDir, { recursive: true });

      const entries = Array.from(this.vectors.values());
      await fs.writeFile(dataPath, JSON.stringify(entries, null, 2));
    } catch (error) {
      log.warn('Failed to save vectors to disk', error);
    }
  }
}

export const simpleVectorStore = new SimpleVectorStore();
