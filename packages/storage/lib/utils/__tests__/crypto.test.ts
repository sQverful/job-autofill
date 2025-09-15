/**
 * Unit tests for crypto utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CryptoManager } from '../crypto.js';

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    generateKey: vi.fn(),
    importKey: vi.fn(),
    deriveKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    digest: vi.fn(),
  },
  getRandomValues: vi.fn(),
};

// Mock chrome runtime
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
  },
};

// Setup global mocks
Object.defineProperty(globalThis, 'crypto', {
  value: mockCrypto,
  writable: true,
});

Object.defineProperty(globalThis, 'chrome', {
  value: mockChrome,
  writable: true,
});

// Mock TextEncoder/TextDecoder
Object.defineProperty(globalThis, 'TextEncoder', {
  value: class TextEncoder {
    encode(input: string) {
      return new Uint8Array(Buffer.from(input, 'utf8'));
    }
  },
  writable: true,
});

Object.defineProperty(globalThis, 'TextDecoder', {
  value: class TextDecoder {
    decode(input: Uint8Array) {
      return Buffer.from(input).toString('utf8');
    }
  },
  writable: true,
});

// Mock btoa/atob
Object.defineProperty(globalThis, 'btoa', {
  value: (str: string) => Buffer.from(str, 'binary').toString('base64'),
  writable: true,
});

Object.defineProperty(globalThis, 'atob', {
  value: (str: string) => Buffer.from(str, 'base64').toString('binary'),
  writable: true,
});

describe('CryptoManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockCrypto.subtle.importKey.mockResolvedValue({} as CryptoKey);
    mockCrypto.subtle.deriveKey.mockResolvedValue({} as CryptoKey);
    mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
      // Fill with predictable values for testing
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext successfully', async () => {
      const plaintext = 'test-api-token';
      const mockEncrypted = new ArrayBuffer(32);
      
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);

      const result = await CryptoManager.encrypt(plaintext);
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array),
        }),
        expect.any(Object),
        expect.any(Uint8Array)
      );
    });

    it('should handle encryption errors gracefully', async () => {
      const plaintext = 'test-token';
      
      mockCrypto.subtle.encrypt.mockRejectedValue(new Error('Encryption failed'));

      await expect(CryptoManager.encrypt(plaintext)).rejects.toThrow('Failed to encrypt data');
    });

    it('should use different IVs for different encryptions', async () => {
      const plaintext = 'test-token';
      const mockEncrypted = new ArrayBuffer(32);
      
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);
      
      // Mock getRandomValues to return different values each time
      let callCount = 0;
      mockCrypto.getRandomValues.mockImplementation((array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = (i + callCount) % 256;
        }
        callCount++;
        return array;
      });

      const result1 = await CryptoManager.encrypt(plaintext);
      const result2 = await CryptoManager.encrypt(plaintext);
      
      expect(result1).not.toBe(result2);
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data successfully', async () => {
      const originalText = 'test-api-token';
      const mockDecrypted = new TextEncoder().encode(originalText);
      
      mockCrypto.subtle.decrypt.mockResolvedValue(mockDecrypted.buffer);

      // Create a mock encrypted string (base64 encoded IV + encrypted data)
      const mockIV = new Uint8Array(12);
      const mockEncryptedData = new Uint8Array(32);
      const combined = new Uint8Array(44);
      combined.set(mockIV);
      combined.set(mockEncryptedData, 12);
      const encryptedString = btoa(String.fromCharCode(...combined));

      const result = await CryptoManager.decrypt(encryptedString);
      
      expect(result).toBe(originalText);
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array),
        }),
        expect.any(Object),
        expect.any(ArrayBuffer)
      );
    });

    it('should handle decryption errors gracefully', async () => {
      const encryptedString = 'invalid-encrypted-data';
      
      mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(CryptoManager.decrypt(encryptedString)).rejects.toThrow('Failed to decrypt data');
    });

    it('should handle invalid base64 input', async () => {
      const invalidBase64 = 'not-valid-base64!@#';

      await expect(CryptoManager.decrypt(invalidBase64)).rejects.toThrow('Failed to decrypt data');
    });
  });

  describe('hash', () => {
    it('should generate consistent hash for same input', async () => {
      const data = 'test-data-to-hash';
      const mockHash = new ArrayBuffer(32);
      
      mockCrypto.subtle.digest.mockResolvedValue(mockHash);

      const result1 = await CryptoManager.hash(data);
      const result2 = await CryptoManager.hash(data);
      
      expect(result1).toBe(result2);
      expect(typeof result1).toBe('string');
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith(
        'SHA-256',
        expect.any(Uint8Array)
      );
    });

    it('should generate different hashes for different inputs', async () => {
      const data1 = 'test-data-1';
      const data2 = 'test-data-2';
      const mockHash1 = new ArrayBuffer(32);
      const mockHash2 = new ArrayBuffer(32);
      
      // Fill with different data
      new Uint8Array(mockHash1).fill(1);
      new Uint8Array(mockHash2).fill(2);
      
      mockCrypto.subtle.digest
        .mockResolvedValueOnce(mockHash1)
        .mockResolvedValueOnce(mockHash2);

      const result1 = await CryptoManager.hash(data1);
      const result2 = await CryptoManager.hash(data2);
      
      expect(result1).not.toBe(result2);
    });

    it('should handle hashing errors gracefully', async () => {
      const data = 'test-data';
      
      mockCrypto.subtle.digest.mockRejectedValue(new Error('Hashing failed'));

      await expect(CryptoManager.hash(data)).rejects.toThrow();
    });
  });

  describe('verifyHash', () => {
    it('should verify correct hash successfully', async () => {
      const data = 'test-data';
      const mockHash = new ArrayBuffer(32);
      const expectedHash = btoa(String.fromCharCode(...new Uint8Array(mockHash)));
      
      mockCrypto.subtle.digest.mockResolvedValue(mockHash);

      const result = await CryptoManager.verifyHash(data, expectedHash);
      
      expect(result).toBe(true);
    });

    it('should reject incorrect hash', async () => {
      const data = 'test-data';
      const mockHash = new ArrayBuffer(32);
      const wrongHash = 'wrong-hash-value';
      
      mockCrypto.subtle.digest.mockResolvedValue(mockHash);

      const result = await CryptoManager.verifyHash(data, wrongHash);
      
      expect(result).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      const data = 'test-data';
      const hash = 'some-hash';
      
      mockCrypto.subtle.digest.mockRejectedValue(new Error('Verification failed'));

      const result = await CryptoManager.verifyHash(data, hash);
      
      expect(result).toBe(false);
    });
  });

  describe('key derivation', () => {
    it('should use extension ID for key derivation', async () => {
      const plaintext = 'test-token';
      const mockEncrypted = new ArrayBuffer(32);
      
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);

      await CryptoManager.encrypt(plaintext);
      
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      
      expect(mockCrypto.subtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          salt: expect.any(Uint8Array),
          iterations: 100000,
          hash: 'SHA-256',
        }),
        expect.any(Object),
        expect.objectContaining({
          name: 'AES-GCM',
          length: 256,
        }),
        true,
        ['encrypt', 'decrypt']
      );
    });

    it('should handle missing chrome runtime gracefully', async () => {
      // Temporarily remove chrome mock
      const originalChrome = globalThis.chrome;
      delete (globalThis as any).chrome;

      const plaintext = 'test-token';
      const mockEncrypted = new ArrayBuffer(32);
      
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);

      const result = await CryptoManager.encrypt(plaintext);
      
      expect(result).toBeTruthy();
      
      // Restore chrome mock
      Object.defineProperty(globalThis, 'chrome', {
        value: originalChrome,
        writable: true,
      });
    });
  });
});