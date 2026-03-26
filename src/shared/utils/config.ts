/**
 * Configuration management
 */

import type { AppConfig } from '../types/index.js';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';

const DEFAULT_CONFIG: AppConfig = {
  server: {
    port: 3000,
    host: '127.0.0.1',
    cors: false,
  },
  ollama: {
    baseUrl: 'http://127.0.0.1:11434',
    model: 'nomic-embed-text',
    timeout: 30000,
  },
  chromadb: {
    path: join(process.cwd(), '.devrag', 'chromadb'),
    collectionName: 'documents',
  },
  processing: {
    chunkSize: 1000,
    chunkOverlap: 200,
    maxConcurrency: 5,
  },
  logging: {
    level: 'info',
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
        return this.mergeConfig(DEFAULT_CONFIG, userConfig);
      } catch (error) {
        console.warn(`Failed to load config from ${this.configPath}, using defaults`);
        return { ...DEFAULT_CONFIG };
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  private mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
    return {
      server: { ...base.server, ...override.server },
      ollama: { ...base.ollama, ...override.ollama },
      chromadb: { ...base.chromadb, ...override.chromadb },
      processing: { ...base.processing, ...override.processing },
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
