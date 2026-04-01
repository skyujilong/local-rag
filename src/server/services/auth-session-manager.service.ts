/**
 * Auth Session Manager Service
 *
 * 管理浏览器登录会话、Cookie/Token 提取和注入
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { createLogger } from '../../shared/utils/logger.js';
import { encryptionUtil } from '../utils/encryption.js';
import { crawlerDbService } from './crawler-db.service.js';
import type {
  AuthProfile,
  AuthType,
  CookieAuthData,
  HeaderAuthData,
  BrowserAuthData,
  BrowserLoginSession,
} from '../../shared/types/crawler.js';

const log = createLogger('server:services:auth-session-manager');

/**
 * Auth Session Manager Service 类
 */
export class AuthSessionManagerService {
  private browser: Browser | null = null;
  private sessions: Map<string, BrowserLoginSession> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    try {
      this.browser = await chromium.launch({
        headless: false, // 有头模式，用于用户登录
      });

      log.info('Auth session browser initialized');
    } catch (error) {
      log.error('Failed to initialize auth session browser', error);
      throw new Error('Browser initialization failed');
    }
  }

  /**
   * 启动浏览器登录会话
   */
  async launchBrowserLogin(url: string): Promise<BrowserLoginSession> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const sessionId = randomUUID();
    const contextId = randomUUID();

    try {
      // 创建新的浏览器上下文
      const context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      this.contexts.set(contextId, context);

      // 创建页面
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // 创建会话
      const session: BrowserLoginSession = {
        sessionId,
        url,
        status: 'launched',
        browserContextId: contextId,
        createdAt: new Date(),
      };

      this.sessions.set(sessionId, session);

      log.info(`Browser login session launched: ${sessionId}`);

      return session;
    } catch (error) {
      log.error('Failed to launch browser login', error);
      throw new Error('Browser login launch failed');
    }
  }

  /**
   * 完成浏览器登录并提取认证信息
   */
  async completeBrowserLogin(sessionId: string, name?: string): Promise<AuthProfile> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'launched') {
      throw new Error('Invalid session or session not launched');
    }

    const context = this.contexts.get(session.browserContextId!);
    if (!context) {
      throw new Error('Browser context not found');
    }

    try {
      // 提取 Cookies
      const cookies = await context.cookies();

      // 提取 localStorage 和 sessionStorage（需要通过页面 evaluate）
      const page = context.pages()[0];
      if (!page) {
        throw new Error('No page found in browser context');
      }

      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            data[key] = window.localStorage.getItem(key) || '';
          }
        }
        return data;
      });

      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {};
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i);
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || '';
          }
        }
        return data;
      });

      // 构造认证数据
      const authData: BrowserAuthData = {
        cookies,
        localStorage,
        sessionStorage,
      };

      // 加密认证数据
      const encryptedData = await encryptionUtil.encrypt(JSON.stringify(authData));

      // 提取域名
      const domain = new URL(session.url).hostname;

      // 创建认证配置
      const authProfile: AuthProfile = {
        id: randomUUID(),
        domain,
        type: 'browser',
        name: name || `Browser Login (${domain})`,
        encryptedData,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };

      // 保存到数据库
      crawlerDbService.createAuthProfile(authProfile);

      // 更新会话状态
      session.status = 'completed';
      session.completedAt = new Date();

      log.info(`Browser login completed: ${sessionId}, profile: ${authProfile.id}`);

      // 清理浏览器上下文
      await this.cleanupSession(sessionId);

      return authProfile;
    } catch (error) {
      log.error('Failed to complete browser login', error);
      session.status = 'failed';
      session.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * 保存认证配置（Cookie 注入）
   */
  async saveCookieAuth(
    domain: string,
    cookieString: string,
    name?: string
  ): Promise<AuthProfile> {
    // 构造认证数据
    const authData: CookieAuthData = {
      cookies: cookieString,
    };

    // 加密认证数据
    const encryptedData = await encryptionUtil.encrypt(JSON.stringify(authData));

    // 创建认证配置
    const authProfile: AuthProfile = {
      id: randomUUID(),
      domain,
      type: 'cookie',
      name: name || `Cookie Auth (${domain})`,
      encryptedData,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    // 保存到数据库
    crawlerDbService.createAuthProfile(authProfile);

    log.info(`Cookie auth saved: ${authProfile.id}, domain: ${domain}`);

    return authProfile;
  }

  /**
   * 保存认证配置（Header 注入）
   */
  async saveHeaderAuth(
    domain: string,
    headerName: string,
    headerValue: string,
    name?: string
  ): Promise<AuthProfile> {
    // 构造认证数据
    const authData: HeaderAuthData = {
      headerName,
      headerValue,
    };

    // 加密认证数据
    const encryptedData = await encryptionUtil.encrypt(JSON.stringify(authData));

    // 创建认证配置
    const authProfile: AuthProfile = {
      id: randomUUID(),
      domain,
      type: 'header',
      name: name || `Header Auth (${domain})`,
      encryptedData,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    // 保存到数据库
    crawlerDbService.createAuthProfile(authProfile);

    log.info(`Header auth saved: ${authProfile.id}, domain: ${domain}`);

    return authProfile;
  }

  /**
   * 应用认证到 Playwright 上下文
   */
  async applyAuthToContext(
    context: BrowserContext,
    authProfileId: string,
    url: string
  ): Promise<void> {
    const authProfile = crawlerDbService.getAuthProfile(authProfileId);
    if (!authProfile) {
      throw new Error(`Auth profile not found: ${authProfileId}`);
    }

    try {
      // 解密认证数据
      const encryptedData = await encryptionUtil.decrypt(authProfile.encryptedData);
      const authData = JSON.parse(encryptedData);

      // 根据认证类型应用
      switch (authProfile.type) {
        case 'cookie': {
          const cookieAuth = authData as CookieAuthData;
          const cookies = this.parseCookieString(cookieAuth.cookies, url);
          await context.addCookies(cookies);
          log.debug(`Applied cookie auth: ${authProfileId}`);
          break;
        }

        case 'header': {
          const headerAuth = authData as HeaderAuthData;
          await context.setExtraHTTPHeaders({
            [headerAuth.headerName]: headerAuth.headerValue,
          });
          log.debug(`Applied header auth: ${authProfileId}`);
          break;
        }

        case 'browser': {
          const browserAuth = authData as BrowserAuthData;
          // 添加 Cookies
          await context.addCookies(browserAuth.cookies);

          // 注入 localStorage 和 sessionStorage
          const page = context.pages()[0] || (await context.newPage());

          await page.evaluate((data: { localStorage: Record<string, string>; sessionStorage: Record<string, string> }) => {
            // 注入 localStorage
            for (const [key, value] of Object.entries(data.localStorage)) {
              window.localStorage.setItem(key, value);
            }
            // 注入 sessionStorage
            for (const [key, value] of Object.entries(data.sessionStorage)) {
              window.sessionStorage.setItem(key, value);
            }
          }, browserAuth);

          log.debug(`Applied browser auth: ${authProfileId}`);
          break;
        }

        default:
          throw new Error(`Unknown auth type: ${authProfile.type}`);
      }

      // 更新最后使用时间
      crawlerDbService.updateAuthProfileLastUsed(authProfileId);
    } catch (error) {
      log.error(`Failed to apply auth: ${authProfileId}`, error);
      throw new Error('Failed to apply authentication');
    }
  }

  /**
   * 解析 Cookie 字符串为 Playwright Cookie 格式
   */
  private parseCookieString(cookieString: string, url: string): Array<{ name: string; value: string; domain: string; path: string }> {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    return cookieString.split(';').map((cookie) => {
      const trimmed = cookie.trim();
      const firstEqualsIndex = trimmed.indexOf('=');

      if (firstEqualsIndex === -1) {
        // 没有 = 号，整个字符串作为 name，value 为空
        return {
          name: trimmed,
          value: '',
          domain,
          path: '/',
        };
      }

      const name = trimmed.substring(0, firstEqualsIndex).trim();
      const value = trimmed.substring(firstEqualsIndex + 1);

      return {
        name,
        value,
        domain,
        path: '/',
      };
    });
  }

  /**
   * 清理会话
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && session.browserContextId) {
      const context = this.contexts.get(session.browserContextId);
      if (context) {
        await context.close();
        this.contexts.delete(session.browserContextId);
      }
    }
    this.sessions.delete(sessionId);
    log.debug(`Session cleaned up: ${sessionId}`);
  }

  /**
   * 取消浏览器登录
   */
  async cancelBrowserLogin(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'launched') {
      session.status = 'cancelled';
      await this.cleanupSession(sessionId);
      log.info(`Browser login cancelled: ${sessionId}`);
    }
  }

  /**
   * 检测是否有可用的 GUI 环境
   */
  async hasGuiEnvironment(): Promise<boolean> {
    // macOS 始终有 GUI 环境（桌面环境）
    if (process.platform === 'darwin') {
      return true;
    }

    // Windows 始终有 GUI 环境
    if (process.platform === 'win32') {
      return true;
    }

    // Linux：检查环境变量
    if (process.env.DISPLAY === undefined && process.env.WAYLAND_DISPLAY === undefined) {
      // Linux 且没有 DISPLAY/WAYLAND_DISPLAY
      return false;
    }

    // 检查是否在 Docker 容器中
    if (existsSync('/.dockerenv')) {
      return false;
    }

    // 检查 /proc/1/cgroup（Docker 容器检测）
    try {
      const cgroup = await readFile('/proc/1/cgroup', 'utf-8');
      if (cgroup.includes('docker') || cgroup.includes('kubepods')) {
        return false;
      }
    } catch {
      // 忽略错误
    }

    return true;
  }

  /**
   * 获取认证配置的 Cookie 数量
   */
  async getProfileCookieCount(profileId: string): Promise<number> {
    const profile = crawlerDbService.getAuthProfile(profileId);
    if (!profile) {
      throw new Error(`Auth profile not found: ${profileId}`);
    }

    if (profile.type !== 'cookie') {
      return 0;
    }

    try {
      const decryptedData = await encryptionUtil.decrypt(profile.encryptedData);
      const authData = JSON.parse(decryptedData);
      const cookieStr = authData.cookies || '';
      // 按 ; 分割后计数，过滤空字符串
      return cookieStr ? cookieStr.split(';').filter(c => c.trim()).length : 0;
    } catch (error) {
      log.error(`Failed to get cookie count for profile ${profileId}`, error);
      return 0;
    }
  }

  /**
   * 关闭所有会话和浏览器
   */
  async close(): Promise<void> {
    // 关闭所有浏览器上下文
    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();

    // 关闭浏览器
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    // 清空会话
    this.sessions.clear();

    log.info('Auth session manager closed');
  }
}

// 导出单例
export const authSessionManagerService = new AuthSessionManagerService();

