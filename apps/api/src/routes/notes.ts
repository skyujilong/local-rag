/**
 * 笔记 API 路由
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import * as NotesService from '../services/notes/note-manager.js';
import * as ImageHandler from '../services/notes/image-handler.js';
import { createError } from '../middleware/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// 配置图片上传
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads'),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, 'img-' + uniqueSuffix + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);

    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPEG、PNG、GIF、WebP 格式的图片'));
    }
  },
});

/**
 * GET /api/notes
 * 获取笔记列表
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const tag = req.query.tag as string;
    const search = req.query.search as string;

    const result = await NotesService.listNotes({ page, pageSize, tag, search });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/notes/:id
 * 获取单个笔记
 */
router.get('/:id', async (req, res, next) => {
  try {
    const note = await NotesService.getNote(req.params.id);

    if (!note) {
      throw createError(404, 'NOTE_NOT_FOUND', '笔记不存在');
    }

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notes
 * 创建笔记
 */
router.post('/', async (req, res, next) => {
  try {
    const { title, content, tags } = req.body;

    if (!title || !content) {
      throw createError(400, 'INVALID_INPUT', '标题和内容不能为空');
    }

    const note = await NotesService.createNote({
      title,
      content,
      tags: tags || [],
    });

    res.status(201).json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/notes/:id
 * 更新笔记
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { title, content, tags } = req.body;

    const note = await NotesService.updateNote(req.params.id, {
      title,
      content,
      tags,
    });

    if (!note) {
      throw createError(404, 'NOTE_NOT_FOUND', '笔记不存在');
    }

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notes/:id
 * 删除笔记
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await NotesService.deleteNote(req.params.id);

    if (!deleted) {
      throw createError(404, 'NOTE_NOT_FOUND', '笔记不存在');
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
 * GET /api/notes/search
 * 搜索笔记
 */
router.get('/search', async (req, res, next) => {
  try {
    const title = req.query.title as string;

    if (!title) {
      throw createError(400, 'INVALID_INPUT', '搜索关键词不能为空');
    }

    const notes = await NotesService.searchNotesByTitle(title);

    res.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/notes/:id/images
 * 上传图片到笔记
 */
router.post('/:id/images', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw createError(400, 'NO_FILE', '请选择要上传的图片');
    }

    const imageData = await ImageHandler.saveImage(req.file);
    const note = await NotesService.addImageToNote(req.params.id, imageData);

    if (!note) {
      throw createError(404, 'NOTE_NOT_FOUND', '笔记不存在');
    }

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/notes/:id/images/:imageId
 * 删除笔记中的图片
 */
router.delete('/:id/images/:imageId', async (req, res, next) => {
  try {
    const note = await NotesService.removeImageFromNote(
      req.params.id,
      req.params.imageId
    );

    if (!note) {
      throw createError(404, 'NOTE_NOT_FOUND', '笔记不存在');
    }

    // 删除文件
    await ImageHandler.deleteImage(req.params.imageId);

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
