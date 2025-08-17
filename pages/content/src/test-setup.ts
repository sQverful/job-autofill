/**
 * Test setup for content script tests
 */

import { vi } from 'vitest';

// Mock DOM globals
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://example.com',
    hostname: 'example.com',
  },
  writable: true,
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock chrome extension APIs if needed
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
} as any;