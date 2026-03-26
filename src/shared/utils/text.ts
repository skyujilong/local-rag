/**
 * Text processing utilities
 */

/**
 * Split text into chunks with overlap
 */
export function splitText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Array<{ content: string; index: number; start: number; end: number }> {
  const chunks: Array<{ content: string; index: number; start: number; end: number }> = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunkEnd = end;

    // Try to break at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + chunkSize / 2) {
        chunkEnd = breakPoint + 1;
      }
    }

    chunks.push({
      content: text.slice(start, chunkEnd).trim(),
      index: index++,
      start,
      end: chunkEnd,
    });

    start = chunkEnd - overlap;
  }

  return chunks;
}

/**
 * Extract plain text from markdown
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '') // Headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
    .replace(/\*([^*]+)\*/g, '$1') // Italic
    .replace(/`([^`]+)`/g, '$1') // Inline code
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images
    .replace(/^\s*[-*+]\s+/gm, '') // Lists
    .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines
    .trim();
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Extract tags from markdown frontmatter or content
 */
export function extractTags(content: string): string[] {
  const tags: string[] = [];

  // Extract from frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const tagMatch = frontmatterMatch[1].match(/tags:\s*\[(.*?)\]/);
    if (tagMatch) {
      const tagList = tagMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, ''));
      tags.push(...tagList);
    }
  }

  // Extract inline hashtags
  const hashtagMatches = content.matchAll(/#([a-zA-Z0-9_-]+)/g);
  for (const match of hashtagMatches) {
    tags.push(match[1]);
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Extract title from markdown
 */
export function extractTitle(content: string): string {
  // Try to get from frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const titleMatch = frontmatterMatch[1].match(/title:\s*"?(.*?)"?\s*$/m);
    if (titleMatch) {
      return titleMatch[1];
    }
  }

  // Try to get first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1];
  }

  // Use first line
  const firstLine = content.split('\n')[0];
  return firstLine.slice(0, 100);
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  const cleanText = text.replace(/[^\w\s\u4e00-\u9fa5]/g, ' ').trim();
  const words = cleanText.split(/\s+/);
  return words.filter((w) => w.length > 0).length;
}

/**
 * Detect language from text (simple heuristic)
 */
export function detectLanguage(text: string): string {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalChars = text.length;

  if (chineseChars / totalChars > 0.3) {
    return 'zh';
  }

  return 'en';
}
