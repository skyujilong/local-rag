/**
 * API Routes 测试
 *
 * 测试重点：
 * - 创建笔记：请求验证（空标题/内容 -> 400）、成功场景 -> 201
 * - 更新笔记：注意不存在的笔记 -> 404
 * - 删除笔记：不存在 -> 404，成功 -> 200
 * - 获取笔记详情：不存在 -> 404，成功 -> 200
 * - 获取笔记列表：默认参数
 * - 搜索：请求验证（空 query -> 400）
 * - 标签管理：创建/更新/删除标签 API
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';

// =====================================================
// Mock services
// =====================================================

const mockCreateNote = vi.fn();
const mockUpdateNote = vi.fn();
const mockDeleteNote = vi.fn();
const mockGetNote = vi.fn();
const mockGetNotesList = vi.fn();
const mockCreateTag = vi.fn();
const mockUpdateTag = vi.fn();
const mockDeleteTag = vi.fn();
const mockGetTagsList = vi.fn();
const mockHybridSearch = vi.fn();

vi.mock('../services/notes.service.js', () => ({
  notesService: {
    createNote: (...args: any[]) => mockCreateNote(...args),
    updateNote: (...args: any[]) => mockUpdateNote(...args),
    deleteNote: (...args: any[]) => mockDeleteNote(...args),
    getNote: (...args: any[]) => mockGetNote(...args),
    getNotesList: (...args: any[]) => mockGetNotesList(...args),
    createTag: (...args: any[]) => mockCreateTag(...args),
    updateTag: (...args: any[]) => mockUpdateTag(...args),
    deleteTag: (...args: any[]) => mockDeleteTag(...args),
    getTagsList: (...args: any[]) => mockGetTagsList(...args),
  },
}));

vi.mock('../services/search.service.js', () => ({
  searchService: {
    hybridSearch: (...args: any[]) => mockHybridSearch(...args),
  },
}));

vi.mock('../../../../shared/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// =====================================================
// 导入路由并构建测试 App
// =====================================================
import { routes } from '../api/routes.js';

const app = new Hono();
app.route('/', routes);

/**
 * 发送 HTTP 请求到测试 App
 */
async function request(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: any
): Promise<Response> {
  const url = `http://localhost${path}`;
  const options: RequestInit = {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  };
  return app.fetch(new Request(url, options));
}

// =====================================================
// 工厂函数
// =====================================================

function makeNote(id = 'note-123') {
  return {
    id,
    title: '测试笔记',
    content: '# 标题\n\n内容',
    tags: ['react'],
    filePath: `/tmp/.devrag/notes/${id}.md`,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

// =====================================================
// 测试套件
// =====================================================

describe('Documents API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================================================
  // POST /notes - 创建笔记
  // ==================================================
  describe('POST /notes', () => {
    it('应该成功创建笔记，返回 201', async () => {
      const note = makeNote();
      mockCreateNote.mockResolvedValue(note);

      const res = await request('POST', '/notes', {
        title: '测试笔记',
        content: '内容内容',
        tags: ['react'],
      });

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('note-123');
      expect(body.vectorization).toBeDefined();
      expect(body.vectorization.status).toBe('pending');
    });

    it('空标题应返回 400', async () => {
      const res = await request('POST', '/notes', {
        title: '',
        content: '内容',
      });

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    it('空内容应返回 400', async () => {
      const res = await request('POST', '/notes', {
        title: '标题',
        content: '',
      });

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });

    it('缺少必需字段应返回 400', async () => {
      const res = await request('POST', '/notes', {
        title: '标题',
        // 缺少 content
      });

      expect(res.status).toBe(400);
    });

    it('service 抛出错误时应返回 500', async () => {
      mockCreateNote.mockRejectedValue(new Error('磁盘写入失败'));

      const res = await request('POST', '/notes', {
        title: '标题',
        content: '内容',
      });

      expect(res.status).toBe(500);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
      expect(body.error).toContain('磁盘写入失败');
    });
  });

  // ==================================================
  // PUT /notes/:id - 更新笔记
  // ==================================================
  describe('PUT /notes/:id', () => {
    it('应该成功更新笔记，返回 200', async () => {
      const note = makeNote();
      mockUpdateNote.mockResolvedValue(note);

      const res = await request('PUT', '/notes/note-123', {
        title: '新标题',
      });

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.vectorization.status).toBe('pending');
    });

    it('不存在的笔记应返回 404', async () => {
      mockUpdateNote.mockRejectedValue(new Error('笔记不存在: non-existent'));

      const res = await request('PUT', '/notes/non-existent', {
        title: '新标题',
      });

      expect(res.status).toBe(404);
    });

    it('请求体不含任何更新字段应返回 400', async () => {
      const res = await request('PUT', '/notes/note-123', {});

      expect(res.status).toBe(400);
    });
  });

  // ==================================================
  // DELETE /notes/:id - 删除笔记
  // ==================================================
  describe('DELETE /notes/:id', () => {
    it('应该成功删除笔记，返回 200', async () => {
      mockDeleteNote.mockResolvedValue(undefined);

      const res = await request('DELETE', '/notes/note-123');

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
    });

    it('不存在的笔记应返回 404', async () => {
      mockDeleteNote.mockRejectedValue(new Error('笔记不存在: non-existent'));

      const res = await request('DELETE', '/notes/non-existent');

      expect(res.status).toBe(404);
    });
  });

  // ==================================================
  // GET /notes/:id - 获取笔记详情
  // ==================================================
  describe('GET /notes/:id', () => {
    it('应该成功返回笔记详情，返回 200', async () => {
      mockGetNote.mockResolvedValue(makeNote());

      const res = await request('GET', '/notes/note-123');

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('note-123');
    });

    it('笔记不存在应返回 404', async () => {
      mockGetNote.mockResolvedValue(null);

      const res = await request('GET', '/notes/non-existent');

      expect(res.status).toBe(404);
      const body = await res.json() as any;
      expect(body.success).toBe(false);
    });
  });

  // ==================================================
  // GET /notes - 笔记列表
  // ==================================================
  describe('GET /notes', () => {
    it('应该返回笔记列表，返回 200', async () => {
      mockGetNotesList.mockResolvedValue({
        total: 2,
        page: 1,
        limit: 20,
        documents: [makeNote('n1'), makeNote('n2')],
      });

      const res = await request('GET', '/notes');

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.total).toBe(2);
    });

    it('service 失败应返回 500', async () => {
      mockGetNotesList.mockRejectedValue(new Error('读取失败'));

      const res = await request('GET', '/notes');

      expect(res.status).toBe(500);
    });
  });

  // ==================================================
  // POST /notes/:id/vectorize - 手动触发向量化
  // ==================================================
  describe('POST /notes/:id/vectorize', () => {
    it('应该返回 200 成功', async () => {
      const res = await request('POST', '/notes/note-123/vectorize');

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
    });
  });

  // ==================================================
  // 标签 API
  // ==================================================
  describe('标签 API', () => {
    describe('GET /tags', () => {
      it('应该返回标签列表，返回 200', async () => {
        mockGetTagsList.mockResolvedValue({
          total: 2,
          tags: [
            { id: 'tag-1', name: 'react', count: 3 },
            { id: 'tag-2', name: 'vue', count: 1 },
          ],
        });

        const res = await request('GET', '/tags');

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.data.total).toBe(2);
      });
    });

    describe('POST /tags', () => {
      it('应该成功创建标签，返回 201', async () => {
        mockCreateTag.mockResolvedValue({
          id: 'tag-new',
          name: 'typescript',
          createdAt: new Date(),
        });

        const res = await request('POST', '/tags', { name: 'typescript' });

        expect(res.status).toBe(201);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.data.name).toBe('typescript');
      });

      it('空标签名应返回 400', async () => {
        const res = await request('POST', '/tags', { name: '' });

        expect(res.status).toBe(400);
      });

      it('重复标签应返回 409', async () => {
        mockCreateTag.mockRejectedValue(new Error('标签已存在: duplicate'));

        const res = await request('POST', '/tags', { name: 'duplicate' });

        expect(res.status).toBe(409);
      });
    });

    describe('PUT /tags/:id', () => {
      it('应该成功更新标签，返回 200', async () => {
        mockUpdateTag.mockResolvedValue({
          id: 'tag-1',
          name: 'js',
          createdAt: new Date(),
        });

        const res = await request('PUT', '/tags/tag-1', { name: 'js' });

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
      });

      it('不存在的标签应返回 404', async () => {
        mockUpdateTag.mockRejectedValue(new Error('标签不存在: non-existent'));

        const res = await request('PUT', '/tags/non-existent', { name: 'js' });

        expect(res.status).toBe(404);
      });

      it('请求体不含更新字段应返回 400', async () => {
        const res = await request('PUT', '/tags/tag-1', {});

        expect(res.status).toBe(400);
      });
    });

    describe('DELETE /tags/:id', () => {
      it('应该成功删除标签，返回 200', async () => {
        mockDeleteTag.mockResolvedValue(2); // 影响了 2 条笔记

        const res = await request('DELETE', '/tags/tag-1');

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.updatedDocuments).toBe(2);
      });

      it('不存在的标签应返回 404', async () => {
        mockDeleteTag.mockRejectedValue(new Error('标签不存在: non-existent'));

        const res = await request('DELETE', '/tags/non-existent');

        expect(res.status).toBe(404);
      });
    });

    describe('GET /tags/:id/documents', () => {
      it('应该返回 200 和空数据（TODO 未实现）', async () => {
        const res = await request('GET', '/tags/tag-1/documents');

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
      });
    });
  });

  // ==================================================
  // 搜索 API
  // ==================================================
  describe('搜索 API', () => {
    describe('POST /search', () => {
      it('应该成功执行搜索，返回 200', async () => {
        mockHybridSearch.mockResolvedValue({
          query: 'React 教程',
          strategy: 'full',
          data: { total: 1, results: [] },
          meta: { stage1Results: 0, stage2Triggered: false, totalTime: 50 },
        });

        const res = await request('POST', '/search', {
          query: 'React 教程',
        });

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.query).toBe('React 教程');
      });

      it('空 query 应返回 400', async () => {
        const res = await request('POST', '/search', { query: '' });

        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.success).toBe(false);
      });

      it('缺少 query 字段应返回 400', async () => {
        const res = await request('POST', '/search', { tags: ['react'] });

        expect(res.status).toBe(400);
      });

      it('有标签的搜索应正确传递 tags 参数', async () => {
        mockHybridSearch.mockResolvedValue({
          query: 'React',
          strategy: 'filtered',
          data: { total: 0, results: [] },
          meta: { stage1Results: 0, stage2Triggered: false, totalTime: 30 },
        });

        await request('POST', '/search', {
          query: 'React',
          tags: ['react', 'tutorial'],
          limit: 5,
        });

        expect(mockHybridSearch).toHaveBeenCalledWith({
          query: 'React',
          tags: ['react', 'tutorial'],
          limit: 5,
        });
      });

      it('search service 失败应返回 500', async () => {
        mockHybridSearch.mockRejectedValue(new Error('向量搜索失败'));

        const res = await request('POST', '/search', { query: '查询' });

        expect(res.status).toBe(500);
      });
    });

    describe('GET /search/suggest', () => {
      it('应该返回 200 和空建议（TODO 未实现）', async () => {
        const res = await request('GET', '/search/suggest?q=React');

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.suggestions).toEqual([]);
      });
    });
  });
});
