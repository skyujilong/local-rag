/**
 * Vector storage service - factory pattern supporting multiple backends
 */

import type {
  SearchResult,
  SearchQuery,
} from '../../shared/types/index.js';
import { createLogger } from '../../shared/utils/logger.js';
import { AppError } from '../../shared/types/index.js';
import { simpleVectorStore, type SimpleVectorStore } from './simple-vectorstore.js';

const log = createLogger('services:vectorstore');

export class VectorStoreService {
  private initialized = false;
  private backend: SimpleVectorStore;

  constructor() {
    // For now, always use simple vector store
    // ChromaDB integration can be added later if needed
    this.backend = simpleVectorStore;
  }

  /**
   * Initialize vector store
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.backend.initialize();
      this.initialized = true;
      log.info('Vector store initialized successfully');
    } catch (error) {
      log.error('Failed to initialize vector store', error);
      throw new AppError('Vector store initialization failed', 'VECTORSTORE_INIT_ERROR');
    }
  }

  /**
   * Add document embeddings to the store
   */
  async addDocumentEmbeddings(
    documentId: string,
    chunks: Array<{ id: string; content: string; embedding: number[]; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.backend.addDocumentEmbeddings(documentId, chunks);
      log.debug(`Added ${chunks.length} embeddings for document ${documentId}`);
    } catch (error) {
      log.error(`Failed to add embeddings for document ${documentId}`, error);
      throw new AppError('Failed to add embeddings', 'ADD_EMBEDDINGS_ERROR');
    }
  }

  /**
   * Search for similar documents
   */
  async search(query: SearchQuery, queryEmbedding: number[]): Promise<SearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const results = await this.backend.search(query, queryEmbedding);
      return results;
    } catch (error) {
      log.error('Search failed', error);
      throw new AppError('Search operation failed', 'SEARCH_ERROR');
    }
  }

  /**
   * Delete all embeddings for a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.backend.deleteDocument(documentId);
      log.debug(`Deleted embeddings for document ${documentId}`);
    } catch (error) {
      log.error(`Failed to delete embeddings for document ${documentId}`, error);
      throw new AppError('Failed to delete embeddings', 'DELETE_EMBEDDINGS_ERROR');
    }
  }

  /**
   * Get document count
   */
  async getDocumentCount(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.backend.getDocumentCount();
    } catch (error) {
      log.error('Failed to get document count', error);
      return 0;
    }
  }

  /**
   * Get vector count
   */
  async getVectorCount(): Promise<number> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      return await this.backend.getVectorCount();
    } catch (error) {
      log.error('Failed to get vector count', error);
      return 0;
    }
  }

  /**
   * Check if initialized
   */
  isReady(): boolean {
    return this.initialized;
  }
}

export const vectorStore = new VectorStoreService();
