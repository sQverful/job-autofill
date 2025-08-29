/**
 * Tests for test data generator utility
 */

import { describe, it, expect } from 'vitest';
import {
  generateSampleUserProfile,
  generateSampleAddress,
  generateSampleWorkExperience,
  generateSampleEducation,
  generateSampleCertifications,
  generateSampleSkills,
  generateSampleJobPreferences,
  generateSampleDefaultAnswers,
  generateAlternativeSampleProfiles,
  validateTestData,
} from '../test-data-generator.js';
import { validateUserProfile } from '../validation.js';

describe('Test Data Generator', () => {
  describe('generateSampleAddress', () => {
    it('should generate a valid address', () => {
      const address = generateSampleAddress();
      
      expect(address.street).toBeTruthy();
      expect(address.city).toBeTruthy();
      expect(address.state).toBeTruthy();
      expect(address.zipCode).toBeTruthy();
      expect(address.country).toBeTruthy();
    });
  });

  describe('generateSampleWorkExperience', () => {
    it('should generate multiple work experience entries', () => {
      const workExperience = generateSampleWorkExperience();
      
      expect(workExperience).toHaveLength(3);
      expect(workExperience[0].isCurrent).toBe(true);
      expect(workExperience[1].isCurrent).toBe(false);
      expect(workExperience[1].endDate).toBeDefined();
    });

    it('should have valid work experience data', () => {
      const workExperience = generateSampleWorkExperience();
      
      workExperience.forEach(exp => {
        expect(exp.id).toBeTruthy();
        expect(exp.company).toBeTruthy();
        expect(exp.position).toBeTruthy();
        expect(exp.startDate).toBeInstanceOf(Date);
        expect(exp.description.length).toBeGreaterThan(10);
        expect(exp.location).toBeTruthy();
      });
    });
  });

  describe('generateSampleEducation', () => {
    it('should generate education entries', () => {
      const education = generateSampleEducation();
      
      expect(education).toHaveLength(2);
      expect(education[0].gpa).toBeDefined();
      expect(education[0].honors).toBeTruthy();
    });

    it('should have valid education data', () => {
      const education = generateSampleEducation();
      
      education.forEach(edu => {
        expect(edu.id).toBeTruthy();
        expect(edu.institution).toBeTruthy();
        expect(edu.degree).toBeTruthy();
        expect(edu.fieldOfStudy).toBeTruthy();
        expect(edu.startDate).toBeInstanceOf(Date);
        expect(edu.endDate).toBeInstanceOf(Date);
      });
    });
  });

  describe('generateSampleCertifications', () => {
    it('should generate certification entries', () => {
      const certifications = generateSampleCertifications();
      
      expect(certifications).toHaveLength(3);
      expect(certifications[0].credentialUrl).toBeTruthy();
      expect(certifications[2].credentialUrl).toBeUndefined();
    });

    it('should have valid certification data', () => {
      const certifications = generateSampleCertifications();
      
      certifications.forEach(cert => {
        expect(cert.id).toBeTruthy();
        expect(cert.name).toBeTruthy();
        expect(cert.issuer).toBeTruthy();
        expect(cert.issueDate).toBeInstanceOf(Date);
        expect(cert.expirationDate).toBeInstanceOf(Date);
      });
    });
  });

  describe('generateSampleSkills', () => {
    it('should generate a comprehensive skills list', () => {
      const skills = generateSampleSkills();
      
      expect(skills.length).toBeGreaterThan(20);
      expect(skills).toContain('JavaScript');
      expect(skills).toContain('React');
      expect(skills).toContain('AWS');
      expect(skills).toContain('Problem Solving');
    });

    it('should have unique skills', () => {
      const skills = generateSampleSkills();
      const uniqueSkills = [...new Set(skills)];
      
      expect(skills.length).toBe(uniqueSkills.length);
    });
  });

  describe('generateSampleJobPreferences', () => {
    it('should generate valid job preferences', () => {
      const preferences = generateSampleJobPreferences();
      
      expect(preferences.desiredSalaryMin).toBeGreaterThan(0);
      expect(preferences.desiredSalaryMax).toBeGreaterThan(preferences.desiredSalaryMin!);
      expect(preferences.workAuthorization).toBe('citizen');
      expect(preferences.requiresSponsorship).toBe(false);
      expect(preferences.availableStartDate).toBeInstanceOf(Date);
      expect(preferences.preferredWorkType).toBeTruthy();
    });
  });

  describe('generateSampleDefaultAnswers', () => {
    it('should generate comprehensive default answers', () => {
      const answers = generateSampleDefaultAnswers();
      
      expect(Object.keys(answers).length).toBeGreaterThan(10);
      expect(answers.work_authorization).toBeTruthy();
      expect(answers.salary_expectations).toBeTruthy();
      expect(answers.relocation).toBeTruthy();
    });

    it('should have meaningful answer content', () => {
      const answers = generateSampleDefaultAnswers();
      
      Object.values(answers).forEach(answer => {
        expect(answer.length).toBeGreaterThan(10);
        expect(answer).not.toContain('TODO');
        expect(answer).not.toContain('PLACEHOLDER');
      });
    });
  });

  describe('generateSampleUserProfile', () => {
    it('should generate a complete valid profile', () => {
      const profile = generateSampleUserProfile();
      
      expect(profile.id).toBeTruthy();
      expect(profile.personalInfo.firstName).toBe('John');
      expect(profile.personalInfo.lastName).toBe('Doe');
      expect(profile.personalInfo.email).toBe('john.doe@email.com');
      expect(profile.professionalInfo.workExperience.length).toBeGreaterThan(0);
      expect(profile.professionalInfo.education.length).toBeGreaterThan(0);
      expect(profile.professionalInfo.skills.length).toBeGreaterThan(0);
      expect(profile.documents.resumes.length).toBeGreaterThan(0);
      expect(profile.documents.coverLetters.length).toBeGreaterThan(0);
    });

    it('should pass profile validation', () => {
      const profile = generateSampleUserProfile();
      const validationResult = validateUserProfile(profile);
      
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });

    it('should have consistent metadata', () => {
      const profile = generateSampleUserProfile();
      
      expect(profile.metadata.createdAt).toBeInstanceOf(Date);
      expect(profile.metadata.updatedAt).toBeInstanceOf(Date);
      expect(profile.metadata.version).toBe(1);
      expect(profile.metadata.lastSyncAt).toBeUndefined();
    });
  });

  describe('generateAlternativeSampleProfiles', () => {
    it('should generate multiple profile variants', () => {
      const profiles = generateAlternativeSampleProfiles();
      
      expect(Object.keys(profiles)).toContain('frontend-developer');
      expect(Object.keys(profiles)).toContain('backend-developer');
    });

    it('should have different personal info for each variant', () => {
      const profiles = generateAlternativeSampleProfiles();
      
      expect(profiles['frontend-developer'].personalInfo.firstName).toBe('Sarah');
      expect(profiles['backend-developer'].personalInfo.firstName).toBe('Michael');
    });

    it('should have role-specific skills', () => {
      const profiles = generateAlternativeSampleProfiles();
      
      const frontendSkills = profiles['frontend-developer'].professionalInfo.skills;
      const backendSkills = profiles['backend-developer'].professionalInfo.skills;
      
      expect(frontendSkills).toContain('React');
      expect(frontendSkills).toContain('CSS3');
      expect(backendSkills).toContain('Python');
      expect(backendSkills).toContain('PostgreSQL');
    });
  });

  describe('validateTestData', () => {
    it('should validate complete test data as valid', () => {
      const profile = generateSampleUserProfile();
      const isValid = validateTestData(profile);
      
      expect(isValid).toBe(true);
    });

    it('should detect incomplete test data', () => {
      const profile = generateSampleUserProfile();
      profile.personalInfo.firstName = '';
      
      const isValid = validateTestData(profile);
      
      expect(isValid).toBe(false);
    });

    it('should handle validation errors gracefully', () => {
      const invalidProfile = {} as any;
      
      const isValid = validateTestData(invalidProfile);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Data Quality', () => {
    it('should generate realistic dates', () => {
      const profile = generateSampleUserProfile();
      const now = new Date();
      
      // Work experience dates should be in the past
      profile.professionalInfo.workExperience.forEach(exp => {
        expect(exp.startDate.getTime()).toBeLessThan(now.getTime());
        if (exp.endDate && !exp.isCurrent) {
          expect(exp.endDate.getTime()).toBeLessThan(now.getTime());
          expect(exp.endDate.getTime()).toBeGreaterThan(exp.startDate.getTime());
        }
      });

      // Education dates should be in the past
      profile.professionalInfo.education.forEach(edu => {
        expect(edu.startDate.getTime()).toBeLessThan(now.getTime());
        if (edu.endDate) {
          expect(edu.endDate.getTime()).toBeGreaterThan(edu.startDate.getTime());
        }
      });
    });

    it('should generate valid email format', () => {
      const profile = generateSampleUserProfile();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      expect(emailRegex.test(profile.personalInfo.email)).toBe(true);
    });

    it('should generate valid URLs', () => {
      const profile = generateSampleUserProfile();
      const urlRegex = /^https?:\/\//;
      
      if (profile.personalInfo.linkedInUrl) {
        expect(urlRegex.test(profile.personalInfo.linkedInUrl)).toBe(true);
      }
      if (profile.personalInfo.portfolioUrl) {
        expect(urlRegex.test(profile.personalInfo.portfolioUrl)).toBe(true);
      }
      if (profile.personalInfo.githubUrl) {
        expect(urlRegex.test(profile.personalInfo.githubUrl)).toBe(true);
      }
    });
  });
});