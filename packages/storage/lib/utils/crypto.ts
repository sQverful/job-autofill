/**
 * Cryptographic utilities for secure token storage
 */

// Simple encryption/decryption using Web Crypto API
export class CryptoManager {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12;

  /**
   * Generate a cryptographic key for encryption/decryption
   */
  private static async generateKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH,
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Derive a key from a password using PBKDF2
   */
  private static async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a deterministic key from extension ID and user context
   */
  private static async getStorageKey(): Promise<CryptoKey> {
    // Use extension ID as base for key derivation
    const extensionId = chrome?.runtime?.id || 'fallback-key';
    const salt = new TextEncoder().encode(extensionId + 'ai-storage-salt');
    
    // Create a fixed-length salt
    const fixedSalt = new Uint8Array(16);
    fixedSalt.set(salt.slice(0, 16));
    
    return await this.deriveKey(extensionId, fixedSalt);
  }

  /**
   * Encrypt a string value
   */
  static async encrypt(plaintext: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      
      const key = await this.getStorageKey();
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a string value
   */
  static async decrypt(encryptedData: string): Promise<string> {
    try {
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, this.IV_LENGTH);
      const encrypted = combined.slice(this.IV_LENGTH);

      const key = await this.getStorageKey();
      
      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a secure hash for data integrity
   */
  static async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = new Uint8Array(hashBuffer);
    return btoa(String.fromCharCode(...hashArray));
  }

  /**
   * Verify data integrity using hash
   */
  static async verifyHash(data: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.hash(data);
      return actualHash === expectedHash;
    } catch (error) {
      console.error('Hash verification failed:', error);
      return false;
    }
  }
}