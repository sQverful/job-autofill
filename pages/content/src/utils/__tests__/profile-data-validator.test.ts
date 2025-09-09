/**
 * Tests for Profile Data Completeness Validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProfileDataValidator } from '../profile-data-validator';
import type { UserProfile, FormField } from '@extension/shared';

describe('ProfileDataValidator', () => {
  let validator: ProfileDataValidator;
  let mockProfile: UserProfile;

  beforeEach(() => {
    validator = new ProfileDataValidator();
    
    mockProfile = {
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
  });

  describe('getProfileValue', () => {
    it('should return profile value when mapped field exists', () => {
      const field: FormField = {
        id: 'first-name',
        type: 'text',
        label: 'First Name',
        selector: '#firstName',
        required: true,
        mappedProfileField: 'personalInfo.firstName'
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).toBe('John');
      expect(result.source).toBe('profile');
      expect(result.confidence).toBe(1.0);
    });

    it('should return default answer when profile field is missing', () => {
      const field: FormField = {
        id: 'work-auth',
        type: 'select',
        label: 'Work Authorization',
        selector: '#workAuth',
        required: true,
        mappedProfileField: 'preferences.defaultAnswers.work_authorization'
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).toBe('Yes, I am authorized to work in the US');
      expect(result.source).toBe('profile');
      expect(result.confidence).toBe(1.0);
    });

    it('should return fallback value for demographic fields when no data exists', () => {
      const field: FormField = {
        id: 'gender',
        type: 'select',
        label: 'Gender Identity',
        selector: '#gender',
        required: false,
        mappedProfileField: 'preferences.defaultAnswers.gender_identity'
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).toBe('Prefer not to say');
      expect(result.source).toBe('fallback');
      expect(result.confidence).toBe(0.7);
    });

    it('should generate intelligent fallback for salary fields', () => {
      const field: FormField = {
        id: 'salary',
        type: 'text',
        label: 'Salary Expectations',
        selector: '#salary',
        required: false
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).toContain('$100,000');
      expect(result.value).toContain('$150,000');
      expect(result.source).toBe('fallback');
    });

    it('should handle date fields with appropriate defaults', () => {
      const field: FormField = {
        id: 'start-date',
        type: 'date',
        label: 'Available Start Date',
        selector: '#startDate',
        required: true
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.source).toBe('fallback');
    });

    it('should provide context-based values for required fields', () => {
      const field: FormField = {
        id: 'email',
        type: 'email',
        label: 'Email Address',
        selector: '#email',
        required: true
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).toBe('john.doe@example.com');
      expect(result.source).toBe('context');
    });

    it('should return alternatives for ambiguous fields', () => {
      const field: FormField = {
        id: 'disability',
        type: 'select',
        label: 'Disability Status',
        selector: '#disability',
        required: false
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives).toContain('Prefer not to say');
      expect(result.alternatives).toContain('I choose not to disclose');
    });
  });

  describe('validateProfileCompleteness', () => {
    it('should identify missing demographic fields', () => {
      const result = validator.validateProfileCompleteness(mockProfile);

      expect(result.missingFields).toContain('gender_identity');
      expect(result.missingFields).toContain('ethnicity');
      expect(result.missingFields).toContain('disability');
      expect(result.suggestions['gender_identity']).toBe('Prefer not to say');
    });

    it('should recognize existing default answers', () => {
      const result = validator.validateProfileCompleteness(mockProfile);

      expect(result.missingFields).not.toContain('work_authorization');
      expect(result.missingFields).not.toContain('privacy_consent');
      expect(result.missingFields).not.toContain('pronouns');
    });

    it('should calculate completeness percentage', () => {
      const result = validator.validateProfileCompleteness(mockProfile);

      expect(result.completeness).toBeGreaterThan(0);
      expect(result.completeness).toBeLessThanOrEqual(1);
    });

    it('should provide suggestions for missing fields', () => {
      const result = validator.validateProfileCompleteness(mockProfile);

      expect(Object.keys(result.suggestions).length).toBeGreaterThan(0);
      
      for (const suggestion of Object.values(result.suggestions)) {
        expect(typeof suggestion).toBe('string');
        expect(suggestion.length).toBeGreaterThan(0);
      }
    });

    it('should handle profile with complete data', () => {
      // Add all missing fields to make profile complete
      const completeProfile = {
        ...mockProfile,
        preferences: {
          ...mockProfile.preferences,
          defaultAnswers: {
            ...mockProfile.preferences.defaultAnswers,
            'gender_identity': 'Prefer not to say',
            'sexual_orientation': 'Prefer not to say',
            'disability': 'Prefer not to say',
            'neurodivergent': 'Prefer not to say',
            'ethnicity': 'Prefer not to say',
            'veteran_status': 'Prefer not to say',
            'transgender': 'Prefer not to say',
            'visa_sponsorship': 'No',
            'sponsorship_required': 'No',
            'us_person': 'Yes',
            'right_to_work': 'Yes',
            'start_date': 'Available in 2 weeks',
            'availability': 'Immediate',
            'salary_expectations': 'Competitive',
            'salary_range': '$100k-150k',
            'relocation': 'Yes',
            'remote_work': 'Yes',
            'years_experience': '3 years',
            'relevant_experience': 'Full-stack development',
            'why_interested': 'Great opportunity',
            'motivation': 'Career growth',
            'cover_letter': 'Attached resume',
            'references': 'Available upon request'
          }
        }
      };

      const result = validator.validateProfileCompleteness(completeProfile);

      expect(result.isValid).toBe(true);
      expect(result.missingFields).toHaveLength(0);
      expect(result.completeness).toBe(1.0);
    });
  });

  describe('field type detection', () => {
    it('should correctly identify demographic fields', () => {
      const demographicLabels = [
        'Gender Identity',
        'Ethnicity',
        'Disability Status',
        'Veteran Status'
      ];

      for (const label of demographicLabels) {
        const field: FormField = {
          id: 'test',
          type: 'select',
          label,
          selector: '#test',
          required: false
        };

        const result = validator.getProfileValue(field, mockProfile);
        expect(result.value).toBe('Prefer not to say');
      }

      // Test that existing pronouns data is returned
      const pronounsField: FormField = {
        id: 'pronouns',
        type: 'select',
        label: 'Preferred Pronouns',
        selector: '#pronouns',
        required: false
      };

      const pronounsResult = validator.getProfileValue(pronounsField, mockProfile);
      expect(pronounsResult.value).toBe('he/him');
    });

    it('should correctly identify work authorization fields', () => {
      const workAuthLabels = [
        'Work Authorization',
        'Visa Sponsorship Required',
        'Right to Work',
        'US Person'
      ];

      for (const label of workAuthLabels) {
        const field: FormField = {
          id: 'test',
          type: 'select',
          label,
          selector: '#test',
          required: false
        };

        const result = validator.getProfileValue(field, mockProfile);
        expect(result.value).toContain('Yes' || 'No' || 'discuss');
      }
    });

    it('should correctly identify salary fields', () => {
      const salaryLabels = [
        'Salary Expectations',
        'Expected Compensation',
        'Pay Range',
        'Desired Salary'
      ];

      for (const label of salaryLabels) {
        const field: FormField = {
          id: 'test',
          type: 'text',
          label,
          selector: '#test',
          required: false
        };

        const result = validator.getProfileValue(field, mockProfile);
        expect(result.value).toMatch(/\$|competitive|negotiable/i);
      }
    });
  });

  describe('fuzzy field matching', () => {
    it('should match fields with different formatting', () => {
      // Test that work_authorization matches "Work Authorization"
      const field: FormField = {
        id: 'work-auth',
        type: 'select',
        label: 'Work Authorization Status',
        selector: '#workAuth',
        required: true
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).toBe('Yes, I am authorized to work in the US');
      expect(result.source).toBe('default');
    });

    it('should handle underscores and spaces in field names', () => {
      const field: FormField = {
        id: 'privacy',
        type: 'checkbox',
        label: 'Privacy Consent',
        selector: '#privacy',
        required: true
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).toBe('I consent to data processing');
      expect(result.source).toBe('default');
    });
  });

  describe('experience estimation', () => {
    it('should estimate experience from work history', () => {
      const field: FormField = {
        id: 'experience',
        type: 'text',
        label: 'Years of Experience',
        selector: '#experience',
        required: false
      };

      const result = validator.getProfileValue(field, mockProfile);

      expect(result.value).not.toBeNull();
      if (result.value) {
        expect(result.value).toContain('3 years');
      }
    });

    it('should handle profiles with no work experience', () => {
      const profileNoExp = {
        ...mockProfile,
        professionalInfo: {
          ...mockProfile.professionalInfo,
          workExperience: []
        }
      };

      const field: FormField = {
        id: 'experience',
        type: 'text',
        label: 'Years of Experience',
        selector: '#experience',
        required: false
      };

      const result = validator.getProfileValue(field, profileNoExp);

      expect(result.value).not.toBeNull();
      if (result.value) {
        expect(result.value).toContain('2 years');
      }
    });
  });
});