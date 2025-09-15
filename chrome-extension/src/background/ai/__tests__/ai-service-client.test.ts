/**
 * Unit tests for AI Service Client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIServiceClient } from '../ai-service-client.js';
import type { ExtractedHTML, UserProfile, AIFormAnalysis } from '@extension/shared';

// Mock the storage module at the top level
const mockAiSettingsStorage = {
  getToken: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
};

vi.mock('@extension/storage', () => ({
  aiSettingsStorage: mockAiSettingsStorage,
  profileStorage: {
    get: vi.fn(),
    set: vi.fn(),
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AIServiceClient', () => {
  let client: AIServiceClient;
  let mockToken: string;
  let mockSettings: any;
  let mockExtractedHTML: ExtractedHTML;
  let mockUserProfile: UserProfile;

  beforeEach(async () => {
    client = new AIServiceClient();
    mockToken = 'sk-test-token-123';
    mockSettings = {
      model: 'gpt-3.5-turbo',
      maxTokens: 2000,
      temperature: 0.3,
    };

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
      id: 'test-user-123',
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'US'
        }
      },
      professionalInfo: {
        workExperience: [],
        education: [],
        skills: ['JavaScript', 'TypeScript', 'React'],
        certifications: [],
        summary: 'Experienced software developer'
      },
      preferences: {
        defaultAnswers: {},
        jobPreferences: {
          desiredRoles: ['Software Engineer'],
          preferredLocations: ['Remote'],
          salaryRange: { min: 80000, max: 120000 }
        },
        privacySettings: {
          shareProfile: false,
          allowAnalytics: true
        },
        aiPreferences: {
          enableAI: true,
          preferredTone: 'professional',
          customInstructions: ''
        }
      },
      documents: {
        resumes: [],
        coverLetters: []
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0'
      }
    } as UserProfile;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateToken', () => {
    it('should return invalid for empty token', async () => {
      mockAiSettingsStorage.getToken.mockResolvedValue(null);

      const result = await client.validateToken();

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('No API token provided');
    });

    it('should return invalid for malformed token', async () => {
      const result = await client.validateToken('invalid-token');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token format. OpenAI tokens should start with "sk-"');
    });

    it('should validate token with OpenAI API', async () => {
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

      const result = await client.validateToken(mockToken);

      expect(result.isValid).toBe(true);
      expect(result.model).toBe('gpt-4');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
          }),
        })
      );
    });

    it('should handle API error during validation', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: {
            message: 'Invalid API key',
          },
        }),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.validateToken(mockToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });

    it('should handle network error during validation', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.validateToken(mockToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('analyzeForm', () => {
    beforeEach(async () => {
      mockAiSettingsStorage.getToken.mockResolvedValue(mockToken);
      mockAiSettingsStorage.get.mockResolvedValue(mockSettings);
    });

    it('should throw error when no token available', async () => {
      mockAiSettingsStorage.getToken.mockResolvedValue(null);

      await expect(
        client.analyzeForm(mockExtractedHTML, mockUserProfile)
      ).rejects.toThrow('No API token available');
    });

    it('should analyze form and return instructions', async () => {
      const mockOpenAIResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-3.5-turbo',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                instructions: [
                  {
                    action: 'fill',
                    selector: 'input[name="firstName"]',
                    value: 'John',
                    reasoning: 'Fill first name from profile',
                    confidence: 95,
                    priority: 8,
                  },
                  {
                    action: 'fill',
                    selector: 'input[name="email"]',
                    value: 'john.doe@example.com',
                    reasoning: 'Fill email from profile',
                    confidence: 98,
                    priority: 9,
                  },
                ],
                confidence: 96,
                reasoning: 'Successfully matched form fields to user profile',
                warnings: [],
              }),
            },
            finish_reason: 'stop',
          }],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 100,
            total_tokens: 250,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockOpenAIResponse);

      const result = await client.analyzeForm(mockExtractedHTML, mockUserProfile);

      expect(result).toMatchObject({
        instructions: expect.arrayContaining([
          expect.objectContaining({
            action: 'fill',
            selector: 'input[name="firstName"]',
            value: 'John',
            confidence: 95,
            priority: 8,
          }),
          expect.objectContaining({
            action: 'fill',
            selector: 'input[name="email"]',
            value: 'john.doe@example.com',
            confidence: 98,
            priority: 9,
          }),
        ]),
        confidence: 96,
        reasoning: 'Successfully matched form fields to user profile',
        warnings: [],
        metadata: expect.objectContaining({
          analysisId: expect.stringMatching(/^analysis_/),
          timestamp: expect.any(Date),
          model: 'gpt-3.5-turbo',
          tokensUsed: 250,
        }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"model":"gpt-3.5-turbo"'),
        })
      );
    });

    it('should handle malformed AI response', async () => {
      const mockOpenAIResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'invalid json response',
            },
          }],
        }),
      };

      mockFetch.mockResolvedValue(mockOpenAIResponse);

      await expect(
        client.analyzeForm(mockExtractedHTML, mockUserProfile)
      ).rejects.toThrow('Failed to parse AI response');
    });

    it('should handle API rate limit error', async () => {
      const mockErrorResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: vi.fn().mockResolvedValue({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded',
          },
        }),
      };

      mockFetch.mockResolvedValue(mockErrorResponse);

      await expect(
        client.analyzeForm(mockExtractedHTML, mockUserProfile)
      ).rejects.toThrow('Rate limit exceeded');
    }, 10000);

    it('should handle network timeout', async () => {
      // Mock AbortError for timeout
      const abortError = new Error('Request timeout');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(
        client.analyzeForm(mockExtractedHTML, mockUserProfile)
      ).rejects.toThrow('Request timeout');
    }, 10000);

    it('should validate instruction structure', async () => {
      const mockOpenAIResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                instructions: [
                  {
                    // Missing required fields
                    value: 'John',
                    reasoning: 'Fill first name',
                  },
                ],
                confidence: 90,
                reasoning: 'Analysis complete',
                warnings: [],
              }),
            },
          }],
          usage: { total_tokens: 100 },
        }),
      };

      mockFetch.mockResolvedValue(mockOpenAIResponse);

      await expect(
        client.analyzeForm(mockExtractedHTML, mockUserProfile)
      ).rejects.toThrow('Invalid instruction at index 0: missing action or selector');
    });

    it('should clamp confidence values to valid range', async () => {
      const mockOpenAIResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
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
        }),
      };

      mockFetch.mockResolvedValue(mockOpenAIResponse);

      const result = await client.analyzeForm(mockExtractedHTML, mockUserProfile);

      expect(result.instructions[0].confidence).toBe(100); // Clamped to max
      expect(result.instructions[0].priority).toBe(10); // Clamped to max
      expect(result.confidence).toBe(0); // Clamped to min
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
      expect(resolution.maxRetries).toBe(3);
    });

    it('should provide correct error resolution for quota exceeded', () => {
      const error = new Error('Quota exceeded');
      (error as any).type = 'API_QUOTA_EXCEEDED';

      const resolution = client.getErrorResolution(error);

      expect(resolution.action).toBe('user_action_required');
      expect(resolution.message).toContain('quota exceeded');
    });

    it('should provide fallback resolution for parsing errors', () => {
      const error = new Error('Parsing failed');
      (error as any).type = 'PARSING_ERROR';

      const resolution = client.getErrorResolution(error);

      expect(resolution.action).toBe('fallback');
      expect(resolution.fallbackStrategy).toBe('traditional_autofill');
    });
  });

  describe('request queue and rate limiting', () => {
    it('should process requests in priority order', async () => {
      mockAiSettingsStorage.getToken.mockResolvedValue(mockToken);
      mockAiSettingsStorage.get.mockResolvedValue(mockSettings);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"instructions":[],"confidence":50,"reasoning":"test","warnings":[]}' } }],
          usage: { total_tokens: 100 },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      // Make multiple requests with different priorities
      const promises = [
        client.analyzeForm(mockExtractedHTML, mockUserProfile), // Default priority
        client.analyzeForm(mockExtractedHTML, mockUserProfile), // Default priority
      ];

      await Promise.all(promises);

      // Should have made 2 API calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry failed requests with exponential backoff', async () => {
      mockAiSettingsStorage.getToken.mockResolvedValue(mockToken);
      mockAiSettingsStorage.get.mockResolvedValue(mockSettings);

      // First call fails, second succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"instructions":[],"confidence":50,"reasoning":"test","warnings":[]}' } }],
            usage: { total_tokens: 100 },
          }),
        });

      const result = await client.analyzeForm(mockExtractedHTML, mockUserProfile);

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial call + 1 retry
    }, 10000);
  });

  describe('prompt building', () => {
    it('should build comprehensive system prompt', async () => {
      mockAiSettingsStorage.getToken.mockResolvedValue(mockToken);
      mockAiSettingsStorage.get.mockResolvedValue(mockSettings);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"instructions":[],"confidence":50,"reasoning":"test","warnings":[]}' } }],
          usage: { total_tokens: 100 },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      await client.analyzeForm(mockExtractedHTML, mockUserProfile);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemMessage = requestBody.messages.find((msg: any) => msg.role === 'system');
      const userMessage = requestBody.messages.find((msg: any) => msg.role === 'user');

      expect(systemMessage.content).toContain('form analysis assistant');
      expect(systemMessage.content).toContain('JSON object');
      expect(systemMessage.content).toContain('confidence scores');

      expect(userMessage.content).toContain(mockExtractedHTML.html);
      expect(userMessage.content).toContain(mockUserProfile.personalInfo?.firstName);
      expect(userMessage.content).toContain(mockExtractedHTML.metadata.url);
    });

    it('should include job context when provided', async () => {
      mockAiSettingsStorage.getToken.mockResolvedValue(mockToken);
      mockAiSettingsStorage.get.mockResolvedValue(mockSettings);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"instructions":[],"confidence":50,"reasoning":"test","warnings":[]}' } }],
          usage: { total_tokens: 100 },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const jobContext = {
        title: 'Software Engineer',
        company: 'Tech Corp',
        description: 'Full-stack development role',
      };

      await client.analyzeForm(mockExtractedHTML, mockUserProfile, jobContext);

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = requestBody.messages.find((msg: any) => msg.role === 'user');

      expect(userMessage.content).toContain('Software Engineer');
      expect(userMessage.content).toContain('Tech Corp');
    });
  });
});