/**
 * Test setup file for chrome-extension tests
 */

import { vi } from 'vitest';

// Mock Chrome extension APIs
const mockChromeStorage = {
  get: vi.fn().mockResolvedValue({}),
  set: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(),
  },
};

const mockChromeRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    hasListener: vi.fn(),
  },
  lastError: null,
  id: 'test-extension-id',
};

// Mock DOM globals
Object.defineProperty(window, 'chrome', {
  value: {
    storage: {
      local: mockChromeStorage,
      sync: mockChromeStorage,
    },
    runtime: mockChromeRuntime,
  },
  writable: true,
});

// Also set global chrome for Node.js environment
Object.defineProperty(global, 'chrome', {
  value: {
    storage: {
      local: mockChromeStorage,
      sync: mockChromeStorage,
    },
    runtime: mockChromeRuntime,
  },
  writable: true,
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock AbortController
global.AbortController = class AbortController {
  signal = {
    aborted: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  abort = vi.fn();
};