/**
 * Simplified unit tests for AI Service Client core functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIServiceClient } from '../ai-service-client.js';
import type { ExtractedHTML, UserProfile } from '@extension/shared';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AIServiceClient - Core Functionality', () => {
  let client: AIServiceClient;
  let mockExtractedHTML: ExtractedHTML;
  let mockUserProfile: UserProfile;

  beforeEach(() => {
    client = new AIServiceClient();
    
    mockExtractedHTML = {
      html: '<form><input name="firstName" type="text"><input name="email" type="email"></form>',
      hash: 'test-hash-123',
      metadata: {
        url: 'https://example.com/apply',
        timestamp: new Date(),
        formCount: 1,
        fieldCount: 2,
        pageTitle: 'Job Application',
      },
    };

    mockUserProfile = {
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
      },
      workExperience: [],
      education: [],
      skills: [],
    } as UserProfile;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('token validation', () => {
    it('should return invalid for empty token', async () => {
      const result = await client.validateToken('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('No API token provided');
    });

    it('should return invalid for malformed token', async () => {
      const result = await client.validateToken('invalid-token');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid token format');
    });

    it('should validate token format correctly', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { id: 'gpt-3.5-turbo' },
            { id: 'gpt-4' },
          ],
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.validateToken('sk-test-token-123');
      expect(result.isValid).toBe(true);
      expect(result.model).toBe('gpt-4');
    });

    it('should handle API errors during validation', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: {
            message: 'Invalid API key',
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.validateToken('sk-invalid-token');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('error handling', () => {
    it('should provide correct error resolution for invalid token', () => {
      const error = new Error('Invalid token');
      (error as any).type = 'INVALID_TOKEN';

      const resolution = client.getErrorResolution(error);
      expect(resolution.action).toBe('user_action_required');
      expect(resolution.message).toContain('OpenAI API token');
    });

    it('should provide correct error resolution for rate limit', () => {
      const error = new Error('Rate limit exceeded');
      (error as any).type = 'API_RATE_LIMIT';

      const resolution = client.getErrorResolution(error);
      expect(resolution.action).toBe('retry');
      expect(resolution.retryDelay).toBe(60000);
    });

    it('should provide fallback resolution for parsing errors', () => {
      const error = new Error('Parsing failed');
      (error as any).type = 'PARSING_ERROR';

      const resolution = client.getErrorResolution(error);
      expect(resolution.action).toBe('fallback');
      expect(resolution.fallbackStrategy).toBe('traditional_autofill');
    });
  });

  describe('prompt building', () => {
    it('should build system prompt with required elements', () => {
      // Access private method for testing
      const systemPrompt = (client as any).buildSystemPrompt();
      
      expect(systemPrompt).toContain('form analysis assistant');
      expect(systemPrompt).toContain('JSON object');
      expect(systemPrompt).toContain('confidence scores');
      expect(systemPrompt).toContain('CSS selectors');
      expect(systemPrompt).toContain('instructions');
    });

    it('should build user prompt with form data and profile', () => {
      // Access private method for testing
      const userPrompt = (client as any).buildUserPrompt(mockExtractedHTML, mockUserProfile);
      
      expect(userPrompt).toContain(mockExtractedHTML.html);
      expect(userPrompt).toContain(mockExtractedHTML.metadata.url);
      expect(userPrompt).toContain(mockUserProfile.personalInfo?.firstName);
      expect(userPrompt).toContain(mockUserProfile.personalInfo?.email);
    });

    it('should include job context when provided', () => {
      const jobContext = {
        title: 'Software Engineer',
        company: 'Tech Corp',
      };

      const userPrompt = (client as any).buildUserPrompt(mockExtractedHTML, mockUserProfile, jobContext);
      
      expect(userPrompt).toContain('Software Engineer');
      expect(userPrompt).toContain('Tech Corp');
    });
  });

  describe('response parsing', () => {
    it('should parse valid AI response correctly', () => {
      const mockOpenAIResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-3.5-turbo',
        choices: [{
          message: {
            content: JSON.stringify({
              instructions: [
                {
                  action: 'fill',
                  selector: 'input[name="firstName"]',
                  value: 'John',
                  reasoning: 'Fill first name',
                  confidence: 95,
                  priority: 8,
                },
              ],
              confidence: 90,
              reasoning: 'Analysis complete',
              warnings: [],
            }),
          },
        }],
        usage: { total_tokens: 100 },
      };

      const result = (client as any).parseFormAnalysisResponse(mockOpenAIResponse, mockExtractedHTML);
      
      expect(result.instructions).toHaveLength(1);
      expect(result.instructions[0].action).toBe('fill');
      expect(result.instructions[0].selector).toBe('input[name="firstName"]');
      expect(result.instructions[0].value).toBe('John');
      expect(result.confidence).toBe(90);
      expect(result.metadata.tokensUsed).toBe(100);
    });

    it('should handle malformed JSON response', () => {
      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: 'invalid json',
          },
        }],
      };

      expect(() => {
        (client as any).parseFormAnalysisResponse(mockOpenAIResponse, mockExtractedHTML);
      }).toThrow('Failed to parse AI response');
    });

    it('should validate instruction structure', () => {
      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              instructions: [
                {
                  // Missing required fields
                  value: 'John',
                },
              ],
              confidence: 90,
              reasoning: 'Test',
              warnings: [],
            }),
          },
        }],
        usage: { total_tokens: 100 },
      };

      expect(() => {
        (client as any).parseFormAnalysisResponse(mockOpenAIResponse, mockExtractedHTML);
      }).toThrow('Invalid instruction at index 0');
    });

    it('should clamp confidence values to valid range', () => {
      const mockOpenAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              instructions: [
                {
                  action: 'fill',
                  selector: 'input[name="test"]',
                  value: 'test',
                  confidence: 150, // Invalid high value
                  priority: 15, // Invalid high value
                },
              ],
              confidence: -10, // Invalid low value
              reasoning: 'Test',
              warnings: [],
            }),
          },
        }],
        usage: { total_tokens: 100 },
      };

      const result = (client as any).parseFormAnalysisResponse(mockOpenAIResponse, mockExtractedHTML);
      
      expect(result.instructions[0].confidence).toBe(100); // Clamped to max
      expect(result.instructions[0].priority).toBe(10); // Clamped to max
      expect(result.confidence).toBe(0); // Clamped to min
    });
  });

  describe('request handling', () => {
    it('should handle network timeout', async () => {
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await client.validateToken('sk-test-token');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request timeout');
    });

    it('should determine retryable errors correctly', () => {
      const networkError = new Error('Network error');
      const shouldRetry = (client as any).shouldRetry(networkError);
      expect(shouldRetry).toBe(true);

      const rateLimitError = new Error('Rate limit exceeded');
      const shouldRetryRateLimit = (client as any).shouldRetry(rateLimitError);
      expect(shouldRetryRateLimit).toBe(true);

      const authError = new Error('Unauthorized');
      const shouldRetryAuth = (client as any).shouldRetry(authError);
      expect(shouldRetryAuth).toBe(false);
    });
  });
});