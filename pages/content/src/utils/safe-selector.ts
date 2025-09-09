/**
 * Safe Selector Utility
 * Provides selector validation and safe querySelector methods with error handling
 */

export interface SelectorValidationResult {
  isValid: boolean;
  sanitizedSelector?: string;
  error?: string;
  suggestion?: string;
}

export interface SafeQueryOptions {
  fallbackStrategies?: boolean;
  logErrors?: boolean;
  retryCount?: number;
}

/**
 * Validates CSS selectors and provides sanitized alternatives
 */
export class SelectorValidator {
  private static readonly INVALID_ID_PATTERN = /^#\d/;
  private static readonly SPECIAL_CHARS_PATTERN = /[^\w\-#.\[\]="':]/g;
  
  /**
   * Validates a CSS selector and provides sanitization if needed
   */
  static validateSelector(selector: string): SelectorValidationResult {
    if (!selector || typeof selector !== 'string') {
      return {
        isValid: false,
        error: 'Selector must be a non-empty string',
        suggestion: 'Provide a valid CSS selector string'
      };
    }

    const trimmedSelector = selector.trim();
    if (!trimmedSelector) {
      return {
        isValid: false,
        error: 'Selector cannot be empty or whitespace only',
        suggestion: 'Provide a valid CSS selector'
      };
    }

    // Check for numeric ID selectors (invalid in CSS)
    if (this.INVALID_ID_PATTERN.test(trimmedSelector)) {
      const id = trimmedSelector.substring(1); // Remove the #
      return {
        isValid: false,
        sanitizedSelector: `[id="${id}"]`,
        error: 'ID selector cannot start with a number',
        suggestion: `Use attribute selector: [id="${id}"]`
      };
    }

    // Check for other potentially problematic patterns
    const sanitized = this.sanitizeSelector(trimmedSelector);
    if (sanitized !== trimmedSelector) {
      return {
        isValid: false,
        sanitizedSelector: sanitized,
        error: 'Selector contains invalid characters',
        suggestion: `Use sanitized version: ${sanitized}`
      };
    }

    // Try to validate by attempting to use the selector
    try {
      // Test the selector without actually querying the DOM
      document.createDocumentFragment().querySelector(trimmedSelector);
      return {
        isValid: true
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Invalid CSS selector syntax: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Check CSS selector syntax'
      };
    }
  }

  /**
   * Sanitizes a selector by escaping or replacing invalid characters
   */
  static sanitizeSelector(selector: string): string {
    // Handle numeric ID selectors
    if (this.INVALID_ID_PATTERN.test(selector)) {
      const id = selector.substring(1);
      return `[id="${id}"]`;
    }

    // For now, return as-is for other cases
    // Could be extended to handle more complex sanitization
    return selector;
  }

  /**
   * Checks if a selector is a valid CSS selector
   */
  static isValidCSSSelector(selector: string): boolean {
    return this.validateSelector(selector).isValid;
  }
}

/**
 * Safe querySelector that handles errors gracefully
 */
export class SafeQuerySelector {
  private static errorCount = 0;
  private static readonly MAX_ERRORS = 100; // Prevent log spam

  /**
   * Safe version of document.querySelector with error handling
   */
  static querySelector<T extends Element = Element>(
    selector: string, 
    context: Document | Element = document,
    options: SafeQueryOptions = {}
  ): T | null {
    const { fallbackStrategies = true, logErrors = true, retryCount = 0 } = options;

    // Validate selector first
    const validation = SelectorValidator.validateSelector(selector);
    
    if (!validation.isValid) {
      if (logErrors && this.errorCount < this.MAX_ERRORS) {
        console.warn(`[SafeQuerySelector] Invalid selector: "${selector}"`, {
          error: validation.error,
          suggestion: validation.suggestion,
          sanitized: validation.sanitizedSelector
        });
        this.errorCount++;
      }

      // Try sanitized version if available
      if (fallbackStrategies && validation.sanitizedSelector) {
        return this.querySelector(validation.sanitizedSelector, context, {
          ...options,
          fallbackStrategies: false, // Prevent infinite recursion
          retryCount: retryCount + 1
        });
      }

      return null;
    }

    // Attempt to query with validated selector
    try {
      return context.querySelector(selector) as T | null;
    } catch (error) {
      if (logErrors && this.errorCount < this.MAX_ERRORS) {
        console.error(`[SafeQuerySelector] Query failed for selector: "${selector}"`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          context: context.constructor.name,
          retryCount
        });
        this.errorCount++;
      }

      // Try fallback strategies
      if (fallbackStrategies && retryCount === 0) {
        return this.tryFallbackStrategies(selector, context, options);
      }

      return null;
    }
  }

  /**
   * Safe version of document.querySelectorAll with error handling
   */
  static querySelectorAll<T extends Element = Element>(
    selector: string,
    context: Document | Element = document,
    options: SafeQueryOptions = {}
  ): NodeListOf<T> | T[] {
    const { fallbackStrategies = true, logErrors = true, retryCount = 0 } = options;

    // Validate selector first
    const validation = SelectorValidator.validateSelector(selector);
    
    if (!validation.isValid) {
      if (logErrors && this.errorCount < this.MAX_ERRORS) {
        console.warn(`[SafeQuerySelector] Invalid selector: "${selector}"`, {
          error: validation.error,
          suggestion: validation.suggestion,
          sanitized: validation.sanitizedSelector
        });
        this.errorCount++;
      }

      // Try sanitized version if available
      if (fallbackStrategies && validation.sanitizedSelector) {
        return this.querySelectorAll(validation.sanitizedSelector, context, {
          ...options,
          fallbackStrategies: false, // Prevent infinite recursion
          retryCount: retryCount + 1
        });
      }

      return [] as T[];
    }

    // Attempt to query with validated selector
    try {
      const result = context.querySelectorAll(selector) as NodeListOf<T>;
      return result;
    } catch (error) {
      if (logErrors && this.errorCount < this.MAX_ERRORS) {
        console.error(`[SafeQuerySelector] QueryAll failed for selector: "${selector}"`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          context: context.constructor.name,
          retryCount
        });
        this.errorCount++;
      }

      // Try fallback strategies
      if (fallbackStrategies && retryCount === 0) {
        const fallbackResult = this.tryFallbackStrategiesAll(selector, context, options);
        return (fallbackResult as T[]) || ([] as T[]);
      }

      return [] as T[];
    }
  }

  /**
   * Try alternative selector strategies when the primary selector fails
   */
  private static tryFallbackStrategies<T extends Element>(
    selector: string,
    context: Document | Element,
    options: SafeQueryOptions
  ): T | null {
    const fallbackSelectors = this.generateFallbackSelectors(selector);
    
    for (const fallbackSelector of fallbackSelectors) {
      try {
        const result = this.querySelector<T>(fallbackSelector, context, {
          ...options,
          fallbackStrategies: false,
          retryCount: (options.retryCount || 0) + 1
        });
        
        if (result) {
          if (options.logErrors && this.errorCount < this.MAX_ERRORS) {
            console.info(`[SafeQuerySelector] Fallback successful: "${fallbackSelector}" for original: "${selector}"`);
          }
          return result;
        }
      } catch (error) {
        // Continue to next fallback
        continue;
      }
    }

    return null;
  }

  /**
   * Try alternative selector strategies for querySelectorAll
   */
  private static tryFallbackStrategiesAll<T extends Element>(
    selector: string,
    context: Document | Element,
    options: SafeQueryOptions
  ): T[] | null {
    const fallbackSelectors = this.generateFallbackSelectors(selector);
    
    for (const fallbackSelector of fallbackSelectors) {
      try {
        const result = this.querySelectorAll<T>(fallbackSelector, context, {
          ...options,
          fallbackStrategies: false,
          retryCount: (options.retryCount || 0) + 1
        });
        
        if (result && result.length > 0) {
          if (options.logErrors && this.errorCount < this.MAX_ERRORS) {
            console.info(`[SafeQuerySelector] Fallback successful: "${fallbackSelector}" for original: "${selector}"`);
          }
          return Array.from(result);
        }
      } catch (error) {
        // Continue to next fallback
        continue;
      }
    }

    return null;
  }

  /**
   * Generate fallback selectors for common failure patterns
   */
  private static generateFallbackSelectors(selector: string): string[] {
    const fallbacks: string[] = [];

    // If it's an ID selector starting with number, try attribute selector
    if (/^#\d/.test(selector)) {
      const id = selector.substring(1);
      fallbacks.push(`[id="${id}"]`);
    }

    // If it's a complex selector, try simpler versions
    if (selector.includes(' ')) {
      const parts = selector.split(' ').filter(Boolean);
      // Try just the last part (most specific)
      if (parts.length > 1) {
        fallbacks.push(parts[parts.length - 1]);
      }
      // Try without descendant selectors
      fallbacks.push(parts.join(' > '));
    }

    // If it has pseudo-selectors, try without them
    if (selector.includes(':')) {
      const withoutPseudo = selector.replace(/:[\w-]+(\([^)]*\))?/g, '');
      if (withoutPseudo && withoutPseudo !== selector) {
        fallbacks.push(withoutPseudo);
      }
    }

    // If it has attribute selectors, try simpler versions
    if (selector.includes('[') && selector.includes(']')) {
      const withoutAttributes = selector.replace(/\[[^\]]*\]/g, '');
      if (withoutAttributes && withoutAttributes !== selector) {
        fallbacks.push(withoutAttributes);
      }
    }

    return fallbacks.filter(Boolean);
  }

  /**
   * Reset error counter (useful for testing)
   */
  static resetErrorCount(): void {
    this.errorCount = 0;
  }

  /**
   * Get current error count
   */
  static getErrorCount(): number {
    return this.errorCount;
  }
}

/**
 * Convenience functions for common use cases
 */
export const safeQuerySelector = SafeQuerySelector.querySelector;
export const safeQuerySelectorAll = SafeQuerySelector.querySelectorAll;

/**
 * Wrapper function that provides the same interface as document.querySelector
 * but with built-in error handling and validation
 */
export function createSafeQuerySelector(context: Document | Element = document) {
  return {
    querySelector: <T extends Element = Element>(selector: string, options?: SafeQueryOptions) =>
      SafeQuerySelector.querySelector<T>(selector, context, options),
    
    querySelectorAll: <T extends Element = Element>(selector: string, options?: SafeQueryOptions) =>
      SafeQuerySelector.querySelectorAll<T>(selector, context, options)
  };
}