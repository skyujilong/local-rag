#!/usr/bin/env node
/**
 * Local RAG MCP Server
 *
 * MCP Server 适配 Claude CLI，提供本地知识库查询能力
 *
 * 使用方法:
 * 1. 构建: pnpm build:mcp
 * 2. 配置 .claude/settings.json
 * 3. 在 Claude CLI 中使用 @local-rag 前缀调用工具
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import * as tools from './tools/index.js';
import * as handlers from './handlers/index.js';

/**
 * 创建 MCP Server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: 'local-rag-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * 处理工具列表请求
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        tools.ragQueryTool,
        tools.knowledgeSearchTool,
        tools.noteLookupTool,
        tools.crawlerTriggerTool,
      ],
    };
  });

  /**
   * 处理工具调用请求
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'local_rag_query':
          result = await handlers.ragQueryHandler(args);
          break;

        case 'knowledge_search':
          result = await handlers.knowledgeSearchHandler(args);
          break;

        case 'note_lookup':
          result = await handlers.noteLookupHandler(args);
          break;

        case 'crawler_trigger':
          result = await handlers.crawlerTriggerHandler(args);
          break;

        default:
          return {
            content: [
              {
                type: 'text',
                text: `未知工具: ${name}`,
              },
            ],
            isError: true,
          };
      }

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `处理工具调用时出错: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * 主函数
 */
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // stderr 用于调试日志（不会干扰 MCP 通信）
  console.error('Local RAG MCP Server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
