/**
 * Dynamic Form Monitor
 * Handles multi-step forms and dynamic content loading
 */

export interface FormState {
  id: string;
  step: number;
  totalSteps: number;
  filledFields: Set<string>;
  pendingFields: FormField[];
  lastModified: Date;
  platform: string;
  url: string;
  isComplete: boolean;
}

export interface FormChangeEvent {
  type: 'step_change' | 'field_added' | 'field_removed' | 'content_loaded' | 'validation_change';
  formId: string;
  data: any;
  timestamp: Date;
}

export interface ValidationRule {
  type: 'required' | 'pattern' | 'minLength' | 'maxLength' | 'custom';
  message: string;
  value?: any;
  validator?: (value: string) => boolean;
}

import type { FormField, DetectedForm } from '@extension/shared';

/**
 * Dynamic form monitoring system for multi-step and async forms
 */
export class DynamicFormMonitor {
  private observer: MutationObserver;
  private formStates: Map<string, FormState> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private iframeObservers: Map<HTMLIFrameElement, MutationObserver> = new Map();
  private validationObserver: MutationObserver;
  private isMonitoring = false;

  constructor() {
    this.setupMutationObserver();
    this.setupValidationObserver();
    this.setupIframeMonitoring();
  }

  /**
   * Start monitoring forms for changes
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'disabled', 'data-step', 'aria-hidden']
    });

    this.validationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-invalid', 'data-valid', 'data-error']
    });

    this.isMonitoring = true;
    console.log('Dynamic form monitoring started');
  }

  /**
   * Stop monitoring forms
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.observer.disconnect();
    this.validationObserver.disconnect();
    
    // Disconnect iframe observers
    for (const [iframe, observer] of this.iframeObservers) {
      observer.disconnect();
    }
    this.iframeObservers.clear();

    this.isMonitoring = false;
    console.log('Dynamic form monitoring stopped');
  }

  /**
   * Register a form for monitoring
   */
  registerForm(form: DetectedForm): void {
    const formState: FormState = {
      id: form.formId,
      step: form.currentStep || 1,
      totalSteps: form.totalSteps || 1,
      filledFields: new Set(),
      pendingFields: [...form.fields],
      lastModified: new Date(),
      platform: form.platform,
      url: form.url,
      isComplete: false
    };

    this.formStates.set(form.formId, formState);
    console.log(`Registered form for monitoring: ${form.formId}`);
  }

  /**
   * Update form state when fields are filled
   */
  updateFilledField(formId: string, fieldSelector: string): void {
    const formState = this.formStates.get(formId);
    if (!formState) return;

    formState.filledFields.add(fieldSelector);
    formState.lastModified = new Date();
    
    // Remove from pending fields
    formState.pendingFields = formState.pendingFields.filter(
      field => field.selector !== fieldSelector
    );

    this.emitEvent({
      type: 'field_added',
      formId,
      data: { fieldSelector },
      timestamp: new Date()
    });
  }

  /**
   * Get current form state
   */
  getFormState(formId: string): FormState | null {
    return this.formStates.get(formId) || null;
  }

  /**
   * Check if form step has changed
   */
  private checkStepChange(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' || mutation.type === 'childList') {
        this.detectStepChanges(mutation);
      }
    }
  }

  /**
   * Detect step changes in forms
   */
  private detectStepChanges(mutation: MutationRecord): void {
    const target = mutation.target as HTMLElement;
    
    // Check for step indicators
    const stepIndicators = [
      '.step.active',
      '.wizard-step.active',
      '[data-step].active',
      '.current-step',
      '.step.current',
      '[aria-current="step"]'
    ];

    for (const selector of stepIndicators) {
      const activeStep = document.querySelector(selector);
      if (activeStep && this.isNewStep(activeStep)) {
        this.handleStepChange(activeStep as HTMLElement);
      }
    }

    // Check for new form sections appearing
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          this.checkForNewFormContent(element);
        }
      }
    }
  }

  /**
   * Check if this is a new step
   */
  private isNewStep(stepElement: HTMLElement): boolean {
    const stepNumber = this.extractStepNumber(stepElement);
    if (!stepNumber) return false;

    // Check all registered forms to see if step changed
    for (const [formId, formState] of this.formStates) {
      if (formState.step !== stepNumber) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract step number from element
   */
  private extractStepNumber(element: HTMLElement): number | null {
    // Try data-step attribute
    const dataStep = element.getAttribute('data-step');
    if (dataStep) {
      return parseInt(dataStep);
    }

    // Try to extract from class names
    const classNames = element.className.split(' ');
    for (const className of classNames) {
      const match = className.match(/step-?(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }

    // Try to extract from text content
    const textMatch = element.textContent?.match(/step\s*(\d+)/i);
    if (textMatch) {
      return parseInt(textMatch[1]);
    }

    return null;
  }

  /**
   * Handle step change event
   */
  private handleStepChange(stepElement: HTMLElement): void {
    const newStep = this.extractStepNumber(stepElement);
    if (!newStep) return;

    // Update all relevant form states
    for (const [formId, formState] of this.formStates) {
      if (formState.step !== newStep) {
        const oldStep = formState.step;
        formState.step = newStep;
        formState.lastModified = new Date();

        this.emitEvent({
          type: 'step_change',
          formId,
          data: { oldStep, newStep },
          timestamp: new Date()
        });

        console.log(`Form ${formId} step changed: ${oldStep} -> ${newStep}`);
      }
    }
  }

  /**
   * Check for new form content
   */
  private checkForNewFormContent(element: HTMLElement): void {
    // Look for new form fields
    const newFields = this.findNewFormFields(element);
    if (newFields.length > 0) {
      this.handleNewFields(newFields);
    }

    // Look for form containers
    const formContainers = element.querySelectorAll('form, [role="form"], .form, .application-form');
    for (const container of formContainers) {
      this.analyzeNewFormContainer(container as HTMLElement);
    }
  }

  /**
   * Find new form fields in element
   */
  private findNewFormFields(element: HTMLElement): HTMLElement[] {
    const fieldSelectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      'textarea',
      'select',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[role="combobox"]'
    ];

    const fields: HTMLElement[] = [];
    
    for (const selector of fieldSelectors) {
      const elements = element.querySelectorAll(selector);
      for (const el of elements) {
        if (!this.isFieldAlreadyTracked(el as HTMLElement)) {
          fields.push(el as HTMLElement);
        }
      }
    }

    return fields;
  }

  /**
   * Check if field is already being tracked
   */
  private isFieldAlreadyTracked(field: HTMLElement): boolean {
    const selector = this.generateFieldSelector(field);
    
    for (const formState of this.formStates.values()) {
      if (formState.filledFields.has(selector) || 
          formState.pendingFields.some(f => f.selector === selector)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate selector for field
   */
  private generateFieldSelector(field: HTMLElement): string {
    if (field.id) return `#${field.id}`;
    
    const name = field.getAttribute('name');
    if (name) return `[name="${name}"]`;
    
    const dataTestId = field.getAttribute('data-testid');
    if (dataTestId) return `[data-testid="${dataTestId}"]`;
    
    return field.tagName.toLowerCase();
  }

  /**
   * Handle new fields discovered
   */
  private handleNewFields(fields: HTMLElement[]): void {
    for (const field of fields) {
      // Try to associate with existing forms
      const associatedFormId = this.findAssociatedForm(field);
      
      if (associatedFormId) {
        const formState = this.formStates.get(associatedFormId);
        if (formState) {
          const formField = this.convertToFormField(field);
          if (formField) {
            formState.pendingFields.push(formField);
            formState.lastModified = new Date();

            this.emitEvent({
              type: 'field_added',
              formId: associatedFormId,
              data: { field: formField },
              timestamp: new Date()
            });
          }
        }
      }
    }
  }

  /**
   * Find which form a field belongs to
   */
  private findAssociatedForm(field: HTMLElement): string | null {
    // Check if field is inside a form element
    const formElement = field.closest('form');
    if (formElement) {
      // Find form state by matching form element
      for (const [formId, formState] of this.formStates) {
        if (formId.includes(formElement.id) || formId.includes(formElement.className)) {
          return formId;
        }
      }
    }

    // Check proximity to known form fields
    for (const [formId, formState] of this.formStates) {
      for (const existingField of formState.pendingFields) {
        const existingElement = document.querySelector(existingField.selector);
        if (existingElement && this.areFieldsRelated(field, existingElement as HTMLElement)) {
          return formId;
        }
      }
    }

    return null;
  }

  /**
   * Check if two fields are related (same form)
   */
  private areFieldsRelated(field1: HTMLElement, field2: HTMLElement): boolean {
    // Check if they share a common container
    const containers = [
      '.form-container',
      '.application-form',
      '.job-form',
      '[role="form"]',
      'form'
    ];

    for (const containerSelector of containers) {
      const container1 = field1.closest(containerSelector);
      const container2 = field2.closest(containerSelector);
      
      if (container1 && container1 === container2) {
        return true;
      }
    }

    // Check proximity (within 500px)
    const rect1 = field1.getBoundingClientRect();
    const rect2 = field2.getBoundingClientRect();
    
    const distance = Math.sqrt(
      Math.pow(rect1.left - rect2.left, 2) + 
      Math.pow(rect1.top - rect2.top, 2)
    );

    return distance < 500;
  }

  /**
   * Convert HTML element to FormField
   */
  private convertToFormField(element: HTMLElement): FormField | null {
    try {
      const type = this.getFieldType(element);
      const label = this.getFieldLabel(element);
      const selector = this.generateFieldSelector(element);

      return {
        id: `dynamic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        label,
        selector,
        required: element.hasAttribute('required'),
        placeholder: element.getAttribute('placeholder') || undefined,
        validationRules: this.extractValidationRules(element)
      };
    } catch (error) {
      console.error('Failed to convert element to FormField:', error);
      return null;
    }
  }

  /**
   * Get field type from element
   */
  private getFieldType(element: HTMLElement): any {
    if (element.tagName === 'TEXTAREA') return 'textarea';
    if (element.tagName === 'SELECT') return 'select';
    
    const input = element as HTMLInputElement;
    return input.type || 'text';
  }

  /**
   * Get field label
   */
  private getFieldLabel(element: HTMLElement): string {
    // Try various label sources
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent?.trim() || '';
    }

    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || '';

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    return 'Dynamic Field';
  }

  /**
   * Extract validation rules from element
   */
  private extractValidationRules(element: HTMLElement): ValidationRule[] {
    const rules: ValidationRule[] = [];

    if (element.hasAttribute('required')) {
      rules.push({
        type: 'required',
        message: 'This field is required'
      });
    }

    const maxLength = element.getAttribute('maxlength');
    if (maxLength) {
      rules.push({
        type: 'maxLength',
        value: parseInt(maxLength),
        message: `Maximum ${maxLength} characters`
      });
    }

    const minLength = element.getAttribute('minlength');
    if (minLength) {
      rules.push({
        type: 'minLength',
        value: parseInt(minLength),
        message: `Minimum ${minLength} characters`
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

  /**
   * Analyze new form container
   */
  private analyzeNewFormContainer(container: HTMLElement): void {
    // This could be a new form or form section
    const fields = this.findNewFormFields(container);
    
    if (fields.length > 2) { // Minimum threshold for a form
      console.log(`Detected new form container with ${fields.length} fields`);
      
      // Emit event for new form detection
      this.emitEvent({
        type: 'content_loaded',
        formId: 'new_container',
        data: { container, fieldCount: fields.length },
        timestamp: new Date()
      });
    }
  }

  /**
   * Setup mutation observer
   */
  private setupMutationObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      this.checkStepChange(mutations);
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.checkForNewFormContent(node as HTMLElement);
            }
          }
        }
      }
    });
  }

  /**
   * Setup validation observer
   */
  private setupValidationObserver(): void {
    this.validationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          this.checkValidationChanges(mutation.target as HTMLElement);
        }
      }
    });
  }

  /**
   * Check for validation state changes
   */
  private checkValidationChanges(element: HTMLElement): void {
    const isInvalid = element.hasAttribute('aria-invalid') && 
                     element.getAttribute('aria-invalid') === 'true';
    
    const hasError = element.classList.contains('error') || 
                    element.classList.contains('invalid') ||
                    element.hasAttribute('data-error');

    if (isInvalid || hasError) {
      const formId = this.findAssociatedForm(element);
      if (formId) {
        this.emitEvent({
          type: 'validation_change',
          formId,
          data: { element, isValid: false },
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Setup iframe monitoring
   */
  private setupIframeMonitoring(): void {
    // Monitor for new iframes
    const iframeObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const iframes = (node as HTMLElement).querySelectorAll('iframe');
              for (const iframe of iframes) {
                this.monitorIframe(iframe as HTMLIFrameElement);
              }
            }
          }
        }
      }
    });

    iframeObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Monitor existing iframes
    const existingIframes = document.querySelectorAll('iframe');
    for (const iframe of existingIframes) {
      this.monitorIframe(iframe as HTMLIFrameElement);
    }
  }

  /**
   * Monitor iframe for form content
   */
  private monitorIframe(iframe: HTMLIFrameElement): void {
    try {
      // Wait for iframe to load
      iframe.addEventListener('load', () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) return;

          // Create observer for iframe content
          const iframeObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                  if (node.nodeType === Node.ELEMENT_NODE) {
                    this.checkForNewFormContent(node as HTMLElement);
                  }
                }
              }
            }
          });

          iframeObserver.observe(iframeDoc.body, {
            childList: true,
            subtree: true
          });

          this.iframeObservers.set(iframe, iframeObserver);

          // Check for existing form content in iframe
          this.checkForNewFormContent(iframeDoc.body);
        } catch (error) {
          console.warn('Cannot access iframe content (cross-origin):', error);
        }
      });
    } catch (error) {
      console.warn('Failed to monitor iframe:', error);
    }
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: Function): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: FormChangeEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      }
    }

    // Also emit to 'all' listeners
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      for (const listener of allListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      }
    }
  }

  /**
   * Get all form states
   */
  getAllFormStates(): Map<string, FormState> {
    return new Map(this.formStates);
  }

  /**
   * Clear form state
   */
  clearFormState(formId: string): void {
    this.formStates.delete(formId);
  }

  /**
   * Clear all form states
   */
  clearAllFormStates(): void {
    this.formStates.clear();
  }
}