/**
 * Local RAG API Server
 *
 * 后端 API 服务，提供笔记管理、知识库查询、爬虫等功能
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 加载环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 导入日志工具
import { createLogger, LogSystem } from '@local-rag/shared';

const logger = createLogger(LogSystem.API, 'main');

// 导入路由
import notesRouter from './routes/notes.js';
import knowledgeRouter from './routes/knowledge.js';
import crawlerRouter from './routes/crawler.js';
import ragRouter from './routes/rag.js';
import storageRouter from './routes/storage.js';

// 导入中间件
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';

const app = express();
const server = createServer(app);

// 创建 WebSocket 服务器（用于爬虫登录状态推送）
export const wss = new WebSocketServer({ server, path: '/ws' });

// 全局 WebSocket 客户端管理
const wsClients = new Set<any>();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  logger.info('WebSocket 客户端已连接', {
    clientCount: wsClients.size,
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    logger.info('WebSocket 客户端已断开', {
      clientCount: wsClients.size,
    });
  });

  ws.on('error', (error) => {
    logger.error('WebSocket 连接错误', error, {
      clientCount: wsClients.size,
    });
    wsClients.delete(ws);
  });
});

/**
 * 广播消息到所有 WebSocket 客户端
 */
export function broadcast(type: string, data: any) {
  const message = JSON.stringify({ type, data });

  // 记录广播的消息（使用 info 级别确保输出）
  if (type === 'crawler:task:updated') {
    logger.info('WebSocket 广播任务更新', {
      taskId: data.id,
      status: data.status,
      hasPreviewMarkdown: !!data.previewMarkdown,
      previewMarkdownLength: data.previewMarkdown?.length || 0,
      progress: data.progress,
      lastUpdatedAt: data.lastUpdatedAt,
      clientCount: wsClients.size,
    });
  }

  // 向所有连接的客户端发送消息，带错误处理
  const failedClients: Set<WebSocket> = new Set();
  for (const client of wsClients) {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(message);
      } catch (error) {
        logger.error('WebSocket 发送消息失败', error as Error);
        failedClients.add(client);
      }
    }
  }

  // 清理失败的客户端
  for (const client of failedClients) {
    wsClients.delete(client);
  }

  if (failedClients.size > 0) {
    logger.info('已清理失效的 WebSocket 连接', { count: failedClients.size });
  }
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(requestLogger);

// 静态文件服务（上传的图片）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/notes', notesRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/crawler', crawlerRouter);
app.use('/api/rag', ragRouter);
app.use('/api/storage', storageRouter);

// 错误处理
app.use(errorHandler);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路径 ${req.method} ${req.path} 不存在`,
    },
  });
});

// 启动服务器
const PORT = parseInt(process.env.API_PORT || '3001');
const HOST = process.env.API_HOST || 'localhost';

server.listen(PORT, HOST, () => {
  logger.info('API 服务器启动', {
    url: `http://${HOST}:${PORT}`,
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development',
  });
  logger.info('WebSocket 服务器启动', {
    url: `ws://${HOST}:${PORT}/ws`,
    path: '/ws',
  });

  // 初始化数据目录
  const dataPath = path.join(__dirname, '../data');
  const subdirs = ['documents', 'vector_store', 'sessions', 'notes'];

  for (const subdir of subdirs) {
    const dirPath = path.join(dataPath, subdir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.debug('创建数据目录', {
        path: dirPath,
        subdir,
      });
    }
  }

  const uploadsPath = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
    logger.debug('创建上传目录', {
      path: uploadsPath,
    });
  }
});

export default app;
