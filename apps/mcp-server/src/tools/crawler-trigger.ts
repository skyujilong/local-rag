import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const crawlerTriggerTool: Tool = {
  name: 'crawler_trigger',
  description: '触发网页爬虫，将网页内容添加到知识库。支持需要登录的页面（扫码登录）。',
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要爬取的网页 URL',
      },
      waitForAuth: {
        type: 'boolean',
        description: '是否等待扫码登录，默认 false。设置为 true 时会打开浏览器等待用户扫码登录',
        default: false,
      },
    },
    required: ['url'],
  },
};
