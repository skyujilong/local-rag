/**
 * Tests for config manager - permissions, merging, defaults
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the fs module
const mockWriteFileSync = vi.fn();
const mockChmodSync = vi.fn();
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReadFileSync = vi.fn().mockReturnValue('{}');

vi.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  chmodSync: mockChmodSync,
}));

describe('ConfigManager', () => {
  beforeEach(() => {
    mockWriteFileSync.mockReset();
    mockChmodSync.mockReset();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
  });

  describe('default configuration values', () => {
    it('should return default server port 3000', async () => {
      const { config } = await import('./config.js');
      expect(config.get('server').port).toBe(3000);
    });

    it('should return default server host 127.0.0.1', async () => {
      const { config } = await import('./config.js');
      expect(config.get('server').host).toBe('127.0.0.1');
    });

    it('should return correct Ollama defaults', async () => {
      const { config } = await import('./config.js');
      const ollama = config.get('ollama');
      expect(ollama.baseUrl).toBe('http://127.0.0.1:11434');
      expect(ollama.model).toBe('nomic-embed-text');
      expect(ollama.timeout).toBe(30000);
    });

    it('should return correct processing defaults', async () => {
      const { config } = await import('./config.js');
      const processing = config.get('processing');
      expect(processing.chunkSize).toBe(1000);
      expect(processing.chunkOverlap).toBe(200);
      expect(processing.maxConcurrency).toBe(5);
    });

    it('should return correct logging defaults', async () => {
      const { config } = await import('./config.js');
      const logging = config.get('logging');
      expect(logging.level).toBe('info');
    });
  });

  describe('save with secure file permissions', () => {
    it('should call chmodSync with 0o600 to secure the config file', async () => {
      const { config } = await import('./config.js');
      config.save();

      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(mockChmodSync).toHaveBeenCalledWith(
        expect.any(String),
        0o600
      );
    });

    it('should write valid JSON to config file', async () => {
      const { config } = await import('./config.js');
      config.save();

      const writeArgs = mockWriteFileSync.mock.calls[0];
      expect(() => JSON.parse(writeArgs[1])).not.toThrow();
    });

    it('should throw error when writeFileSync fails', async () => {
      mockWriteFileSync.mockImplementationOnce(() => {
        throw new Error('Permission denied');
      });

      const { config } = await import('./config.js');
      expect(() => config.save()).toThrow('Permission denied');
    });
  });

  describe('get and set operations', () => {
    it('should update and retrieve config values with set()', async () => {
      const { config } = await import('./config.js');

      const originalPort = config.get('server').port;
      config.set('server', { ...config.get('server'), port: 9999 });

      expect(config.get('server').port).toBe(9999);

      // Reset for other tests
      config.set('server', { ...config.get('server'), port: originalPort });
    });

    it('should return all config sections with getAll()', async () => {
      const { config } = await import('./config.js');

      const all = config.getAll();
      expect(all).toHaveProperty('server');
      expect(all).toHaveProperty('ollama');
      expect(all).toHaveProperty('chromadb');
      expect(all).toHaveProperty('processing');
      expect(all).toHaveProperty('logging');
    });

    it('should return a top-level copy from getAll() (shallow copy)', async () => {
      const { config } = await import('./config.js');

      const all1 = config.getAll();
      const all2 = config.getAll();

      // getAll() uses shallow spread, so two calls return equal but different top-level objects
      expect(all1).toEqual(all2);
      expect(all1).not.toBe(all2); // different references at top level
    });
  });

  describe('config merging', () => {
    it('should preserve defaults when merging nested config', async () => {
      const { config } = await import('./config.js');

      // Partially override server config
      config.set('server', { ...config.get('server'), port: 8080 });

      // Other server fields should still be present
      expect(config.get('server').host).toBeDefined();
      expect(config.get('server').port).toBe(8080);

      // Reset
      config.set('server', { ...config.get('server'), port: 3000 });
    });

    it('should not affect unrelated config sections when modifying one', async () => {
      const { config } = await import('./config.js');

      const originalOllamaModel = config.get('ollama').model;
      config.set('server', { ...config.get('server'), port: 4000 });

      expect(config.get('ollama').model).toBe(originalOllamaModel);

      // Reset
      config.set('server', { ...config.get('server'), port: 3000 });
    });
  });

  describe('chromadb configuration', () => {
    it('should have a chromadb path configured', async () => {
      const { config } = await import('./config.js');
      expect(config.get('chromadb').path).toBeDefined();
      expect(config.get('chromadb').path.length).toBeGreaterThan(0);
    });

    it('should have default collection name "documents"', async () => {
      const { config } = await import('./config.js');
      expect(config.get('chromadb').collectionName).toBe('documents');
    });
  });
});
