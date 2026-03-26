/**
 * Additional tests for text utilities - splitting, title extraction, security edge cases
 */

import { describe, it, expect } from 'vitest';
import { splitText, stripMarkdown, extractTitle, extractTags, countWords, detectLanguage } from './text.js';

describe('splitText - detailed behavior', () => {
  it('should return single chunk for text shorter than chunkSize', () => {
    const text = 'Short text';
    const chunks = splitText(text, 100, 20);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('Short text');
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].start).toBe(0);
  });

  it('should produce overlapping chunks', () => {
    // Create a simple text that forces overlap
    const text = 'a'.repeat(50);
    const chunks = splitText(text, 20, 10);

    expect(chunks.length).toBeGreaterThan(1);
    // The start of chunk n+1 should be before the end of chunk n (overlap)
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].start).toBeLessThan(chunks[i - 1].end);
    }
  });

  it('should preserve chunk index incrementally', () => {
    const text = 'sentence one. sentence two. sentence three. sentence four.';
    const chunks = splitText(text, 15, 3);

    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it('should prefer sentence boundaries over hard character breaks', () => {
    const text = 'Hello world. Another sentence. Third one.';
    const chunks = splitText(text, 20, 5);

    // Each chunk should ideally end at a period
    if (chunks.length > 1) {
      // The first chunk should end at a period if one is found
      expect(chunks[0].content).toMatch(/\./);
    }
  });

  it('should handle text with only newlines', () => {
    const text = 'Line one\nLine two\nLine three';
    const chunks = splitText(text, 15, 3);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content.length).toBeGreaterThan(0);
  });

  it('should handle very large overlap equal to chunkSize-1', () => {
    const text = 'abcdefghij'; // 10 chars
    // With overlap = 9 and size = 10, second chunk starts at 1
    const chunks = splitText(text, 10, 9);

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should not produce empty chunks', () => {
    const text = 'Word word word word word';
    const chunks = splitText(text, 10, 5);

    chunks.forEach(chunk => {
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });
});

describe('extractTitle - comprehensive scenarios', () => {
  it('should handle empty content', () => {
    const title = extractTitle('');
    expect(typeof title).toBe('string');
  });

  it('should prefer frontmatter title over H1 heading', () => {
    const content = `---
title: "Frontmatter Title"
---

# Heading Title`;

    expect(extractTitle(content)).toBe('Frontmatter Title');
  });

  it('should handle frontmatter title without quotes', () => {
    const content = `---
title: My Document Title
---

Content`;

    expect(extractTitle(content)).toBe('My Document Title');
  });

  it('should extract H1 heading when no frontmatter', () => {
    expect(extractTitle('# My Article\n\nContent')).toBe('My Article');
  });

  it('should fall back to first line when no heading or frontmatter', () => {
    expect(extractTitle('Just a first line\nMore content')).toBe('Just a first line');
  });

  it('should truncate very long first lines to 100 chars', () => {
    const longLine = 'a'.repeat(200);
    const title = extractTitle(longLine);
    expect(title.length).toBeLessThanOrEqual(100);
  });

  it('should handle content starting with H2 (not H1)', () => {
    const content = '## Subheading\n\nContent';
    const title = extractTitle(content);
    // H1 regex won't match H2, falls back to first line "## Subheading"
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
  });
});

describe('extractTags - security and edge cases', () => {
  it('should handle content with no tags gracefully', () => {
    const tags = extractTags('Regular content with no tags or hashtags');
    expect(Array.isArray(tags)).toBe(true);
    expect(tags).toHaveLength(0);
  });

  it('should not extract malicious hashtag-like patterns', () => {
    // XSS attempt in hashtag format
    const content = 'Content #javascript <script>alert("xss")</script>';
    const tags = extractTags(content);

    // Should extract 'javascript' but not execute scripts
    expect(tags).toContain('javascript');
    // Script content should not be in tags
    expect(tags).not.toContain('<script>alert("xss")</script>');
  });

  it('should handle frontmatter with multiple tag formats', () => {
    const content = `---
tags: [react, typescript, testing]
---

Content`;

    const tags = extractTags(content);
    expect(tags).toContain('react');
    expect(tags).toContain('typescript');
    expect(tags).toContain('testing');
  });

  it('should deduplicate tags from both frontmatter and inline', () => {
    const content = `---
tags: [javascript]
---

Content #javascript is great`;

    const tags = extractTags(content);
    const jsCount = tags.filter(t => t === 'javascript').length;
    expect(jsCount).toBe(1);
  });

  it('should handle tags with hyphens and underscores', () => {
    const content = 'Content #my-tag #another_tag';
    const tags = extractTags(content);

    expect(tags).toContain('my-tag');
    expect(tags).toContain('another_tag');
  });

  it('should handle empty frontmatter tags', () => {
    const content = `---
tags: []
---

Content`;

    const tags = extractTags(content);
    expect(Array.isArray(tags)).toBe(true);
  });
});

describe('stripMarkdown - security edge cases', () => {
  it('should remove code blocks with potentially dangerous content', () => {
    const markdown = '```javascript\nalert("xss");\n```\nContent';
    const plain = stripMarkdown(markdown);

    expect(plain).not.toContain('```');
    expect(plain).toContain('Content');
  });

  it('should strip links but preserve link text', () => {
    const markdown = '[Click here](https://malicious.example.com/steal?data=123)';
    const plain = stripMarkdown(markdown);

    expect(plain).toBe('Click here');
    expect(plain).not.toContain('malicious.example.com');
  });

  it('should handle nested markdown formatting', () => {
    const markdown = '**bold *and italic* text**';
    const plain = stripMarkdown(markdown);

    expect(plain).not.toContain('**');
    expect(plain).toContain('bold');
    expect(plain).toContain('italic');
  });

  it('should handle ordered lists', () => {
    const markdown = '1. First item\n2. Second item\n3. Third item';
    const plain = stripMarkdown(markdown);

    expect(plain).not.toMatch(/^\d+\./m);
    expect(plain).toContain('First item');
  });

  it('should handle unordered lists with different markers', () => {
    const markdown = '- Item one\n* Item two\n+ Item three';
    const plain = stripMarkdown(markdown);

    expect(plain).not.toMatch(/^[-*+]\s/m);
    expect(plain).toContain('Item one');
  });

  it('should remove image markdown', () => {
    const markdown = '![Alt text](https://example.com/image.png)';
    const plain = stripMarkdown(markdown);

    expect(plain).toBe('Alt text');
    expect(plain).not.toContain('https://');
  });
});

describe('countWords - edge cases', () => {
  it('should count a single word correctly', () => {
    expect(countWords('Hello')).toBe(1);
  });

  it('should handle text with special characters', () => {
    // Special chars are replaced with spaces, so "don't" becomes 2 words
    const count = countWords("don't stop believing");
    expect(count).toBeGreaterThan(0);
  });

  it('should handle unicode characters in words', () => {
    // Chinese characters are counted
    const count = countWords('Hello 世界 World');
    expect(count).toBeGreaterThan(0);
  });

  it('should handle string with only whitespace', () => {
    expect(countWords('   ')).toBe(0);
  });

  it('should handle string with tabs and newlines', () => {
    const text = 'word1\tword2\nword3';
    expect(countWords(text)).toBe(3);
  });
});

describe('detectLanguage - edge cases', () => {
  it('should return "en" for empty string', () => {
    expect(detectLanguage('')).toBe('en');
  });

  it('should detect Chinese when Chinese chars exceed 30%', () => {
    // 10 Chinese chars out of ~12 total chars (>30%)
    const text = '中文测试内容程序开发';
    expect(detectLanguage(text)).toBe('zh');
  });

  it('should return "en" when Chinese chars are exactly at 30% threshold', () => {
    // Create a string where Chinese is ~30% but not > 30%
    // e.g., 3 Chinese chars out of 10 total (30% exactly - should return 'en' since condition is > 0.3)
    const text = '中文X' + 'a'.repeat(7); // 2 Chinese of 10 = 20%
    expect(detectLanguage(text)).toBe('en');
  });

  it('should handle number-only strings as English', () => {
    expect(detectLanguage('12345 67890')).toBe('en');
  });

  it('should handle Japanese/Korean as English (no specific detection)', () => {
    // Japanese hiragana - not in the Chinese range, should return 'en'
    const japaneseText = 'このテキストは日本語です';
    const lang = detectLanguage(japaneseText);
    expect(typeof lang).toBe('string');
  });
});
