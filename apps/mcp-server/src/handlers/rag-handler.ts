import type { RAGQueryInput, APIResponse } from '../types.js';
import { getMCPConfig } from '@local-rag/config/mcp';
import axios from 'axios';

const config = getMCPConfig();

export async function ragQueryHandler(input: RAGQueryInput): Promise<string> {
  try {
    const response = await axios.post(
      `${config.apiBaseUrl}/api/rag/query`,
      {
        query: input.query,
        topK: input.topK || 5,
      }
    );

    const data = response.data as APIResponse;
    if (!data.success) {
      return `错误: ${data.error?.message || '查询失败'}`;
    }

    const results = data.data;
    if (!results || !Array.isArray(results.results) || results.results.length === 0) {
      return '未找到相关文档';
    }

    let output = `找到 ${results.totalResults} 个相关文档:\n\n`;

    for (const item of results.results) {
      output += `## ${item.metadata.title || '无标题'}\n`;
      output += `**相关度**: ${(item.score * 100).toFixed(1)}%\n\n`;
      output += `${item.content}\n\n`;
      if (item.metadata.url) {
        output += `来源: ${item.metadata.url}\n`;
      } else if (item.metadata.filePath) {
        output += `来源: ${item.metadata.filePath}\n`;
      }
      output += `---\n\n`;
    }

    return output;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        return '无法连接到 API 服务器。请确保后端服务正在运行 (pnpm dev:api)';
      }
      return `API 请求失败: ${error.message}`;
    }
    return `处理请求时出错: ${error instanceof Error ? error.message : String(error)}`;
  }
}
