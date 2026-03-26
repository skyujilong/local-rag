/**
 * ChromaDB vector storage service
 */

import { ChromaClient, Collection } from 'chromadb';
import type {
  SearchResult,
  SearchQuery,
} from '../../shared/types/index.js';
import { DocumentSource } from '../../shared/types/index.js';
import { config } from '../../shared/utils/config.js';
import { logger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/types/index.js';
import { setTimeout } from 'timers/promises';

export class VectorStoreService {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private initialized = false;

  /**
   * Initialize ChromaDB client and collection
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const chromaConfig = config.get('chromadb');

      // Initialize ChromaDB client
      this.client = new ChromaClient({
        path: chromaConfig.path,
      });

      // Get or create collection
      try {
        this.collection = await this.client.getCollection({
          name: chromaConfig.collectionName,
          embeddingFunction: undefined as any,
        });
        logger.info(`Connected to existing collection: ${chromaConfig.collectionName}`);
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: chromaConfig.collectionName,
          metadata: { description: 'Document embeddings for devrag-cli' },
        });
        logger.info(`Created new collection: ${chromaConfig.collectionName}`);
      }

      this.initialized = true;
      logger.info('Vector store initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize vector store', error);
      throw new AppError('Vector store initialization failed', 'VECTORSTORE_INIT_ERROR');
    }
  }

  /**
   * Add document embeddings to the collection
   */
  async addDocumentEmbeddings(
    documentId: string,
    chunks: Array<{ id: string; content: string; embedding: number[]; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const ids = chunks.map((c) => c.id);
      const embeddings = chunks.map((c) => c.embedding);
      const documents = chunks.map((c) => c.content);
      const metadatas = chunks.map((c) => ({
        documentId,
        chunkId: c.id,
        ...c.metadata,
      }));

      await this.collection!.add({
        ids,
        embeddings,
        documents,
        metadatas,
      });

      logger.debug(`Added ${chunks.length} embeddings for document ${documentId}`);
    } catch (error) {
      logger.error(`Failed to add embeddings for document ${documentId}`, error);
      throw new AppError('Failed to add embeddings', 'ADD_EMBEDDINGS_ERROR');
    }
  }

  /**
   * Search for similar documents with timeout protection
   */
  async search(query: SearchQuery, queryEmbedding: number[]): Promise<SearchResult[]> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      // Implement query timeout (5 seconds)
      const queryPromise = this.collection!.query({
        queryEmbeddings: [queryEmbedding],
        nResults: query.topK || 3,
        where: this.buildWhereClause(query.filters),
      });

      const timeoutPromise = setTimeout(5000, null);
      const results = await Promise.race([queryPromise, timeoutPromise]);

      if (!results) {
        throw new AppError('Query timeout after 5 seconds', 'QUERY_TIMEOUT', 504);
      }

      const searchResults: SearchResult[] = [];

      if (results.ids[0] && results.distances != null && results.distances[0] && results.documents[0] && results.metadatas[0]) {
        for (let i = 0; i < results.ids[0].length; i++) {
          const distance = results.distances[0][i] ?? 1;
          const score = 1 - distance; // Convert distance to similarity score

          // Apply threshold if specified
          if (query.threshold !== undefined && score < query.threshold) {
            continue;
          }

          const metadata = results.metadatas[0][i] as Record<string, unknown>;
          searchResults.push({
            documentId: metadata.documentId as string,
            chunkId: metadata.chunkId as string,
            content: results.documents[0][i] || '',
            score,
            metadata: {
              id: metadata.documentId as string,
              title: (metadata.title as string) || 'Untitled',
              source: (metadata.source as DocumentSource) || DocumentSource.API,
              path: metadata.path as string | undefined,
              url: metadata.url as string | undefined,
              tags: metadata.tags as string[] | undefined,
              createdAt: new Date(metadata.createdAt as string),
              updatedAt: new Date(metadata.updatedAt as string),
            },
          });
        }
      }

      return searchResults;
    } catch (error) {
      logger.error('Search failed', error);
      throw new AppError('Search operation failed', 'SEARCH_ERROR');
    }
  }

  /**
   * Delete all embeddings for a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      await this.collection!.delete({
        where: { documentId },
      });

      logger.debug(`Deleted embeddings for document ${documentId}`);
    } catch (error) {
      logger.error(`Failed to delete embeddings for document ${documentId}`, error);
      throw new AppError('Failed to delete embeddings', 'DELETE_EMBEDDINGS_ERROR');
    }
  }

  /**
   * Get document count
   */
  async getDocumentCount(): Promise<number> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const result = await this.collection!.count();
      return result;
    } catch (error) {
      logger.error('Failed to get document count', error);
      return 0;
    }
  }

  /**
   * Get vector count
   */
  async getVectorCount(): Promise<number> {
    return this.getDocumentCount();
  }

  /**
   * Build where clause for filtering
   */
  private buildWhereClause(
    filters?: SearchQuery['filters']
  ): Record<string, unknown> | undefined {
    if (!filters) {
      return undefined;
    }

    const where: Record<string, unknown> = {};

    if (filters.sources && filters.sources.length > 0) {
      where.source = { $in: filters.sources };
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = { $in: filters.tags };
    }

    if (filters.dateRange) {
      where.createdAt = {
        $gte: filters.dateRange.start.toISOString(),
        $lte: filters.dateRange.end.toISOString(),
      };
    }

    return Object.keys(where).length > 0 ? where : undefined;
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.initialized && this.collection !== null;
  }
}

export const vectorStore = new VectorStoreService();
