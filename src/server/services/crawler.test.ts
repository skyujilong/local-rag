/**
 * Tests for crawler service - XSS protection, path handling, error scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create shared mock objects
const mockPage = {
  goto: vi.fn(),
  title: vi.fn().mockResolvedValue('Test Page'),
  evaluate: vi.fn(),
  screenshot: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  waitForSelector: vi.fn().mockResolvedValue(undefined),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  addCookies: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  version: vi.fn().mockReturnValue('Chrome/120'), // synchronous in playwright
  close: vi.fn().mockResolvedValue(undefined),
};

// Mock playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock isomorphic-dompurify to test XSS sanitization
vi.mock('isomorphic-dompurify', () => ({
  default: {
    sanitize: vi.fn().mockImplementation((content: string, _options?: any) => {
      // Simulate DOMPurify removing script tags
      return content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .trim();
    }),
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

// Mock document service
vi.mock('./documents.js', () => ({
  documentService: {
    addDocumentFromText: vi.fn().mockResolvedValue({
      metadata: { id: 'test-id', title: 'Test' },
    }),
  },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
}));

describe('CrawlerService', () => {
  let CrawlerService: any;
  let service: any;

  beforeEach(async () => {
    // Reset all mocks
    mockPage.goto.mockReset();
    mockPage.title.mockReset();
    mockPage.evaluate.mockReset();
    mockPage.screenshot.mockReset();
    mockPage.close.mockReset();
    mockPage.waitForSelector.mockReset();
    mockContext.newPage.mockReset();
    mockContext.addCookies.mockReset();
    mockBrowser.newContext.mockReset();
    mockBrowser.version.mockReset();
    mockBrowser.close.mockReset();

    // Re-set default implementations
    mockPage.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
    mockPage.title.mockResolvedValue('Test Page');
    mockPage.evaluate.mockResolvedValue('Test content');
    mockPage.screenshot.mockResolvedValue(undefined);
    mockPage.close.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue(undefined);
    mockContext.newPage.mockResolvedValue(mockPage);
    mockContext.addCookies.mockResolvedValue(undefined);
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockBrowser.version.mockReturnValue('Chrome/120');
    mockBrowser.close.mockResolvedValue(undefined);

    const { chromium } = await import('playwright');
    (chromium.launch as any).mockResolvedValue(mockBrowser);

    const module = await import('./crawler.js');
    CrawlerService = module.CrawlerService;
    service = new CrawlerService();
  });

  describe('initialize', () => {
    it('should initialize browser successfully', async () => {
      await service.initialize();
      const { chromium } = await import('playwright');
      expect(chromium.launch).toHaveBeenCalledWith({ headless: true });
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      const { chromium } = await import('playwright');
      const callCount = (chromium.launch as any).mock.calls.length;

      await service.initialize();
      // Should not launch again
      expect((chromium.launch as any).mock.calls.length).toBe(callCount);
    });

    it('should throw CrawlerError when browser launch fails', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockRejectedValueOnce(new Error('Browser launch failed'));

      const { CrawlerError } = await import('../../shared/types/index.js');
      await expect(service.initialize()).rejects.toBeInstanceOf(CrawlerError);
    });

    it('should cleanup failed browser instance on initialization failure', async () => {
      const { chromium } = await import('playwright');
      const failingBrowser = {
        version: vi.fn().mockImplementation(() => { throw new Error('Browser not responsive'); }),
        close: vi.fn().mockResolvedValue(undefined),
        newContext: vi.fn(),
      };
      (chromium.launch as any).mockResolvedValueOnce(failingBrowser);

      await expect(service.initialize()).rejects.toThrow(/Browser initialization failed/);
      expect(failingBrowser.close).toHaveBeenCalled();
    });
  });

  describe('crawlUrl', () => {
    beforeEach(async () => {
      await service.initialize();
      // Set up evaluate calls in order: extractMainContent, language, extractLinks
      mockPage.evaluate
        .mockResolvedValueOnce('Main page content')  // extractMainContent
        .mockResolvedValueOnce('en')                  // language
        .mockResolvedValueOnce(['https://example.com/link1']); // extractLinks
    });

    it('should crawl a URL and return result with correct structure', async () => {
      const result = await service.crawlUrl({ url: 'https://example.com' });

      expect(result.url).toBe('https://example.com');
      expect(result.title).toBe('Test Page');
      expect(result.content).toBeDefined();
      expect(result.metadata.crawledAt).toBeInstanceOf(Date);
      expect(result.metadata.wordCount).toBeGreaterThanOrEqual(0);
    });

    it('should throw CrawlerError for non-OK HTTP response', async () => {
      mockPage.goto.mockResolvedValueOnce({ ok: () => false, status: () => 404 });

      const { CrawlerError } = await import('../../shared/types/index.js');
      await expect(service.crawlUrl({ url: 'https://example.com/404' })).rejects.toBeInstanceOf(
        CrawlerError
      );
    });

    it('should throw CrawlerError when page returns null response', async () => {
      mockPage.goto.mockResolvedValueOnce(null);

      const { CrawlerError } = await import('../../shared/types/index.js');
      await expect(service.crawlUrl({ url: 'https://example.com/error' })).rejects.toBeInstanceOf(
        CrawlerError
      );
    });

    it('should wait for selector when waitForSelector is provided', async () => {
      await service.crawlUrl({
        url: 'https://example.com',
        waitForSelector: '#main-content',
      });

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#main-content', { timeout: 10000 });
    });

    it('should close the page after crawling', async () => {
      await service.crawlUrl({ url: 'https://example.com' });
      expect(mockPage.close).toHaveBeenCalled();
    });

    it('should close the page even if crawling fails', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation timeout'));

      await expect(service.crawlUrl({ url: 'https://example.com' })).rejects.toThrow();
      expect(mockPage.close).toHaveBeenCalled();
    });
  });

  describe('XSS protection via DOMPurify', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should sanitize content with DOMPurify to remove script tags', async () => {
      const maliciousContent = '<script>alert("XSS")</script>Real content here';

      mockPage.evaluate
        .mockResolvedValueOnce(maliciousContent)
        .mockResolvedValueOnce('en')
        .mockResolvedValueOnce([]);

      const result = await service.crawlUrl({ url: 'https://example.com' });

      // DOMPurify mock removes script tags
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('alert("XSS")');
    });

    it('should sanitize onclick event handlers', async () => {
      const contentWithHandlers = '<div onclick="stealCookies()">Click me</div>';

      mockPage.evaluate
        .mockResolvedValueOnce(contentWithHandlers)
        .mockResolvedValueOnce('en')
        .mockResolvedValueOnce([]);

      const result = await service.crawlUrl({ url: 'https://example.com' });

      expect(result.content).not.toContain('onclick=');
    });

    it('should call DOMPurify.sanitize with correct options', async () => {
      const DOMPurify = (await import('isomorphic-dompurify')).default;

      mockPage.evaluate
        .mockResolvedValueOnce('Clean content')
        .mockResolvedValueOnce('en')
        .mockResolvedValueOnce([]);

      await service.crawlUrl({ url: 'https://example.com' });

      expect(DOMPurify.sanitize).toHaveBeenCalledWith(
        'Clean content',
        expect.objectContaining({
          ALLOWED_TAGS: expect.arrayContaining(['p', 'br', 'strong']),
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true,
        })
      );
    });
  });

  describe('screenshot with cross-platform path (os.tmpdir)', () => {
    beforeEach(async () => {
      await service.initialize();

      mockPage.evaluate
        .mockResolvedValueOnce('Test content')
        .mockResolvedValueOnce('en')
        .mockResolvedValueOnce([]);
    });

    it('should use os.tmpdir() for screenshot path', async () => {
      const { tmpdir } = await import('os');
      const platformTmpDir = tmpdir();

      const result = await service.crawlUrl({ url: 'https://example.com', screenshot: true });

      expect(mockPage.screenshot).toHaveBeenCalledWith({
        path: expect.stringContaining(platformTmpDir),
      });
      expect(result.metadata.screenshotPath).toContain(platformTmpDir);
    });

    it('should not take screenshot when screenshot option is false or absent', async () => {
      await service.crawlUrl({ url: 'https://example.com' });
      expect(mockPage.screenshot).not.toHaveBeenCalled();
    });
  });

  describe('crawlUrls (batch crawling)', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should crawl multiple URLs and return all results', async () => {
      mockPage.evaluate
        .mockResolvedValueOnce('Content 1').mockResolvedValueOnce('en').mockResolvedValueOnce([])
        .mockResolvedValueOnce('Content 2').mockResolvedValueOnce('en').mockResolvedValueOnce([])
        .mockResolvedValueOnce('Content 3').mockResolvedValueOnce('en').mockResolvedValueOnce([]);

      mockPage.title
        .mockResolvedValueOnce('Page 1')
        .mockResolvedValueOnce('Page 2')
        .mockResolvedValueOnce('Page 3');

      const configs = [
        { url: 'https://example.com/1' },
        { url: 'https://example.com/2' },
        { url: 'https://example.com/3' },
      ];

      const results = await service.crawlUrls(configs);

      expect(results).toHaveLength(3);
      expect(results[0].url).toBe('https://example.com/1');
    });

    it('should continue on individual URL failure and return successful results', async () => {
      // First URL evaluate calls
      mockPage.evaluate
        .mockResolvedValueOnce('Content 1')
        .mockResolvedValueOnce('en')
        .mockResolvedValueOnce([]);

      // First URL succeeds, second fails
      mockPage.goto
        .mockResolvedValueOnce({ ok: () => true, status: () => 200 })
        .mockRejectedValueOnce(new Error('Navigation failed'));

      const configs = [
        { url: 'https://example.com/1' },
        { url: 'https://example.com/fail' },
      ];

      const results = await service.crawlUrls(configs);

      expect(results).toHaveLength(1);
    });
  });

  describe('crawlAndImport', () => {
    beforeEach(async () => {
      await service.initialize();

      mockPage.evaluate
        .mockResolvedValueOnce('Imported content')
        .mockResolvedValueOnce('en')
        .mockResolvedValueOnce([]);
    });

    it('should crawl URL and add to document service with webpage tags', async () => {
      const { documentService } = await import('./documents.js');

      await service.crawlAndImport({ url: 'https://example.com' });

      expect(documentService.addDocumentFromText).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ tags: expect.arrayContaining(['webpage', 'crawled']) })
      );
    });
  });

  describe('close', () => {
    it('should close the browser when initialized', async () => {
      await service.initialize();
      await service.close();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should do nothing if browser was never initialized', async () => {
      await service.close();
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });
  });
});
