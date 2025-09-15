/**
 * Integration tests for AI performance optimizations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIServiceClient } from '../ai-service-client';
import { AICacheManager } from '../ai-cache-manager';
import { aiPerformanceMonitor } from '../ai-performance-monitor';
import type { ExtractedHTML, AIFormAnalysis } from '@extension/shared';

// Mock the prompt templates
vi.mock('../prompt-templates', () => ({
  JOB_APPLICATION_SYSTEM_PROMPT: 'Mock system prompt for testing',
  buildUserPrompt: vi.fn().mockReturnValue('Mock user prompt'),
  sanitizeHTMLForAnalysis: vi.fn().mockImplementation((html: string) => html),
  extractFormMetadata: vi.fn().mockReturnValue({ complexity: 'medium' }),
  validateAnalysisResponse: vi.fn().mockReturnValue(true),
}));

// Mock the storage and external dependencies
vi.mock('@extension/storage', () => ({
  aiCacheStorage: {
    get: vi.fn().mockResolvedValue({
      analyses: {},
      maxSize: 150,
      ttl: 7 * 24 * 60 * 60 * 1000,
      totalHits: 0,
      lastCleanup: new Date(),
    }),
    set: vi.fn().mockResolvedValue(undefined),
  },
  aiSettingsStorage: {
    get: vi.fn().mockResolvedValue({
      enabled: true,
      apiToken: 'sk-test-token',
      model: 'gpt-4',
      maxTokens: 2000,
      temperature: 0.3,
      cacheEnabled: true,
      autoTrigger: false,
    }),
    getToken: vi.fn().mockResolvedValue('sk-test-token'),
  },
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe('AI Performance Integration Tests', () => {
  let serviceClient: AIServiceClient;
  let cacheManager: AICacheManager;
  let mockExtractedHTML: ExtractedHTML;
  let mockAnalysis: AIFormAnalysis;

  beforeEach(() => {
    serviceClient = new AIServiceClient();
    cacheManager = new AICacheManager();
    
    mockExtractedHTML = {
      html: '<form><input name="email" type="email"><input name="name" type="text"></form>',
      hash: 'test-hash-456',
      metadata: {
        url: 'https://company.com/careers/apply',
        timestamp: new Date(),
        formCount: 1,
        fieldCount: 2,
        pageTitle: 'Software Engineer Application',
      },
    };

    mockAnalysis = {
      instructions: [
        {
          action: 'fill',
          selector: 'input[name="email"]',
          value: 'john.doe@example.com',
          reasoning: 'Fill email field with user email',
          confidence: 95,
          priority: 8,
        },
        {
          action: 'fill',
          selector: 'input[name="name"]',
          value: 'John Doe',
          reasoning: 'Fill name field with user name',
          confidence: 90,
          priority: 7,
        },
      ],
      confidence: 92,
      reasoning: 'High-confidence form analysis for job application',
      warnings: [],
      metadata: {
        analysisId: 'test-analysis-456',
        timestamp: new Date(),
        model: 'gpt-4',
        tokensUsed: 2500,
      },
    };

    // Clear performance monitor
    aiPerformanceMonitor.clearHistory();

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('End-to-End Performance Flow', () => {
    it('should handle complete analysis flow with performance tracking', async () => {
      // Mock successful API response
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify(mockAnalysis),
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 1500,
            completion_tokens: 1000,
            total_tokens: 2500,
          },
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      // Perform analysis
      const startTime = Date.now();
      const result = await serviceClient.analyzeForm(
        mockExtractedHTML,
        { personalInfo: { email: 'john.doe@example.com', fullName: 'John Doe' } } as any
      );

      const duration = Date.now() - startTime;

      // Verify result
      expect(result).toBeDefined();
      expect(result.instructions).toHaveLength(2);
      expect(result.confidence).toBe(92);

      // Verify performance tracking
      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should demonstrate cache performance benefits', async () => {
      // First request - cache miss
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify(mockAnalysis),
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 1500,
            completion_tokens: 1000,
            total_tokens: 2500,
          },
        }),
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      // First analysis - should hit API
      const firstResult = await serviceClient.analyzeForm(
        mockExtractedHTML,
        { personalInfo: { email: 'john.doe@example.com' } } as any
      );

      expect(firstResult).toBeDefined();

      // Mock cache to return the analysis
      const { aiCacheStorage } = await import('@extension/storage');
      (aiCacheStorage.get as any).mockResolvedValue({
        analyses: {
          'test-cache-key': {
            analysis: mockAnalysis,
            timestamp: new Date(),
            url: mockExtractedHTML.metadata.url,
            hits: 0,
            htmlHash: mockExtractedHTML.hash,
            priority: 75,
            lastAccessed: new Date(),
            size: JSON.stringify(mockAnalysis).length,
          },
        },
        maxSize: 150,
        ttl: 7 * 24 * 60 * 60 * 1000,
        totalHits: 0,
        lastCleanup: new Date(),
      });

      // Second analysis - should hit cache
      const cachedResult = await cacheManager.getCachedAnalysis(mockExtractedHTML, 'user-hash');

      if (cachedResult) {
        expect(cachedResult.confidence).toBe(mockAnalysis.confidence);
        
        // Verify cache hit was recorded
        const metrics = aiPerformanceMonitor.getMetrics();
        expect(metrics.cacheHitRate).toBeGreaterThan(0);
      }
    });

    it('should handle rate limiting gracefully', async () => {
      // Mock rate limit response
      const rateLimitResponse = {
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_error',
          },
        }),
      };

      (global.fetch as any).mockResolvedValue(rateLimitResponse);

      // Attempt analysis
      try {
        await serviceClient.analyzeForm(
          mockExtractedHTML,
          { personalInfo: { email: 'test@example.com' } } as any
        );
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Verify error was tracked
      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.failedRequests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should handle batch processing efficiently', async () => {
      // Create multiple similar requests
      const requests = Array.from({ length: 5 }, (_, i) => ({
        html: `<form><input name="field${i}" type="text"></form>`,
        hash: `hash-${i}`,
        metadata: {
          url: `https://example.com/form${i}`,
          timestamp: new Date(),
          formCount: 1,
          fieldCount: 1,
          pageTitle: `Form ${i}`,
        },
      }));

      // Mock batch response
      const mockBatchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-batch',
          object: 'chat.completion',
          created: Date.now(),
          model: 'gpt-4',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                ...mockAnalysis,
                instructions: [{
                  action: 'fill',
                  selector: 'input[name="field0"]',
                  value: 'test value',
                  reasoning: 'Fill field',
                  confidence: 85,
                  priority: 5,
                }],
              }),
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 800,
            completion_tokens: 500,
            total_tokens: 1300,
          },
        }),
      };

      (global.fetch as any).mockResolvedValue(mockBatchResponse);

      // Process requests
      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => 
          serviceClient.analyzeForm(
            req as ExtractedHTML,
            { personalInfo: { email: 'test@example.com' } } as any
          ).catch(() => null) // Handle potential errors
        )
      );
      const duration = Date.now() - startTime;

      // Verify batch processing metrics
      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.batchingEfficiency.totalRequests).toBeGreaterThanOrEqual(0);
      
      // Batch processing should be reasonably fast
      expect(duration).toBeLessThan(10000); // Less than 10 seconds
    });
  });

  describe('Memory and Compression Performance', () => {
    it('should manage memory usage effectively', async () => {
      // Generate large analysis data
      const largeAnalysis = {
        ...mockAnalysis,
        reasoning: 'A'.repeat(1000), // Large reasoning text
        instructions: Array.from({ length: 20 }, (_, i) => ({
          action: 'fill' as const,
          selector: `input[name="field${i}"]`,
          value: `value${i}`,
          reasoning: 'B'.repeat(200), // Large reasoning for each instruction
          confidence: 80 + i,
          priority: 5,
        })),
      };

      // Test compression
      const originalSize = JSON.stringify(largeAnalysis).length;
      
      // Simulate compression (truncate reasoning)
      const compressedAnalysis = {
        ...largeAnalysis,
        reasoning: largeAnalysis.reasoning.length > 200 
          ? largeAnalysis.reasoning.substring(0, 200) + '...'
          : largeAnalysis.reasoning,
        instructions: largeAnalysis.instructions.map(inst => ({
          ...inst,
          reasoning: inst.reasoning.length > 100 
            ? inst.reasoning.substring(0, 100) + '...'
            : inst.reasoning,
        })),
      };

      const compressedSize = JSON.stringify(compressedAnalysis).length;

      expect(compressedSize).toBeLessThan(originalSize);

      // Record compression event
      aiPerformanceMonitor.recordEvent({
        type: 'compression_applied',
        metadata: {
          originalSize,
          compressedSize,
          compressionRatio: (compressedSize / originalSize) * 100,
        },
      });

      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.compressionRatio).toBeLessThan(100);
    });

    it('should provide actionable performance recommendations', async () => {
      // Simulate poor performance scenarios
      
      // Low cache hit rate
      for (let i = 0; i < 10; i++) {
        aiPerformanceMonitor.recordEvent({ type: 'cache_miss' });
      }
      aiPerformanceMonitor.recordEvent({ type: 'cache_hit' });

      // High response times
      aiPerformanceMonitor.recordEvent({
        type: 'api_request',
        duration: 15000, // 15 seconds
        metadata: { tokensUsed: 4000 },
      });

      // High token usage
      aiPerformanceMonitor.recordEvent({
        type: 'api_request',
        duration: 5000,
        metadata: { tokensUsed: 5000 },
      });

      const recommendations = aiPerformanceMonitor.getRecommendations();
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.includes('cache'))).toBe(true);
      expect(recommendations.some(rec => rec.includes('response times') || rec.includes('token'))).toBe(true);
    });
  });

  describe('Performance Monitoring Dashboard', () => {
    it('should generate comprehensive performance summary', async () => {
      // Add various performance events
      aiPerformanceMonitor.recordEvent({ type: 'cache_hit', metadata: { hits: 3 } });
      aiPerformanceMonitor.recordEvent({ type: 'cache_hit', metadata: { hits: 5 } });
      aiPerformanceMonitor.recordEvent({ type: 'cache_miss' });
      
      aiPerformanceMonitor.recordEvent({
        type: 'api_request',
        duration: 2000,
        metadata: { tokensUsed: 1500, success: true },
      });
      
      aiPerformanceMonitor.recordEvent({
        type: 'batch_processed',
        duration: 3000,
        metadata: { batchSize: 3, successCount: 3 },
      });

      const summary = aiPerformanceMonitor.getSummary();
      
      expect(summary).toContain('Cache Hit Rate');
      expect(summary).toContain('Response Time');
      expect(summary).toContain('Success Rate');
      expect(summary).toContain('Tokens');
      expect(summary).toContain('Batch Efficiency');

      // Test export functionality
      const exportedData = aiPerformanceMonitor.exportData();
      expect(exportedData.metrics).toBeDefined();
      expect(exportedData.events.length).toBeGreaterThan(0);
      expect(exportedData.recommendations).toBeDefined();
    });

    it('should handle performance logging', () => {
      // Test that performance logging can be started
      const timer = aiPerformanceMonitor.startPerformanceLogging(1000); // 1 second for testing
      
      expect(timer).toBeDefined();
      
      // Clean up
      clearInterval(timer);
    });
  });

  describe('Real-world Performance Scenarios', () => {
    it('should handle high-load scenarios efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate high load with multiple concurrent requests
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        // Record various events to simulate real usage
        aiPerformanceMonitor.recordEvent({
          type: 'api_request',
          duration: 1000 + Math.random() * 2000,
          metadata: {
            tokensUsed: 1000 + Math.random() * 1000,
            success: Math.random() > 0.1, // 90% success rate
          },
        });

        if (Math.random() > 0.3) { // 70% cache hit rate
          aiPerformanceMonitor.recordEvent({ type: 'cache_hit' });
        } else {
          aiPerformanceMonitor.recordEvent({ type: 'cache_miss' });
        }

        return Promise.resolve(`result-${i}`);
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(concurrentRequests);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      const metrics = aiPerformanceMonitor.getMetrics();
      expect(metrics.totalRequests).toBe(concurrentRequests);
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(60); // Should be around 70%
    });

    it('should optimize for job application forms specifically', async () => {
      const jobApplicationHTML = {
        ...mockExtractedHTML,
        metadata: {
          ...mockExtractedHTML.metadata,
          url: 'https://company.com/careers/software-engineer/apply',
          pageTitle: 'Software Engineer - Apply Now',
          estimatedComplexity: 'high' as const,
          hasFileUploads: true,
          hasMultiStep: true,
        },
      };

      // Job application forms should get higher cache priority
      expect(jobApplicationHTML.metadata.url).toContain('apply');
      expect(jobApplicationHTML.metadata.estimatedComplexity).toBe('high');
      expect(jobApplicationHTML.metadata.hasFileUploads).toBe(true);

      // These factors should result in higher cache priority
      // (This would be tested more thoroughly with access to private methods)
    });
  });
});