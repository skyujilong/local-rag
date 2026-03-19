/**
 * 知识库 API 路由
 */

import express from 'express';
import * as KnowledgeService from '../services/knowledge-base/document-manager.js';
import { createError } from '../middleware/error-handler.js';

const router = express.Router();

/**
 * GET /api/knowledge
 * 获取文档列表
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const type = req.query.type as string;
    const search = req.query.search as string;

    const result = await KnowledgeService.listDocuments({
      page,
      pageSize,
      type,
      search,
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
 * GET /api/knowledge/:id
 * 获取单个文档
 */
router.get('/:id', async (req, res, next) => {
  try {
    const document = await KnowledgeService.getDocument(req.params.id);

    if (!document) {
      throw createError(404, 'DOC_NOT_FOUND', '文档不存在');
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/knowledge/search
 * 搜索文档
 */
router.post('/search', async (req, res, next) => {
  try {
    const { keywords } = req.body;

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      throw createError(400, 'INVALID_INPUT', '请提供搜索关键词');
    }

    const documents = await KnowledgeService.searchDocuments(keywords);

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/knowledge/:id
 * 删除文档
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await KnowledgeService.deleteDocument(req.params.id);

    if (!deleted) {
      throw createError(404, 'DOC_NOT_FOUND', '文档不存在');
    }

    res.json({
      success: true,
      data: { id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/knowledge/reindex
 * 重新索引所有文档
 */
router.post('/reindex', async (req, res, next) => {
  try {
    await KnowledgeService.reindexAll();

    res.json({
      success: true,
      data: { message: '重新索引已启动' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
