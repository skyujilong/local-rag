/**
 * 会话管理 - 管理爬虫登录会话
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import type { CrawlerSession, Cookie } from '@local-rag/shared/types';
import { getCrawlerConfig } from '@local-rag/config/crawler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = getCrawlerConfig();

/**
 * 获取会话文件路径
 */
function getSessionPath(domain: string): string {
  const safeName = domain.replace(/[^a-zA-Z0-9.-]/g, '_');
  return path.join(config.auth.sessionPath, `${safeName}.json`);
}

/**
 * 确保会话目录存在
 */
async function ensureSessionsDir() {
  try {
    await fs.access(config.auth.sessionPath);
  } catch {
    await fs.mkdir(config.auth.sessionPath, { recursive: true });
  }
}

/**
 * 保存会话
 */
export async function saveSession(domain: string, page: any): Promise<void> {
  await ensureSessionsDir();

  const cookies = await page.context().cookies();
  const localStorage = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        items[key] = localStorage.getItem(key) || '';
      }
    }
    return items;
  });

  const session: CrawlerSession = {
    domain,
    createdAt: new Date(),
    updatedAt: new Date(),
    cookies: cookies.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
    })),
    localStorage,
    userAgent: await page.evaluate(() => navigator.userAgent),
  };

  const sessionPath = getSessionPath(domain);
  await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
}

/**
 * 加载会话
 */
export async function loadSession(domain: string): Promise<CrawlerSession | null> {
  await ensureSessionsDir();

  try {
    const sessionPath = getSessionPath(domain);
    const content = await fs.readFile(sessionPath, 'utf-8');
    const session = JSON.parse(content) as CrawlerSession;
    session.createdAt = new Date(session.createdAt as any);
    session.updatedAt = new Date(session.updatedAt as any);
    return session;
  } catch {
    return null;
  }
}

/**
 * 删除会话
 */
export async function deleteSession(domain: string): Promise<void> {
  await ensureSessionsDir();

  try {
    const sessionPath = getSessionPath(domain);
    await fs.unlink(sessionPath);
  } catch {
    // 会话不存在，忽略
  }
}

/**
 * 列出所有会话
 */
export async function listSessions(): Promise<CrawlerSession[]> {
  await ensureSessionsDir();

  try {
    const files = await fs.readdir(config.auth.sessionPath);
    const sessionFiles = files.filter(f => f.endsWith('.json'));

    const sessions: CrawlerSession[] = [];

    for (const file of sessionFiles) {
      try {
        const content = await fs.readFile(path.join(config.auth.sessionPath, file), 'utf-8');
        const session = JSON.parse(content) as CrawlerSession;
        session.createdAt = new Date(session.createdAt as any);
        session.updatedAt = new Date(session.updatedAt as any);
        sessions.push(session);
      } catch (error) {
        console.error(`读取会话文件 ${file} 失败:`, error);
      }
    }

    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch {
    return [];
  }
}
