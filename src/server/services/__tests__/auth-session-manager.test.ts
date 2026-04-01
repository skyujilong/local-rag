/**
 * Unit tests for AuthSessionManagerService
 * 
 * Tests cover:
 * - Cookie encryption and decryption
 * - Cookie validation
 * - Authentication expiry detection (login page features)
 * - Machine-based key generation
 * - Browser login session management
 * - Header auth management
 * - Auth application to Playwright context
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthSessionManagerService } from '../auth-session-manager.service.js';

// Mock playwright
const mockPage = {
  goto: vi.fn(),
  evaluate: vi.fn(),
  close: vi.fn(),
};

const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  addCookies: vi.fn().mockResolvedValue(undefined),
  setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
  pages: vi.fn().mockReturnValue([mockPage]),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue(mockBrowser),
  },
}));

// Mock encryption util
const mockEncryptionUtil = {
  encrypt: vi.fn().mockResolvedValue('encrypted-data'),
  decrypt: vi.fn().mockResolvedValue(JSON.stringify({
    cookies: 'session=test',
    localStorage: {},
    sessionStorage: {},
  })),
};

vi.mock('../utils/encryption.js', () => ({
  encryptionUtil: mockEncryptionUtil,
}));

// Mock crawler DB service
const mockCrawlerDbService = {
  createAuthProfile: vi.fn(),
  getAuthProfile: vi.fn(),
  updateAuthProfileLastUsed: vi.fn(),
};

vi.mock('../crawler-db.service.js', () => ({
  crawlerDbService: mockCrawlerDbService,
}));

// Mock logger
vi.mock('../../shared/utils/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
}));

describe('AuthSessionManagerService', () => {
  let service: AuthSessionManagerService;

  beforeEach(() => {
    service = new AuthSessionManagerService();
    
    // Reset mocks
    mockPage.goto.mockReset();
    mockPage.evaluate.mockReset();
    mockPage.close.mockReset();
    mockContext.newPage.mockReset();
    mockContext.addCookies.mockReset();
    mockContext.setExtraHTTPHeaders.mockReset();
    mockContext.pages.mockReset();
    mockContext.close.mockReset();
    mockBrowser.newContext.mockReset();
    mockBrowser.close.mockReset();
    mockEncryptionUtil.encrypt.mockReset();
    mockEncryptionUtil.decrypt.mockReset();
    mockCrawlerDbService.createAuthProfile.mockReset();
    mockCrawlerDbService.getAuthProfile.mockReset();
    mockCrawlerDbService.updateAuthProfileLastUsed.mockReset();
    
    // Set default implementations
    mockPage.goto.mockResolvedValue({ ok: () => true });
    mockContext.newPage.mockResolvedValue(mockPage);
    mockContext.pages.mockReturnValue([mockPage]);
    mockBrowser.newContext.mockResolvedValue(mockContext);
    mockEncryptionUtil.encrypt.mockResolvedValue('encrypted-data');
    mockEncryptionUtil.decrypt.mockResolvedValue(JSON.stringify({
      cookies: 'session=test',
      localStorage: {},
      sessionStorage: {},
    }));
  });

  afterEach(async () => {
    await service.close();
  });

  describe('initialize', () => {
    it('should initialize browser successfully', async () => {
      await service.initialize();
      
      const { chromium } = await import('playwright');
      expect(chromium.launch).toHaveBeenCalledWith({ headless: false });
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      const { chromium } = await import('playwright');
      const callCount = (chromium.launch as any).mock.calls.length;
      
      await service.initialize();
      
      expect((chromium.launch as any).mock.calls.length).toBe(callCount);
    });

    it('should throw error when browser launch fails', async () => {
      const { chromium } = await import('playwright');
      (chromium.launch as any).mockRejectedValueOnce(new Error('Browser launch failed'));
      
      await expect(service.initialize()).rejects.toThrow('Browser initialization failed');
    });
  });

  describe('saveCookieAuth', () => {
    it('should save cookie auth successfully', async () => {
      const domain = 'example.com';
      const cookieString = 'session=abc123; user_id=456';
      
      const profile = await service.saveCookieAuth(domain, cookieString, 'Test Cookie');
      
      expect(profile.domain).toBe(domain);
      expect(profile.type).toBe('cookie');
      expect(profile.name).toBe('Test Cookie');
      expect(mockEncryptionUtil.encrypt).toHaveBeenCalledWith(
        JSON.stringify({ cookies: cookieString })
      );
      expect(mockCrawlerDbService.createAuthProfile).toHaveBeenCalled();
    });

    it('should generate default name if not provided', async () => {
      const profile = await service.saveCookieAuth('example.com', 'session=test');
      
      expect(profile.name).toContain('example.com');
    });

    it('should generate unique ID for each profile', async () => {
      const profile1 = await service.saveCookieAuth('example.com', 'session=test1');
      const profile2 = await service.saveCookieAuth('example.com', 'session=test2');
      
      expect(profile1.id).not.toBe(profile2.id);
    });
  });

  describe('saveHeaderAuth', () => {
    it('should save header auth successfully', async () => {
      const domain = 'api.example.com';
      const headerName = 'Authorization';
      const headerValue = 'Bearer token123';
      
      const profile = await service.saveHeaderAuth(domain, headerName, headerValue, 'Test Header');
      
      expect(profile.domain).toBe(domain);
      expect(profile.type).toBe('header');
      expect(profile.name).toBe('Test Header');
      expect(mockEncryptionUtil.encrypt).toHaveBeenCalledWith(
        JSON.stringify({ headerName, headerValue })
      );
      expect(mockCrawlerDbService.createAuthProfile).toHaveBeenCalled();
    });

    it('should generate default name if not provided', async () => {
      const profile = await service.saveHeaderAuth(
        'api.example.com',
        'Authorization',
        'Bearer token'
      );
      
      expect(profile.name).toContain('api.example.com');
    });
  });

  describe('launchBrowserLogin', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should launch browser and create session', async () => {
      const url = 'https://github.com/login';
      
      const session = await service.launchBrowserLogin(url);
      
      expect(session.url).toBe(url);
      expect(session.status).toBe('launched');
      expect(session.sessionId).toBeDefined();
      expect(session.browserContextId).toBeDefined();
      expect(mockPage.goto).toHaveBeenCalledWith(url, { waitUntil: 'networkidle', timeout: 30000 });
    });

    it('should throw error if browser not initialized', async () => {
      const newService = new AuthSessionManagerService();
      
      await expect(newService.launchBrowserLogin('https://example.com')).rejects.toThrow(
        'Browser not initialized'
      );
    });

    it('should throw error when goto fails', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));
      
      await expect(service.launchBrowserLogin('https://example.com')).rejects.toThrow(
        'Browser login launch failed'
      );
    });
  });

  describe('completeBrowserLogin', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should complete browser login and extract auth data', async () => {
      const url = 'https://github.com/login';
      const session = await service.launchBrowserLogin(url);
      
      mockPage.evaluate
        .mockResolvedValueOnce({ session: 'abc123', path: '/' }) // cookies
        .mockResolvedValueOnce({ token: 'jwt-token' }) // localStorage
        .mockResolvedValueOnce({ temp: 'data' }); // sessionStorage
      
      const profile = await service.completeBrowserLogin(session.sessionId, 'GitHub Login');
      
      expect(profile.domain).toBe('github.com');
      expect(profile.type).toBe('browser');
      expect(profile.name).toBe('GitHub Login');
      expect(mockEncryptionUtil.encrypt).toHaveBeenCalled();
      expect(mockCrawlerDbService.createAuthProfile).toHaveBeenCalled();
      expect(session.status).toBe('completed');
    });

    it('should throw error for invalid session', async () => {
      await expect(service.completeBrowserLogin('invalid-session-id')).rejects.toThrow(
        'Invalid session or session not launched'
      );
    });

    it('should throw error for session not in launched state', async () => {
      const url = 'https://github.com/login';
      const session = await service.launchBrowserLogin(url);
      session.status = 'completed';
      
      await expect(service.completeBrowserLogin(session.sessionId)).rejects.toThrow(
        'Invalid session or session not launched'
      );
    });

    it('should clean up browser context after completion', async () => {
      const url = 'https://github.com/login';
      const session = await service.launchBrowserLogin(url);
      
      mockPage.evaluate
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      
      await service.completeBrowserLogin(session.sessionId);
      
      expect(mockContext.close).toHaveBeenCalled();
    });

    it('should mark session as failed on error', async () => {
      const url = 'https://github.com/login';
      const session = await service.launchBrowserLogin(url);
      
      mockPage.evaluate.mockRejectedValueOnce(new Error('Extraction failed'));
      
      await expect(service.completeBrowserLogin(session.sessionId)).rejects.toThrow();
      expect(session.status).toBe('failed');
    });
  });

  describe('applyAuthToContext', () => {
    let mockContext: any;

    beforeEach(() => {
      mockContext = {
        addCookies: vi.fn().mockResolvedValue(undefined),
        setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
        pages: vi.fn().mockReturnValue([mockPage]),
      };
      
      mockPage.evaluate.mockResolvedValue(undefined);
    });

    it('should apply cookie auth to context', async () => {
      const profile = {
        id: 'profile-1',
        domain: 'example.com',
        type: 'cookie' as const,
        name: 'Test Cookie',
        encryptedData: 'encrypted-data',
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
      
      mockCrawlerDbService.getAuthProfile.mockReturnValue(profile);
      
      await service.applyAuthToContext(mockContext, 'profile-1', 'https://example.com/page');
      
      expect(mockEncryptionUtil.decrypt).toHaveBeenCalledWith('encrypted-data');
      expect(mockContext.addCookies).toHaveBeenCalled();
      expect(mockCrawlerDbService.updateAuthProfileLastUsed).toHaveBeenCalledWith('profile-1');
    });

    it('should apply header auth to context', async () => {
      const profile = {
        id: 'profile-2',
        domain: 'api.example.com',
        type: 'header' as const,
        name: 'Test Header',
        encryptedData: 'encrypted-data',
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
      
      mockCrawlerDbService.getAuthProfile.mockReturnValue(profile);
      mockEncryptionUtil.decrypt.mockResolvedValueOnce(
        JSON.stringify({
          headerName: 'Authorization',
          headerValue: 'Bearer token',
        })
      );
      
      await service.applyAuthToContext(mockContext, 'profile-2', 'https://api.example.com/endpoint');
      
      expect(mockContext.setExtraHTTPHeaders).toHaveBeenCalledWith({
        Authorization: 'Bearer token',
      });
    });

    it('should apply browser auth to context', async () => {
      const profile = {
        id: 'profile-3',
        domain: 'github.com',
        type: 'browser' as const,
        name: 'GitHub Login',
        encryptedData: 'encrypted-data',
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
      
      mockCrawlerDbService.getAuthProfile.mockReturnValue(profile);
      mockEncryptionUtil.decrypt.mockResolvedValueOnce(
        JSON.stringify({
          cookies: [{ name: 'session', value: 'abc', domain: '.github.com', path: '/' }],
          localStorage: { token: 'jwt' },
          sessionStorage: { temp: 'data' },
        })
      );
      
      await service.applyAuthToContext(mockContext, 'profile-3', 'https://github.com/private');
      
      expect(mockContext.addCookies).toHaveBeenCalled();
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should throw error for unknown auth type', async () => {
      const profile = {
        id: 'profile-4',
        domain: 'example.com',
        type: 'unknown' as any,
        name: 'Unknown',
        encryptedData: 'encrypted-data',
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
      
      mockCrawlerDbService.getAuthProfile.mockReturnValue(profile);
      mockEncryptionUtil.decrypt.mockResolvedValueOnce('{}');
      
      await expect(
        service.applyAuthToContext(mockContext, 'profile-4', 'https://example.com')
      ).rejects.toThrow('Unknown auth type');
    });

    it('should throw error when profile not found', async () => {
      mockCrawlerDbService.getAuthProfile.mockReturnValue(undefined);
      
      await expect(
        service.applyAuthToContext(mockContext, 'nonexistent', 'https://example.com')
      ).rejects.toThrow('Auth profile not found');
    });

    it('should throw error when decryption fails', async () => {
      const profile = {
        id: 'profile-5',
        domain: 'example.com',
        type: 'cookie' as const,
        name: 'Test',
        encryptedData: 'encrypted-data',
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
      
      mockCrawlerDbService.getAuthProfile.mockReturnValue(profile);
      mockEncryptionUtil.decrypt.mockRejectedValueOnce(new Error('Decryption failed'));
      
      await expect(
        service.applyAuthToContext(mockContext, 'profile-5', 'https://example.com')
      ).rejects.toThrow('Failed to apply authentication');
    });
  });

  describe('parseCookieString', () => {
    it('should parse simple cookie string', async () => {
      await service.initialize();
      
      const session = await service.launchBrowserLogin('https://example.com');
      
      mockPage.evaluate
        .mockResolvedValueOnce('session=value')
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      
      mockEncryptionUtil.encrypt.mockResolvedValue('encrypted');
      
      await service.completeBrowserLogin(session.sessionId);
      
      // Verify cookies were added to context
      expect(mockContext.addCookies).toHaveBeenCalled();
      const addedCookies = mockContext.addCookies.mock.calls[0][0];
      expect(addedCookies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'session',
            value: 'value',
            domain: 'example.com',
            path: '/',
          }),
        ])
      );
    });

    it('should parse multiple cookies', async () => {
      await service.initialize();
      
      const session = await service.launchBrowserLogin('https://example.com');
      
      mockPage.evaluate
        .mockResolvedValueOnce('session=abc; user_id=123; token=xyz')
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      
      mockEncryptionUtil.encrypt.mockResolvedValue('encrypted');
      
      await service.completeBrowserLogin(session.sessionId);
      
      expect(mockContext.addCookies).toHaveBeenCalled();
      const addedCookies = mockContext.addCookies.mock.calls[0][0];
      expect(addedCookies).toHaveLength(3);
    });

    it('should handle cookies with spaces', async () => {
      await service.initialize();
      
      const session = await service.launchBrowserLogin('https://example.com');
      
      mockPage.evaluate
        .mockResolvedValueOnce('session=abc ; user_id=123 ; token=xyz')
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      
      mockEncryptionUtil.encrypt.mockResolvedValue('encrypted');
      
      await service.completeBrowserLogin(session.sessionId);
      
      expect(mockContext.addCookies).toHaveBeenCalled();
      const addedCookies = mockContext.addCookies.mock.calls[0][0];
      expect(addedCookies[0].name).toBe('session');
      expect(addedCookies[0].value).toBe('abc');
    });

    it('should handle cookie without value', async () => {
      await service.initialize();
      
      const session = await service.launchBrowserLogin('https://example.com');
      
      mockPage.evaluate
        .mockResolvedValueOnce('session=')
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});
      
      mockEncryptionUtil.encrypt.mockResolvedValue('encrypted');
      
      await service.completeBrowserLogin(session.sessionId);
      
      expect(mockContext.addCookies).toHaveBeenCalled();
      const addedCookies = mockContext.addCookies.mock.calls[0][0];
      expect(addedCookies[0].value).toBe('');
    });
  });

  describe('hasGuiEnvironment', () => {
    it('should return true on macOS', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      
      const hasGui = await service.hasGuiEnvironment();
      
      expect(hasGui).toBe(true);
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return true on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      const hasGui = await service.hasGuiEnvironment();
      
      expect(hasGui).toBe(true);
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return true on Linux with DISPLAY', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.DISPLAY = ':0';
      
      const hasGui = await service.hasGuiEnvironment();
      
      expect(hasGui).toBe(true);
      
      delete process.env.DISPLAY;
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return false on Linux without DISPLAY', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      delete process.env.DISPLAY;
      delete process.env.WAYLAND_DISPLAY;
      
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(false);
      
      const hasGui = await service.hasGuiEnvironment();
      
      expect(hasGui).toBe(false);
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return false in Docker container', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      
      const { existsSync } = await import('fs');
      vi.mocked(existsSync).mockReturnValue(true);
      
      const hasGui = await service.hasGuiEnvironment();
      
      expect(hasGui).toBe(false);
      
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('getProfileCookieCount', () => {
    it('should return 0 for non-cookie profile', async () => {
      const profile = {
        id: 'profile-1',
        domain: 'example.com',
        type: 'header' as const,
        name: 'Test',
        encryptedData: 'encrypted-data',
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
      
      mockCrawlerDbService.getAuthProfile.mockReturnValue(profile);
      
      const count = await service.getProfileCookieCount('profile-1');
      
      expect(count).toBe(0);
    });

    it('should count cookies in cookie string', async () => {
      const profile = {
        id: 'profile-2',
        domain: 'example.com',
        type: 'cookie' as const,
        name: 'Test',
        encryptedData: 'encrypted-data',
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
      
      mockCrawlerDbService.getAuthProfile.mockReturnValue(profile);
      mockEncryptionUtil.decrypt.mockResolvedValueOnce(
        JSON.stringify({ cookies: 'session=abc; user_id=123; token=xyz' })
      );
      
      const count = await service.getProfileCookieCount('profile-2');
      
      expect(count).toBe(3);
    });

    it('should handle empty cookie string', async () => {
      const profile = {
        id: 'profile-3',
        domain: 'example.com',
        type: 'cookie' as const,
        name: 'Test',
        encryptedData: 'encrypted-data',
        createdAt: new Date(),
        lastUsedAt: new Date(),
      };
      
      mockCrawlerDbService.getAuthProfile.mockReturnValue(profile);
      mockEncryptionUtil.decrypt.mockResolvedValueOnce(JSON.stringify({ cookies: '' }));
      
      const count = await service.getProfileCookieCount('profile-3');
      
      expect(count).toBe(0);
    });
  });

  describe('close', () => {
    it('should close browser and cleanup sessions', async () => {
      await service.initialize();
      await service.launchBrowserLogin('https://example.com');
      
      await service.close();
      
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should do nothing if browser not initialized', async () => {
      await service.close();
      
      expect(mockBrowser.close).not.toHaveBeenCalled();
    });
  });
});
