/**
 * Tests for AI Profile Integration
 * Tests the profile formatter, preferences manager, and intelligent field mapper
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AIProfileFormatter } from '../ai-profile-formatter.js';
import { AIPreferencesManager } from '../ai-preferences-manager.js';
import { IntelligentFieldMapper } from '../intelligent-field-mapper.js';
import type { UserProfile, AIPreferences } from '../../types/profile.js';
import type { FormInstruction } from '../../types/ai.js';

// Mock user profile for testing
const createMockUserProfile = (): UserProfile => ({
  id: 'test-user-123',
  personalInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    address: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA'
    },
    linkedInUrl: 'https://linkedin.com/in/johndoe',
    portfolioUrl: 'https://johndoe.dev',
    githubUrl: 'https://github.com/johndoe'
  },
  workInfo: {
    currentTitle: 'Senior Software Engineer',
    experience: '5 years',
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python'],
    summary: 'Experienced software engineer with expertise in full-stack development'
  },
  professionalInfo: {
    workExperience: [
      {
        id: 'exp1',
        company: 'Tech Corp',
        position: 'Senior Software Engineer',
        startDate: new Date('2021-01-01'),
        isCurrent: true,
        description: 'Lead development of web applications',
        location: 'San Francisco, CA'
      },
      {
        id: 'exp2',
        company: 'StartupXYZ',
        position: 'Software Developer',
        startDate: new Date('2019-01-01'),
        endDate: new Date('2020-12-31'),
        isCurrent: false,
        description: 'Full-stack development',
        location: 'Remote'
      }
    ],
    education: [
      {
        id: 'edu1',
        institution: 'University of California',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        startDate: new Date('2015-09-01'),
        endDate: new Date('2019-05-31'),
        gpa: 3.8
      }
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'AWS', 'Docker'],
    certifications: [
      {
        id: 'cert1',
        name: 'AWS Certified Developer',
        issuer: 'Amazon Web Services',
        issueDate: new Date('2022-01-01'),
        expirationDate: new Date('2025-01-01')
      }
    ],
    summary: 'Experienced software engineer with expertise in full-stack development'
  },
  preferences: {
    desiredSalary: '$120,000 - $150,000',
    availableStartDate: '2024-01-01',
    workAuthorization: 'citizen',
    willingToRelocate: false,
    defaultAnswers: {},
    jobPreferences: {
      desiredSalaryMin: 120000,
      desiredSalaryMax: 150000,
      workAuthorization: 'citizen',
      requiresSponsorship: false,
      willingToRelocate: false,
      availableStartDate: new Date('2024-01-01'),
      preferredWorkType: 'remote',
      noticePeriod: '2 weeks'
    },
    privacySettings: {
      shareAnalytics: true,
      shareUsageData: false,
      allowAIContentGeneration: true,
      dataSyncEnabled: true
    },
    aiPreferences: {
      preferredTone: 'professional',
      customInstructions: 'Emphasize remote work experience',
      excludedFields: ['ssn', 'social_security'],
      learningEnabled: true,
      fieldMappingPreferences: {
        'full_name': 'personalInfo.firstName + personalInfo.lastName'
      },
      autoApproveInstructions: false,
      maxInstructionsPerForm: 25,
      confidenceThreshold: 75
    }
  },
  documents: {
    resumes: [],
    coverLetters: []
  },
  metadata: {
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-12-01'),
    version: 1
  }
});

describe('AIProfileFormatter', () => {
  let mockProfile: UserProfile;

  beforeEach(() => {
    mockProfile = createMockUserProfile();
  });

  describe('formatProfileForAI', () => {
    it('should format profile data for AI consumption', () => {
      const formatted = AIProfileFormatter.formatProfileForAI(mockProfile);

      expect(formatted.personal.name).toBe('John Doe');
      expect(formatted.personal.email).toBe('john.doe@example.com');
      expect(formatted.personal.phone).toBe('+1-555-0123');
      expect(formatted.personal.location).toBe('San Francisco, CA');
      expect(formatted.personal.linkedIn).toBe('https://linkedin.com/in/johndoe');
    });

    it('should include professional information with relevance scoring', () => {
      const jobContext = {
        company: 'Tech Corp',
        role: 'Software Engineer',
        industry: 'technology'
      };

      const formatted = AIProfileFormatter.formatProfileForAI(mockProfile, jobContext);

      expect(formatted.professional.currentTitle).toBe('Senior Software Engineer');
      expect(formatted.professional.experience).toHaveLength(2);
      expect(formatted.professional.experience[0].company).toBe('Tech Corp');
      expect(formatted.professional.skills).toContain('JavaScript');
    });

    it('should include AI preferences and context', () => {
      const formatted = AIProfileFormatter.formatProfileForAI(mockProfile);

      expect(formatted.preferences.tone).toBe('professional');
      expect(formatted.preferences.customInstructions).toBe('Emphasize remote work experience');
      expect(formatted.preferences.excludedFields).toContain('ssn');
      expect(formatted.context.aiLearningEnabled).toBe(true);
      expect(formatted.context.profileCompleteness).toBeGreaterThan(80);
    });
  });

  describe('getFieldMappingConfig', () => {
    it('should return field mapping configuration', () => {
      const config = AIProfileFormatter.getFieldMappingConfig(mockProfile);

      expect(config.commonMappings).toHaveProperty('first_name');
      expect(config.commonMappings).toHaveProperty('email');
      expect(config.excludePatterns).toContain('ssn');
      expect(config.priorityFields).toContain('first_name');
    });

    it('should include contextual mappings for tech companies', () => {
      const jobContext = {
        company: 'Tech Startup',
        role: 'Software Engineer',
        industry: 'technology'
      };

      const config = AIProfileFormatter.getFieldMappingConfig(mockProfile, jobContext);

      expect(config.contextualMappings).toHaveProperty('tech_company');
      expect(config.contextualMappings.tech_company).toHaveProperty('github_url');
    });
  });

  describe('createFieldMappingSuggestions', () => {
    it('should create intelligent field mapping suggestions', () => {
      const formFields = ['first_name', 'last_name', 'email', 'phone', 'github_profile'];
      const suggestions = AIProfileFormatter.createFieldMappingSuggestions(
        formFields,
        mockProfile
      );

      expect(suggestions).toHaveProperty('first_name');
      expect(suggestions).toHaveProperty('email');
      expect(suggestions.email).toBe('personalInfo.email');
    });
  });
});

describe('AIPreferencesManager', () => {
  let mockProfile: UserProfile;

  beforeEach(() => {
    mockProfile = createMockUserProfile();
  });

  describe('getDefaultPreferences', () => {
    it('should return default AI preferences', () => {
      const defaults = AIPreferencesManager.getDefaultPreferences();

      expect(defaults.preferredTone).toBe('professional');
      expect(defaults.learningEnabled).toBe(true);
      expect(defaults.excludedFields).toEqual([]);
      expect(defaults.confidenceThreshold).toBe(0.7);
    });
  });

  describe('initializeAIPreferences', () => {
    it('should initialize AI preferences if not present', () => {
      const profileWithoutAI = { ...mockProfile };
      delete (profileWithoutAI.preferences as any).aiPreferences;

      const initialized = AIPreferencesManager.initializeAIPreferences(profileWithoutAI);

      expect(initialized.preferences.aiPreferences).toBeDefined();
      expect(initialized.preferences.aiPreferences.preferredTone).toBe('professional');
    });

    it('should not overwrite existing AI preferences', () => {
      const result = AIPreferencesManager.initializeAIPreferences(mockProfile);

      expect(result.preferences.aiPreferences.customInstructions).toBe('Emphasize remote work experience');
      expect(result.preferences.aiPreferences.confidenceThreshold).toBe(75);
    });
  });

  describe('updateAIPreferences', () => {
    it('should update AI preferences', () => {
      const updates = {
        preferredTone: 'casual' as const,
        confidenceThreshold: 80,
        customInstructions: 'New instructions'
      };

      const updated = AIPreferencesManager.updateAIPreferences(mockProfile, updates);

      expect(updated.preferences.aiPreferences.preferredTone).toBe('casual');
      expect(updated.preferences.aiPreferences.confidenceThreshold).toBe(80);
      expect(updated.preferences.aiPreferences.customInstructions).toBe('New instructions');
      expect(updated.metadata.version).toBe(2);
    });

    it('should merge field mappings instead of replacing', () => {
      const updates = {
        fieldMappingPreferences: {
          'new_field': 'personalInfo.newField'
        }
      };

      const updated = AIPreferencesManager.updateAIPreferences(mockProfile, updates);

      expect(updated.preferences.aiPreferences.fieldMappingPreferences).toHaveProperty('full_name');
      expect(updated.preferences.aiPreferences.fieldMappingPreferences).toHaveProperty('new_field');
    });
  });

  describe('isFieldExcluded', () => {
    it('should identify excluded fields', () => {
      const isExcluded1 = AIPreferencesManager.isFieldExcluded(mockProfile, 'ssn_field', 'input[name="ssn_field"]');
      const isExcluded2 = AIPreferencesManager.isFieldExcluded(mockProfile, 'social_security_number', 'input[name="social_security_number"]');
      const isNotExcluded = AIPreferencesManager.isFieldExcluded(mockProfile, 'first_name', 'input[name="first_name"]');

      expect(isExcluded1).toBe(true);
      expect(isExcluded2).toBe(true);
      expect(isNotExcluded).toBe(false);
    });

    it('should check both field name and selector', () => {
      const isExcluded = AIPreferencesManager.isFieldExcluded(
        mockProfile,
        'user_field',
        'input[name="ssn"]'
      );

      expect(isExcluded).toBe(true);
    });
  });

  describe('recordLearningEvent', () => {
    it('should record learning events when enabled', () => {
      const instruction: FormInstruction = {
        action: 'fill',
        selector: 'input[name="first_name"]',
        value: 'John',
        options: [],
        reasoning: 'Test instruction',
        confidence: 85,
        priority: 8
      };

      const event = {
        type: 'success' as const,
        instruction,
        timestamp: new Date(),
        url: 'https://example.com/apply'
      };

      const updated = AIPreferencesManager.recordLearningEvent(mockProfile, event);

      expect(updated.metadata.aiLearningData).toBeDefined();
      expect(updated.metadata.aiLearningData!.events).toHaveLength(1);
    });

    it('should not record events when learning is disabled', () => {
      const profileWithLearningDisabled = {
        ...mockProfile,
        preferences: {
          ...mockProfile.preferences,
          aiPreferences: {
            ...mockProfile.preferences.aiPreferences,
            learningEnabled: false
          }
        }
      };

      const instruction: FormInstruction = {
        action: 'fill',
        selector: 'input[name="test"]',
        value: 'test',
        options: [],
        reasoning: 'Test',
        confidence: 80,
        priority: 5
      };

      const event = {
        type: 'success' as const,
        instruction,
        timestamp: new Date(),
        url: 'https://example.com'
      };

      const result = AIPreferencesManager.recordLearningEvent(profileWithLearningDisabled, event);

      expect(result).toBe(profileWithLearningDisabled);
    });
  });
});

describe('IntelligentFieldMapper', () => {
  let mockProfile: UserProfile;

  beforeEach(() => {
    mockProfile = createMockUserProfile();
  });

  describe('analyzeFormFields', () => {
    it('should analyze form fields and create mappings', () => {
      const formFields = [
        { name: 'firstName', type: 'text', selector: 'input[name="firstName"]', placeholder: 'First Name' },
        { name: 'email', type: 'email', selector: 'input[name="email"]', placeholder: 'Email Address' },
        { name: 'phone', type: 'tel', selector: 'input[name="phone"]', placeholder: 'Phone Number' },
        { name: 'ssn', type: 'text', selector: 'input[name="ssn"]', placeholder: 'Social Security Number' }
      ];

      const context = {
        url: 'https://techcorp.com/apply',
        pageTitle: 'Apply for Software Engineer at TechCorp',
        userPreferences: mockProfile.preferences.aiPreferences
      };

      const analysis = IntelligentFieldMapper.analyzeFormFields(formFields, mockProfile, context);

      expect(analysis).toHaveLength(4);
      expect(analysis[0].priority).toBeGreaterThan(analysis[3].priority); // Higher priority fields first
      
      const emailField = analysis.find((a: any) => a.fieldName === 'email');
      expect(emailField?.fieldType).toBe('email');
      expect(emailField?.confidence).toBeGreaterThan(80);
      expect(emailField?.isExcluded).toBe(false);

      const ssnField = analysis.find((a: any) => a.fieldName === 'ssn');
      expect(ssnField?.isExcluded).toBe(true);
    });
  });

  describe('generateMappingSuggestions', () => {
    it('should generate mapping suggestions from field analysis', () => {
      const fieldAnalysis = [
        {
          fieldName: 'firstName',
          fieldType: 'text' as const,
          selector: 'input[name="firstName"]',
          suggestedMapping: 'personal.firstName',
          confidence: 90,
          reasoning: 'Direct match with first name',
          isExcluded: false,
          priority: 9
        },
        {
          fieldName: 'email',
          fieldType: 'email' as const,
          selector: 'input[name="email"]',
          suggestedMapping: 'personal.email',
          confidence: 95,
          reasoning: 'Email field type match',
          isExcluded: false,
          priority: 10
        }
      ];

      const context = {
        url: 'https://example.com/apply',
        pageTitle: 'Job Application',
        userPreferences: mockProfile.preferences.aiPreferences
      };

      const suggestions = IntelligentFieldMapper.generateMappingSuggestions(
        fieldAnalysis,
        mockProfile,
        context
      );

      expect(suggestions.length).toBeGreaterThan(0);
      
      const firstNameSuggestion = suggestions.find((s: any) => s.fieldName === 'firstName');
      const emailSuggestion = suggestions.find((s: any) => s.fieldName === 'email');
      
      if (firstNameSuggestion) {
        expect(firstNameSuggestion.value).toBe('John');
      }
      if (emailSuggestion) {
        expect(emailSuggestion.value).toBe('john.doe@example.com');
      }
    });
  });

  describe('createFormInstructions', () => {
    it('should create form instructions from mapping suggestions', () => {
      const suggestions = [
        {
          fieldName: 'firstName',
          selector: 'input[name="firstName"]',
          profilePath: 'personal.firstName',
          value: 'John',
          confidence: 90,
          reasoning: 'Direct match',
          alternatives: []
        },
        {
          fieldName: 'lowConfidence',
          selector: 'input[name="lowConfidence"]',
          profilePath: 'personal.unknown',
          value: 'test',
          confidence: 60, // Below threshold
          reasoning: 'Low confidence match',
          alternatives: []
        }
      ];

      const context = {
        url: 'https://example.com/apply',
        pageTitle: 'Job Application',
        userPreferences: mockProfile.preferences.aiPreferences
      };

      const instructions = IntelligentFieldMapper.createFormInstructions(
        suggestions,
        mockProfile,
        context
      );

      // Should only include high-confidence instruction
      expect(instructions).toHaveLength(1);
      expect(instructions[0].action).toBe('fill');
      expect(instructions[0].selector).toBe('input[name="firstName"]');
      expect(instructions[0].value).toBe('John');
      expect(instructions[0].confidence).toBe(90);
    });
  });

  describe('learnFromCorrection', () => {
    it('should learn from user corrections', () => {
      const instruction: FormInstruction = {
        action: 'fill',
        selector: 'input[name="custom_field"]',
        value: 'wrong_value',
        options: [],
        reasoning: 'AI suggestion',
        confidence: 80,
        priority: 5
      };

      const context = {
        url: 'https://example.com/apply',
        pageTitle: 'Job Application',
        userPreferences: mockProfile.preferences.aiPreferences
      };

      const updated = IntelligentFieldMapper.learnFromCorrection(
        instruction,
        'correct_value',
        mockProfile,
        context
      );

      expect(updated.preferences.aiPreferences.fieldMappingPreferences).toHaveProperty('custom_field');
      expect((updated.metadata as any).aiLearningData).toBeDefined();
    });
  });
});

describe('Integration Tests', () => {
  let mockProfile: UserProfile;

  beforeEach(() => {
    mockProfile = createMockUserProfile();
  });

  it('should work together to create intelligent form filling', () => {
    // 1. Format profile for AI
    const jobContext = {
      company: 'TechCorp',
      role: 'Senior Software Engineer',
      industry: 'technology'
    };

    const formattedProfile = AIProfileFormatter.formatProfileForAI(mockProfile, jobContext);
    expect(formattedProfile.professional.currentTitle).toBe('Senior Software Engineer');

    // 2. Analyze form fields
    const formFields = [
      { name: 'fullName', type: 'text', selector: 'input[name="fullName"]', placeholder: 'Full Name' },
      { name: 'email', type: 'email', selector: 'input[name="email"]', placeholder: 'Email' },
      { name: 'currentRole', type: 'text', selector: 'input[name="currentRole"]', placeholder: 'Current Position' }
    ];

    // Lower confidence threshold for integration test
    const testProfile = {
      ...mockProfile,
      preferences: {
        ...mockProfile.preferences,
        aiPreferences: {
          ...mockProfile.preferences.aiPreferences,
          confidenceThreshold: 40 // Lower threshold for test
        }
      }
    };

    const context = {
      url: 'https://techcorp.com/apply',
      pageTitle: 'Apply for Senior Software Engineer at TechCorp',
      formContext: jobContext,
      userPreferences: testProfile.preferences.aiPreferences
    };

    const analysis = IntelligentFieldMapper.analyzeFormFields(formFields, testProfile, context);
    expect(analysis).toHaveLength(3);

    // 3. Generate suggestions
    const suggestions = IntelligentFieldMapper.generateMappingSuggestions(analysis, testProfile, context);
    expect(suggestions.length).toBeGreaterThan(0);

    // 4. Create instructions
    const instructions = IntelligentFieldMapper.createFormInstructions(suggestions, testProfile, context);
    
    expect(instructions.length).toBeGreaterThan(0);

    // Verify the full pipeline works
    const fullNameInstruction = instructions.find((i: any) => i.selector.includes('fullName'));
    expect(fullNameInstruction).toBeDefined();
    expect(fullNameInstruction?.value).toBe('John Doe');
    expect(fullNameInstruction?.action).toBe('fill');
  });
});