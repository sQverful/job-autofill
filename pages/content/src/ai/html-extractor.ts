/**
 * HTML Form Extractor for AI Analysis
 * 
 * Extracts and sanitizes HTML form structures for AI processing.
 * Removes sensitive data, scripts, and unnecessary elements while
 * preserving form structure and metadata.
 */

export interface ExtractedHTML {
  html: string;
  hash: string;
  metadata: FormMetadata;
}

export interface FormMetadata {
  url: string;
  timestamp: Date;
  formCount: number;
  fieldCount: number;
  pageTitle: string;
  fieldTypes: Record<string, number>;
  hasFileUploads: boolean;
  hasMultiStep: boolean;
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface HTMLExtractorOptions {
  includeStyles?: boolean;
  maxDepth?: number;
  preserveDataAttributes?: boolean;
  customSanitizers?: Array<(element: Element) => void>;
  minifyOutput?: boolean;
  removeComments?: boolean;
  optimizeForAI?: boolean;
  maxPayloadSize?: number;
}

export class HTMLExtractor {
  private readonly defaultOptions: Required<HTMLExtractorOptions> = {
    includeStyles: false,
    maxDepth: 10,
    preserveDataAttributes: false,
    customSanitizers: [],
    minifyOutput: true,
    removeComments: true,
    optimizeForAI: true,
    maxPayloadSize: 6000 // 6KB max payload for better AI processing and message limits (reduced for faster processing)
  };

  /**
   * Extracts form HTML from the current page or specified container
   */
  async extractFormHTML(container?: HTMLElement, options?: HTMLExtractorOptions): Promise<ExtractedHTML> {
    const opts = { ...this.defaultOptions, ...options };
    const rootElement = container || document.body;
    
    // Find all forms in the container
    const forms = this.findForms(rootElement);
    
    if (forms.length === 0) {
      throw new Error('No forms found in the specified container');
    }

    // Create a clean container for extraction
    const extractedContainer = this.createCleanContainer(forms, opts);
    
    // Generate metadata
    const metadata = this.generateMetadata(forms, extractedContainer);
    
    // Sanitize and optimize the HTML
    let sanitizedHTML = this.sanitizeHTML(extractedContainer.outerHTML, opts);
    
    // Apply AI-specific optimizations
    if (opts.optimizeForAI) {
      sanitizedHTML = this.optimizeForAI(sanitizedHTML, opts);
    }
    
    // Detect complex forms early and apply aggressive optimization
    const isComplexForm = metadata.fieldCount > 20 || metadata.estimatedComplexity === 'high' || sanitizedHTML.length > opts.maxPayloadSize * 1.5;
    
    if (isComplexForm) {
      console.log('[HTMLExtractor] Complex form detected, applying aggressive optimization');
      sanitizedHTML = this.keepOnlyFormElements(sanitizedHTML);
      
      // Further compress if still too large
      if (sanitizedHTML.length > opts.maxPayloadSize) {
        sanitizedHTML = this.compressHTML(sanitizedHTML, opts.maxPayloadSize * 0.8); // Use 80% of max size for complex forms
      }
    } else if (sanitizedHTML.length > opts.maxPayloadSize) {
      // Standard compression for normal forms
      sanitizedHTML = this.compressHTML(sanitizedHTML, opts.maxPayloadSize);
    }
    
    // Generate hash for caching
    const hash = this.generateHTMLHash(sanitizedHTML);

    return {
      html: sanitizedHTML,
      hash,
      metadata
    };
  }

  /**
   * Finds all form elements in the given container
   */
  private findForms(container: HTMLElement): HTMLFormElement[] {
    const forms: HTMLFormElement[] = [];
    
    // Direct form elements
    const directForms = container.querySelectorAll('form');
    forms.push(...Array.from(directForms));
    
    // Look for orphan form fields (fields not inside a form element)
    const formFields = container.querySelectorAll('input, select, textarea');
    const orphanFields: HTMLElement[] = [];
    
    formFields.forEach(field => {
      if (!field.closest('form')) {
        orphanFields.push(field as HTMLElement);
      }
    });
    
    // If we have orphan fields, create a virtual form for them
    if (orphanFields.length > 0) {
      const virtualForm = document.createElement('form');
      virtualForm.setAttribute('data-virtual-form', 'true');
      
      // Clone the orphan fields into the virtual form
      orphanFields.forEach(field => {
        const clonedField = field.cloneNode(true) as HTMLElement;
        virtualForm.appendChild(clonedField);
      });
      
      forms.push(virtualForm);
    }
    
    return forms;
  }

  /**
   * Finds the common container for orphan form fields
   */
  private findCommonContainer(elements: HTMLElement[]): HTMLElement | null {
    if (elements.length === 0) return null;
    if (elements.length === 1) return elements[0].parentElement;
    
    let commonAncestor = elements[0].parentElement;
    
    for (let i = 1; i < elements.length && commonAncestor; i++) {
      commonAncestor = this.findCommonAncestor(commonAncestor, elements[i]);
    }
    
    return commonAncestor;
  }

  /**
   * Finds common ancestor of two elements
   */
  private findCommonAncestor(element1: HTMLElement, element2: HTMLElement): HTMLElement | null {
    const ancestors1 = this.getAncestors(element1);
    const ancestors2 = this.getAncestors(element2);
    
    for (const ancestor of ancestors1) {
      if (ancestors2.includes(ancestor)) {
        return ancestor;
      }
    }
    
    return null;
  }

  /**
   * Gets all ancestors of an element
   */
  private getAncestors(element: HTMLElement): HTMLElement[] {
    const ancestors: HTMLElement[] = [];
    let current = element.parentElement;
    
    while (current && current !== document.body) {
      ancestors.push(current);
      current = current.parentElement;
    }
    
    return ancestors;
  }

  /**
   * Creates a clean container with only the necessary form elements
   */
  private createCleanContainer(forms: HTMLFormElement[], options: Required<HTMLExtractorOptions>): HTMLElement {
    const container = document.createElement('div');
    container.setAttribute('data-extracted-forms', 'true');
    
    forms.forEach((form, index) => {
      const cleanForm = this.cloneAndCleanForm(form, options);
      cleanForm.setAttribute('data-form-index', index.toString());
      container.appendChild(cleanForm);
    });
    
    return container;
  }

  /**
   * Clones and cleans a form element
   */
  private cloneAndCleanForm(form: HTMLFormElement, options: Required<HTMLExtractorOptions>): HTMLElement {
    const clone = form.cloneNode(true) as HTMLFormElement;
    
    // Remove scripts and dangerous elements
    this.removeScripts(clone);
    this.removeDangerousElements(clone);
    
    // Clean attributes
    this.cleanAttributes(clone, options);
    
    // Apply custom sanitizers
    options.customSanitizers.forEach(sanitizer => {
      clone.querySelectorAll('*').forEach(element => {
        sanitizer(element);
      });
    });
    
    return clone;
  }

  /**
   * Removes all script elements and event handlers
   */
  private removeScripts(container: HTMLElement): void {
    // Remove script tags
    const scripts = container.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove event handler attributes
    const allElements = container.querySelectorAll('*');
    allElements.forEach(element => {
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          element.removeAttribute(attr.name);
        }
      });
    });
  }

  /**
   * Removes potentially dangerous elements
   */
  private removeDangerousElements(container: HTMLElement): void {
    const dangerousSelectors = [
      'iframe',
      'object',
      'embed',
      'link[rel="stylesheet"]',
      'style',
      'meta'
    ];
    
    dangerousSelectors.forEach(selector => {
      const elements = container.querySelectorAll(selector);
      elements.forEach(element => element.remove());
    });
  }

  /**
   * Cleans element attributes based on options
   */
  private cleanAttributes(container: HTMLElement, options: Required<HTMLExtractorOptions>): void {
    const allElements = container.querySelectorAll('*');
    
    allElements.forEach(element => {
      const attributesToRemove: string[] = [];
      
      Array.from(element.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        
        // Remove sensitive attributes
        if (this.isSensitiveAttribute(name)) {
          attributesToRemove.push(name);
        }
        
        // Remove data attributes unless preserved, but keep important extraction attributes
        if (!options.preserveDataAttributes && name.startsWith('data-')) {
          // Keep extraction-related attributes
          if (!this.isExtractionAttribute(name)) {
            attributesToRemove.push(name);
          }
        }
        
        // Remove style attributes unless included
        if (!options.includeStyles && name === 'style') {
          attributesToRemove.push(name);
        }
      });
      
      attributesToRemove.forEach(attr => {
        element.removeAttribute(attr);
      });
    });
  }

  /**
   * Checks if an attribute is needed for extraction purposes
   */
  private isExtractionAttribute(attributeName: string): boolean {
    const extractionAttributes = [
      'data-virtual-form',
      'data-form-index',
      'data-extracted-forms',
      'data-step'
    ];
    
    return extractionAttributes.includes(attributeName);
  }

  /**
   * Checks if an attribute contains sensitive information
   */
  private isSensitiveAttribute(attributeName: string): boolean {
    const sensitiveAttributes = [
      'data-user-id',
      'data-session',
      'data-token',
      'data-api-key',
      'data-auth',
      'data-csrf',
      'data-password',
      'data-secret'
    ];
    
    return sensitiveAttributes.some(sensitive => 
      attributeName.includes(sensitive.replace('data-', ''))
    );
  }

  /**
   * Sanitizes HTML content
   */
  sanitizeHTML(html: string, options?: HTMLExtractorOptions): string {
    const opts = { ...this.defaultOptions, ...options };
    
    // Create a temporary container for sanitization
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove any remaining scripts or dangerous content
    this.removeScripts(tempDiv);
    this.removeDangerousElements(tempDiv);
    this.cleanAttributes(tempDiv, opts);
    
    // Apply custom sanitizers
    opts.customSanitizers.forEach(sanitizer => {
      tempDiv.querySelectorAll('*').forEach(element => {
        sanitizer(element);
      });
    });
    
    // Remove empty elements that don't contribute to form structure
    this.removeEmptyElements(tempDiv);
    
    // Normalize whitespace
    return this.normalizeWhitespace(tempDiv.innerHTML);
  }

  /**
   * Removes empty elements that don't contribute to form structure
   */
  private removeEmptyElements(container: HTMLElement): void {
    const elementsToCheck = container.querySelectorAll('*');
    
    elementsToCheck.forEach(element => {
      // Skip form elements and elements with form-related attributes
      if (this.isFormRelatedElement(element)) {
        return;
      }
      
      // Remove if empty and not self-closing
      if (!element.textContent?.trim() && 
          element.children.length === 0 && 
          !this.isSelfClosingElement(element.tagName)) {
        element.remove();
      }
    });
  }

  /**
   * Checks if element is form-related
   */
  private isFormRelatedElement(element: Element): boolean {
    const formElements = ['form', 'input', 'select', 'textarea', 'button', 'label', 'fieldset', 'legend'];
    return formElements.includes(element.tagName.toLowerCase()) ||
           element.hasAttribute('for') ||
           element.hasAttribute('form');
  }

  /**
   * Checks if element is self-closing
   */
  private isSelfClosingElement(tagName: string): boolean {
    const selfClosing = ['input', 'br', 'hr', 'img', 'meta', 'link'];
    return selfClosing.includes(tagName.toLowerCase());
  }

  /**
   * Normalizes whitespace in HTML
   */
  private normalizeWhitespace(html: string): string {
    return html
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim();
  }

  /**
   * Optimize HTML specifically for AI analysis
   */
  private optimizeForAI(html: string, options: Required<HTMLExtractorOptions>): string {
    let optimized = html;
    
    // Remove comments if enabled
    if (options.removeComments) {
      optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');
    }
    
    // Remove unnecessary attributes that don't help AI analysis
    optimized = this.removeUnnecessaryAttributes(optimized);
    
    // Simplify nested structures that don't contain form elements
    optimized = this.simplifyNonFormStructures(optimized);
    
    // Remove empty text nodes and whitespace-only elements
    optimized = this.removeEmptyTextNodes(optimized);
    
    // Minify if enabled
    if (options.minifyOutput) {
      optimized = this.minifyHTML(optimized);
    }
    
    return optimized;
  }

  /**
   * Remove attributes that don't contribute to AI form analysis
   */
  private removeUnnecessaryAttributes(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const unnecessaryAttributes = [
      'style', 'class', 'data-testid', 'data-cy', 'data-qa',
      'aria-describedby', 'aria-labelledby', 'role',
      'tabindex', 'autocomplete', 'spellcheck'
    ];
    
    tempDiv.querySelectorAll('*').forEach(element => {
      // Keep essential form attributes
      if (this.isFormRelatedElement(element)) {
        // Only remove non-essential attributes from form elements
        const nonEssentialForForms = ['style', 'class', 'data-testid', 'data-cy', 'data-qa'];
        nonEssentialForForms.forEach(attr => {
          element.removeAttribute(attr);
        });
      } else {
        // Remove all unnecessary attributes from non-form elements
        unnecessaryAttributes.forEach(attr => {
          element.removeAttribute(attr);
        });
      }
    });
    
    return tempDiv.innerHTML;
  }

  /**
   * Simplify nested structures that don't contain form elements
   */
  private simplifyNonFormStructures(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Find containers that don't have form elements
    const containers = tempDiv.querySelectorAll('div, section, article, aside, header, footer, nav');
    
    containers.forEach(container => {
      const hasFormElements = container.querySelector('form, input, select, textarea, button');
      const hasFormLabels = container.querySelector('label');
      
      if (!hasFormElements && !hasFormLabels) {
        // Replace with a simple placeholder if it has text content
        const textContent = container.textContent?.trim();
        if (textContent && textContent.length > 0) {
          const placeholder = document.createElement('div');
          placeholder.textContent = textContent.length > 50 
            ? textContent.substring(0, 50) + '...' 
            : textContent;
          container.parentNode?.replaceChild(placeholder, container);
        } else {
          // Remove empty containers
          container.remove();
        }
      }
    });
    
    return tempDiv.innerHTML;
  }

  /**
   * Remove empty text nodes and whitespace-only elements
   */
  private removeEmptyTextNodes(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          return node.textContent?.trim() === '' 
            ? NodeFilter.FILTER_ACCEPT 
            : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    const emptyTextNodes: Node[] = [];
    let node;
    while (node = walker.nextNode()) {
      emptyTextNodes.push(node);
    }
    
    emptyTextNodes.forEach(node => node.remove());
    
    return tempDiv.innerHTML;
  }

  /**
   * Minify HTML by removing unnecessary whitespace
   */
  private minifyHTML(html: string): string {
    return html
      .replace(/\n\s*/g, '') // Remove newlines and following whitespace
      .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
      .replace(/>\s+</g, '><') // Remove whitespace between tags
      .replace(/\s+>/g, '>') // Remove whitespace before closing brackets
      .replace(/<\s+/g, '<') // Remove whitespace after opening brackets
      .trim();
  }

  /**
   * Compress HTML to fit within size limit
   */
  private compressHTML(html: string, maxSize: number): string {
    if (html.length <= maxSize) {
      return html;
    }
    
    console.warn(`HTML payload too large (${html.length} bytes), compressing to ${maxSize} bytes`);
    
    let compressed = html;
    
    // Progressive compression strategies - more aggressive for better AI processing
    const strategies = [
      () => this.removeNonEssentialElements(compressed),
      () => this.keepOnlyFormElements(compressed), // Move this earlier for better results
      () => this.truncateTextContent(compressed, 20),
      () => this.removeAttributeValues(compressed),
      () => this.truncateTextContent(compressed, 10),
      () => this.createMinimalFormSummary(compressed),
    ];
    
    for (const strategy of strategies) {
      if (compressed.length <= maxSize) break;
      compressed = strategy();
    }
    
    // Final truncation if still too large
    if (compressed.length > maxSize) {
      compressed = compressed.substring(0, maxSize - 100) + '<!-- truncated -->';
    }
    
    return compressed;
  }

  /**
   * Remove non-essential elements for compression
   */
  private removeNonEssentialElements(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove elements that don't contribute to form understanding
    const nonEssential = tempDiv.querySelectorAll('img, video, audio, canvas, svg, script, style');
    nonEssential.forEach(element => element.remove());
    
    return tempDiv.innerHTML;
  }

  /**
   * Truncate text content to reduce size
   */
  private truncateTextContent(html: string, maxLength: number): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent && node.textContent.length > maxLength) {
        node.textContent = node.textContent.substring(0, maxLength) + '...';
      }
    }
    
    return tempDiv.innerHTML;
  }

  /**
   * Remove attribute values to save space
   */
  private removeAttributeValues(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    tempDiv.querySelectorAll('*').forEach(element => {
      Array.from(element.attributes).forEach(attr => {
        // Keep essential form attributes with values
        const essentialAttributes = ['type', 'name', 'id', 'value', 'for', 'action', 'method'];
        if (!essentialAttributes.includes(attr.name)) {
          if (attr.value.length > 10) {
            element.setAttribute(attr.name, '');
          }
        }
      });
    });
    
    return tempDiv.innerHTML;
  }

  /**
   * Keep only form-related elements as last resort
   */
  private keepOnlyFormElements(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const newContainer = document.createElement('div');
    newContainer.setAttribute('data-extracted-forms', 'true');
    
    // Extract only essential form elements with their context
    const formElements = tempDiv.querySelectorAll('form, input, select, textarea, button');
    const labels = tempDiv.querySelectorAll('label');
    const fieldsets = tempDiv.querySelectorAll('fieldset, legend');
    
    // Create a simplified structure
    formElements.forEach((element, index) => {
      const simplifiedElement = this.createSimplifiedFormElement(element);
      
      // Find associated label
      const associatedLabel = this.findAssociatedLabel(element, labels);
      if (associatedLabel) {
        const labelClone = document.createElement('label');
        labelClone.textContent = associatedLabel.textContent?.trim() || '';
        if (associatedLabel.getAttribute('for')) {
          labelClone.setAttribute('for', associatedLabel.getAttribute('for')!);
        }
        newContainer.appendChild(labelClone);
      }
      
      newContainer.appendChild(simplifiedElement);
    });
    
    return newContainer.innerHTML;
  }

  /**
   * Create a simplified version of a form element with only essential attributes
   */
  private createSimplifiedFormElement(element: Element): Element {
    const tagName = element.tagName.toLowerCase();
    const simplified = document.createElement(tagName);
    
    // Essential attributes to preserve
    const essentialAttributes = [
      'type', 'name', 'id', 'value', 'placeholder', 'required', 
      'multiple', 'min', 'max', 'step', 'pattern', 'action', 'method'
    ];
    
    essentialAttributes.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value !== null) {
        simplified.setAttribute(attr, value);
      }
    });
    
    // For select elements, include options
    if (tagName === 'select') {
      const options = element.querySelectorAll('option');
      options.forEach(option => {
        const optionClone = document.createElement('option');
        optionClone.value = option.getAttribute('value') || '';
        optionClone.textContent = option.textContent?.trim() || '';
        if (option.hasAttribute('selected')) {
          optionClone.setAttribute('selected', '');
        }
        simplified.appendChild(optionClone);
      });
    }
    
    // For fieldsets, include legend text
    if (tagName === 'fieldset') {
      const legend = element.querySelector('legend');
      if (legend) {
        const legendClone = document.createElement('legend');
        legendClone.textContent = legend.textContent?.trim() || '';
        simplified.appendChild(legendClone);
      }
    }
    
    return simplified;
  }

  /**
   * Find the label associated with a form element
   */
  private findAssociatedLabel(element: Element, labels: NodeListOf<Element>): Element | null {
    const elementId = element.getAttribute('id');
    const elementName = element.getAttribute('name');
    
    // Look for label with matching 'for' attribute
    if (elementId) {
      for (const label of labels) {
        if (label.getAttribute('for') === elementId) {
          return label;
        }
      }
    }
    
    // Look for parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel;
    }
    
    // Look for nearby label (heuristic)
    if (elementName) {
      for (const label of labels) {
        const labelText = label.textContent?.toLowerCase() || '';
        const nameText = elementName.toLowerCase();
        if (labelText.includes(nameText) || nameText.includes(labelText)) {
          return label;
        }
      }
    }
    
    return null;
  }

  /**
   * Create a minimal form summary as last resort compression
   */
  private createMinimalFormSummary(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const summary = document.createElement('div');
    summary.setAttribute('data-form-summary', 'true');
    
    // Extract just the essential form field information
    const formElements = tempDiv.querySelectorAll('input, select, textarea');
    
    formElements.forEach((element, index) => {
      const field = document.createElement('input');
      
      // Copy only the most essential attributes
      const type = element.getAttribute('type') || element.tagName.toLowerCase();
      const name = element.getAttribute('name') || `field_${index}`;
      const id = element.getAttribute('id') || name;
      const placeholder = element.getAttribute('placeholder') || '';
      const required = element.hasAttribute('required');
      
      field.setAttribute('type', type);
      field.setAttribute('name', name);
      field.setAttribute('id', id);
      
      if (placeholder) field.setAttribute('placeholder', placeholder);
      if (required) field.setAttribute('required', '');
      
      // For select elements, add a data attribute with options
      if (element.tagName.toLowerCase() === 'select') {
        const options = Array.from(element.querySelectorAll('option'))
          .map(opt => opt.textContent?.trim() || opt.getAttribute('value') || '')
          .filter(opt => opt.length > 0)
          .slice(0, 5); // Limit to first 5 options
        
        if (options.length > 0) {
          field.setAttribute('data-options', options.join('|'));
        }
      }
      
      summary.appendChild(field);
    });
    
    return summary.innerHTML;
  }

  /**
   * Generates metadata about the extracted forms
   */
  private generateMetadata(originalForms: HTMLFormElement[], extractedContainer: HTMLElement): FormMetadata {
    const fieldTypes: Record<string, number> = {};
    let fieldCount = 0;
    let hasFileUploads = false;
    let hasMultiStep = false;
    
    // Count field types
    const inputs = extractedContainer.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      fieldCount++;
      
      const type = input.getAttribute('type') || input.tagName.toLowerCase();
      fieldTypes[type] = (fieldTypes[type] || 0) + 1;
      
      if (type === 'file') {
        hasFileUploads = true;
      }
    });
    
    // Check for multi-step indicators
    const stepIndicators = extractedContainer.querySelectorAll('[class*="step"], [data-step], .wizard, .progress');
    hasMultiStep = stepIndicators.length > 0;
    
    // Estimate complexity
    const estimatedComplexity = this.estimateComplexity(fieldCount, Object.keys(fieldTypes).length, hasFileUploads, hasMultiStep);
    
    return {
      url: window.location.href,
      timestamp: new Date(),
      formCount: originalForms.length,
      fieldCount,
      pageTitle: document.title || 'Untitled Page',
      fieldTypes,
      hasFileUploads,
      hasMultiStep,
      estimatedComplexity
    };
  }

  /**
   * Estimates form complexity based on various factors
   */
  private estimateComplexity(fieldCount: number, typeVariety: number, hasFileUploads: boolean, hasMultiStep: boolean): 'low' | 'medium' | 'high' {
    let complexityScore = 0;
    
    // Field count contribution
    if (fieldCount > 20) complexityScore += 3;
    else if (fieldCount > 10) complexityScore += 2;
    else if (fieldCount > 5) complexityScore += 1;
    
    // Type variety contribution
    if (typeVariety > 8) complexityScore += 2;
    else if (typeVariety > 4) complexityScore += 1;
    
    // Special features
    if (hasFileUploads) complexityScore += 2;
    if (hasMultiStep) complexityScore += 3;
    
    if (complexityScore >= 6) return 'high';
    if (complexityScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Generates a hash for the HTML content for caching purposes
   */
  generateHTMLHash(html: string): string {
    // Simple hash function for caching
    let hash = 0;
    if (html.length === 0) return hash.toString();
    
    for (let i = 0; i < html.length; i++) {
      const char = html.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const htmlExtractor = new HTMLExtractor();