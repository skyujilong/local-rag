/**
 * 存储管理 API 路由
 */

import express from 'express';
import * as StorageService from '../storage/index.js';
import { createError } from '../middleware/error-handler.js';

const router = express.Router();

/**
 * GET /api/storage/files
 * 获取已索引的文件列表
 */
router.get('/files', async (req, res, next) => {
  try {
    const path = req.query.path as string;
    const files = await StorageService.listIndexedFiles(path);

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/storage/index
 * 索引文件或目录
 */
router.post('/index', async (req, res, next) => {
  try {
    const { path: filePath, recursive = true } = req.body;

    if (!filePath) {
      throw createError(400, 'INVALID_INPUT', '请提供文件路径');
    }

    const result = await StorageService.indexPath(filePath, recursive);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/storage/files/:documentId
 * 删除已索引的文件
 */
router.delete('/files/:documentId', async (req, res, next) => {
  try {
    await StorageService.removeIndexedFile(req.params.documentId);

    res.json({
      success: true,
      data: { message: '文件已删除' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/storage/ignore
 * 获取忽略规则
 */
router.get('/ignore', async (req, res, next) => {
  try {
    const rules = await StorageService.getIgnoreRules();

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/storage/ignore
 * 更新忽略规则
 */
router.put('/ignore', async (req, res, next) => {
  try {
    const { custom } = req.body;

    if (!Array.isArray(custom)) {
      throw createError(400, 'INVALID_INPUT', 'custom 必须是数组');
    }

    const rules = await StorageService.updateIgnoreRules({ custom });

    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
