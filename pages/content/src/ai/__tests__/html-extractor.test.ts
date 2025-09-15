/**
 * Tests for HTML Form Extractor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HTMLExtractor } from '../html-extractor';
import { createMockContainer, cleanupMockContainer, SAMPLE_FORMS } from './test-utils';

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://example.com/job-application'
  },
  writable: true
});

describe('HTMLExtractor', () => {
  let extractor: HTMLExtractor;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    extractor = new HTMLExtractor();
  });

  afterEach(() => {
    if (mockContainer) {
      cleanupMockContainer(mockContainer);
    }
  });

  describe('extractFormHTML', () => {
    it('should extract simple form structure', async () => {
      mockContainer = createMockContainer(SAMPLE_FORMS.simple);

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result).toBeDefined();
      expect(result.html).toContain('form');
      expect(result.html).toContain('input');
      expect(result.hash).toBeDefined();
      expect(result.metadata.formCount).toBe(1);
      expect(result.metadata.fieldCount).toBe(2);
    });

    it('should handle multiple forms', async () => {
      mockContainer = createMockContainer(`
        <form id="form1">
          <input type="text" name="name" />
        </form>
        <form id="form2">
          <input type="email" name="email" />
          <select name="country">
            <option value="us">US</option>
            <option value="ca">Canada</option>
          </select>
        </form>
      `);

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.formCount).toBe(2);
      expect(result.metadata.fieldCount).toBe(3);
      expect(result.html).toContain('data-form-index="0"');
      expect(result.html).toContain('data-form-index="1"');
    });

    it('should handle orphan form fields', async () => {
      mockContainer = createMockContainer(`
        <div class="application-form">
          <input type="text" name="firstName" />
          <input type="text" name="lastName" />
          <textarea name="coverLetter"></textarea>
        </div>
      `);

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.formCount).toBe(1);
      expect(result.metadata.fieldCount).toBe(3);
      expect(result.html).toContain('data-virtual-form="true"');
    });

    it('should throw error when no forms found', async () => {
      mockContainer = createMockContainer(`
        <div>
          <p>No forms here</p>
        </div>
      `);

      await expect(extractor.extractFormHTML(mockContainer)).rejects.toThrow('No forms found');
    });
  });

  describe('sanitizeHTML', () => {
    it('should remove script tags', () => {
      const sanitized = extractor.sanitizeHTML(SAMPLE_FORMS.withMalicious);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('<input');
    });

    it('should remove event handlers', () => {
      const html = `
        <form>
          <input type="text" onclick="malicious()" onchange="bad()" />
          <button onsubmit="evil()">Submit</button>
        </form>
      `;

      const sanitized = extractor.sanitizeHTML(html);

      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('onchange');
      expect(sanitized).not.toContain('onsubmit');
    });

    it('should remove dangerous elements', () => {
      const html = `
        <form>
          <input type="text" name="test" />
          <iframe src="evil.com"></iframe>
          <object data="malicious.swf"></object>
          <embed src="bad.swf" />
          <style>body { display: none; }</style>
        </form>
      `;

      const sanitized = extractor.sanitizeHTML(html);

      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('<object');
      expect(sanitized).not.toContain('<embed');
      expect(sanitized).not.toContain('<style');
      expect(sanitized).toContain('<input');
    });

    it('should remove sensitive attributes', () => {
      const html = `
        <form>
          <input type="text" name="test" data-user-id="123" data-session="abc" />
          <input type="password" data-csrf="token" />
        </form>
      `;

      const sanitized = extractor.sanitizeHTML(html);

      expect(sanitized).not.toContain('data-user-id');
      expect(sanitized).not.toContain('data-session');
      expect(sanitized).not.toContain('data-csrf');
    });

    it('should preserve data attributes when option is set', () => {
      const html = `
        <form>
          <input type="text" name="test" data-validation="required" />
        </form>
      `;

      const sanitized = extractor.sanitizeHTML(html, { preserveDataAttributes: true });

      expect(sanitized).toContain('data-validation');
    });

    it('should normalize whitespace', () => {
      const html = `
        <form>
          
          <input    type="text"     name="test"   />
          
          <button   type="submit">   Submit   </button>
          
        </form>
      `;

      const sanitized = extractor.sanitizeHTML(html);

      expect(sanitized).not.toMatch(/\s{2,}/);
      expect(sanitized).not.toMatch(/>\s+</);
    });
  });

  describe('generateHTMLHash', () => {
    it('should generate consistent hash for same content', () => {
      const html = '<form><input type="text" name="test" /></form>';
      
      const hash1 = extractor.generateHTMLHash(html);
      const hash2 = extractor.generateHTMLHash(html);

      expect(hash1).toBe(hash2);
      expect(hash1).toBeDefined();
      expect(typeof hash1).toBe('string');
    });

    it('should generate different hashes for different content', () => {
      const html1 = '<form><input type="text" name="test1" /></form>';
      const html2 = '<form><input type="text" name="test2" /></form>';
      
      const hash1 = extractor.generateHTMLHash(html1);
      const hash2 = extractor.generateHTMLHash(html2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = extractor.generateHTMLHash('');
      expect(hash).toBe('0');
    });
  });

  describe('form metadata generation', () => {
    it('should correctly count field types', async () => {
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="firstName" />
          <input type="text" name="lastName" />
          <input type="email" name="email" />
          <input type="tel" name="phone" />
          <input type="file" name="resume" />
          <select name="country">
            <option value="us">US</option>
          </select>
          <textarea name="coverLetter"></textarea>
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(7);
      expect(result.metadata.fieldTypes.text).toBe(2);
      expect(result.metadata.fieldTypes.email).toBe(1);
      expect(result.metadata.fieldTypes.tel).toBe(1);
      expect(result.metadata.fieldTypes.file).toBe(1);
      expect(result.metadata.fieldTypes.select).toBe(1);
      expect(result.metadata.fieldTypes.textarea).toBe(1);
      expect(result.metadata.hasFileUploads).toBe(true);
    });

    it('should detect multi-step forms', async () => {
      mockContainer.innerHTML = `
        <form>
          <div class="step-1">
            <input type="text" name="firstName" />
          </div>
          <div class="step-2">
            <input type="email" name="email" />
          </div>
          <div class="progress-bar">
            <div class="step active">1</div>
            <div class="step">2</div>
          </div>
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.hasMultiStep).toBe(true);
    });

    it('should estimate complexity correctly', async () => {
      // Low complexity form
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="name" />
          <input type="email" name="email" />
        </form>
      `;

      let result = await extractor.extractFormHTML(mockContainer);
      expect(result.metadata.estimatedComplexity).toBe('low');

      // High complexity form
      mockContainer.innerHTML = `
        <form class="wizard">
          <div class="step-1">
            <input type="text" name="firstName" />
            <input type="text" name="lastName" />
            <input type="email" name="email" />
            <input type="tel" name="phone" />
            <input type="date" name="birthDate" />
            <input type="file" name="resume" />
            <input type="file" name="coverLetter" />
            <select name="country"><option>US</option></select>
            <select name="state"><option>CA</option></select>
            <textarea name="experience"></textarea>
            <input type="checkbox" name="terms" />
            <input type="radio" name="gender" value="m" />
            <input type="radio" name="gender" value="f" />
          </div>
        </form>
      `;

      result = await extractor.extractFormHTML(mockContainer);
      expect(result.metadata.estimatedComplexity).toBe('high');
    });

    it('should include correct metadata fields', async () => {
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="test" />
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.url).toBe('https://example.com/job-application');
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
      expect(result.metadata.formCount).toBeDefined();
      expect(result.metadata.fieldCount).toBeDefined();
      expect(result.metadata.fieldTypes).toBeDefined();
      expect(typeof result.metadata.hasFileUploads).toBe('boolean');
      expect(typeof result.metadata.hasMultiStep).toBe('boolean');
      expect(['low', 'medium', 'high']).toContain(result.metadata.estimatedComplexity);
    });
  });

  describe('edge cases', () => {
    it('should handle forms with no fields', async () => {
      mockContainer.innerHTML = `
        <form>
          <div>Just text content</div>
          <p>No input fields</p>
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(0);
      expect(result.metadata.estimatedComplexity).toBe('low');
    });

    it('should handle deeply nested form structures', async () => {
      mockContainer.innerHTML = `
        <form>
          <div>
            <div>
              <div>
                <div>
                  <input type="text" name="deepField" />
                </div>
              </div>
            </div>
          </div>
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(1);
      expect(result.html).toContain('deepField');
    });

    it('should handle forms with special characters in names', async () => {
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="field[0]" />
          <input type="text" name="user.firstName" />
          <input type="text" name="data-field-name" />
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(3);
      expect(result.html).toContain('field[0]');
      expect(result.html).toContain('user.firstName');
    });

    it('should handle forms with duplicate names', async () => {
      mockContainer.innerHTML = `
        <form>
          <input type="radio" name="choice" value="a" />
          <input type="radio" name="choice" value="b" />
          <input type="checkbox" name="options" value="1" />
          <input type="checkbox" name="options" value="2" />
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(4);
      expect(result.metadata.fieldTypes.radio).toBe(2);
      expect(result.metadata.fieldTypes.checkbox).toBe(2);
    });

    it('should handle malformed HTML gracefully', async () => {
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="test" unclosed-attribute="value
          <div>
            <input type="email" name="email" />
          </div>
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBeGreaterThan(0);
      expect(result.html).toBeDefined();
    });
  });

  describe('custom sanitizers', () => {
    it('should apply custom sanitizers', () => {
      const html = `
        <form>
          <input type="text" name="test" class="remove-me" />
          <input type="email" name="email" class="keep-me" />
        </form>
      `;

      const customSanitizer = (element: Element) => {
        if (element.classList.contains('remove-me')) {
          element.removeAttribute('class');
        }
      };

      const sanitized = extractor.sanitizeHTML(html, { 
        customSanitizers: [customSanitizer] 
      });

      expect(sanitized).not.toContain('remove-me');
      expect(sanitized).toContain('keep-me');
    });
  });
});