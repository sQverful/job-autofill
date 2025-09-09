/**
 * Simple test script to verify ProfileDataValidator functionality
 */

import { ProfileDataValidator } from './utils/profile-data-validator';
import type { UserProfile, FormField } from '@extension/shared';

// Create a mock profile
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
    },
    linkedInUrl: 'https://linkedin.com/in/johndoe',
    portfolioUrl: 'https://johndoe.dev',
    githubUrl: 'https://github.com/johndoe'
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
    summary: 'Experienced software engineer with 3+ years of experience'
  },
  preferences: {
    defaultAnswers: {
      'work_authorization': 'Yes, I am authorized to work in the US',
      'privacy_consent': 'I consent to data processing',
      'pronouns': 'he/him'
    },
    jobPreferences: {
      desiredSalaryMin: 100000,
      desiredSalaryMax: 150000,
      workAuthorization: 'citizen',
      requiresSponsorship: false,
      willingToRelocate: true,
      availableStartDate: new Date('2024-02-01'),
      preferredWorkType: 'hybrid',
      noticePeriod: '2 weeks'
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

// Test the validator
const validator = new ProfileDataValidator();

console.log('Testing ProfileDataValidator...\n');

// Test 1: Profile value with existing data
const firstNameField: FormField = {
  id: 'first-name',
  type: 'text',
  label: 'First Name',
  selector: '#firstName',
  required: true,
  mappedProfileField: 'personalInfo.firstName'
};

const firstNameResult = validator.getProfileValue(firstNameField, mockProfile);
console.log('Test 1 - First Name:', firstNameResult);

// Test 2: Default answer
const workAuthField: FormField = {
  id: 'work-auth',
  type: 'select',
  label: 'Work Authorization',
  selector: '#workAuth',
  required: true,
  mappedProfileField: 'preferences.defaultAnswers.work_authorization'
};

const workAuthResult = validator.getProfileValue(workAuthField, mockProfile);
console.log('Test 2 - Work Authorization:', workAuthResult);

// Test 3: Fallback for missing demographic field
const genderField: FormField = {
  id: 'gender',
  type: 'select',
  label: 'Gender Identity',
  selector: '#gender',
  required: false,
  mappedProfileField: 'preferences.defaultAnswers.gender_identity'
};

const genderResult = validator.getProfileValue(genderField, mockProfile);
console.log('Test 3 - Gender Identity (fallback):', genderResult);

// Test 4: Salary field with intelligent fallback
const salaryField: FormField = {
  id: 'salary',
  type: 'text',
  label: 'Salary Expectations',
  selector: '#salary',
  required: false
};

const salaryResult = validator.getProfileValue(salaryField, mockProfile);
console.log('Test 4 - Salary Expectations:', salaryResult);

// Test 5: Profile completeness validation
console.log('\nTesting profile completeness validation...');
const validation = validator.validateProfileCompleteness(mockProfile);
console.log('Completeness:', (validation.completeness * 100).toFixed(1) + '%');
console.log('Missing fields:', validation.missingFields.slice(0, 5)); // Show first 5
console.log('Sample suggestions:', Object.entries(validation.suggestions).slice(0, 3));

console.log('\nProfileDataValidator tests completed successfully!');