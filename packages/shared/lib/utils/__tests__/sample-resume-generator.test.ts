/**
 * Tests for sample resume generator utility
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateSampleResumeContent,
  createSampleResumeBlob,
  generateSampleResumeDocuments,
  simulateResumeUpload,
  validateSampleResumeFile,
  generateSampleCoverLetterContent,
  createSampleCoverLetterBlob,
} from '../sample-resume-generator.js';

describe('Sample Resume Generator', () => {
  describe('generateSampleResumeContent', () => {
    it('should generate default resume content', () => {
      const content = generateSampleResumeContent();
      
      expect(content).toContain('JOHN DOE');
      expect(content).toContain('Software Engineer');
      expect(content).toContain('john.doe@email.com');
      expect(content).toContain('PROFESSIONAL SUMMARY');
      expect(content).toContain('TECHNICAL SKILLS');
      expect(content).toContain('PROFESSIONAL EXPERIENCE');
      expect(content).toContain('EDUCATION');
    });

    it('should generate frontend developer resume content', () => {
      const content = generateSampleResumeContent('frontend-developer');
      
      expect(content).toContain('SARAH CHEN');
      expect(content).toContain('Senior Frontend Developer');
      expect(content).toContain('sarah.chen@email.com');
      expect(content).toContain('React');
      expect(content).toContain('Vue.js');
      expect(content).toContain('CSS3');
    });

    it('should generate backend developer resume content', () => {
      const content = generateSampleResumeContent('backend-developer');
      
      expect(content).toContain('MICHAEL RODRIGUEZ');
      expect(content).toContain('Senior Backend Engineer');
      expect(content).toContain('michael.rodriguez@email.com');
      expect(content).toContain('Python');
      expect(content).toContain('PostgreSQL');
      expect(content).toContain('microservices');
    });

    it('should generate substantial content', () => {
      const content = generateSampleResumeContent();
      
      expect(content.length).toBeGreaterThan(2000);
      expect(content.split('\n').length).toBeGreaterThan(50);
    });
  });

  describe('createSampleResumeBlob', () => {
    it('should create a valid blob', () => {
      const blob = createSampleResumeBlob();
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/plain');
      expect(blob.size).toBeGreaterThan(2000);
    });

    it('should create different blobs for different profile types', () => {
      const defaultBlob = createSampleResumeBlob('default');
      const frontendBlob = createSampleResumeBlob('frontend-developer');
      
      expect(defaultBlob.size).not.toBe(frontendBlob.size);
    });
  });

  describe('generateSampleResumeDocuments', () => {
    it('should generate resume document metadata', () => {
      const documents = generateSampleResumeDocuments();
      
      expect(documents).toHaveLength(2);
      expect(documents[0].isDefault).toBe(true);
      expect(documents[1].isDefault).toBe(false);
      
      documents.forEach(doc => {
        expect(doc.id).toBeTruthy();
        expect(doc.name).toBeTruthy();
        expect(doc.fileName).toBeTruthy();
        expect(doc.fileSize).toBeGreaterThan(0);
        expect(doc.fileType).toBe('pdf');
        expect(doc.uploadDate).toBeInstanceOf(Date);
      });
    });

    it('should generate profile-specific document names', () => {
      const defaultDocs = generateSampleResumeDocuments('default');
      const frontendDocs = generateSampleResumeDocuments('frontend-developer');
      const backendDocs = generateSampleResumeDocuments('backend-developer');
      
      expect(defaultDocs[0].name).toContain('John Doe');
      expect(defaultDocs[0].fileName).toContain('john_doe');
      
      expect(frontendDocs[0].name).toContain('Sarah Chen');
      expect(frontendDocs[0].fileName).toContain('sarah_chen');
      
      expect(backendDocs[0].name).toContain('Michael Rodriguez');
      expect(backendDocs[0].fileName).toContain('michael_rodriguez');
    });
  });

  describe('simulateResumeUpload', () => {
    it('should create a valid File object', () => {
      const file = simulateResumeUpload();
      
      expect(file).toBeInstanceOf(File);
      expect(file.name).toContain('john_doe_sample_resume.txt');
      expect(file.type).toBe('text/plain');
      expect(file.size).toBeGreaterThan(2000);
    });

    it('should create different files for different profile types', () => {
      const defaultFile = simulateResumeUpload('default');
      const frontendFile = simulateResumeUpload('frontend-developer');
      
      expect(defaultFile.name).toContain('john_doe');
      expect(frontendFile.name).toContain('sarah_chen');
      expect(defaultFile.size).not.toBe(frontendFile.size);
    });
  });

  describe('validateSampleResumeFile', () => {
    it('should validate a good resume file', () => {
      const file = simulateResumeUpload();
      const result = validateSampleResumeFile(file);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', () => {
      const largeBlob = new Blob(['x'.repeat(6 * 1024 * 1024)], { type: 'text/plain' });
      const largeFile = new File([largeBlob], 'large_resume.txt', { type: 'text/plain' });
      
      const result = validateSampleResumeFile(largeFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds 5MB limit');
    });

    it('should reject files that are too small', () => {
      const smallBlob = new Blob(['tiny'], { type: 'text/plain' });
      const smallFile = new File([smallBlob], 'tiny_resume.txt', { type: 'text/plain' });
      
      const result = validateSampleResumeFile(smallFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size is too small to be a valid resume');
    });

    it('should reject unsupported file types', () => {
      const blob = new Blob(['resume content'], { type: 'image/jpeg' });
      const file = new File([blob], 'resume.jpg', { type: 'image/jpeg' });
      
      const result = validateSampleResumeFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File type not supported. Please use PDF, DOC, DOCX, or TXT files.');
    });

    it('should reject files with invalid names', () => {
      const blob = new Blob(['resume content'], { type: 'text/plain' });
      const file = new File([blob], '', { type: 'text/plain' });
      
      const result = validateSampleResumeFile(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid file name');
    });
  });

  describe('generateSampleCoverLetterContent', () => {
    it('should generate default cover letter content', () => {
      const content = generateSampleCoverLetterContent();
      
      expect(content).toContain('Dear Hiring Manager');
      expect(content).toContain('[COMPANY_NAME]');
      expect(content).toContain('[POSITION_TITLE]');
      expect(content).toContain('John Doe');
    });

    it('should replace placeholders when provided', () => {
      const content = generateSampleCoverLetterContent('default', 'TechCorp', 'Senior Developer');
      
      expect(content).toContain('TechCorp');
      expect(content).toContain('Senior Developer');
      expect(content).not.toContain('[COMPANY_NAME]');
      expect(content).not.toContain('[POSITION_TITLE]');
    });

    it('should generate profile-specific content', () => {
      const frontendContent = generateSampleCoverLetterContent('frontend-developer');
      const backendContent = generateSampleCoverLetterContent('backend-developer');
      
      expect(frontendContent).toContain('Sarah Chen');
      expect(frontendContent).toContain('frontend developer');
      expect(frontendContent).toContain('React');
      
      expect(backendContent).toContain('Michael Rodriguez');
      expect(backendContent).toContain('backend');
      expect(backendContent).toContain('Python');
    });
  });

  describe('createSampleCoverLetterBlob', () => {
    it('should create a valid cover letter blob', () => {
      const blob = createSampleCoverLetterBlob();
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('text/plain');
      expect(blob.size).toBeGreaterThan(500);
    });

    it('should create different blobs for different profile types', () => {
      const defaultBlob = createSampleCoverLetterBlob('default');
      const frontendBlob = createSampleCoverLetterBlob('frontend-developer');
      
      expect(defaultBlob.size).not.toBe(frontendBlob.size);
    });
  });

  describe('Content Quality', () => {
    it('should generate realistic professional content', () => {
      const content = generateSampleResumeContent();
      
      // Check for professional sections
      expect(content).toMatch(/PROFESSIONAL SUMMARY|SUMMARY/i);
      expect(content).toMatch(/TECHNICAL SKILLS|SKILLS/i);
      expect(content).toMatch(/PROFESSIONAL EXPERIENCE|EXPERIENCE/i);
      expect(content).toMatch(/EDUCATION/i);
      
      // Check for realistic details
      expect(content).toMatch(/\d+\+?\s*years/i); // Years of experience
      expect(content).toMatch(/\d{4}/); // Years (dates)
      expect(content).toMatch(/@/); // Email address
      expect(content).toMatch(/\(\d{3}\)/); // Phone number format
    });

    it('should not contain placeholder text', () => {
      const content = generateSampleResumeContent();
      
      expect(content).not.toContain('TODO');
      expect(content).not.toContain('PLACEHOLDER');
      expect(content).not.toContain('FIXME');
      expect(content).not.toContain('[INSERT');
    });

    it('should have consistent formatting', () => {
      const content = generateSampleResumeContent();
      
      // Check for consistent section headers (all caps)
      const sections = content.match(/^[A-Z\s&]+$/gm) || [];
      expect(sections.length).toBeGreaterThan(3);
      
      // Check for bullet points
      expect(content).toMatch(/^•/m);
    });
  });
});