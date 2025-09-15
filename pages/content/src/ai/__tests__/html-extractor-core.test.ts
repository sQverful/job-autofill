/**
 * Core tests for HTML Form Extractor
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HTMLExtractor } from '../html-extractor';

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'https://example.com/job-application'
  },
  writable: true
});

describe('HTMLExtractor Core Functionality', () => {
  let extractor: HTMLExtractor;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    extractor = new HTMLExtractor();
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);
  });

  afterEach(() => {
    if (mockContainer && mockContainer.parentNode) {
      mockContainer.parentNode.removeChild(mockContainer);
    }
  });

  describe('Basic functionality', () => {
    it('should create HTMLExtractor instance', () => {
      expect(extractor).toBeDefined();
      expect(extractor).toBeInstanceOf(HTMLExtractor);
    });

    it('should generate hash for HTML content', () => {
      const html = '<form><input type="text" name="test" /></form>';
      const hash = extractor.generateHTMLHash(html);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate consistent hashes', () => {
      const html = '<form><input type="text" name="test" /></form>';
      const hash1 = extractor.generateHTMLHash(html);
      const hash2 = extractor.generateHTMLHash(html);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const html1 = '<form><input type="text" name="test1" /></form>';
      const html2 = '<form><input type="text" name="test2" /></form>';
      
      const hash1 = extractor.generateHTMLHash(html1);
      const hash2 = extractor.generateHTMLHash(html2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('HTML sanitization', () => {
    it('should remove script tags', () => {
      const html = '<form><input type="text" /><script>alert("xss")</script></form>';
      const sanitized = extractor.sanitizeHTML(html);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('<input');
    });

    it('should remove event handlers', () => {
      const html = '<form><input type="text" onclick="bad()" onchange="evil()" /></form>';
      const sanitized = extractor.sanitizeHTML(html);
      
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('onchange');
      expect(sanitized).toContain('<input');
    });

    it('should remove dangerous elements', () => {
      const html = '<form><input type="text" /><iframe src="evil.com"></iframe><object data="bad.swf"></object></form>';
      const sanitized = extractor.sanitizeHTML(html);
      
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('<object');
      expect(sanitized).toContain('<input');
    });

    it('should normalize whitespace', () => {
      const html = '<form>   <input    type="text"     />   </form>';
      const sanitized = extractor.sanitizeHTML(html);
      
      expect(sanitized).not.toMatch(/\s{2,}/);
    });
  });

  describe('Form extraction', () => {
    it('should extract simple form', async () => {
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="firstName" />
          <input type="email" name="email" />
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result).toBeDefined();
      expect(result.html).toContain('form');
      expect(result.hash).toBeDefined();
      expect(result.metadata.formCount).toBe(1);
      expect(result.metadata.fieldCount).toBe(2);
      expect(result.metadata.url).toBe('https://example.com/job-application');
    });

    it('should handle forms with file uploads', async () => {
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="name" />
          <input type="file" name="resume" />
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.hasFileUploads).toBe(true);
      expect(result.metadata.fieldTypes.file).toBe(1);
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
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.hasMultiStep).toBe(true);
    });

    it('should estimate form complexity', async () => {
      // Simple form - low complexity
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="name" />
          <input type="email" name="email" />
        </form>
      `;

      let result = await extractor.extractFormHTML(mockContainer);
      expect(result.metadata.estimatedComplexity).toBe('low');

      // Complex form - high complexity
      mockContainer.innerHTML = `
        <form class="wizard">
          <input type="text" name="field1" />
          <input type="text" name="field2" />
          <input type="email" name="field3" />
          <input type="tel" name="field4" />
          <input type="date" name="field5" />
          <input type="file" name="field6" />
          <select name="field7"><option>test</option></select>
          <textarea name="field8"></textarea>
          <input type="checkbox" name="field9" />
          <input type="radio" name="field10" />
        </form>
      `;

      result = await extractor.extractFormHTML(mockContainer);
      expect(result.metadata.estimatedComplexity).toBe('high');
    });

    it('should throw error when no forms found', async () => {
      mockContainer.innerHTML = '<div><p>No forms here</p></div>';

      await expect(extractor.extractFormHTML(mockContainer)).rejects.toThrow('No forms found');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty forms', async () => {
      mockContainer.innerHTML = '<form></form>';

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(0);
      expect(result.metadata.estimatedComplexity).toBe('low');
    });

    it('should handle orphan form fields', async () => {
      mockContainer.innerHTML = `
        <div class="form-container">
          <input type="text" name="firstName" />
          <input type="email" name="email" />
        </div>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.formCount).toBe(1);
      expect(result.metadata.fieldCount).toBe(2);
      expect(result.html).toContain('data-virtual-form="true"');
    });

    it('should handle forms with special characters in names', async () => {
      mockContainer.innerHTML = `
        <form>
          <input type="text" name="field[0]" />
          <input type="text" name="user.firstName" />
        </form>
      `;

      const result = await extractor.extractFormHTML(mockContainer);

      expect(result.metadata.fieldCount).toBe(2);
      expect(result.html).toContain('field[0]');
      expect(result.html).toContain('user.firstName');
    });
  });
});