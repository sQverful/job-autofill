/**
 * Unit tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePhone,
  validateUrl,
  validatePastDate,
  validateDateRange,
  validateLength,
  validateUserProfile,
  ValidationErrorCodes,
} from '../validation.js';
import type { UserProfile } from '../../types/profile.js';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test..test@example.com')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone formats', () => {
      expect(validatePhone('1234567890')).toBe(true);
      expect(validatePhone('+1234567890')).toBe(true);
      expect(validatePhone('(123) 456-7890')).toBe(true);
      expect(validatePhone('123-456-7890')).toBe(true);
    });

    it('should reject invalid phone formats', () => {
      expect(validatePhone('123')).toBe(false);
      expect(validatePhone('abc123')).toBe(false);
      expect(validatePhone('')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URL formats', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://www.example.com')).toBe(true);
      expect(validateUrl('https://subdomain.example.com/path')).toBe(true);
    });

    it('should reject invalid URL formats', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://example.com')).toBe(false);
      expect(validateUrl('example.com')).toBe(false);
    });
  });

  describe('validatePastDate', () => {
    it('should validate past dates', () => {
      const pastDate = new Date('2020-01-01');
      expect(validatePastDate(pastDate)).toBe(true);
    });

    it('should reject future dates', () => {
      const futureDate = new Date('2030-01-01');
      expect(validatePastDate(futureDate)).toBe(false);
    });

    it('should accept today', () => {
      const today = new Date();
      expect(validatePastDate(today)).toBe(true);
    });
  });

  describe('validateDateRange', () => {
    it('should validate correct date ranges', () => {
      const startDate = new Date('2020-01-01');
      const endDate = new Date('2021-01-01');
      expect(validateDateRange(startDate, endDate)).toBe(true);
    });

    it('should reject invalid date ranges', () => {
      const startDate = new Date('2021-01-01');
      const endDate = new Date('2020-01-01');
      expect(validateDateRange(startDate, endDate)).toBe(false);
    });

    it('should accept undefined end date', () => {
      const startDate = new Date('2020-01-01');
      expect(validateDateRange(startDate, undefined)).toBe(true);
    });
  });

  describe('validateLength', () => {
    it('should validate correct lengths', () => {
      expect(validateLength('hello', 3, 10)).toBe(true);
      expect(validateLength('test', 4, 4)).toBe(true);
    });

    it('should reject strings that are too short', () => {
      expect(validateLength('hi', 3)).toBe(false);
    });

    it('should reject strings that are too long', () => {
      expect(validateLength('this is too long', 5, 10)).toBe(false);
    });
  });

  describe('validateUserProfile', () => {
    const createValidProfile = (): UserProfile => ({
      id: 'test-id',
      personalInfo: {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '1234567890',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345',
          country: 'USA',
        },
      },
      professionalInfo: {
        workExperience: [],
        education: [],
        skills: [],
        certifications: [],
      },
      preferences: {
        defaultAnswers: {},
        jobPreferences: {
          workAuthorization: 'citizen',
          requiresSponsorship: false,
          willingToRelocate: false,
          availableStartDate: new Date(),
          preferredWorkType: 'remote',
        },
        privacySettings: {
          shareAnalytics: true,
          shareUsageData: true,
          allowAIContentGeneration: true,
          dataSyncEnabled: true,
        },
        aiPreferences: {
          preferredTone: 'professional',
          excludedFields: [],
          learningEnabled: true,
          fieldMappingPreferences: {},
          autoApproveInstructions: false,
          maxInstructionsPerForm: 50,
          confidenceThreshold: 70,
        },
      },
      documents: {
        resumes: [],
        coverLetters: [],
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      },
    });

    it('should validate a complete valid profile', () => {
      const profile = createValidProfile();
      const result = validateUserProfile(profile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const profile = createValidProfile();
      profile.personalInfo.firstName = '';
      profile.personalInfo.email = '';

      const result = validateUserProfile(profile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].code).toBe(ValidationErrorCodes.REQUIRED_FIELD);
      expect(result.errors[1].code).toBe(ValidationErrorCodes.REQUIRED_FIELD);
    });

    it('should detect invalid email format', () => {
      const profile = createValidProfile();
      profile.personalInfo.email = 'invalid-email';

      const result = validateUserProfile(profile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ValidationErrorCodes.INVALID_EMAIL);
    });

    it('should detect invalid phone format', () => {
      const profile = createValidProfile();
      profile.personalInfo.phone = 'invalid-phone';

      const result = validateUserProfile(profile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ValidationErrorCodes.INVALID_PHONE);
    });

    it('should generate warnings for incomplete profile', () => {
      const profile = createValidProfile();
      const result = validateUserProfile(profile);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w: any) => w.field === 'professionalInfo.workExperience')).toBe(true);
      expect(result.warnings.some((w: any) => w.field === 'documents.resumes')).toBe(true);
    });
  });
});