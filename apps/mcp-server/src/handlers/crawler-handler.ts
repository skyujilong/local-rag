import type { CrawlerTriggerInput, APIResponse } from '../types.js';
import { getMCPConfig } from '@local-rag/config/mcp';
import axios from 'axios';
import type { CrawlerTask } from '@local-rag/shared/types';

const config = getMCPConfig();

export async function crawlerTriggerHandler(input: CrawlerTriggerInput): Promise<string> {
  try {
    const response = await axios.post(
      `${config.apiBaseUrl}/api/crawler/start`,
      {
        url: input.url,
        waitForAuth: input.waitForAuth || false,
      }
    );

    const data = response.data as APIResponse<CrawlerTask>;
    if (!data.success) {
      return `错误: ${data.error?.message || '启动爬虫失败'}`;
    }

    const task = data.data!;
    let output = `爬虫任务已创建 (ID: ${task.id})\n\n`;
    output += `URL: ${task.url}\n`;
    output += `状态: ${getStatusText(task.status)}\n`;

    if (task.waitForAuth && task.status === 'waiting_auth') {
      output += `\n该页面需要登录。请在前端界面打开爬虫面板完成扫码登录。\n`;
      output += `登录完成后爬虫将自动继续。\n`;
    } else if (task.status === 'running') {
      output += `\n爬虫正在运行中...\n`;
    } else if (task.status === 'completed') {
      output += `\n爬取完成! 共获取 ${task.documentCount || 0} 个文档。\n`;
    } else if (task.status === 'failed') {
      output += `\n爬取失败: ${task.error || '未知错误'}\n`;
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

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '等待中',
    running: '运行中',
    waiting_auth: '等待登录',
    completed: '已完成',
    failed: '失败',
  };
  return statusMap[status] || status;
}
