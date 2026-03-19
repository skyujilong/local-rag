import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const ragQueryTool: Tool = {
  name: 'local_rag_query',
  description: '查询本地知识库，获取相关文档片段。用于回答编程相关问题时检索本地文档、笔记和代码。',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '查询问题，例如："如何使用 React hooks?" 或 "TypeScript 泛型用法"',
      },
      topK: {
        type: 'number',
        description: '返回结果数量，默认5',
        default: 5,
      },
    },
    required: ['query'],
  },
};
