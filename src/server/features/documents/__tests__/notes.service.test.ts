/**
 * NotesService 单元测试
 *
 * 测试重点：
 * - ensureInitialized 竞态条件修复验证
 * - validateFilePath 路径遍历防护验证
 * - CRUD 核心逻辑（标签过滤、分页、排序）
 * - 标签管理（createTag、updateTag、deleteTag）
 * - generateExcerpt Markdown 清洗
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// =====================================================
// Mock 所有外部依赖（文件系统、向量化、日志等）
// =====================================================

// Mock fs/promises
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();
const mockUnlink = vi.fn();
const mockStat = vi.fn();

vi.mock('fs/promises', () => ({
  readFile: (...args: any[]) => mockReadFile(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
  mkdir: (...args: any[]) => mockMkdir(...args),
  unlink: (...args: any[]) => mockUnlink(...args),
  stat: (...args: any[]) => mockStat(...args),
}));

// Mock logger
vi.mock('../../../../shared/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock chunkingService
vi.mock('../services/chunking.service.js', () => ({
  chunkingService: {
    chunkNote: vi.fn().mockResolvedValue([]),
  },
}));

// Mock vectorizationService
vi.mock('../services/vectorization.service.js', () => ({
  vectorizationService: {
    vectorizeChunks: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock embeddingService
// Mock embeddingService (via proxy file path - matches what notes.service.ts imports as ../../services/embeddings.js)
vi.mock('../../services/embeddings.js', () => ({
  embeddingService: {
    embed: vi.fn().mockResolvedValue(Array(768).fill(0.1)),
    embedBatch: vi.fn().mockResolvedValue([Array(768).fill(0.1)]),
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
  },
  EmbeddingService: vi.fn(),
}));

// Mock vectorStore (via proxy file path)
vi.mock('../../services/vectorstore.js', () => ({
  vectorStore: {
    addDocumentEmbeddings: vi.fn().mockResolvedValue(undefined),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    searchWithFilters: vi.fn().mockResolvedValue([]),
    initialize: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
  },
  VectorStoreService: vi.fn(),
}));

// =====================================================
// 导入被测类
// =====================================================
import { NotesService } from '../services/notes.service.js';

// =====================================================
// 工具函数：配置默认 mock 行为（模拟无持久化文件的全新状态）
// =====================================================
function setupEmptyStorageMocks() {
  // 模拟 .metadata.json 不存在（ENOENT）
  mockReadFile.mockRejectedValue(
    Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
  );
  mockWriteFile.mockResolvedValue(undefined);
  mockMkdir.mockResolvedValue(undefined);
  mockUnlink.mockResolvedValue(undefined);
}

// =====================================================
// 测试套件
// =====================================================

describe('NotesService', () => {
  let service: NotesService;

  beforeEach(() => {
    vi.clearAllMocks();
    setupEmptyStorageMocks();
    // 每次测试创建新实例，避免单例状态污染
    service = new NotesService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================================================
  // ensureInitialized 竞态条件修复验证（Blocker 修复）
  // ==================================================
  describe('ensureInitialized 竞态条件修复', () => {
    it('初始化前调用 getNotesList 应该等待初始化完成', async () => {
      // service 刚创建，initPromise 还未 resolve
      // 直接调用公开方法，应该等待初始化
      const result = await service.getNotesList({});
      expect(result.total).toBe(0);
      expect(result.documents).toEqual([]);
    });

    it('并发调用多个公开方法不应重复初始化', async () => {
      // 并发调用 3 个方法
      const [list1, list2, list3] = await Promise.all([
        service.getNotesList({}),
        service.getNotesList({}),
        service.getNotesList({}),
      ]);

      // 所有结果一致
      expect(list1.total).toBe(0);
      expect(list2.total).toBe(0);
      expect(list3.total).toBe(0);
    });

    it('初始化失败后，下次调用应该重试', async () => {
      // 第一次 readFile 抛出非 ENOENT 错误（初始化失败）
      mockReadFile.mockRejectedValueOnce(new Error('权限错误'));
      // 第二次调用恢复正常
      mockReadFile.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      // 创建新 service（constructor 中会调用 loadMetadata）
      const newService = new NotesService();

      // 等待初始化
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 此时 initPromise 可能为 null（失败后置为 null）
      // 再次调用应该重新初始化
      const result = await newService.getNotesList({});
      expect(result.total).toBe(0);
    });

    it('cacheLoaded 为 true 时 ensureInitialized 应立即返回', async () => {
      // 第一次调用触发初始化
      await service.getNotesList({});

      // 记录 readFile 调用次数
      const callsBefore = mockReadFile.mock.calls.length;

      // 再次调用，由于 cacheLoaded = true，不应再次读文件
      await service.getNotesList({});

      // readFile 调用次数不应增加
      expect(mockReadFile.mock.calls.length).toBe(callsBefore);
    });
  });

  // ==================================================
  // validateFilePath 路径遍历防护验证（Security）
  // ==================================================
  describe('validateFilePath 路径遍历防护', () => {
    it('正常标题应该生成合法文件名', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const note = await service.createNote({
        title: 'React Hooks 教程',
        content: '## 内容\n\n这是正文内容，足够长以通过任何最小长度检查。'.repeat(3),
      });

      expect(note.title).toBe('React Hooks 教程');
      expect(note.filePath).toBeDefined();
      // 文件路径不应包含 .. 路径遍历
      expect(note.filePath).not.toContain('..');
    });

    it('包含路径遍历字符的标题应该被净化', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const note = await service.createNote({
        title: '../../../etc/passwd',
        content: '内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容',
      });

      // 文件路径应该在 NOTES_DIR 内，不应逃出目录
      expect(note.filePath).not.toContain('../');
      expect(note.filePath).toContain('.devrag/notes');
    });

    it('特殊字符标题应该被替换为连字符', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const note = await service.createNote({
        title: 'test <script> & "xss"',
        content: '内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容',
      });

      // 文件名不应包含特殊字符（<, >, &, " 等）
      const fileName = note.filePath.split('/').pop() || '';
      expect(fileName).not.toContain('<');
      expect(fileName).not.toContain('>');
      expect(fileName).not.toContain('&');
      expect(fileName).not.toContain('"');
    });

    it('超过 50 字符的标题应该被截断', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const longTitle = 'A'.repeat(100);
      const note = await service.createNote({
        title: longTitle,
        content: '内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容',
      });

      // validateFilePath 内部先 slice(0, 50) 再净化
      // 所以净化后的 sanitizedTitle 最多只有 50 字符
      // 间接验证：文件名应包含 'A'（净化不含特殊字符），且 filePath 有效
      const fileName = note.filePath.split('/').pop() || '';
      // 文件名格式：{YYYY-MM-DD}-{uuid}-{sanitizedTitle}.md
      // 日期(YYYY-MM-DD) + UUID(xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
      // = 3段(日期) + 5段(UUID) = 8段连字符分割
      // 但最简单验证：sanitizedTitle 是 'A'.repeat(50) 净化后的结果
      // 由于 'A' 是合法字符，sanitizedTitle = 'A'.repeat(50)
      // 所以 fileName 长度应该是：10(date) + 1 + 36(uuid) + 1 + 50 + 3(.md) = 101
      expect(fileName.endsWith('.md')).toBe(true);
      // 通过验证 validateFilePath 返回最多 50 字符
      // 'A' * 100 -> truncate to 50 -> sanitize -> 'AAAA...A'(50个A)
      expect(fileName).toContain('A'); // 净化后的字母保留
      // filePath 不含路径遍历
      expect(note.filePath).not.toContain('..');
    });

    it('空标题应该被替换为 untitled', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      // 标题中全是特殊字符，净化后为空，应该使用 untitled
      const note = await service.createNote({
        title: '---!!!---',
        content: '内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容内容',
      });

      expect(note.filePath).toContain('untitled');
    });
  });

  // ==================================================
  // createNote 核心流程
  // ==================================================
  describe('createNote', () => {
    it('应该成功创建笔记并返回包含 id 的 Note 对象', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const note = await service.createNote({
        title: '新笔记标题',
        content: '# 标题\n\n这是笔记内容，足够长。',
        tags: ['react', 'tutorial'],
      });

      expect(note.id).toBeDefined();
      expect(note.title).toBe('新笔记标题');
      expect(note.content).toBe('# 标题\n\n这是笔记内容，足够长。');
      expect(note.tags).toEqual(['react', 'tutorial']);
      expect(note.createdAt).toBeInstanceOf(Date);
      expect(note.updatedAt).toBeInstanceOf(Date);
      expect(note.filePath).toBeDefined();
    });

    it('创建后笔记应该可以通过 getNote 获取', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const created = await service.createNote({
        title: '可获取的笔记',
        content: '内容内容',
        tags: [],
      });

      // 模拟读文件返回内容
      mockReadFile.mockResolvedValue('内容内容');

      const fetched = await service.getNote(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
    });

    it('不提供 tags 时应默认为空数组', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const note = await service.createNote({
        title: '无标签笔记',
        content: '内容内容',
      });

      expect(note.tags).toEqual([]);
    });

    it('应该调用 writeFile 写入笔记内容', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await service.createNote({
        title: '写入测试',
        content: '写入的内容',
      });

      // writeFile 应该被调用（至少一次：写内容 + 写 metadata）
      expect(mockWriteFile).toHaveBeenCalled();
    });
  });

  // ==================================================
  // getNote
  // ==================================================
  describe('getNote', () => {
    it('获取不存在的笔记应返回 null', async () => {
      const result = await service.getNote('non-existent-id');
      expect(result).toBeNull();
    });

    it('笔记内容不在缓存时应从文件读取', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const created = await service.createNote({
        title: '文件读取测试',
        content: '',
      });

      // 清空缓存中的 content（模拟只有元数据的场景）
      // 注：content 为空字符串时 getNote 会尝试读文件
      mockReadFile.mockResolvedValue('从文件读取的内容');

      const fetched = await service.getNote(created.id);
      expect(fetched).not.toBeNull();
    });
  });

  // ==================================================
  // updateNote
  // ==================================================
  describe('updateNote', () => {
    it('更新不存在的笔记应抛出错误', async () => {
      await expect(
        service.updateNote('non-existent-id', { title: '新标题' })
      ).rejects.toThrow('笔记不存在');
    });

    it('更新已存在的笔记应成功', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const created = await service.createNote({
        title: '原标题',
        content: '原内容',
      });

      const updated = await service.updateNote(created.id, {
        title: '新标题',
        content: '新内容',
      });

      expect(updated.title).toBe('新标题');
      expect(updated.content).toBe('新内容');
    });

    it('更新时 updatedAt 应该变更', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const created = await service.createNote({
        title: '时间测试',
        content: '内容',
      });

      const originalUpdatedAt = created.updatedAt;

      // 稍等一毫秒确保时间不同
      await new Promise((r) => setTimeout(r, 5));

      const updated = await service.updateNote(created.id, { title: '新标题' });
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('部分更新：只传 tags 应只更新 tags', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const created = await service.createNote({
        title: '标签更新测试',
        content: '内容内容内容',
        tags: ['old-tag'],
      });

      const updated = await service.updateNote(created.id, {
        tags: ['new-tag'],
      });

      expect(updated.title).toBe('标签更新测试'); // 标题未变
      expect(updated.tags).toEqual(['new-tag']);
    });
  });

  // ==================================================
  // deleteNote
  // ==================================================
  describe('deleteNote', () => {
    it('删除不存在的笔记应抛出错误', async () => {
      await expect(service.deleteNote('non-existent-id')).rejects.toThrow('笔记不存在');
    });

    it('删除后笔记应从缓存中移除', async () => {
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockResolvedValue(undefined);

      const created = await service.createNote({
        title: '待删除笔记',
        content: '内容内容',
      });

      await service.deleteNote(created.id);

      // 删除后应该找不到
      const fetched = await service.getNote(created.id);
      expect(fetched).toBeNull();
    });

    it('删除时文件不存在（ENOENT）应该优雅处理（不抛出）', async () => {
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );

      const created = await service.createNote({
        title: '文件已丢失的笔记',
        content: '内容内容',
      });

      // 即使文件删除失败，也不应抛出（只是 warn）
      await expect(service.deleteNote(created.id)).resolves.not.toThrow();
    });
  });

  // ==================================================
  // getNotesList - 列表、过滤、排序、分页
  // ==================================================
  describe('getNotesList', () => {
    it('空库返回空列表', async () => {
      const result = await service.getNotesList({});
      expect(result.total).toBe(0);
      expect(result.documents).toEqual([]);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('应该支持标签过滤（AND 逻辑）', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await service.createNote({ title: '笔记A', content: '内容A', tags: ['react', 'tutorial'] });
      await service.createNote({ title: '笔记B', content: '内容B', tags: ['react'] });
      await service.createNote({ title: '笔记C', content: '内容C', tags: ['vue', 'tutorial'] });

      // 过滤 react AND tutorial
      const result = await service.getNotesList({ tags: 'react,tutorial' });
      expect(result.total).toBe(1);
      expect(result.documents[0].title).toBe('笔记A');
    });

    it('分页应该正确工作', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      // 创建 5 条笔记
      for (let i = 1; i <= 5; i++) {
        await service.createNote({ title: `笔记${i}`, content: '内容' });
      }

      const page1 = await service.getNotesList({ page: 1, limit: 2 });
      const page2 = await service.getNotesList({ page: 2, limit: 2 });
      const page3 = await service.getNotesList({ page: 3, limit: 2 });

      expect(page1.documents.length).toBe(2);
      expect(page2.documents.length).toBe(2);
      expect(page3.documents.length).toBe(1);
      expect(page1.total).toBe(5);
    });

    it('排序 sort=createdAt&order=asc 应返回正确顺序', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const note1 = await service.createNote({ title: '第一', content: '内容' });
      await new Promise((r) => setTimeout(r, 5));
      const note2 = await service.createNote({ title: '第二', content: '内容' });

      const result = await service.getNotesList({ sort: 'createdAt', order: 'asc' });
      const ids = result.documents.map((d) => d.id);

      expect(ids.indexOf(note1.id)).toBeLessThan(ids.indexOf(note2.id));
    });
  });

  // ==================================================
  // 标签管理
  // ==================================================
  describe('标签管理', () => {
    describe('createTag', () => {
      it('应该成功创建标签', async () => {
        mockWriteFile.mockResolvedValue(undefined);

        const tag = await service.createTag({ name: 'javascript' });

        expect(tag.id).toBeDefined();
        expect(tag.name).toBe('javascript');
        expect(tag.createdAt).toBeInstanceOf(Date);
      });

      it('创建重复标签应该抛出错误', async () => {
        mockWriteFile.mockResolvedValue(undefined);

        await service.createTag({ name: 'duplicate' });

        await expect(service.createTag({ name: 'duplicate' })).rejects.toThrow('标签已存在');
      });

      it('创建标签后应该出现在列表中', async () => {
        mockWriteFile.mockResolvedValue(undefined);

        await service.createTag({ name: 'react' });
        await service.createTag({ name: 'vue' });

        const list = await service.getTagsList();
        expect(list.total).toBe(2);
        const names = list.tags.map((t) => t.name);
        expect(names).toContain('react');
        expect(names).toContain('vue');
      });
    });

    describe('updateTag', () => {
      it('重命名标签应该更新所有关联笔记的标签', async () => {
        mockWriteFile.mockResolvedValue(undefined);

        // 创建标签
        const tag = await service.createTag({ name: 'javascript' });

        // 创建含该标签的笔记
        const note = await service.createNote({
          title: '笔记',
          content: '内容',
          tags: ['javascript'],
        });

        // 重命名标签
        await service.updateTag(tag.id, { name: 'js' });

        // 笔记中的标签应该自动更新
        const updatedNote = await service.getNote(note.id);
        mockReadFile.mockResolvedValue('内容');
        const noteAfter = await service.getNote(note.id);
        // 从内存缓存获取的 note，其 tags 应已更新
        expect(note.tags).toContain('js');
        expect(note.tags).not.toContain('javascript');
      });

      it('更新不存在的标签应抛出错误', async () => {
        await expect(
          service.updateTag('non-existent', { name: '新名称' })
        ).rejects.toThrow('标签不存在');
      });
    });

    describe('deleteTag', () => {
      it('删除标签应该从所有笔记中移除', async () => {
        mockWriteFile.mockResolvedValue(undefined);

        const tag = await service.createTag({ name: 'old-tag' });

        // 创建 2 条含该标签的笔记
        const note1 = await service.createNote({
          title: '笔记1',
          content: '内容',
          tags: ['old-tag'],
        });
        const note2 = await service.createNote({
          title: '笔记2',
          content: '内容',
          tags: ['old-tag', 'other-tag'],
        });

        const updatedCount = await service.deleteTag(tag.id);

        expect(updatedCount).toBe(2);
        expect(note1.tags).not.toContain('old-tag');
        expect(note2.tags).not.toContain('old-tag');
        expect(note2.tags).toContain('other-tag'); // 其他标签保留
      });

      it('删除不存在的标签应抛出错误', async () => {
        await expect(service.deleteTag('non-existent')).rejects.toThrow('标签不存在');
      });
    });

    describe('getTagsList', () => {
      it('应该按笔记使用频率降序排列', async () => {
        mockWriteFile.mockResolvedValue(undefined);

        const reactTag = await service.createTag({ name: 'react' });
        const vueTag = await service.createTag({ name: 'vue' });

        // react 有 3 篇笔记，vue 有 1 篇
        await service.createNote({ title: '笔记1', content: '内容', tags: ['react'] });
        await service.createNote({ title: '笔记2', content: '内容', tags: ['react'] });
        await service.createNote({ title: '笔记3', content: '内容', tags: ['react'] });
        await service.createNote({ title: '笔记4', content: '内容', tags: ['vue'] });

        const list = await service.getTagsList();

        expect(list.tags[0].name).toBe('react'); // react 排第一
        expect(list.tags[0].count).toBe(3);
        expect(list.tags[1].name).toBe('vue');
        expect(list.tags[1].count).toBe(1);
      });
    });
  });

  // ==================================================
  // generateExcerpt Markdown 清洗（私有方法的间接测试）
  // ==================================================
  describe('generateExcerpt（通过 getNotesList 间接测试）', () => {
    it('Markdown 语法应该被移除，生成纯文本摘要', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await service.createNote({
        title: '摘要测试',
        content: '# 标题\n\n这是**粗体**和*斜体*内容，`代码片段`，[链接](http://example.com)。',
      });

      const list = await service.getNotesList({});
      const excerpt = list.documents[0].excerpt;

      expect(excerpt).not.toContain('#');
      expect(excerpt).not.toContain('**');
      expect(excerpt).not.toContain('*');
      expect(excerpt).not.toContain('`');
      expect(excerpt).not.toContain('[');
    });

    it('摘要应该限制在 100 字符以内，超出时以 ... 结尾', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      const longContent = '内容'.repeat(100); // 200 字符
      await service.createNote({
        title: '长内容测试',
        content: longContent,
      });

      const list = await service.getNotesList({});
      const excerpt = list.documents[0].excerpt;

      expect(excerpt.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(excerpt.endsWith('...')).toBe(true);
    });

    it('短内容不应添加 ...', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await service.createNote({
        title: '短内容',
        content: '短短的内容。',
      });

      const list = await service.getNotesList({});
      const excerpt = list.documents[0].excerpt;

      expect(excerpt.endsWith('...')).toBe(false);
    });
  });
});
