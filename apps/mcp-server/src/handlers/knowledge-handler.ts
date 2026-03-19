import type { KnowledgeSearchInput, APIResponse } from '../types.js';
import { getMCPConfig } from '@local-rag/config/mcp';
import axios from 'axios';

const config = getMCPConfig();

export async function knowledgeSearchHandler(input: KnowledgeSearchInput): Promise<string> {
  try {
    const response = await axios.post(
      `${config.apiBaseUrl}/api/knowledge/search`,
      {
        keywords: input.keywords,
      }
    );

    const data = response.data as APIResponse;
    if (!data.success) {
      return `错误: ${data.error?.message || '搜索失败'}`;
    }

    const results = data.data;
    if (!results || !Array.isArray(results) || results.length === 0) {
      return '未找到匹配的文档';
    }

    let output = `找到 ${results.length} 个匹配文档:\n\n`;

    for (const doc of results) {
      output += `## ${doc.title}\n`;
      output += `类型: ${doc.metadata.type}\n`;
      if (doc.metadata.url) {
        output += `URL: ${doc.metadata.url}\n`;
      } else if (doc.metadata.filePath) {
        output += `路径: ${doc.metadata.filePath}\n`;
      }
      if (doc.metadata.tags && doc.metadata.tags.length > 0) {
        output += `标签: ${doc.metadata.tags.join(', ')}\n`;
      }
      output += `\n`;
    }

    return output;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return '无法连接到 API 服务器。请确保后端服务正在运行';
      }
      return `API 请求失败: ${error.message}`;
    }
    return `处理请求时出错: ${error instanceof Error ? error.message : String(error)}`;
  }
}
