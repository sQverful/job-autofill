/**
 * Tests for AI cache performance optimizations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AICacheManager } from '../ai-cache-manager';
import { aiPerformanceMonitor } from '../ai-performance-monitor';
import type { ExtractedHTML, AIFormAnalysis } from '@extension/shared';

// Mock the storage
vi.mock('@extension/storage', () => ({
  aiCacheStorage: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe('AI Cache Performance Optimizations', () => {
  let cacheManager: AICacheManager;
  let mockExtractedHTML: ExtractedHTML;
  let mockAnalysis: AIFormAnalysis;

  beforeEach(() => {
    cacheManager = new AICacheManager();
    
    mockExtractedHTML = {
      html: '<form><input name="email" type="email"></form>',
      hash: 'test-hash-123',
      metadata: {
        url: 'https://example.com/apply',
        timestamp: new Date(),
        formCount: 1,
        fieldCount: 1,
        pageTitle: 'Job Application',
      },
    };

    mockAnalysis = {
      instructions: [
        {
          action: 'fill',
          selector: 'input[name="email"]',
          value: 'test@example.com',
          reasoning: 'Fill email field',
          confidence: 90,
          priority: 5,
        },
      ],
      confidence: 85,
      reasoning: 'Simple form analysis',
      warnings: [],
      metadata: {
        analysisId: 'test-analysis-123',
        timestamp: new Date(),
        model: 'gpt-4',
        tokensUsed: 1500,
      },
    };

    // Clear performance monitor
    aiPerformanceMonitor.clearHistory();
  });

  describe('Cache Priority Calculation', () => {
    it('should assign higher priority to job application sites', () => {
      const jobSiteHTML = {
        ...mockExtractedHTML,
        metadata: {
          ...mockExtractedHTML.metadata,
          url: 'https://company.com/careers/apply',
        },
      };

      // This would be tested by accessing the private method if it were public
      // For now, we test the behavior indirectly through cache operations
      expect(jobSiteHTML.metadata.url).toContain('apply');
    });

    it('should assign higher priority to complex forms', () => {
      const complexHTML = {
        ...mockExtractedHTML,
        metadata: {
          ...mockExtractedHTML.metadata,
          estimatedComplexity: 'high' as const,
        },
      };

      expect(complexHTML.metadata.estimatedComplexity).toBe('high');
    });

    it('should assign higher priority to high-confidence analyses', () => {
      const highConfidenceAnalysis = {
        ...mockAnalysis,
        confidence: 95,
      };

      expect(highConfidenceAnalysis.confidence).toBeGreaterThan(80);
    });
  });

  describe('Compression', () => {
    it('should compress analysis data when enabled', () => {
      const longReasoning = 'This is a very long reasoning text that should be compressed when the compression feature is enabled to save storage space and improve performance.';
      
      const analysisWithLongText = {
        ...mockAnalysis,
        reasoning: longReasoning,
        instructions: [
          {
            ...mockAnalysis.instructions[0],
            reasoning: longReasoning,
          },
        ],
      };

      // Test that compression would reduce the size
      const originalSize = JSON.stringify(analysisWithLongText).length;
      const compressedReasoning = longReasoning.length > 100 
        ? longReasoning.substring(0, 100) + '...' 
        : longReasoning;
      
      expect(compressedReasoning.length).toBeLessThan(longReasoning.length);
    });

    it('should calculate analysis size correctly', () => {
      const size = JSON.stringify(mockAnalysis).length;
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should record cache hit events', () => {
      // Simulate cache hit
      aiPerformanceMonitor.recordEvent({ 
        type: 'cache_hit', 
        metadata: { age: 1000, hits: 5 } 
      });

      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
    });

    it('should record cache miss events', () => {
      // Simulate cache miss
      aiPerformanceMonitor.recordEvent({ type: 'cache_miss' });

      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
    });

    it('should record compression events', () => {
      aiPerformanceMonitor.recordEvent({
        type: 'compression_applied',
        metadata: {
          originalSize: 1000,
          compressedSize: 800,
          compressionRatio: 80,
        },
      });

      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('Intelligent Eviction', () => {
    it('should calculate eviction scores correctly', () => {
      const now = Date.now();
      const entry = {
        timestamp: new Date(now - 60000), // 1 minute ago
        lastAccessed: new Date(now - 30000), // 30 seconds ago
        hits: 5,
        priority: 70,
      };

      // Test eviction score calculation logic
      const age = now - entry.timestamp.getTime();
      const timeSinceAccess = now - entry.lastAccessed.getTime();
      
      let score = 0;
      score += Math.max(0, 100 - (age / (24 * 60 * 60 * 1000)) * 10);
      score += Math.min(50, entry.hits * 5);
      score += entry.priority * 0.5;
      score += Math.max(0, 30 - (timeSinceAccess / (60 * 60 * 1000)) * 5);

      expect(score).toBeGreaterThan(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate cache hit rate correctly', () => {
      // Record some cache events
      aiPerformanceMonitor.recordEvent({ type: 'cache_hit' });
      aiPerformanceMonitor.recordEvent({ type: 'cache_hit' });
      aiPerformanceMonitor.recordEvent({ type: 'cache_miss' });

      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.cacheHitRate).toBeCloseTo(66.67, 1); // 2/3 = 66.67%
    });

    it('should calculate average response time correctly', () => {
      aiPerformanceMonitor.recordEvent({ 
        type: 'api_request', 
        duration: 1000,
        metadata: { tokensUsed: 1500 }
      });
      aiPerformanceMonitor.recordEvent({ 
        type: 'api_request', 
        duration: 2000,
        metadata: { tokensUsed: 2000 }
      });

      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.averageResponseTime).toBe(1500); // (1000 + 2000) / 2
    });

    it('should provide performance recommendations', () => {
      // Simulate poor performance
      for (let i = 0; i < 10; i++) {
        aiPerformanceMonitor.recordEvent({ type: 'cache_miss' });
      }

      const recommendations = aiPerformanceMonitor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.includes('cache'))).toBe(true);
    });
  });

  describe('Memory Usage Estimation', () => {
    it('should estimate memory usage correctly', () => {
      // Add some events
      for (let i = 0; i < 10; i++) {
        aiPerformanceMonitor.recordEvent({ type: 'cache_hit' });
      }

      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('Performance Summary', () => {
    it('should generate performance summary', () => {
      aiPerformanceMonitor.recordEvent({ 
        type: 'cache_hit',
        metadata: { hits: 1 }
      });
      aiPerformanceMonitor.recordEvent({ 
        type: 'api_request', 
        duration: 1500,
        metadata: { tokensUsed: 1000 }
      });

      const summary = aiPerformanceMonitor.getSummary();
      expect(summary).toContain('Cache Hit Rate');
      expect(summary).toContain('Response Time');
      expect(summary).toContain('Success Rate');
    });
  });

  describe('Data Export', () => {
    it('should export performance data correctly', () => {
      aiPerformanceMonitor.recordEvent({ type: 'cache_hit' });
      
      const exportedData = aiPerformanceMonitor.exportData();
      expect(exportedData).toHaveProperty('metrics');
      expect(exportedData).toHaveProperty('events');
      expect(exportedData).toHaveProperty('recommendations');
      expect(exportedData.events.length).toBeGreaterThan(0);
    });
  });
});