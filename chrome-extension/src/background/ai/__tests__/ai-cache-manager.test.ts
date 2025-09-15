/**
 * Unit tests for AI Cache Manager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AICacheManager } from '../ai-cache-manager.js';
import type { ExtractedHTML, AIFormAnalysis } from '@extension/shared';

// Mock the storage module
vi.mock('@extension/storage', async () => {
  const mockCache = {
    analyses: {},
    maxSize: 100,
    ttl: 24 * 60 * 60 * 1000,
    totalHits: 0,
    lastCleanup: new Date(),
  };

  return {
    aiCacheStorage: {
      get: vi.fn().mockResolvedValue(mockCache),
      set: vi.fn().mockImplementation((updater) => {
        if (typeof updater === 'function') {
          const newCache = updater(mockCache);
          Object.assign(mockCache, newCache);
        } else {
          Object.assign(mockCache, updater);
        }
        return Promise.resolve();
      }),
    },
  };
});

describe('AICacheManager', () => {
  let cacheManager: AICacheManager;
  let mockExtractedHTML: ExtractedHTML;
  let mockAnalysis: AIFormAnalysis;

  beforeEach(() => {
    cacheManager = new AICacheManager();
    
    mockExtractedHTML = {
      html: '<form><input name="test" type="text"></form>',
      hash: 'test-hash-123',
      metadata: {
        url: 'https://example.com/apply',
        timestamp: new Date(),
        formCount: 1,
        fieldCount: 1,
        pageTitle: 'Test Form',
      },
    };

    mockAnalysis = {
      instructions: [
        {
          action: 'fill',
          selector: 'input[name="test"]',
          value: 'test value',
          options: [],
          reasoning: 'Test instruction',
          confidence: 90,
          priority: 8,
        },
      ],
      confidence: 90,
      reasoning: 'Test analysis',
      warnings: [],
      metadata: {
        analysisId: 'test-analysis-123',
        timestamp: new Date(),
        model: 'gpt-3.5-turbo',
        tokensUsed: 100,
      },
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    cacheManager.stopCleanupTimer();
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys', () => {
      const key1 = (cacheManager as any).generateCacheKey(mockExtractedHTML, 'user123');
      const key2 = (cacheManager as any).generateCacheKey(mockExtractedHTML, 'user123');
      
      expect(key1).toBe(key2);
      expect(typeof key1).toBe('string');
      expect(key1.length).toBeGreaterThan(0);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = (cacheManager as any).generateCacheKey(mockExtractedHTML, 'user123');
      const key2 = (cacheManager as any).generateCacheKey(mockExtractedHTML, 'user456');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('caching operations', () => {
    it('should cache and retrieve analysis', async () => {
      const userHash = 'user123';
      
      // Initially not cached
      const isCached1 = await cacheManager.isCached(mockExtractedHTML, userHash);
      expect(isCached1).toBe(false);
      
      // Cache the analysis
      await cacheManager.setCachedAnalysis(mockExtractedHTML, mockAnalysis, userHash);
      
      // Should now be cached
      const isCached2 = await cacheManager.isCached(mockExtractedHTML, userHash);
      expect(isCached2).toBe(true);
      
      // Should retrieve the cached analysis
      const cachedAnalysis = await cacheManager.getCachedAnalysis(mockExtractedHTML, userHash);
      expect(cachedAnalysis).toEqual(mockAnalysis);
    });

    it('should return null for non-existent cache entries', async () => {
      const cachedAnalysis = await cacheManager.getCachedAnalysis(mockExtractedHTML, 'nonexistent');
      expect(cachedAnalysis).toBeNull();
    });

    it('should handle cache without user hash', async () => {
      await cacheManager.setCachedAnalysis(mockExtractedHTML, mockAnalysis);
      
      const cachedAnalysis = await cacheManager.getCachedAnalysis(mockExtractedHTML);
      expect(cachedAnalysis).toEqual(mockAnalysis);
    });
  });

  describe('cache statistics', () => {
    it('should return correct stats for empty cache', async () => {
      const stats = await cacheManager.getCacheStats();
      
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
      expect(stats.hitRate).toBe(0);
    });

    it('should track cache hits correctly', async () => {
      const userHash = 'user123';
      
      // Cache an analysis
      await cacheManager.setCachedAnalysis(mockExtractedHTML, mockAnalysis, userHash);
      
      // Access it multiple times
      await cacheManager.getCachedAnalysis(mockExtractedHTML, userHash);
      await cacheManager.getCachedAnalysis(mockExtractedHTML, userHash);
      
      const stats = await cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.totalHits).toBe(2);
    });
  });

  describe('cache cleanup', () => {
    it('should clear all cache entries', async () => {
      // Cache some analyses
      await cacheManager.setCachedAnalysis(mockExtractedHTML, mockAnalysis, 'user1');
      await cacheManager.setCachedAnalysis(mockExtractedHTML, mockAnalysis, 'user2');
      
      // Clear cache
      await cacheManager.clearCache();
      
      // Should be empty
      const stats = await cacheManager.getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock storage error
      const { aiCacheStorage } = await import('@extension/storage');
      vi.mocked(aiCacheStorage.get).mockRejectedValueOnce(new Error('Storage error'));
      
      const removedCount = await cacheManager.cleanupExpiredEntries();
      expect(removedCount).toBe(0);
    });
  });

  describe('cache configuration', () => {
    it('should return cache configuration', () => {
      const config = cacheManager.getCacheConfig();
      
      expect(config).toHaveProperty('maxSize');
      expect(config).toHaveProperty('ttl');
      expect(config).toHaveProperty('cleanupInterval');
      expect(config).toHaveProperty('maxHtmlSize');
    });

    it('should update cache configuration', () => {
      const newConfig = { maxSize: 50 };
      cacheManager.updateCacheConfig(newConfig);
      
      const config = cacheManager.getCacheConfig();
      expect(config.maxSize).toBe(50);
    });
  });

  describe('URL-based search', () => {
    it('should find cached analyses by URL pattern', async () => {
      await cacheManager.setCachedAnalysis(mockExtractedHTML, mockAnalysis, 'user1');
      
      const results = await cacheManager.findCachedAnalysesByUrl('example.com');
      expect(results).toHaveLength(1);
      expect(results[0].url).toBe(mockExtractedHTML.metadata.url);
    });

    it('should return empty array for non-matching patterns', async () => {
      await cacheManager.setCachedAnalysis(mockExtractedHTML, mockAnalysis, 'user1');
      
      const results = await cacheManager.findCachedAnalysesByUrl('nonexistent.com');
      expect(results).toHaveLength(0);
    });
  });

  describe('hash function', () => {
    it('should generate consistent hashes', () => {
      const hash1 = (cacheManager as any).hashString('test string');
      const hash2 = (cacheManager as any).hashString('test string');
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
    });

    it('should generate different hashes for different strings', () => {
      const hash1 = (cacheManager as any).hashString('string1');
      const hash2 = (cacheManager as any).hashString('string2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty strings', () => {
      const hash = (cacheManager as any).hashString('');
      expect(hash).toBe('0');
    });
  });
});