/**
 * Intelligent Form Detection System
 * Multi-strategy form detection engine with framework-specific support
 */

import type { FormField, DetectedForm, JobPlatform, FieldType } from '@extension/shared';

export interface DetectionStrategy {
  name: string;
  priority: number;
  detect(container: HTMLElement): Promise<FormField[]>;
  confidence: number;
}

export interface FieldPattern {
  selector: string;
  mapping: string;
  confidence: number;
  lastUsed: number;
  successCount: number;
  attributes: {
    tagName: string;
    className: string;
    id: string;
    type: string;
    role: string;
    ariaLabel: string;
    placeholder: string;
    name: string;
  };
  context: {
    parentSelectors: string[];
    siblingText: string[];
    labelText: string;
    nearbyText: string[];
  };
}

export interface ComponentDetectionResult {
  type: 'react-select' | 'vue-select' | 'angular-material' | 'custom' | 'standard';
  element: HTMLElement;
  confidence: number;
  interactionMethod: 'click' | 'type' | 'simulate' | 'api';
  metadata: {
    framework: string;
    version?: string;
    library?: string;
    customProps?: Record<string, any>;
  };
}

/**
 * Universal component detection system with multi-strategy approach
 */
export class IntelligentDetector {
  private strategies: DetectionStrategy[] = [];
  private patterns: Map<string, FieldPattern> = new Map();
  private shadowRootCache = new WeakMap<Element, ShadowRoot>();

  constructor() {
    this.initializeStrategies();
    this.loadLearnedPatterns();
  }

  /**
   * Initialize detection strategies in priority order
   */
  private initializeStrategies(): void {
    this.strategies = [
      new ARIABasedDetection(1),
      new FrameworkSpecificDetection(2),
      new SemanticPatternDetection(3),
      new VisualLayoutDetection(4),
      new FallbackDetection(5)
    ];

    // Sort by priority (lower number = higher priority)
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Load previously learned patterns from storage
   */
  private async loadLearnedPatterns(): Promise<void> {
    try {
      const stored = localStorage.getItem('autofill_learned_patterns');
      if (stored) {
        const patterns = JSON.parse(stored);
        for (const [key, pattern] of Object.entries(patterns)) {
          this.patterns.set(key, pattern as FieldPattern);
        }
      }
    } catch (error) {
      console.warn('Failed to load learned patterns:', error);
    }
  }

  /**
   * Save learned patterns to storage
   */
  private async saveLearnedPatterns(): Promise<void> {
    try {
      const patterns = Object.fromEntries(this.patterns);
      localStorage.setItem('autofill_learned_patterns', JSON.stringify(patterns));
    } catch (error) {
      console.warn('Failed to save learned patterns:', error);
    }
  }

  /**
   * Detect forms using all available strategies
   */
  async detectForms(container: HTMLElement = document.body): Promise<DetectedForm[]> {
    const detectedForms: DetectedForm[] = [];

    // First, try to find traditional form elements
    const forms = this.findFormElements(container);
    for (const form of forms) {
      const detectedForm = await this.analyzeFormElement(form);
      if (detectedForm) {
        detectedForms.push(detectedForm);
      }
    }

    // If no forms found, analyze container as potential SPA form
    if (detectedForms.length === 0) {
      const containerForm = await this.analyzeContainer(container);
      if (containerForm) {
        detectedForms.push(containerForm);
      }
    }

    return detectedForms;
  }

  /**
   * Find all form elements including those in shadow DOM
   */
  private findFormElements(container: HTMLElement): HTMLFormElement[] {
    const forms: HTMLFormElement[] = [];

    // Regular DOM forms
    const regularForms = container.querySelectorAll('form');
    forms.push(...Array.from(regularForms));

    // Shadow DOM forms
    const shadowForms = this.findShadowDOMForms(container);
    forms.push(...shadowForms);

    return forms;
  }

  /**
   * Find forms within shadow DOM elements
   */
  private findShadowDOMForms(container: HTMLElement): HTMLFormElement[] {
    const forms: HTMLFormElement[] = [];
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const element = node as Element;
          return element.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      const element = node as Element;
      if (element.shadowRoot) {
        const shadowForms = element.shadowRoot.querySelectorAll('form');
        forms.push(...Array.from(shadowForms));
        
        // Cache shadow root for later use
        this.shadowRootCache.set(element, element.shadowRoot);
        
        // Recursively search nested shadow DOMs
        const nestedForms = this.findShadowDOMForms(element.shadowRoot as any);
        forms.push(...nestedForms);
      }
    }

    return forms;
  }

  /**
   * Analyze a form element using all detection strategies
   */
  private async analyzeFormElement(form: HTMLFormElement): Promise<DetectedForm | null> {
    const fields: FormField[] = [];

    // Apply each detection strategy
    for (const strategy of this.strategies) {
      try {
        const strategyFields = await strategy.detect(form);
        
        // Merge fields, avoiding duplicates
        for (const field of strategyFields) {
          if (!fields.some(f => f.selector === field.selector)) {
            fields.push(field);
          }
        }
      } catch (error) {
        console.warn(`Detection strategy ${strategy.name} failed:`, error);
      }
    }

    if (fields.length === 0) {
      return null;
    }

    return {
      platform: this.detectPlatform(),
      formId: this.generateFormId(form),
      url: window.location.href,
      fields,
      confidence: this.calculateFormConfidence(fields),
      supportedFeatures: this.getSupportedFeatures(fields),
      detectedAt: new Date(),
      isMultiStep: this.isMultiStepForm(form),
      currentStep: this.getCurrentStep(form),
      totalSteps: this.getTotalSteps(form)
    };
  }

  /**
   * Analyze container as potential form (for SPA applications)
   */
  private async analyzeContainer(container: HTMLElement): Promise<DetectedForm | null> {
    const fields: FormField[] = [];

    // Apply detection strategies to container
    for (const strategy of this.strategies) {
      try {
        const strategyFields = await strategy.detect(container);
        
        for (const field of strategyFields) {
          if (!fields.some(f => f.selector === field.selector)) {
            fields.push(field);
          }
        }
      } catch (error) {
        console.warn(`Container detection strategy ${strategy.name} failed:`, error);
      }
    }

    // Require minimum number of fields for container-based detection
    if (fields.length < 3) {
      return null;
    }

    return {
      platform: this.detectPlatform(),
      formId: this.generateContainerId(container),
      url: window.location.href,
      fields,
      confidence: this.calculateFormConfidence(fields) * 0.8, // Lower confidence for container detection
      supportedFeatures: this.getSupportedFeatures(fields),
      detectedAt: new Date(),
      isMultiStep: this.isMultiStepContainer(container),
      currentStep: this.getCurrentStepFromContainer(container),
      totalSteps: this.getTotalStepsFromContainer(container)
    };
  }

  /**
   * Learn from successful form interactions
   */
  learnFromSuccessfulFill(field: HTMLElement, mapping: string): void {
    const pattern = this.extractPattern(field);
    const domain = window.location.hostname;
    const key = `${domain}:${pattern.signature}`;
    
    const existingPattern = this.patterns.get(key);
    if (existingPattern) {
      existingPattern.successCount++;
      existingPattern.lastUsed = Date.now();
      existingPattern.confidence = Math.min(existingPattern.confidence + 0.1, 1.0);
    } else {
      this.patterns.set(key, {
        selector: pattern.selector,
        mapping: mapping,
        confidence: 0.7,
        lastUsed: Date.now(),
        successCount: 1,
        attributes: pattern.attributes,
        context: pattern.context
      });
    }

    this.saveLearnedPatterns();
  }

  /**
   * Predict field mapping based on learned patterns
   */
  predictFieldMapping(field: HTMLElement): string | null {
    const pattern = this.extractPattern(field);
    const domain = window.location.hostname;
    
    // Try domain-specific pattern first
    const domainKey = `${domain}:${pattern.signature}`;
    const domainPattern = this.patterns.get(domainKey);
    if (domainPattern && domainPattern.confidence > 0.8) {
      return domainPattern.mapping;
    }
    
    // Try cross-domain patterns with high confidence
    for (const [key, value] of this.patterns) {
      if (key.includes(pattern.signature) && value.confidence > 0.9) {
        return value.mapping;
      }
    }
    
    return null;
  }

  /**
   * Extract pattern signature from field element
   */
  private extractPattern(field: HTMLElement): {
    signature: string;
    selector: string;
    attributes: FieldPattern['attributes'];
    context: FieldPattern['context'];
  } {
    const attributes = {
      tagName: field.tagName.toLowerCase(),
      className: field.className,
      id: field.id,
      type: field.getAttribute('type') || '',
      role: field.getAttribute('role') || '',
      ariaLabel: field.getAttribute('aria-label') || '',
      placeholder: field.getAttribute('placeholder') || '',
      name: field.getAttribute('name') || ''
    };

    const context = {
      parentSelectors: this.getParentSelectors(field),
      siblingText: this.getSiblingText(field),
      labelText: this.getAssociatedLabelText(field),
      nearbyText: this.getNearbyText(field)
    };

    // Create signature from key attributes
    const signature = [
      attributes.tagName,
      attributes.type,
      attributes.name,
      attributes.id,
      attributes.ariaLabel,
      attributes.placeholder
    ].filter(Boolean).join('|');

    return {
      signature,
      selector: this.generateOptimalSelector(field),
      attributes,
      context
    };
  }

  /**
   * Get parent element selectors for context
   */
  private getParentSelectors(element: HTMLElement): string[] {
    const selectors: string[] = [];
    let parent = element.parentElement;
    let depth = 0;

    while (parent && depth < 3) {
      if (parent.className) {
        selectors.push(`.${parent.className.split(' ')[0]}`);
      }
      if (parent.id) {
        selectors.push(`#${parent.id}`);
      }
      parent = parent.parentElement;
      depth++;
    }

    return selectors;
  }

  /**
   * Get text from sibling elements
   */
  private getSiblingText(element: HTMLElement): string[] {
    const text: string[] = [];
    
    // Previous sibling
    if (element.previousElementSibling) {
      const prevText = element.previousElementSibling.textContent?.trim();
      if (prevText && prevText.length < 100) {
        text.push(prevText);
      }
    }

    // Next sibling
    if (element.nextElementSibling) {
      const nextText = element.nextElementSibling.textContent?.trim();
      if (nextText && nextText.length < 100) {
        text.push(nextText);
      }
    }

    return text;
  }

  /**
   * Get associated label text
   */
  private getAssociatedLabelText(element: HTMLElement): string {
    // Try label[for] association
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        return label.textContent?.trim() || '';
      }
    }

    // Try parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel.textContent?.trim() || '';
    }

    // Try aria-labelledby
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement) {
        return labelElement.textContent?.trim() || '';
      }
    }

    return '';
  }

  /**
   * Get nearby text for context
   */
  private getNearbyText(element: HTMLElement): string[] {
    const text: string[] = [];
    const rect = element.getBoundingClientRect();
    
    // Find text elements near the field
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const textNode = node as Text;
          const parent = textNode.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const parentRect = parent.getBoundingClientRect();
          const distance = Math.sqrt(
            Math.pow(parentRect.left - rect.left, 2) + 
            Math.pow(parentRect.top - rect.top, 2)
          );
          
          return distance < 100 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      const textContent = node.textContent?.trim();
      if (textContent && textContent.length > 2 && textContent.length < 50) {
        text.push(textContent);
      }
    }

    return text.slice(0, 5); // Limit to 5 nearby text elements
  }

  /**
   * Generate optimal CSS selector for element
   */
  private generateOptimalSelector(element: HTMLElement): string {
    // Prefer ID if available and unique
    if (element.id && document.querySelectorAll(`#${element.id}`).length === 1) {
      return `#${element.id}`;
    }

    // Try name attribute
    const name = element.getAttribute('name');
    if (name && document.querySelectorAll(`[name="${name}"]`).length === 1) {
      return `[name="${name}"]`;
    }

    // Try data-testid
    const testId = element.getAttribute('data-testid');
    if (testId && document.querySelectorAll(`[data-testid="${testId}"]`).length === 1) {
      return `[data-testid="${testId}"]`;
    }

    // Build selector using class and position
    const tagName = element.tagName.toLowerCase();
    const className = element.className.split(' ')[0];
    
    if (className) {
      const classSelector = `${tagName}.${className}`;
      const elements = document.querySelectorAll(classSelector);
      if (elements.length === 1) {
        return classSelector;
      } else {
        const index = Array.from(elements).indexOf(element);
        return `${classSelector}:nth-of-type(${index + 1})`;
      }
    }

    // Fallback to nth-of-type
    const siblings = Array.from(element.parentElement?.children || [])
      .filter(el => el.tagName === element.tagName);
    const index = siblings.indexOf(element);
    return `${tagName}:nth-of-type(${index + 1})`;
  }

  /**
   * Detect platform from URL and page content
   */
  private detectPlatform(): JobPlatform {
    const hostname = window.location.hostname.toLowerCase();
    const url = window.location.href.toLowerCase();

    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (hostname.includes('workday') || hostname.includes('myworkdayjobs.com')) return 'workday';
    if (hostname.includes('smartrecruiters.com')) return 'smartrecruiters';
    if (hostname.includes('greenhouse.io')) return 'greenhouse';
    if (hostname.includes('lever.co')) return 'lever';
    if (hostname.includes('bamboohr.com')) return 'bamboohr';

    return 'custom';
  }

  /**
   * Calculate form confidence based on detected fields
   */
  private calculateFormConfidence(fields: FormField[]): number {
    let score = 0;

    // Base score for having fields
    score += Math.min(fields.length * 0.05, 0.3);

    // Bonus for mapped fields
    const mappedFields = fields.filter(f => f.mappedProfileField);
    score += mappedFields.length * 0.1;

    // Bonus for job-related fields
    const jobFields = fields.filter(f => {
      const label = f.label.toLowerCase();
      return label.includes('resume') || 
             label.includes('experience') || 
             label.includes('salary') ||
             label.includes('cover letter');
    });
    score += jobFields.length * 0.15;

    // Bonus for personal info fields
    const personalFields = fields.filter(f => 
      f.mappedProfileField?.startsWith('personalInfo')
    );
    score += personalFields.length * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Get supported features based on detected fields
   */
  private getSupportedFeatures(fields: FormField[]): string[] {
    const features = ['basic_autofill'];

    if (fields.some(f => f.type === 'file')) {
      features.push('file_upload');
    }

    if (fields.some(f => f.type === 'textarea')) {
      features.push('ai_content');
    }

    if (fields.some(f => f.type === 'select')) {
      features.push('dropdown_selection');
    }

    return features;
  }

  /**
   * Generate form ID
   */
  private generateFormId(form: HTMLFormElement): string {
    if (form.id) return form.id;
    if (form.name) return form.name;
    return `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate container ID
   */
  private generateContainerId(container: HTMLElement): string {
    if (container.id) return `container_${container.id}`;
    const className = container.className.split(' ')[0];
    if (className) return `container_${className}`;
    return `container_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if form is multi-step
   */
  private isMultiStepForm(form: HTMLFormElement): boolean {
    const stepSelectors = [
      '.step', '.wizard-step', '[data-step]', '.progress-step',
      '.stepper', '.form-step', '[class*="step"]'
    ];
    
    return stepSelectors.some(selector => 
      form.querySelectorAll(selector).length > 1
    );
  }

  /**
   * Check if container is multi-step
   */
  private isMultiStepContainer(container: HTMLElement): boolean {
    const stepSelectors = [
      '.step', '.wizard-step', '[data-step]', '.progress-step',
      '.stepper', '.form-step', '[class*="step"]'
    ];
    
    return stepSelectors.some(selector => 
      container.querySelectorAll(selector).length > 1
    );
  }

  /**
   * Get current step from form
   */
  private getCurrentStep(form: HTMLFormElement): number | undefined {
    const activeSelectors = [
      '.step.active', '.wizard-step.active', '[data-step].active',
      '.step.current', '.wizard-step.current', '[data-step].current'
    ];
    
    for (const selector of activeSelectors) {
      const activeStep = form.querySelector(selector);
      if (activeStep) {
        const stepAttr = activeStep.getAttribute('data-step');
        if (stepAttr) return parseInt(stepAttr);
      }
    }
    
    return undefined;
  }

  /**
   * Get current step from container
   */
  private getCurrentStepFromContainer(container: HTMLElement): number | undefined {
    const activeSelectors = [
      '.step.active', '.wizard-step.active', '[data-step].active',
      '.step.current', '.wizard-step.current', '[data-step].current'
    ];
    
    for (const selector of activeSelectors) {
      const activeStep = container.querySelector(selector);
      if (activeStep) {
        const stepAttr = activeStep.getAttribute('data-step');
        if (stepAttr) return parseInt(stepAttr);
      }
    }
    
    return undefined;
  }

  /**
   * Get total steps from form
   */
  private getTotalSteps(form: HTMLFormElement): number | undefined {
    const stepSelectors = [
      '.step', '.wizard-step', '[data-step]', '.progress-step'
    ];
    
    for (const selector of stepSelectors) {
      const steps = form.querySelectorAll(selector);
      if (steps.length > 1) return steps.length;
    }
    
    return undefined;
  }

  /**
   * Get total steps from container
   */
  private getTotalStepsFromContainer(container: HTMLElement): number | undefined {
    const stepSelectors = [
      '.step', '.wizard-step', '[data-step]', '.progress-step'
    ];
    
    for (const selector of stepSelectors) {
      const steps = container.querySelectorAll(selector);
      if (steps.length > 1) return steps.length;
    }
    
    return undefined;
  }
}

/**
 * ARIA-based detection strategy
 */
class ARIABasedDetection implements DetectionStrategy {
  name = 'ARIA-based Detection';
  priority = 1;
  confidence = 0.9;

  async detect(container: HTMLElement): Promise<FormField[]> {
    const fields: FormField[] = [];
    
    // Find elements with ARIA roles
    const ariaElements = container.querySelectorAll([
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="listbox"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="button"][aria-pressed]',
      '[aria-label]',
      '[aria-labelledby]'
    ].join(', '));

    for (let i = 0; i < ariaElements.length; i++) {
      const element = ariaElements[i] as HTMLElement;
      const field = await this.analyzeARIAElement(element, i);
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  private async analyzeARIAElement(element: HTMLElement, index: number): Promise<FormField | null> {
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    
    let type: FieldType = 'text';
    
    switch (role) {
      case 'textbox':
        type = element.getAttribute('type') === 'email' ? 'email' : 'text';
        break;
      case 'combobox':
        type = 'select';
        break;
      case 'checkbox':
        type = 'checkbox';
        break;
      case 'radio':
        type = 'radio';
        break;
    }

    let label = ariaLabel || '';
    if (!label && ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement) {
        label = labelElement.textContent?.trim() || '';
      }
    }

    if (!label) {
      label = `ARIA Field ${index + 1}`;
    }

    return {
      id: `aria_field_${index}`,
      type,
      label: this.cleanLabel(label),
      selector: this.generateSelector(element),
      required: element.getAttribute('aria-required') === 'true',
      placeholder: element.getAttribute('placeholder') || undefined,
      mappedProfileField: this.mapToProfile(label, type),
      validationRules: []
    };
  }

  private generateSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');
    
    if (ariaLabel) {
      return `[aria-label="${ariaLabel}"]`;
    }
    
    if (role) {
      return `[role="${role}"]`;
    }
    
    return element.tagName.toLowerCase();
  }

  private cleanLabel(label: string): string {
    return label.trim().replace(/[*:]+$/, '').trim();
  }

  private mapToProfile(label: string, type: FieldType): string | undefined {
    const labelLower = label.toLowerCase();
    
    // Basic mappings - more comprehensive mapping would be in the main detector
    if (labelLower.includes('first') && labelLower.includes('name')) {
      return 'personalInfo.firstName';
    }
    if (labelLower.includes('last') && labelLower.includes('name')) {
      return 'personalInfo.lastName';
    }
    if (labelLower.includes('email')) {
      return 'personalInfo.email';
    }
    if (labelLower.includes('phone')) {
      return 'personalInfo.phone';
    }
    
    return undefined;
  }
}

/**
 * Framework-specific detection strategy
 */
class FrameworkSpecificDetection implements DetectionStrategy {
  name = 'Framework-specific Detection';
  priority = 2;
  confidence = 0.85;

  async detect(container: HTMLElement): Promise<FormField[]> {
    const fields: FormField[] = [];
    
    // React component detection
    const reactFields = await this.detectReactComponents(container);
    fields.push(...reactFields);
    
    // Vue component detection
    const vueFields = await this.detectVueComponents(container);
    fields.push(...vueFields);
    
    // Angular component detection
    const angularFields = await this.detectAngularComponents(container);
    fields.push(...angularFields);
    
    return fields;
  }

  private async detectReactComponents(container: HTMLElement): Promise<FormField[]> {
    const fields: FormField[] = [];
    
    // React Select patterns
    const reactSelectSelectors = [
      '.react-select__control',
      '[class*="select__control"]',
      '[class*="Select-control"]',
      '.select-shell'
    ];
    
    for (const selector of reactSelectSelectors) {
      const elements = container.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        const field = await this.analyzeReactSelect(element, i);
        if (field) {
          fields.push(field);
        }
      }
    }
    
    // React input components
    const reactInputs = container.querySelectorAll('[data-reactroot] input, [class*="Input"], [class*="TextField"]');
    for (let i = 0; i < reactInputs.length; i++) {
      const element = reactInputs[i] as HTMLElement;
      const field = await this.analyzeReactInput(element, i);
      if (field) {
        fields.push(field);
      }
    }
    
    return fields;
  }

  private async detectVueComponents(container: HTMLElement): Promise<FormField[]> {
    const fields: FormField[] = [];
    
    // Vue component patterns
    const vueSelectors = [
      '[class*="v-input"]',
      '[class*="v-select"]',
      '[class*="v-text-field"]',
      '[class*="el-input"]',
      '[class*="el-select"]'
    ];
    
    for (const selector of vueSelectors) {
      const elements = container.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        const field = await this.analyzeVueComponent(element, i);
        if (field) {
          fields.push(field);
        }
      }
    }
    
    return fields;
  }

  private async detectAngularComponents(container: HTMLElement): Promise<FormField[]> {
    const fields: FormField[] = [];
    
    // Angular Material patterns
    const angularSelectors = [
      'mat-form-field',
      'mat-input-container',
      'mat-select',
      '[class*="mat-input"]',
      '[class*="mat-select"]'
    ];
    
    for (const selector of angularSelectors) {
      const elements = container.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement;
        const field = await this.analyzeAngularComponent(element, i);
        if (field) {
          fields.push(field);
        }
      }
    }
    
    return fields;
  }

  private async analyzeReactSelect(element: HTMLElement, index: number): Promise<FormField | null> {
    const input = element.querySelector('input') as HTMLInputElement;
    if (!input) return null;
    
    const label = this.getReactSelectLabel(element);
    
    return {
      id: `react_select_${index}`,
      type: 'select',
      label,
      selector: this.generateReactSelectSelector(element),
      required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
      placeholder: this.getReactSelectPlaceholder(element),
      mappedProfileField: this.mapToProfile(label, 'select'),
      validationRules: []
    };
  }

  private async analyzeReactInput(element: HTMLElement, index: number): Promise<FormField | null> {
    const input = element.tagName === 'INPUT' ? element as HTMLInputElement : 
                  element.querySelector('input') as HTMLInputElement;
    
    if (!input) return null;
    
    const type = this.getInputType(input);
    const label = this.getInputLabel(element);
    
    return {
      id: `react_input_${index}`,
      type,
      label,
      selector: this.generateInputSelector(input),
      required: input.hasAttribute('required'),
      placeholder: input.placeholder,
      mappedProfileField: this.mapToProfile(label, type),
      validationRules: []
    };
  }

  private async analyzeVueComponent(element: HTMLElement, index: number): Promise<FormField | null> {
    const input = element.querySelector('input, textarea, select') as HTMLInputElement;
    if (!input) return null;
    
    const type = this.getInputType(input);
    const label = this.getVueComponentLabel(element);
    
    return {
      id: `vue_component_${index}`,
      type,
      label,
      selector: this.generateVueSelector(element),
      required: input.hasAttribute('required'),
      placeholder: input.placeholder,
      mappedProfileField: this.mapToProfile(label, type),
      validationRules: []
    };
  }

  private async analyzeAngularComponent(element: HTMLElement, index: number): Promise<FormField | null> {
    const input = element.querySelector('input, textarea, select') as HTMLInputElement;
    if (!input) return null;
    
    const type = this.getInputType(input);
    const label = this.getAngularComponentLabel(element);
    
    return {
      id: `angular_component_${index}`,
      type,
      label,
      selector: this.generateAngularSelector(element),
      required: input.hasAttribute('required'),
      placeholder: input.placeholder,
      mappedProfileField: this.mapToProfile(label, type),
      validationRules: []
    };
  }

  private getReactSelectLabel(element: HTMLElement): string {
    // Try various label sources for React Select
    const labelSelectors = [
      '.react-select__label',
      '.select__label',
      'label',
      '[class*="label"]'
    ];
    
    for (const selector of labelSelectors) {
      const labelEl = element.querySelector(selector) || 
                     element.parentElement?.querySelector(selector);
      if (labelEl?.textContent) {
        return labelEl.textContent.trim();
      }
    }
    
    const placeholder = this.getReactSelectPlaceholder(element);
    return placeholder || 'Select Field';
  }

  private getReactSelectPlaceholder(element: HTMLElement): string | undefined {
    const placeholder = element.querySelector('.react-select__placeholder, [class*="placeholder"]');
    return placeholder?.textContent?.trim() || undefined;
  }

  private generateReactSelectSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    
    const classes = element.className.split(' ').filter(c => c.includes('select'));
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
    
    return '.react-select__control';
  }

  private getInputLabel(element: HTMLElement): string {
    // Try to find label for input
    const input = element.tagName === 'INPUT' ? element : element.querySelector('input');
    if (!input) return 'Unknown Field';
    
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent?.trim() || '';
    }
    
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || '';
    
    return input.getAttribute('placeholder') || input.getAttribute('name') || 'Input Field';
  }

  private getVueComponentLabel(element: HTMLElement): string {
    const labelSelectors = [
      '.v-label',
      '.el-form-item__label',
      'label',
      '[class*="label"]'
    ];
    
    for (const selector of labelSelectors) {
      const labelEl = element.querySelector(selector) || 
                     element.parentElement?.querySelector(selector);
      if (labelEl?.textContent) {
        return labelEl.textContent.trim();
      }
    }
    
    return 'Vue Component Field';
  }

  private getAngularComponentLabel(element: HTMLElement): string {
    const labelSelectors = [
      'mat-label',
      '.mat-form-field-label',
      'label',
      '[class*="label"]'
    ];
    
    for (const selector of labelSelectors) {
      const labelEl = element.querySelector(selector) || 
                     element.parentElement?.querySelector(selector);
      if (labelEl?.textContent) {
        return labelEl.textContent.trim();
      }
    }
    
    return 'Angular Component Field';
  }

  private generateInputSelector(input: HTMLInputElement): string {
    if (input.id) return `#${input.id}`;
    if (input.name) return `[name="${input.name}"]`;
    return 'input';
  }

  private generateVueSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    
    const classes = element.className.split(' ').filter(c => c.startsWith('v-') || c.startsWith('el-'));
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
    
    return element.tagName.toLowerCase();
  }

  private generateAngularSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    
    const tagName = element.tagName.toLowerCase();
    if (tagName.startsWith('mat-')) {
      return tagName;
    }
    
    const classes = element.className.split(' ').filter(c => c.startsWith('mat-'));
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
    
    return tagName;
  }

  private getInputType(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): FieldType {
    if (input.tagName === 'TEXTAREA') return 'textarea';
    if (input.tagName === 'SELECT') return 'select';
    
    const inputEl = input as HTMLInputElement;
    const type = inputEl.type.toLowerCase();
    
    const typeMap: Record<string, FieldType> = {
      'text': 'text',
      'email': 'email',
      'tel': 'phone',
      'phone': 'phone',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'file': 'file',
      'date': 'date',
      'number': 'number',
      'url': 'url'
    };
    
    return typeMap[type] || 'text';
  }

  private mapToProfile(label: string, type: FieldType): string | undefined {
    const labelLower = label.toLowerCase();
    
    if (labelLower.includes('first') && labelLower.includes('name')) {
      return 'personalInfo.firstName';
    }
    if (labelLower.includes('last') && labelLower.includes('name')) {
      return 'personalInfo.lastName';
    }
    if (labelLower.includes('email')) {
      return 'personalInfo.email';
    }
    if (labelLower.includes('phone')) {
      return 'personalInfo.phone';
    }
    
    return undefined;
  }
}

/**
 * Semantic pattern detection strategy
 */
class SemanticPatternDetection implements DetectionStrategy {
  name = 'Semantic Pattern Detection';
  priority = 3;
  confidence = 0.75;

  async detect(container: HTMLElement): Promise<FormField[]> {
    const fields: FormField[] = [];
    
    // Find all input-like elements
    const inputElements = container.querySelectorAll([
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      'textarea',
      'select',
      '[contenteditable="true"]'
    ].join(', '));

    for (let i = 0; i < inputElements.length; i++) {
      const element = inputElements[i] as HTMLElement;
      const field = await this.analyzeSemanticField(element, i);
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  private async analyzeSemanticField(element: HTMLElement, index: number): Promise<FormField | null> {
    if (this.shouldSkipElement(element)) {
      return null;
    }

    const type = this.getFieldType(element);
    const label = this.extractSemanticLabel(element);
    const selector = this.generateSemanticSelector(element, index);

    return {
      id: `semantic_field_${index}`,
      type,
      label,
      selector,
      required: element.hasAttribute('required'),
      placeholder: element.getAttribute('placeholder') || undefined,
      mappedProfileField: this.mapSemanticField(element, label, type),
      validationRules: this.extractValidationRules(element)
    };
  }

  private shouldSkipElement(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true;
    }

    if (element.hasAttribute('disabled') || element.hasAttribute('readonly')) {
      return true;
    }

    const name = element.getAttribute('name')?.toLowerCase() || '';
    if (name.includes('csrf') || name.includes('token')) {
      return true;
    }

    return false;
  }

  private getFieldType(element: HTMLElement): FieldType {
    if (element.tagName === 'TEXTAREA') return 'textarea';
    if (element.tagName === 'SELECT') return 'select';
    
    const input = element as HTMLInputElement;
    const type = input.type?.toLowerCase() || 'text';
    
    const typeMap: Record<string, FieldType> = {
      'text': 'text',
      'email': 'email',
      'tel': 'phone',
      'phone': 'phone',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'file': 'file',
      'date': 'date',
      'number': 'number',
      'url': 'url'
    };
    
    return typeMap[type] || 'text';
  }

  private extractSemanticLabel(element: HTMLElement): string {
    // Multiple strategies to find semantic label
    const strategies = [
      () => this.getLabelByFor(element),
      () => this.getLabelByParent(element),
      () => this.getLabelByAria(element),
      () => this.getLabelByProximity(element),
      () => this.getLabelByPlaceholder(element),
      () => this.getLabelByName(element)
    ];

    for (const strategy of strategies) {
      const label = strategy();
      if (label && label.length > 0) {
        return this.cleanLabel(label);
      }
    }

    return 'Unknown Field';
  }

  private getLabelByFor(element: HTMLElement): string | null {
    if (!element.id) return null;
    const label = document.querySelector(`label[for="${element.id}"]`);
    return label?.textContent?.trim() || null;
  }

  private getLabelByParent(element: HTMLElement): string | null {
    const parentLabel = element.closest('label');
    if (parentLabel) {
      // Get text content excluding the input element itself
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      const inputs = clone.querySelectorAll('input, textarea, select');
      inputs.forEach(input => input.remove());
      return clone.textContent?.trim() || null;
    }
    return null;
  }

  private getLabelByAria(element: HTMLElement): string | null {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      return labelElement?.textContent?.trim() || null;
    }

    return null;
  }

  private getLabelByProximity(element: HTMLElement): string | null {
    // Look for text elements near the input
    const rect = element.getBoundingClientRect();
    const candidates: { element: Element; distance: number; text: string }[] = [];

    // Check siblings
    const siblings = [element.previousElementSibling, element.nextElementSibling];
    for (const sibling of siblings) {
      if (sibling && this.isLabelLikeElement(sibling)) {
        const text = sibling.textContent?.trim();
        if (text && text.length > 0 && text.length < 100) {
          candidates.push({ element: sibling, distance: 0, text });
        }
      }
    }

    // Check nearby elements
    const nearbyElements = document.querySelectorAll('label, span, div, p');
    for (const nearby of nearbyElements) {
      if (nearby === element || nearby.contains(element)) continue;
      
      const nearbyRect = nearby.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(nearbyRect.left - rect.left, 2) + 
        Math.pow(nearbyRect.top - rect.top, 2)
      );

      if (distance < 100) {
        const text = nearby.textContent?.trim();
        if (text && text.length > 0 && text.length < 100 && this.isLabelLikeElement(nearby)) {
          candidates.push({ element: nearby, distance, text });
        }
      }
    }

    // Return closest candidate
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0]?.text || null;
  }

  private getLabelByPlaceholder(element: HTMLElement): string | null {
    return element.getAttribute('placeholder') || null;
  }

  private getLabelByName(element: HTMLElement): string | null {
    const name = element.getAttribute('name');
    if (name) {
      return name.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return null;
  }

  private isLabelLikeElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const className = element.className.toLowerCase();
    
    return (
      tagName === 'label' ||
      tagName === 'span' ||
      tagName === 'div' ||
      tagName === 'p' ||
      className.includes('label') ||
      className.includes('field-label') ||
      className.includes('form-label')
    );
  }

  private cleanLabel(label: string): string {
    return label
      .trim()
      .replace(/[*:]+$/, '') // Remove trailing asterisks and colons
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  private generateSemanticSelector(element: HTMLElement, index: number): string {
    if (element.id) return `#${element.id}`;
    
    const name = element.getAttribute('name');
    if (name) return `[name="${name}"]`;
    
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) return `[data-testid="${dataTestId}"]`;
    
    const tagName = element.tagName.toLowerCase();
    return `${tagName}:nth-of-type(${index + 1})`;
  }

  private mapSemanticField(element: HTMLElement, label: string, type: FieldType): string | undefined {
    const labelLower = label.toLowerCase();
    const name = element.getAttribute('name')?.toLowerCase() || '';
    const id = element.getAttribute('id')?.toLowerCase() || '';
    const placeholder = element.getAttribute('placeholder')?.toLowerCase() || '';
    
    const allText = `${labelLower} ${name} ${id} ${placeholder}`.toLowerCase();

    // Enhanced mapping patterns
    const patterns = [
      { regex: /first.?name|given.?name|fname/, mapping: 'personalInfo.firstName' },
      { regex: /last.?name|family.?name|surname|lname/, mapping: 'personalInfo.lastName' },
      { regex: /^name$|full.?name|applicant.?name/, mapping: 'personalInfo.firstName' },
      { regex: /email|e-?mail/, mapping: 'personalInfo.email' },
      { regex: /phone|mobile|telephone|tel|contact.?number/, mapping: 'personalInfo.phone' },
      { regex: /address|street|addr/, mapping: 'personalInfo.address.street' },
      { regex: /city|town/, mapping: 'personalInfo.address.city' },
      { regex: /state|province|region/, mapping: 'personalInfo.address.state' },
      { regex: /zip|postal|postcode/, mapping: 'personalInfo.address.zipCode' },
      { regex: /country|nation/, mapping: 'personalInfo.address.country' },
      { regex: /linkedin|linked.?in/, mapping: 'personalInfo.linkedInUrl' },
      { regex: /portfolio|website|personal.?site/, mapping: 'personalInfo.portfolioUrl' },
      { regex: /github|git.?hub/, mapping: 'personalInfo.githubUrl' },
      { regex: /salary|compensation|expected.?salary/, mapping: 'preferences.jobPreferences.desiredSalaryMin' },
      { regex: /start.?date|available|availability/, mapping: 'preferences.jobPreferences.availableStartDate' },
      { regex: /work.?authorization|visa|sponsorship/, mapping: 'preferences.jobPreferences.workAuthorization' },
      { regex: /relocat|willing.?to.?move/, mapping: 'preferences.jobPreferences.willingToRelocate' },
      { regex: /cover.?letter|motivation|why.?interested/, mapping: 'professionalInfo.summary' },
      { regex: /summary|about|bio|description/, mapping: 'professionalInfo.summary' }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(allText)) {
        return pattern.mapping;
      }
    }

    // File upload specific mappings
    if (type === 'file') {
      if (/resume|cv|curriculum/.test(allText)) {
        return 'documents.resumes';
      }
      if (/cover.?letter|motivation.?letter/.test(allText)) {
        return 'documents.coverLetters';
      }
    }

    return undefined;
  }

  private extractValidationRules(element: HTMLElement): any[] {
    const rules: any[] = [];

    if (element.hasAttribute('required')) {
      rules.push({ type: 'required', message: 'This field is required' });
    }

    const maxLength = element.getAttribute('maxlength');
    if (maxLength) {
      rules.push({ 
        type: 'maxLength', 
        value: parseInt(maxLength), 
        message: `Maximum ${maxLength} characters` 
      });
    }

    const pattern = element.getAttribute('pattern');
    if (pattern) {
      rules.push({ 
        type: 'pattern', 
        value: pattern, 
        message: 'Invalid format' 
      });
    }

    return rules;
  }
}

/**
 * Visual layout detection strategy
 */
class VisualLayoutDetection implements DetectionStrategy {
  name = 'Visual Layout Detection';
  priority = 4;
  confidence = 0.6;

  async detect(container: HTMLElement): Promise<FormField[]> {
    const fields: FormField[] = [];
    
    // Find input clusters based on visual layout
    const inputClusters = this.findInputClusters(container);
    
    for (const cluster of inputClusters) {
      const clusterFields = await this.analyzeInputCluster(cluster);
      fields.push(...clusterFields);
    }

    return fields;
  }

  private findInputClusters(container: HTMLElement): HTMLElement[][] {
    const inputs = Array.from(container.querySelectorAll('input, textarea, select'))
      .filter(el => !this.shouldSkipElement(el as HTMLElement)) as HTMLElement[];

    const clusters: HTMLElement[][] = [];
    const processed = new Set<HTMLElement>();

    for (const input of inputs) {
      if (processed.has(input)) continue;

      const cluster = this.buildCluster(input, inputs, processed);
      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  private buildCluster(startInput: HTMLElement, allInputs: HTMLElement[], processed: Set<HTMLElement>): HTMLElement[] {
    const cluster: HTMLElement[] = [startInput];
    processed.add(startInput);

    const startRect = startInput.getBoundingClientRect();
    
    for (const input of allInputs) {
      if (processed.has(input)) continue;

      const inputRect = input.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(inputRect.left - startRect.left, 2) + 
        Math.pow(inputRect.top - startRect.top, 2)
      );

      // Group inputs that are close together (within 200px)
      if (distance < 200) {
        cluster.push(input);
        processed.add(input);
      }
    }

    return cluster;
  }

  private async analyzeInputCluster(cluster: HTMLElement[]): Promise<FormField[]> {
    const fields: FormField[] = [];

    for (let i = 0; i < cluster.length; i++) {
      const element = cluster[i];
      const field = await this.analyzeVisualField(element, i);
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  private async analyzeVisualField(element: HTMLElement, index: number): Promise<FormField | null> {
    const type = this.getFieldType(element);
    const label = this.extractVisualLabel(element);
    const selector = this.generateVisualSelector(element, index);

    return {
      id: `visual_field_${index}`,
      type,
      label,
      selector,
      required: element.hasAttribute('required'),
      placeholder: element.getAttribute('placeholder') || undefined,
      mappedProfileField: this.mapVisualField(label, type),
      validationRules: []
    };
  }

  private shouldSkipElement(element: HTMLElement): boolean {
    const input = element as HTMLInputElement;
    if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
      return true;
    }

    const style = window.getComputedStyle(element);
    return style.display === 'none' || style.visibility === 'hidden';
  }

  private getFieldType(element: HTMLElement): FieldType {
    if (element.tagName === 'TEXTAREA') return 'textarea';
    if (element.tagName === 'SELECT') return 'select';
    
    const input = element as HTMLInputElement;
    const type = input.type?.toLowerCase() || 'text';
    
    const typeMap: Record<string, FieldType> = {
      'text': 'text',
      'email': 'email',
      'tel': 'phone',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'file': 'file',
      'date': 'date',
      'number': 'number',
      'url': 'url'
    };
    
    return typeMap[type] || 'text';
  }

  private extractVisualLabel(element: HTMLElement): string {
    // Use visual proximity to find labels
    const rect = element.getBoundingClientRect();
    const candidates: { text: string; distance: number }[] = [];

    // Check all text elements within a reasonable distance
    const textElements = document.querySelectorAll('label, span, div, p');
    
    for (const textEl of textElements) {
      const text = textEl.textContent?.trim();
      if (!text || text.length > 100) continue;

      const textRect = textEl.getBoundingClientRect();
      const distance = Math.sqrt(
        Math.pow(textRect.left - rect.left, 2) + 
        Math.pow(textRect.top - rect.top, 2)
      );

      if (distance < 150) {
        candidates.push({ text, distance });
      }
    }

    // Sort by distance and return closest
    candidates.sort((a, b) => a.distance - b.distance);
    
    return candidates[0]?.text || 
           element.getAttribute('placeholder') || 
           element.getAttribute('name') || 
           'Visual Field';
  }

  private generateVisualSelector(element: HTMLElement, index: number): string {
    if (element.id) return `#${element.id}`;
    
    const name = element.getAttribute('name');
    if (name) return `[name="${name}"]`;
    
    return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
  }

  private mapVisualField(label: string, type: FieldType): string | undefined {
    const labelLower = label.toLowerCase();
    
    // Basic visual mapping
    if (labelLower.includes('name')) {
      if (labelLower.includes('first')) return 'personalInfo.firstName';
      if (labelLower.includes('last')) return 'personalInfo.lastName';
      return 'personalInfo.firstName';
    }
    
    if (labelLower.includes('email')) return 'personalInfo.email';
    if (labelLower.includes('phone')) return 'personalInfo.phone';
    
    return undefined;
  }
}

/**
 * Fallback detection strategy
 */
class FallbackDetection implements DetectionStrategy {
  name = 'Fallback Detection';
  priority = 5;
  confidence = 0.4;

  async detect(container: HTMLElement): Promise<FormField[]> {
    const fields: FormField[] = [];
    
    // Find any remaining input elements
    const inputs = container.querySelectorAll('input, textarea, select');
    
    for (let i = 0; i < inputs.length; i++) {
      const element = inputs[i] as HTMLElement;
      
      if (this.shouldSkipElement(element)) continue;
      
      const field = await this.analyzeFallbackField(element, i);
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  private shouldSkipElement(element: HTMLElement): boolean {
    const input = element as HTMLInputElement;
    return input.type === 'hidden' || input.type === 'submit' || input.type === 'button';
  }

  private async analyzeFallbackField(element: HTMLElement, index: number): Promise<FormField | null> {
    const type = this.getFieldType(element);
    const label = this.getFallbackLabel(element, index);
    const selector = this.getFallbackSelector(element, index);

    return {
      id: `fallback_field_${index}`,
      type,
      label,
      selector,
      required: element.hasAttribute('required'),
      placeholder: element.getAttribute('placeholder') || undefined,
      mappedProfileField: undefined, // No mapping for fallback fields
      validationRules: []
    };
  }

  private getFieldType(element: HTMLElement): FieldType {
    if (element.tagName === 'TEXTAREA') return 'textarea';
    if (element.tagName === 'SELECT') return 'select';
    
    const input = element as HTMLInputElement;
    return (input.type as FieldType) || 'text';
  }

  private getFallbackLabel(element: HTMLElement, index: number): string {
    return element.getAttribute('placeholder') || 
           element.getAttribute('name') || 
           `Field ${index + 1}`;
  }

  private getFallbackSelector(element: HTMLElement, index: number): string {
    if (element.id) return `#${element.id}`;
    
    const name = element.getAttribute('name');
    if (name) return `[name="${name}"]`;
    
    return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
  }
}