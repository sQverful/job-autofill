/**
 * Tests for AI Autofill Controller
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { AIAutofillController } from '../../ai-autofill-controller';
import type { AIFormAnalysis, ExtractedHTML, UserProfile, FormInstruction } from '@extension/shared';

// Mock dependencies
vi.mock('../html-extractor', () => ({
  htmlExtractor: {
    extractFormHTML: vi.fn()
  }
}));

vi.mock('../instruction-executor', () => ({
  InstructionExecutor: vi.fn().mockImplementation(() => ({
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
    getExecutionLog: vi.fn(() => [])
  }))
}));



// Mock the content AI service client module
const mockContentAIServiceClient = {
  analyzeForm: vi.fn(),
  validateToken: vi.fn().mockResolvedValue({ isValid: true }),
  getCachedAnalysis: vi.fn().mockResolvedValue(null),
  setCachedAnalysis: vi.fn().mockResolvedValue(undefined)
};

vi.mock('../ai/ai-service-client-content', () => ({
  contentAIServiceClient: mockContentAIServiceClient
}));

// Mock the AI autofill controller's dynamic imports
const originalImport = global.import;
global.import = vi.fn().mockImplementation((specifier: string) => {
  if (specifier === '@extension/storage') {
    return Promise.resolve({
      profileStorage: {
        get: vi.fn()
      },
      aiSettingsStorage: {
        get: vi.fn().mockResolvedValue({
          enabled: true
        }),
        hasToken: vi.fn().mockResolvedValue(true)
      }
    });
  }
  if (specifier === '@extension/shared') {
    return Promise.resolve({
      AIPreferencesManager: {
        initializeAIPreferences: vi.fn((profile) => profile)
      }
    });
  }
  if (specifier === './ai/ai-service-client-content') {
    return Promise.resolve({
      contentAIServiceClient: mockContentAIServiceClient
    });
  }
  return originalImport(specifier);
});

vi.mock('../ai/ai-fallback-manager', () => ({
  aiFallbackManager: {
    executeFallback: vi.fn(),
    convertToAIResult: vi.fn()
  }
}));

vi.mock('../enhanced-autofill', () => ({
  EnhancedAutofill: vi.fn().mockImplementation(() => ({
    handleAutofillTrigger: vi.fn()
  }))
}));

vi.mock('../on-demand-autofill', () => ({
  OnDemandAutofill: vi.fn().mockImplementation(() => ({
    handleAutofillTrigger: vi.fn()
  }))
}));

vi.mock('@extension/shared', async () => {
  const actual = await vi.importActual('@extension/shared');
  return {
    ...actual,
    AIPreferencesManager: {
      initializeAIPreferences: vi.fn((profile) => ({
        ...profile,
        preferences: {
          ...profile.preferences,
          aiPreferences: {
            preferredTone: 'professional',
            customInstructions: undefined,
            excludedFields: [],
            learningEnabled: true,
            confidenceThreshold: 0.7,
            maxInstructionsPerForm: 50
          }
        }
      })),
      getDefaultPreferences: vi.fn(() => ({
        preferredTone: 'professional',
        customInstructions: undefined,
        excludedFields: [],
        learningEnabled: true,
        confidenceThreshold: 0.7,
        maxInstructionsPerForm: 50
      })),
      isFieldExcluded: vi.fn(() => false)
    }
  };
});

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
    sendMessage: vi.fn()
  }
} as any;

// Mock AI error notification manager
vi.mock('../ai/ai-error-notification', () => ({
  aiErrorNotificationManager: {
    showPartialSuccessNotification: vi.fn(),
    showErrorNotification: vi.fn(),
    showFallbackSuccessNotification: vi.fn()
  }
}));

// Mock AI service client content
vi.mock('../ai/ai-service-client-content', () => ({
  contentAIServiceClient: {
    analyzeForm: vi.fn(),
    validateToken: vi.fn().mockResolvedValue({ isValid: true }),
    getCachedAnalysis: vi.fn().mockResolvedValue(null),
    setCachedAnalysis: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock AI learning manager
vi.mock('../ai/ai-learning-manager', () => ({
  aiLearningManager: {
    recordLearningEvent: vi.fn(),
    recordFeedback: vi.fn(),
    recordUserCorrection: vi.fn(),
    getLearningInsights: vi.fn(() => ({})),
    getOptimizationSuggestions: vi.fn(() => []),
    exportLearningData: vi.fn(() => ({})),
    clearLearningData: vi.fn()
  }
}));

vi.mock('@extension/storage', () => ({
  profileStorage: {
    get: vi.fn()
  },
  aiSettingsStorage: {
    get: vi.fn()
  }
}));

describe('AIAutofillController', () => {
  let controller: AIAutofillController;
  let mockHtmlExtractor: any;
  let mockInstructionExecutor: any;
  let mockProfileStorage: any;
  let mockAISettingsStorage: any;
  let mockAIServiceClient: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Get mocked modules
    const { htmlExtractor } = await import('../html-extractor');
    const { InstructionExecutor } = await import('../instruction-executor');
    const { profileStorage } = await import('@extension/storage');

    mockHtmlExtractor = htmlExtractor;
    // Create a new mock instance for each test
    mockInstructionExecutor = new (InstructionExecutor as any)();
    mockProfileStorage = profileStorage;

    // Mock AI settings storage
    mockAISettingsStorage = {
      get: vi.fn().mockResolvedValue({
        enabled: true,
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.3,
        cacheEnabled: true
      }),
      hasToken: vi.fn().mockResolvedValue(true)
    };

    // Use the mocked content AI service client
    mockAIServiceClient = mockContentAIServiceClient;

    // Mock dynamic imports using vi.doMock before creating controller
    vi.doMock('@extension/storage', async () => {
      const actual = await vi.importActual('@extension/storage');
      return {
        ...actual,
        profileStorage: mockProfileStorage,
        aiSettingsStorage: mockAISettingsStorage
      };
    });

    vi.doMock('./ai/ai-service-client-content', () => ({
      contentAIServiceClient: mockContentAIServiceClient
    }));

    // Mock the shared module for AI preferences
    vi.doMock('@extension/shared', async () => {
      const actual = await vi.importActual('@extension/shared');
      return {
        ...actual,
        AIPreferencesManager: {
          initializeAIPreferences: vi.fn((profile) => profile),
          getDefaultPreferences: vi.fn(() => ({})),
          isFieldExcluded: vi.fn(() => false)
        }
      };
    });

    controller = new AIAutofillController({
      enableProgressTracking: true,
      enableFallback: true,
      logExecution: false
    });
  });

  afterEach(() => {
    controller.dispose();
  });

  describe('performAIAutofill', () => {
    it('should successfully perform AI autofill', async () => {
      // Mock extracted HTML
      const mockExtractedHTML: ExtractedHTML = {
        html: '<form><input name="firstName" /></form>',
        hash: 'test-hash',
        metadata: {
          url: 'https://example.com/apply',
          timestamp: new Date(),
          formCount: 1,
          fieldCount: 1,
          pageTitle: 'Job Application'
        }
      };

      // Mock user profile
      const mockUserProfile: UserProfile = {
        id: 'test-user',
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '555-0123',
          address: {
            street: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            zipCode: '94105',
            country: 'US'
          }
        },
        professionalInfo: {
          currentPosition: 'Software Engineer',
          experience: [],
          education: [],
          skills: []
        },
        documents: {
          resume: null,
          coverLetter: null
        },
        preferences: {
          jobPreferences: {
            desiredSalaryMin: 100000,
            desiredSalaryMax: 150000,
            availableStartDate: '2024-01-01',
            workAuthorization: 'US Citizen',
            willingToRelocate: false,
            preferredWorkType: 'remote',
            requiresSponsorship: false
          },
          aiPreferences: {
            preferredTone: 'professional',
            customInstructions: undefined,
            excludedFields: [],
            learningEnabled: true,
            confidenceThreshold: 0.7,
            maxInstructionsPerForm: 50
          }
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      };

      // Mock AI analysis
      const mockAIAnalysis: AIFormAnalysis = {
        instructions: [
          {
            action: 'fill',
            selector: 'input[name="firstName"]',
            value: 'John',
            reasoning: 'Fill first name field',
            confidence: 95,
            priority: 5
          }
        ],
        confidence: 90,
        reasoning: 'Simple form with one field',
        warnings: [],
        metadata: {
          analysisId: 'test-analysis',
          timestamp: new Date(),
          model: 'gpt-4',
          tokensUsed: 100
        }
      };

      // Mock execution result
      const mockExecutionResult = {
        instruction: mockAIAnalysis.instructions[0],
        success: true,
        actualValue: 'John',
        executionTime: 100,
        retryCount: 0
      };

      // Set up mocks
      mockHtmlExtractor.extractFormHTML.mockResolvedValue(mockExtractedHTML);
      mockProfileStorage.get.mockResolvedValue(mockUserProfile);
      mockContentAIServiceClient.analyzeForm.mockResolvedValue(mockAIAnalysis);
      mockInstructionExecutor.executeInstruction.mockResolvedValue(mockExecutionResult);
      mockInstructionExecutor.executeInstructions.mockResolvedValue([mockExecutionResult]);

      // Execute
      const result = await controller.performAIAutofill();

      // Verify
      expect(result.success).toBe(true);
      expect(result.totalInstructions).toBe(1);
      expect(result.successfulInstructions).toBe(1);
      expect(result.failedInstructions).toBe(0);
      expect(result.fallbackUsed).toBe(false);
      expect(result.errors).toHaveLength(0);

      // Verify method calls
      expect(mockHtmlExtractor.extractFormHTML).toHaveBeenCalledWith(undefined);
      expect(mockProfileStorage.get).toHaveBeenCalled();
      expect(mockContentAIServiceClient.analyzeForm).toHaveBeenCalledWith(
        mockExtractedHTML, 
        expect.objectContaining({
          personalInfo: expect.objectContaining({
            firstName: 'John'
          })
        })
      );
      expect(mockInstructionExecutor.executeInstructions).toHaveBeenCalledWith(mockAIAnalysis.instructions);
    });

    it('should throw error when AI Mode is disabled', async () => {
      mockAISettingsStorage.get.mockResolvedValue({
        enabled: false,
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.3,
        cacheEnabled: true
      });
      mockAISettingsStorage.hasToken.mockResolvedValue(true);

      await expect(controller.performAIAutofill()).rejects.toThrow('AI Mode is not enabled');
    });

    it('should throw error when no API token is configured', async () => {
      mockAISettingsStorage.get.mockResolvedValue({
        enabled: true,
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.3,
        cacheEnabled: true
      });
      mockAISettingsStorage.hasToken.mockResolvedValue(false);

      await expect(controller.performAIAutofill()).rejects.toThrow('No OpenAI API token configured');
    });

    it('should throw error when user profile is not found', async () => {
      mockHtmlExtractor.extractFormHTML.mockResolvedValue({
        html: '<form></form>',
        hash: 'test',
        metadata: {}
      });
      mockProfileStorage.get.mockResolvedValue(null);

      await expect(controller.performAIAutofill()).rejects.toThrow('User profile not found');
    });

    it('should handle HTML extraction failure', async () => {
      mockHtmlExtractor.extractFormHTML.mockRejectedValue(new Error('No forms found'));

      await expect(controller.performAIAutofill()).rejects.toThrow('Failed to extract form HTML: No forms found');
    });

    it('should handle AI analysis failure', async () => {
      mockHtmlExtractor.extractFormHTML.mockResolvedValue({
        html: '<form></form>',
        hash: 'test',
        metadata: {}
      });
      mockProfileStorage.get.mockResolvedValue({ 
        personalInfo: {},
        preferences: {
          aiPreferences: {
            preferredTone: 'professional',
            customInstructions: undefined,
            excludedFields: [],
            learningEnabled: true,
            confidenceThreshold: 0.7,
            maxInstructionsPerForm: 50
          }
        }
      });
      mockAIServiceClient.analyzeForm.mockRejectedValue(new Error('API error'));

      await expect(controller.performAIAutofill()).rejects.toThrow('AI analysis failed: API error');
    });

    it('should handle empty AI analysis', async () => {
      mockHtmlExtractor.extractFormHTML.mockResolvedValue({
        html: '<form></form>',
        hash: 'test',
        metadata: {}
      });
      mockProfileStorage.get.mockResolvedValue({ 
        personalInfo: {},
        preferences: {
          aiPreferences: {
            preferredTone: 'professional',
            customInstructions: undefined,
            excludedFields: [],
            learningEnabled: true,
            confidenceThreshold: 0.7,
            maxInstructionsPerForm: 50
          }
        }
      });
      mockAIServiceClient.analyzeForm.mockResolvedValue({
        instructions: [],
        confidence: 0,
        reasoning: 'No instructions',
        warnings: [],
        metadata: {}
      });

      await expect(controller.performAIAutofill()).rejects.toThrow('AI analysis returned no instructions');
    });
  });

  describe('progress tracking', () => {
    it('should track progress during autofill', async () => {
      const progressUpdates: any[] = [];
      controller.onProgress((progress) => {
        progressUpdates.push(progress);
      });

      // Mock successful execution
      mockHtmlExtractor.extractFormHTML.mockResolvedValue({
        html: '<form><input name="test" /></form>',
        hash: 'test',
        metadata: {}
      });
      mockProfileStorage.get.mockResolvedValue({ 
        personalInfo: {},
        preferences: {
          aiPreferences: {
            preferredTone: 'professional',
            customInstructions: undefined,
            excludedFields: [],
            learningEnabled: true,
            confidenceThreshold: 0.7,
            maxInstructionsPerForm: 50
          }
        }
      });
      mockAIServiceClient.analyzeForm.mockResolvedValue({
        instructions: [{ action: 'fill', selector: 'input', value: 'test', reasoning: '', confidence: 90, priority: 5 }],
        confidence: 90,
        reasoning: 'Test',
        warnings: [],
        metadata: {}
      });
      mockInstructionExecutor.executeInstruction.mockResolvedValue({
        success: true,
        executionTime: 100,
        retryCount: 0
      });

      await controller.performAIAutofill();

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0].stage).toBe('analyzing');
      expect(progressUpdates[progressUpdates.length - 1].stage).toBe('completed');
    });
  });

  describe('cancellation', () => {
    it('should allow cancelling ongoing autofill', async () => {
      // Start autofill but don't await
      const autofillPromise = controller.performAIAutofill();

      // Cancel immediately
      controller.cancel();

      // Should reject with cancellation error
      await expect(autofillPromise).rejects.toThrow();
    });
  });

  describe('execution statistics', () => {
    it('should provide execution statistics', () => {
      const stats = controller.getExecutionStats();

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('successful');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('averageExecutionTime');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on dispose', () => {
      // Since the controller creates its own instruction executor instance,
      // we can't easily spy on it. For now, just test that dispose doesn't throw.
      expect(() => controller.dispose()).not.toThrow();
      
      // Verify that the controller is properly cleaned up
      expect(controller.isProcessingAutofill()).toBe(false);
      expect(controller.getCurrentProgress()).toBeNull();
    });
  });
});