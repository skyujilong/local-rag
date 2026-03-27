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
  private baseUrl: string;
  private vectorDimension: number = 768; // Default for nomic-embed-text
  private connected = false;
  private initializationFailed = false;

  constructor() {
    const ollamaConfig = config.get('ollama');
    this.model = ollamaConfig.model;
    this.baseUrl = ollamaConfig.baseUrl;
  }

  /**
   * Initialize Ollama client and verify connection with retry mechanism
   */
  async initialize(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (this.initializationFailed) {
      log.warn('Skipping Ollama initialization due to previous failure');
      return;
    }

    const ollamaConfig = config.get('ollama');
    const maxAttempts = ollamaConfig.initRetryMaxAttempts;
    const retryDelay = ollamaConfig.initRetryDelay;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        log.info(`Ollama initialization attempt ${attempt + 1}/${maxAttempts}...`);

        this.client = new Ollama({ host: this.baseUrl });

        // Test connection and check model
        await this.checkConnection();

        this.connected = true;
        log.info(`Ollama connected successfully, using model: ${this.model}`);
        return;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts - 1) {
          const delay = retryDelay * (attempt + 1); // Progressive delay
          log.warn(
            `Ollama initialization attempt ${attempt + 1}/${maxAttempts} failed, ` +
            `retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    this.initializationFailed = true;
    const errorMessage = this.getDetailedErrorMessage(lastError);
    log.error(`Failed to connect to Ollama after ${maxAttempts} attempts`, lastError);
    throw new OllamaConnectionError(errorMessage);
  }

  /**
   * Generate detailed error message with troubleshooting steps
   */
  private getDetailedErrorMessage(error: Error | null): string {
    const baseUrl = this.baseUrl;
    const model = this.model;

    let message = `Failed to connect to Ollama at ${baseUrl}.\n\n`;
    message += `Troubleshooting steps:\n`;
    message += `1. Install Ollama: https://ollama.com/download\n`;
    message += `2. Start Ollama service: ollama serve\n`;
    message += `3. Pull the model: ollama pull ${model}\n`;
    message += `4. Verify Ollama is running: curl ${baseUrl}/api/tags\n`;

    if (error?.message.includes('ECONNREFUSED')) {
      message += `\nSpecific error: Connection refused. Is Ollama running?`;
    } else if (error?.message.includes('timeout')) {
      message += `\nSpecific error: Connection timeout. Check your network and Ollama service.`;
    }

    return message;
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
        `Failed to connect to Ollama at ${this.baseUrl}`
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
   * Check if initialization has previously failed
   */
  hasFailed(): boolean {
    return this.initializationFailed;
  }

  /**
   * Get health status for monitoring
   */
  getHealthStatus(): {
    connected: boolean;
    model: string;
    baseUrl: string;
    vectorDimension: number;
    initializationFailed: boolean;
  } {
    return {
      connected: this.connected,
      model: this.model,
      baseUrl: this.baseUrl,
      vectorDimension: this.vectorDimension,
      initializationFailed: this.initializationFailed,
    };
  }

  /**
   * Retry connection (reset failure state and retry)
   */
  async retryConnection(): Promise<void> {
    log.info('Retrying Ollama connection...');
    this.connected = false;
    this.initializationFailed = false;
    await this.initialize();
  }

  /**
   * Perform a quick health check without throwing errors
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> {
    if (!this.client) {
      return {
        healthy: false,
        message: 'Ollama client not initialized',
        details: { initializationFailed: this.initializationFailed },
      };
    }

    try {
      const tags = await this.client.list();
      const modelAvailable = tags.models.some((m: any) => m.name.includes(this.model));

      if (!modelAvailable) {
        return {
          healthy: false,
          message: `Model '${this.model}' not available`,
          details: {
            availableModels: tags.models.map((m: any) => m.name),
          },
        };
      }

      return {
        healthy: true,
        message: 'Ollama is healthy',
        details: {
          model: this.model,
          vectorDimension: this.vectorDimension,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Health check failed: ${(error as Error).message}`,
        details: { error: (error as Error).message },
      };
    }
  }
}

export const embeddingService = new EmbeddingService();
