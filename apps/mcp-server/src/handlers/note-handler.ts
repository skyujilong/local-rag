import type { NoteLookupInput, APIResponse } from '../types.js';
import { getMCPConfig } from '@local-rag/config/mcp';
import axios from 'axios';
import type { Note } from '@local-rag/shared/types';

const config = getMCPConfig();

export async function noteLookupHandler(input: NoteLookupInput): Promise<string> {
  try {
    const response = await axios.get(
      `${config.apiBaseUrl}/api/notes/search`,
      {
        params: { title: input.title },
      }
    );

    const data = response.data as APIResponse<Note[]>;
    if (!data.success) {
      return `错误: ${data.error?.message || '查找失败'}`;
    }

    const notes = data.data;
    if (!notes || !Array.isArray(notes) || notes.length === 0) {
      return `未找到标题包含 "${input.title}" 的笔记`;
    }

    let output = `找到 ${notes.length} 篇笔记:\n\n`;

    for (const note of notes) {
      output += `## ${note.title}\n`;
      if (note.tags && note.tags.length > 0) {
        output += `标签: ${note.tags.join(', ')}\n`;
      }
      output += `更新时间: ${new Date(note.updatedAt).toLocaleString('zh-CN')}\n\n`;
      output += `${note.content}\n\n`;
      output += `---\n\n`;
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
