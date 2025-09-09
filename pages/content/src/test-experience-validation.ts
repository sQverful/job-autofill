/**
 * Test experience field validation
 */

import { ProfileDataValidator } from './utils/profile-data-validator';
import type { UserProfile, FormField } from '@extension/shared';

const mockProfile: UserProfile = {
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
    workExperience: [
      {
        id: '1',
        company: 'Tech Corp',
        position: 'Software Engineer',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-01-01'),
        isCurrent: false,
        description: 'Full-stack development',
        location: 'San Francisco, CA'
      }
    ],
    education: [],
    skills: ['JavaScript', 'TypeScript', 'React'],
    certifications: [],
    summary: 'Experienced software engineer'
  },
  preferences: {
    defaultAnswers: {},
    jobPreferences: {
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
};

const validator = new ProfileDataValidator();

// Test experience field
const experienceField: FormField = {
  id: 'experience',
  type: 'text',
  label: 'Years of Experience',
  selector: '#experience',
  required: false
};

console.log('Testing experience field validation...');

const result = validator.getProfileValue(experienceField, mockProfile);
console.log('Experience field result:', result);

// Test with no work experience
const profileNoExp = {
  ...mockProfile,
  professionalInfo: {
    ...mockProfile.professionalInfo,
    workExperience: []
  }
};

const resultNoExp = validator.getProfileValue(experienceField, profileNoExp);
console.log('No experience result:', resultNoExp);

console.log('Experience validation test completed!');