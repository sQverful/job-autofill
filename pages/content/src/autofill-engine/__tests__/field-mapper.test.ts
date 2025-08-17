/**
 * Tests for field mapping functionality
 */

import { FieldMapper, DEFAULT_FIELD_MAPPINGS } from '../field-mapper';
import type { FormField, UserProfile } from '@extension/shared/lib/types';

describe('FieldMapper', () => {
  let fieldMapper: FieldMapper;
  let mockProfile: UserProfile;

  beforeEach(() => {
    fieldMapper = new FieldMapper();
    mockProfile = {
      id: 'test-user',
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
          country: 'USA'
        }
      },
      professionalInfo: {
        workExperience: [],
        education: [],
        skills: ['JavaScript', 'TypeScript', 'React'],
        certifications: []
      },
      preferences: {
        defaultAnswers: {},
        jobPreferences: {
          workAuthorization: 'citizen',
          requiresSponsorship: false,
          willingToRelocate: true,
          availableStartDate: new Date('2024-01-01'),
          preferredWorkType: 'remote'
        },
        privacySettings: {
          shareAnalytics: true,
          shareUsageData: true,
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

  describe('mapFields', () => {
    it('should map first name field correctly', () => {
      const fields: FormField[] = [{
        id: 'firstName',
        type: 'text',
        label: 'First Name',
        selector: '#firstName',
        required: true
      }];

      const mappings = fieldMapper.mapFields(fields);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].profilePath).toBe('personalInfo.firstName');
    });

    it('should map email field correctly', () => {
      const fields: FormField[] = [{
        id: 'email',
        type: 'email',
        label: 'Email Address',
        selector: '#email',
        required: true
      }];

      const mappings = fieldMapper.mapFields(fields);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].profilePath).toBe('personalInfo.email');
    });

    it('should handle multiple fields', () => {
      const fields: FormField[] = [
        {
          id: 'firstName',
          type: 'text',
          label: 'First Name',
          selector: '#firstName',
          required: true
        },
        {
          id: 'lastName',
          type: 'text',
          label: 'Last Name',
          selector: '#lastName',
          required: true
        },
        {
          id: 'email',
          type: 'email',
          label: 'Email',
          selector: '#email',
          required: true
        }
      ];

      const mappings = fieldMapper.mapFields(fields);
      expect(mappings).toHaveLength(3);
    });

    it('should not map unsupported field types', () => {
      const fields: FormField[] = [{
        id: 'unsupported',
        type: 'color' as any,
        label: 'Color Picker',
        selector: '#color',
        required: false
      }];

      const mappings = fieldMapper.mapFields(fields);
      expect(mappings).toHaveLength(0);
    });
  });

  describe('getProfileValue', () => {
    it('should get nested profile values', () => {
      const value = fieldMapper.getProfileValue(mockProfile, 'personalInfo.firstName');
      expect(value).toBe('John');
    });

    it('should get deeply nested values', () => {
      const value = fieldMapper.getProfileValue(mockProfile, 'personalInfo.address.city');
      expect(value).toBe('Anytown');
    });

    it('should return undefined for non-existent paths', () => {
      const value = fieldMapper.getProfileValue(mockProfile, 'nonexistent.path');
      expect(value).toBeUndefined();
    });
  });

  describe('transformValue', () => {
    it('should apply transformer function', () => {
      const transformer = (value: string) => value.toUpperCase();
      const result = fieldMapper.transformValue('hello', transformer);
      expect(result).toBe('HELLO');
    });

    it('should return original value if no transformer', () => {
      const result = fieldMapper.transformValue('hello');
      expect(result).toBe('hello');
    });

    it('should handle transformer errors gracefully', () => {
      const transformer = () => { throw new Error('Transform error'); };
      const result = fieldMapper.transformValue('hello', transformer);
      expect(result).toBe('hello');
    });
  });

  describe('validateValue', () => {
    it('should validate using validator function', () => {
      const validator = (value: string) => value.length > 5;
      expect(fieldMapper.validateValue('hello world', validator)).toBe(true);
      expect(fieldMapper.validateValue('hi', validator)).toBe(false);
    });

    it('should return true if no validator', () => {
      expect(fieldMapper.validateValue('anything')).toBe(true);
    });

    it('should handle validator errors gracefully', () => {
      const validator = () => { throw new Error('Validation error'); };
      expect(fieldMapper.validateValue('hello', validator)).toBe(false);
    });
  });

  describe('custom mappings', () => {
    it('should add and use custom mappings', () => {
      fieldMapper.addCustomMapping('customField', {
        fieldId: 'customField',
        profilePath: 'personalInfo.email',
        priority: 100
      });

      const fields: FormField[] = [{
        id: 'customField',
        type: 'text',
        label: 'Custom Field',
        selector: '#custom',
        required: false
      }];

      const mappings = fieldMapper.mapFields(fields);
      expect(mappings).toHaveLength(1);
      expect(mappings[0].profilePath).toBe('personalInfo.email');
    });

    it('should remove custom mappings', () => {
      fieldMapper.addCustomMapping('customField', {
        fieldId: 'customField',
        profilePath: 'personalInfo.email',
        priority: 100
      });

      fieldMapper.removeCustomMapping('customField');

      const fields: FormField[] = [{
        id: 'customField',
        type: 'text',
        label: 'Custom Field',
        selector: '#custom',
        required: false
      }];

      const mappings = fieldMapper.mapFields(fields);
      expect(mappings).toHaveLength(0);
    });
  });
});