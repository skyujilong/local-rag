/**
 * Tests for text processing utilities
 */

import { describe, it, expect } from 'vitest';
import { splitText, stripMarkdown, extractTags, extractTitle, countWords, detectLanguage } from './text.js';

describe('splitText', () => {
  it('should split text into chunks with overlap', () => {
    const text = 'a'.repeat(100);
    const chunks = splitText(text, 30, 10);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.length).toBeLessThanOrEqual(30);
    expect(chunks[0].start).toBe(0);
  });

  it('should handle empty text', () => {
    const chunks = splitText('', 100, 20);
    expect(chunks).toEqual([]);
  });

  it('should respect sentence boundaries', () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const chunks = splitText(text, 30, 5);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].content).toContain('.');
  });
});

describe('stripMarkdown', () => {
  it('should remove markdown headers', () => {
    const markdown = '# Header\n\nContent';
    const plain = stripMarkdown(markdown);

    expect(plain).not.toContain('#');
    expect(plain).toContain('Header');
    expect(plain).toContain('Content');
  });

  it('should remove bold and italic markers', () => {
    const markdown = '**bold** and *italic*';
    const plain = stripMarkdown(markdown);

    expect(plain).not.toContain('**');
    expect(plain).not.toContain('*');
    expect(plain).toContain('bold');
    expect(plain).toContain('italic');
  });

  it('should remove inline code markers', () => {
    const markdown = 'Code: `const x = 1;`';
    const plain = stripMarkdown(markdown);

    expect(plain).not.toContain('`');
    expect(plain).toContain('const x = 1;');
  });
});

describe('extractTags', () => {
  it('should extract tags from frontmatter', () => {
    const content = `---
tags: [javascript, nodejs, testing]
---

# Document

Content here.`;

    const tags = extractTags(content);

    expect(tags).toContain('javascript');
    expect(tags).toContain('nodejs');
    expect(tags).toContain('testing');
  });

  it('should extract inline hashtags', () => {
    const content = 'Some content #tag1 #tag2 more content';
    const tags = extractTags(content);

    expect(tags).toContain('tag1');
    expect(tags).toContain('tag2');
  });

  it('should remove duplicates', () => {
    const content = '#tag content #tag';
    const tags = extractTags(content);

    expect(tags.filter((t) => t === 'tag')).toHaveLength(1);
  });
});

describe('extractTitle', () => {
  it('should extract title from frontmatter', () => {
    const content = `---
title: "My Document"
---

Content`;

    const title = extractTitle(content);

    expect(title).toBe('My Document');
  });

  it('should extract title from first heading', () => {
    const content = '# My Heading\n\nContent';
    const title = extractTitle(content);

    expect(title).toBe('My Heading');
  });

  it('should use first line as fallback', () => {
    const content = 'First line\n\nMore content';
    const title = extractTitle(content);

    expect(title).toBe('First line');
  });
});

describe('countWords', () => {
  it('should count words in English text', () => {
    const text = 'Hello world this is a test';
    const count = countWords(text);

    expect(count).toBe(6);
  });

  it('should count words in Chinese text', () => {
    const text = '你好世界这是一个测试';
    const count = countWords(text);

    expect(count).toBeGreaterThan(0);
  });

  it('should handle empty text', () => {
    const count = countWords('');
    expect(count).toBe(0);
  });

  it('should ignore multiple spaces', () => {
    const text = 'word1  word2   word3';
    const count = countWords(text);

    expect(count).toBe(3);
  });
});

describe('detectLanguage', () => {
  it('should detect English text', () => {
    const text = 'This is English text with many words';
    const lang = detectLanguage(text);

    expect(lang).toBe('en');
  });

  it('should detect Chinese text', () => {
    const text = '这是中文文本包含许多汉字';
    const lang = detectLanguage(text);

    expect(lang).toBe('zh');
  });

  it('should default to English for mixed content', () => {
    const text = 'Mixed content with some 中文 characters';
    const lang = detectLanguage(text);

    expect(lang).toBe('en');
  });
});
