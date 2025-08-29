/**
 * Test data storage service for managing test data state
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

// Test data configuration
interface TestDataConfig {
  isEnabled: boolean;
  profileType: 'default' | 'frontend-developer' | 'backend-developer';
  lastToggled: Date;
}

// Default test data configuration
const DEFAULT_TEST_DATA_CONFIG: TestDataConfig = {
  isEnabled: false,
  profileType: 'default',
  lastToggled: new Date(),
};

// Storage key for test data configuration
const TEST_DATA_STORAGE_KEY = 'job-autofill-test-data';

// Serialization functions for Date objects
const serializeTestDataConfig = (config: TestDataConfig): string => {
  return JSON.stringify(config, (key, value) => {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });
};

const deserializeTestDataConfig = (data: any): TestDataConfig => {
  // Handle undefined, null, or string representations
  if (data === undefined || data === null || data === 'undefined' || data === 'null' || data === '') {
    return DEFAULT_TEST_DATA_CONFIG;
  }
  
  // If it's already an object, validate and return it
  if (typeof data === 'object' && data !== null) {
    return {
      isEnabled: Boolean(data.isEnabled),
      profileType: data.profileType || 'default',
      lastToggled: data.lastToggled ? new Date(data.lastToggled) : new Date(),
    };
  }
  
  // If it's a string, try to parse it
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data, (key, value) => {
        if (value && typeof value === 'object' && value.__type === 'Date') {
          return new Date(value.value);
        }
        return value;
      });
      
      return {
        isEnabled: Boolean(parsed.isEnabled),
        profileType: parsed.profileType || 'default',
        lastToggled: parsed.lastToggled ? new Date(parsed.lastToggled) : new Date(),
      };
    } catch (error) {
      console.warn('Failed to deserialize test data config, using default:', error);
      return DEFAULT_TEST_DATA_CONFIG;
    }
  }
  
  return DEFAULT_TEST_DATA_CONFIG;
};

// Create base storage instance
const baseStorage = createStorage<TestDataConfig>(
  TEST_DATA_STORAGE_KEY,
  DEFAULT_TEST_DATA_CONFIG,
  {
    storageEnum: StorageEnum.Local, // Use local storage for test data state
    liveUpdate: true,
    serialization: {
      serialize: serializeTestDataConfig,
      deserialize: deserializeTestDataConfig,
    },
  },
);

// Extended test data storage interface
export interface TestDataStorageType extends BaseStorageType<TestDataConfig> {
  // Test data management methods
  enableTestData: (profileType?: TestDataConfig['profileType']) => Promise<void>;
  disableTestData: () => Promise<void>;
  toggleTestData: () => Promise<boolean>;
  isTestDataEnabled: () => Promise<boolean>;
  getProfileType: () => Promise<TestDataConfig['profileType']>;
  setProfileType: (profileType: TestDataConfig['profileType']) => Promise<void>;
}

// Test data storage implementation
export const testDataStorage: TestDataStorageType = {
  ...baseStorage,

  enableTestData: async (profileType: TestDataConfig['profileType'] = 'default') => {
    await baseStorage.set((currentConfig: TestDataConfig) => ({
      ...currentConfig,
      isEnabled: true,
      profileType,
      lastToggled: new Date(),
    }));
  },

  disableTestData: async () => {
    await baseStorage.set((currentConfig: TestDataConfig) => ({
      ...currentConfig,
      isEnabled: false,
      lastToggled: new Date(),
    }));
  },

  toggleTestData: async (): Promise<boolean> => {
    let newState = false;
    await baseStorage.set((currentConfig: TestDataConfig) => {
      newState = !currentConfig.isEnabled;
      return {
        ...currentConfig,
        isEnabled: newState,
        lastToggled: new Date(),
      };
    });
    return newState;
  },

  isTestDataEnabled: async (): Promise<boolean> => {
    const config = await baseStorage.get();
    return config.isEnabled;
  },

  getProfileType: async (): Promise<TestDataConfig['profileType']> => {
    const config = await baseStorage.get();
    return config.profileType;
  },

  setProfileType: async (profileType: TestDataConfig['profileType']) => {
    await baseStorage.set((currentConfig: TestDataConfig) => ({
      ...currentConfig,
      profileType,
      lastToggled: new Date(),
    }));
  },
};

// Export default configuration for testing
export { DEFAULT_TEST_DATA_CONFIG };
export type { TestDataConfig };