/**
 * 代码文件索引器
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 语言映射
 */
const LANGUAGE_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.vue': 'vue',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.scala': 'scala',
  '.sh': 'shell',
  '.bash': 'bash',
  '.zsh': 'zsh',
  '.fish': 'fish',
  '.sql': 'sql',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'sass',
  '.less': 'less',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.toml': 'toml',
  '.ini': 'ini',
  '.dockerfile': 'dockerfile',
};

/**
 * 索引代码文件
 */
export async function indexCode(filePath: string): Promise<{
  content: string;
  language: string;
}> {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  const language = LANGUAGE_MAP[ext] || 'unknown';

  // 移除单行注释
  let processedContent = content;

  // 根据语言移除注释
  if (['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'swift', 'scala', 'kotlin'].includes(language)) {
    // 移除 // 单行注释
    processedContent = processedContent.replace(/\/\/.*$/gm, '');
    // 移除 /* */ 多行注释
    processedContent = processedContent.replace(/\/\*[\s\S]*?\*\//g, '');
  } else if (language === 'python') {
    // 移除 # 单行注释
    processedContent = processedContent.replace(/#.*$/gm, '');
    // 移除 """ """ 多行字符串/注释
    processedContent = processedContent.replace(/"""[\s\S]*?"""/g, '');
  } else if (['shell', 'bash', 'zsh', 'fish'].includes(language)) {
    // 移除 # 注释
    processedContent = processedContent.replace(/#.*$/gm, '');
  } else if (language === 'sql') {
    // 移除 -- 注释
    processedContent = processedContent.replace(/--.*$/gm, '');
    // 移除 /* */ 注释
    processedContent = processedContent.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  // 移除空行
  processedContent = processedContent.replace(/^\s*\n/gm, '');

  return {
    content: processedContent.trim(),
    language,
  };
}

/**
 * 提取代码元数据
 */
export async function extractCodeMetadata(filePath: string) {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath).toLowerCase();
  const language = LANGUAGE_MAP[ext] || 'unknown';

  const lines = content.split('\n');

  return {
    language,
    lineCount: lines.length,
    hasImports: /import|require|use|include/i.test(content),
    hasExports: /export|module\.exports/i.test(content),
  };
}
