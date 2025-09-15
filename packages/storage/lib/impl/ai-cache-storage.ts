/**
 * AI Cache storage service for managing AI analysis results and performance optimization
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';
import type { AICache, CachedAnalysis, AIFormAnalysis } from '@extension/shared';

// Default AI cache configuration
const DEFAULT_AI_CACHE: AICache = {
  analyses: {},
  maxSize: 100, // Maximum number of cached analyses
  ttl: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  totalHits: 0,
  lastCleanup: new Date(),
};

// AI cache storage configuration
const AI_CACHE_STORAGE_KEY = 'ai-cache';

// Serialization functions for AI cache
const serializeAICache = (cache: AICache): string => {
  return JSON.stringify(cache, (key, value) => {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });
};

const deserializeAICache = (data: any): AICache => {
  if (typeof data !== 'string') {
    if (data && typeof data === 'object') {
      return convertDatesInCache({
        ...DEFAULT_AI_CACHE,
        ...data,
        analyses: data.analyses || {},
      });
    }
    return DEFAULT_AI_CACHE;
  }

  try {
    const parsed = JSON.parse(data, (key, value) => {
      if (value && typeof value === 'object' && value.__type === 'Date') {
        return new Date(value.value);
      }
      return value;
    });
    
    return convertDatesInCache({
      ...DEFAULT_AI_CACHE,
      ...parsed,
      analyses: parsed.analyses || {},
    });
  } catch (error) {
    console.warn('Failed to deserialize AI cache, using default:', error);
    return DEFAULT_AI_CACHE;
  }
};

// Helper function to convert date fields in cache
const convertDatesInCache = (cache: any): AICache => {
  const converted = { ...cache };

  // Convert lastCleanup date
  if (converted.lastCleanup && !(converted.lastCleanup instanceof Date)) {
    converted.lastCleanup = new Date(converted.lastCleanup);
  }

  // Convert dates in cached analyses
  if (converted.analyses) {
    Object.keys(converted.analyses).forEach(key => {
      const analysis = converted.analyses[key];
      if (analysis.timestamp && !(analysis.timestamp instanceof Date)) {
        analysis.timestamp = new Date(analysis.timestamp);
      }
      if (analysis.analysis?.metadata?.timestamp && !(analysis.analysis.metadata.timestamp instanceof Date)) {
        analysis.analysis.metadata.timestamp = new Date(analysis.analysis.metadata.timestamp);
      }
    });
  }

  return converted as AICache;
};

// Create base storage instance
const baseStorage = createStorage<AICache>(
  AI_CACHE_STORAGE_KEY,
  DEFAULT_AI_CACHE,
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: false, // Cache doesn't need live updates
    serialization: {
      serialize: serializeAICache,
      deserialize: deserializeAICache,
    },
  },
);

// Extended AI cache storage interface
export interface AICacheStorageType extends BaseStorageType<AICache> {
  // Cache management methods
  getCachedAnalysis: (htmlHash: string) => Promise<CachedAnalysis | null>;
  setCachedAnalysis: (htmlHash: string, analysis: AIFormAnalysis, url: string) => Promise<void>;
  deleteCachedAnalysis: (htmlHash: string) => Promise<void>;
  clearCache: () => Promise<void>;
  
  // Cache optimization methods
  cleanupExpired: () => Promise<number>;
  evictLeastUsed: (count: number) => Promise<number>;
  optimizeCache: () => Promise<void>;
  
  // Cache statistics methods
  getCacheStats: () => Promise<CacheStats>;
  getCacheHitRate: () => Promise<number>;
  getTotalHits: () => Promise<number>;
  getCacheSize: () => Promise<number>;
  
  // Configuration methods
  setMaxSize: (maxSize: number) => Promise<void>;
  setTTL: (ttl: number) => Promise<void>;
  getConfiguration: () => Promise<{ maxSize: number; ttl: number }>;
}

// Cache statistics interface
export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  hitRate: number;
  averageAge: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  sizeInBytes: number;
  expiredEntries: number;
}

// AI cache storage implementation
export const aiCacheStorage: AICacheStorageType = {
  ...baseStorage,

  getCachedAnalysis: async (htmlHash: string): Promise<CachedAnalysis | null> => {
    const cache = await baseStorage.get();
    const analysis = cache.analyses[htmlHash];
    
    if (!analysis) {
      return null;
    }

    // Check if analysis has expired
    const now = new Date();
    const age = now.getTime() - analysis.timestamp.getTime();
    
    if (age > cache.ttl) {
      // Remove expired analysis
      await aiCacheStorage.deleteCachedAnalysis(htmlHash);
      return null;
    }

    // Increment hit count
    await baseStorage.set((current: AICache) => ({
      ...current,
      totalHits: current.totalHits + 1,
      analyses: {
        ...current.analyses,
        [htmlHash]: {
          ...analysis,
          hits: analysis.hits + 1,
        },
      },
    }));

    return analysis;
  },

  setCachedAnalysis: async (htmlHash: string, analysis: AIFormAnalysis, url: string) => {
    const cache = await baseStorage.get();
    
    // Check if we need to evict entries to make room
    if (Object.keys(cache.analyses).length >= cache.maxSize && !cache.analyses[htmlHash]) {
      await aiCacheStorage.evictLeastUsed(1);
    }

    const cachedAnalysis: CachedAnalysis = {
      analysis,
      timestamp: new Date(),
      url,
      hits: 0,
      htmlHash,
    };

    await baseStorage.set((current: AICache) => ({
      ...current,
      analyses: {
        ...current.analyses,
        [htmlHash]: cachedAnalysis,
      },
    }));
  },

  deleteCachedAnalysis: async (htmlHash: string) => {
    await baseStorage.set((current: AICache) => {
      const { [htmlHash]: deleted, ...remainingAnalyses } = current.analyses;
      return {
        ...current,
        analyses: remainingAnalyses,
      };
    });
  },

  clearCache: async () => {
    await baseStorage.set((current: AICache) => ({
      ...current,
      analyses: {},
      totalHits: 0,
      lastCleanup: new Date(),
    }));
  },

  cleanupExpired: async (): Promise<number> => {
    const cache = await baseStorage.get();
    const now = new Date();
    let expiredCount = 0;

    const validAnalyses: Record<string, CachedAnalysis> = {};
    
    Object.entries(cache.analyses).forEach(([hash, analysis]) => {
      const age = now.getTime() - analysis.timestamp.getTime();
      if (age <= cache.ttl) {
        validAnalyses[hash] = analysis;
      } else {
        expiredCount++;
      }
    });

    if (expiredCount > 0) {
      await baseStorage.set((current: AICache) => ({
        ...current,
        analyses: validAnalyses,
        lastCleanup: now,
      }));
    }

    return expiredCount;
  },

  evictLeastUsed: async (count: number): Promise<number> => {
    const cache = await baseStorage.get();
    const analyses = Object.entries(cache.analyses);
    
    if (analyses.length <= count) {
      await aiCacheStorage.clearCache();
      return analyses.length;
    }

    // Sort by hits (ascending) and then by timestamp (oldest first)
    analyses.sort((a, b) => {
      if (a[1].hits !== b[1].hits) {
        return a[1].hits - b[1].hits;
      }
      return a[1].timestamp.getTime() - b[1].timestamp.getTime();
    });

    // Remove the least used entries
    const toRemove = analyses.slice(0, count);
    const toKeep = analyses.slice(count);

    const remainingAnalyses: Record<string, CachedAnalysis> = {};
    toKeep.forEach(([hash, analysis]) => {
      remainingAnalyses[hash] = analysis;
    });

    await baseStorage.set((current: AICache) => ({
      ...current,
      analyses: remainingAnalyses,
    }));

    return toRemove.length;
  },

  optimizeCache: async () => {
    // First cleanup expired entries
    const expiredCount = await aiCacheStorage.cleanupExpired();
    
    // Then check if we still need to evict entries
    const cache = await baseStorage.get();
    const currentSize = Object.keys(cache.analyses).length;
    
    if (currentSize > cache.maxSize) {
      const toEvict = currentSize - cache.maxSize;
      await aiCacheStorage.evictLeastUsed(toEvict);
    }

    console.log(`Cache optimized: removed ${expiredCount} expired entries`);
  },

  getCacheStats: async (): Promise<CacheStats> => {
    const cache = await baseStorage.get();
    const analyses = Object.values(cache.analyses);
    const now = new Date();

    if (analyses.length === 0) {
      return {
        totalEntries: 0,
        totalHits: cache.totalHits,
        hitRate: 0,
        averageAge: 0,
        oldestEntry: null,
        newestEntry: null,
        sizeInBytes: 0,
        expiredEntries: 0,
      };
    }

    const ages = analyses.map(a => now.getTime() - a.timestamp.getTime());
    const averageAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;
    
    const timestamps = analyses.map(a => a.timestamp);
    const oldestEntry = new Date(Math.min(...timestamps.map(t => t.getTime())));
    const newestEntry = new Date(Math.max(...timestamps.map(t => t.getTime())));

    const expiredEntries = analyses.filter(a => 
      now.getTime() - a.timestamp.getTime() > cache.ttl
    ).length;

    // Estimate size in bytes (rough calculation)
    const cacheString = serializeAICache(cache);
    const sizeInBytes = new Blob([cacheString]).size;

    const totalRequests = cache.totalHits + analyses.length;
    const hitRate = totalRequests > 0 ? cache.totalHits / totalRequests : 0;

    return {
      totalEntries: analyses.length,
      totalHits: cache.totalHits,
      hitRate,
      averageAge,
      oldestEntry,
      newestEntry,
      sizeInBytes,
      expiredEntries,
    };
  },

  getCacheHitRate: async (): Promise<number> => {
    const stats = await aiCacheStorage.getCacheStats();
    return stats.hitRate;
  },

  getTotalHits: async (): Promise<number> => {
    const cache = await baseStorage.get();
    return cache.totalHits;
  },

  getCacheSize: async (): Promise<number> => {
    const cache = await baseStorage.get();
    return Object.keys(cache.analyses).length;
  },

  setMaxSize: async (maxSize: number) => {
    if (maxSize < 1) {
      throw new Error('Max size must be at least 1');
    }

    await baseStorage.set((current: AICache) => ({
      ...current,
      maxSize,
    }));

    // Optimize cache if current size exceeds new max size
    await aiCacheStorage.optimizeCache();
  },

  setTTL: async (ttl: number) => {
    if (ttl < 60000) { // Minimum 1 minute
      throw new Error('TTL must be at least 60000ms (1 minute)');
    }

    await baseStorage.set((current: AICache) => ({
      ...current,
      ttl,
    }));

    // Cleanup expired entries with new TTL
    await aiCacheStorage.cleanupExpired();
  },

  getConfiguration: async () => {
    const cache = await baseStorage.get();
    return {
      maxSize: cache.maxSize,
      ttl: cache.ttl,
    };
  },
};

// Export default cache for testing and initialization
export { DEFAULT_AI_CACHE };