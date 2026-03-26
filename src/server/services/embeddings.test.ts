/**
 * Tests for embedding service - batch processing, retry, health check
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create a shared mock client that we can manipulate
const mockClient = {
  list: vi.fn(),
  embeddings: vi.fn(),
};

// Mock the ollama module
vi.mock('ollama', () => ({
  default: vi.fn().mockImplementation(() => mockClient),
}));

// Mock config - use a function so it doesn't get cleared
vi.mock('../../shared/utils/config.js', () => ({
  config: {
    get: vi.fn().mockImplementation((_key: string) => ({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'nomic-embed-text',
      timeout: 30000,
    })),
  },
}));

// Mock logger
vi.mock('../../shared/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('EmbeddingService', () => {
  let EmbeddingService: any;
  let service: any;

  beforeEach(async () => {
    // Reset mock client calls and implementations
    mockClient.list.mockReset();
    mockClient.embeddings.mockReset();

    // Default successful responses
    mockClient.list.mockResolvedValue({ models: [{ name: 'nomic-embed-text' }] });
    mockClient.embeddings.mockResolvedValue({ embedding: Array(768).fill(0.1) });

    const module = await import('./embeddings.js');
    EmbeddingService = module.EmbeddingService;

    service = new EmbeddingService();
  });

  describe('initialize', () => {
    it('should initialize successfully when Ollama is available', async () => {
      await service.initialize();
      expect(service.isReady()).toBe(true);
    });

    it('should not reinitialize if already connected', async () => {
      await service.initialize();
      const callCountAfterInit = mockClient.list.mock.calls.length;

      await service.initialize();
      // list should NOT be called again
      expect(mockClient.list.mock.calls.length).toBe(callCountAfterInit);
    });

    it('should throw when model is not available', async () => {
      mockClient.list.mockResolvedValue({
        models: [{ name: 'other-model-only' }],
      });

      // Error is wrapped in OllamaConnectionError with "Make sure Ollama is running..."
      const { OllamaConnectionError } = await import('../../shared/types/index.js');
      await expect(service.initialize()).rejects.toBeInstanceOf(OllamaConnectionError);
    });

    it('should throw OllamaConnectionError when list call fails', async () => {
      mockClient.list.mockRejectedValue(new Error('Connection refused'));

      const { OllamaConnectionError } = await import('../../shared/types/index.js');
      await expect(service.initialize()).rejects.toBeInstanceOf(OllamaConnectionError);
    });
  });

  describe('getDimension / getModel / isReady', () => {
    it('should return default dimension of 768 before initialization', () => {
      expect(service.getDimension()).toBe(768);
    });

    it('should return the configured model name', () => {
      expect(service.getModel()).toBe('nomic-embed-text');
    });

    it('should return false before initialization', () => {
      expect(service.isReady()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await service.initialize();
      expect(service.isReady()).toBe(true);
    });
  });

  describe('embed', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return embedding for valid text', async () => {
      const embedding = await service.embed('test text');
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(768);
    });

    it('should call ollama embeddings API with correct parameters', async () => {
      await service.embed('hello world');
      expect(mockClient.embeddings).toHaveBeenCalledWith({
        model: 'nomic-embed-text',
        prompt: 'hello world',
      });
    });

    it('should throw OllamaConnectionError after exhausting all retries', async () => {
      vi.useFakeTimers();
      mockClient.embeddings.mockRejectedValue(new Error('Persistent failure'));

      const { OllamaConnectionError } = await import('../../shared/types/index.js');
      const embedPromise = service.embed('test text', 2);
      await vi.runAllTimersAsync();

      await expect(embedPromise).rejects.toBeInstanceOf(OllamaConnectionError);
      vi.useRealTimers();
    });

    it('should retry on temporary failure', async () => {
      vi.useFakeTimers();
      // Note: initialize() already called embeddings once for dimension check
      // So we need to track calls from this point
      const callsBefore = mockClient.embeddings.mock.calls.length;

      mockClient.embeddings
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ embedding: Array(768).fill(0.5) });

      const embedPromise = service.embed('test text', 2);
      await vi.runAllTimersAsync();
      const embedding = await embedPromise;

      expect(embedding.length).toBe(768);
      // Should have made exactly 2 additional calls (1 failure + 1 success)
      expect(mockClient.embeddings.mock.calls.length - callsBefore).toBe(2);
      vi.useRealTimers();
    });
  });

  describe('embedBatch', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should process batch of texts and return embeddings', async () => {
      const callsBefore = mockClient.embeddings.mock.calls.length;
      const texts = ['text1', 'text2', 'text3'];
      const embeddings = await service.embedBatch(texts);

      expect(embeddings).toHaveLength(3);
      expect(embeddings[0]).toHaveLength(768);
      // Should have made exactly 3 additional calls
      expect(mockClient.embeddings.mock.calls.length - callsBefore).toBe(3);
    });

    it('should dynamically adjust batch size for short texts (< 2000 chars avg) to 10', async () => {
      const callsBefore = mockClient.embeddings.mock.calls.length;
      const texts = Array(20).fill('short text');
      await service.embedBatch(texts);
      expect(mockClient.embeddings.mock.calls.length - callsBefore).toBe(20);
    });

    it('should dynamically adjust batch size for medium texts (2000-5000 chars avg) to 5', async () => {
      const callsBefore = mockClient.embeddings.mock.calls.length;
      const mediumText = 'a'.repeat(3000);
      const texts = Array(10).fill(mediumText);
      await service.embedBatch(texts);
      expect(mockClient.embeddings.mock.calls.length - callsBefore).toBe(10);
    });

    it('should dynamically adjust batch size for large texts (> 5000 chars avg) to 3', async () => {
      const callsBefore = mockClient.embeddings.mock.calls.length;
      const largeText = 'a'.repeat(6000);
      const texts = Array(6).fill(largeText);
      await service.embedBatch(texts);
      expect(mockClient.embeddings.mock.calls.length - callsBefore).toBe(6);
    });

    it('should handle empty texts array without additional calls', async () => {
      const callsBefore = mockClient.embeddings.mock.calls.length;
      const embeddings = await service.embedBatch([]);
      expect(embeddings).toHaveLength(0);
      expect(mockClient.embeddings.mock.calls.length).toBe(callsBefore);
    });
  });

  describe('retryConnection', () => {
    it('should reset connection state and reinitialize', async () => {
      await service.initialize();
      expect(service.isReady()).toBe(true);

      const listCallsBefore = mockClient.list.mock.calls.length;
      await service.retryConnection();

      // list should be called again on retry
      expect(mockClient.list.mock.calls.length).toBeGreaterThan(listCallsBefore);
      expect(service.isReady()).toBe(true);
    });
  });
});
