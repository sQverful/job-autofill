/**
 * Field Detection Utilities
 * 
 * Utilities for detecting form fields that can benefit from AI content generation
 */

import type { AIContentRequestType } from '@extension/content/src/ai-content';

export interface DetectedField {
  element: HTMLElement;
  type: AIContentRequestType;
  label: string;
  id: string;
  confidence: number;
}

/**
 * Detect form fields that can benefit from AI content generation
 */
export const detectAICompatibleFields = (): DetectedField[] => {
  const fields: DetectedField[] = [];
  const processedElements = new Set<HTMLElement>();

  // Find all input and textarea elements
  const inputElements = document.querySelectorAll('input, textarea');
  
  inputElements.forEach((element) => {
    if (processedElements.has(element as HTMLElement)) return;
    
    const htmlElement = element as HTMLElement;
    const field = analyzeField(htmlElement);
    
    if (field) {
      fields.push(field);
      processedElements.add(htmlElement);
    }
  });

  // Sort by confidence score (highest first)
  return fields.sort((a, b) => b.confidence - a.confidence);
};

/**
 * Analyze a single field to determine if it's AI-compatible
 */
const analyzeField = (element: HTMLElement): DetectedField | null => {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return null;
  }

  // Skip hidden, disabled, or readonly fields
  if (element.type === 'hidden' || 
      element.disabled || 
      element.readOnly ||
      element.style.display === 'none') {
    return null;
  }

  // Skip password, email, and other specific input types
  if (element instanceof HTMLInputElement && 
      ['password', 'email', 'tel', 'number', 'date', 'time'].includes(element.type)) {
    return null;
  }

  const fieldInfo = extractFieldInfo(element);
  const contentType = determineContentType(fieldInfo);
  
  if (!contentType) return null;

  return {
    element,
    type: contentType.type,
    label: fieldInfo.label,
    id: generateFieldId(element),
    confidence: contentType.confidence
  };
};

/**
 * Extract field information from element and surrounding context
 */
const extractFieldInfo = (element: HTMLElement) => {
  const info = {
    label: '',
    placeholder: '',
    name: '',
    id: '',
    ariaLabel: '',
    context: ''
  };

  // Get basic attributes
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    info.placeholder = element.placeholder || '';
    info.name = element.name || '';
    info.id = element.id || '';
    info.ariaLabel = element.getAttribute('aria-label') || '';
  }

  // Find associated label
  info.label = findFieldLabel(element);

  // Get surrounding context
  info.context = extractSurroundingContext(element);

  return info;
};

/**
 * Find the label associated with a form field
 */
const findFieldLabel = (element: HTMLElement): string => {
  // Try aria-label first
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // Try associated label element
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label?.textContent) return label.textContent.trim();
  }

  // Try parent label
  const parentLabel = element.closest('label');
  if (parentLabel?.textContent) {
    return parentLabel.textContent.replace(element.textContent || '', '').trim();
  }

  // Try preceding text
  const precedingText = findPrecedingText(element);
  if (precedingText) return precedingText;

  // Try placeholder as fallback
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.placeholder) return element.placeholder.trim();
  }

  // Try name attribute as last resort
  if (element.getAttribute('name')) {
    return element.getAttribute('name')!.replace(/[_-]/g, ' ').trim();
  }

  return 'Unknown Field';
};

/**
 * Find text that precedes the field element
 */
const findPrecedingText = (element: HTMLElement): string => {
  const parent = element.parentElement;
  if (!parent) return '';

  // Look for text nodes or elements before this field
  const siblings = Array.from(parent.childNodes);
  const elementIndex = siblings.indexOf(element);
  
  for (let i = elementIndex - 1; i >= 0; i--) {
    const sibling = siblings[i];
    
    if (sibling.nodeType === Node.TEXT_NODE) {
      const text = sibling.textContent?.trim();
      if (text && text.length > 2) return text;
    } else if (sibling.nodeType === Node.ELEMENT_NODE) {
      const elementSibling = sibling as Element;
      const text = elementSibling.textContent?.trim();
      if (text && text.length > 2 && text.length < 100) return text;
    }
  }

  return '';
};

/**
 * Extract surrounding context from the field's location in the DOM
 */
const extractSurroundingContext = (element: HTMLElement): string => {
  const contexts: string[] = [];
  
  // Get text from parent elements (up to 3 levels)
  let parent = element.parentElement;
  let level = 0;
  
  while (parent && level < 3) {
    const text = getElementText(parent, element);
    if (text) contexts.push(text);
    
    parent = parent.parentElement;
    level++;
  }

  return contexts.join(' ').substring(0, 200);
};

/**
 * Get meaningful text from an element, excluding the target element
 */
const getElementText = (element: Element, exclude: HTMLElement): string => {
  const clone = element.cloneNode(true) as Element;
  
  // Remove the excluded element from the clone
  const excludeInClone = clone.querySelector(`[data-temp-id="${exclude.dataset.tempId}"]`);
  if (excludeInClone) {
    excludeInClone.remove();
  }

  const text = clone.textContent?.trim() || '';
  return text.length > 10 && text.length < 200 ? text : '';
};

/**
 * Determine the AI content type for a field based on its information
 */
const determineContentType = (fieldInfo: {
  label: string;
  placeholder: string;
  name: string;
  context: string;
}): { type: AIContentRequestType; confidence: number } | null => {
  const allText = `${fieldInfo.label} ${fieldInfo.placeholder} ${fieldInfo.name} ${fieldInfo.context}`.toLowerCase();

  // Cover letter detection
  if (matchesPatterns(allText, [
    'cover letter', 'covering letter', 'letter of interest',
    'why do you want', 'why are you interested',
    'tell us about yourself', 'personal statement'
  ])) {
    return { type: 'cover_letter', confidence: 0.9 };
  }

  // Summary/objective detection
  if (matchesPatterns(allText, [
    'summary', 'professional summary', 'career summary',
    'objective', 'career objective', 'professional objective',
    'about yourself', 'brief description'
  ])) {
    return { type: 'summary', confidence: 0.85 };
  }

  // Why interested detection
  if (matchesPatterns(allText, [
    'why interested', 'why do you want', 'what interests you',
    'motivation', 'why this role', 'why this company',
    'what attracts you'
  ])) {
    return { type: 'why_interested', confidence: 0.8 };
  }

  // Why qualified detection
  if (matchesPatterns(allText, [
    'why qualified', 'qualifications', 'why are you suitable',
    'relevant experience', 'what makes you', 'skills and experience',
    'why should we hire'
  ])) {
    return { type: 'why_qualified', confidence: 0.8 };
  }

  // General question response for longer text fields
  if ((fieldInfo.label.includes('?') || fieldInfo.placeholder.includes('?')) &&
      (allText.includes('experience') || allText.includes('skill') || 
       allText.includes('example') || allText.includes('describe'))) {
    return { type: 'question_response', confidence: 0.7 };
  }

  // Textarea fields are more likely to benefit from AI
  const element = document.querySelector(`[name="${fieldInfo.name}"], #${fieldInfo.name}`);
  if (element instanceof HTMLTextAreaElement && allText.length > 20) {
    return { type: 'question_response', confidence: 0.6 };
  }

  return null;
};

/**
 * Check if text matches any of the given patterns
 */
const matchesPatterns = (text: string, patterns: string[]): boolean => {
  return patterns.some(pattern => text.includes(pattern));
};

/**
 * Generate a unique ID for a field
 */
const generateFieldId = (element: HTMLElement): string => {
  // Use existing ID if available
  if (element.id) return element.id;
  
  // Use name attribute
  if (element.getAttribute('name')) {
    return `field-${element.getAttribute('name')}`;
  }
  
  // Generate based on position and attributes
  const tagName = element.tagName.toLowerCase();
  const className = element.className ? `-${element.className.split(' ')[0]}` : '';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5);
  
  return `ai-field-${tagName}${className}-${timestamp}-${random}`;
};

/**
 * Monitor for new fields being added to the page
 */
export const createFieldMonitor = (
  onFieldsDetected: (fields: DetectedField[]) => void,
  debounceMs: number = 1000
): () => void => {
  let timeoutId: number | null = null;
  
  const detectAndNotify = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = window.setTimeout(() => {
      const fields = detectAICompatibleFields();
      if (fields.length > 0) {
        onFieldsDetected(fields);
      }
    }, debounceMs);
  };

  // Initial detection
  detectAndNotify();

  // Monitor for DOM changes
  const observer = new MutationObserver((mutations) => {
    const hasNewFields = mutations.some(mutation =>
      mutation.type === 'childList' &&
      Array.from(mutation.addedNodes).some(node =>
        node.nodeType === Node.ELEMENT_NODE &&
        (node as Element).matches('input, textarea, form, [class*="form"], [class*="field"]')
      )
    );

    if (hasNewFields) {
      detectAndNotify();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Cleanup function
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    observer.disconnect();
  };
};