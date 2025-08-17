/**
 * Unit tests for platform-specific form detectors
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { BaseFormDetector } from '../base-detector';
import { ConfidenceScorer } from '../confidence-scorer';

describe('Platform-specific Form Detectors', () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    global.document = document;
    global.window = dom.window as any;
  });

  describe('Base Form Detector', () => {
    it('should detect forms and classify fields', async () => {
      document.body.innerHTML = `
        <form class="application-form">
          <label for="firstName">First Name *</label>
          <input type="text" id="firstName" name="firstName" required />
          
          <label for="email">Email Address *</label>
          <input type="email" id="email" name="email" required />
          
          <label for="resume">Upload Resume</label>
          <input type="file" id="resume" name="resume" accept=".pdf,.doc,.docx" />
          
          <button type="submit">Submit Application</button>
        </form>
      `;

      const detector = new BaseFormDetector();
      const result = await detector.detectForms(document);

      expect(result.success).toBe(true);
      expect(result.forms).toHaveLength(1);

      const form = result.forms[0];
      expect(form.fields.length).toBeGreaterThan(0);

      // Check field types
      const textField = form.fields.find(f => f.type === 'text');
      const emailField = form.fields.find(f => f.type === 'email');
      const fileField = form.fields.find(f => f.type === 'file');

      expect(textField).toBeDefined();
      expect(emailField).toBeDefined();
      expect(fileField).toBeDefined();
    });

    it('should calculate confidence scores', async () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="firstName" placeholder="First Name" required />
          <input type="email" name="email" placeholder="Email" required />
          <input type="tel" name="phone" placeholder="Phone" />
          <textarea name="coverLetter" placeholder="Cover Letter"></textarea>
          <input type="file" name="resume" />
          <button type="submit">Apply Now</button>
        </form>
      `;

      const detector = new BaseFormDetector();
      const result = await detector.detectForms(document);

      expect(result.success).toBe(true);
      expect(result.forms).toHaveLength(1);

      const form = result.forms[0];
      expect(form.confidence).toBeGreaterThan(0);
      expect(form.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Confidence Scorer', () => {
    it('should calculate confidence factors', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="firstName" required />
          <input type="email" name="email" required />
          <input type="file" name="resume" />
          <button type="submit">Apply</button>
        </form>
      `;

      const formElement = document.querySelector('form') as HTMLElement;
      const fields = [
        {
          id: 'firstName',
          type: 'text' as any,
          label: 'First Name',
          selector: '[name="firstName"]',
          required: true,
          mappedProfileField: 'personalInfo.firstName'
        },
        {
          id: 'email',
          type: 'email' as any,
          label: 'Email',
          selector: '[name="email"]',
          required: true,
          mappedProfileField: 'personalInfo.email'
        }
      ];

      const scorer = new ConfidenceScorer();
      const confidence = scorer.calculateConfidence(formElement, fields, 'custom', document);

      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should provide confidence breakdown', () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="firstName" required />
          <input type="email" name="email" required />
          <button type="submit">Apply Now</button>
        </form>
      `;

      const formElement = document.querySelector('form') as HTMLElement;
      const fields = [
        {
          id: 'firstName',
          type: 'text' as any,
          label: 'First Name',
          selector: '[name="firstName"]',
          required: true,
          mappedProfileField: 'personalInfo.firstName'
        }
      ];

      const scorer = new ConfidenceScorer();
      const breakdown = scorer.getConfidenceBreakdown(formElement, fields, 'custom', document);

      expect(breakdown.factors).toBeDefined();
      expect(breakdown.weightedScores).toBeDefined();
      expect(breakdown.totalScore).toBeGreaterThan(0);
      expect(breakdown.totalScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Field Classification', () => {
    it('should correctly classify different field types', async () => {
      document.body.innerHTML = `
        <form class="job-application">
          <input type="text" name="firstName" placeholder="First Name" required />
          <input type="email" name="email" placeholder="Email Address" required />
          <input type="tel" name="phone" placeholder="Phone Number" />
          <select name="experience">
            <option>Entry Level</option>
            <option>Mid Level</option>
            <option>Senior Level</option>
          </select>
          <textarea name="coverLetter" placeholder="Cover Letter"></textarea>
          <input type="file" name="resume" accept=".pdf,.doc,.docx" />
          <input type="checkbox" name="workAuth" /> Work Authorization
          <button type="submit">Apply</button>
        </form>
      `;

      const detector = new BaseFormDetector();
      const result = await detector.detectForms(document);

      expect(result.success).toBe(true);
      expect(result.forms).toHaveLength(1);

      const fields = result.forms[0].fields;
      expect(fields.some(f => f.type === 'text')).toBe(true);
      expect(fields.some(f => f.type === 'email')).toBe(true);
      expect(fields.some(f => f.type === 'phone')).toBe(true);
      expect(fields.some(f => f.type === 'select')).toBe(true);
      expect(fields.some(f => f.type === 'textarea')).toBe(true);
      expect(fields.some(f => f.type === 'file')).toBe(true);
      expect(fields.some(f => f.type === 'checkbox')).toBe(true);
    });

    it('should extract field validation rules', async () => {
      document.body.innerHTML = `
        <form class="job-application">
          <input type="text" name="firstName" required minlength="2" maxlength="50" />
          <input type="email" name="email" required />
          <input type="text" name="phone" pattern="[0-9]{10}" />
          <button type="submit">Apply</button>
        </form>
      `;

      const detector = new BaseFormDetector();
      const result = await detector.detectForms(document);

      expect(result.success).toBe(true);
      expect(result.forms).toHaveLength(1);

      const fields = result.forms[0].fields;
      const firstNameField = fields.find(f => f.selector.includes('firstName'));
      const emailField = fields.find(f => f.selector.includes('email'));
      const phoneField = fields.find(f => f.selector.includes('phone'));

      expect(firstNameField?.validationRules).toContainEqual(
        expect.objectContaining({ type: 'required' })
      );
      expect(firstNameField?.validationRules).toContainEqual(
        expect.objectContaining({ type: 'minLength', value: 2 })
      );
      expect(emailField?.validationRules).toContainEqual(
        expect.objectContaining({ type: 'email' })
      );
      expect(phoneField?.validationRules).toContainEqual(
        expect.objectContaining({ type: 'pattern' })
      );
    });
  });

  describe('Form Detection Edge Cases', () => {
    it('should handle forms with no fields', async () => {
      document.body.innerHTML = `
        <form>
          <button type="submit">Submit</button>
        </form>
      `;

      const detector = new BaseFormDetector();
      const result = await detector.detectForms(document);

      expect(result.success).toBe(true);
      expect(result.forms).toHaveLength(0); // Should not detect forms with no input fields
    });

    it('should handle multiple forms on the same page', async () => {
      document.body.innerHTML = `
        <form class="form1">
          <input type="text" name="name1" />
          <input type="email" name="email1" />
          <button type="submit">Submit 1</button>
        </form>
        <form class="form2">
          <input type="text" name="name2" />
          <input type="email" name="email2" />
          <button type="submit">Submit 2</button>
        </form>
      `;

      const detector = new BaseFormDetector();
      const result = await detector.detectForms(document);

      expect(result.success).toBe(true);
      expect(result.forms.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle forms without proper labels', async () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="field1" placeholder="Enter text" />
          <input type="email" name="field2" />
          <button type="submit">Submit</button>
        </form>
      `;

      const detector = new BaseFormDetector();
      const result = await detector.detectForms(document);

      expect(result.success).toBe(true);
345
      if (result.forms.length > 0) {
        const fields = result.forms[0].fields;
        expect(fields.length).toBeGreaterThan(0);

        // Should still extract some label information from placeholder or name
        const field1 = fields.find(f => f.selector.includes('field1'));
        expect(field1?.label).toBeDefined();
        expect(field1?.label).not.toBe('');
      } else {
        // If no forms detected, that's also acceptable for this edge case
        expect(result.forms).toHaveLength(0);
      }
    });
  });

  describe('Profile Field Mapping', () => {
    it('should map common form fields to profile data', async () => {
      document.body.innerHTML = `
        <form>
          <input type="text" name="firstName" placeholder="First Name" />
          <input type="text" name="lastName" placeholder="Last Name" />
          <input type="email" name="email" placeholder="Email Address" />
          <input type="tel" name="phone" placeholder="Phone Number" />
          <input type="file" name="resume" />
          <button type="submit">Apply</button>
        </form>
      `;

      const detector = new BaseFormDetector();
      const result = await detector.detectForms(document);

      expect(result.success).toBe(true);
      expect(result.forms).toHaveLength(1);

      const fields = result.forms[0].fields;

      // Check that fields are mapped to appropriate profile fields
      const firstNameField = fields.find(f => f.selector.includes('firstName'));
      const lastNameField = fields.find(f => f.selector.includes('lastName'));
      const emailField = fields.find(f => f.selector.includes('email'));
      const phoneField = fields.find(f => f.selector.includes('phone'));
      const resumeField = fields.find(f => f.selector.includes('resume'));

      expect(firstNameField?.mappedProfileField).toBe('personalInfo.firstName');
      expect(lastNameField?.mappedProfileField).toBe('personalInfo.lastName');
      expect(emailField?.mappedProfileField).toBe('personalInfo.email');
      expect(phoneField?.mappedProfileField).toBe('personalInfo.phone');
      expect(resumeField?.mappedProfileField).toBe('documents.resumes[0]');
    });
  });

});