/**
 * Integration test for Enhanced Autofill with ProfileDataValidator
 */

import { EnhancedAutofill } from './enhanced-autofill';

// Mock the chrome API
(global as any).chrome = {
  runtime: {
    onMessage: {
      addListener: () => {}
    },
    sendMessage: () => {}
  }
};

// Mock the profileStorage
jest.mock('@extension/storage', () => ({
  profileStorage: {
    get: async () => ({
      id: 'test-profile',
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-123-4567',
        address: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94105',
          country: 'United States'
        }
      },
      professionalInfo: {
        workExperience: [],
        education: [],
        skills: ['JavaScript', 'TypeScript'],
        certifications: [],
        summary: 'Software engineer'
      },
      preferences: {
        defaultAnswers: {
          'work_authorization': 'Yes, I am authorized to work in the US'
        },
        jobPreferences: {
          desiredSalaryMin: 100000,
          desiredSalaryMax: 150000,
          workAuthorization: 'citizen',
          requiresSponsorship: false,
          willingToRelocate: true,
          availableStartDate: new Date('2024-02-01'),
          preferredWorkType: 'hybrid'
        },
        privacySettings: {
          shareAnalytics: true,
          shareUsageData: false,
          allowAIContentGeneration: true,
          dataSyncEnabled: true
        }
      },
      documents: {
        resumes: [],
        coverLetters: []
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      }
    })
  }
}));

console.log('Testing Enhanced Autofill integration with ProfileDataValidator...');

// Create an instance of EnhancedAutofill
const autofill = new EnhancedAutofill();

// Test that it initializes without errors
console.log('✓ EnhancedAutofill initialized successfully');

// Test profile completeness validation
setTimeout(() => {
  try {
    autofill.validateProfileCompleteness();
    console.log('✓ Profile completeness validation completed');
  } catch (error) {
    console.error('✗ Profile completeness validation failed:', error);
  }
}, 100);

console.log('Integration test completed!');