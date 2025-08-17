/**
 * Background service worker coordination system exports
 */

// API Communication Layer
export * from './api/index.js';

// Message Passing System
export * from './messaging/index.js';

// Authentication and Security
export * from './auth/index.js';

// Re-export key instances for external use
export { apiClient, syncManager, cacheManager } from './api/index.js';
export { messageRouter, stateManager, errorHandler } from './messaging/index.js';
export { authManager, privacyManager } from './auth/index.js';