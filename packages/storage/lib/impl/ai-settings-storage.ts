/**
 * AI Settings storage service for managing OpenAI configuration and preferences
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';
import type { AISettings, AITokenValidationResult } from '@extension/shared';
import { CryptoManager } from '../utils/crypto.js';

// Default AI settings
const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  model: 'gpt-3.5-turbo',
  maxTokens: 2000,
  temperature: 0.3,
  cacheEnabled: true,
  autoTrigger: false,
};

// AI settings storage configuration
const AI_SETTINGS_STORAGE_KEY = 'ai-settings';

// Encrypted token storage
interface EncryptedTokenData {
  encryptedToken: string;
  hash: string;
  timestamp: Date;
}

// Serialization functions for AI settings
const serializeAISettings = (settings: AISettings): string => {
  return JSON.stringify(settings, (key, value) => {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });
};

const deserializeAISettings = (data: any): AISettings => {
  if (typeof data !== 'string') {
    if (data && typeof data === 'object') {
      return { ...DEFAULT_AI_SETTINGS, ...data };
    }
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const parsed = JSON.parse(data, (key, value) => {
      if (value && typeof value === 'object' && value.__type === 'Date') {
        return new Date(value.value);
      }
      return value;
    });
    
    return { ...DEFAULT_AI_SETTINGS, ...parsed };
  } catch (error) {
    console.warn('Failed to deserialize AI settings, using default:', error);
    return DEFAULT_AI_SETTINGS;
  }
};

// Create base storage instance
const baseStorage = createStorage<AISettings>(
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
    serialization: {
      serialize: serializeAISettings,
      deserialize: deserializeAISettings,
    },
  },
);

// Extended AI settings storage interface
export interface AISettingsStorageType extends BaseStorageType<AISettings> {
  // Token management methods
  setToken: (token: string) => Promise<void>;
  getToken: () => Promise<string | null>;
  deleteToken: () => Promise<void>;
  hasToken: () => Promise<boolean>;
  validateToken: (token?: string) => Promise<AITokenValidationResult>;
  
  // Settings management methods
  enableAI: () => Promise<void>;
  disableAI: () => Promise<void>;
  isEnabled: () => Promise<boolean>;
  updateModel: (model: AISettings['model']) => Promise<void>;
  updateMaxTokens: (maxTokens: number) => Promise<void>;
  updateTemperature: (temperature: number) => Promise<void>;
  toggleCache: () => Promise<void>;
  toggleAutoTrigger: () => Promise<void>;
  
  // Utility methods
  resetToDefaults: () => Promise<void>;
  exportSettings: () => Promise<string>;
  importSettings: (settingsData: string) => Promise<void>;
  getSettingsHash: () => Promise<string>;
}

// Token storage key (separate from main settings)
const TOKEN_STORAGE_KEY = 'ai-encrypted-token';

// Create token storage
const tokenStorage = createStorage<EncryptedTokenData | null>(
  TOKEN_STORAGE_KEY,
  null,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: false,
  },
);

// AI settings storage implementation
export const aiSettingsStorage: AISettingsStorageType = {
  ...baseStorage,

  setToken: async (token: string) => {
    try {
      if (!token || token.trim().length === 0) {
        throw new Error('Token cannot be empty');
      }

      // Encrypt the token
      const encryptedToken = await CryptoManager.encrypt(token);
      const hash = await CryptoManager.hash(token);
      
      const tokenData: EncryptedTokenData = {
        encryptedToken,
        hash,
        timestamp: new Date(),
      };

      await tokenStorage.set(tokenData);
      
      // Enable AI mode when token is set
      await baseStorage.set((current: AISettings) => ({
        ...current,
        enabled: true,
      }));
    } catch (error) {
      console.error('Failed to set AI token:', error);
      throw new Error('Failed to securely store AI token');
    }
  },

  getToken: async (): Promise<string | null> => {
    try {
      const tokenData = await tokenStorage.get();
      if (!tokenData) {
        return null;
      }

      // Decrypt the token
      const decryptedToken = await CryptoManager.decrypt(tokenData.encryptedToken);
      
      // Verify integrity
      const isValid = await CryptoManager.verifyHash(decryptedToken, tokenData.hash);
      if (!isValid) {
        console.warn('Token integrity check failed, removing corrupted token');
        await tokenStorage.set(null);
        return null;
      }

      return decryptedToken;
    } catch (error) {
      console.error('Failed to get AI token:', error);
      // Clean up corrupted token data
      await tokenStorage.set(null);
      return null;
    }
  },

  deleteToken: async () => {
    try {
      await tokenStorage.set(null);
      
      // Disable AI mode when token is deleted
      await baseStorage.set((current: AISettings) => ({
        ...current,
        enabled: false,
      }));
    } catch (error) {
      console.error('Failed to delete AI token:', error);
      throw new Error('Failed to delete AI token');
    }
  },

  hasToken: async (): Promise<boolean> => {
    try {
      const tokenData = await tokenStorage.get();
      if (!tokenData) {
        return false;
      }

      // Decrypt the token to verify it exists and is valid
      const decryptedToken = await CryptoManager.decrypt(tokenData.encryptedToken);
      
      // Verify integrity
      const isValid = await CryptoManager.verifyHash(decryptedToken, tokenData.hash);
      if (!isValid) {
        console.warn('Token integrity check failed in hasToken, removing corrupted token');
        await tokenStorage.set(null);
        return false;
      }

      return decryptedToken !== null && decryptedToken.length > 0;
    } catch (error) {
      console.error('Failed to check token existence:', error);
      // Clean up corrupted token data
      await tokenStorage.set(null);
      return false;
    }
  },

  validateToken: async (token?: string): Promise<AITokenValidationResult> => {
    try {
      // Get token directly from storage to avoid circular reference
      let tokenToValidate: string | undefined = token;
      if (!tokenToValidate) {
        try {
          const tokenData = await tokenStorage.get();
          if (tokenData) {
            tokenToValidate = await CryptoManager.decrypt(tokenData.encryptedToken);
            // Verify integrity
            const isValid = await CryptoManager.verifyHash(tokenToValidate, tokenData.hash);
            if (!isValid) {
              console.warn('Token integrity check failed in validateToken');
              tokenToValidate = undefined;
            }
          }
        } catch (error) {
          console.error('Failed to get token for validation:', error);
          tokenToValidate = undefined;
        }
      }
      
      if (!tokenToValidate) {
        return {
          isValid: false,
          error: 'No token provided',
        };
      }

      // Basic token format validation
      if (!tokenToValidate.startsWith('sk-')) {
        return {
          isValid: false,
          error: 'Invalid token format',
        };
      }

      // For now, return basic validation
      // In a real implementation, this would make an API call to OpenAI
      return {
        isValid: true,
        model: 'gpt-3.5-turbo',
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  },

  enableAI: async () => {
    await baseStorage.set((current: AISettings) => ({
      ...current,
      enabled: true,
    }));
  },

  disableAI: async () => {
    await baseStorage.set((current: AISettings) => ({
      ...current,
      enabled: false,
    }));
  },

  isEnabled: async (): Promise<boolean> => {
    const settings = await baseStorage.get();
    // Use the tokenStorage directly to avoid circular reference
    const tokenData = await tokenStorage.get();
    const hasToken = tokenData !== null;
    return settings.enabled && hasToken;
  },

  updateModel: async (model: AISettings['model']) => {
    await baseStorage.set((current: AISettings) => ({
      ...current,
      model,
    }));
  },

  updateMaxTokens: async (maxTokens: number) => {
    if (maxTokens < 100 || maxTokens > 4000) {
      throw new Error('Max tokens must be between 100 and 4000');
    }
    
    await baseStorage.set((current: AISettings) => ({
      ...current,
      maxTokens,
    }));
  },

  updateTemperature: async (temperature: number) => {
    if (temperature < 0 || temperature > 2) {
      throw new Error('Temperature must be between 0 and 2');
    }
    
    await baseStorage.set((current: AISettings) => ({
      ...current,
      temperature,
    }));
  },

  toggleCache: async () => {
    await baseStorage.set((current: AISettings) => ({
      ...current,
      cacheEnabled: !current.cacheEnabled,
    }));
  },

  toggleAutoTrigger: async () => {
    await baseStorage.set((current: AISettings) => ({
      ...current,
      autoTrigger: !current.autoTrigger,
    }));
  },

  resetToDefaults: async () => {
    await baseStorage.set(DEFAULT_AI_SETTINGS);
    await tokenStorage.set(null);
  },

  exportSettings: async (): Promise<string> => {
    const settings = await baseStorage.get();
    // Don't export the token for security reasons
    const exportData = {
      ...settings,
      apiToken: undefined,
    };
    return serializeAISettings(exportData);
  },

  importSettings: async (settingsData: string) => {
    try {
      const importedSettings = deserializeAISettings(settingsData);
      
      // Validate imported settings
      if (importedSettings.maxTokens < 100 || importedSettings.maxTokens > 4000) {
        throw new Error('Invalid maxTokens value in imported settings');
      }
      
      if (importedSettings.temperature < 0 || importedSettings.temperature > 2) {
        throw new Error('Invalid temperature value in imported settings');
      }

      // Don't import token or enabled state for security
      const settingsToImport = {
        ...importedSettings,
        apiToken: undefined,
        enabled: false,
      };

      await baseStorage.set(settingsToImport);
    } catch (error: any) {
      throw new Error(`Failed to import AI settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  getSettingsHash: async (): Promise<string> => {
    const settings = await baseStorage.get();
    const settingsString = serializeAISettings(settings);
    return await CryptoManager.hash(settingsString);
  },
};

// Export default settings for testing and initialization
export { DEFAULT_AI_SETTINGS };