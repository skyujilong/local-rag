/**
 * Unit tests for UrlUtil
 * 
 * Tests cover:
 * - URL validation (HTTP/HTTPS only)
 * - URL normalization (remove hash, tracking params)
 * - Duplicate URL detection
 * - Domain extraction
 * - URL filtering and deduplication
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UrlUtil } from '../url.js';

// Mock logger
vi.mock('../logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('UrlUtil', () => {
  describe('isValid', () => {
    it('should accept valid HTTP URL', () => {
      expect(UrlUtil.isValid('http://example.com')).toBe(true);
    });

    it('should accept valid HTTPS URL', () => {
      expect(UrlUtil.isValid('https://example.com')).toBe(true);
    });

    it('should reject FTP protocol', () => {
      expect(UrlUtil.isValid('ftp://example.com')).toBe(false);
    });

    it('should reject file protocol', () => {
      expect(UrlUtil.isValid('file:///path/to/file')).toBe(false);
    });

    it('should reject invalid URL format', () => {
      expect(UrlUtil.isValid('not-a-url')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(UrlUtil.isValid('')).toBe(false);
    });

    it('should accept URL with port', () => {
      expect(UrlUtil.isValid('https://example.com:8443')).toBe(true);
    });

    it('should accept URL with path', () => {
      expect(UrlUtil.isValid('https://example.com/path/to/page')).toBe(true);
    });

    it('should accept URL with query params', () => {
      expect(UrlUtil.isValid('https://example.com?key=value')).toBe(true);
    });

    it('should accept URL with hash', () => {
      expect(UrlUtil.isValid('https://example.com#section')).toBe(true);
    });

    it('should accept IP address', () => {
      expect(UrlUtil.isValid('https://192.168.1.1')).toBe(true);
    });

    it('should accept localhost', () => {
      expect(UrlUtil.isValid('http://localhost:8080')).toBe(true);
    });
  });

  describe('normalize', () => {
    it('should remove hash by default', () => {
      const url = 'https://example.com/article#section1';
      const normalized = UrlUtil.normalize(url);
      
      expect(normalized).not.toContain('#section1');
      expect(normalized).toBe('https://example.com/article');
    });

    it('should remove tracking parameters by default', () => {
      const url = 'https://example.com/article?utm_source=google&utm_medium=email&id=123';
      const normalized = UrlUtil.normalize(url);
      
      expect(normalized).not.toContain('utm_source');
      expect(normalized).not.toContain('utm_medium');
      expect(normalized).toContain('id=123'); // non-tracking param preserved
    });

    it('should remove Facebook Click ID', () => {
      const url = 'https://example.com/article?fbclid=abc123';
      const normalized = UrlUtil.normalize(url);
      
      expect(normalized).not.toContain('fbclid');
    });

    it('should remove Google Click ID', () => {
      const url = 'https://example.com/article?gclid=xyz789';
      const normalized = UrlUtil.normalize(url);
      
      expect(normalized).not.toContain('gclid');
    });

    it('should remove Google Analytics params', () => {
      const url = 'https://example.com/article?_ga=GA1.2.123456789.1234567890&_gid=GA1.2.987654321.0987654321';
      const normalized = UrlUtil.normalize(url);
      
      expect(normalized).not.toContain('_ga');
      expect(normalized).not.toContain('_gid');
    });

    it('should keep hash when removeHash is false', () => {
      const url = 'https://example.com/article#section1';
      const normalized = UrlUtil.normalize(url, { removeHash: false });
      
      expect(normalized).toContain('#section1');
    });

    it('should keep tracking params when removeTrackingParams is false', () => {
      const url = 'https://example.com/article?utm_source=google';
      const normalized = UrlUtil.normalize(url, { removeTrackingParams: false });
      
      expect(normalized).toContain('utm_source');
    });

    it('should remove trailing slash when removeTrailingSlash is true', () => {
      const url = 'https://example.com/article/';
      const normalized = UrlUtil.normalize(url, { removeTrailingSlash: true });

      expect(normalized).not.toMatch(/\/$/);
    });

    it('should preserve trailing slash by default', () => {
      const url = 'https://example.com/article/';
      const normalized = UrlUtil.normalize(url);

      expect(normalized).toMatch(/\/$/);
    });

    it('should handle URL without any modifications needed', () => {
      const url = 'https://example.com/article';
      const normalized = UrlUtil.normalize(url);
      
      expect(normalized).toBe(url);
    });

    it('should handle malformed URL gracefully', () => {
      const url = 'not-a-valid-url';
      const normalized = UrlUtil.normalize(url);
      
      expect(normalized).toBe(url); // return original on error
    });

    it('should normalize multiple tracking params', () => {
      const url = 'https://example.com/page?utm_source=google&fbclid=abc&id=123&gclid=xyz';
      const normalized = UrlUtil.normalize(url);
      
      expect(normalized).toBe('https://example.com/page?id=123');
    });
  });

  describe('isDuplicate', () => {
    it('should detect duplicate URLs with different hash', () => {
      const url1 = 'https://example.com/article#section1';
      const url2 = 'https://example.com/article#section2';
      
      expect(UrlUtil.isDuplicate(url1, url2)).toBe(true);
    });

    it('should detect duplicate URLs with different tracking params', () => {
      const url1 = 'https://example.com/article?utm_source=google';
      const url2 = 'https://example.com/article?utm_medium=email';
      
      expect(UrlUtil.isDuplicate(url1, url2)).toBe(true);
    });

    it('should detect duplicate URLs with hash and tracking params', () => {
      const url1 = 'https://example.com/article?utm_source=google#section1';
      const url2 = 'https://example.com/article?fbclid=abc#section2';
      
      expect(UrlUtil.isDuplicate(url1, url2)).toBe(true);
    });

    it('should not detect different paths as duplicate', () => {
      const url1 = 'https://example.com/article1';
      const url2 = 'https://example.com/article2';
      
      expect(UrlUtil.isDuplicate(url1, url2)).toBe(false);
    });

    it('should not detect different domains as duplicate', () => {
      const url1 = 'https://example.com/article';
      const url2 = 'https://other.com/article';
      
      expect(UrlUtil.isDuplicate(url1, url2)).toBe(false);
    });

    it('should treat different query params (non-tracking) as different', () => {
      const url1 = 'https://example.com/article?id=1';
      const url2 = 'https://example.com/article?id=2';
      
      expect(UrlUtil.isDuplicate(url1, url2)).toBe(false);
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from HTTP URL', () => {
      expect(UrlUtil.extractDomain('http://example.com/path')).toBe('example.com');
    });

    it('should extract domain from HTTPS URL', () => {
      expect(UrlUtil.extractDomain('https://example.com/path')).toBe('example.com');
    });

    it('should extract domain with port', () => {
      expect(UrlUtil.extractDomain('https://example.com:8443/path')).toBe('example.com');
    });

    it('should extract domain with subdomain', () => {
      expect(UrlUtil.extractDomain('https://blog.example.com/path')).toBe('blog.example.com');
    });

    it('should return empty string for invalid URL', () => {
      expect(UrlUtil.extractDomain('not-a-url')).toBe('');
    });

    it('should return empty string for empty input', () => {
      expect(UrlUtil.extractDomain('')).toBe('');
    });
  });

  describe('isSameDomain', () => {
    it('should return true for same domain', () => {
      const url1 = 'https://example.com/page1';
      const url2 = 'https://example.com/page2';
      
      expect(UrlUtil.isSameDomain(url1, url2)).toBe(true);
    });

    it('should return true for same domain with different protocols', () => {
      const url1 = 'http://example.com/page1';
      const url2 = 'https://example.com/page2';
      
      expect(UrlUtil.isSameDomain(url1, url2)).toBe(true);
    });

    it('should return false for different domains', () => {
      const url1 = 'https://example.com/page1';
      const url2 = 'https://other.com/page2';
      
      expect(UrlUtil.isSameDomain(url1, url2)).toBe(false);
    });

    it('should return false for subdomains vs main domain', () => {
      const url1 = 'https://example.com/page1';
      const url2 = 'https://blog.example.com/page2';
      
      expect(UrlUtil.isSameDomain(url1, url2)).toBe(false);
    });

    it('should handle invalid URLs gracefully', () => {
      const url1 = 'not-a-url';
      const url2 = 'https://example.com/page';
      
      expect(UrlUtil.isSameDomain(url1, url2)).toBe(false);
    });
  });

  describe('filterSameDomain', () => {
    it('should filter URLs from same domain', () => {
      const baseUrl = 'https://example.com';
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://other.com/page1',
        'https://blog.example.com/page1',
      ];
      
      const filtered = UrlUtil.filterSameDomain(baseUrl, urls);
      
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain('https://example.com/page1');
      expect(filtered).toContain('https://example.com/page2');
    });

    it('should return empty array when no URLs match', () => {
      const baseUrl = 'https://example.com';
      const urls = [
        'https://other.com/page1',
        'https://another.com/page2',
      ];
      
      const filtered = UrlUtil.filterSameDomain(baseUrl, urls);
      
      expect(filtered).toHaveLength(0);
    });

    it('should handle empty URL list', () => {
      const filtered = UrlUtil.filterSameDomain('https://example.com', []);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('deduplicateUrls', () => {
    it('should remove duplicate URLs with different hashes', () => {
      const urls = [
        'https://example.com/article#section1',
        'https://example.com/article#section2',
        'https://example.com/article#section3',
      ];
      
      const deduplicated = UrlUtil.deduplicateUrls(urls);
      
      expect(deduplicated).toHaveLength(1);
    });

    it('should remove duplicate URLs with different tracking params', () => {
      const urls = [
        'https://example.com/article?utm_source=google',
        'https://example.com/article?utm_medium=email',
        'https://example.com/article?fbclid=abc',
      ];
      
      const deduplicated = UrlUtil.deduplicateUrls(urls);
      
      expect(deduplicated).toHaveLength(1);
    });

    it('should keep different URLs', () => {
      const urls = [
        'https://example.com/article1',
        'https://example.com/article2',
        'https://example.com/article3',
      ];
      
      const deduplicated = UrlUtil.deduplicateUrls(urls);
      
      expect(deduplicated).toHaveLength(3);
    });

    it('should handle empty array', () => {
      const deduplicated = UrlUtil.deduplicateUrls([]);
      expect(deduplicated).toHaveLength(0);
    });

    it('should preserve order of first occurrence', () => {
      const urls = [
        'https://example.com/article1',
        'https://example.com/article2',
        'https://example.com/article1?utm_source=google', // duplicate of first
        'https://example.com/article3',
      ];

      const deduplicated = UrlUtil.deduplicateUrls(urls);

      expect(deduplicated[0]).toBe('https://example.com/article1');
      expect(deduplicated[1]).toBe('https://example.com/article2');
      expect(deduplicated[2]).toBe('https://example.com/article3');
    });
  });

  describe('applyFilters', () => {
    it('should pass URL when no filters specified', () => {
      const result = UrlUtil.applyFilters('https://example.com/article', {});
      expect(result).toBe(true);
    });

    it('should pass URL matching include pattern', () => {
      const result = UrlUtil.applyFilters('https://example.com/docs/article', {
        include: ['/docs/'],
      });
      expect(result).toBe(true);
    });

    it('should reject URL not matching include pattern', () => {
      const result = UrlUtil.applyFilters('https://example.com/blog/article', {
        include: ['/docs/'],
      });
      expect(result).toBe(false);
    });

    it('should reject URL matching exclude pattern', () => {
      const result = UrlUtil.applyFilters('https://example.com/api/article', {
        exclude: ['/api/'],
      });
      expect(result).toBe(false);
    });

    it('should prioritize exclude over include', () => {
      const result = UrlUtil.applyFilters('https://example.com/docs/api/article', {
        include: ['/docs/'],
        exclude: ['/api/'],
      });
      expect(result).toBe(false); // exclude wins
    });

    it('should handle multiple include patterns', () => {
      const result1 = UrlUtil.applyFilters('https://example.com/docs/article', {
        include: ['/docs/', '/blog/'],
      });
      const result2 = UrlUtil.applyFilters('https://example.com/blog/article', {
        include: ['/docs/', '/blog/'],
      });
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should handle multiple exclude patterns', () => {
      const result1 = UrlUtil.applyFilters('https://example.com/api/article', {
        exclude: ['/api/', '/admin/'],
      });
      const result2 = UrlUtil.applyFilters('https://example.com/admin/article', {
        exclude: ['/api/', '/admin/'],
      });
      
      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });

  describe('extractBaseUrl', () => {
    it('should extract base URL from full URL', () => {
      const result = UrlUtil.extractBaseUrl('https://example.com/path/to/page');
      expect(result).toBe('https://example.com');
    });

    it('should handle URL with port', () => {
      const result = UrlUtil.extractBaseUrl('https://example.com:8443/path');
      expect(result).toBe('https://example.com');
    });

    it('should return empty string for invalid URL', () => {
      const result = UrlUtil.extractBaseUrl('not-a-url');
      expect(result).toBe('');
    });
  });
});
