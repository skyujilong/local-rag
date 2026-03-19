/**
 * Markdown 文件索引器
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 索引 Markdown 文件
 */
export async function indexMarkdown(filePath: string): Promise<{
  content: string;
  language: string;
}> {
  const content = await fs.readFile(filePath, 'utf-8');

  // 提取 frontmatter（如果存在）
  let processedContent = content;
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    processedContent = content.substring(frontmatterMatch[0].length);
  }

  // 移除图片链接（但保留 alt 文本）
  processedContent = processedContent.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // 移除 HTML 标签
  processedContent = processedContent.replace(/<[^>]+>/g, '');

  return {
    content: processedContent.trim(),
    language: 'markdown',
  };
}

/**
 * 提取 Markdown 元数据
 */
export async function extractMarkdownMetadata(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8');

  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const metadata: Record<string, string> = {};

  frontmatter.split('\n').forEach(line => {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      metadata[match[1]] = match[2];
    }
  });

  return metadata;
}
