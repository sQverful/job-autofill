/**
 * Offline cache manager for API responses and data
 */

import { createStorage, StorageEnum } from '@extension/storage/lib/base/index.js';

// Cache entry interface
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt: number;
  etag?: string;
}

// Cache configuration
interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
  storageType: StorageEnum;
}

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 100,
  storageType: StorageEnum.Local,
};

// Cache statistics
export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  totalRequests: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

/**
 * Cache manager for offline support and performance optimization
 */
export class CacheManager {
  private config: CacheConfig;
  private storage: any;
  private stats = {
    hits: 0,
    misses: 0,
    requests: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
    this.initializeStorage();
  }

  /**
   * Initialize cache storage
   */
  private initializeStorage(): void {
    this.storage = createStorage<Record<string, CacheEntry>>(
      'api-cache',
      {},
      {
        storageEnum: this.config.storageType,
        liveUpdate: false,
      }
    );
  }

  /**
   * Generate cache key from URL and options
   */
  private generateKey(url: string, options: RequestInit = {}): string {
    const method = options.method || 'GET';
    const body = options.body ? JSON.stringify(options.body) : '';
    const headers = JSON.stringify(options.headers || {});
    
    return `${method}:${url}:${btoa(body + headers)}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isValidEntry(entry: CacheEntry): boolean {
    return Date.now() < entry.expiresAt;
  }

  /**
   * Get cached response
   */
  async get<T = any>(url: string, options: RequestInit = {}): Promise<T | null> {
    this.stats.requests++;
    
    const key = this.generateKey(url, options);
    const cache = await this.storage.get();
    const entry = cache[key];

    if (entry && this.isValidEntry(entry)) {
      this.stats.hits++;
      return entry.data;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set cached response
   */
  async set<T = any>(
    url: string, 
    data: T, 
    options: RequestInit = {}, 
    ttl?: number,
    etag?: string
  ): Promise<void> {
    const key = this.generateKey(url, options);
    const expiresAt = Date.now() + (ttl || this.config.defaultTTL);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt,
      etag,
    };

    await this.storage.set((cache: Record<string, CacheEntry>) => {
      const newCache = { ...cache };
      newCache[key] = entry;

      // Enforce max size by removing oldest entries
      const entries = Object.entries(newCache);
      if (entries.length > this.config.maxSize) {
        entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);
        const toRemove = entries.slice(0, entries.length - this.config.maxSize);
        toRemove.forEach(([keyToRemove]) => delete newCache[keyToRemove]);
      }

      return newCache;
    });
  }

  /**
   * Remove cached entry
   */
  async remove(url: string, options: RequestInit = {}): Promise<void> {
    const key = this.generateKey(url, options);
    
    await this.storage.set((cache: Record<string, CacheEntry>) => {
      const newCache = { ...cache };
      delete newCache[key];
      return newCache;
    });
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.storage.set({});
    this.resetStats();
  }

  /**
   * Clear expired entries
   */
  async clearExpired(): Promise<number> {
    let removedCount = 0;
    
    await this.storage.set((cache: Record<string, CacheEntry>) => {
      const newCache: Record<string, CacheEntry> = {};
      const now = Date.now();
      
      Object.entries(cache).forEach(([key, entry]) => {
        if (entry.expiresAt > now) {
          newCache[key] = entry;
        } else {
          removedCount++;
        }
      });
      
      return newCache;
    });

    return removedCount;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const cache = await this.storage.get();
    const entries = Object.values(cache) as CacheEntry[];
    
    const timestamps = entries.map(entry => entry.timestamp);
    const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;

    return {
      totalEntries: entries.length,
      hitRate: this.stats.requests > 0 ? this.stats.hits / this.stats.requests : 0,
      missRate: this.stats.requests > 0 ? this.stats.misses / this.stats.requests : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalRequests: this.stats.requests,
      oldestEntry: oldestTimestamp ? new Date(oldestTimestamp) : null,
      newestEntry: newestTimestamp ? new Date(newestTimestamp) : null,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, requests: 0 };
  }

  /**
   * Check if response should be cached
   */
  shouldCache(url: string, options: RequestInit = {}): boolean {
    const method = options.method || 'GET';
    
    // Only cache GET requests by default
    if (method !== 'GET') return false;
    
    // Don't cache authentication endpoints
    if (url.includes('/auth/')) return false;
    
    // Don't cache file uploads
    if (options.body instanceof FormData) return false;
    
    return true;
  }

  /**
   * Get cache size in bytes (approximate)
   */
  async getCacheSize(): Promise<number> {
    const cache = await this.storage.get();
    const serialized = JSON.stringify(cache);
    return new Blob([serialized]).size;
  }

  /**
   * Preload cache with common requests
   */
  async preloadCache(requests: Array<{ url: string; options?: RequestInit }>): Promise<void> {
    // This would typically be called with common API endpoints
    // Implementation would depend on specific API structure
    console.log('Preloading cache with', requests.length, 'requests');
  }
}

/**
 * Enhanced API client with caching support
 */
export class CachedApiClient {
  private cacheManager: CacheManager;
  private originalFetch: typeof fetch;

  constructor(cacheConfig?: Partial<CacheConfig>) {
    this.cacheManager = new CacheManager(cacheConfig);
    this.originalFetch = fetch.bind(window);
  }

  /**
   * Cached fetch implementation
   */
  async cachedFetch(
    url: string, 
    options: RequestInit = {},
    cacheOptions?: {
      ttl?: number;
      forceRefresh?: boolean;
      cacheKey?: string;
    }
  ): Promise<Response> {
    const { ttl, forceRefresh = false, cacheKey } = cacheOptions || {};
    const shouldCache = this.cacheManager.shouldCache(url, options);
    
    // Try to get from cache first (unless force refresh)
    if (shouldCache && !forceRefresh) {
      const cached = await this.cacheManager.get(cacheKey || url, options);
      if (cached) {
        // Return cached response
        return new Response(JSON.stringify(cached.data), {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'HIT',
          },
        });
      }
    }

    // Make actual request
    try {
      const response = await this.originalFetch(url, options);
      
      // Cache successful responses
      if (shouldCache && response.ok) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();
        const etag = response.headers.get('etag') || undefined;
        
        await this.cacheManager.set(
          cacheKey || url, 
          { data, status: response.status, headers: Object.fromEntries(response.headers) },
          options,
          ttl,
          etag
        );
      }

      return response;
    } catch (error) {
      // If offline, try to return cached data even if expired
      if (!navigator.onLine && shouldCache) {
        const cached = await this.cacheManager.get(cacheKey || url, options);
        if (cached) {
          return new Response(JSON.stringify(cached.data), {
            status: 200,
            statusText: 'OK (Offline)',
            headers: {
              'Content-Type': 'application/json',
              'X-Cache': 'OFFLINE',
            },
          });
        }
      }

      throw error;
    }
  }

  /**
   * Get cache manager instance
   */
  getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    return this.cacheManager.getStats();
  }
}

// Export singleton instances
export const cacheManager = new CacheManager();
export const cachedApiClient = new CachedApiClient();