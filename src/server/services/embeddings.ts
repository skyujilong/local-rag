/**
 * Ollama embedding service
 */

import { Ollama } from 'ollama';
import { config } from '../../shared/utils/config.js';
import { createLogger } from '../../shared/utils/logger.js';
import { OllamaConnectionError } from '../../shared/types/index.js';

const log = createLogger('services:embeddings');

export class EmbeddingService {
  private client: any = null;
  private model: string;
  private vectorDimension: number = 768; // Default for nomic-embed-text
  private connected = false;

  constructor() {
    const ollamaConfig = config.get('ollama');
    this.model = ollamaConfig.model;
  }

  /**
   * Initialize Ollama client and verify connection
   */
  async initialize(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      const ollamaConfig = config.get('ollama');
      this.client = new Ollama({ host: ollamaConfig.baseUrl });

      // Test connection and check model
      await this.checkConnection();

      this.connected = true;
      log.info(`Ollama connected successfully, using model: ${this.model}`);
    } catch (error) {
      log.error('Failed to connect to Ollama', error);
      throw new OllamaConnectionError(
        'Make sure Ollama is running and the model is available. Install from https://ollama.com'
      );
    }
  }

  /**
   * Check Ollama connection and model availability
   */
  private async checkConnection(): Promise<void> {
    if (!this.client) {
      throw new OllamaConnectionError('Ollama client not initialized');
    }

    try {
      // Check if Ollama is running
      const tags = await this.client.list();
      const modelAvailable = tags.models.some((m: any) => m.name.includes(this.model));

      if (!modelAvailable) {
        throw new OllamaConnectionError(
          `Model '${this.model}' not found. Run: ollama pull ${this.model}`
        );
      }

      // Get vector dimension by testing embedding
      const testEmbedding = await this.client.embeddings({
        model: this.model,
        prompt: 'test',
      });

      this.vectorDimension = testEmbedding.embedding.length;
      log.debug(`Vector dimension: ${this.vectorDimension}`);
    } catch (error) {
      if (error instanceof OllamaConnectionError) {
        throw error;
      }
      throw new OllamaConnectionError(
        `Failed to connect to Ollama at ${config.get('ollama').baseUrl}`
      );
    }
  }

  /**
   * Generate embedding for a single text with retry mechanism
   */
  async embed(text: string, retries = 3): Promise<number[]> {
    if (!this.connected) {
      await this.initialize();
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await this.client!.embeddings({
          model: this.model,
          prompt: text,
        });

        return response.embedding;
      } catch (error) {
        lastError = error as Error;

        if (attempt < retries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          log.info(`Embedding attempt ${attempt + 1}/${retries} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    log.error(`Failed to generate embedding after ${retries} attempts`, lastError);
    throw new OllamaConnectionError(
      `Embedding generation failed after ${retries} retries: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Generate embeddings for multiple texts (batch processing with dynamic sizing)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.connected) {
      await this.initialize();
    }

    const embeddings: number[][] = [];

    // Calculate optimal batch size based on average text length
    const avgTextLength = texts.reduce((sum, t) => sum + t.length, 0) / texts.length;
    let batchSize: number;
    if (avgTextLength > 5000) {
      batchSize = 3; // Smaller batches for large texts
    } else if (avgTextLength > 2000) {
      batchSize = 5; // Medium batches
    } else {
      batchSize = 10; // Larger batches for small texts
    }

    log.debug(`Using batch size ${batchSize} for average text length ${Math.round(avgTextLength)} chars`);

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map((text) => this.embed(text));
      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults);

      log.debug(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
    }

    return embeddings;
  }

  /**
   * Get the vector dimension
   */
  getDimension(): number {
    return this.vectorDimension;
  }

  /**
   * Get the model name
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Check if connected to Ollama
   */
  isReady(): boolean {
    return this.connected;
  }

  /**
   * Retry connection
   */
  async retryConnection(): Promise<void> {
    this.connected = false;
    await this.initialize();
  }
}

export const embeddingService = new EmbeddingService();
