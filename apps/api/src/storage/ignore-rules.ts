/**
 * 敏感文件忽略规则
 */

import path from 'path';
import { getIgnoreConfig, getAllIgnorePatterns } from '@local-rag/config/ignore';
import { matchesIgnorePattern } from '@local-rag/shared/utils';

/**
 * 检查路径是否应该被忽略
 */
export function shouldIgnore(filePath: string, customPatterns?: string[]): boolean {
  const relativePath = path.relative(process.cwd(), filePath);

  // 使用自定义模式（如果提供）
  const patterns = customPatterns || getAllIgnorePatterns();

  return matchesIgnorePattern(relativePath, patterns);
}

/**
 * 获取忽略配置
 */
export async function getIgnoreConfig() {
  return getIgnoreConfig();
}

/**
 * 更新忽略配置
 */
export async function updateIgnoreConfig(rules: { custom?: string[] }) {
  // 将自定义规则保存到环境变量或配置文件
  if (rules.custom) {
    process.env.CUSTOM_IGNORE_PATTERNS = rules.custom.join(',');
  }

  return getIgnoreConfig();
}

export { getAllIgnorePatterns };
