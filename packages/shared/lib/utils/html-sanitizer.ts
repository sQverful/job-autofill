/**
 * HTML Sanitization utilities for AI processing
 * Removes sensitive data and scripts before sending to AI services
 */

// Sensitive data patterns to remove or mask
const SENSITIVE_PATTERNS = [
  // Email addresses
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Phone numbers (various formats)
  /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  // Social Security Numbers
  /\b\d{3}-?\d{2}-?\d{4}\b/g,
  // Credit card numbers (basic pattern)
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  // API keys and tokens (common patterns)
  /\b[A-Za-z0-9]{32,}\b/g,
  // URLs with sensitive paths
  /https?:\/\/[^\s]+(?:token|key|secret|password|auth)[^\s]*/gi,
];

// Attributes that may contain sensitive data
const SENSITIVE_ATTRIBUTES = [
  'data-user-id',
  'data-session-id',
  'data-auth-token',
  'data-api-key',
  'data-csrf-token',
  'data-user-email',
  'data-user-phone',
  'data-tracking-id',
  'data-analytics-id',
];

// Elements that should be completely removed
const DANGEROUS_ELEMENTS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'applet',
  'meta',
  'link',
  'base',
];

// Attributes that should be removed for security
const DANGEROUS_ATTRIBUTES = [
  'onclick',
  'onload',
  'onerror',
  'onmouseover',
  'onmouseout',
  'onfocus',
  'onblur',
  'onchange',
  'onsubmit',
  'onkeydown',
  'onkeyup',
  'onkeypress',
  'style', // Remove inline styles that might contain data URLs
  'src', // Remove src attributes that might leak data
  'href', // Remove href attributes that might contain sensitive URLs
];

export interface SanitizationOptions {
  removeSensitiveData: boolean;
  removeScripts: boolean;
  removeStyles: boolean;
  removeAttributes: boolean;
  preserveFormStructure: boolean;
  maxLength?: number;
  allowedElements?: string[];
  allowedAttributes?: string[];
}

export interface SanitizationResult {
  sanitizedHtml: string;
  removedElements: string[];
  removedAttributes: string[];
  sensitiveDataFound: boolean;
  originalLength: number;
  sanitizedLength: number;
  warnings: string[];
}

/**
 * HTML Sanitizer for AI processing
 */
export class HTMLSanitizer {
  private static readonly DEFAULT_OPTIONS: SanitizationOptions = {
    removeSensitiveData: true,
    removeScripts: true,
    removeStyles: true,
    removeAttributes: true,
    preserveFormStructure: true,
    maxLength: 50000, // Limit HTML size for AI processing
    allowedElements: [
      'form', 'input', 'select', 'option', 'textarea', 'button', 'label',
      'fieldset', 'legend', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
    ],
    allowedAttributes: [
      'type', 'name', 'id', 'class', 'value', 'placeholder', 'required',
      'disabled', 'readonly', 'multiple', 'selected', 'checked',
      'for', 'role', 'aria-label', 'aria-describedby', 'aria-required',
    ],
  };

  /**
   * Sanitize HTML for AI processing
   */
  static sanitize(html: string, options: Partial<SanitizationOptions> = {}): SanitizationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const result: SanitizationResult = {
      sanitizedHtml: html,
      removedElements: [],
      removedAttributes: [],
      sensitiveDataFound: false,
      originalLength: html.length,
      sanitizedLength: 0,
      warnings: [],
    };

    try {
      // Create a DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove dangerous elements
      if (opts.removeScripts || opts.removeStyles) {
        this.removeDangerousElements(doc, opts, result);
      }

      // Remove sensitive data from text content
      if (opts.removeSensitiveData) {
        this.removeSensitiveData(doc, result);
      }

      // Clean attributes
      if (opts.removeAttributes) {
        this.cleanAttributes(doc, opts, result);
      }

      // Filter allowed elements
      if (opts.allowedElements) {
        this.filterAllowedElements(doc, opts, result);
      }

      // Get sanitized HTML
      result.sanitizedHtml = doc.body ? doc.body.innerHTML : '';

      // Apply length limit
      if (opts.maxLength && result.sanitizedHtml.length > opts.maxLength) {
        result.sanitizedHtml = result.sanitizedHtml.substring(0, opts.maxLength);
        result.warnings.push(`HTML truncated to ${opts.maxLength} characters`);
      }

      result.sanitizedLength = result.sanitizedHtml.length;

      // Add warnings for significant size reduction
      const reductionRatio = (result.originalLength - result.sanitizedLength) / result.originalLength;
      if (reductionRatio > 0.5) {
        result.warnings.push(`Significant content reduction: ${Math.round(reductionRatio * 100)}%`);
      }

    } catch (error) {
      console.error('HTML sanitization failed:', error);
      result.warnings.push('Sanitization failed, using minimal fallback');
      result.sanitizedHtml = this.createMinimalFallback(html);
      result.sanitizedLength = result.sanitizedHtml.length;
    }

    return result;
  }

  /**
   * Remove dangerous elements from the document
   */
  private static removeDangerousElements(
    doc: Document,
    options: SanitizationOptions,
    result: SanitizationResult
  ): void {
    const elementsToRemove = [...DANGEROUS_ELEMENTS];
    
    if (!options.removeScripts) {
      const scriptIndex = elementsToRemove.indexOf('script');
      if (scriptIndex > -1) elementsToRemove.splice(scriptIndex, 1);
    }
    
    if (!options.removeStyles) {
      const styleIndex = elementsToRemove.indexOf('style');
      if (styleIndex > -1) elementsToRemove.splice(styleIndex, 1);
    }

    elementsToRemove.forEach(tagName => {
      const elements = doc.querySelectorAll(tagName);
      elements.forEach(element => {
        result.removedElements.push(tagName);
        element.remove();
      });
    });
  }

  /**
   * Remove sensitive data from text content
   */
  private static removeSensitiveData(doc: Document, result: SanitizationResult): void {
    const walker = doc.createTreeWalker(
      doc.body || doc,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    textNodes.forEach(textNode => {
      let content = textNode.textContent || '';
      let hasChanges = false;

      SENSITIVE_PATTERNS.forEach(pattern => {
        if (pattern.test(content)) {
          result.sensitiveDataFound = true;
          hasChanges = true;
          content = content.replace(pattern, '[REDACTED]');
        }
      });

      if (hasChanges) {
        textNode.textContent = content;
      }
    });
  }

  /**
   * Clean dangerous and sensitive attributes
   */
  private static cleanAttributes(
    doc: Document,
    options: SanitizationOptions,
    result: SanitizationResult
  ): void {
    const allElements = doc.querySelectorAll('*');
    
    allElements.forEach(element => {
      const attributesToRemove: string[] = [];

      // Check all attributes
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        const attrName = attr.name.toLowerCase();
        const attrValue = attr.value;

        // Remove dangerous attributes
        if (DANGEROUS_ATTRIBUTES.includes(attrName)) {
          attributesToRemove.push(attrName);
        }
        // Remove sensitive attributes
        else if (SENSITIVE_ATTRIBUTES.includes(attrName)) {
          attributesToRemove.push(attrName);
          result.sensitiveDataFound = true;
        }
        // Check for sensitive data in attribute values
        else if (this.containsSensitiveData(attrValue)) {
          attributesToRemove.push(attrName);
          result.sensitiveDataFound = true;
        }
        // Remove if not in allowed list
        else if (options.allowedAttributes && !options.allowedAttributes.includes(attrName)) {
          attributesToRemove.push(attrName);
        }
      }

      // Remove identified attributes
      attributesToRemove.forEach(attrName => {
        element.removeAttribute(attrName);
        result.removedAttributes.push(attrName);
      });
    });
  }

  /**
   * Filter elements to only allowed ones
   */
  private static filterAllowedElements(
    doc: Document,
    options: SanitizationOptions,
    result: SanitizationResult
  ): void {
    if (!options.allowedElements) return;

    const allElements = doc.querySelectorAll('*');
    const elementsToRemove: Element[] = [];

    allElements.forEach(element => {
      const tagName = element.tagName.toLowerCase();
      
      if (!options.allowedElements!.includes(tagName)) {
        // If preserving form structure, replace with div
        if (options.preserveFormStructure && this.isStructuralElement(tagName)) {
          const replacement = doc.createElement('div');
          replacement.innerHTML = element.innerHTML;
          
          // Copy allowed attributes
          for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            if (options.allowedAttributes?.includes(attr.name.toLowerCase())) {
              replacement.setAttribute(attr.name, attr.value);
            }
          }
          
          element.parentNode?.replaceChild(replacement, element);
        } else {
          elementsToRemove.push(element);
        }
        
        result.removedElements.push(tagName);
      }
    });

    // Remove elements that couldn't be replaced
    elementsToRemove.forEach(element => {
      element.remove();
    });
  }

  /**
   * Check if text contains sensitive data
   */
  private static containsSensitiveData(text: string): boolean {
    return SENSITIVE_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Check if element is structural (should be preserved as div)
   */
  private static isStructuralElement(tagName: string): boolean {
    return ['section', 'article', 'header', 'footer', 'nav', 'aside', 'main'].includes(tagName);
  }

  /**
   * Create minimal fallback HTML when sanitization fails
   */
  private static createMinimalFallback(originalHtml: string): string {
    // Extract basic form elements using regex as fallback
    const formElements: string[] = [];
    
    // Extract input elements
    const inputMatches = originalHtml.match(/<input[^>]*>/gi) || [];
    formElements.push(...inputMatches);
    
    // Extract select elements
    const selectMatches = originalHtml.match(/<select[^>]*>.*?<\/select>/gis) || [];
    formElements.push(...selectMatches);
    
    // Extract textarea elements
    const textareaMatches = originalHtml.match(/<textarea[^>]*>.*?<\/textarea>/gis) || [];
    formElements.push(...textareaMatches);

    return formElements.join('\n');
  }

  /**
   * Quick sanitization for form extraction
   */
  static quickSanitize(html: string): string {
    const result = this.sanitize(html, {
      removeSensitiveData: true,
      removeScripts: true,
      removeStyles: true,
      removeAttributes: true,
      preserveFormStructure: true,
      maxLength: 30000,
    });

    return result.sanitizedHtml;
  }

  /**
   * Validate sanitization result
   */
  static validateSanitization(result: SanitizationResult): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if too much content was removed
    const reductionRatio = (result.originalLength - result.sanitizedLength) / result.originalLength;
    if (reductionRatio > 0.8) {
      issues.push('Excessive content reduction may affect AI analysis quality');
    }

    // Check if sensitive data was found
    if (result.sensitiveDataFound) {
      issues.push('Sensitive data was detected and removed');
    }

    // Check for warnings
    if (result.warnings.length > 0) {
      issues.push(...result.warnings);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get sanitization statistics
   */
  static getStatistics(result: SanitizationResult): {
    compressionRatio: number;
    elementsRemoved: number;
    attributesRemoved: number;
    sensitiveDataFound: boolean;
    warningCount: number;
  } {
    return {
      compressionRatio: result.originalLength > 0 
        ? (result.originalLength - result.sanitizedLength) / result.originalLength 
        : 0,
      elementsRemoved: result.removedElements.length,
      attributesRemoved: result.removedAttributes.length,
      sensitiveDataFound: result.sensitiveDataFound,
      warningCount: result.warnings.length,
    };
  }
}

// Export utility functions
export const sanitizeHTML = HTMLSanitizer.sanitize;
export const quickSanitizeHTML = HTMLSanitizer.quickSanitize;
export const validateSanitization = HTMLSanitizer.validateSanitization;