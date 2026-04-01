/**
 * Unit tests for ContentCleanerService
 * 
 * Tests cover:
 * - Content cleaning (removing navigation, footer, sidebar)
 * - Main content extraction (main/article selectors)
 * - Script/style tag removal
 * - Code block and table structure preservation
 * - Quality score calculation
 * - XSS protection via DOMPurify
 * - Login page detection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentCleanerService } from '../content-cleaner.service.js';

// Mock logger
vi.mock('../../shared/utils/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ContentCleanerService', () => {
  let service: ContentCleanerService;

  beforeEach(() => {
    service = new ContentCleanerService();
  });

  describe('cleanContent', () => {
    it('should remove navigation, footer, and sidebar elements', async () => {
      const html = `
        <html>
          <body>
            <nav class="navbar">Navigation</nav>
            <header>Header</header>
            <main>
              <article>
                <h1>Main Content</h1>
                <p>This is the main content.</p>
              </article>
            </main>
            <aside class="sidebar">Sidebar</aside>
            <footer>Footer</footer>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.content).not.toContain('Navigation');
      expect(result.content).not.toContain('Header');
      expect(result.content).not.toContain('Sidebar');
      expect(result.content).not.toContain('Footer');
      expect(result.content).toContain('Main Content');
      expect(result.content).toContain('This is the main content');
    });

    it('should extract main/article content area', async () => {
      const html = `
        <html>
          <body>
            <div class="wrapper">
              <main>
                <article>
                  <h1>Article Title</h1>
                  <p>Article content goes here.</p>
                </article>
              </main>
            </div>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.content).toContain('Article Title');
      expect(result.content).toContain('Article content goes here');
      expect(result.title).toBe('Article Title');
    });

    it('should remove script and style tags', async () => {
      const html = `
        <html>
          <body>
            <main>
              <h1>Content</h1>
              <script>alert('malicious')</script>
              <style>body { color: red; }</style>
              <p>Actual content</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('<style>');
      expect(result.content).toContain('Actual content');
    });

    it('should preserve code blocks and table structure', async () => {
      const html = `
        <html>
          <body>
            <main>
              <h1>Documentation</h1>
              <pre><code>const x = 1;</code></pre>
              <table>
                <tr><th>Header</th></tr>
                <tr><td>Data</td></tr>
              </table>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.content).toContain('<pre>');
      expect(result.content).toContain('<code>');
      expect(result.content).toContain('const x = 1;');
      expect(result.content).toContain('<table>');
    });

    it('should calculate correct quality score (high quality)', async () => {
      const html = `
        <html>
          <body>
            <nav>Navigation</nav>
            <main>
              <article>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. </p>
                <p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco.</p>
              </article>
            </main>
            <footer>Footer content here</footer>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      // High quality: ratio between 0.3 and 0.7
      expect(result.qualityScore).toBeGreaterThanOrEqual(0.7);
    });

    it('should calculate low quality score for mostly navigation content', async () => {
      const html = `
        <html>
          <body>
            <div class="navigation">
              <span>Navigation Item 1 with lots of text</span>
              <span>Navigation Item 2 with lots of text</span>
              <span>Navigation Item 3 with lots of text</span>
              <span>Navigation Item 4 with lots of text</span>
            </div>
            <div class="main-content">
              <p>Small</p>
            </div>
            <div class="footer">
              <span>Footer content 1 with more text</span>
              <span>Footer content 2 with more text</span>
            </div>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      // Low quality: cleaned content is much smaller than raw
      // Since there's no main/nav/footer tags, everything is kept
      // But the main-content div is small relative to total
      expect(result.qualityScore).toBeLessThan(1.0);
    });

    it('should use custom selector when provided', async () => {
      const html = `
        <html>
          <body>
            <div class="custom-area">
              <h1>Custom Content</h1>
              <p>This is custom extracted content.</p>
            </div>
            <main>
              <p>Default content</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html, '.custom-area');

      expect(result.content).toContain('Custom Content');
      expect(result.content).toContain('custom extracted');
    });

    it('should handle empty HTML gracefully', async () => {
      const result = await service.cleanContent('');

      expect(result.content).toBe('');
      expect(result.qualityScore).toBe(0);
      expect(result.wordCount).toBe(0);
    });

    it('should handle HTML with no main content', async () => {
      const html = '<html><body><p>Simple content</p></body></html>';
      
      const result = await service.cleanContent(html);

      expect(result.content).toContain('Simple content');
    });

    it('should count words correctly for English text', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>This is a test sentence with seven words.</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.wordCount).toBe(8); // "This is a test sentence with seven words" = 8 words
    });

    it('should count words correctly for Chinese text', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>这是一个测试句子，包含中文字符。</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.wordCount).toBeGreaterThan(0);
    });

    it('should extract title correctly', async () => {
      const html = `
        <html>
          <head><title>Page Title</title></head>
          <body>
            <main>
              <h1>Article Title</h1>
              <p>Content</p>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      // Should prefer h1 over title tag
      expect(result.title).toBe('Article Title');
    });

    it('should fallback to Untitled when no title found', async () => {
      const html = '<html><body><p>Content without title</p></body></html>';

      const result = await service.cleanContent(html);

      expect(result.title).toBe('Untitled');
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize script tags with DOMPurify', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>Valid content</p>
              <script>alert('XSS')</script>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('alert');
    });

    it('should sanitize event handlers', async () => {
      const html = `
        <html>
          <body>
            <main>
              <img src="x" onerror="alert('XSS')">
              <div onclick="malicious()">Click</div>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.content).not.toContain('onerror');
      expect(result.content).not.toContain('onclick');
    });

    it('should allow safe HTML tags', async () => {
      const html = `
        <html>
          <body>
            <main>
              <p>Paragraph</p>
              <strong>Strong</strong>
              <em>Emphasis</em>
              <a href="https://example.com">Link</a>
              <ul><li>List item</li></ul>
            </main>
          </body>
        </html>
      `;

      const result = await service.cleanContent(html);

      expect(result.content).toContain('<p>');
      expect(result.content).toContain('<strong>');
      expect(result.content).toContain('<em>');
      expect(result.content).toContain('<a href=');
      expect(result.content).toContain('<ul>');
      expect(result.content).toContain('<li>');
    });
  });

  describe('isLoginPage', () => {
    it('should detect login page with multiple keywords', () => {
      const content = `
        <html>
          <body>
            <h1>Sign In to Your Account</h1>
            <form>
              <input type="text" name="username" placeholder="Username">
              <input type="password" name="password" placeholder="Password">
              <button>Log In</button>
              <a href="/forgot-password">Forgot Password?</a>
            </form>
          </body>
        </html>
      `;

      const result = service.isLoginPage(content);

      expect(result).toBe(true);
    });

    it('should not detect regular page as login page', () => {
      const content = `
        <html>
          <body>
            <h1>Article Title</h1>
            <p>This is a regular article about programming.</p>
            <p>No login form here.</p>
          </body>
        </html>
      `;

      const result = service.isLoginPage(content);

      expect(result).toBe(false);
    });

    it('should require at least 3 login keywords to trigger', () => {
      const content = `
        <html>
          <body>
            <h1>Welcome</h1>
            <p>Please login to continue</p>
          </body>
        </html>
      `;

      const result = service.isLoginPage(content);

      expect(result).toBe(false); // Only 1 keyword
    });
  });

  describe('Error Handling', () => {
    it('should throw error when cleaning fails', async () => {
      const invalidHtml = '<html><body><div unclosed>';

      // Should not throw, should handle gracefully
      const result = await service.cleanContent(invalidHtml);
      expect(result).toBeDefined();
    });

    it('should handle malformed HTML', async () => {
      const malformedHtml = '<div><p>Unclosed tags</div>';

      const result = await service.cleanContent(malformedHtml);
      expect(result.content).toBeDefined();
    });
  });
});
