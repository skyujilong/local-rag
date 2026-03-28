/**
 * Documents API Routes
 *
 * 定义所有 Documents 功能相关的 API 端点
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { notesService } from '../services/notes.service.js';
import { searchService } from '../services/search.service.js';
import type {
  CreateNoteRequest,
  UpdateNoteRequest,
  NotesListQuery,
  SearchRequest,
  CreateTagRequest,
  UpdateTagRequest,
  ApiResponse,
} from '../../../../shared/types/documents.js';
import { createLogger } from '../../../../shared/utils/logger.js';

const log = createLogger('features:documents:api');
const routes = new Hono();

// ID 格式校验 — 拒绝包含路径遍历或特殊字符的 ID
const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateId(c: any): string | null {
  const id = c.req.param('id');
  if (!id || !ID_REGEX.test(id)) {
    return null;
  }
  return id;
}

// ========== 笔记管理 API ==========

/**
 * 创建笔记
 * POST /api/documents/notes
 */
routes.post('/notes', async (c) => {
  try {
    const body = await c.req.json();

    // 验证请求体
    const schema = z.object({
      title: z.string().min(1, '标题不能为空'),
      content: z.string().min(1, '内容不能为空'),
      tags: z.array(z.string()).optional(),
    });

    const validated = schema.parse(body);
    const request: CreateNoteRequest = validated;

    const note = await notesService.createNote(request);

    const response: ApiResponse<typeof note> = {
      success: true,
      data: note,
      vectorization: {
        status: 'pending',
        message: '向量化已启动，预计 3 秒完成',
      },
    };

    return c.json(response, 201);
  } catch (error) {
    log.error('创建笔记失败:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: error.errors[0].message,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建笔记失败',
      },
      500
    );
  }
});

/**
 * 更新笔记
 * PUT /api/documents/notes/:id
 */
routes.put('/notes/:id', async (c) => {
  try {
    const id = validateId(c);
    if (!id) {
      return c.json({ success: false, error: '无效的 ID 格式' }, 400);
    }
    const body = await c.req.json();

    // 验证请求体
    const schema = z.object({
      title: z.string().optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }).refine((data) => data.title || data.content || data.tags, {
      message: '至少需要提供一个要更新的字段',
    });

    const validated = schema.parse(body);
    const request: UpdateNoteRequest = validated;

    const note = await notesService.updateNote(id, request);

    const response: ApiResponse<typeof note> = {
      success: true,
      data: note,
      vectorization: {
        status: 'pending',
        message: '重新向量化已启动',
      },
    };

    return c.json(response);
  } catch (error) {
    log.error('更新笔记失败:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: error.errors[0].message,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新笔记失败',
      },
      error instanceof Error && error.message.includes('不存在') ? 404 : 500
    );
  }
});

/**
 * 删除笔记
 * DELETE /api/documents/notes/:id
 */
routes.delete('/notes/:id', async (c) => {
  try {
    const id = validateId(c);
    if (!id) {
      return c.json({ success: false, error: '无效的 ID 格式' }, 400);
    }

    await notesService.deleteNote(id);

    return c.json({
      success: true,
      message: '笔记已删除',
    });
  } catch (error) {
    log.error('删除笔记失败:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除笔记失败',
      },
      error instanceof Error && error.message.includes('不存在') ? 404 : 500
    );
  }
});

/**
 * 获取笔记详情
 * GET /api/documents/notes/:id
 */
routes.get('/notes/:id', async (c) => {
  try {
    const id = validateId(c);
    if (!id) {
      return c.json({ success: false, error: '无效的 ID 格式' }, 400);
    }

    const note = await notesService.getNote(id);

    if (!note) {
      return c.json(
        {
          success: false,
          error: '笔记不存在',
        },
        404
      );
    }

    const response: ApiResponse<typeof note> = {
      success: true,
      data: note,
    };

    return c.json(response);
  } catch (error) {
    log.error('获取笔记失败:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取笔记失败',
      },
      500
    );
  }
});

/**
 * 获取笔记列表
 * GET /api/documents/notes
 */
routes.get('/notes', async (c) => {
  try {
    const query: NotesListQuery = {
      tags: c.req.query('tags'),
      sort: (c.req.query('sort') as any) || undefined,
      order: (c.req.query('order') as any) || undefined,
      page: c.req.query('page') ? parseInt(c.req.query('page')!) : undefined,
      limit: c.req.query('limit') ? parseInt(c.req.query('limit')!) : undefined,
    };

    const result = await notesService.getNotesList(query);

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('获取笔记列表失败:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取笔记列表失败',
      },
      500
    );
  }
});

/**
 * 手动触发向量化
 * POST /api/documents/notes/:id/vectorize
 */
routes.post('/notes/:id/vectorize', async (c) => {
  try {
    const id = validateId(c);
    if (!id) {
      return c.json({ success: false, error: '无效的 ID 格式' }, 400);
    }
    // TODO: 实现手动触发生效
    void id;
    return c.json({
      success: true,
      message: '向量化已触发',
    });
  } catch (error) {
    log.error('触发向量化失败:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '触发向量化失败',
      },
      500
    );
  }
});

// ========== 标签管理 API ==========

/**
 * 获取所有标签
 * GET /api/documents/tags
 */
routes.get('/tags', async (c) => {
  try {
    const result = await notesService.getTagsList();

    return c.json({
      success: true,
      data: result,
    });
  } catch (error) {
    log.error('获取标签列表失败:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取标签列表失败',
      },
      500
    );
  }
});

/**
 * 创建标签
 * POST /api/documents/tags
 */
routes.post('/tags', async (c) => {
  try {
    const body = await c.req.json();

    // 验证请求体
    const schema = z.object({
      name: z.string().min(1, '标签名称不能为空'),
      color: z.string().optional(),
    });

    const validated = schema.parse(body);
    const request: CreateTagRequest = validated;

    const tag = await notesService.createTag(request);

    const response: ApiResponse<typeof tag> = {
      success: true,
      data: tag,
    };

    return c.json(response, 201);
  } catch (error) {
    log.error('创建标签失败:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: error.errors[0].message,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建标签失败',
      },
      error instanceof Error && error.message.includes('已存在') ? 409 : 500
    );
  }
});

/**
 * 更新标签
 * PUT /api/documents/tags/:id
 */
routes.put('/tags/:id', async (c) => {
  try {
    const id = validateId(c);
    if (!id) {
      return c.json({ success: false, error: '无效的 ID 格式' }, 400);
    }
    const body = await c.req.json();

    // 验证请求体
    const schema = z.object({
      name: z.string().optional(),
      color: z.string().optional(),
    }).refine((data) => data.name || data.color, {
      message: '至少需要提供一个要更新的字段',
    });

    const validated = schema.parse(body);
    const request: UpdateTagRequest = validated;

    const tag = await notesService.updateTag(id, request);

    const response: ApiResponse<typeof tag> = {
      success: true,
      data: tag,
    };

    return c.json(response);
  } catch (error) {
    log.error('更新标签失败:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: error.errors[0].message,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新标签失败',
      },
      error instanceof Error && error.message.includes('不存在') ? 404 : 500
    );
  }
});

/**
 * 删除标签
 * DELETE /api/documents/tags/:id
 */
routes.delete('/tags/:id', async (c) => {
  try {
    const id = validateId(c);
    if (!id) {
      return c.json({ success: false, error: '无效的 ID 格式' }, 400);
    }

    const updatedCount = await notesService.deleteTag(id);

    return c.json({
      success: true,
      message: '标签已删除',
      updatedDocuments: updatedCount,
    });
  } catch (error) {
    log.error('删除标签失败:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除标签失败',
      },
      error instanceof Error && error.message.includes('不存在') ? 404 : 500
    );
  }
});

/**
 * 获取标签下的笔记
 * GET /api/documents/tags/:id/documents
 */
routes.get('/tags/:id/documents', async (c) => {
  try {
    const id = validateId(c);
    if (!id) {
      return c.json({ success: false, error: '无效的 ID 格式' }, 400);
    }
    // TODO: 实现根据标签ID获取笔记
    void id;
    return c.json({
      success: true,
      data: {
        total: 0,
        documents: [],
      },
    });
  } catch (error) {
    log.error('获取标签笔记失败:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取标签笔记失败',
      },
      500
    );
  }
});

// ========== 搜索 API ==========

/**
 * 语义搜索
 * POST /api/documents/search
 */
routes.post('/search', async (c) => {
  try {
    const body = await c.req.json();

    // 验证请求体
    const schema = z.object({
      query: z.string().min(1, '搜索内容不能为空'),
      tags: z.array(z.string()).optional(),
      limit: z.number().optional(),
    });

    const validated = schema.parse(body);
    const request: SearchRequest = validated;

    const result = await searchService.hybridSearch(request);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error('搜索失败:', error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: error.errors[0].message,
        },
        400
      );
    }

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '搜索失败',
      },
      500
    );
  }
});

/**
 * 搜索建议
 * GET /api/documents/search/suggest
 */
routes.get('/search/suggest', async (c) => {
  try {
    // TODO: 实现搜索建议功能
    // Extract query parameter but don't use it yet
    c.req.query('q');
    return c.json({
      success: true,
      suggestions: [],
    });
  } catch (error) {
    log.error('获取搜索建议失败:', error);

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取搜索建议失败',
      },
      500
    );
  }
});

export { routes };
