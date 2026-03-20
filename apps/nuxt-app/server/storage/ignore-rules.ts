/**
 * 敏感文件忽略规则
 */

import path from 'path';
import { getAllIgnorePatterns } from '@local-rag/config/ignore';
import { matchesIgnorePattern } from '@local-rag/shared/utils';

/**
 * 检查路径是否应该被忽略
 * @param filePath - 文件绝对路径
 * @param customPatterns - 可选的自定义忽略模式
 * @returns 是否应该忽略该路径
 */
export function shouldIgnore(filePath: string, customPatterns?: string[]): boolean {
  const relativePath = path.relative(process.cwd(), filePath);

  // 使用自定义模式（如果提供）
  const patterns = customPatterns || getAllIgnorePatterns();

  return matchesIgnorePattern(relativePath, patterns);
}

/**
 * 获取所有忽略模式（默认 + 敏感 + 自定义）
 * @returns 忽略模式数组
 */
export function getIgnorePatterns(): string[] {
  return getAllIgnorePatterns();
}

/**
 * 更新忽略配置
 * @param rules - 包含自定义模式数组
 * @returns 更新后的所有忽略模式
 */
export function updateIgnoreConfig(rules: { custom?: string[] }): string[] {
  // 将自定义规则保存到环境变量
  if (rules.custom && Array.isArray(rules.custom)) {
    // 验证并过滤模式
    const validPatterns = rules.custom
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    process.env.CUSTOM_IGNORE_PATTERNS = validPatterns.join(',');
  }

  return getIgnorePatterns();
}

export { getAllIgnorePatterns };
