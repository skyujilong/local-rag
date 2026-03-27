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
import { createLogger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/types/index.js';
import { setTimeout } from 'timers/promises';

const log = createLogger('services:vectorstore');

/**
 * No-op embedding function for ChromaDB when using pre-computed embeddings
 * ChromaDB requires an embedding function, but we provide embeddings directly
 */
class NoOpEmbeddingFunction {
  async generate(_texts: string[]): Promise<number[][]> {
    throw new Error(
      'NoOpEmbeddingFunction should not be called. ' +
      'Embeddings must be provided directly in add/query operations.'
    );
  }
}

const noOpEmbeddingFunction = new NoOpEmbeddingFunction();

export class VectorStoreService {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private isShuttingDown = false;

  /**
   * Initialize ChromaDB client and collection with retry logic
   */
  async initialize(): Promise<void> {
    // Prevent initialization during shutdown
    if (this.isShuttingDown) {
      throw new AppError(
        'Cannot initialize vector store during shutdown',
        'VECTORSTORE_SHUTDOWN'
      );
    }

    // Return existing initialization promise if in progress
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return early if already initialized
    if (this.initialized) {
      return;
    }

    // Create new initialization promise
    this.initializationPromise = this.initializeWithRetry();

    try {
      await this.initializationPromise;
    } finally {
      // Clear the promise after completion (whether success or failure)
      this.initializationPromise = null;
    }
  }

  /**
   * Initialize with exponential backoff retry mechanism
   */
  private async initializeWithRetry(): Promise<void> {
    const chromaConfig = config.get('chromadb');
    const maxAttempts = chromaConfig.initRetryMaxAttempts;
    const baseDelay = chromaConfig.initRetryDelay;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.doInitialize(chromaConfig);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxAttempts) {
          // Exponential backoff: delay * 2^(attempt-1)
          const delay = baseDelay * Math.pow(2, attempt - 1);
          log.warn(
            `Initialization attempt ${attempt}/${maxAttempts} failed. ` +
            `Retrying in ${delay}ms...`,
            { error: lastError.message, url: chromaConfig.path }
          );
          await setTimeout(delay);
        } else {
          log.error(
            `Initialization failed after ${maxAttempts} attempts`,
            { error: lastError, url: chromaConfig.path }
          );
        }
      }
    }

    // All retries exhausted
    throw new AppError(
      `Vector store initialization failed after ${maxAttempts} attempts: ${lastError?.message}`,
      'VECTORSTORE_INIT_ERROR',
      503,
      { url: chromaConfig.path, attempts: maxAttempts }
    );
  }

  /**
   * Perform the actual initialization
   */
  private async doInitialize(chromaConfig: {
    path: string;
    collectionName: string;
  }): Promise<void> {
    log.info('Initializing ChromaDB client', { url: chromaConfig.path });

    // Initialize ChromaDB client
    // Note: ChromaDB JavaScript client requires a running ChromaDB server
    // The path should be an HTTP URL (e.g., http://localhost:8000)
    // For local development, you need to start ChromaDB server first:
    // - Docker: docker run -p 8000:8000 chromadb/chroma
    // - Python: pip install chromadb && chroma-server --port 8000
    this.client = new ChromaClient({
      path: chromaConfig.path,
    });

    // Get or create collection
    try {
      // Use getCollection with no-op embedding function
      // We provide pre-computed embeddings directly in add/query operations
      this.collection = await this.client.getCollection({
        name: chromaConfig.collectionName,
        embeddingFunction: noOpEmbeddingFunction,
      });
      log.info(`Connected to existing collection: ${chromaConfig.collectionName}`);
    } catch (error) {
      // Collection doesn't exist, create it
      log.info(`Collection not found, creating new collection: ${chromaConfig.collectionName}`);
      this.collection = await this.client.createCollection({
        name: chromaConfig.collectionName,
        metadata: { description: 'Document embeddings for devrag-cli' },
        embeddingFunction: noOpEmbeddingFunction,
      });
      log.info(`Created new collection: ${chromaConfig.collectionName}`);
    }

    this.initialized = true;
    log.info('Vector store initialized successfully', { url: chromaConfig.path });
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

      log.debug(`Added ${chunks.length} embeddings for document ${documentId}`);
    } catch (error) {
      log.error(
        `Failed to add embeddings for document ${documentId}`,
        error,
        { chunkCount: chunks.length }
      );
      throw new AppError(
        `Failed to add embeddings for document ${documentId}: ${error instanceof Error ? error.message : String(error)}`,
        'ADD_EMBEDDINGS_ERROR',
        500,
        { documentId, chunkCount: chunks.length }
      );
    }
  }

  /**
   * Search for similar documents with configurable timeout protection
   */
  async search(query: SearchQuery, queryEmbedding: number[]): Promise<SearchResult[]> {
    if (!this.collection) {
      await this.initialize();
    }

    try {
      const chromaConfig = config.get('chromadb');
      const timeoutMs = chromaConfig.queryTimeout;

      log.debug('Executing vector search', {
        topK: query.topK,
        threshold: query.threshold,
        timeout: timeoutMs,
      });

      // Implement query timeout with configurable value
      const queryPromise = this.collection!.query({
        queryEmbeddings: [queryEmbedding],
        nResults: query.topK || 3,
        where: this.buildWhereClause(query.filters),
      });

      const timeoutPromise = setTimeout(timeoutMs, null);
      const results = await Promise.race([queryPromise, timeoutPromise]);

      if (!results) {
        throw new AppError(
          `Query timeout after ${timeoutMs}ms`,
          'QUERY_TIMEOUT',
          504,
          { timeout: timeoutMs, topK: query.topK }
        );
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

      log.debug(`Search completed with ${searchResults.length} results`);
      return searchResults;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      log.error(
        'Search operation failed',
        error,
        { topK: query.topK, threshold: query.threshold }
      );
      throw new AppError(
        `Search operation failed: ${error instanceof Error ? error.message : String(error)}`,
        'SEARCH_ERROR',
        500,
        { topK: query.topK, threshold: query.threshold }
      );
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

      log.debug(`Deleted embeddings for document ${documentId}`);
    } catch (error) {
      log.error(
        `Failed to delete embeddings for document ${documentId}`,
        error
      );
      throw new AppError(
        `Failed to delete embeddings for document ${documentId}: ${error instanceof Error ? error.message : String(error)}`,
        'DELETE_EMBEDDINGS_ERROR',
        500,
        { documentId }
      );
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
      log.error('Failed to get document count', error);
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
   * Check if initialized (synchronous check)
   */
  isReady(): boolean {
    return this.initialized && this.collection !== null;
  }

  /**
   * Check if the service is healthy (async check with actual connection test)
   */
  async isHealthy(): Promise<boolean> {
    if (!this.initialized || !this.client || !this.collection) {
      return false;
    }

    try {
      // Perform a simple count operation to verify connection
      await this.collection.count();
      return true;
    } catch (error) {
      log.warn('Health check failed', error);
      return false;
    }
  }

  /**
   * Shutdown the vector store service gracefully
   */
  async shutdown(): Promise<void> {
    log.info('Shutting down vector store service');
    this.isShuttingDown = true;

    // Wait for any pending initialization to complete
    if (this.initializationPromise) {
      try {
        await this.initializationPromise;
      } catch (error) {
        log.warn('Initialization failed during shutdown', error);
      }
    }

    // Clear resources
    this.collection = null;
    this.client = null;
    this.initialized = false;

    log.info('Vector store service shutdown complete');
  }
}

export const vectorStore = new VectorStoreService();
