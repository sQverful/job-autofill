/**
 * AI Cache Manager for storing and retrieving form analysis results
 */

import type { 
  AIFormAnalysis, 
  CachedAnalysis, 
  AICache,
  ExtractedHTML 
} from '@extension/shared';
import { aiCacheStorage } from '@extension/storage';
import { aiPerformanceMonitor } from './ai-performance-monitor.js';

/**
 * Cache configuration with performance optimizations
 */
const CACHE_CONFIG = {
  maxSize: 150, // Increased maximum number of cached analyses
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds (longer TTL for better performance)
  cleanupInterval: 30 * 60 * 1000, // 30 minutes cleanup interval (more frequent)
  maxHtmlSize: 50000, // Reduced max HTML size to cache (50KB) for better performance
  compressionEnabled: true, // Enable compression for cached data
  intelligentEviction: true, // Use intelligent eviction based on usage patterns
  batchSize: 10, // Batch size for cleanup operations
  hitRateThreshold: 0.1, // Minimum hit rate to keep entries (10%)
};

/**
 * AI Cache Manager class
 */
export class AICacheManager {
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Generate cache key from HTML content
   */
  private generateCacheKey(extractedHTML: ExtractedHTML, userProfileHash?: string): string {
    const content = `${extractedHTML.hash}:${extractedHTML.metadata.url}:${userProfileHash || 'default'}`;
    return this.hashString(content);
  }

  /**
   * Simple hash function for generating cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if analysis is cached and still valid
   */
  async isCached(extractedHTML: ExtractedHTML, userProfileHash?: string): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(extractedHTML, userProfileHash);
      const cache = await aiCacheStorage.get();
      const cachedAnalysis = cache.analyses[cacheKey];
      
      if (!cachedAnalysis) return false;
      
      // Check if cache entry is still valid (not expired)
      const now = Date.now();
      const cacheAge = now - new Date(cachedAnalysis.timestamp).getTime();
      
      return cacheAge < CACHE_CONFIG.ttl;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }

  /**
   * Get cached analysis if available and valid with performance optimizations
   */
  async getCachedAnalysis(
    extractedHTML: ExtractedHTML, 
    userProfileHash?: string
  ): Promise<AIFormAnalysis | null> {
    try {
      const cacheKey = this.generateCacheKey(extractedHTML, userProfileHash);
      const cache = await aiCacheStorage.get();
      const cachedAnalysis = cache.analyses[cacheKey];
      
      if (!cachedAnalysis) {
        aiPerformanceMonitor.recordEvent({ type: 'cache_miss' });
        return null;
      }
      
      // Check if cache entry is still valid
      const now = Date.now();
      const cacheAge = now - new Date(cachedAnalysis.timestamp).getTime();
      
      if (cacheAge >= CACHE_CONFIG.ttl) {
        // Cache expired, remove it asynchronously to avoid blocking
        this.removeCachedAnalysis(cacheKey).catch(error => 
          console.warn('Failed to remove expired cache entry:', error)
        );
        aiPerformanceMonitor.recordEvent({ type: 'cache_miss', metadata: { reason: 'expired' } });
        return null;
      }
      
      // Update hit count and last accessed time
      const updatedAnalysis = {
        ...cachedAnalysis,
        hits: cachedAnalysis.hits + 1,
        lastAccessed: new Date(),
      };
      
      // Update cache asynchronously to avoid blocking the return
      aiCacheStorage.set((current) => ({
        ...current,
        analyses: {
          ...current.analyses,
          [cacheKey]: updatedAnalysis,
        },
        totalHits: current.totalHits + 1,
      })).catch(error => 
        console.warn('Failed to update cache hit count:', error)
      );
      
      // Record cache hit
      aiPerformanceMonitor.recordEvent({ 
        type: 'cache_hit', 
        metadata: { 
          age: cacheAge,
          hits: cachedAnalysis.hits + 1
        } 
      });

      // Decompress if needed
      const analysis = CACHE_CONFIG.compressionEnabled 
        ? this.decompressAnalysis(cachedAnalysis.analysis)
        : cachedAnalysis.analysis;
      
      return analysis;
    } catch (error) {
      console.error('Error getting cached analysis:', error);
      return null;
    }
  }

  /**
   * Decompress analysis data
   */
  private decompressAnalysis(analysis: AIFormAnalysis): AIFormAnalysis {
    // For now, just return as-is since we only do simple truncation
    // In the future, this could implement actual compression/decompression
    return analysis;
  }

  /**
   * Cache analysis result with intelligent storage optimization
   */
  async setCachedAnalysis(
    extractedHTML: ExtractedHTML,
    analysis: AIFormAnalysis,
    userProfileHash?: string
  ): Promise<void> {
    try {
      // Don't cache if HTML is too large
      if (extractedHTML.html.length > CACHE_CONFIG.maxHtmlSize) {
        console.warn('HTML too large for caching, skipping cache storage');
        aiPerformanceMonitor.recordEvent({ 
          type: 'compression_applied', 
          metadata: { 
            reason: 'size_limit_exceeded',
            originalSize: extractedHTML.html.length,
            maxSize: CACHE_CONFIG.maxHtmlSize
          } 
        });
        return;
      }

      // Calculate cache priority based on form complexity and URL patterns
      const priority = this.calculateCachePriority(extractedHTML, analysis);
      
      const cacheKey = this.generateCacheKey(extractedHTML, userProfileHash);
      const compressedAnalysis = CACHE_CONFIG.compressionEnabled ? this.compressAnalysis(analysis) : analysis;
      const originalSize = this.calculateAnalysisSize(analysis);
      const compressedSize = this.calculateAnalysisSize(compressedAnalysis);
      
      if (CACHE_CONFIG.compressionEnabled && originalSize !== compressedSize) {
        aiPerformanceMonitor.recordEvent({ 
          type: 'compression_applied', 
          metadata: { 
            originalSize,
            compressedSize,
            compressionRatio: (compressedSize / originalSize) * 100
          } 
        });
      }

      const cachedAnalysis: CachedAnalysis = {
        analysis: compressedAnalysis,
        timestamp: new Date(),
        url: extractedHTML.metadata.url,
        hits: 0,
        htmlHash: extractedHTML.hash,
        priority,
        lastAccessed: new Date(),
        size: compressedSize,
      };

      await aiCacheStorage.set(async (current) => {
        const newCache = { ...current };
        
        // Add new analysis
        newCache.analyses[cacheKey] = cachedAnalysis;
        
        // Intelligent cache management
        await this.performIntelligentEviction(newCache);
        
        newCache.lastCleanup = new Date();
        return newCache;
      });
    } catch (error) {
      console.error('Error caching analysis:', error);
    }
  }

  /**
   * Calculate cache priority based on various factors
   */
  private calculateCachePriority(extractedHTML: ExtractedHTML, analysis: AIFormAnalysis): number {
    let priority = 50; // Base priority
    
    // Higher priority for job application sites
    const url = extractedHTML.metadata.url.toLowerCase();
    if (['apply', 'application', 'job', 'career', 'position'].some(keyword => url.includes(keyword))) {
      priority += 20;
    }
    
    // Higher priority for complex forms
    if (extractedHTML.metadata.estimatedComplexity === 'high') {
      priority += 15;
    } else if (extractedHTML.metadata.estimatedComplexity === 'medium') {
      priority += 10;
    }
    
    // Higher priority for high-confidence analyses
    if (analysis.confidence > 80) {
      priority += 10;
    } else if (analysis.confidence < 50) {
      priority -= 10;
    }
    
    // Higher priority for forms with file uploads
    if (extractedHTML.metadata.hasFileUploads) {
      priority += 5;
    }
    
    return Math.max(0, Math.min(100, priority));
  }

  /**
   * Compress analysis data for storage efficiency
   */
  private compressAnalysis(analysis: AIFormAnalysis): AIFormAnalysis {
    return {
      ...analysis,
      instructions: analysis.instructions.map(instruction => ({
        ...instruction,
        reasoning: instruction.reasoning.length > 100 
          ? instruction.reasoning.substring(0, 100) + '...' 
          : instruction.reasoning
      })),
      reasoning: analysis.reasoning.length > 200 
        ? analysis.reasoning.substring(0, 200) + '...' 
        : analysis.reasoning
    };
  }

  /**
   * Calculate the approximate size of an analysis in bytes
   */
  private calculateAnalysisSize(analysis: AIFormAnalysis): number {
    return JSON.stringify(analysis).length;
  }

  /**
   * Perform intelligent cache eviction
   */
  private async performIntelligentEviction(cache: any): Promise<void> {
    const analysisKeys = Object.keys(cache.analyses);
    
    if (analysisKeys.length <= CACHE_CONFIG.maxSize) {
      return; // No eviction needed
    }
    
    if (CACHE_CONFIG.intelligentEviction) {
      // Intelligent eviction based on multiple factors
      const sortedEntries = analysisKeys
        .map(key => ({ key, entry: cache.analyses[key] }))
        .sort((a, b) => {
          // Calculate eviction score (lower = more likely to be evicted)
          const aScore = this.calculateEvictionScore(a.entry);
          const bScore = this.calculateEvictionScore(b.entry);
          return aScore - bScore;
        });
      
      // Remove entries with lowest scores
      const entriesToRemove = sortedEntries.slice(0, analysisKeys.length - CACHE_CONFIG.maxSize + CACHE_CONFIG.batchSize);
      entriesToRemove.forEach(({ key }) => {
        delete cache.analyses[key];
      });
    } else {
      // Simple LRU eviction
      const sortedEntries = analysisKeys
        .map(key => ({ key, entry: cache.analyses[key] }))
        .sort((a, b) => {
          const aTime = new Date(a.entry.lastAccessed || a.entry.timestamp).getTime();
          const bTime = new Date(b.entry.lastAccessed || b.entry.timestamp).getTime();
          return aTime - bTime;
        });
      
      const entriesToRemove = sortedEntries.slice(0, analysisKeys.length - CACHE_CONFIG.maxSize + 1);
      entriesToRemove.forEach(({ key }) => {
        delete cache.analyses[key];
      });
    }
  }

  /**
   * Calculate eviction score for cache entry (lower = more likely to be evicted)
   */
  private calculateEvictionScore(entry: any): number {
    const now = Date.now();
    const age = now - new Date(entry.timestamp).getTime();
    const lastAccessed = new Date(entry.lastAccessed || entry.timestamp).getTime();
    const timeSinceAccess = now - lastAccessed;
    
    let score = 0;
    
    // Age factor (older = lower score)
    score += Math.max(0, 100 - (age / (24 * 60 * 60 * 1000)) * 10); // Decrease by 10 per day
    
    // Hit count factor
    score += Math.min(50, entry.hits * 5); // Up to 50 points for hits
    
    // Priority factor
    score += (entry.priority || 50) * 0.5; // Priority contributes up to 50 points
    
    // Recent access factor
    score += Math.max(0, 30 - (timeSinceAccess / (60 * 60 * 1000)) * 5); // Decrease by 5 per hour
    
    // Hit rate factor
    const hitRate = entry.hits / Math.max(1, Math.ceil(age / (24 * 60 * 60 * 1000)));
    if (hitRate < CACHE_CONFIG.hitRateThreshold) {
      score -= 20; // Penalty for low hit rate
    }
    
    return score;
  }

  /**
   * Remove specific cached analysis
   */
  async removeCachedAnalysis(cacheKey: string): Promise<void> {
    try {
      await aiCacheStorage.set((current) => {
        const newAnalyses = { ...current.analyses };
        delete newAnalyses[cacheKey];
        
        return {
          ...current,
          analyses: newAnalyses,
        };
      });
    } catch (error) {
      console.error('Error removing cached analysis:', error);
    }
  }

  /**
   * Clear all cached analyses
   */
  async clearCache(): Promise<void> {
    try {
      await aiCacheStorage.set((current) => ({
        ...current,
        analyses: {},
        totalHits: 0,
        lastCleanup: new Date(),
      }));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    cacheSize: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    hitRate: number;
  }> {
    try {
      const cache = await aiCacheStorage.get();
      const analyses = Object.values(cache.analyses);
      
      if (analyses.length === 0) {
        return {
          totalEntries: 0,
          totalHits: 0,
          cacheSize: 0,
          oldestEntry: null,
          newestEntry: null,
          hitRate: 0,
        };
      }
      
      const timestamps = analyses.map(a => new Date(a.timestamp));
      const totalHits = analyses.reduce((sum, a) => sum + a.hits, 0);
      const totalRequests = totalHits + analyses.length; // hits + initial stores
      
      return {
        totalEntries: analyses.length,
        totalHits,
        cacheSize: JSON.stringify(cache.analyses).length,
        oldestEntry: new Date(Math.min(...timestamps.map(d => d.getTime()))),
        newestEntry: new Date(Math.max(...timestamps.map(d => d.getTime()))),
        hitRate: totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        totalHits: 0,
        cacheSize: 0,
        oldestEntry: null,
        newestEntry: null,
        hitRate: 0,
      };
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const cache = await aiCacheStorage.get();
      const now = Date.now();
      let removedCount = 0;
      
      const validAnalyses: Record<string, CachedAnalysis> = {};
      
      for (const [key, analysis] of Object.entries(cache.analyses)) {
        const cacheAge = now - new Date(analysis.timestamp).getTime();
        
        if (cacheAge < CACHE_CONFIG.ttl) {
          validAnalyses[key] = analysis;
        } else {
          removedCount++;
        }
      }
      
      if (removedCount > 0) {
        await aiCacheStorage.set((current) => ({
          ...current,
          analyses: validAnalyses,
          lastCleanup: new Date(),
        }));
      }
      
      return removedCount;
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      return 0;
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(async () => {
      const removedCount = await this.cleanupExpiredEntries();
      if (removedCount > 0) {
        console.log(`AI Cache: Cleaned up ${removedCount} expired entries`);
      }
    }, CACHE_CONFIG.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Find cached analyses by URL pattern
   */
  async findCachedAnalysesByUrl(urlPattern: string): Promise<CachedAnalysis[]> {
    try {
      const cache = await aiCacheStorage.get();
      const regex = new RegExp(urlPattern, 'i');
      
      return Object.values(cache.analyses).filter(analysis => 
        regex.test(analysis.url)
      );
    } catch (error) {
      console.error('Error finding cached analyses by URL:', error);
      return [];
    }
  }

  /**
   * Get cache configuration
   */
  getCacheConfig() {
    return { ...CACHE_CONFIG };
  }

  /**
   * Update cache configuration
   */
  updateCacheConfig(newConfig: Partial<typeof CACHE_CONFIG>): void {
    Object.assign(CACHE_CONFIG, newConfig);
    
    // Restart cleanup timer if interval changed
    if (newConfig.cleanupInterval) {
      this.startCleanupTimer();
    }
  }
}

// Export singleton instance
export const aiCacheManager = new AICacheManager();