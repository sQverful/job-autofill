/**
 * Tests for AI Error Handler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIErrorHandler } from '../ai-error-handler.js';
import type { AIError } from '@extension/shared';

describe('AIErrorHandler', () => {
  let errorHandler: AIErrorHandler;

  beforeEach(() => {
    errorHandler = AIErrorHandler.getInstance();
    errorHandler.clearErrorHistory();
  });

  describe('classifyError', () => {
    it('should classify token errors correctly', () => {
      const error = new Error('Invalid token provided');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'validateToken',
        timestamp: new Date(),
        retryCount: 0
      });

      expect(enhancedError.type).toBe('INVALID_TOKEN');
      expect(enhancedError.severity).toBe('high');
      expect(enhancedError.userActionRequired).toBe(true);
      expect(enhancedError.fallbackAvailable).toBe(true);
    });

    it('should classify rate limit errors correctly', () => {
      const error = new Error('Rate limit exceeded');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'analyzeForm',
        timestamp: new Date(),
        retryCount: 0
      });

      expect(enhancedError.type).toBe('API_RATE_LIMIT');
      expect(enhancedError.severity).toBe('medium');
      expect(enhancedError.recoverable).toBe(true);
      expect(enhancedError.fallbackAvailable).toBe(true);
    });

    it('should classify network errors correctly', () => {
      const error = new Error('Network timeout occurred');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'analyzeForm',
        timestamp: new Date(),
        retryCount: 0
      });

      expect(enhancedError.type).toBe('NETWORK_ERROR');
      expect(enhancedError.severity).toBe('medium');
      expect(enhancedError.recoverable).toBe(true);
    });

    it('should classify parsing errors correctly', () => {
      const error = new Error('Failed to parse JSON response');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'analyzeForm',
        timestamp: new Date(),
        retryCount: 0
      });

      expect(enhancedError.type).toBe('PARSING_ERROR');
      expect(enhancedError.severity).toBe('low');
      expect(enhancedError.recoverable).toBe(false);
      expect(enhancedError.fallbackAvailable).toBe(true);
    });
  });

  describe('getErrorResolution', () => {
    it('should provide retry resolution for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'analyzeForm',
        timestamp: new Date(),
        retryCount: 0
      });

      const resolution = errorHandler.getErrorResolution(enhancedError);

      expect(resolution.action).toBe('retry');
      expect(resolution.retryDelay).toBeGreaterThan(0);
      expect(resolution.maxRetries).toBeGreaterThan(0);
      expect(resolution.fallbackStrategy).toBe('traditional_autofill');
    });

    it('should provide user action resolution for token errors', () => {
      const error = new Error('Invalid token');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'validateToken',
        timestamp: new Date(),
        retryCount: 0
      });

      const resolution = errorHandler.getErrorResolution(enhancedError);

      expect(resolution.action).toBe('user_action_required');
      expect(resolution.message).toContain('token');
    });

    it('should provide fallback resolution for parsing errors', () => {
      const error = new Error('JSON parsing failed');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'analyzeForm',
        timestamp: new Date(),
        retryCount: 0
      });

      const resolution = errorHandler.getErrorResolution(enhancedError);

      expect(resolution.action).toBe('fallback');
      expect(resolution.fallbackStrategy).toBe('traditional_autofill');
    });

    it('should limit retry attempts', () => {
      const error = new Error('Rate limit exceeded');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'analyzeForm',
        timestamp: new Date(),
        retryCount: 0
      });

      // Simulate reaching max retry attempts by setting retry count in the error handler
      const operationKey = 'analyzeForm_API_RATE_LIMIT';
      
      // Access private retryAttempts map through the error handler
      // This simulates having already made max attempts
      (errorHandler as any).retryAttempts.set(operationKey, 5);

      const resolution = errorHandler.getErrorResolution(enhancedError);
      expect(resolution.action).toBe('fallback');
    });
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      
      const result = await errorHandler.executeWithRetry(
        mockOperation,
        'testOperation',
        { operation: 'test' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on recoverable errors', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('success');

      const result = await errorHandler.executeWithRetry(
        mockOperation,
        'testOperation',
        { operation: 'test' }
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        errorHandler.executeWithRetry(
          mockOperation,
          'testOperation',
          { operation: 'test' }
        )
      ).rejects.toThrow();

      expect(mockOperation).toHaveBeenCalledTimes(5); // Max attempts
    }, 10000); // Increase timeout to 10 seconds

    it('should not retry non-recoverable errors', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValue(new Error('Invalid token'));

      await expect(
        errorHandler.executeWithRetry(
          mockOperation,
          'testOperation',
          { operation: 'test' }
        )
      ).rejects.toThrow('Invalid token');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should provide user-friendly messages', () => {
      const error = new Error('Rate limit exceeded');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'analyzeForm',
        timestamp: new Date(),
        retryCount: 0
      });

      const message = errorHandler.getUserFriendlyMessage(enhancedError);

      expect(message.title).toBe('Rate Limit Exceeded');
      expect(message.message).toContain('rate limit');
      expect(message.guidance).toBeInstanceOf(Array);
      expect(message.guidance.length).toBeGreaterThan(0);
      expect(message.preventionTips).toBeInstanceOf(Array);
      expect(message.canRetry).toBe(true);
      expect(message.canUseFallback).toBe(true);
    });

    it('should provide appropriate guidance for token errors', () => {
      const error = new Error('Invalid token');
      const enhancedError = errorHandler.classifyError(error, {
        operation: 'validateToken',
        timestamp: new Date(),
        retryCount: 0
      });

      const message = errorHandler.getUserFriendlyMessage(enhancedError);

      expect(message.guidance.some(g => g.includes('token'))).toBe(true);
      expect(message.guidance.some(g => g.includes('sk-'))).toBe(true);
      expect(message.canRetry).toBe(false);
    });
  });

  describe('getErrorStatistics', () => {
    it('should track error statistics', () => {
      // Generate some errors
      const error1 = new Error('Rate limit exceeded');
      const error2 = new Error('Invalid token');
      const error3 = new Error('Network timeout');

      errorHandler.classifyError(error1, { operation: 'test1', timestamp: new Date(), retryCount: 0 });
      errorHandler.classifyError(error2, { operation: 'test2', timestamp: new Date(), retryCount: 0 });
      errorHandler.classifyError(error3, { operation: 'test1', timestamp: new Date(), retryCount: 0 });

      const stats = errorHandler.getErrorStatistics();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType['API_RATE_LIMIT']).toBe(1);
      expect(stats.errorsByType['INVALID_TOKEN']).toBe(1);
      expect(stats.errorsByType['NETWORK_ERROR']).toBe(1);
      expect(stats.errorsByOperation['test1']).toBe(2);
      expect(stats.errorsByOperation['test2']).toBe(1);
    });
  });

  describe('shouldUseFallback', () => {
    it('should recommend fallback after multiple failures', () => {
      // Simulate multiple non-recoverable errors
      for (let i = 0; i < 3; i++) {
        const error = new Error('Parsing failed');
        errorHandler.classifyError(error, {
          operation: 'testOperation',
          timestamp: new Date(),
          retryCount: 0
        });
      }

      const shouldFallback = errorHandler.shouldUseFallback('testOperation');
      expect(shouldFallback).toBe(true);
    });

    it('should not recommend fallback for recoverable errors', () => {
      // Simulate recoverable errors
      for (let i = 0; i < 2; i++) {
        const error = new Error('Rate limit exceeded');
        errorHandler.classifyError(error, {
          operation: 'testOperation',
          timestamp: new Date(),
          retryCount: 0
        });
      }

      const shouldFallback = errorHandler.shouldUseFallback('testOperation');
      expect(shouldFallback).toBe(false);
    });
  });
});