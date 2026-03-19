/**
 * 文本文件索引器
 */

import fs from 'fs/promises';

/**
 * 索引文本文件
 */
export async function indexText(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return content;
}

/**
 * 获取文本文件信息
 */
export async function getTextFileInfo(filePath: string) {
  const stat = await fs.stat(filePath);
  const content = await fs.readFile(filePath, 'utf-8');

  return {
    size: stat.size,
    lineCount: content.split('\n').length,
    charCount: content.length,
    encoding: 'utf-8',
  };
}
