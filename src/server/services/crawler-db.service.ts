/**
 * Crawler Database Service
 *
 * 管理 SQLite 数据库，用于存储爬取任务、认证配置、检查点等
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { createLogger } from '../../shared/utils/logger.js';
import type {
  CrawlTask,
  CrawlResult,
  AuthProfile,
  TaskCheckpoint,
  UrlIndexItem,
} from '../../shared/types/crawler.js';

const log = createLogger('server:services:crawler-db');

// 数据库路径
const DB_PATH = join(process.cwd(), '.devrag', 'crawl.db');

/**
 * Crawler Database Service 类
 */
export class CrawlerDbService {
  private db: Database.Database | null = null;
  private initialized = false;

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 确保目录存在
      const dbDir = join(process.cwd(), '.devrag');
      if (!existsSync(dbDir)) {
        await mkdir(dbDir, { recursive: true });
      }

      // 打开数据库
      this.db = new Database(DB_PATH);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      // 创建表
      this.createTables();

      this.initialized = true;
      log.info(`Crawler database initialized: ${DB_PATH}`);
    } catch (error) {
      log.error('Failed to initialize crawler database', error);
      throw error;
    }
  }

  /**
   * 创建表结构
   */
  private createTables(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // 爬取任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS crawl_tasks (
        task_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK(mode IN ('single', 'sitemap', 'recursive')),
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed', 'auth_expired')),
        current_index INTEGER DEFAULT 0,
        total_urls INTEGER NOT NULL,
        auth_profile_id TEXT,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        paused_at TEXT,
        error TEXT,
        FOREIGN KEY (auth_profile_id) REFERENCES auth_profiles(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_status ON crawl_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON crawl_tasks(created_at DESC);
    `);

    // 爬取结果表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS crawl_results (
        result_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        url TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'pending', 'auth_expired')),
        title TEXT,
        content TEXT,
        word_count INTEGER,
        quality_score REAL CHECK(quality_score BETWEEN 0 AND 1),
        imported_at TEXT,
        retry_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES crawl_tasks(task_id) ON DELETE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_results_task_url ON crawl_results(task_id, url);
      CREATE INDEX IF NOT EXISTS idx_results_status ON crawl_results(task_id, status);
    `);

    // 认证配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS auth_profiles (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('cookie', 'header', 'browser')),
        name TEXT NOT NULL,
        encrypted_data TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_used_at TEXT,
        expires_at TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_domain ON auth_profiles(domain);
      CREATE INDEX IF NOT EXISTS idx_auth_last_used ON auth_profiles(last_used_at DESC);
    `);

    // 断点续爬检查点表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_checkpoints (
        task_id TEXT PRIMARY KEY,
        url_index INTEGER NOT NULL,
        checkpoint_data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES crawl_tasks(task_id) ON DELETE CASCADE
      );
    `);

    // URL 索引表（用于重复检测）
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS url_index (
        url TEXT PRIMARY KEY,
        note_id TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        crawl_count INTEGER DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_url_seen ON url_index(last_seen_at DESC);
    `);
  }

  /**
   * ===== 任务管理 =====
   */

  /**
   * 创建任务
   */
  createTask(task: CrawlTask): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT INTO crawl_tasks (
        task_id, mode, status, current_index, total_urls, auth_profile_id,
        config, created_at, updated_at, paused_at, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.taskId,
      task.mode,
      task.status,
      task.currentIndex,
      task.totalUrls,
      task.authProfileId || null,
      JSON.stringify(task.config),
      task.createdAt.toISOString(),
      task.updatedAt.toISOString(),
      task.pausedAt?.toISOString() || null,
      task.error || null
    );
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): CrawlTask | null {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('SELECT * FROM crawl_tasks WHERE task_id = ?');
    const row = stmt.get(taskId) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToTask(row);
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(
    taskId: string,
    status: string,
    currentIndex?: number,
    error?: string
  ): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      UPDATE crawl_tasks
      SET status = ?, current_index = ?, updated_at = ?, error = ?
      WHERE task_id = ?
    `);

    stmt.run(
      status,
      currentIndex,
      new Date().toISOString(),
      error || null,
      taskId
    );
  }

  /**
   * 获取所有任务
   */
  getAllTasks(status?: string): CrawlTask[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    let sql = 'SELECT * FROM crawl_tasks';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((row) => this.mapRowToTask(row));
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('DELETE FROM crawl_tasks WHERE task_id = ?');
    stmt.run(taskId);
  }

  /**
   * ===== 结果管理 =====
   */

  /**
   * 创建结果
   */
  createResult(result: CrawlResult): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT INTO crawl_results (
        result_id, task_id, url, status, title, content, word_count,
        quality_score, imported_at, retry_count, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      result.resultId,
      result.taskId,
      result.url,
      result.status,
      result.title || null,
      result.content || null,
      result.wordCount || null,
      result.qualityScore || null,
      result.importedAt?.toISOString() || null,
      result.retryCount,
      result.errorMessage || null,
      result.createdAt.toISOString()
    );
  }

  /**
   * 获取任务的所有结果
   */
  getTaskResults(taskId: string): CrawlResult[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('SELECT * FROM crawl_results WHERE task_id = ? ORDER BY created_at ASC');
    const rows = stmt.all(taskId) as any[];

    return rows.map((row) => this.mapRowToResult(row));
  }

  /**
   * 更新结果状态
   */
  updateResultStatus(resultId: string, status: string, content?: string, title?: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      UPDATE crawl_results
      SET status = ?, content = ?, title = ?
      WHERE result_id = ?
    `);

    stmt.run(status, content || null, title || null, resultId);
  }

  /**
   * ===== 认证配置管理 =====
   */

  /**
   * 创建认证配置
   */
  createAuthProfile(profile: AuthProfile): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT INTO auth_profiles (
        id, domain, type, name, encrypted_data, created_at, last_used_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      profile.id,
      profile.domain,
      profile.type,
      profile.name,
      profile.encryptedData,
      profile.createdAt.toISOString(),
      profile.lastUsedAt?.toISOString() || null,
      profile.expiresAt?.toISOString() || null
    );
  }

  /**
   * 获取认证配置
   */
  getAuthProfile(id: string): AuthProfile | null {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('SELECT * FROM auth_profiles WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToAuthProfile(row);
  }

  /**
   * 根据域名获取认证配置
   */
  getAuthProfileByDomain(domain: string): AuthProfile | null {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('SELECT * FROM auth_profiles WHERE domain = ?');
    const row = stmt.get(domain) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToAuthProfile(row);
  }

  /**
   * 获取所有认证配置
   */
  getAllAuthProfiles(): AuthProfile[] {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('SELECT * FROM auth_profiles ORDER BY last_used_at DESC');
    const rows = stmt.all() as any[];

    return rows.map((row) => this.mapRowToAuthProfile(row));
  }

  /**
   * 更新认证配置最后使用时间
   */
  updateAuthProfileLastUsed(id: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('UPDATE auth_profiles SET last_used_at = ? WHERE id = ?');
    stmt.run(new Date().toISOString(), id);
  }

  /**
   * 删除认证配置
   */
  deleteAuthProfile(id: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('DELETE FROM auth_profiles WHERE id = ?');
    stmt.run(id);
  }

  /**
   * ===== 检查点管理 =====
   */

  /**
   * 保存检查点
   */
  saveCheckpoint(checkpoint: TaskCheckpoint): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO task_checkpoints (task_id, url_index, checkpoint_data, updated_at)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      checkpoint.taskId,
      checkpoint.urlIndex,
      JSON.stringify(checkpoint.checkpointData),
      checkpoint.updatedAt.toISOString()
    );
  }

  /**
   * 获取检查点
   */
  getCheckpoint(taskId: string): TaskCheckpoint | null {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('SELECT * FROM task_checkpoints WHERE task_id = ?');
    const row = stmt.get(taskId) as any;

    if (!row) {
      return null;
    }

    return {
      taskId: row.task_id,
      urlIndex: row.url_index,
      checkpointData: JSON.parse(row.checkpoint_data),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * 删除检查点
   */
  deleteCheckpoint(taskId: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('DELETE FROM task_checkpoints WHERE task_id = ?');
    stmt.run(taskId);
  }

  /**
   * ===== URL 索引管理 =====
   */

  /**
   * 检查 URL 是否已存在
   */
  urlExists(url: string): UrlIndexItem | null {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stmt = this.db.prepare('SELECT * FROM url_index WHERE url = ?');
    const row = stmt.get(url) as any;

    if (!row) {
      return null;
    }

    return {
      url: row.url,
      noteId: row.note_id,
      firstSeenAt: new Date(row.first_seen_at),
      lastSeenAt: new Date(row.last_seen_at),
      crawlCount: row.crawl_count,
    };
  }

  /**
   * 创建或更新 URL 索引
   */
  upsertUrlIndex(url: string, noteId?: string): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const existing = this.urlExists(url);

    if (existing) {
      // 更新
      const stmt = this.db.prepare(`
        UPDATE url_index
        SET note_id = ?, last_seen_at = ?, crawl_count = crawl_count + 1
        WHERE url = ?
      `);
      stmt.run(noteId || null, new Date().toISOString(), url);
    } else {
      // 创建
      const stmt = this.db.prepare(`
        INSERT INTO url_index (url, note_id, first_seen_at, last_seen_at, crawl_count)
        VALUES (?, ?, ?, ?, 1)
      `);
      stmt.run(url, noteId || null, new Date().toISOString(), new Date().toISOString());
    }
  }

  /**
   * ===== 辅助方法 =====
   */

  /**
   * 映射数据库行到 CrawlTask 对象
   */
  private mapRowToTask(row: any): CrawlTask {
    return {
      taskId: row.task_id,
      mode: row.mode,
      status: row.status,
      currentIndex: row.current_index,
      totalUrls: row.total_urls,
      urls: [], // URLs 存储在单独的表中
      authProfileId: row.auth_profile_id,
      config: JSON.parse(row.config),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      pausedAt: row.paused_at ? new Date(row.paused_at) : undefined,
      error: row.error,
    };
  }

  /**
   * 映射数据库行到 CrawlResult 对象
   */
  private mapRowToResult(row: any): CrawlResult {
    return {
      resultId: row.result_id,
      taskId: row.task_id,
      url: row.url,
      status: row.status,
      title: row.title,
      content: row.content,
      wordCount: row.word_count,
      qualityScore: row.quality_score,
      importedAt: row.imported_at ? new Date(row.imported_at) : undefined,
      retryCount: row.retry_count,
      errorMessage: row.error_message,
      createdAt: new Date(row.created_at),
    };
  }

  /**
   * 映射数据库行到 AuthProfile 对象
   */
  private mapRowToAuthProfile(row: any): AuthProfile {
    return {
      id: row.id,
      domain: row.domain,
      type: row.type,
      name: row.name,
      encryptedData: row.encrypted_data,
      createdAt: new Date(row.created_at),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    };
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
      log.info('Crawler database closed');
    }
  }
}

// 导出单例
export const crawlerDbService = new CrawlerDbService();
