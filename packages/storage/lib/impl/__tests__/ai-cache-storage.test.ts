/**
 * Unit tests for AI cache storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiCacheStorage, DEFAULT_AI_CACHE } from '../ai-cache-storage.js';
import type { AIFormAnalysis, CachedAnalysis } from '@extension/shared';

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

// Setup global mocks
Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: mockStorage,
  },
  writable: true,
});

// Helper function to create mock AI analysis
const createMockAnalysis = (id: string = 'test-analysis'): AIFormAnalysis => ({
  instructions: [
    {
      action: 'fill',
      selector: '#name',
      value: 'John Doe',
      reasoning: 'Fill name field',
      confidence: 0.9,
      priority: 1,
    },
  ],
  confidence: 0.9,
  reasoning: 'Test analysis',
  warnings: [],
  metadata: {
    analysisId: id,
    timestamp: new Date(),
    model: 'gpt-3.5-turbo',
    tokensUsed: 100,
  },
});

describe('AI Cache Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockStorage.local.get.mockResolvedValue({});
    mockStorage.local.set.mockResolvedValue(undefined);
  });

  describe('Basic Cache Operations', () => {
    it('should return default cache when no data exists', async () => {
      mockStorage.local.get.mockResolvedValue({});
      
      const cache = await aiCacheStorage.get();
      expect(cache).toEqual(DEFAULT_AI_CACHE);
      expect(cache.analyses).toEqual({});
      expect(cache.maxSize).toBe(100);
      expect(cache.ttl).toBe(24 * 60 * 60 * 1000);
      expect(cache.totalHits).toBe(0);
    });

    it('should merge existing cache with defaults', async () => {
      const existingCache = {
        analyses: { 'test-hash': {} },
        maxSize: 50,
        totalHits: 10,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const cache = await aiCacheStorage.get();
      expect(cache.maxSize).toBe(50);
      expect(cache.totalHits).toBe(10);
      expect(cache.ttl).toBe(24 * 60 * 60 * 1000); // Default value
    });

    it('should handle corrupted cache data gracefully', async () => {
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': 'invalid-json-data',
      });
      
      const cache = await aiCacheStorage.get();
      expect(cache).toEqual(DEFAULT_AI_CACHE);
    });
  });

  describe('Cache Analysis Management', () => {
    it('should store cached analysis', async () => {
      const analysis = createMockAnalysis();
      const htmlHash = 'test-hash-123';
      const url = 'https://example.com/job-form';
      
      await aiCacheStorage.setCachedAnalysis(htmlHash, analysis, url);
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-cache': expect.stringContaining(htmlHash),
      });
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const cacheData = JSON.parse(setCall['ai-cache']);
      
      expect(cacheData.analyses[htmlHash]).toBeDefined();
      expect(cacheData.analyses[htmlHash].analysis).toEqual(analysis);
      expect(cacheData.analyses[htmlHash].url).toBe(url);
      expect(cacheData.analyses[htmlHash].hits).toBe(0);
      expect(cacheData.analyses[htmlHash].htmlHash).toBe(htmlHash);
    });

    it('should retrieve cached analysis and increment hit count', async () => {
      const analysis = createMockAnalysis();
      const htmlHash = 'test-hash-123';
      const cachedAnalysis: CachedAnalysis = {
        analysis,
        timestamp: new Date(),
        url: 'https://example.com',
        hits: 5,
        htmlHash,
      };
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses: { [htmlHash]: cachedAnalysis },
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const result = await aiCacheStorage.getCachedAnalysis(htmlHash);
      
      expect(result).toEqual(cachedAnalysis);
      
      // Should increment hit counts
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-cache': expect.stringContaining('"totalHits":1'),
      });
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const updatedCache = JSON.parse(setCall['ai-cache']);
      expect(updatedCache.analyses[htmlHash].hits).toBe(6);
    });

    it('should return null for non-existent analysis', async () => {
      mockStorage.local.get.mockResolvedValue({});
      
      const result = await aiCacheStorage.getCachedAnalysis('non-existent-hash');
      expect(result).toBeNull();
    });

    it('should remove expired analysis automatically', async () => {
      const analysis = createMockAnalysis();
      const htmlHash = 'expired-hash';
      const expiredTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      const cachedAnalysis: CachedAnalysis = {
        analysis,
        timestamp: expiredTimestamp,
        url: 'https://example.com',
        hits: 5,
        htmlHash,
      };
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses: { [htmlHash]: cachedAnalysis },
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const result = await aiCacheStorage.getCachedAnalysis(htmlHash);
      
      expect(result).toBeNull();
      
      // Should remove expired analysis
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-cache': expect.not.stringContaining(htmlHash),
      });
    });

    it('should delete specific cached analysis', async () => {
      const htmlHash = 'test-hash-123';
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses: {
          [htmlHash]: createMockAnalysis(),
          'other-hash': createMockAnalysis('other'),
        },
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      await aiCacheStorage.deleteCachedAnalysis(htmlHash);
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const updatedCache = JSON.parse(setCall['ai-cache']);
      
      expect(updatedCache.analyses[htmlHash]).toBeUndefined();
      expect(updatedCache.analyses['other-hash']).toBeDefined();
    });

    it('should clear entire cache', async () => {
      await aiCacheStorage.clearCache();
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-cache': expect.stringContaining('"analyses":{}'),
      });
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const clearedCache = JSON.parse(setCall['ai-cache']);
      
      expect(clearedCache.analyses).toEqual({});
      expect(clearedCache.totalHits).toBe(0);
      expect(clearedCache.lastCleanup).toBeTruthy();
    });
  });

  describe('Cache Optimization', () => {
    it('should cleanup expired entries', async () => {
      const now = new Date();
      const validAnalysis = {
        analysis: createMockAnalysis('valid'),
        timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
        url: 'https://example.com',
        hits: 1,
        htmlHash: 'valid-hash',
      };
      
      const expiredAnalysis = {
        analysis: createMockAnalysis('expired'),
        timestamp: new Date(now.getTime() - 25 * 60 * 60 * 1000), // 25 hours ago
        url: 'https://example.com',
        hits: 1,
        htmlHash: 'expired-hash',
      };
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses: {
          'valid-hash': validAnalysis,
          'expired-hash': expiredAnalysis,
        },
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const expiredCount = await aiCacheStorage.cleanupExpired();
      
      expect(expiredCount).toBe(1);
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const cleanedCache = JSON.parse(setCall['ai-cache']);
      
      expect(cleanedCache.analyses['valid-hash']).toBeDefined();
      expect(cleanedCache.analyses['expired-hash']).toBeUndefined();
    });

    it('should evict least used entries', async () => {
      const analyses = {
        'high-usage': {
          analysis: createMockAnalysis('high'),
          timestamp: new Date(),
          url: 'https://example.com',
          hits: 10,
          htmlHash: 'high-usage',
        },
        'medium-usage': {
          analysis: createMockAnalysis('medium'),
          timestamp: new Date(),
          url: 'https://example.com',
          hits: 5,
          htmlHash: 'medium-usage',
        },
        'low-usage': {
          analysis: createMockAnalysis('low'),
          timestamp: new Date(),
          url: 'https://example.com',
          hits: 1,
          htmlHash: 'low-usage',
        },
      };
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const evictedCount = await aiCacheStorage.evictLeastUsed(1);
      
      expect(evictedCount).toBe(1);
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const updatedCache = JSON.parse(setCall['ai-cache']);
      
      expect(updatedCache.analyses['high-usage']).toBeDefined();
      expect(updatedCache.analyses['medium-usage']).toBeDefined();
      expect(updatedCache.analyses['low-usage']).toBeUndefined(); // Should be evicted
    });

    it('should evict by timestamp when hit counts are equal', async () => {
      const oldTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const newTimestamp = new Date();
      
      const analyses = {
        'old-entry': {
          analysis: createMockAnalysis('old'),
          timestamp: oldTimestamp,
          url: 'https://example.com',
          hits: 1,
          htmlHash: 'old-entry',
        },
        'new-entry': {
          analysis: createMockAnalysis('new'),
          timestamp: newTimestamp,
          url: 'https://example.com',
          hits: 1,
          htmlHash: 'new-entry',
        },
      };
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const evictedCount = await aiCacheStorage.evictLeastUsed(1);
      
      expect(evictedCount).toBe(1);
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const updatedCache = JSON.parse(setCall['ai-cache']);
      
      expect(updatedCache.analyses['new-entry']).toBeDefined();
      expect(updatedCache.analyses['old-entry']).toBeUndefined(); // Should be evicted (older)
    });

    it('should optimize cache by cleaning expired and evicting excess', async () => {
      // Create cache that exceeds max size with some expired entries
      const analyses: Record<string, any> = {};
      const now = new Date();
      
      // Add expired entries
      for (let i = 0; i < 5; i++) {
        analyses[`expired-${i}`] = {
          analysis: createMockAnalysis(`expired-${i}`),
          timestamp: new Date(now.getTime() - 25 * 60 * 60 * 1000), // 25 hours ago
          url: 'https://example.com',
          hits: 1,
          htmlHash: `expired-${i}`,
        };
      }
      
      // Add valid entries that exceed max size
      for (let i = 0; i < 110; i++) {
        analyses[`valid-${i}`] = {
          analysis: createMockAnalysis(`valid-${i}`),
          timestamp: now,
          url: 'https://example.com',
          hits: i, // Different hit counts for eviction testing
          htmlHash: `valid-${i}`,
        };
      }
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        maxSize: 100,
        analyses,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      await aiCacheStorage.optimizeCache();
      
      // Should have been called twice: once for cleanup, once for eviction
      expect(mockStorage.local.set).toHaveBeenCalledTimes(2);
    });

    it('should handle cache size enforcement during set operation', async () => {
      // Create cache at max size
      const analyses: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        analyses[`existing-${i}`] = {
          analysis: createMockAnalysis(`existing-${i}`),
          timestamp: new Date(),
          url: 'https://example.com',
          hits: i,
          htmlHash: `existing-${i}`,
        };
      }
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      // Try to add new analysis
      const newAnalysis = createMockAnalysis('new');
      await aiCacheStorage.setCachedAnalysis('new-hash', newAnalysis, 'https://example.com');
      
      // Should evict least used entry to make room
      expect(mockStorage.local.set).toHaveBeenCalledTimes(2); // Once for eviction, once for adding
    });
  });

  describe('Cache Statistics', () => {
    it('should calculate cache statistics correctly', async () => {
      const now = new Date();
      const analyses = {
        'analysis-1': {
          analysis: createMockAnalysis('1'),
          timestamp: new Date(now.getTime() - 60 * 60 * 1000), // 1 hour ago
          url: 'https://example.com',
          hits: 5,
          htmlHash: 'analysis-1',
        },
        'analysis-2': {
          analysis: createMockAnalysis('2'),
          timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
          url: 'https://example.com',
          hits: 3,
          htmlHash: 'analysis-2',
        },
      };
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        totalHits: 20,
        analyses,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const stats = await aiCacheStorage.getCacheStats();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalHits).toBe(20);
      expect(stats.hitRate).toBeCloseTo(20 / 22); // 20 hits / (20 hits + 2 entries)
      expect(stats.averageAge).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
      expect(stats.sizeInBytes).toBeGreaterThan(0);
      expect(stats.expiredEntries).toBe(0);
    });

    it('should handle empty cache statistics', async () => {
      mockStorage.local.get.mockResolvedValue({});
      
      const stats = await aiCacheStorage.getCacheStats();
      
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.averageAge).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
      expect(stats.sizeInBytes).toBeGreaterThan(0); // Still has default cache structure
      expect(stats.expiredEntries).toBe(0);
    });

    it('should get cache hit rate', async () => {
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        totalHits: 80,
        analyses: {
          'test-1': createMockAnalysis(),
          'test-2': createMockAnalysis(),
        },
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const hitRate = await aiCacheStorage.getCacheHitRate();
      expect(hitRate).toBeCloseTo(80 / 82); // 80 hits / (80 hits + 2 entries)
    });

    it('should get total hits', async () => {
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        totalHits: 150,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const totalHits = await aiCacheStorage.getTotalHits();
      expect(totalHits).toBe(150);
    });

    it('should get cache size', async () => {
      const analyses: Record<string, any> = {};
      for (let i = 0; i < 25; i++) {
        analyses[`analysis-${i}`] = createMockAnalysis(`${i}`);
      }
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const size = await aiCacheStorage.getCacheSize();
      expect(size).toBe(25);
    });
  });

  describe('Configuration Management', () => {
    it('should set max size and optimize cache', async () => {
      const analyses: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        analyses[`analysis-${i}`] = {
          analysis: createMockAnalysis(`${i}`),
          timestamp: new Date(),
          url: 'https://example.com',
          hits: i,
          htmlHash: `analysis-${i}`,
        };
      }
      
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        analyses,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      await aiCacheStorage.setMaxSize(50);
      
      // Should update max size and trigger optimization
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-cache': expect.stringContaining('"maxSize":50'),
      });
    });

    it('should reject invalid max size', async () => {
      await expect(aiCacheStorage.setMaxSize(0)).rejects.toThrow('Max size must be at least 1');
      await expect(aiCacheStorage.setMaxSize(-5)).rejects.toThrow('Max size must be at least 1');
    });

    it('should set TTL and cleanup expired entries', async () => {
      const newTTL = 12 * 60 * 60 * 1000; // 12 hours
      
      await aiCacheStorage.setTTL(newTTL);
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        'ai-cache': expect.stringContaining(`"ttl":${newTTL}`),
      });
    });

    it('should reject invalid TTL', async () => {
      await expect(aiCacheStorage.setTTL(30000)).rejects.toThrow('TTL must be at least 60000ms (1 minute)');
      await expect(aiCacheStorage.setTTL(-1000)).rejects.toThrow('TTL must be at least 60000ms (1 minute)');
    });

    it('should get configuration', async () => {
      const existingCache = {
        ...DEFAULT_AI_CACHE,
        maxSize: 75,
        ttl: 12 * 60 * 60 * 1000,
      };
      
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': JSON.stringify(existingCache),
      });
      
      const config = await aiCacheStorage.getConfiguration();
      
      expect(config.maxSize).toBe(75);
      expect(config.ttl).toBe(12 * 60 * 60 * 1000);
    });
  });

  describe('Date Serialization', () => {
    it('should handle date serialization correctly', async () => {
      const cacheWithDates = {
        ...DEFAULT_AI_CACHE,
        lastCleanup: new Date('2023-01-01'),
        analyses: {
          'test-hash': {
            analysis: {
              ...createMockAnalysis(),
              metadata: {
                ...createMockAnalysis().metadata,
                timestamp: new Date('2023-01-02'),
              },
            },
            timestamp: new Date('2023-01-03'),
            url: 'https://example.com',
            hits: 1,
            htmlHash: 'test-hash',
          },
        },
      };
      
      await aiCacheStorage.set(cacheWithDates as any);
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      const serialized = setCall['ai-cache'];
      
      expect(serialized).toContain('"__type":"Date"');
      expect(serialized).toContain('2023-01-01');
      expect(serialized).toContain('2023-01-02');
      expect(serialized).toContain('2023-01-03');
    });

    it('should handle non-string data gracefully', async () => {
      mockStorage.local.get.mockResolvedValue({
        'ai-cache': { maxSize: 50 }, // Object instead of string
      });
      
      const cache = await aiCacheStorage.get();
      expect(cache.maxSize).toBe(50);
      expect(cache.ttl).toBe(24 * 60 * 60 * 1000); // Default merged
    });
  });
});