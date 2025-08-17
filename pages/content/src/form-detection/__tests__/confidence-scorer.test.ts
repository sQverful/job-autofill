/**
 * Unit tests for ConfidenceScorer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfidenceScorer, DEFAULT_SCORING_WEIGHTS } from '../confidence-scorer';
import type { FormField, JobPlatform } from '@extension/shared/lib/types/form-detection';

// Mock HTML elements
const createMockElement = (tagName: string, attributes: Record<string, string> = {}, textContent = ''): HTMLElement => {
  return {
    tagName: tagName.toUpperCase(),
    textContent,
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    className: attributes.class || '',
    classList: {
      contains: vi.fn((className) => (attributes.class || '').includes(className))
    }
  } as unknown as HTMLElement;
};

const createMockDocument = (url: string, hostname: string, title = '', bodyText = ''): Document => {
  return {
    location: { href: url, hostname },
    title,
    body: { 
      textContent: bodyText,
      className: ''
    },
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => [])
  } as unknown as Document;
};

const createMockFields = (fieldConfigs: Array<{ type: string; label: string; required?: boolean; mappedProfileField?: string }>): FormField[] => {
  return fieldConfigs.map((config, index) => ({
    id: `field_${index}`,
    type: config.type as any,
    label: config.label,
    selector: `#field_${index}`,
    required: config.required || false,
    mappedProfileField: config.mappedProfileField
  }));
};

describe('ConfidenceScorer', () => {
  let scorer: ConfidenceScorer;

  beforeEach(() => {
    scorer = new ConfidenceScorer(DEFAULT_SCORING_WEIGHTS);
  });

  describe('calculateConfidence', () => {
    it('should return higher confidence for LinkedIn job forms', () => {
      const formElement = createMockElement('form', {}, 'Apply for this position');
      const fields = createMockFields([
        { type: 'text', label: 'First Name', required: true, mappedProfileField: 'personalInfo.firstName' },
        { type: 'email', label: 'Email', required: true, mappedProfileField: 'personalInfo.email' },
        { type: 'file', label: 'Resume', mappedProfileField: 'documents.resumes[0]' }
      ]);
      const document = createMockDocument(
        'https://www.linkedin.com/jobs/view/123456789',
        'www.linkedin.com',
        'Software Engineer - LinkedIn',
        'Apply for this exciting software engineer position'
      );

      const confidence = scorer.calculateConfidence(formElement, fields, 'linkedin', document);

      expect(confidence).toBeGreaterThan(0.75);
    });

    it('should return lower confidence for non-job forms', () => {
      const formElement = createMockElement('form', {}, 'Contact us');
      const fields = createMockFields([
        { type: 'text', label: 'Name' },
        { type: 'email', label: 'Email' },
        { type: 'textarea', label: 'Message' }
      ]);
      const document = createMockDocument(
        'https://example.com/contact',
        'example.com',
        'Contact Us',
        'Get in touch with our team'
      );

      const confidence = scorer.calculateConfidence(formElement, fields, 'custom', document);

      expect(confidence).toBeLessThan(0.6);
    });

    it('should handle empty fields gracefully', () => {
      const formElement = createMockElement('form');
      const fields: FormField[] = [];
      const document = createMockDocument('https://example.com', 'example.com');

      const confidence = scorer.calculateConfidence(formElement, fields, 'custom', document);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('scorePlatformMatch', () => {
    it('should give perfect score for LinkedIn job pages', () => {
      const document = createMockDocument(
        'https://www.linkedin.com/jobs/view/123456789',
        'www.linkedin.com'
      );

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        [],
        'linkedin',
        document
      );

      expect(factors.platformMatch).toBe(1.0);
    });

    it('should give high score for Indeed application pages', () => {
      const document = createMockDocument(
        'https://www.indeed.com/viewjob?jk=123456789&tk=apply',
        'www.indeed.com'
      );

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        [],
        'indeed',
        document
      );

      expect(factors.platformMatch).toBe(1.0);
    });

    it('should detect Workday platforms', () => {
      const document = createMockDocument(
        'https://company.wd1.myworkdayjobs.com/careers',
        'company.wd1.myworkdayjobs.com'
      );

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        [],
        'workday',
        document
      );

      expect(factors.platformMatch).toBe(1.0);
    });

    it('should give lower score for custom platforms without job indicators', () => {
      const document = createMockDocument(
        'https://example.com/contact',
        'example.com'
      );

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        [],
        'custom',
        document
      );

      expect(factors.platformMatch).toBe(0.3);
    });
  });

  describe('scoreFieldCount', () => {
    it('should score field count appropriately', () => {
      const testCases = [
        { count: 2, expectedRange: [0, 0.3] },
        { count: 4, expectedRange: [0.3, 0.6] },
        { count: 8, expectedRange: [0.6, 0.9] },
        { count: 15, expectedRange: [0.9, 1.0] },
        { count: 25, expectedRange: [1.0, 1.0] }
      ];

      testCases.forEach(({ count, expectedRange }) => {
        const fields = Array.from({ length: count }, (_, i) => ({
          id: `field_${i}`,
          type: 'text' as any,
          label: `Field ${i}`,
          selector: `#field_${i}`,
          required: false
        }));

        const factors = scorer.calculateConfidenceFactors(
          createMockElement('form'),
          fields,
          'custom',
          createMockDocument('https://example.com', 'example.com')
        );

        expect(factors.fieldCount).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(factors.fieldCount).toBeLessThanOrEqual(expectedRange[1]);
      });
    });
  });

  describe('scoreRequiredFields', () => {
    it('should prefer forms with 30-70% required fields', () => {
      const fields = createMockFields([
        { type: 'text', label: 'Name', required: true },
        { type: 'email', label: 'Email', required: true },
        { type: 'phone', label: 'Phone', required: false },
        { type: 'textarea', label: 'Message', required: false },
        { type: 'file', label: 'Resume', required: true }
      ]);

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        fields,
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      // 3 out of 5 fields are required (60%)
      expect(factors.requiredFields).toBe(1.0);
    });

    it('should penalize forms with too few or too many required fields', () => {
      const allRequiredFields = createMockFields([
        { type: 'text', label: 'Name', required: true },
        { type: 'email', label: 'Email', required: true },
        { type: 'phone', label: 'Phone', required: true },
        { type: 'textarea', label: 'Message', required: true }
      ]);

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        allRequiredFields,
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      expect(factors.requiredFields).toBeLessThan(1.0);
    });
  });

  describe('scoreProfileMapping', () => {
    it('should give high scores for well-mapped fields', () => {
      const fields = createMockFields([
        { type: 'text', label: 'First Name', mappedProfileField: 'personalInfo.firstName' },
        { type: 'text', label: 'Last Name', mappedProfileField: 'personalInfo.lastName' },
        { type: 'email', label: 'Email', mappedProfileField: 'personalInfo.email' },
        { type: 'phone', label: 'Phone', mappedProfileField: 'personalInfo.phone' }
      ]);

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        fields,
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      expect(factors.profileMapping).toBe(1.0);
    });

    it('should give low scores for poorly mapped fields', () => {
      const fields = createMockFields([
        { type: 'text', label: 'Random Field 1' },
        { type: 'text', label: 'Random Field 2' },
        { type: 'text', label: 'Random Field 3' }
      ]);

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        fields,
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      expect(factors.profileMapping).toBe(0.2);
    });
  });

  describe('scoreJobKeywords', () => {
    it('should give high scores for job-related content', () => {
      const formElement = createMockElement('form', {}, 'Job Application Form - Apply Now');
      const document = createMockDocument(
        'https://example.com/careers',
        'example.com',
        'Software Engineer Position',
        'We are hiring a software engineer. Please submit your application with resume and cover letter.'
      );

      const factors = scorer.calculateConfidenceFactors(
        formElement,
        [],
        'custom',
        document
      );

      expect(factors.jobKeywords).toBeGreaterThan(0.5);
    });

    it('should give low scores for non-job content', () => {
      const formElement = createMockElement('form', {}, 'Newsletter Signup');
      const document = createMockDocument(
        'https://example.com/newsletter',
        'example.com',
        'Subscribe to our Newsletter',
        'Get the latest updates and news from our company.'
      );

      const factors = scorer.calculateConfidenceFactors(
        formElement,
        [],
        'custom',
        document
      );

      expect(factors.jobKeywords).toBeLessThan(0.3);
    });
  });

  describe('scoreFormStructure', () => {
    it('should give high scores for well-structured forms', () => {
      const formElement = createMockElement('form');
      formElement.querySelector = vi.fn((selector) => {
        if (selector.includes('fieldset') || selector.includes('section')) {
          return createMockElement('fieldset');
        }
        if (selector.includes('submit')) {
          return createMockElement('button', { type: 'submit' });
        }
        if (selector.includes('required') || selector.includes('pattern')) {
          return createMockElement('input', { required: 'true' });
        }
        return null;
      });

      formElement.querySelectorAll = vi.fn((selector) => {
        if (selector.includes('input, textarea, select')) {
          return [createMockElement('input'), createMockElement('input')];
        }
        if (selector.includes('label')) {
          return [createMockElement('label'), createMockElement('label')];
        }
        return [];
      });

      const factors = scorer.calculateConfidenceFactors(
        formElement,
        [],
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      expect(factors.formStructure).toBeGreaterThan(0.8);
    });
  });

  describe('scoreFieldTypes', () => {
    it('should prefer diverse field types', () => {
      const diverseFields = createMockFields([
        { type: 'text', label: 'Name' },
        { type: 'email', label: 'Email' },
        { type: 'phone', label: 'Phone' },
        { type: 'textarea', label: 'Message' },
        { type: 'select', label: 'Country' },
        { type: 'file', label: 'Resume' }
      ]);

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        diverseFields,
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      expect(factors.fieldTypes).toBe(1.0);
    });

    it('should penalize forms with limited field types', () => {
      const limitedFields = createMockFields([
        { type: 'text', label: 'Field 1' },
        { type: 'text', label: 'Field 2' },
        { type: 'text', label: 'Field 3' }
      ]);

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        limitedFields,
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      expect(factors.fieldTypes).toBeLessThan(0.6);
    });
  });

  describe('scoreLabelQuality', () => {
    it('should give high scores for descriptive labels', () => {
      const qualityFields = createMockFields([
        { type: 'text', label: 'First Name' },
        { type: 'text', label: 'Last Name' },
        { type: 'email', label: 'Email Address' },
        { type: 'phone', label: 'Phone Number' }
      ]);

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        qualityFields,
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      expect(factors.labelQuality).toBeGreaterThan(0.8);
    });

    it('should give low scores for poor quality labels', () => {
      const poorFields = createMockFields([
        { type: 'text', label: 'Unknown Field' },
        { type: 'text', label: '' },
        { type: 'text', label: 'a' },
        { type: 'text', label: 'b' }
      ]);

      const factors = scorer.calculateConfidenceFactors(
        createMockElement('form'),
        poorFields,
        'custom',
        createMockDocument('https://example.com', 'example.com')
      );

      expect(factors.labelQuality).toBeLessThan(0.5);
    });
  });

  describe('getConfidenceBreakdown', () => {
    it('should provide detailed breakdown of confidence factors', () => {
      const formElement = createMockElement('form', {}, 'Job Application');
      const fields = createMockFields([
        { type: 'text', label: 'First Name', required: true, mappedProfileField: 'personalInfo.firstName' },
        { type: 'email', label: 'Email', required: true, mappedProfileField: 'personalInfo.email' }
      ]);
      const document = createMockDocument(
        'https://www.linkedin.com/jobs/apply',
        'www.linkedin.com',
        'Software Engineer Job',
        'Apply for this software engineer position'
      );

      const breakdown = scorer.getConfidenceBreakdown(formElement, fields, 'linkedin', document);

      expect(breakdown.factors).toBeDefined();
      expect(breakdown.weightedScores).toBeDefined();
      expect(breakdown.totalScore).toBeGreaterThanOrEqual(0);
      expect(breakdown.totalScore).toBeLessThanOrEqual(1);

      // Check that all factor keys are present
      const expectedFactors = [
        'platformMatch', 'fieldCount', 'requiredFields', 'profileMapping',
        'jobKeywords', 'formStructure', 'fieldTypes', 'labelQuality'
      ];
      expectedFactors.forEach(factor => {
        expect(breakdown.factors).toHaveProperty(factor);
        expect(breakdown.weightedScores).toHaveProperty(factor);
      });
    });
  });

  describe('custom scoring weights', () => {
    it('should respect custom scoring weights', () => {
      const customWeights = {
        ...DEFAULT_SCORING_WEIGHTS,
        platformMatch: 0.5, // Increase platform weight
        fieldCount: 0.1     // Decrease field count weight
      };

      const customScorer = new ConfidenceScorer(customWeights);
      
      const formElement = createMockElement('form');
      const fields = createMockFields([{ type: 'text', label: 'Name' }]);
      const linkedinDoc = createMockDocument(
        'https://www.linkedin.com/jobs/apply',
        'www.linkedin.com'
      );

      const breakdown = customScorer.getConfidenceBreakdown(formElement, fields, 'linkedin', linkedinDoc);

      expect(breakdown.weightedScores.platformMatch).toBeGreaterThan(
        breakdown.weightedScores.fieldCount
      );
    });
  });
});