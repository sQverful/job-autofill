/**
 * Unit tests for BaseFormDetector
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseFormDetector, DEFAULT_DETECTION_CONFIG } from '../base-detector';
import type { FormDetectionResult, DetectedForm } from '@extension/shared/lib/types/form-detection';

// Mock DOM environment
const mockDocument = {
  location: {
    href: 'https://example.com/job-application',
    hostname: 'example.com'
  },
  title: 'Software Engineer - Job Application',
  body: {
    textContent: 'Apply for this exciting software engineer position at our company. We are looking for qualified candidates with experience in JavaScript and React.',
    className: ''
  },
  querySelector: vi.fn(),
  querySelectorAll: vi.fn()
} as unknown as Document;

// Mock HTML elements
const createMockElement = (tagName: string, attributes: Record<string, string> = {}, textContent = ''): HTMLElement => {
  const element = {
    tagName: tagName.toUpperCase(),
    id: attributes.id || '',
    className: attributes.class || '',
    name: attributes.name || '',
    type: attributes.type || '',
    required: attributes.required === 'true',
    placeholder: attributes.placeholder || '',
    textContent,
    getAttribute: vi.fn((attr) => attributes[attr] || null),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    closest: vi.fn(),
    classList: {
      contains: vi.fn((className) => (attributes.class || '').includes(className))
    },
    previousElementSibling: null
  } as unknown as HTMLElement;

  return element;
};

describe('BaseFormDetector', () => {
  let detector: BaseFormDetector;

  beforeEach(() => {
    detector = new BaseFormDetector(DEFAULT_DETECTION_CONFIG);
    vi.clearAllMocks();
  });

  describe('detectForms', () => {
    it('should return empty result when no forms are found', async () => {
      mockDocument.querySelectorAll = vi.fn(() => []);

      const result = await detector.detectForms(mockDocument);

      expect(result.success).toBe(true);
      expect(result.forms).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect a basic job application form', async () => {
      const mockForm = createMockElement('form', { id: 'job-application-form' });
      const mockInputs = [
        createMockElement('input', { type: 'text', name: 'firstName', placeholder: 'First Name', required: 'true' }),
        createMockElement('input', { type: 'email', name: 'email', placeholder: 'Email Address', required: 'true' }),
        createMockElement('input', { type: 'tel', name: 'phone', placeholder: 'Phone Number' }),
        createMockElement('textarea', { name: 'coverLetter', placeholder: 'Cover Letter' }),
        createMockElement('input', { type: 'file', name: 'resume', placeholder: 'Upload Resume' })
      ];

      mockDocument.querySelectorAll = vi.fn((selector) => {
        if (selector === 'form') return [mockForm];
        return [];
      });

      mockForm.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('input, textarea, select')) return mockInputs;
        return [];
      });

      const result = await detector.detectForms(mockDocument);

      expect(result.success).toBe(true);
      expect(result.forms).toHaveLength(1);

      const form = result.forms[0];
      expect(form.platform).toBe('custom');
      expect(form.fields).toHaveLength(5);
      expect(form.confidence).toBeGreaterThan(0.5);
      expect(form.supportedFeatures).toContain('basic_info');
      expect(form.supportedFeatures).toContain('file_upload');
    });

    it('should detect LinkedIn platform correctly', async () => {
      const linkedInDocument = {
        ...mockDocument,
        location: {
          href: 'https://www.linkedin.com/jobs/view/123456789',
          hostname: 'www.linkedin.com'
        }
      } as unknown as Document;

      const mockForm = createMockElement('form', { class: 'jobs-apply-form' });
      const mockInputs = [
        createMockElement('input', { type: 'text', name: 'firstName' }),
        createMockElement('input', { type: 'email', name: 'email' })
      ];

      linkedInDocument.querySelectorAll = vi.fn(() => [mockForm]);
      mockForm.querySelectorAll = vi.fn(() => mockInputs);

      const result = await detector.detectForms(linkedInDocument);

      expect(result.success).toBe(true);
      expect(result.forms[0].platform).toBe('linkedin');
    });

    it('should handle detection errors gracefully', async () => {
      mockDocument.querySelectorAll = vi.fn(() => {
        throw new Error('DOM access error');
      });

      const result = await detector.detectForms(mockDocument);

      expect(result.success).toBe(false);
      expect(result.forms).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DETECTION_FAILED');
    });
  });

  describe('field classification', () => {
    it('should correctly classify different field types', async () => {
      // Use a lower confidence threshold for this test
      const testDetector = new BaseFormDetector({
        ...DEFAULT_DETECTION_CONFIG,
        minConfidenceThreshold: 0.3
      });

      const testDocument = {
        location: { href: 'https://example.com/careers/apply', hostname: 'example.com' },
        title: 'Software Engineer Job Application',
        body: { textContent: 'Apply for this exciting software engineer job position. Submit your resume and cover letter.', className: '' },
        querySelector: vi.fn(),
        querySelectorAll: vi.fn()
      } as unknown as Document;

      const mockInputs = [
        createMockElement('input', { type: 'text', name: 'firstName', placeholder: 'First Name', required: 'true' }),
        createMockElement('input', { type: 'email', name: 'email', placeholder: 'Email Address', required: 'true' }),
        createMockElement('input', { type: 'tel', name: 'phone', placeholder: 'Phone Number', required: 'true' }),
        createMockElement('textarea', { name: 'coverLetter', placeholder: 'Cover Letter' }),
        createMockElement('select', { name: 'country' }),
        createMockElement('input', { type: 'checkbox', name: 'terms' }),
        createMockElement('input', { type: 'file', name: 'resume' })
      ];

      const mockForm = createMockElement('form', { class: 'job-application-form' });
      mockForm.textContent = 'Job Application Form - Apply for this position. Please fill out all required fields and upload your resume.';
      
      // Override the querySelectorAll method to return our mock inputs
      mockForm.querySelectorAll = vi.fn((selector: string) => {
        if (selector.includes('input, textarea, select')) {
          return mockInputs;
        }
        return [];
      });

      testDocument.querySelectorAll = vi.fn((selector) => {
        if (selector === 'form') return [mockForm];
        return [];
      });

      const result = await testDetector.detectForms(testDocument);

      // Debug: log the result to understand what's happening
      console.log('Detection result:', JSON.stringify(result, null, 2));

      expect(result.forms).toHaveLength(1);
      expect(result.forms[0].fields).toHaveLength(7);

      const fields = result.forms[0].fields;
      expect(fields.find(f => f.type === 'text')).toBeDefined();
      expect(fields.find(f => f.type === 'email')).toBeDefined();
      expect(fields.find(f => f.type === 'phone')).toBeDefined();
      expect(fields.find(f => f.type === 'textarea')).toBeDefined();
      expect(fields.find(f => f.type === 'select')).toBeDefined();
      expect(fields.find(f => f.type === 'checkbox')).toBeDefined();
      expect(fields.find(f => f.type === 'file')).toBeDefined();
    });

    it('should map fields to profile data correctly', async () => {
      const mockForm = createMockElement('form');
      const mockInputs = [
        createMockElement('input', { type: 'text', name: 'firstName', placeholder: 'First Name' }),
        createMockElement('input', { type: 'text', name: 'lastName', placeholder: 'Last Name' }),
        createMockElement('input', { type: 'email', name: 'email', placeholder: 'Email Address' }),
        createMockElement('input', { type: 'tel', name: 'phone', placeholder: 'Phone Number' }),
        createMockElement('input', { type: 'file', name: 'resume', placeholder: 'Upload Resume' })
      ];

      mockDocument.querySelectorAll = vi.fn(() => [mockForm]);
      mockForm.querySelectorAll = vi.fn(() => mockInputs);

      const result = await detector.detectForms(mockDocument);

      const fields = result.forms[0].fields;
      expect(fields.find(f => f.mappedProfileField === 'personalInfo.firstName')).toBeDefined();
      expect(fields.find(f => f.mappedProfileField === 'personalInfo.lastName')).toBeDefined();
      expect(fields.find(f => f.mappedProfileField === 'personalInfo.email')).toBeDefined();
      expect(fields.find(f => f.mappedProfileField === 'personalInfo.phone')).toBeDefined();
      expect(fields.find(f => f.mappedProfileField === 'documents.resumes[0]')).toBeDefined();
    });
  });

  describe('confidence scoring', () => {
    it('should assign higher confidence to job-related forms', async () => {
      const jobForm = createMockElement('form', { class: 'job-application-form' });
      jobForm.textContent = 'Apply for this job position. Please fill out your information and upload your resume.';

      const mockInputs = [
        createMockElement('input', { type: 'text', name: 'firstName', required: 'true' }),
        createMockElement('input', { type: 'email', name: 'email', required: 'true' }),
        createMockElement('input', { type: 'file', name: 'resume' }),
        createMockElement('textarea', { name: 'coverLetter' })
      ];

      mockDocument.querySelectorAll = vi.fn(() => [jobForm]);
      jobForm.querySelectorAll = vi.fn(() => mockInputs);

      const result = await detector.detectForms(mockDocument);

      expect(result.forms[0].confidence).toBeGreaterThan(0.7);
    });

    it('should assign lower confidence to non-job forms', async () => {
      // Use a lower confidence threshold detector for this test
      const lowThresholdDetector = new BaseFormDetector({
        ...DEFAULT_DETECTION_CONFIG,
        minConfidenceThreshold: 0.1
      });

      const testDocument = {
        location: { href: 'https://example.com/contact', hostname: 'example.com' },
        title: 'Contact Us',
        body: { textContent: 'Contact us for more information', className: '' },
        querySelector: vi.fn(),
        querySelectorAll: vi.fn()
      } as unknown as Document;

      const contactForm = createMockElement('form', { class: 'contact-form' });
      contactForm.textContent = 'Contact us for more information about our services.';

      const mockInputs = [
        createMockElement('input', { type: 'text', name: 'name' }),
        createMockElement('input', { type: 'email', name: 'email' }),
        createMockElement('textarea', { name: 'message' })
      ];

      testDocument.querySelectorAll = vi.fn((selector) => {
        if (selector === 'form') return [contactForm];
        return [];
      });
      contactForm.querySelectorAll = vi.fn(() => mockInputs);

      const result = await lowThresholdDetector.detectForms(testDocument);

      expect(result.forms).toHaveLength(1);
      expect(result.forms[0].confidence).toBeLessThan(0.7);
    });
  });

  describe('job context extraction', () => {
    it('should extract job context when available', async () => {
      const jobDocument = {
        location: { href: 'https://example.com/jobs/123', hostname: 'example.com' },
        title: 'Senior Software Engineer',
        body: { textContent: 'Apply for this job position', className: '' },
        querySelector: vi.fn((selector) => {
          if (selector.includes('job') || selector.includes('title')) {
            return { textContent: 'Senior Software Engineer' };
          }
          if (selector.includes('company')) {
            return { textContent: 'Tech Corp Inc.' };
          }
          if (selector.includes('description')) {
            return { textContent: 'We are looking for an experienced software engineer...' };
          }
          return null;
        }),
        querySelectorAll: vi.fn()
      } as unknown as Document;

      const mockForm = createMockElement('form', { class: 'job-application-form' });
      mockForm.textContent = 'Apply for this job position';
      const mockInputs = [
        createMockElement('input', { type: 'text', name: 'firstName', required: 'true' }),
        createMockElement('input', { type: 'email', name: 'email', required: 'true' }),
        createMockElement('input', { type: 'file', name: 'resume' })
      ];

      jobDocument.querySelectorAll = vi.fn((selector) => {
        if (selector === 'form') return [mockForm];
        return [];
      });
      mockForm.querySelectorAll = vi.fn(() => mockInputs);

      const result = await detector.detectForms(jobDocument);

      expect(result.forms).toHaveLength(1);
      expect(result.forms[0].jobContext).toBeDefined();
      expect(result.forms[0].jobContext?.jobTitle).toBe('Senior Software Engineer');
      expect(result.forms[0].jobContext?.companyName).toBe('Tech Corp Inc.');
    });
  });

  describe('multi-step form detection', () => {
    it('should detect multi-step forms', async () => {
      const testDocument = {
        location: { href: 'https://example.com/apply', hostname: 'example.com' },
        title: 'Job Application',
        body: { textContent: 'Job Application - Step 1 of 3', className: '' },
        querySelector: vi.fn(),
        querySelectorAll: vi.fn()
      } as unknown as Document;

      const multiStepForm = createMockElement('form', { class: 'job-application-form' });
      multiStepForm.textContent = 'Job Application - Step 1 of 3';
      const stepIndicator = createMockElement('div', { class: 'step-indicator' });
      const nextButton = createMockElement('button', { class: 'btn-next' });

      multiStepForm.querySelector = vi.fn((selector) => {
        if (selector.includes('step') || selector.includes('page')) return stepIndicator;
        if (selector.includes('next') || selector.includes('continue')) return nextButton;
        return null;
      });

      const mockInputs = [
        createMockElement('input', { type: 'text', name: 'firstName', required: 'true' }),
        createMockElement('input', { type: 'email', name: 'email', required: 'true' }),
        createMockElement('input', { type: 'file', name: 'resume' })
      ];

      testDocument.querySelectorAll = vi.fn((selector) => {
        if (selector === 'form') return [multiStepForm];
        return [];
      });
      multiStepForm.querySelectorAll = vi.fn(() => mockInputs);

      const result = await detector.detectForms(testDocument);

      expect(result.forms).toHaveLength(1);
      expect(result.forms[0].isMultiStep).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle malformed DOM gracefully', async () => {
      const testDocument = {
        location: { href: 'https://example.com', hostname: 'example.com' },
        title: 'Test',
        body: { textContent: 'test', className: '' },
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => {
          throw new Error('DOM access error');
        })
      } as unknown as Document;

      const result = await detector.detectForms(testDocument);

      expect(result.success).toBe(false);
      expect(result.forms).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DETECTION_FAILED');
    });

    it('should respect configuration limits', async () => {
      const limitedDetector = new BaseFormDetector({
        ...DEFAULT_DETECTION_CONFIG,
        maxFormsPerPage: 2,
        minConfidenceThreshold: 0.8
      });

      const forms = Array.from({ length: 5 }, (_, i) =>
        createMockElement('form', { id: `form-${i}` })
      );

      forms.forEach(form => {
        form.querySelectorAll = vi.fn(() => [
          createMockElement('input', { type: 'text', name: 'name' })
        ]);
      });

      mockDocument.querySelectorAll = vi.fn(() => forms);

      const result = await limitedDetector.detectForms(mockDocument);

      // Should only process first 2 forms due to maxFormsPerPage limit
      expect(result.forms.length).toBeLessThanOrEqual(2);
    });
  });
});