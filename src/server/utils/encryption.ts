/**
 * 加密工具类
 *
 * 使用 AES-256-GCM 算法加密敏感数据（Cookie、Token 等）
 * 密钥基于机器唯一标识生成
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { createLogger } from '../../shared/utils/logger.js';

const log = createLogger('server:utils:encryption');

// 密钥存储路径
const KEY_STORAGE_PATH = join(process.cwd(), '.devrag', 'auth', '.master-key');
const AUTH_DIR = join(process.cwd(), '.devrag', 'auth');

/**
 * 加密工具类
 */
export class EncryptionUtil {
  private masterKey: Buffer | null = null;
  private keyLoaded = false;
  public customKeyPath: string | null = null; // Made public for testing

  /**
   * 获取当前密钥路径
   */
  private getKeyPath(): string {
    return this.customKeyPath || KEY_STORAGE_PATH;
  }

  /**
   * 获取当前认证目录
   */
  private getAuthDir(): string {
    if (this.customKeyPath) {
      const path = require('path');
      return path.dirname(this.customKeyPath);
    }
    return AUTH_DIR;
  }

  /**
   * 确保密钥已加载
   */
  private async ensureKeyLoaded(): Promise<void> {
    if (this.keyLoaded && this.masterKey) {
      return;
    }

    const keyPath = this.getKeyPath();

    try {
      // 尝试从文件加载密钥
      if (existsSync(keyPath)) {
        const keyData = await readFile(keyPath);
        this.masterKey = Buffer.from(keyData, 'base64');
        this.keyLoaded = true;
        log.info('Master key loaded from storage');
        return;
      }
    } catch (error) {
      log.warn('Failed to load master key from storage, generating new one', error);
    }

    // 生成新密钥并保存
    await this.generateAndStoreKey();
  }

  /**
   * 基于机器标识生成并存储密钥
   */
  private async generateAndStoreKey(): Promise<void> {
    try {
      // 生成随机密钥
      this.masterKey = randomBytes(32); // 256 bits

      const authDir = this.getAuthDir();
      const keyPath = this.getKeyPath();

      // 确保目录存在
      await mkdir(authDir, { recursive: true });

      // 保存密钥（base64 编码）
      await writeFile(keyPath, this.masterKey.toString('base64'), {
        mode: 0o600, // 仅当前用户可读写
      });

      this.keyLoaded = true;
      log.info('New master key generated and stored');
    } catch (error) {
      log.error('Failed to generate and store master key', error);
      throw new Error('Encryption key initialization failed');
    }
  }

  /**
   * 加密数据
   */
  async encrypt(plaintext: string): Promise<string> {
    await this.ensureKeyLoaded();

    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    try {
      // 生成随机 IV
      const iv = randomBytes(16); // 128 bits
      const salt = randomBytes(32);

      // 从主密钥和盐派生加密密钥
      const key = createHash('sha256')
        .update(this.masterKey)
        .update(salt)
        .digest();

      // 加密
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 获取认证标签
      const authTag = cipher.getAuthTag();

      // 组合：salt + iv + authTag + encrypted
      const combined = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]);

      return combined.toString('base64');
    } catch (error) {
      log.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * 解密数据
   */
  async decrypt(encryptedData: string): Promise<string> {
    await this.ensureKeyLoaded();

    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    try {
      // 解析组合数据
      const combined = Buffer.from(encryptedData, 'base64');

      if (combined.length < 80) {
        // salt(32) + iv(16) + authTag(16) + encrypted(至少16)
        throw new Error('Invalid encrypted data format');
      }

      const salt = combined.subarray(0, 32);
      const iv = combined.subarray(32, 48);
      const authTag = combined.subarray(48, 64);
      const encrypted = combined.subarray(64);

      // 从主密钥和盐派生解密密钥
      const key = createHash('sha256')
        .update(this.masterKey)
        .update(salt)
        .digest();

      // 解密
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      log.error('Decryption failed', error);
      throw new Error('Failed to decrypt data. It may be corrupted or the key has changed.');
    }
  }

  /**
   * 重新生成密钥（用于密钥泄露场景）
   * 警告：所有使用旧密钥加密的数据将无法解密
   */
  async regenerateKey(): Promise<void> {
    log.warn('Regenerating master key - all existing encrypted data will become unreadable');

    const keyPath = this.getKeyPath();

    // 删除旧密钥
    if (existsSync(keyPath)) {
      await writeFile(keyPath, ''); // 清空文件
    }

    this.keyLoaded = false;
    this.masterKey = null;

    // 生成新密钥
    await this.generateAndStoreKey();
  }
}

// 导出单例
export const encryptionUtil = new EncryptionUtil();
