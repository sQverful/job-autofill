/**
 * Integration tests for AI Autofill Flow
 * Tests the complete AI autofill process from button click to completion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AIFormAnalysis, ExtractedHTML, UserProfile, FormInstruction } from '@extension/shared';

// Mock all dependencies
vi.mock('../html-extractor', () => ({
  htmlExtractor: {
    extractFormHTML: vi.fn()
  }
}));

const mockInstructionExecutorInstance = {
  executeInstruction: vi.fn(),
  executeInstructions: vi.fn(),
  getExecutionStats: vi.fn(() => ({
    total: 0,
    successful: 0,
    failed: 0,
    successRate: 0,
    averageExecutionTime: 0
  })),
  clearExecutionLog: vi.fn(),
  dispose: vi.fn(),
  cancel: vi.fn()
};

vi.mock('../instruction-executor', () => ({
  InstructionExecutor: vi.fn().mockImplementation(() => mockInstructionExecutorInstance)
}));

vi.mock('@extension/storage', () => ({
  profileStorage: {
    get: vi.fn()
  },
  aiSettingsStorage: {
    get: vi.fn(),
    getToken: vi.fn(),
    hasToken: vi.fn()
  }
}));

// Mock chrome extension APIs
global.chrome = {
  storage: {
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    sendMessage: vi.fn((message, callback) => {
      // Mock successful response for AI analysis
      if (message.type === 'ai:analyze-form') {
        setTimeout(() => {
          callback({
            success: true,
            data: {
              instructions: [
                {
                  action: 'fill',
                  selector: 'input[name="firstName"]',
                  value: 'John',
                  reasoning: 'Fill first name from user profile',
                  confidence: 95,
                  priority: 5
                }
              ],
              confidence: 90,
              reasoning: 'Mock analysis',
              warnings: [],
              metadata: {
                analysisId: 'mock-analysis',
                timestamp: new Date(),
                model: 'gpt-4',
                tokensUsed: 100
              }
            }
          });
        }, 0);
      } else {
        setTimeout(() => {
          callback({ success: true, data: {} });
        }, 0);
      }
    }),
    lastError: null
  }
} as any;

// Mock AI service client
const mockContentAIServiceClient = {
  analyzeForm: vi.fn(),
  validateToken: vi.fn().mockResolvedValue({ isValid: true }),
  getCachedAnalysis: vi.fn().mockResolvedValue(null),
  setCachedAnalysis: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../ai/ai-service-client-content', () => ({
  contentAIServiceClient: mockContentAIServiceClient,
  ContentAIServiceClientImpl: vi.fn().mockImplementation(() => mockContentAIServiceClient)
}));

describe('AI Autofill Integration Tests', () => {
  let mockHtmlExtractor: any;
  let mockInstructionExecutor: any;
  let mockProfileStorage: any;
  let mockAISettingsStorage: any;

  beforeEach(async () => {
    // Get mocked modules
    const { htmlExtractor } = await import('../html-extractor');
    const { profileStorage, aiSettingsStorage } = await import('@extension/storage');

    mockHtmlExtractor = htmlExtractor;
    mockInstructionExecutor = mockInstructionExecutorInstance;
    mockProfileStorage = profileStorage;
    mockAISettingsStorage = aiSettingsStorage;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete AI Autofill Flow', () => {
    it('should complete full autofill flow from button click to completion', async () => {
      // Mock AI settings
      mockAISettingsStorage.get.mockResolvedValue({
        enabled: true,
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.3
      });

      mockAISettingsStorage.getToken.mockResolvedValue('sk-test-token');
      mockAISettingsStorage.hasToken.mockResolvedValue(true);

      // Mock extracted HTML
      const mockExtractedHTML: ExtractedHTML = {
        html: `
          <form id="job-application">
            <input name="firstName" type="text" placeholder="First Name" />
            <input name="lastName" type="text" placeholder="Last Name" />
            <input name="email" type="email" placeholder="Email" />
            <select name="experience">
              <option value="">Select Experience</option>
              <option value="0-2">0-2 years</option>
              <option value="3-5">3-5 years</option>
              <option value="5+">5+ years</option>
            </select>
            <input type="checkbox" name="remote" value="yes" />
            <button type="submit">Submit Application</button>
          </form>
        `,
        hash: 'integration-test-hash',
        metadata: {
          url: 'https://example.com/jobs/apply',
          timestamp: new Date(),
          formCount: 1,
          fieldCount: 5,
          pageTitle: 'Software Engineer - Apply Now'
        }
      };

      // Mock user profile
      const mockUserProfile: UserProfile = {
        id: 'test-user-integration',
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
          workExperience: [{
            company: 'Tech Corp',
            position: 'Senior Developer',
            startDate: '2020-01-01',
            endDate: '2023-12-31',
            description: 'Full-stack development',
            skills: ['JavaScript', 'React', 'Node.js']
          }],
          education: [],
          skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
          certifications: [],
          summary: 'Experienced software developer with 5+ years'
        },
        preferences: {
          defaultAnswers: {},
          jobPreferences: {
            desiredRoles: ['Software Engineer'],
            preferredLocations: ['Remote'],
            salaryRange: { min: 80000, max: 120000 },
            workAuthorization: 'US Citizen',
            requiresSponsorship: false,
            willingToRelocate: false,
            availableStartDate: '2024-01-01',
            preferredWorkType: 'remote'
          },
          privacySettings: {
            shareProfile: false,
            allowAnalytics: true
          },
          aiPreferences: {
            preferredTone: 'professional',
            customInstructions: 'Focus on technical skills',
            excludedFields: [],
            learningEnabled: true,
            confidenceThreshold: 0.7,
            maxInstructionsPerForm: 50
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

      // Mock AI analysis response
      const mockAIAnalysis: AIFormAnalysis = {
        instructions: [
          {
            action: 'fill',
            selector: 'input[name="firstName"]',
            value: 'John',
            reasoning: 'Fill first name from user profile',
            confidence: 95,
            priority: 5
          },
          {
            action: 'fill',
            selector: 'input[name="lastName"]',
            value: 'Doe',
            reasoning: 'Fill last name from user profile',
            confidence: 95,
            priority: 5
          },
          {
            action: 'fill',
            selector: 'input[name="email"]',
            value: 'john.doe@example.com',
            reasoning: 'Fill email from user profile',
            confidence: 95,
            priority: 5
          },
          {
            action: 'select',
            selector: 'select[name="experience"]',
            value: '5+',
            reasoning: 'Select 5+ years based on work experience',
            confidence: 90,
            priority: 4
          },
          {
            action: 'click',
            selector: 'input[name="remote"]',
            reasoning: 'Check remote work preference',
            confidence: 85,
            priority: 3
          }
        ],
        confidence: 92,
        reasoning: 'Standard job application form with personal and preference fields',
        warnings: [],
        metadata: {
          analysisId: 'integration-test-analysis',
          timestamp: new Date(),
          model: 'gpt-4',
          tokensUsed: 150
        }
      };

      // Mock execution results
      const mockExecutionResults = mockAIAnalysis.instructions.map((instruction, index) => ({
        instruction,
        success: true,
        actualValue: instruction.value || 'true',
        executionTime: 50 + index * 10,
        retryCount: 0
      }));

      // Set up mocks
      mockHtmlExtractor.extractFormHTML.mockResolvedValue(mockExtractedHTML);
      mockProfileStorage.get.mockResolvedValue(mockUserProfile);
      mockContentAIServiceClient.analyzeForm.mockResolvedValue(mockAIAnalysis);
      // Mock individual instruction execution since controller calls executeInstruction for each
      mockInstructionExecutor.executeInstruction.mockImplementation((instruction: FormInstruction) => {
        const result = mockExecutionResults.find(r => r.instruction === instruction);
        return Promise.resolve(result || {
          instruction,
          success: true,
          actualValue: instruction.value,
          executionTime: 100,
          retryCount: 0
        });
      });

      // Import and create controller
      const { AIAutofillController } = await import('../../ai-autofill-controller');
      const controller = new AIAutofillController({
        enableProgressTracking: true,
        enableFallback: false, // Disable fallback for this test
        logExecution: false
      });

      // Track progress updates
      const progressUpdates: any[] = [];
      controller.onProgress((progress) => {
        progressUpdates.push(progress);
      });

      // Execute the complete flow
      const result = await controller.performAIAutofill();

      // Verify the complete flow
      expect(result.success).toBe(true);
      expect(result.totalInstructions).toBe(5);
      expect(result.successfulInstructions).toBe(5);
      expect(result.failedInstructions).toBe(0);
      expect(result.fallbackUsed).toBe(false);
      expect(result.errors).toHaveLength(0);

      // Verify all steps were called
      expect(mockHtmlExtractor.extractFormHTML).toHaveBeenCalledWith(undefined, {
        includeStyles: false,
        maxDepth: 10,
        preserveDataAttributes: true
      });
      expect(mockProfileStorage.get).toHaveBeenCalled();
      expect(mockContentAIServiceClient.analyzeForm).toHaveBeenCalledWith(mockExtractedHTML, expect.any(Object));
      expect(mockInstructionExecutor.executeInstruction).toHaveBeenCalledTimes(mockAIAnalysis.instructions.length);

      // Verify progress tracking
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].stage).toBe('analyzing');
      expect(progressUpdates[progressUpdates.length - 1].stage).toBe('completed');

      // Verify result structure
      expect(result.aiAnalysis).toEqual(mockAIAnalysis);
      expect(result.executionResults).toEqual(mockExecutionResults);
      expect(result.executionTime).toBeGreaterThan(0);

      controller.dispose();
    });

    it('should handle fallback when AI fails', async () => {
      // Mock AI settings
      mockAISettingsStorage.get.mockResolvedValue({
        enabled: true,
        model: 'gpt-4'
      });

      mockAISettingsStorage.getToken.mockResolvedValue('sk-test-token');
      mockAISettingsStorage.hasToken.mockResolvedValue(true);

      // Mock HTML extraction success
      mockHtmlExtractor.extractFormHTML.mockResolvedValue({
        html: '<form><input name="test" /></form>',
        hash: 'test',
        metadata: {}
      });

      // Mock profile success
      mockProfileStorage.get.mockResolvedValue({
        id: 'test',
        personalInfo: { firstName: 'Test' },
        professionalInfo: { workExperience: [], education: [], skills: [], certifications: [] },
        preferences: { defaultAnswers: {}, jobPreferences: {}, privacySettings: {}, aiPreferences: {} },
        documents: { resumes: [], coverLetters: [] },
        metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0' }
      });

      // Mock AI service failure
      mockContentAIServiceClient.analyzeForm.mockRejectedValue(new Error('API rate limit exceeded'));

      const { AIAutofillController } = await import('../../ai-autofill-controller');
      const controller = new AIAutofillController({
        enableProgressTracking: true,
        enableFallback: true,
        logExecution: false
      });

      // This should trigger fallback strategies and return a result (not throw)
      const result = await controller.performAIAutofill();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      controller.dispose();
    });
  });

  describe('Configuration Management and Persistence', () => {
    it('should persist and load AI settings correctly', async () => {
      const testSettings = {
        enabled: true,
        model: 'gpt-4',
        maxTokens: 3000,
        temperature: 0.5,
        cacheEnabled: true
      };

      mockAISettingsStorage.get.mockResolvedValue(testSettings);
      mockAISettingsStorage.getToken.mockResolvedValue('sk-test-persistence');
      mockAISettingsStorage.hasToken.mockResolvedValue(true);

      const { AIAutofillController } = await import('../../ai-autofill-controller');
      const controller = new AIAutofillController();

      // Verify settings are loaded correctly
      expect(mockAISettingsStorage.get).toHaveBeenCalled();
      expect(mockAISettingsStorage.getToken).toHaveBeenCalled();

      controller.dispose();
    });

    it('should handle missing or invalid configuration gracefully', async () => {
      mockAISettingsStorage.get.mockResolvedValue(null);
      mockAISettingsStorage.getToken.mockResolvedValue(null);

      const { AIAutofillController } = await import('../../ai-autofill-controller');
      const controller = new AIAutofillController();

      await expect(controller.performAIAutofill()).rejects.toThrow();

      controller.dispose();
    });
  });

  describe('Performance with Large Forms', () => {
    it('should handle large complex forms efficiently', async () => {
      // Mock AI settings
      mockAISettingsStorage.get.mockResolvedValue({
        enabled: true,
        model: 'gpt-4'
      });

      mockAISettingsStorage.getToken.mockResolvedValue('sk-test-token');
      mockAISettingsStorage.hasToken.mockResolvedValue(true);

      // Create a large form with many fields
      const largeFormHTML = `
        <form id="complex-application">
          ${Array.from({ length: 50 }, (_, i) => `
            <input name="field${i}" type="text" placeholder="Field ${i}" />
          `).join('')}
          <select name="country">
            ${Array.from({ length: 200 }, (_, i) => `
              <option value="country${i}">Country ${i}</option>
            `).join('')}
          </select>
        </form>
      `;

      const mockLargeExtractedHTML: ExtractedHTML = {
        html: largeFormHTML,
        hash: 'large-form-hash',
        metadata: {
          url: 'https://example.com/complex-form',
          timestamp: new Date(),
          formCount: 1,
          fieldCount: 51,
          pageTitle: 'Complex Application Form'
        }
      };

      // Mock many instructions
      const manyInstructions: FormInstruction[] = Array.from({ length: 50 }, (_, i) => ({
        action: 'fill',
        selector: `input[name="field${i}"]`,
        value: `Value ${i}`,
        reasoning: `Fill field ${i}`,
        confidence: 90,
        priority: 5
      }));

      const mockLargeAnalysis: AIFormAnalysis = {
        instructions: manyInstructions,
        confidence: 85,
        reasoning: 'Large complex form with many fields',
        warnings: ['Form is very large, processing may take longer'],
        metadata: {
          analysisId: 'large-form-analysis',
          timestamp: new Date(),
          model: 'gpt-4',
          tokensUsed: 2000
        }
      };

      // Mock execution results
      const mockLargeExecutionResults = manyInstructions.map((instruction, index) => ({
        instruction,
        success: true,
        actualValue: instruction.value,
        executionTime: 25 + (index % 10), // Vary execution times
        retryCount: 0
      }));

      // Set up mocks
      mockHtmlExtractor.extractFormHTML.mockResolvedValue(mockLargeExtractedHTML);
      mockProfileStorage.get.mockResolvedValue({
        id: 'test',
        personalInfo: { firstName: 'Test' },
        professionalInfo: { workExperience: [], education: [], skills: [], certifications: [] },
        preferences: { defaultAnswers: {}, jobPreferences: {}, privacySettings: {}, aiPreferences: {} },
        documents: { resumes: [], coverLetters: [] },
        metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0' }
      });
      mockContentAIServiceClient.analyzeForm.mockResolvedValue(mockLargeAnalysis);
      // Mock individual instruction execution since controller calls executeInstruction for each
      mockInstructionExecutor.executeInstruction.mockImplementation((instruction: FormInstruction) => {
        const result = mockLargeExecutionResults.find(r => r.instruction === instruction);
        return Promise.resolve(result || {
          instruction,
          success: true,
          actualValue: instruction.value,
          executionTime: 25,
          retryCount: 0
        });
      });

      const { AIAutofillController } = await import('../../ai-autofill-controller');
      const controller = new AIAutofillController({
        enableProgressTracking: true,
        enableFallback: false,
        logExecution: false
      });

      const startTime = performance.now();
      const result = await controller.performAIAutofill();
      const endTime = performance.now();

      // Verify performance
      expect(result.success).toBe(true);
      expect(result.totalInstructions).toBe(50);
      expect(result.successfulInstructions).toBe(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      controller.dispose();
    }, 10000); // 10 second timeout for this test
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle network timeouts gracefully', async () => {
      mockAISettingsStorage.get.mockResolvedValue({
        enabled: true
      });

      mockAISettingsStorage.getToken.mockResolvedValue('sk-test-token');
      mockAISettingsStorage.hasToken.mockResolvedValue(true);

      mockHtmlExtractor.extractFormHTML.mockResolvedValue({
        html: '<form><input name="test" /></form>',
        hash: 'test',
        metadata: {}
      });

      mockProfileStorage.get.mockResolvedValue({
        id: 'test',
        personalInfo: { firstName: 'Test' },
        professionalInfo: { workExperience: [], education: [], skills: [], certifications: [] },
        preferences: { defaultAnswers: {}, jobPreferences: {}, privacySettings: {}, aiPreferences: {} },
        documents: { resumes: [], coverLetters: [] },
        metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0' }
      });

      // Mock network timeout
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';
      mockContentAIServiceClient.analyzeForm.mockRejectedValue(timeoutError);

      const { AIAutofillController } = await import('../../ai-autofill-controller');
      const controller = new AIAutofillController({
        enableFallback: true
      });

      const result = await controller.performAIAutofill();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      controller.dispose();
    });

    it('should handle malformed AI responses', async () => {
      mockAISettingsStorage.get.mockResolvedValue({
        enabled: true
      });

      mockAISettingsStorage.getToken.mockResolvedValue('sk-test-token');
      mockAISettingsStorage.hasToken.mockResolvedValue(true);

      mockHtmlExtractor.extractFormHTML.mockResolvedValue({
        html: '<form><input name="test" /></form>',
        hash: 'test',
        metadata: {}
      });

      mockProfileStorage.get.mockResolvedValue({
        id: 'test',
        personalInfo: { firstName: 'Test' },
        professionalInfo: { workExperience: [], education: [], skills: [], certifications: [] },
        preferences: { defaultAnswers: {}, jobPreferences: {}, privacySettings: {}, aiPreferences: {} },
        documents: { resumes: [], coverLetters: [] },
        metadata: { createdAt: new Date(), updatedAt: new Date(), version: '1.0' }
      });

      // Mock malformed response
      mockContentAIServiceClient.analyzeForm.mockResolvedValue({
        instructions: null, // Invalid structure
        confidence: 'invalid', // Should be number
        reasoning: undefined,
        warnings: 'not an array'
      });

      const { AIAutofillController } = await import('../../ai-autofill-controller');
      const controller = new AIAutofillController({
        enableFallback: true
      });

      const result = await controller.performAIAutofill();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      controller.dispose();
    });
  });
});