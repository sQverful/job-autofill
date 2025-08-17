/**
 * API communication layer exports
 */

export { ApiClient, apiClient } from './api-client.js';
export { SyncManager, syncManager } from './sync-manager.js';
export { CacheManager, CachedApiClient, cacheManager, cachedApiClient } from './cache-manager.js';

export type { 
  ApiConfig, 
  ApiResponse, 
  AuthTokens, 
  AuthResponse 
} from './api-client.js';

export type { 
  SyncStatus, 
  SyncState, 
  ConflictResolution, 
  SyncConflict 
} from './sync-manager.js';

export type { 
  CacheStats 
} from './cache-manager.js';