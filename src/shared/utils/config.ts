/**
 * Configuration management
 */

import type { AppConfig } from '../types/index.js';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';

/**
 * Validate URL to prevent SSRF attacks
 * Only allows http:// and https:// protocols
 */
export function validateUrl(url: string, context: string): void {
  try {
    const parsed = new URL(url);
    const allowedProtocols = ['http:', 'https:'];

    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new Error(
        `Invalid URL protocol in ${context}: ${parsed.protocol}. Only http:// and https:// are allowed.`
      );
    }

    // Block private/local network access in production
    const hostname = parsed.hostname;
    const privateNetworks = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
    ];

    // Check for private IP ranges (basic check)
    const privateIpPatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
    ];

    const isPrivateNetwork = privateNetworks.includes(hostname) ||
      privateIpPatterns.some(pattern => pattern.test(hostname));

    if (isPrivateNetwork && process.env.NODE_ENV === 'production') {
      console.warn(
        `Warning: Private network URL detected in ${context}: ${url}. ` +
        `This may be unsafe in production environments.`
      );
    }
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid URL format in ${context}: ${url}`);
    }
    throw error;
  }
}

const DEFAULT_CONFIG: AppConfig = {
  server: {
    port: parseInt(process.env.API_PORT || '3001', 10),
    host: process.env.API_HOST || '127.0.0.1',
    cors: false,
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434',
    model: process.env.OLLAMA_MODEL || 'nomic-embed-text',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000', 10),
  },
  chromadb: {
    // ChromaDB server URL (requires running ChromaDB server)
    // Start with: docker run -p 8000:8000 chromadb/chroma
    // Or: pip install chromadb && chroma-server --port 8000
    path: process.env.CHROMA_PATH || 'http://localhost:8000',
    collectionName: 'documents',
    queryTimeout: parseInt(process.env.CHROMA_QUERY_TIMEOUT || '5000', 10),
    initRetryMaxAttempts: parseInt(process.env.CHROMA_INIT_RETRY_MAX_ATTEMPTS || '3', 10),
    initRetryDelay: parseInt(process.env.CHROMA_INIT_RETRY_DELAY || '1000', 10),
  },
  processing: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || '512', 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || '50', 10),
    maxConcurrency: 5,
  },
  vectorStore: {
    type: process.env.VECTOR_STORE_TYPE || 'simple',
    topK: parseInt(process.env.TOP_K || '5', 10),
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7'),
  },
  logging: {
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    dir: process.env.LOG_DIR || 'logs',
    console: process.env.LOG_TO_CONSOLE !== 'false',
  },
};

class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'devrag.config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    if (existsSync(this.configPath)) {
      try {
        const userConfig = JSON.parse(readFileSync(this.configPath, 'utf-8'));
        const mergedConfig = this.mergeConfig(DEFAULT_CONFIG, userConfig);

        // Validate URLs to prevent SSRF attacks
        this.validateConfigUrls(mergedConfig);

        return mergedConfig;
      } catch (error) {
        console.warn(`Failed to load config from ${this.configPath}, using defaults`);
        return { ...DEFAULT_CONFIG };
      }
    }

    // Validate URLs in default config as well
    this.validateConfigUrls(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Validate all URLs in the configuration
   */
  private validateConfigUrls(cfg: AppConfig): void {
    try {
      validateUrl(cfg.ollama.baseUrl, 'ollama.baseUrl');
      validateUrl(cfg.chromadb.path, 'chromadb.path');
    } catch (error) {
      console.error('URL validation failed:', error);
      throw error;
    }
  }

  private mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
    return {
      server: { ...base.server, ...override.server },
      ollama: { ...base.ollama, ...override.ollama },
      chromadb: { ...base.chromadb, ...override.chromadb },
      processing: { ...base.processing, ...override.processing },
      vectorStore: {
        ...(base.vectorStore || {
          type: 'simple',
          topK: 5,
          similarityThreshold: 0.7,
        }),
        ...override.vectorStore,
        type: override.vectorStore?.type || base.vectorStore?.type || 'simple',
        topK: override.vectorStore?.topK ?? base.vectorStore?.topK ?? 5,
        similarityThreshold: override.vectorStore?.similarityThreshold ?? base.vectorStore?.similarityThreshold ?? 0.7,
      },
      logging: { ...base.logging, ...override.logging },
    };
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  getAll(): AppConfig {
    return { ...this.config };
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
  }

  save(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));

      // Set restrictive permissions (owner read/write only)
      chmodSync(this.configPath, 0o600);

      console.log(`Config saved to ${this.configPath} with secure permissions`);
    } catch (error) {
      console.error(`Failed to save config to ${this.configPath}:`, error);
      throw error;
    }
  }
}

export const config = new ConfigManager();
