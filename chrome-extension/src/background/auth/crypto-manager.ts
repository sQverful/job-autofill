/**
 * Cryptographic manager for data encryption and security
 */

// Encryption configuration
interface CryptoConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
}

const DEFAULT_CRYPTO_CONFIG: CryptoConfig = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12,
  saltLength: 16,
  iterations: 100000,
};

/**
 * Cryptographic manager for secure data handling
 */
export class CryptoManager {
  private config: CryptoConfig;
  private masterKey: CryptoKey | null = null;

  constructor(config: Partial<CryptoConfig> = {}) {
    this.config = { ...DEFAULT_CRYPTO_CONFIG, ...config };
  }

  /**
   * Initialize or retrieve master key
   */
  private async getMasterKey(): Promise<CryptoKey> {
    if (this.masterKey) {
      return this.masterKey;
    }

    // Try to get existing key from storage
    const storedKeyData = await this.getStoredKeyData();
    
    if (storedKeyData) {
      try {
        this.masterKey = await this.importKey(storedKeyData.keyData, storedKeyData.salt);
        return this.masterKey;
      } catch (error) {
        console.warn('Failed to import stored key, generating new one:', error);
      }
    }

    // Generate new master key
    this.masterKey = await this.generateMasterKey();
    await this.storeMasterKey(this.masterKey);
    
    return this.masterKey;
  }

  /**
   * Generate new master key
   */
  private async generateMasterKey(): Promise<CryptoKey> {
    // Generate a random password for key derivation
    const password = this.generateSecurePassword();
    const salt = crypto.getRandomValues(new Uint8Array(this.config.saltLength));
    
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive actual encryption key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: this.config.iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: this.config.algorithm,
        length: this.config.keyLength,
      },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  }

  /**
   * Generate secure random password
   */
  private generateSecurePassword(length = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    return Array.from(array, byte => charset[byte % charset.length]).join('');
  }

  /**
   * Store master key securely
   */
  private async storeMasterKey(key: CryptoKey): Promise<void> {
    try {
      // Export key for storage
      const keyData = await crypto.subtle.exportKey('raw', key);
      const salt = crypto.getRandomValues(new Uint8Array(this.config.saltLength));
      
      // Store in Chrome storage (encrypted with browser's built-in encryption)
      await chrome.storage.local.set({
        'crypto-key-data': {
          keyData: Array.from(new Uint8Array(keyData)),
          salt: Array.from(salt),
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Failed to store master key:', error);
      throw new Error('Key storage failed');
    }
  }

  /**
   * Get stored key data
   */
  private async getStoredKeyData(): Promise<{
    keyData: Uint8Array;
    salt: Uint8Array;
  } | null> {
    try {
      const result = await chrome.storage.local.get('crypto-key-data');
      const storedData = result['crypto-key-data'];
      
      if (!storedData) return null;
      
      return {
        keyData: new Uint8Array(storedData.keyData),
        salt: new Uint8Array(storedData.salt),
      };
    } catch (error) {
      console.error('Failed to retrieve stored key:', error);
      return null;
    }
  }

  /**
   * Import key from stored data
   */
  private async importKey(keyData: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'raw',
      keyData,
      {
        name: this.config.algorithm,
        length: this.config.keyLength,
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data
   */
  async encrypt(data: string): Promise<string> {
    try {
      const key = await this.getMasterKey();
      const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength));
      const encodedData = new TextEncoder().encode(data);

      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.config.algorithm,
          iv: iv,
        },
        key,
        encodedData
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedData), iv.length);

      // Return base64 encoded result
      return this.arrayBufferToBase64(combined);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      const key = await this.getMasterKey();
      const combined = this.base64ToArrayBuffer(encryptedData);
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, this.config.ivLength);
      const data = combined.slice(this.config.ivLength);

      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.config.algorithm,
          iv: iv,
        },
        key,
        data
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Hash data using SHA-256
   */
  async hash(data: string): Promise<string> {
    const encodedData = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
    return this.arrayBufferToHex(hashBuffer);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.arrayBufferToBase64(array);
  }

  /**
   * Verify data integrity using HMAC
   */
  async generateHMAC(data: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(data)
    );

    return this.arrayBufferToHex(signature);
  }

  /**
   * Verify HMAC signature
   */
  async verifyHMAC(data: string, signature: string, secret: string): Promise<boolean> {
    try {
      const expectedSignature = await this.generateHMAC(data, secret);
      return this.constantTimeCompare(signature, expectedSignature);
    } catch (error) {
      console.error('HMAC verification failed:', error);
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  private arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Securely wipe sensitive data from memory
   */
  secureWipe(data: any): void {
    if (typeof data === 'string') {
      // For strings, we can't directly wipe memory in JavaScript
      // But we can at least clear the reference
      data = null;
    } else if (data instanceof Uint8Array) {
      // For typed arrays, we can overwrite with random data
      crypto.getRandomValues(data);
    } else if (typeof data === 'object' && data !== null) {
      // For objects, recursively wipe properties
      Object.keys(data).forEach(key => {
        this.secureWipe(data[key]);
        delete data[key];
      });
    }
  }

  /**
   * Generate cryptographically secure UUID
   */
  generateSecureUUID(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    
    // Set version (4) and variant bits
    array[6] = (array[6] & 0x0f) | 0x40;
    array[8] = (array[8] & 0x3f) | 0x80;
    
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32),
    ].join('-');
  }

  /**
   * Encrypt object with metadata
   */
  async encryptObject(obj: any): Promise<string> {
    const metadata = {
      timestamp: Date.now(),
      version: '1.0',
      algorithm: this.config.algorithm,
    };
    
    const payload = {
      metadata,
      data: obj,
    };
    
    return this.encrypt(JSON.stringify(payload));
  }

  /**
   * Decrypt object with metadata validation
   */
  async decryptObject<T = any>(encryptedData: string): Promise<T> {
    const decryptedString = await this.decrypt(encryptedData);
    const payload = JSON.parse(decryptedString);
    
    // Validate metadata
    if (!payload.metadata || !payload.data) {
      throw new Error('Invalid encrypted object format');
    }
    
    // Check if data is too old (optional security measure)
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (Date.now() - payload.metadata.timestamp > maxAge) {
      throw new Error('Encrypted data has expired');
    }
    
    return payload.data;
  }

  /**
   * Clear all stored cryptographic data
   */
  async clearAllCryptoData(): Promise<void> {
    try {
      await chrome.storage.local.remove('crypto-key-data');
      this.masterKey = null;
    } catch (error) {
      console.error('Failed to clear crypto data:', error);
      throw new Error('Failed to clear cryptographic data');
    }
  }

  /**
   * Get crypto manager statistics
   */
  getStats(): {
    hasStoredKey: boolean;
    algorithm: string;
    keyLength: number;
    masterKeyLoaded: boolean;
  } {
    return {
      hasStoredKey: false, // Would need async check
      algorithm: this.config.algorithm,
      keyLength: this.config.keyLength,
      masterKeyLoaded: this.masterKey !== null,
    };
  }
}