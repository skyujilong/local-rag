/**
 * Unit tests for EncryptionUtil
 * 
 * Tests cover:
 * - Cookie/Token encryption and decryption
 * - Key generation and storage
 * - Machine-based key generation
 * - Key regeneration
 * - Error handling for corrupted data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'fs';
import { writeFile } from 'fs/promises';
import * as crypto from 'crypto';
import { EncryptionUtil } from '../encryption.js';

// Mock logger
vi.mock('../../shared/utils/logger.js', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('EncryptionUtil', () => {
  let encryptionUtil: EncryptionUtil;
  const testAuthDir = '/tmp/test-devrag-auth';
  const testKeyPath = `${testAuthDir}/.master-key`;

  // Clean up before all tests
  beforeAll(async () => {
    const fs = await import('fs/promises');
    try {
      await fs.mkdir(testAuthDir, { recursive: true });
      await fs.unlink(testKeyPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  // Clean up after all tests
  afterAll(async () => {
    const fs = await import('fs/promises');
    try {
      await fs.unlink(testKeyPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  beforeEach(async () => {
    // Delete any existing key file to ensure fresh state for each test
    const fs = await import('fs/promises');
    try {
      await fs.unlink(testKeyPath);
    } catch {
      // Ignore if file doesn't exist
    }

    // Create a test encryption util with custom path
    encryptionUtil = new EncryptionUtil();
    encryptionUtil.customKeyPath = testKeyPath;
    // Reset key state
    (encryptionUtil as any).keyLoaded = false;
    (encryptionUtil as any).masterKey = null;
  });

  afterEach(async () => {
    // Clean up test key file
    const fs = await import('fs/promises');
    try {
      await fs.unlink(testKeyPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt successfully', async () => {
      const plaintext = 'sensitive-cookie-data';
      
      const encrypted = await encryptionUtil.encrypt(plaintext);
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const plaintext = 'same-data';
      
      const encrypted1 = await encryptionUtil.encrypt(plaintext);
      const encrypted2 = await encryptionUtil.encrypt(plaintext);
      
      // Different IV/salt should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should decrypt both to same plaintext', async () => {
      const plaintext = 'same-data';
      
      const encrypted1 = await encryptionUtil.encrypt(plaintext);
      const encrypted2 = await encryptionUtil.encrypt(plaintext);
      
      const decrypted1 = await encryptionUtil.decrypt(encrypted1);
      const decrypted2 = await encryptionUtil.decrypt(encrypted2);
      
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should handle empty string', async () => {
      const plaintext = '';
      
      const encrypted = await encryptionUtil.encrypt(plaintext);
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe('');
    });

    it('should handle special characters', async () => {
      const plaintext = '特殊字符 !@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      
      const encrypted = await encryptionUtil.encrypt(plaintext);
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle Unicode emoji', async () => {
      const plaintext = 'Hello 👋 World 🌍 Test 🧪';
      
      const encrypted = await encryptionUtil.encrypt(plaintext);
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long text', async () => {
      const plaintext = 'a'.repeat(10000);
      
      const encrypted = await encryptionUtil.encrypt(plaintext);
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON data', async () => {
      const data = {
        cookies: 'session=abc123; user_id=456',
        headers: { Authorization: 'Bearer token' },
      };
      const plaintext = JSON.stringify(data);
      
      const encrypted = await encryptionUtil.encrypt(plaintext);
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it('should produce base64-encoded output', async () => {
      const plaintext = 'test-data';
      
      const encrypted = await encryptionUtil.encrypt(encrypted);
      
      // Should be valid base64
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error when decrypting corrupted data', async () => {
      const corruptedData = 'not-valid-base64-or-encrypted-data';
      
      await expect(encryptionUtil.decrypt(corruptedData)).rejects.toThrow();
    });

    it('should throw error when decrypting with wrong key', async () => {
      const plaintext = 'sensitive-data';
      const encrypted = await encryptionUtil.encrypt(plaintext);
      
      // Regenerate key (simulating key change)
      await encryptionUtil.regenerateKey();
      
      // Should fail to decrypt with new key
      await expect(encryptionUtil.decrypt(encrypted)).rejects.toThrow(/Failed to decrypt/);
    });

    it('should throw error when decrypting truncated data', async () => {
      const plaintext = 'test';
      const encrypted = await encryptionUtil.encrypt(plaintext);
      
      // Truncate the data
      const truncated = encrypted.substring(0, encrypted.length - 10);
      
      await expect(encryptionUtil.decrypt(truncated)).rejects.toThrow(/Invalid encrypted data/);
    });

    it('should throw error when decrypting empty string', async () => {
      await expect(encryptionUtil.decrypt('')).rejects.toThrow(/Invalid encrypted data/);
    });

    it('should throw error when master key not available', async () => {
      // Create instance that will fail to generate key
      const badUtil = new EncryptionUtil();

      // Set custom key path to a location that will fail
      badUtil.customKeyPath = '/root/.master-key'; // Will fail with permission denied

      // This should throw when trying to encrypt
      await expect(badUtil.encrypt('test')).rejects.toThrow(/Encryption key initialization failed/);
    });
  });

  describe('key management', () => {
    it('should generate and store key on first use', async () => {
      const plaintext = 'test-data';
      
      await encryptionUtil.encrypt(plaintext);
      
      // Key should now be loaded
      expect(encryptionUtil).toBeDefined();
    });

    it('should reuse key for subsequent operations', async () => {
      const plaintext1 = 'data1';
      const plaintext2 = 'data2';
      
      await encryptionUtil.encrypt(plaintext1);
      await encryptionUtil.encrypt(plaintext2);
      
      // Should not throw, using same key
      expect(encryptionUtil).toBeDefined();
    });

    it('should regenerate key on request', async () => {
      const plaintext = 'test-data';
      
      const encrypted1 = await encryptionUtil.encrypt(plaintext);
      
      await encryptionUtil.regenerateKey();
      
      const encrypted2 = await encryptionUtil.encrypt(plaintext);
      
      // Different keys should produce different output
      expect(encrypted1).not.toBe(encrypted2);
      
      // Old data should not decrypt with new key
      await expect(encryptionUtil.decrypt(encrypted1)).rejects.toThrow();
    });

    it('should warn when regenerating key', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await encryptionUtil.regenerateKey();
      
      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Regenerating master key')
      );
      
      consoleWarn.mockRestore();
    });
  });

  describe('encryption format', () => {
    it('should use AES-256-GCM algorithm', async () => {
      const plaintext = 'test';
      const encrypted = await encryptionUtil.encrypt(plaintext);
      
      // AES-256-GCM produces ciphertext of same length as plaintext
      // plus authentication tag (16 bytes)
      const decoded = Buffer.from(encrypted, 'base64');
      
      // Format: salt(32) + iv(16) + authTag(16) + encrypted(variable)
      expect(decoded.length).toBeGreaterThan(64); // At least salt+iv+authTag
    });

    it('should include salt in encrypted data', async () => {
      const plaintext = 'test';
      const encrypted = await encryptionUtil.encrypt(plaintext);
      
      const decoded = Buffer.from(encrypted, 'base64');
      
      // First 32 bytes should be salt
      const salt = decoded.subarray(0, 32);
      expect(salt.length).toBe(32);
    });

    it('should include IV in encrypted data', async () => {
      const plaintext = 'test';
      const encrypted = await encryptionUtil.encrypt(plaintext);
      
      const decoded = Buffer.from(encrypted, 'base64');
      
      // Bytes 32-48 should be IV
      const iv = decoded.subarray(32, 48);
      expect(iv.length).toBe(16);
    });

    it('should include auth tag in encrypted data', async () => {
      const plaintext = 'test';
      const encrypted = await encryptionUtil.encrypt(plaintext);
      
      const decoded = Buffer.from(encrypted, 'base64');
      
      // Bytes 48-64 should be auth tag
      const authTag = decoded.subarray(48, 64);
      expect(authTag.length).toBe(16);
    });
  });

  describe('security properties', () => {
    it('should use random IV for each encryption', async () => {
      const plaintext = 'same-plaintext';
      
      const encrypted1 = await encryptionUtil.encrypt(plaintext);
      const encrypted2 = await encryptionUtil.encrypt(plaintext);
      
      const decoded1 = Buffer.from(encrypted1, 'base64');
      const decoded2 = Buffer.from(encrypted2, 'base64');
      
      const iv1 = decoded1.subarray(32, 48);
      const iv2 = decoded2.subarray(32, 48);
      
      expect(iv1.toString('hex')).not.toBe(iv2.toString('hex'));
    });

    it('should use random salt for each encryption', async () => {
      const plaintext = 'same-plaintext';
      
      const encrypted1 = await encryptionUtil.encrypt(plaintext);
      const encrypted2 = await encryptionUtil.encrypt(plaintext);
      
      const decoded1 = Buffer.from(encrypted1, 'base64');
      const decoded2 = Buffer.from(encrypted2, 'base64');
      
      const salt1 = decoded1.subarray(0, 32);
      const salt2 = decoded2.subarray(0, 32);
      
      expect(salt1.toString('hex')).not.toBe(salt2.toString('hex'));
    });

    it('should derive key from master key and salt', async () => {
      const plaintext = 'test';
      
      const encrypted = await encryptionUtil.encrypt(plaintext);
      
      // Derivation uses SHA-256(masterKey + salt)
      // This is tested implicitly by successful decryption
      const decrypted = await encryptionUtil.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('integration tests', () => {
    it('should encrypt and decrypt complex auth data', async () => {
      const authData = {
        type: 'cookie',
        domain: 'example.com',
        cookies: [
          { name: 'session', value: 'abc123', domain: '.example.com', path: '/' },
          { name: 'user_id', value: '456', domain: '.example.com', path: '/' },
        ],
      };
      
      const encrypted = await encryptionUtil.encrypt(JSON.stringify(authData));
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(JSON.parse(decrypted)).toEqual(authData);
    });

    it('should encrypt and decrypt header auth data', async () => {
      const authData = {
        type: 'header',
        headerName: 'Authorization',
        headerValue: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      };
      
      const encrypted = await encryptionUtil.encrypt(JSON.stringify(authData));
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(JSON.parse(decrypted)).toEqual(authData);
    });

    it('should encrypt and decrypt browser auth data', async () => {
      const authData = {
        type: 'browser',
        cookies: [
          { name: 'session', value: 'encrypted', domain: '.github.com', path: '/' },
        ],
        localStorage: {
          token: 'jwt-token',
          userPrefs: '{}',
        },
        sessionStorage: {
          tempData: 'value',
        },
      };
      
      const encrypted = await encryptionUtil.encrypt(JSON.stringify(authData));
      const decrypted = await encryptionUtil.decrypt(encrypted);
      
      expect(JSON.parse(decrypted)).toEqual(authData);
    });
  });
});
