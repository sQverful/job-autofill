/**
 * Unit tests for AI settings storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiSettingsStorage, DEFAULT_AI_SETTINGS } from '../ai-settings-storage.js';
import type { AISettings } from '@extension/shared';

// Mock chrome storage API
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    onChanged: {
      addListener: vi.fn(),
    },
  },
};

// Mock chrome runtime
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
  },
  storage: mockStorage,
};

// Mock crypto utilities
vi.mock('../../utils/crypto.js', () => ({
  CryptoManager: {
    encrypt: vi.fn().mockResolvedValue('encrypted-token'),
    decrypt: vi.fn().mockResolvedValue('decrypted-token'),
    hash: vi.fn().mockResolvedValue('test-hash'),
    verifyHash: vi.fn().mockResolvedValue(true),
  },
}));

// Setup global mocks
Object.defineProperty(globalThis, 'chrome', {
  value: mockChrome,
  writable: true,
});

describe('AI Settings Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockStorage.local.get.mockResolvedValue({});
    mockStorage.local.set.mockResolvedValue(undefined);
  });

  describe('Basic Settings Operations', () => {
    it('should return default settings when no data exists', async () => {
      mockStorage.local.get.mockResolvedValue({});
      
      const settings = await aiSettingsStorage.get();
      expect(settings).toEqual(DEFAULT_AI_SETTINGS);
      expect(settings.enabled).toBe(false);
      expect(settings.model).toBe('gpt-3.5-turbo');
      expect(settings.maxTokens).toBe(2000);
      expect(settings.temperature).toBe(0.3);
      expect(settings.cacheEnabled).toBe(true);
      expect(settings.autoTrigger).toBe(false);
    });

    it('should merge existing settings with defaults', async () => {
      const existingSettings = {
        enabled: true,
        model: 'gpt-4',
        maxTokens: 3000,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-settings': JSON.stringify(existingSettings),
      });
      
      const settings = await aiSettingsStorage.get();
      expect(settings.enabled).toBe(true);
      expect(settings.model).toBe('gpt-4');
      expect(settings.maxTokens).toBe(3000);
      expect(settings.temperature).toBe(0.3); // Default value
      expect(settings.cacheEnabled).toBe(true); // Default value
    });

    it('should handle corrupted settings data gracefully', async () => {
      mockStorage.local.get.mockResolvedValue({
        'ai-settings': 'invalid-json-data',
      });
      
      const settings = await aiSettingsStorage.get();
      expect(settings).toEqual(DEFAULT_AI_SETTINGS);
    });
  });

  describe('Token Management', () => {
    it('should set token and enable AI mode', async () => {
      const token = 'sk-test-token-123';
      
      await aiSettingsStorage.setToken(token);
      
      // Should encrypt and store token
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-encrypted-token': expect.objectContaining({
          encryptedToken: 'encrypted-token',
          hash: 'test-hash',
          timestamp: expect.any(Date),
        }),
      });
      
      // Should enable AI mode
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"enabled":true'),
      });
    });

    it('should reject empty token', async () => {
      await expect(aiSettingsStorage.setToken('')).rejects.toThrow('Token cannot be empty');
      await expect(aiSettingsStorage.setToken('   ')).rejects.toThrow('Token cannot be empty');
    });

    it('should get decrypted token', async () => {
      const tokenData = {
        encryptedToken: 'encrypted-token',
        hash: 'test-hash',
        timestamp: new Date(),
      };
      
      mockStorage.local.get.mockImplementation((keys) => {
        if (keys.includes('ai-encrypted-token')) {
          return Promise.resolve({ 'ai-encrypted-token': tokenData });
        }
        return Promise.resolve({});
      });
      
      const token = await aiSettingsStorage.getToken();
      expect(token).toBe('decrypted-token');
    });

    it('should return null when no token exists', async () => {
      mockStorage.local.get.mockResolvedValue({});
      
      const token = await aiSettingsStorage.getToken();
      expect(token).toBeNull();
    });

    it('should handle token decryption errors', async () => {
      const { CryptoManager } = await import('../../utils/crypto.js');
      vi.mocked(CryptoManager.decrypt).mockRejectedValue(new Error('Decryption failed'));
      
      const tokenData = {
        encryptedToken: 'corrupted-token',
        hash: 'test-hash',
        timestamp: new Date(),
      };
      
      mockStorage.local.get.mockImplementation((keys) => {
        if (keys.includes('ai-encrypted-token')) {
          return Promise.resolve({ 'ai-encrypted-token': tokenData });
        }
        return Promise.resolve({});
      });
      
      const token = await aiSettingsStorage.getToken();
      expect(token).toBeNull();
      
      // Should clean up corrupted token
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-encrypted-token': null,
      });
    });

    it('should handle token integrity check failure', async () => {
      const { CryptoManager } = await import('../../utils/crypto.js');
      vi.mocked(CryptoManager.verifyHash).mockResolvedValue(false);
      
      const tokenData = {
        encryptedToken: 'encrypted-token',
        hash: 'wrong-hash',
        timestamp: new Date(),
      };
      
      mockStorage.local.get.mockImplementation((keys) => {
        if (keys.includes('ai-encrypted-token')) {
          return Promise.resolve({ 'ai-encrypted-token': tokenData });
        }
        return Promise.resolve({});
      });
      
      const token = await aiSettingsStorage.getToken();
      expect(token).toBeNull();
      
      // Should clean up corrupted token
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-encrypted-token': null,
      });
    });

    it('should delete token and disable AI mode', async () => {
      await aiSettingsStorage.deleteToken();
      
      // Should remove token
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-encrypted-token': null,
      });
      
      // Should disable AI mode
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"enabled":false'),
      });
    });

    it('should check if token exists', async () => {
      // Mock token exists
      mockStorage.local.get.mockImplementation((keys) => {
        if (keys.includes('ai-encrypted-token')) {
          return Promise.resolve({
            'ai-encrypted-token': {
              encryptedToken: 'encrypted-token',
              hash: 'test-hash',
              timestamp: new Date(),
            },
          });
        }
        return Promise.resolve({});
      });
      
      const hasToken = await aiSettingsStorage.hasToken();
      expect(hasToken).toBe(true);
      
      // Mock no token
      mockStorage.local.get.mockResolvedValue({});
      
      const hasNoToken = await aiSettingsStorage.hasToken();
      expect(hasNoToken).toBe(false);
    });
  });

  describe('Token Validation', () => {
    it('should validate token format', async () => {
      const validToken = 'sk-test-token-123';
      const result = await aiSettingsStorage.validateToken(validToken);
      
      expect(result.isValid).toBe(true);
      expect(result.model).toBe('gpt-3.5-turbo');
    });

    it('should reject invalid token format', async () => {
      const invalidToken = 'invalid-token-format';
      const result = await aiSettingsStorage.validateToken(invalidToken);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token format');
    });

    it('should handle missing token', async () => {
      const result = await aiSettingsStorage.validateToken();
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No token provided');
    });

    it('should use stored token when none provided', async () => {
      mockStorage.local.get.mockImplementation((keys) => {
        if (keys.includes('ai-encrypted-token')) {
          return Promise.resolve({
            'ai-encrypted-token': {
              encryptedToken: 'encrypted-token',
              hash: 'test-hash',
              timestamp: new Date(),
            },
          });
        }
        return Promise.resolve({});
      });
      
      const result = await aiSettingsStorage.validateToken();
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Settings Management', () => {
    it('should enable AI mode', async () => {
      await aiSettingsStorage.enableAI();
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"enabled":true'),
      });
    });

    it('should disable AI mode', async () => {
      await aiSettingsStorage.disableAI();
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"enabled":false'),
      });
    });

    it('should check if AI is enabled (requires both setting and token)', async () => {
      // Mock enabled setting but no token
      mockStorage.local.get.mockImplementation((keys) => {
        if (keys.includes('ai-settings')) {
          return Promise.resolve({
            'ai-settings': JSON.stringify({ ...DEFAULT_AI_SETTINGS, enabled: true }),
          });
        }
        return Promise.resolve({});
      });
      
      const isEnabled1 = await aiSettingsStorage.isEnabled();
      expect(isEnabled1).toBe(false); // No token
      
      // Mock both enabled setting and token
      mockStorage.local.get.mockImplementation((keys) => {
        if (keys.includes('ai-settings')) {
          return Promise.resolve({
            'ai-settings': JSON.stringify({ ...DEFAULT_AI_SETTINGS, enabled: true }),
          });
        }
        if (keys.includes('ai-encrypted-token')) {
          return Promise.resolve({
            'ai-encrypted-token': {
              encryptedToken: 'encrypted-token',
              hash: 'test-hash',
              timestamp: new Date(),
            },
          });
        }
        return Promise.resolve({});
      });
      
      const isEnabled2 = await aiSettingsStorage.isEnabled();
      expect(isEnabled2).toBe(true); // Both setting and token
    });

    it('should update model', async () => {
      await aiSettingsStorage.updateModel('gpt-4');
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"model":"gpt-4"'),
      });
    });

    it('should update max tokens with validation', async () => {
      await aiSettingsStorage.updateMaxTokens(1500);
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"maxTokens":1500'),
      });
      
      // Should reject invalid values
      await expect(aiSettingsStorage.updateMaxTokens(50)).rejects.toThrow('Max tokens must be between 100 and 4000');
      await expect(aiSettingsStorage.updateMaxTokens(5000)).rejects.toThrow('Max tokens must be between 100 and 4000');
    });

    it('should update temperature with validation', async () => {
      await aiSettingsStorage.updateTemperature(0.7);
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"temperature":0.7'),
      });
      
      // Should reject invalid values
      await expect(aiSettingsStorage.updateTemperature(-0.1)).rejects.toThrow('Temperature must be between 0 and 2');
      await expect(aiSettingsStorage.updateTemperature(2.1)).rejects.toThrow('Temperature must be between 0 and 2');
    });

    it('should toggle cache setting', async () => {
      // Mock current settings
      mockStorage.local.get.mockResolvedValue({
        'ai-settings': JSON.stringify({ ...DEFAULT_AI_SETTINGS, cacheEnabled: true }),
      });
      
      await aiSettingsStorage.toggleCache();
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"cacheEnabled":false'),
      });
    });

    it('should toggle auto trigger setting', async () => {
      // Mock current settings
      mockStorage.local.get.mockResolvedValue({
        'ai-settings': JSON.stringify({ ...DEFAULT_AI_SETTINGS, autoTrigger: false }),
      });
      
      await aiSettingsStorage.toggleAutoTrigger();
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"autoTrigger":true'),
      });
    });
  });

  describe('Utility Methods', () => {
    it('should reset to defaults', async () => {
      await aiSettingsStorage.resetToDefaults();
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': JSON.stringify(DEFAULT_AI_SETTINGS),
      });
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-encrypted-token': null,
      });
    });

    it('should export settings without token', async () => {
      const testSettings = {
        ...DEFAULT_AI_SETTINGS,
        enabled: true,
        model: 'gpt-4' as const,
        apiToken: 'should-not-be-exported',
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-settings': JSON.stringify(testSettings),
      });
      
      const exported = await aiSettingsStorage.exportSettings();
      const parsed = JSON.parse(exported);
      
      expect(parsed.enabled).toBe(true);
      expect(parsed.model).toBe('gpt-4');
      expect(parsed.apiToken).toBeUndefined();
    });

    it('should import settings with validation', async () => {
      const settingsToImport = {
        model: 'gpt-4',
        maxTokens: 1500,
        temperature: 0.7,
        cacheEnabled: false,
        autoTrigger: true,
      };
      
      const settingsJson = JSON.stringify(settingsToImport);
      await aiSettingsStorage.importSettings(settingsJson);
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-settings': expect.stringContaining('"model":"gpt-4"'),
      });
      
      const setCall = mockStorage.local.set.mock.calls.find(call => 
        call[0]['ai-settings']
      );
      expect(setCall).toBeDefined();
      const importedSettings = JSON.parse(setCall![0]['ai-settings']);
      
      expect(importedSettings.enabled).toBe(false); // Should not import enabled state
      expect(importedSettings.apiToken).toBeUndefined(); // Should not import token
    });

    it('should reject invalid settings on import', async () => {
      const invalidSettings = {
        maxTokens: 50, // Invalid
        temperature: 3, // Invalid
      };
      
      const settingsJson = JSON.stringify(invalidSettings);
      
      await expect(aiSettingsStorage.importSettings(settingsJson)).rejects.toThrow('Failed to import AI settings');
    });

    it('should generate settings hash', async () => {
      const testSettings = {
        ...DEFAULT_AI_SETTINGS,
        model: 'gpt-4' as const,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-settings': JSON.stringify(testSettings),
      });
      
      const hash = await aiSettingsStorage.getSettingsHash();
      expect(hash).toBe('test-hash');
    });
  });

  describe('Serialization', () => {
    it('should handle date serialization correctly', async () => {
      const settingsWithDate = {
        ...DEFAULT_AI_SETTINGS,
        customDate: new Date('2023-01-01'),
      };
      
      await aiSettingsStorage.set(settingsWithDate as any);
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const serialized = setCall['ai-settings'];
      
      expect(serialized).toContain('"__type":"Date"');
      expect(serialized).toContain('2023-01-01');
    });

    it('should handle non-string data gracefully', async () => {
      mockStorage.local.get.mockResolvedValue({
        'ai-settings': { enabled: true }, // Object instead of string
      });
      
      const settings = await aiSettingsStorage.get();
      expect(settings.enabled).toBe(true);
      expect(settings.model).toBe('gpt-3.5-turbo'); // Default merged
    });
  });
});