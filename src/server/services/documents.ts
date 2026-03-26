/**
 * Document processing service
 */

import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises';
import { join, extname, resolve, normalize, basename, dirname } from 'path';
import type {
  Document,
  DocumentMetadata,
  ImportOptions,
  VectorizationProgress,
} from '../../shared/types/index.js';
import {
  DocumentSource,
  DocumentStatus,
  VectorizationStatus,
  VectorizationError,
  DocumentNotFoundError,
} from '../../shared/types/index.js';
import { logger } from '../../shared/utils/logger.js';
import { splitText, extractTitle, extractTags, countWords, detectLanguage } from '../../shared/utils/text.js';
import { embeddingService } from './embeddings.js';
import { vectorStore } from './vectorstore.js';

// Metadata storage file path
const METADATA_STORAGE_PATH = join(process.cwd(), '.devrag', 'documents-metadata.json');

export class DocumentService {
  private documents: Map<string, Document> = new Map();
  private processingQueue: Map<string, VectorizationProgress> = new Map();
  private metadataLoaded = false;

  constructor() {
    // Load metadata on initialization
    this.loadDocumentMetadata().catch((error) => {
      logger.warn('Failed to load document metadata on startup:', error);
    });
  }

  /**
   * Import a single markdown file with path traversal protection
   */
  async importMarkdownFile(
    filePath: string,
    options: ImportOptions = {}
  ): Promise<Document> {
    try {
      // Resolve and normalize the file path
      const resolvedPath = resolve(filePath);
      const normalizedPath = normalize(resolvedPath);

      // Get allowed directory (current working directory or configured directory)
      const allowedDir = resolve(process.cwd());

      // Check if path is within allowed directory
      if (!normalizedPath.startsWith(allowedDir)) {
        throw new Error(`Access denied: path outside allowed directory (${allowedDir})`);
      }

      // Additional security check: ensure the file exists and is readable
      try {
        await stat(resolvedPath);
      } catch (error) {
        throw new Error(`File not found or not accessible: ${resolvedPath}`);
      }

      const content = await readFile(resolvedPath, 'utf-8');
      const fileName = basename(resolvedPath);

      // Create document metadata
      const metadata: DocumentMetadata = {
        id: this.generateId(),
        title: extractTitle(content) || fileName,
        source: DocumentSource.MARKDOWN,
        path: filePath,
        tags: options.tags || extractTags(content),
        createdAt: new Date(),
        updatedAt: new Date(),
        language: detectLanguage(content),
        wordCount: countWords(content),
      };

      // Create document
      const document: Document = {
        metadata,
        content,
        chunks: [],
        status: DocumentStatus.PENDING,
        vectorizationStatus: VectorizationStatus.PENDING,
      };

      this.documents.set(metadata.id, document);

      // Save metadata to persistent storage
      await this.saveDocumentMetadata();

      // Start vectorization
      await this.vectorizeDocument(metadata.id, options);

      return document;
    } catch (error) {
      logger.error(`Failed to import markdown file: ${filePath}`, error);
      throw new Error(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Import all markdown files from a directory
   */
  async importMarkdownDirectory(
    dirPath: string,
    options: ImportOptions = {}
  ): Promise<Document[]> {
    const files = await readdir(dirPath);
    const markdownFiles = files.filter((f) => extname(f) === '.md');

    logger.info(`Found ${markdownFiles.length} markdown files in ${dirPath}`);

    const documents: Document[] = [];

    for (const file of markdownFiles) {
      const fullPath = join(dirPath, file);
      try {
        const doc = await this.importMarkdownFile(fullPath, options);
        documents.push(doc);
      } catch (error) {
        if (!options.skipErrors) {
          throw error;
        }
        logger.warn(`Skipped file due to error: ${file}`);
      }
    }

    return documents;
  }

  /**
   * Import Obsidian vault
   */
  async importObsidianVault(
    vaultPath: string,
    options: ImportOptions = {}
  ): Promise<Document[]> {
    const documents: Document[] = [];

    // Recursively find all markdown files
    const markdownFiles = await this.findMarkdownFiles(vaultPath);

    logger.info(`Found ${markdownFiles.length} files in Obsidian vault: ${vaultPath}`);

    for (const filePath of markdownFiles) {
      try {
        const doc = await this.importMarkdownFile(filePath, {
          ...options,
          tags: [...(options.tags || []), 'obsidian'],
        });
        documents.push(doc);
      } catch (error) {
        if (!options.skipErrors) {
          throw error;
        }
        logger.warn(`Skipped file due to error: ${filePath}`);
      }
    }

    return documents;
  }

  /**
   * Add document from text content
   */
  async addDocumentFromText(
    content: string,
    title: string,
    options: ImportOptions = {}
  ): Promise<Document> {
    const metadata: DocumentMetadata = {
      id: this.generateId(),
      title,
      source: DocumentSource.API,
      tags: options.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      language: detectLanguage(content),
      wordCount: countWords(content),
    };

    const document: Document = {
      metadata,
      content,
      chunks: [],
      status: DocumentStatus.PENDING,
      vectorizationStatus: VectorizationStatus.PENDING,
    };

    this.documents.set(metadata.id, document);

    // Save metadata to persistent storage
    await this.saveDocumentMetadata();

    // Start vectorization
    await this.vectorizeDocument(metadata.id, options);

    return document;
  }

  /**
   * Vectorize a document with adaptive chunking strategy
   */
  private async vectorizeDocument(documentId: string, options: ImportOptions = {}): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    // Determine optimal chunk size based on document type
    const chunkSize = options.chunkSize || this.getOptimalChunkSize(document);
    const chunkOverlap = options.chunkOverlap || Math.floor(chunkSize * 0.2);

    // Update status
    document.status = DocumentStatus.PROCESSING;
    document.vectorizationStatus = VectorizationStatus.IN_PROGRESS;

    try {
      // Split text into chunks
      const textChunks = splitText(document.content, chunkSize, chunkOverlap);

      // Create chunk objects
      document.chunks = textChunks.map((chunk) => ({
        id: this.generateId(),
        documentId,
        content: chunk.content,
        chunkIndex: chunk.index,
        startPosition: chunk.start,
        endPosition: chunk.end,
        metadata: {
          title: document.metadata.title,
          source: document.metadata.source,
        },
      }));

      // Create progress tracker
      const progress: VectorizationProgress = {
        documentId,
        documentTitle: document.metadata.title,
        totalChunks: document.chunks.length,
        processedChunks: 0,
        status: VectorizationStatus.IN_PROGRESS,
        startTime: new Date(),
      };

      this.processingQueue.set(documentId, progress);

      // Generate embeddings
      const chunkTexts = document.chunks.map((c) => c.content);
      const embeddings = await embeddingService.embedBatch(chunkTexts);

      // Prepare data for vector store
      const embeddingData = document.chunks.map((chunk, index) => ({
        id: chunk.id,
        content: chunk.content,
        embedding: embeddings[index],
        metadata: {
          documentId,
          chunkId: chunk.id,
          title: document.metadata.title,
          source: document.metadata.source,
          path: document.metadata.path,
          url: document.metadata.url,
          tags: document.metadata.tags,
          createdAt: document.metadata.createdAt.toISOString(),
          updatedAt: document.metadata.updatedAt.toISOString(),
        },
      }));

      // Add to vector store
      await vectorStore.addDocumentEmbeddings(documentId, embeddingData);

      // Update progress
      progress.processedChunks = progress.totalChunks;
      progress.status = VectorizationStatus.COMPLETED;
      progress.estimatedCompletion = new Date();

      document.vectorizationStatus = VectorizationStatus.COMPLETED;
      document.status = DocumentStatus.COMPLETED;

      // Notify progress callback
      if (options.onProgress) {
        options.onProgress(progress);
      }

      logger.info(`Document vectorized: ${document.metadata.title} (${document.chunks.length} chunks)`);
    } catch (error) {
      document.vectorizationStatus = VectorizationStatus.FAILED;
      document.status = DocumentStatus.FAILED;
      document.error = error instanceof Error ? error.message : String(error);

      const progress = this.processingQueue.get(documentId);
      if (progress) {
        progress.status = VectorizationStatus.FAILED;
        progress.error = document.error;
      }

      logger.error(`Vectorization failed for document ${documentId}`, error);
      throw new VectorizationError(documentId, document.error);
    } finally {
      this.processingQueue.delete(documentId);
    }
  }

  /**
   * Get document by ID
   */
  getDocument(documentId: string): Document | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): Document[] {
    return Array.from(this.documents.values());
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new DocumentNotFoundError(documentId);
    }

    // Delete from vector store
    await vectorStore.deleteDocument(documentId);

    // Remove from memory
    this.documents.delete(documentId);

    // Update persistent storage
    await this.saveDocumentMetadata();

    logger.info(`Document deleted: ${document.metadata.title}`);
  }

  /**
   * Get vectorization progress
   */
  getVectorizationProgress(documentId: string): VectorizationProgress | undefined {
    return this.processingQueue.get(documentId);
  }

  /**
   * Recursively find markdown files
   */
  private async findMarkdownFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip .obsidian directory and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.findMarkdownFiles(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile() && extname(entry.name) === '.md') {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Generate unique ID using crypto.randomUUID()
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get optimal chunk size based on document characteristics
   */
  private getOptimalChunkSize(doc: Document): number {
    // Code documents need smaller chunks to avoid function truncation
    if (doc.metadata.tags?.includes('code')) {
      return 500;
    }

    // Long documents can benefit from larger chunks
    if ((doc.metadata.wordCount ?? 0) > 5000) {
      return 1500;
    }

    // Default chunk size
    return 1000;
  }

  /**
   * Load document metadata from persistent storage
   */
  private async loadDocumentMetadata(): Promise<void> {
    if (this.metadataLoaded) {
      return;
    }

    try {
      const data = await readFile(METADATA_STORAGE_PATH, 'utf-8');
      const metadataList = JSON.parse(data) as DocumentMetadata[];

      for (const metadata of metadataList) {
        // Convert date strings back to Date objects
        metadata.createdAt = new Date(metadata.createdAt);
        metadata.updatedAt = new Date(metadata.updatedAt);

        // Create a minimal document object with metadata
        const document: Document = {
          metadata,
          content: '', // Content is stored in vector store
          chunks: [],
          status: DocumentStatus.COMPLETED,
          vectorizationStatus: VectorizationStatus.COMPLETED,
        };

        this.documents.set(metadata.id, document);
      }

      this.metadataLoaded = true;
      logger.info(`Loaded ${metadataList.length} document metadata from storage`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to load document metadata:', error);
      }
      this.metadataLoaded = true;
    }
  }

  /**
   * Save document metadata to persistent storage
   */
  private async saveDocumentMetadata(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = dirname(METADATA_STORAGE_PATH);
      try {
        await mkdir(dir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      // Collect all metadata
      const metadataList = Array.from(this.documents.values()).map((doc) => doc.metadata);

      // Write to file
      await writeFile(METADATA_STORAGE_PATH, JSON.stringify(metadataList, null, 2));

      logger.debug(`Saved ${metadataList.length} document metadata to storage`);
    } catch (error) {
      logger.error('Failed to save document metadata:', error);
      throw error;
    }
  }
}

export const documentService = new DocumentService();
