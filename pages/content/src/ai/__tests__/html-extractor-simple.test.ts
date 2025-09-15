/**
 * Simple test to verify HTML Extractor basic functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HTMLExtractor } from '../html-extractor';

describe('HTMLExtractor Basic Tests', () => {
  let extractor: HTMLExtractor;

  beforeEach(() => {
    extractor = new HTMLExtractor();
  });

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

  it('should sanitize HTML by removing scripts', () => {
    const html = '<form><input type="text" /><script>alert("xss")</script></form>';
    const sanitized = extractor.sanitizeHTML(html);
    
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('alert');
    expect(sanitized).toContain('<input');
  });
});