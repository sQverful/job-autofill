/**
 * Form Monitor
 * Monitors DOM changes and form state for dynamic form detection and validation
 */

import type { DetectedForm, FormField } from '@extension/shared';

export interface FormChangeEvent {
  type: 'form_added' | 'form_removed' | 'field_added' | 'field_removed' | 'field_changed' | 'validation_changed';
  formId: string;
  fieldId?: string;
  element?: HTMLElement;
  oldValue?: any;
  newValue?: any;
  timestamp: Date;
}

export interface FormValidationState {
  formId: string;
  isValid: boolean;
  errors: Record<string, string[]>;
  warnings: Record<string, string[]>;
  requiredFields: string[];
  completedFields: string[];
  lastValidated: Date;
}

export interface MonitoredForm {
  id: string;
  element: HTMLFormElement;
  fields: Map<string, HTMLElement>;
  validationState: FormValidationState;
  lastChanged: Date;
  changeCount: number;
  isMultiStep: boolean;
  currentStep?: number;
  totalSteps?: number;
}

/**
 * Monitors forms for changes and validation state
 */
export class FormMonitor {
  private monitoredForms = new Map<string, MonitoredForm>();
  private mutationObserver: MutationObserver | null = null;
  private validationObserver: MutationObserver | null = null;
  private changeListeners = new Set<(event: FormChangeEvent) => void>();
  private validationListeners = new Set<(state: FormValidationState) => void>();
  private isMonitoring = false;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.setupMutationObserver();
    this.setupValidationObserver();
  }

  /**
   * Start monitoring forms
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    console.log('Starting form monitoring...');

    try {
      // Start mutation observers
      if (this.mutationObserver) {
        this.mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          // Watching frequently changing attributes like "class" or "style" across the
          // whole document can generate a huge number of mutation events and freeze the
          // browser. Limit observation to only the attributes required for form logic.
          attributeFilter: ['disabled', 'required', 'aria-invalid'],
        });
      }

      if (this.validationObserver) {
        this.validationObserver.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          // Avoid tracking class changes globally to reduce unnecessary processing.
          attributeFilter: ['aria-invalid', 'aria-describedby'],
        });
      }

      // Scan for existing forms
      this.scanExistingForms();

      // Setup form event listeners
      this.setupFormEventListeners();

      this.isMonitoring = true;
      console.log('Form monitoring started');
    } catch (error: any) {
      console.error('Failed to start form monitoring:', error);
    }
  }

  /**
   * Stop monitoring forms
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    console.log('Stopping form monitoring...');

    // Disconnect observers
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    if (this.validationObserver) {
      this.validationObserver.disconnect();
    }

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Remove form event listeners
    this.removeFormEventListeners();

    this.isMonitoring = false;
    console.log('Form monitoring stopped');
  }

  /**
   * Add form to monitoring
   */
  addForm(formElement: HTMLFormElement, formId?: string): string {
    const id = formId || this.generateFormId(formElement);

    if (this.monitoredForms.has(id)) {
      console.log(`Form ${id} is already being monitored`);
      return id;
    }

    console.log(`Adding form ${id} to monitoring`);

    const fields = this.scanFormFields(formElement);
    const validationState = this.createInitialValidationState(id, fields);
    const isMultiStep = this.detectMultiStepForm(formElement);

    const monitoredForm: MonitoredForm = {
      id,
      element: formElement,
      fields,
      validationState,
      lastChanged: new Date(),
      changeCount: 0,
      isMultiStep,
      currentStep: isMultiStep ? this.detectCurrentStep(formElement) : undefined,
      totalSteps: isMultiStep ? this.detectTotalSteps(formElement) : undefined,
    };

    this.monitoredForms.set(id, monitoredForm);

    // Setup form-specific event listeners
    this.setupFormSpecificListeners(formElement, id);

    // Emit form added event
    this.emitChangeEvent({
      type: 'form_added',
      formId: id,
      element: formElement,
      timestamp: new Date(),
    });

    return id;
  }

  /**
   * Remove form from monitoring
   */
  removeForm(formId: string): void {
    const monitoredForm = this.monitoredForms.get(formId);
    if (!monitoredForm) return;

    console.log(`Removing form ${formId} from monitoring`);

    // Remove form-specific event listeners
    this.removeFormSpecificListeners(monitoredForm.element, formId);

    // Clear debounce timer
    const timer = this.debounceTimers.get(formId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(formId);
    }

    this.monitoredForms.delete(formId);

    // Emit form removed event
    this.emitChangeEvent({
      type: 'form_removed',
      formId,
      timestamp: new Date(),
    });
  }

  /**
   * Get monitored form
   */
  getForm(formId: string): MonitoredForm | undefined {
    return this.monitoredForms.get(formId);
  }

  /**
   * Get all monitored forms
   */
  getAllForms(): MonitoredForm[] {
    return Array.from(this.monitoredForms.values());
  }

  /**
   * Get form validation state
   */
  getValidationState(formId: string): FormValidationState | undefined {
    const form = this.monitoredForms.get(formId);
    return form?.validationState;
  }

  /**
   * Update form validation state
   */
  updateValidationState(formId: string, updates: Partial<FormValidationState>): void {
    const form = this.monitoredForms.get(formId);
    if (!form) return;

    const oldState = { ...form.validationState };
    form.validationState = {
      ...form.validationState,
      ...updates,
      lastValidated: new Date(),
    };

    // Check if validation state actually changed
    if (this.hasValidationStateChanged(oldState, form.validationState)) {
      this.emitChangeEvent({
        type: 'validation_changed',
        formId,
        oldValue: oldState,
        newValue: form.validationState,
        timestamp: new Date(),
      });

      // Notify validation listeners
      for (const listener of this.validationListeners) {
        try {
          listener(form.validationState);
        } catch (error) {
          console.warn('Error in validation listener:', error);
        }
      }
    }
  }

  /**
   * Add change listener
   */
  addChangeListener(listener: (event: FormChangeEvent) => void): void {
    this.changeListeners.add(listener);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(listener: (event: FormChangeEvent) => void): void {
    this.changeListeners.delete(listener);
  }

  /**
   * Add validation listener
   */
  addValidationListener(listener: (state: FormValidationState) => void): void {
    this.validationListeners.add(listener);
  }

  /**
   * Remove validation listener
   */
  removeValidationListener(listener: (state: FormValidationState) => void): void {
    this.validationListeners.delete(listener);
  }

  /**
   * Setup mutation observer for DOM changes
   */
  private setupMutationObserver(): void {
    this.mutationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        this.handleMutation(mutation);
      }
    });
  }

  /**
   * Setup validation observer for validation state changes
   */
  private setupValidationObserver(): void {
    this.validationObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        this.handleValidationMutation(mutation);
      }
    });
  }

  /**
   * Handle DOM mutation
   */
  private handleMutation(mutation: MutationRecord): void {
    try {
      switch (mutation.type) {
        case 'childList':
          this.handleChildListMutation(mutation);
          break;
        case 'attributes':
          this.handleAttributeMutation(mutation);
          break;
      }
    } catch (error) {
      console.warn('Error handling mutation:', error);
    }
  }

  /**
   * Handle child list mutation
   */
  private handleChildListMutation(mutation: MutationRecord): void {
    // Check for added forms
    for (const node of mutation.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;

        // Check if it's a form
        if (element.tagName === 'FORM') {
          this.addForm(element as HTMLFormElement);
        }

        // Check for forms within added element
        const forms = element.querySelectorAll('form');
        for (const form of forms) {
          this.addForm(form as HTMLFormElement);
        }

        // Check for form fields added to existing forms
        this.checkForNewFields(element);
      }
    }

    // Check for removed forms
    for (const node of mutation.removedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;

        // Check if it's a monitored form
        for (const [formId, monitoredForm] of this.monitoredForms.entries()) {
          if (monitoredForm.element === element || !document.contains(monitoredForm.element)) {
            this.removeForm(formId);
          }
        }
      }
    }
  }

  /**
   * Handle attribute mutation
   */
  private handleAttributeMutation(mutation: MutationRecord): void {
    const element = mutation.target as Element;

    // Check if it's a form field in a monitored form
    const formId = this.findFormIdForElement(element);
    if (!formId) return;

    const monitoredForm = this.monitoredForms.get(formId);
    if (!monitoredForm) return;

    // Handle specific attribute changes
    switch (mutation.attributeName) {
      case 'disabled':
        this.handleFieldDisabledChange(formId, element, mutation);
        break;
      case 'required':
        this.handleFieldRequiredChange(formId, element, mutation);
        break;
      case 'class':
        this.handleFieldClassChange(formId, element, mutation);
        break;
      case 'style':
        this.handleFieldStyleChange(formId, element, mutation);
        break;
    }
  }

  /**
   * Handle validation mutation
   */
  private handleValidationMutation(mutation: MutationRecord): void {
    const element = mutation.target as Element;

    // Check if it's a form field in a monitored form
    const formId = this.findFormIdForElement(element);
    if (!formId) return;

    // Handle validation-related attribute changes
    switch (mutation.attributeName) {
      case 'aria-invalid':
        this.handleAriaInvalidChange(formId, element, mutation);
        break;
      case 'aria-describedby':
        this.handleAriaDescribedByChange(formId, element, mutation);
        break;
      case 'class':
        this.handleValidationClassChange(formId, element, mutation);
        break;
    }
  }

  /**
   * Scan existing forms on page
   */
  private scanExistingForms(): void {
    const forms = document.querySelectorAll('form');
    console.log(`Found ${forms.length} existing forms to monitor`);

    for (const form of forms) {
      this.addForm(form as HTMLFormElement);
    }
  }

  /**
   * Setup global form event listeners
   */
  private setupFormEventListeners(): void {
    // Use event delegation for better performance
    document.addEventListener('input', this.handleFormInput.bind(this), true);
    document.addEventListener('change', this.handleFormChange.bind(this), true);
    document.addEventListener('focus', this.handleFormFocus.bind(this), true);
    document.addEventListener('blur', this.handleFormBlur.bind(this), true);
    document.addEventListener('submit', this.handleFormSubmit.bind(this), true);
  }

  /**
   * Remove global form event listeners
   */
  private removeFormEventListeners(): void {
    document.removeEventListener('input', this.handleFormInput.bind(this), true);
    document.removeEventListener('change', this.handleFormChange.bind(this), true);
    document.removeEventListener('focus', this.handleFormFocus.bind(this), true);
    document.removeEventListener('blur', this.handleFormBlur.bind(this), true);
    document.removeEventListener('submit', this.handleFormSubmit.bind(this), true);
  }

  /**
   * Setup form-specific event listeners
   */
  private setupFormSpecificListeners(formElement: HTMLFormElement, formId: string): void {
    // Add data attribute for identification
    formElement.setAttribute('data-form-monitor-id', formId);
  }

  /**
   * Remove form-specific event listeners
   */
  private removeFormSpecificListeners(formElement: HTMLFormElement, formId: string): void {
    formElement.removeAttribute('data-form-monitor-id');
  }

  /**
   * Handle form input event
   */
  private handleFormInput(event: Event): void {
    const element = event.target as HTMLElement;
    const formId = this.findFormIdForElement(element);

    if (!formId) return;

    this.debounceFieldChange(formId, element, 'input');
  }

  /**
   * Handle form change event
   */
  private handleFormChange(event: Event): void {
    const element = event.target as HTMLElement;
    const formId = this.findFormIdForElement(element);

    if (!formId) return;

    this.debounceFieldChange(formId, element, 'change');
  }

  /**
   * Handle form focus event
   */
  private handleFormFocus(event: Event): void {
    const element = event.target as HTMLElement;
    const formId = this.findFormIdForElement(element);

    if (!formId) return;

    // Update field focus state immediately
    this.updateFieldFocusState(formId, element, true);
  }

  /**
   * Handle form blur event
   */
  private handleFormBlur(event: Event): void {
    const element = event.target as HTMLElement;
    const formId = this.findFormIdForElement(element);

    if (!formId) return;

    // Update field focus state and trigger validation
    this.updateFieldFocusState(formId, element, false);
    this.validateField(formId, element);
  }

  /**
   * Handle form submit event
   */
  private handleFormSubmit(event: Event): void {
    const formElement = event.target as HTMLFormElement;
    const formId = this.findFormIdForElement(formElement);

    if (!formId) return;

    console.log(`Form ${formId} submitted`);

    // Validate entire form
    this.validateForm(formId);

    // Check if it's a multi-step form navigation
    if (this.isMultiStepNavigation(formElement, event)) {
      this.handleMultiStepNavigation(formId, formElement);
    }
  }

  /**
   * Debounce field change events
   */
  private debounceFieldChange(formId: string, element: HTMLElement, eventType: string): void {
    const debounceKey = `${formId}-${this.getElementId(element)}-${eventType}`;

    // Clear existing timer
    const existingTimer = this.debounceTimers.get(debounceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.handleFieldChange(formId, element, eventType);
      this.debounceTimers.delete(debounceKey);
    }, 300);

    this.debounceTimers.set(debounceKey, timer);
  }

  /**
   * Handle field change
   */
  private handleFieldChange(formId: string, element: HTMLElement, eventType: string): void {
    const monitoredForm = this.monitoredForms.get(formId);
    if (!monitoredForm) return;

    const fieldId = this.getElementId(element);
    const oldValue = this.getFieldValue(element);

    // Update form change tracking
    monitoredForm.lastChanged = new Date();
    monitoredForm.changeCount++;

    // Update field in monitored form
    monitoredForm.fields.set(fieldId, element);

    // Emit field changed event
    this.emitChangeEvent({
      type: 'field_changed',
      formId,
      fieldId,
      element,
      newValue: this.getFieldValue(element),
      timestamp: new Date(),
    });

    // Update validation state
    this.updateFieldValidationState(formId, element);
  }

  /**
   * Scan form fields
   */
  private scanFormFields(formElement: HTMLFormElement): Map<string, HTMLElement> {
    const fields = new Map<string, HTMLElement>();

    const fieldSelectors = [
      'input:not([type="hidden"])',
      'textarea',
      'select',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="listbox"]',
    ];

    for (const selector of fieldSelectors) {
      const elements = formElement.querySelectorAll(selector);
      for (const element of elements) {
        const fieldId = this.getElementId(element as HTMLElement);
        fields.set(fieldId, element as HTMLElement);
      }
    }

    console.log(`Scanned ${fields.size} fields in form`);
    return fields;
  }

  /**
   * Create initial validation state
   */
  private createInitialValidationState(formId: string, fields: Map<string, HTMLElement>): FormValidationState {
    const requiredFields: string[] = [];
    const completedFields: string[] = [];

    for (const [fieldId, element] of fields.entries()) {
      if (this.isFieldRequired(element)) {
        requiredFields.push(fieldId);
      }

      if (this.isFieldCompleted(element)) {
        completedFields.push(fieldId);
      }
    }

    return {
      formId,
      isValid: requiredFields.length === 0 || requiredFields.every(id => completedFields.includes(id)),
      errors: {},
      warnings: {},
      requiredFields,
      completedFields,
      lastValidated: new Date(),
    };
  }

  /**
   * Detect multi-step form
   */
  private detectMultiStepForm(formElement: HTMLFormElement): boolean {
    // Look for common multi-step indicators
    const indicators = [
      '.step',
      '.wizard-step',
      '.form-step',
      '[data-step]',
      '.progress-bar',
      '.stepper',
      '.multi-step',
    ];

    for (const indicator of indicators) {
      if (formElement.querySelector(indicator)) {
        return true;
      }
    }

    // Check for hidden sections that might be steps
    const hiddenSections = formElement.querySelectorAll('[style*="display: none"], .hidden, [hidden]');
    return hiddenSections.length > 2;
  }

  /**
   * Detect current step
   */
  private detectCurrentStep(formElement: HTMLFormElement): number {
    // Look for active step indicators
    const activeStep = formElement.querySelector(
      '.step.active, .wizard-step.active, .form-step.active, [data-step].active',
    );
    if (activeStep) {
      const stepNumber =
        activeStep.getAttribute('data-step') ||
        activeStep.getAttribute('data-step-number') ||
        activeStep.textContent?.match(/\d+/)?.[0];
      if (stepNumber) {
        return parseInt(stepNumber, 10);
      }
    }

    return 1; // Default to first step
  }

  /**
   * Detect total steps
   */
  private detectTotalSteps(formElement: HTMLFormElement): number {
    // Count step elements
    const stepElements = formElement.querySelectorAll('.step, .wizard-step, .form-step, [data-step]');
    if (stepElements.length > 0) {
      return stepElements.length;
    }

    // Look for progress indicators
    const progressSteps = formElement.querySelectorAll('.progress-step, .stepper-step');
    if (progressSteps.length > 0) {
      return progressSteps.length;
    }

    return 1; // Default to single step
  }

  /**
   * Check for new fields in element
   */
  private checkForNewFields(element: Element): void {
    for (const [formId, monitoredForm] of this.monitoredForms.entries()) {
      if (monitoredForm.element.contains(element)) {
        const newFields = this.scanFormFields(monitoredForm.element);

        // Check for newly added fields
        for (const [fieldId, fieldElement] of newFields.entries()) {
          if (!monitoredForm.fields.has(fieldId)) {
            monitoredForm.fields.set(fieldId, fieldElement);

            this.emitChangeEvent({
              type: 'field_added',
              formId,
              fieldId,
              element: fieldElement,
              timestamp: new Date(),
            });
          }
        }
      }
    }
  }

  /**
   * Find form ID for element
   */
  private findFormIdForElement(element: Element): string | null {
    // Check if element is within a monitored form
    const form = element.closest('form[data-form-monitor-id]') as HTMLFormElement;
    if (form) {
      return form.getAttribute('data-form-monitor-id');
    }

    // Check if element itself is a monitored form
    if (element.tagName === 'FORM' && element.hasAttribute('data-form-monitor-id')) {
      return element.getAttribute('data-form-monitor-id');
    }

    return null;
  }

  /**
   * Generate form ID
   */
  private generateFormId(formElement: HTMLFormElement): string {
    // Try to use existing ID or name
    if (formElement.id) {
      return `form-${formElement.id}`;
    }

    if (formElement.name) {
      return `form-${formElement.name}`;
    }

    // Generate based on position and content
    const forms = document.querySelectorAll('form');
    const index = Array.from(forms).indexOf(formElement);
    return `form-${index}-${Date.now()}`;
  }

  /**
   * Get element ID
   */
  private getElementId(element: HTMLElement): string {
    if (element.id) return element.id;
    if (element.name) return element.name;

    // Generate ID based on element properties
    const tag = element.tagName.toLowerCase();
    const type = element.getAttribute('type') || '';
    const placeholder = element.getAttribute('placeholder') || '';
    const label = this.findFieldLabel(element);

    return `${tag}-${type}-${placeholder}-${label}`.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-');
  }

  /**
   * Find field label
   */
  private findFieldLabel(element: HTMLElement): string {
    // Check for associated label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent?.trim() || '';
    }

    // Check for parent label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || '';

    // Check for aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Check for placeholder
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) return placeholder;

    return '';
  }

  /**
   * Get field value
   */
  private getFieldValue(element: HTMLElement): any {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked;
      }
      return element.value;
    }

    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    }

    if (element instanceof HTMLSelectElement) {
      return element.value;
    }

    if (element.contentEditable === 'true') {
      return element.textContent || element.innerText;
    }

    return element.getAttribute('value') || '';
  }

  /**
   * Check if field is required
   */
  private isFieldRequired(element: HTMLElement): boolean {
    return (
      element.hasAttribute('required') ||
      element.getAttribute('aria-required') === 'true' ||
      element.classList.contains('required')
    );
  }

  /**
   * Check if field is completed
   */
  private isFieldCompleted(element: HTMLElement): boolean {
    const value = this.getFieldValue(element);

    if (typeof value === 'boolean') {
      return true; // Checkboxes/radios are always "completed"
    }

    return value && value.toString().trim().length > 0;
  }

  /**
   * Validate field
   */
  private validateField(formId: string, element: HTMLElement): void {
    const fieldId = this.getElementId(element);
    const monitoredForm = this.monitoredForms.get(formId);
    if (!monitoredForm) return;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required validation
    if (this.isFieldRequired(element) && !this.isFieldCompleted(element)) {
      errors.push('This field is required');
    }

    // Check HTML5 validation
    if (element instanceof HTMLInputElement && !element.validity.valid) {
      if (element.validity.typeMismatch) {
        errors.push('Please enter a valid value');
      }
      if (element.validity.patternMismatch) {
        errors.push('Please match the requested format');
      }
      if (element.validity.tooShort) {
        errors.push(`Minimum length is ${element.minLength}`);
      }
      if (element.validity.tooLong) {
        errors.push(`Maximum length is ${element.maxLength}`);
      }
    }

    // Update validation state
    const validationState = monitoredForm.validationState;

    if (errors.length > 0) {
      validationState.errors[fieldId] = errors;
    } else {
      delete validationState.errors[fieldId];
    }

    if (warnings.length > 0) {
      validationState.warnings[fieldId] = warnings;
    } else {
      delete validationState.warnings[fieldId];
    }

    // Update completed fields
    if (this.isFieldCompleted(element)) {
      if (!validationState.completedFields.includes(fieldId)) {
        validationState.completedFields.push(fieldId);
      }
    } else {
      const index = validationState.completedFields.indexOf(fieldId);
      if (index > -1) {
        validationState.completedFields.splice(index, 1);
      }
    }

    // Update overall form validity
    validationState.isValid =
      Object.keys(validationState.errors).length === 0 &&
      validationState.requiredFields.every(id => validationState.completedFields.includes(id));

    this.updateValidationState(formId, validationState);
  }

  /**
   * Validate entire form
   */
  private validateForm(formId: string): void {
    const monitoredForm = this.monitoredForms.get(formId);
    if (!monitoredForm) return;

    for (const element of monitoredForm.fields.values()) {
      this.validateField(formId, element);
    }
  }

  /**
   * Update field validation state
   */
  private updateFieldValidationState(formId: string, element: HTMLElement): void {
    // Debounce validation to avoid excessive updates
    const validationKey = `${formId}-validation`;
    const existingTimer = this.debounceTimers.get(validationKey);

    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.validateField(formId, element);
      this.debounceTimers.delete(validationKey);
    }, 500);

    this.debounceTimers.set(validationKey, timer);
  }

  /**
   * Update field focus state
   */
  private updateFieldFocusState(formId: string, element: HTMLElement, focused: boolean): void {
    // Add/remove focus class for styling
    if (focused) {
      element.classList.add('form-monitor-focused');
    } else {
      element.classList.remove('form-monitor-focused');
    }
  }

  /**
   * Handle field disabled change
   */
  private handleFieldDisabledChange(formId: string, element: Element, mutation: MutationRecord): void {
    const fieldId = this.getElementId(element as HTMLElement);
    const isDisabled = element.hasAttribute('disabled');

    console.log(`Field ${fieldId} disabled state changed: ${isDisabled}`);
  }

  /**
   * Handle field required change
   */
  private handleFieldRequiredChange(formId: string, element: Element, mutation: MutationRecord): void {
    const fieldId = this.getElementId(element as HTMLElement);
    const isRequired = element.hasAttribute('required');

    const monitoredForm = this.monitoredForms.get(formId);
    if (!monitoredForm) return;

    // Update required fields list
    if (isRequired && !monitoredForm.validationState.requiredFields.includes(fieldId)) {
      monitoredForm.validationState.requiredFields.push(fieldId);
    } else if (!isRequired) {
      const index = monitoredForm.validationState.requiredFields.indexOf(fieldId);
      if (index > -1) {
        monitoredForm.validationState.requiredFields.splice(index, 1);
      }
    }

    console.log(`Field ${fieldId} required state changed: ${isRequired}`);
  }

  /**
   * Handle field class change
   */
  private handleFieldClassChange(formId: string, element: Element, mutation: MutationRecord): void {
    // Check for validation-related class changes
    const classList = element.classList;
    const hasError = classList.contains('error') || classList.contains('invalid') || classList.contains('is-invalid');
    const hasWarning = classList.contains('warning') || classList.contains('warn');

    if (hasError || hasWarning) {
      this.validateField(formId, element as HTMLElement);
    }
  }

  /**
   * Handle field style change
   */
  private handleFieldStyleChange(formId: string, element: Element, mutation: MutationRecord): void {
    // Check for visibility changes that might indicate step changes
    const style = (element as HTMLElement).style;
    const isVisible = style.display !== 'none' && style.visibility !== 'hidden';

    if (!isVisible) {
      // Field became hidden, might be step change
      this.checkForStepChange(formId);
    }
  }

  /**
   * Handle aria-invalid change
   */
  private handleAriaInvalidChange(formId: string, element: Element, mutation: MutationRecord): void {
    const isInvalid = element.getAttribute('aria-invalid') === 'true';

    if (isInvalid) {
      this.validateField(formId, element as HTMLElement);
    }
  }

  /**
   * Handle aria-describedby change
   */
  private handleAriaDescribedByChange(formId: string, element: Element, mutation: MutationRecord): void {
    const describedBy = element.getAttribute('aria-describedby');

    if (describedBy) {
      // Check if the described element contains error messages
      const descriptionElement = document.getElementById(describedBy);
      if (descriptionElement && descriptionElement.textContent) {
        this.validateField(formId, element as HTMLElement);
      }
    }
  }

  /**
   * Handle validation class change
   */
  private handleValidationClassChange(formId: string, element: Element, mutation: MutationRecord): void {
    this.handleFieldClassChange(formId, element, mutation);
  }

  /**
   * Check if validation state changed
   */
  private hasValidationStateChanged(oldState: FormValidationState, newState: FormValidationState): boolean {
    return (
      oldState.isValid !== newState.isValid ||
      JSON.stringify(oldState.errors) !== JSON.stringify(newState.errors) ||
      JSON.stringify(oldState.warnings) !== JSON.stringify(newState.warnings) ||
      JSON.stringify(oldState.completedFields) !== JSON.stringify(newState.completedFields)
    );
  }

  /**
   * Check if form submission is multi-step navigation
   */
  private isMultiStepNavigation(formElement: HTMLFormElement, event: Event): boolean {
    const submitter = (event as SubmitEvent).submitter;

    if (submitter) {
      const buttonText = submitter.textContent?.toLowerCase() || '';
      const buttonValue = submitter.getAttribute('value')?.toLowerCase() || '';

      return (
        buttonText.includes('next') ||
        buttonText.includes('continue') ||
        buttonText.includes('previous') ||
        buttonValue.includes('next') ||
        buttonValue.includes('continue') ||
        buttonValue.includes('previous')
      );
    }

    return false;
  }

  /**
   * Handle multi-step navigation
   */
  private handleMultiStepNavigation(formId: string, formElement: HTMLFormElement): void {
    const monitoredForm = this.monitoredForms.get(formId);
    if (!monitoredForm || !monitoredForm.isMultiStep) return;

    const newStep = this.detectCurrentStep(formElement);
    const oldStep = monitoredForm.currentStep;

    if (newStep !== oldStep) {
      monitoredForm.currentStep = newStep;

      console.log(`Multi-step form ${formId} navigated from step ${oldStep} to step ${newStep}`);

      // Re-scan fields for the new step
      const newFields = this.scanFormFields(formElement);
      monitoredForm.fields = newFields;

      // Update validation state for new step
      monitoredForm.validationState = this.createInitialValidationState(formId, newFields);
    }
  }

  /**
   * Check for step change
   */
  private checkForStepChange(formId: string): void {
    const monitoredForm = this.monitoredForms.get(formId);
    if (!monitoredForm || !monitoredForm.isMultiStep) return;

    const newStep = this.detectCurrentStep(monitoredForm.element);
    if (newStep !== monitoredForm.currentStep) {
      this.handleMultiStepNavigation(formId, monitoredForm.element);
    }
  }

  /**
   * Emit change event
   */
  private emitChangeEvent(event: FormChangeEvent): void {
    for (const listener of this.changeListeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn('Error in change listener:', error);
      }
    }
  }

  /**
   * Destroy the form monitor
   */
  destroy(): void {
    console.log('Destroying form monitor');

    this.stopMonitoring();
    this.monitoredForms.clear();
    this.changeListeners.clear();
    this.validationListeners.clear();
  }

  /**
   * Get monitor statistics
   */
  getStats(): {
    isMonitoring: boolean;
    formsCount: number;
    totalFields: number;
    validForms: number;
    multiStepForms: number;
  } {
    let totalFields = 0;
    let validForms = 0;
    let multiStepForms = 0;

    for (const form of this.monitoredForms.values()) {
      totalFields += form.fields.size;
      if (form.validationState.isValid) validForms++;
      if (form.isMultiStep) multiStepForms++;
    }

    return {
      isMonitoring: this.isMonitoring,
      formsCount: this.monitoredForms.size,
      totalFields,
      validForms,
      multiStepForms,
    };
  }
}

// Create singleton instance
export const formMonitor = new FormMonitor();
