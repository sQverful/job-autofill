/**
 * Tests for Safe Selector Utility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  SelectorValidator, 
  SafeQuerySelector, 
  safeQuerySelector, 
  safeQuerySelectorAll,
  createSafeQuerySelector 
} from '../safe-selector';

// Mock DOM methods
const mockQuerySelector = vi.fn();
const mockQuerySelectorAll = vi.fn();

// Mock document
const mockDocument = {
  querySelector: mockQuerySelector,
  querySelectorAll: mockQuerySelectorAll,
  createDocumentFragment: () => ({
    querySelector: vi.fn()
  })
} as any;

// Mock console methods
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});

// Replace global document
global.document = mockDocument;

describe('SelectorValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateSelector', () => {
    it('should validate valid selectors', () => {
      const result = SelectorValidator.validateSelector('.valid-class');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty selectors', () => {
      const result = SelectorValidator.validateSelector('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject null/undefined selectors', () => {
      const result1 = SelectorValidator.validateSelector(null as any);
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('non-empty string');

      const result2 = SelectorValidator.validateSelector(undefined as any);
      expect(result2.isValid).toBe(false);
      expect(result2.error).toContain('non-empty string');
    });

    it('should reject whitespace-only selectors', () => {
      const result = SelectorValidator.validateSelector('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('empty or whitespace');
    });

    it('should handle numeric ID selectors', () => {
      const result = SelectorValidator.validateSelector('#123');
      expect(result.isValid).toBe(false);
      expect(result.sanitizedSelector).toBe('[id="123"]');
      expect(result.error).toContain('cannot start with a number');
      expect(result.suggestion).toContain('[id="123"]');
    });

    it('should handle complex numeric ID selectors', () => {
      const result = SelectorValidator.validateSelector('#627abc');
      expect(result.isValid).toBe(false);
      expect(result.sanitizedSelector).toBe('[id="627abc"]');
    });

    it('should handle CSS syntax errors', () => {
      // Mock querySelector to throw an error
      const mockFragment = {
        querySelector: vi.fn().mockImplementation(() => {
          throw new Error('Invalid selector syntax');
        })
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);

      const result = SelectorValidator.validateSelector('invalid[selector');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid CSS selector syntax');
    });
  });

  describe('sanitizeSelector', () => {
    it('should sanitize numeric ID selectors', () => {
      const result = SelectorValidator.sanitizeSelector('#123');
      expect(result).toBe('[id="123"]');
    });

    it('should leave valid selectors unchanged', () => {
      const selector = '.valid-class';
      const result = SelectorValidator.sanitizeSelector(selector);
      expect(result).toBe(selector);
    });
  });

  describe('isValidCSSSelector', () => {
    it('should return true for valid selectors', () => {
      // Mock successful validation
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error thrown = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      const result = SelectorValidator.isValidCSSSelector('.valid');
      expect(result).toBe(true);
    });

    it('should return false for invalid selectors', () => {
      const result = SelectorValidator.isValidCSSSelector('#123');
      expect(result).toBe(false);
    });
  });
});

describe('SafeQuerySelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SafeQuerySelector.resetErrorCount();
    mockQuerySelector.mockReturnValue(null);
    mockQuerySelectorAll.mockReturnValue([]);
  });

  describe('querySelector', () => {
    it('should call document.querySelector for valid selectors', () => {
      // Mock successful validation
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      const mockElement = { tagName: 'DIV' };
      mockQuerySelector.mockReturnValue(mockElement);

      const result = SafeQuerySelector.querySelector('.valid');
      
      expect(mockQuerySelector).toHaveBeenCalledWith('.valid');
      expect(result).toBe(mockElement);
    });

    it('should handle invalid selectors gracefully', () => {
      const result = SafeQuerySelector.querySelector('#123');
      
      expect(result).toBeNull();
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('should try sanitized selector for invalid selectors', () => {
      // Mock validation for sanitized selector
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      const mockElement = { tagName: 'DIV' };
      mockQuerySelector.mockReturnValue(mockElement);

      const result = SafeQuerySelector.querySelector('#123');
      
      // Should try the sanitized version
      expect(mockQuerySelector).toHaveBeenCalledWith('[id="123"]');
      expect(result).toBe(mockElement);
    });

    it('should handle querySelector exceptions', () => {
      // Mock successful validation
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      mockQuerySelector.mockImplementation(() => {
        throw new Error('DOM Exception');
      });

      const result = SafeQuerySelector.querySelector('.valid');
      
      expect(result).toBeNull();
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should respect logErrors option', () => {
      SafeQuerySelector.querySelector('#123', document, { logErrors: false });
      
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    it('should respect fallbackStrategies option', () => {
      const result = SafeQuerySelector.querySelector('#123', document, { fallbackStrategies: false });
      
      expect(result).toBeNull();
      // Should not try sanitized version
      expect(mockQuerySelector).not.toHaveBeenCalledWith('[id="123"]');
    });
  });

  describe('querySelectorAll', () => {
    it('should call document.querySelectorAll for valid selectors', () => {
      // Mock successful validation
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      const mockElements = [{ tagName: 'DIV' }];
      mockQuerySelectorAll.mockReturnValue(mockElements);

      const result = SafeQuerySelector.querySelectorAll('.valid');
      
      expect(mockQuerySelectorAll).toHaveBeenCalledWith('.valid');
      expect(result).toBe(mockElements);
    });

    it('should handle invalid selectors gracefully', () => {
      const result = SafeQuerySelector.querySelectorAll('#123');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('should try sanitized selector for invalid selectors', () => {
      // Mock validation for sanitized selector
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      const mockElements = [{ tagName: 'DIV' }];
      mockQuerySelectorAll.mockReturnValue(mockElements);

      const result = SafeQuerySelector.querySelectorAll('#123');
      
      // Should try the sanitized version
      expect(mockQuerySelectorAll).toHaveBeenCalledWith('[id="123"]');
      expect(result).toBe(mockElements);
    });

    it('should handle querySelectorAll exceptions', () => {
      // Mock successful validation
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      mockQuerySelectorAll.mockImplementation(() => {
        throw new Error('DOM Exception');
      });

      const result = SafeQuerySelector.querySelectorAll('.valid');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('fallback strategies', () => {
    it('should try simpler selectors for complex selectors', () => {
      // Mock successful validation for both selectors
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      mockQuerySelector
        .mockImplementationOnce(() => {
          throw new Error('Selector failed'); // First call throws error
        })
        .mockReturnValueOnce({ tagName: 'DIV' }); // Fallback succeeds

      const result = SafeQuerySelector.querySelector('.parent .child');
      
      expect(mockQuerySelector).toHaveBeenCalledWith('.parent .child');
      expect(mockQuerySelector).toHaveBeenCalledWith('.child'); // Fallback
      expect(result).toEqual({ tagName: 'DIV' });
    });

    it('should try selectors without pseudo-classes', () => {
      // Mock successful validation for both selectors
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      mockQuerySelector
        .mockImplementationOnce(() => {
          throw new Error('Selector failed'); // First call throws error
        })
        .mockReturnValueOnce({ tagName: 'DIV' }); // Fallback succeeds

      const result = SafeQuerySelector.querySelector('.class:hover');
      
      expect(mockQuerySelector).toHaveBeenCalledWith('.class:hover');
      expect(mockQuerySelector).toHaveBeenCalledWith('.class'); // Fallback
      expect(result).toEqual({ tagName: 'DIV' });
    });

    it('should try selectors without attributes', () => {
      // Mock successful validation for both selectors
      const mockFragment = {
        querySelector: vi.fn().mockReturnValue(null) // No error = valid
      };
      mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
      
      mockQuerySelector
        .mockImplementationOnce(() => {
          throw new Error('Selector failed'); // First call throws error
        })
        .mockReturnValueOnce({ tagName: 'DIV' }); // Fallback succeeds

      const result = SafeQuerySelector.querySelector('div[data-test="value"]');
      
      expect(mockQuerySelector).toHaveBeenCalledWith('div[data-test="value"]');
      expect(mockQuerySelector).toHaveBeenCalledWith('div'); // Fallback
      expect(result).toEqual({ tagName: 'DIV' });
    });
  });

  describe('error limiting', () => {
    it('should limit error logging to prevent spam', () => {
      // Reset error count and set a low limit for testing
      SafeQuerySelector.resetErrorCount();
      
      // Call with invalid selector multiple times
      for (let i = 0; i < 105; i++) {
        SafeQuerySelector.querySelector('#123', document, { logErrors: true, fallbackStrategies: false });
      }
      
      // Should have logged errors but not more than the limit
      expect(mockConsoleWarn).toHaveBeenCalled();
      expect(SafeQuerySelector.getErrorCount()).toBe(100); // Should be capped at MAX_ERRORS
    });
  });
});

describe('Convenience functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SafeQuerySelector.resetErrorCount();
  });

  it('should export safeQuerySelector function', () => {
    // Mock successful validation
    const mockFragment = {
      querySelector: vi.fn().mockReturnValue(null) // No error = valid
    };
    mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
    
    const mockElement = { tagName: 'DIV' };
    mockQuerySelector.mockReturnValue(mockElement);

    const result = safeQuerySelector('.test');
    
    expect(mockQuerySelector).toHaveBeenCalledWith('.test');
    expect(result).toStrictEqual(mockElement);
  });

  it('should export safeQuerySelectorAll function', () => {
    // Mock successful validation
    const mockFragment = {
      querySelector: vi.fn().mockReturnValue(null) // No error = valid
    };
    mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
    
    const mockElements = [{ tagName: 'DIV' }];
    mockQuerySelectorAll.mockReturnValue(mockElements);

    const result = safeQuerySelectorAll('.test');
    
    expect(mockQuerySelectorAll).toHaveBeenCalledWith('.test');
    expect(result).toBe(mockElements);
  });

  it('should create context-bound safe query functions', () => {
    // Mock successful validation
    const mockFragment = {
      querySelector: vi.fn().mockReturnValue(null) // No error = valid
    };
    mockDocument.createDocumentFragment = vi.fn().mockReturnValue(mockFragment);
    
    const mockContext = {
      querySelector: vi.fn().mockReturnValue({ tagName: 'SPAN' }),
      querySelectorAll: vi.fn().mockReturnValue([{ tagName: 'SPAN' }])
    };

    const safeQuery = createSafeQuerySelector(mockContext as any);
    
    const result1 = safeQuery.querySelector('.test');
    const result2 = safeQuery.querySelectorAll('.test');
    
    expect(mockContext.querySelector).toHaveBeenCalledWith('.test');
    expect(mockContext.querySelectorAll).toHaveBeenCalledWith('.test');
    expect(result1).toEqual({ tagName: 'SPAN' });
    expect(result2).toEqual([{ tagName: 'SPAN' }]);
  });
});