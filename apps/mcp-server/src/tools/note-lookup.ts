import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const noteLookupTool: Tool = {
  name: 'note_lookup',
  description: '查找特定笔记。用于检索用户的 Markdown 笔记内容。',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '笔记标题或部分标题，例如："React 学习" 会匹配 "React 学习笔记"',
      },
    },
    required: ['title'],
  },
};
