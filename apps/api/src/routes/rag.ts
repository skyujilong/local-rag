/**
 * RAG 查询 API 路由
 */

import express from 'express';
import * as RAGService from '../rag/index.js';
import { createError } from '../middleware/error-handler.js';

const router = express.Router();

/**
 * POST /api/rag/query
 * RAG 查询
 */
router.post('/query', async (req, res, next) => {
  try {
    const { query, topK = 5, threshold, searchType } = req.body;

    if (!query || typeof query !== 'string') {
      throw createError(400, 'INVALID_INPUT', '请提供查询内容');
    }

    const result = await RAGService.query({
      query,
      topK,
      threshold,
      searchType,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rag/index
 * 添加文档到索引
 */
router.post('/index', async (req, res, next) => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      throw createError(400, 'INVALID_INPUT', '请提供文档 ID');
    }

    await RAGService.indexDocument(documentId);

    res.json({
      success: true,
      data: { message: '文档已添加到索引' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/rag/index/:documentId
 * 从索引中删除文档
 */
router.delete('/index/:documentId', async (req, res, next) => {
  try {
    await RAGService.removeFromIndex(req.params.documentId);

    res.json({
      success: true,
      data: { message: '文档已从索引中删除' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
