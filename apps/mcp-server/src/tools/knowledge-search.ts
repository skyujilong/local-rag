import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const knowledgeSearchTool: Tool = {
  name: 'knowledge_search',
  description: '搜索知识库中的文档标题和内容。用于查找特定主题的文档和代码。',
  inputSchema: {
    type: 'object',
    properties: {
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: '搜索关键词列表，例如：["React", "useState", "hook"]',
      },
    },
    required: ['keywords'],
  },
};
