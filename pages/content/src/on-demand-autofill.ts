/**
 * On-Demand Autofill Content Script
 * Only processes forms when user explicitly triggers autofill
 */

import { profileStorage } from '@extension/storage';
import type { UserProfile, DetectedForm, FormField, AutofillResult, JobPlatform, FieldType } from '@extension/shared';
import { UniversalComponentHandler } from './components/universal-handler';
import { ProfileDataValidator } from './utils/profile-data-validator';

export interface AutofillTriggerMessage {
  type: 'autofill:trigger';
  source: 'popup';
  data: {
    tabId: number;
  };
}

export interface FormAnalysisResult {
  success: boolean;
  platform: JobPlatform;
  forms: DetectedForm[];
  confidence: number;
  error?: string;
}

export interface OnDemandAutofillOptions {
  enableButtonCreation?: boolean;
  enableFormDetection?: boolean;
}

/**
 * On-demand autofill handler that only runs when triggered by user
 */
export class OnDemandAutofill {
  private isProcessing = false;
  private profile: UserProfile | null = null;
  private detectedForms: DetectedForm[] = [];
  private formIndicators: HTMLElement[] = [];
  private componentHandler: UniversalComponentHandler;
  private profileValidator: ProfileDataValidator;
  private options: Required<OnDemandAutofillOptions>;

  constructor(options: OnDemandAutofillOptions = {}) {
    this.options = {
      enableButtonCreation: true,
      enableFormDetection: true,
      ...options
    };
    
    this.componentHandler = new UniversalComponentHandler();
    this.profileValidator = new ProfileDataValidator();
    this.setupMessageHandlers();
    this.loadProfile();
    this.initializeFormDetection();
  }

  /**
   * Check if autofill is currently processing
   */
  get isProcessingAutofill(): boolean {
    return this.isProcessing;
  }

  /**
   * Setup message handlers for communication with popup/background
   */
  private setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'autofill:trigger') {
        this.handleAutofillTrigger(message as AutofillTriggerMessage)
          .then(sendResponse)
          .catch(error => {
            console.error('Autofill trigger failed:', error);
            sendResponse({
              success: false,
              error: error.message || 'Unknown error occurred',
            });
          });
        return true; // Keep message channel open for async response
      }

      if (message.type === 'form:analyze') {
        this.analyzeCurrentPage()
          .then(sendResponse)
          .catch(error => {
            console.error('Form analysis failed:', error);
            sendResponse({
              success: false,
              error: error.message || 'Analysis failed',
            });
          });
        return true;
      }

      return false; // Don't keep channel open for other message types
    });
  }

  /**
   * Load user profile from storage
   */
  private async loadProfile(): Promise<void> {
    try {
      this.profile = await profileStorage.get();
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  }

  /**
   * Handle autofill trigger from popup
   */
  async handleAutofillTrigger(message: AutofillTriggerMessage): Promise<AutofillResult> {
    if (this.isProcessing) {
      throw new Error('Autofill already in progress');
    }

    if (!this.profile) {
      throw new Error('Profile not loaded. Please set up your profile first.');
    }

    this.isProcessing = true;

    try {
      console.log('Starting on-demand autofill...');

      // Analyze current page for forms
      const analysis = await this.analyzeCurrentPage();
      if (!analysis.success || analysis.forms.length === 0) {
        throw new Error('No fillable forms detected on this page');
      }

      // Get the best form to fill
      const targetForm = this.selectBestForm(analysis.forms);
      if (!targetForm) {
        throw new Error('No suitable form found for autofill');
      }

      console.log(`Filling form on ${analysis.platform} platform with ${targetForm.fields.length} fields`);

      // Perform autofill
      const result = await this.performAutofill(targetForm);

      // Send success notification with detailed results
      this.sendNotification({
        type: 'autofill:complete',
        data: {
          success: true,
          filledCount: result.filledCount,
          totalFields: result.totalFields,
          platform: analysis.platform,
          duration: result.duration,
          skippedCount: result.skippedFields.length,
          errorCount: result.errors.length,
        },
      });

      // Show visual feedback on page
      this.showAutofillFeedback(result, analysis.platform);

      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Analyze current page for job application forms
   */
  private async analyzeCurrentPage(): Promise<FormAnalysisResult> {
    try {
      const platform = this.detectPlatform();
      const forms = await this.detectForms(platform);

      const confidence = this.calculateConfidence(platform, forms);

      return {
        success: true,
        platform,
        forms,
        confidence,
      };
    } catch (error) {
      return {
        success: false,
        platform: 'custom',
        forms: [],
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Detect platform based on URL and page content
   */
  private detectPlatform(): JobPlatform {
    const hostname = window.location.hostname.toLowerCase();
    const url = window.location.href.toLowerCase();

    // Major job platforms
    if (hostname.includes('linkedin.com')) {
      return 'linkedin';
    }

    if (hostname.includes('indeed.com')) {
      return 'indeed';
    }

    if (hostname.includes('workday') || hostname.includes('myworkdayjobs.com')) {
      return 'workday';
    }

    // ATS platforms
    if (hostname.includes('smartrecruiters.com') || url.includes('smartrecruiters')) {
      return 'smartrecruiters';
    }

    if (hostname.includes('teamtailor.com') || url.includes('teamtailor')) {
      return 'teamtailor';
    }

    if (hostname.includes('greenhouse.io') || hostname.includes('boards.greenhouse.io')) {
      return 'greenhouse';
    }

    if (hostname.includes('lever.co') || hostname.includes('jobs.lever.co')) {
      return 'lever';
    }

    if (hostname.includes('bamboohr.com') || hostname.includes('bamboohr.co')) {
      return 'bamboohr';
    }

    if (hostname.includes('jobvite.com')) {
      return 'jobvite';
    }

    if (hostname.includes('icims.com')) {
      return 'icims';
    }

    // Company-specific career pages
    if (url.includes('careers') || url.includes('jobs')) {
      return 'company_careers';
    }

    return 'custom';
  }

  /**
   * Detect forms on the current page
   */
  private async detectForms(platform: JobPlatform): Promise<DetectedForm[]> {
    const detectedForms: DetectedForm[] = [];

    // Method 1: Traditional form elements
    const forms = document.querySelectorAll('form');
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i] as HTMLFormElement;
      const detectedForm = await this.analyzeForm(form, platform);
      if (detectedForm && this.isJobApplicationForm(detectedForm)) {
        detectedForms.push(detectedForm);
      }
    }

    // Method 2: Modern SPA forms without form tags (common in React/Vue apps)
    if (detectedForms.length === 0) {
      const containerSelectors = [
        '[data-testid*="application"]',
        '[data-testid*="form"]',
        '[class*="application"]',
        '[class*="job-form"]',
        '[class*="apply"]',
        '.form-container',
        '.application-form',
        '.job-application',
        '[role="form"]',
      ];

      for (const selector of containerSelectors) {
        const containers = document.querySelectorAll(selector);
        for (let i = 0; i < containers.length; i++) {
          const container = containers[i] as HTMLElement;
          const detectedForm = await this.analyzeFormContainer(container, platform);
          if (detectedForm && this.isJobApplicationForm(detectedForm)) {
            detectedForms.push(detectedForm);
          }
        }
      }
    }

    // Method 3: Fallback - scan entire page for input clusters
    if (detectedForms.length === 0) {
      const pageForm = await this.analyzePageAsForm(platform);
      if (pageForm && this.isJobApplicationForm(pageForm)) {
        detectedForms.push(pageForm);
      }
    }

    return detectedForms;
  }

  /**
   * Analyze a container element as a form (for SPA applications)
   */
  private async analyzeFormContainer(container: HTMLElement, platform: JobPlatform): Promise<DetectedForm | null> {
    try {
      const fields = this.extractFieldsFromContainer(container);

      if (fields.length === 0) {
        return null;
      }

      const formId = this.generateContainerId(container);
      const confidence = this.calculateFormConfidence(fields, platform);

      return {
        platform,
        formId,
        url: window.location.href,
        fields,
        confidence,
        supportedFeatures: this.getSupportedFeatures(fields, platform),
        detectedAt: new Date(),
        isMultiStep: this.isMultiStepContainer(container),
        currentStep: this.getCurrentStepFromContainer(container),
        totalSteps: this.getTotalStepsFromContainer(container),
      };
    } catch (error) {
      console.error('Error analyzing form container:', error);
      return null;
    }
  }

  /**
   * Analyze entire page as a single form (fallback method)
   */
  private async analyzePageAsForm(platform: JobPlatform): Promise<DetectedForm | null> {
    try {
      const fields = this.extractFieldsFromContainer(document.body);

      if (fields.length < 3) {
        // Require at least 3 fields for page-level detection
        return null;
      }

      const confidence = this.calculateFormConfidence(fields, platform) * 0.7; // Lower confidence for page-level

      return {
        platform,
        formId: 'page_form',
        url: window.location.href,
        fields,
        confidence,
        supportedFeatures: this.getSupportedFeatures(fields, platform),
        detectedAt: new Date(),
        isMultiStep: this.isMultiStepPage(),
        currentStep: undefined,
        totalSteps: undefined,
      };
    } catch (error) {
      console.error('Error analyzing page as form:', error);
      return null;
    }
  }

  /**
   * Extract fields from any container element
   */
  private extractFieldsFromContainer(container: HTMLElement): FormField[] {
    const fields: FormField[] = [];
    const inputs = container.querySelectorAll('input, textarea, select');
    const processedRadioGroups = new Set<string>();
    const processedCustomCheckboxGroups = new Set<string>();

    for (let i = 0; i < inputs.length; i++) {
      const element = inputs[i] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

      // Skip hidden fields, buttons, and submit inputs
      if (this.shouldSkipField(element)) {
        continue;
      }

      // Special handling for radio buttons - group them by name
      if (element.tagName.toLowerCase() === 'input' && (element as HTMLInputElement).type === 'radio') {
        const radioElement = element as HTMLInputElement;
        const groupName = radioElement.name;
        
        if (groupName && !processedRadioGroups.has(groupName)) {
          processedRadioGroups.add(groupName);
          
          // Create a field for the entire radio group
          const radioGroupField = this.analyzeRadioGroup(groupName, container, i);
          if (radioGroupField) {
            fields.push(radioGroupField);
          }
        }
        continue; // Skip individual radio button processing
      }

      const field = this.analyzeFormField(element, i);
      if (field) {
        fields.push(field);
      }
    }

    // Also look for custom checkboxes with role="checkbox"
    const customCheckboxGroups = container.querySelectorAll('[role="group"]');
    for (let i = 0; i < customCheckboxGroups.length; i++) {
      const group = customCheckboxGroups[i] as HTMLElement;
      const checkboxes = group.querySelectorAll('[role="checkbox"]');
      
      if (checkboxes.length > 0) {
        const groupId = group.getAttribute('data-testid') || group.id || `custom_checkbox_group_${i}`;
        
        if (!processedCustomCheckboxGroups.has(groupId)) {
          processedCustomCheckboxGroups.add(groupId);
          
          const customCheckboxField = this.analyzeCustomCheckboxGroup(group, fields.length);
          if (customCheckboxField) {
            fields.push(customCheckboxField);
          }
        }
      }
    }

    return fields;
  }

  /**
   * Analyze a custom checkbox group (role="checkbox" elements)
   */
  private analyzeCustomCheckboxGroup(group: HTMLElement, index: number): FormField | null {
    try {
      const checkboxes = group.querySelectorAll('[role="checkbox"]');
      if (checkboxes.length === 0) {
        return null;
      }

      // Get the group label - look for nearby text or data attributes
      let label = '';
      
      // Try to find label from parent elements or siblings
      const parentElement = group.parentElement;
      if (parentElement) {
        const labelElement = parentElement.querySelector('label, .label, .question, [class*="label"]');
        if (labelElement) {
          label = labelElement.textContent?.trim() || '';
        }
      }

      // Fallback to group's own text content or data attributes
      if (!label) {
        label = group.getAttribute('aria-label') || 
                group.getAttribute('data-label') || 
                'Custom Checkbox Group';
      }

      // Get all possible values for this checkbox group
      const options: string[] = [];
      checkboxes.forEach(checkbox => {
        const checkboxElement = checkbox as HTMLElement;
        const value = checkboxElement.getAttribute('data-value');
        if (value) {
          options.push(value);
        }
      });

      const selector = group.getAttribute('data-testid') ? 
        `[data-testid="${group.getAttribute('data-testid')}"]` : 
        `[role="group"]`;

      console.log(`Custom checkbox group analyzed:`, {
        label,
        options,
        selector,
        checkboxCount: checkboxes.length
      });

      return {
        id: `custom_checkbox_group_${index}`,
        type: 'checkbox',
        label,
        selector,
        required: group.hasAttribute('required') || group.getAttribute('aria-required') === 'true',
        placeholder: undefined,
        options,
        mappedProfileField: this.mapToProfileField(label, 'checkbox'),
        validationRules: [],
      };
    } catch (error) {
      console.error('Error analyzing custom checkbox group:', error);
      return null;
    }
  }

  /**
   * Analyze a radio button group as a single field
   */
  private analyzeRadioGroup(groupName: string, container: HTMLElement, index: number): FormField | null {
    try {
      const radioButtons = container.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
      if (radioButtons.length === 0) {
        return null;
      }

      const firstRadio = radioButtons[0] as HTMLInputElement;
      const label = this.getFieldLabel(firstRadio);
      const selector = `input[type="radio"][name="${groupName}"]`;

      // Get all possible values for this radio group
      const options: string[] = [];
      radioButtons.forEach(radio => {
        const radioInput = radio as HTMLInputElement;
        if (radioInput.value) {
          options.push(radioInput.value);
        }
      });

      console.log(`Radio group analyzed:`, {
        groupName,
        label,
        options,
        selector
      });

      return {
        id: `radio_group_${index}`,
        type: 'radio',
        label,
        selector,
        required: firstRadio.hasAttribute('required'),
        placeholder: undefined,
        options,
        mappedProfileField: this.mapToProfileField(label, 'radio'),
        validationRules: this.extractValidationRules(firstRadio),
      };
    } catch (error) {
      console.error('Error analyzing radio group:', error);
      return null;
    }
  }

  /**
   * Check if field should be skipped
   */
  private shouldSkipField(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
    if (element.type === 'hidden' || element.type === 'submit' || element.type === 'button') {
      return true;
    }

    if (element.style.display === 'none' || element.style.visibility === 'hidden') {
      return true;
    }

    if (element.hasAttribute('disabled') || element.hasAttribute('readonly')) {
      return true;
    }

    // Skip CSRF tokens and other security fields
    const name = element.getAttribute('name')?.toLowerCase() || '';
    if (name.includes('csrf') || name.includes('token') || name.includes('_method')) {
      return true;
    }

    return false;
  }

  /**
   * Generate ID for container-based forms
   */
  private generateContainerId(container: HTMLElement): string {
    if (container.id) {
      return `container_${container.id}`;
    }

    const className = container.className.split(' ')[0];
    if (className) {
      return `container_${className}`;
    }

    return `container_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if container has multi-step indicators
   */
  private isMultiStepContainer(container: HTMLElement): boolean {
    const stepSelectors = [
      '.step',
      '.wizard-step',
      '[data-step]',
      '.progress-step',
      '.stepper',
      '.form-step',
      '[class*="step"]',
    ];

    for (const selector of stepSelectors) {
      if (container.querySelectorAll(selector).length > 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get current step from container
   */
  private getCurrentStepFromContainer(container: HTMLElement): number | undefined {
    const activeSelectors = [
      '.step.active',
      '.wizard-step.active',
      '[data-step].active',
      '.step.current',
      '.wizard-step.current',
      '[data-step].current',
    ];

    for (const selector of activeSelectors) {
      const activeStep = container.querySelector(selector);
      if (activeStep) {
        const stepAttr = activeStep.getAttribute('data-step');
        if (stepAttr) {
          return parseInt(stepAttr);
        }
      }
    }

    return undefined;
  }

  /**
   * Get total steps from container
   */
  private getTotalStepsFromContainer(container: HTMLElement): number | undefined {
    const stepSelectors = ['.step', '.wizard-step', '[data-step]', '.progress-step'];

    for (const selector of stepSelectors) {
      const steps = container.querySelectorAll(selector);
      if (steps.length > 1) {
        return steps.length;
      }
    }

    return undefined;
  }

  /**
   * Check if page has multi-step indicators
   */
  private isMultiStepPage(): boolean {
    const stepIndicators = document.querySelectorAll('.step, [data-step], .wizard-step, .progress-step');
    return stepIndicators.length > 1;
  }

  /**
   * Analyze individual form element
   */
  private async analyzeForm(formElement: HTMLFormElement, platform: JobPlatform): Promise<DetectedForm | null> {
    try {
      const fields = this.extractFormFields(formElement);

      if (fields.length === 0) {
        return null;
      }

      const formId = this.generateFormId(formElement);
      const confidence = this.calculateFormConfidence(fields, platform);

      return {
        platform,
        formId,
        url: window.location.href,
        fields,
        confidence,
        supportedFeatures: this.getSupportedFeatures(fields, platform),
        detectedAt: new Date(),
        isMultiStep: this.isMultiStepForm(formElement),
        currentStep: this.getCurrentStep(formElement),
        totalSteps: this.getTotalSteps(formElement),
      };
    } catch (error) {
      console.error('Error analyzing form:', error);
      return null;
    }
  }

  /**
   * Extract fields from form element
   */
  private extractFormFields(formElement: HTMLFormElement): FormField[] {
    const fields: FormField[] = [];
    const inputs = formElement.querySelectorAll('input, textarea, select');

    for (let i = 0; i < inputs.length; i++) {
      const element = inputs[i] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      const field = this.analyzeFormField(element, i);
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  /**
   * Analyze individual form field
   */
  private analyzeFormField(
    element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    index: number,
  ): FormField | null {
    try {
      const type = this.getFieldType(element);
      const label = this.getFieldLabel(element);
      const selector = this.generateFieldSelector(element, index);

      if (!type || !selector) {
        return null;
      }

      const mappedField = this.mapToProfileField(label, type);
      
      // Debug logging for radio buttons
      if (type === 'radio') {
        console.log(`Radio button detected:`, {
          label,
          type,
          selector,
          mappedField,
          name: element.getAttribute('name'),
          value: (element as HTMLInputElement).value
        });
      }

      return {
        id: `field_${index}`,
        type,
        label,
        selector,
        required: element.hasAttribute('required'),
        placeholder: element.getAttribute('placeholder') || undefined,
        options: this.getFieldOptions(element),
        mappedProfileField: mappedField,
        validationRules: this.extractValidationRules(element),
      };
    } catch (error) {
      console.error('Error analyzing field:', error);
      return null;
    }
  }

  /**
   * Get field type from element
   */
  private getFieldType(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): FieldType | null {
    if (element.tagName.toLowerCase() === 'textarea') {
      return 'textarea';
    }

    if (element.tagName.toLowerCase() === 'select') {
      return 'select';
    }

    if (element.tagName.toLowerCase() === 'input') {
      const inputElement = element as HTMLInputElement;
      const type = inputElement.type.toLowerCase();

      const typeMap: Record<string, FieldType> = {
        text: 'text',
        email: 'email',
        tel: 'phone',
        phone: 'phone',
        checkbox: 'checkbox',
        radio: 'radio',
        file: 'file',
        date: 'date',
        number: 'number',
        url: 'url',
      };

      return typeMap[type] || 'text';
    }

    return null;
  }

  /**
   * Get field label
   */
  private getFieldLabel(element: HTMLElement): string {
    // For radio buttons, try to get the fieldset legend first
    if (element.tagName.toLowerCase() === 'input' && (element as HTMLInputElement).type === 'radio') {
      const fieldset = element.closest('fieldset');
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend && legend.textContent?.trim()) {
          console.log(`Found radio fieldset legend: ${legend.textContent.trim()}`);
          return legend.textContent.trim();
        }
      }
    }

    // Try to find associated label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return label.textContent?.trim() || '';
      }
    }

    // Try parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel.textContent?.trim() || '';
    }

    // Try nearby text
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      return placeholder;
    }

    // Try name attribute
    const name = element.getAttribute('name');
    if (name) {
      return name.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return 'Unknown Field';
  }

  /**
   * Generate CSS selector for field
   */
  private generateFieldSelector(element: HTMLElement, index: number): string {
    // Try ID first
    if (element.id) {
      // Check if ID starts with a number (invalid for CSS selectors)
      if (/^\d/.test(element.id)) {
        return `[id="${element.id}"]`;
      }
      return `#${element.id}`;
    }

    // Try name attribute
    const name = element.getAttribute('name');
    if (name) {
      return `[name="${name}"]`;
    }

    // Try data attributes
    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) {
      return `[data-testid="${dataTestId}"]`;
    }

    // Fallback to tag + index
    const tagName = element.tagName.toLowerCase();
    return `${tagName}:nth-of-type(${index + 1})`;
  }

  /**
   * Get options for select/radio fields
   */
  private getFieldOptions(element: HTMLElement): string[] | undefined {
    if (element.tagName.toLowerCase() === 'select') {
      const options = (element as HTMLSelectElement).querySelectorAll('option');
      return Array.from(options)
        .map(option => option.textContent?.trim() || '')
        .filter(Boolean);
    }

    return undefined;
  }

  /**
   * Map field to profile field
   */
  private mapToProfileField(label: string, type: FieldType): string | undefined {
    const labelLower = label.toLowerCase();
    const element = document.querySelector(
      `[aria-label*="${label}"], [placeholder*="${label}"], [name*="${label}"]`,
    ) as HTMLElement;

    // Get additional context from element attributes
    const name = element?.getAttribute('name')?.toLowerCase() || '';
    const id = element?.getAttribute('id')?.toLowerCase() || '';
    const placeholder = element?.getAttribute('placeholder')?.toLowerCase() || '';
    const ariaLabel = element?.getAttribute('aria-label')?.toLowerCase() || '';

    // Combine all text sources for better matching
    const allText = `${labelLower} ${name} ${id} ${placeholder} ${ariaLabel}`.toLowerCase();

    // Personal info mappings with enhanced patterns
    if (this.matchesPattern(allText, ['first.?name', 'given.?name', 'fname', 'firstname'])) {
      return 'personalInfo.firstName';
    }
    if (this.matchesPattern(allText, ['last.?name', 'family.?name', 'surname', 'lastname', 'lname'])) {
      return 'personalInfo.lastName';
    }
    if (
      this.matchesPattern(allText, ['full.?name', 'name', 'applicant.?name']) &&
      !allText.includes('first') &&
      !allText.includes('last')
    ) {
      // If it's a single name field, map to firstName (user can enter full name)
      return 'personalInfo.firstName';
    }
    if (this.matchesPattern(allText, ['email', 'e-mail', 'mail'])) {
      return 'personalInfo.email';
    }
    if (this.matchesPattern(allText, ['phone', 'mobile', 'telephone', 'tel', 'contact.?number', 'cell'])) {
      return 'personalInfo.phone';
    }

    // Address mappings with enhanced patterns
    if (this.matchesPattern(allText, ['address', 'street', 'addr', 'location', 'residence'])) {
      return 'personalInfo.address.street';
    }
    if (this.matchesPattern(allText, ['city', 'town', 'municipality'])) {
      return 'personalInfo.address.city';
    }
    if (this.matchesPattern(allText, ['state', 'province', 'region', 'county'])) {
      return 'personalInfo.address.state';
    }
    if (this.matchesPattern(allText, ['zip', 'postal', 'postcode', 'zipcode'])) {
      return 'personalInfo.address.zipCode';
    }
    if (this.matchesPattern(allText, ['country', 'nation', 'nationality'])) {
      return 'personalInfo.address.country';
    }

    // Professional URLs with enhanced patterns
    if (this.matchesPattern(allText, ['linkedin', 'linked.?in', 'li.?profile'])) {
      return 'personalInfo.linkedInUrl';
    }
    if (this.matchesPattern(allText, ['portfolio', 'website', 'personal.?site', 'web.?site'])) {
      return 'personalInfo.portfolioUrl';
    }
    if (this.matchesPattern(allText, ['github', 'git.?hub', 'gh.?profile'])) {
      return 'personalInfo.githubUrl';
    }

    // Job preferences and professional info
    if (this.matchesPattern(allText, ['salary', 'compensation', 'expected.?salary', 'desired.?salary'])) {
      return 'preferences.jobPreferences.desiredSalaryMin';
    }
    if (this.matchesPattern(allText, ['start.?date', 'available', 'availability', 'join.?date'])) {
      return 'preferences.jobPreferences.availableStartDate';
    }
    if (this.matchesPattern(allText, ['work.?authorization', 'visa', 'sponsorship', 'eligible.?to.?work'])) {
      return 'preferences.jobPreferences.workAuthorization';
    }
    
    // Enhanced visa sponsorship detection for radio buttons
    if (this.matchesPattern(allText, ['require.*visa.*sponsorship', 'visa.*sponsorship', 'sponsorship.*required', 'need.*sponsorship'])) {
      console.log(`Mapped visa sponsorship field: ${label} -> preferences.jobPreferences.requiresSponsorship`);
      return 'preferences.jobPreferences.requiresSponsorship';
    }
    
    if (this.matchesPattern(allText, ['relocat', 'willing.?to.?move', 'move.?for.?job'])) {
      return 'preferences.jobPreferences.willingToRelocate';
    }
    
    // Enhanced travel/office visit detection
    if (this.matchesPattern(allText, ['travel.*office', 'visit.*office', 'come.*office', 'office.*visit', 'work.*from.*office'])) {
      return 'preferences.jobPreferences.willingToRelocate';
    }

    // Cover letter and summary fields
    if (this.matchesPattern(allText, ['cover.?letter', 'motivation', 'why.?interested', 'message'])) {
      return 'professionalInfo.summary';
    }
    if (this.matchesPattern(allText, ['summary', 'about', 'bio', 'description', 'profile'])) {
      return 'professionalInfo.summary';
    }

    // File upload fields
    if (type === 'file') {
      if (this.matchesPattern(allText, ['resume', 'cv', 'curriculum'])) {
        return 'documents.resumes';
      }
      if (this.matchesPattern(allText, ['cover.?letter', 'motivation.?letter'])) {
        return 'documents.coverLetters';
      }
    }

    // Demographic and diversity fields
    if (this.matchesPattern(allText, ['gender.?identity', 'gender', 'how.?would.?you.?describe.?your.?gender'])) {
      return 'preferences.defaultAnswers.gender_identity';
    }
    if (this.matchesPattern(allText, ['transgender', 'identify.?as.?transgender', 'trans'])) {
      return 'preferences.defaultAnswers.transgender';
    }
    if (this.matchesPattern(allText, ['sexual.?orientation', 'orientation', 'sexuality'])) {
      return 'preferences.defaultAnswers.sexual_orientation';
    }
    if (this.matchesPattern(allText, ['disability', 'identify.?as.?having.?a.?disability', 'disabled'])) {
      return 'preferences.defaultAnswers.disability';
    }
    if (
      this.matchesPattern(allText, ['neurodivergent', 'neurodiverse', 'consider.?yourself.?to.?be.?neurodivergent'])
    ) {
      return 'preferences.defaultAnswers.neurodivergent';
    }
    if (
      this.matchesPattern(allText, [
        'ethnicity',
        'ethnic',
        'race',
        'racial',
        'how.?would.?your.?describe.?your.?ethnicity',
      ])
    ) {
      return 'preferences.defaultAnswers.ethnicity';
    }
    if (this.matchesPattern(allText, ['veteran', 'military', 'armed.?forces', 'service.?member'])) {
      return 'preferences.defaultAnswers.veteran_status';
    }

    return undefined;
  }

  /**
   * Helper method to match patterns using regex
   */
  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    });
  }

  /**
   * Extract validation rules from element
   */
  private extractValidationRules(element: HTMLElement): any[] {
    const rules: any[] = [];

    if (element.hasAttribute('required')) {
      rules.push({
        type: 'required',
        message: 'This field is required',
      });
    }

    const maxLength = element.getAttribute('maxlength');
    if (maxLength) {
      rules.push({
        type: 'maxLength',
        value: parseInt(maxLength),
        message: `Maximum ${maxLength} characters`,
      });
    }

    const pattern = element.getAttribute('pattern');
    if (pattern) {
      rules.push({
        type: 'pattern',
        value: pattern,
        message: 'Invalid format',
      });
    }

    return rules;
  }

  /**
   * Check if form is a job application form
   */
  private isJobApplicationForm(form: DetectedForm): boolean {
    // Check URL patterns
    const url = window.location.href.toLowerCase();
    const urlIndicators = ['apply', 'application', 'job', 'career', 'position', 'hiring'];
    const hasJobUrl = urlIndicators.some(indicator => url.includes(indicator));

    // Check page content for job-related keywords
    const pageText = document.body.textContent?.toLowerCase() || '';
    const jobKeywords = ['apply now', 'submit application', 'job application', 'position', 'career opportunity'];
    const hasJobContent = jobKeywords.some(keyword => pageText.includes(keyword));

    // Check form fields
    const hasPersonalFields = form.fields.some(field => field.mappedProfileField?.startsWith('personalInfo'));

    const hasJobRelatedFields = form.fields.some(field => {
      const label = field.label.toLowerCase();
      return (
        label.includes('resume') ||
        label.includes('cv') ||
        label.includes('cover letter') ||
        label.includes('experience') ||
        label.includes('salary') ||
        label.includes('available') ||
        label.includes('start date') ||
        label.includes('work authorization') ||
        label.includes('sponsorship') ||
        label.includes('relocate')
      );
    });

    // Check for file upload fields (common in job applications)
    const hasFileUpload = form.fields.some(field => field.type === 'file');

    // Check for textarea fields (often used for cover letters/motivation)
    const hasTextArea = form.fields.some(field => field.type === 'textarea');

    // Scoring system
    let score = 0;
    if (hasJobUrl) score += 3;
    if (hasJobContent) score += 2;
    if (hasPersonalFields) score += 3;
    if (hasJobRelatedFields) score += 4;
    if (hasFileUpload) score += 2;
    if (hasTextArea) score += 1;
    if (form.fields.length >= 5) score += 2;
    if (form.fields.length >= 10) score += 1;

    // Platform-specific bonuses
    if (form.platform !== 'custom') {
      score += 2;
    }

    // Minimum threshold for job application form
    return score >= 4;
  }

  /**
   * Calculate form confidence score
   */
  private calculateFormConfidence(fields: FormField[], platform: JobPlatform): number {
    let score = 0;

    // Base score for having fields
    score += Math.min(fields.length * 0.1, 0.5);

    // Bonus for mapped fields
    const mappedFields = fields.filter(f => f.mappedProfileField);
    score += mappedFields.length * 0.1;

    // Platform-specific bonuses
    if (platform !== 'custom') {
      score += 0.2;
    }

    // Job-related field bonuses
    const jobFields = fields.filter(f => {
      const label = f.label.toLowerCase();
      return label.includes('resume') || label.includes('experience') || label.includes('salary');
    });
    score += jobFields.length * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(platform: JobPlatform, forms: DetectedForm[]): number {
    if (forms.length === 0) return 0;

    const avgConfidence = forms.reduce((sum, form) => sum + form.confidence, 0) / forms.length;
    return avgConfidence;
  }

  /**
   * Get supported features for platform
   */
  private getSupportedFeatures(fields: FormField[], platform: JobPlatform): any[] {
    const features = ['basic_info'];

    if (fields.some(f => f.type === 'file')) {
      features.push('file_upload');
    }

    if (fields.some(f => f.type === 'textarea')) {
      features.push('ai_content');
    }

    return features;
  }

  /**
   * Check if form is multi-step
   */
  private isMultiStepForm(formElement: HTMLFormElement): boolean {
    const stepIndicators = formElement.querySelectorAll('.step, [data-step], .wizard-step');
    return stepIndicators.length > 1;
  }

  /**
   * Get current step
   */
  private getCurrentStep(formElement: HTMLFormElement): number | undefined {
    const activeStep = formElement.querySelector('.step.active, [data-step].active, .wizard-step.active');
    if (activeStep) {
      const stepAttr = activeStep.getAttribute('data-step');
      if (stepAttr) {
        return parseInt(stepAttr);
      }
    }
    return undefined;
  }

  /**
   * Get total steps
   */
  private getTotalSteps(formElement: HTMLFormElement): number | undefined {
    const steps = formElement.querySelectorAll('.step, [data-step], .wizard-step');
    return steps.length > 1 ? steps.length : undefined;
  }

  /**
   * Generate form ID
   */
  private generateFormId(formElement: HTMLFormElement): string {
    if (formElement.id) {
      return formElement.id;
    }

    const name = formElement.getAttribute('name');
    if (name) {
      return name;
    }

    return `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Select best form for autofill
   */
  private selectBestForm(forms: DetectedForm[]): DetectedForm | null {
    if (forms.length === 0) return null;
    if (forms.length === 1) return forms[0];

    // Sort by confidence and field count
    return forms.sort((a, b) => {
      const scoreA = a.confidence + a.fields.length * 0.01;
      const scoreB = b.confidence + b.fields.length * 0.01;
      return scoreB - scoreA;
    })[0];
  }

  /**
   * Perform autofill on the selected form
   */
  private async performAutofill(form: DetectedForm): Promise<AutofillResult> {
    const startTime = Date.now();
    const filledFields: any[] = [];
    const skippedFields: any[] = [];
    const errors: any[] = [];

    if (!this.profile) {
      throw new Error('Profile not available');
    }

    for (const field of form.fields) {
      try {
        const element = document.querySelector(field.selector) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement;

        if (!element) {
          skippedFields.push({
            fieldId: field.id,
            selector: field.selector,
            reason: 'field_not_found',
            message: 'Field element not found in DOM',
          });
          continue;
        }

        const value = this.getFieldValue(field, this.profile);

        if (value === null || value === undefined || value === '') {
          skippedFields.push({
            fieldId: field.id,
            selector: field.selector,
            reason: 'no_mapping',
            message: 'No profile data available for this field',
          });
          continue;
        }

        let success = false;
        
        // Special handling for radio groups
        if (field.type === 'radio' && field.selector.includes('[name=')) {
          success = await this.fillRadioGroup(field, value);
        } 
        // Special handling for custom checkbox groups
        else if (field.type === 'checkbox' && field.id.includes('custom_checkbox_group')) {
          success = await this.fillCustomCheckboxGroup(field, value);
        } 
        else {
          success = await this.fillFieldElement(element, field, value);
        }

        if (success) {
          filledFields.push({
            fieldId: field.id,
            selector: field.selector,
            value: value,
            source: field.mappedProfileField ? 'profile' : 'default_answer',
          });
        } else {
          errors.push({
            fieldId: field.id,
            selector: field.selector,
            code: 'fill_failed',
            message: 'Failed to fill field with value',
            recoverable: true,
          });
        }
      } catch (error) {
        errors.push({
          fieldId: field.id,
          selector: field.selector,
          code: 'unexpected_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false,
        });
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: filledFields.length > 0,
      filledFields,
      skippedFields,
      errors,
      totalFields: form.fields.length,
      filledCount: filledFields.length,
      duration,
    };
  }

  /**
   * Get field value from profile using enhanced validation and intelligent defaults
   */
  private getFieldValue(field: FormField, profile: UserProfile): string | null {
    const result = this.profileValidator.getProfileValue(field, profile);

    console.log(`Getting value for field: ${field.label} -> ${field.mappedProfileField || 'unmapped'}`);
    console.log(`Value source: ${result.source}, confidence: ${result.confidence}, value: ${result.value}`);

    if (result.alternatives && result.alternatives.length > 0) {
      console.log(`Alternative values available: ${result.alternatives.join(', ')}`);
    }

    return result.value;
  }

  /**
   * Fill individual field element
   */
  private async fillFieldElement(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      if (field.type === 'file') {
        console.log(`Skipping file upload field: ${field.label} to prevent DOM mutations`);
        return false; // Skip file upload fields completely
      }

      if (element.tagName.toLowerCase() === 'select') {
        await this.handleSelectField(element as HTMLSelectElement, value);
        return true;
      }

      // Try intelligent component handler for complex components (React Select, etc.)
      try {
        const success = await this.componentHandler.fillComponent(element, value);
        if (success) {
          console.log('Field filled successfully using intelligent component handler');
          return true;
        }
      } catch (error) {
        console.warn('Intelligent component handler failed:', error);
      }

      if (element.tagName.toLowerCase() === 'textarea') {
        return this.fillTextElement(element as HTMLTextAreaElement, value);
      }

      if (element.tagName.toLowerCase() === 'input') {
        const inputElement = element as HTMLInputElement;

        if (inputElement.type === 'checkbox' || inputElement.type === 'radio') {
          return this.handleCheckboxRadio(inputElement, value);
        }

        return this.fillTextElement(inputElement, value);
      }

      // Handle contenteditable elements
      if (element.hasAttribute('contenteditable')) {
        element.textContent = value;
        this.triggerEvents(element);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error filling field element:', error);
      return false;
    }
  }

  /**
   * Fill text input or textarea
   */
  private fillTextElement(element: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
    try {
      // Clear existing value
      element.value = '';

      // Set new value
      element.value = value;

      // Trigger events to notify the application
      this.triggerEvents(element);

      return true;
    } catch (error) {
      console.error('Error filling text element:', error);
      return false;
    }
  }

  /**
   * Fill custom checkbox group (role="checkbox" elements)
   */
  private async fillCustomCheckboxGroup(field: FormField, value: string): Promise<boolean> {
    try {
      console.log(`Filling custom checkbox group: ${field.label} with value: ${value}`);
      
      // Find the group element
      const groupElement = document.querySelector(field.selector) as HTMLElement;
      if (!groupElement) {
        console.error(`Custom checkbox group not found: ${field.selector}`);
        return false;
      }

      // Find all checkboxes in the group
      const checkboxes = groupElement.querySelectorAll('[role="checkbox"]');
      if (checkboxes.length === 0) {
        console.error('No checkboxes found in custom checkbox group');
        return false;
      }

      let success = false;
      const lowerValue = value.toLowerCase();

      // Try to find matching checkbox by data-value or text content
      for (let i = 0; i < checkboxes.length; i++) {
        const checkbox = checkboxes[i] as HTMLElement;
        const dataValue = checkbox.getAttribute('data-value')?.toLowerCase();
        const textContent = checkbox.textContent?.trim().toLowerCase();

        // Check if this checkbox matches the value
        if (dataValue === lowerValue || 
            textContent?.includes(lowerValue) ||
            (lowerValue === 'yes' && (dataValue === 'true' || textContent?.includes('yes'))) ||
            (lowerValue === 'no' && (dataValue === 'false' || textContent?.includes('no')))) {
          
          try {
            // Focus the checkbox if possible
            if (checkbox.tabIndex >= 0) {
              checkbox.focus();
            }

            // Set aria-checked to true
            checkbox.setAttribute('aria-checked', 'true');

            // Find and update any hidden input
            const hiddenInput = checkbox.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (hiddenInput) {
              hiddenInput.checked = true;
              this.triggerEvents(hiddenInput);
            }

            // Click the checkbox to trigger any event handlers
            checkbox.click();

            console.log(`Successfully selected custom checkbox: ${dataValue || textContent}`);
            success = true;
            break;
          } catch (error) {
            console.error('Error clicking custom checkbox:', error);
            continue;
          }
        }
      }

      if (!success) {
        console.warn(`No matching custom checkbox found for value: ${value} in group: ${field.label}`);
        
        // Fallback: try to select the first checkbox if it's a yes/no type question
        if (lowerValue === 'yes' || lowerValue === 'true') {
          const firstCheckbox = checkboxes[0] as HTMLElement;
          try {
            firstCheckbox.setAttribute('aria-checked', 'true');
            const hiddenInput = firstCheckbox.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (hiddenInput) {
              hiddenInput.checked = true;
              this.triggerEvents(hiddenInput);
            }
            firstCheckbox.click();
            success = true;
            console.log('Fallback: selected first checkbox for yes/true value');
          } catch (error) {
            console.error('Fallback checkbox selection failed:', error);
          }
        }
      }

      return success;
    } catch (error) {
      console.error('Error filling custom checkbox group:', error);
      return false;
    }
  }

  /**
   * Handle checkbox and radio inputs
   */
  private handleCheckboxRadio(element: HTMLInputElement, value: string): boolean {
    try {
      const lowerValue = value.toLowerCase();

      if (element.type === 'checkbox') {
        const shouldCheck = lowerValue === 'yes' || lowerValue === 'true' || lowerValue === '1';
        element.checked = shouldCheck;
        this.triggerEvents(element);
        return true;
      } 
      
      if (element.type === 'radio') {
        // For radio buttons, we need to find the correct option in the group
        const name = element.name;
        if (!name) {
          console.warn('Radio button has no name attribute');
          return false;
        }

        // Find all radio buttons with the same name
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        let selectedRadio: HTMLInputElement | null = null;

        // Try to find the radio button that matches the value
        for (let i = 0; i < radioGroup.length; i++) {
          const radio = radioGroup[i] as HTMLInputElement;
          
          // Check the radio button's value attribute
          if (radio.value && radio.value.toLowerCase() === lowerValue) {
            selectedRadio = radio;
            break;
          }

          // Check the label text associated with this radio button
          const label = this.getRadioLabel(radio);
          if (label && label.toLowerCase().includes(lowerValue)) {
            selectedRadio = radio;
            break;
          }

          // Check for common yes/no patterns
          if (lowerValue === 'yes' && (radio.value === 'yes' || radio.value === 'true' || radio.value === '1')) {
            selectedRadio = radio;
            break;
          }
          if (lowerValue === 'no' && (radio.value === 'no' || radio.value === 'false' || radio.value === '0')) {
            selectedRadio = radio;
            break;
          }
        }

        if (selectedRadio) {
          // Uncheck all radio buttons in the group first
          radioGroup.forEach(radio => {
            (radio as HTMLInputElement).checked = false;
          });

          // Check the selected radio button
          selectedRadio.checked = true;
          this.triggerEvents(selectedRadio);
          
          console.log(`Selected radio button: ${selectedRadio.value} for question with value: ${value}`);
          return true;
        } else {
          console.warn(`No matching radio button found for value: ${value} in group: ${name}`);
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error('Error handling checkbox/radio:', error);
      return false;
    }
  }

  /**
   * Fill radio button group
   */
  private async fillRadioGroup(field: FormField, value: string): Promise<boolean> {
    try {
      console.log(`Filling radio group: ${field.label} with value: ${value}`);
      
      // Extract the name from the selector
      const nameMatch = field.selector.match(/name="([^"]+)"/);
      if (!nameMatch) {
        console.error('Could not extract name from radio group selector:', field.selector);
        return false;
      }
      
      const groupName = nameMatch[1];
      const radioButtons = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
      
      if (radioButtons.length === 0) {
        console.error(`No radio buttons found for group: ${groupName}`);
        return false;
      }

      const lowerValue = value.toLowerCase();
      let selectedRadio: HTMLInputElement | null = null;

      // Try to find the radio button that matches the value
      for (let i = 0; i < radioButtons.length; i++) {
        const radio = radioButtons[i] as HTMLInputElement;
        
        console.log(`Checking radio button:`, {
          value: radio.value,
          id: radio.id,
          label: this.getRadioLabel(radio)
        });
        
        // Check the radio button's value attribute
        if (radio.value && radio.value.toLowerCase() === lowerValue) {
          selectedRadio = radio;
          break;
        }

        // Check for common yes/no patterns
        if (lowerValue === 'yes' && (radio.value === 'yes' || radio.value === 'true' || radio.value === '1')) {
          selectedRadio = radio;
          break;
        }
        if (lowerValue === 'no' && (radio.value === 'no' || radio.value === 'false' || radio.value === '0')) {
          selectedRadio = radio;
          break;
        }
      }

      if (selectedRadio) {
        // Uncheck all radio buttons in the group first
        radioButtons.forEach(radio => {
          (radio as HTMLInputElement).checked = false;
        });

        // Check the selected radio button
        selectedRadio.checked = true;
        this.triggerEvents(selectedRadio);
        
        console.log(`Successfully selected radio button: ${selectedRadio.value} (${selectedRadio.id}) for question: ${field.label}`);
        return true;
      } else {
        console.warn(`No matching radio button found for value: ${value} in group: ${groupName}`);
        console.log('Available options:', Array.from(radioButtons).map(r => (r as HTMLInputElement).value));
        return false;
      }
    } catch (error) {
      console.error('Error filling radio group:', error);
      return false;
    }
  }

  /**
   * Get label text for a radio button
   */
  private getRadioLabel(radio: HTMLInputElement): string | null {
    // Try to find label by 'for' attribute
    if (radio.id) {
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label) {
        return label.textContent?.trim() || null;
      }
    }

    // Try parent label
    const parentLabel = radio.closest('label');
    if (parentLabel) {
      return parentLabel.textContent?.trim() || null;
    }

    // Try next sibling label
    const nextSibling = radio.nextElementSibling;
    if (nextSibling && nextSibling.tagName.toLowerCase() === 'label') {
      return nextSibling.textContent?.trim() || null;
    }

    return null;
  }

  /**
   * Trigger events to notify applications of value changes
   */
  private triggerEvents(element: HTMLElement): void {
    const events = ['input', 'change', 'blur'];

    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
    });

    // Also trigger React-specific events
    const reactEvents = ['onChange', 'onInput', 'onBlur'];
    reactEvents.forEach(eventType => {
      const reactEvent = new CustomEvent(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(reactEvent);
    });
  }

  /**
   * Handle file upload fields
   */
  private async handleFileUpload(element: HTMLInputElement, field: FormField): Promise<void> {
    try {
      if (!this.profile) return;

      let fileData: any = null;

      // Determine which type of file to upload based on field mapping
      const mappedField = field.mappedProfileField;
      if (mappedField === 'documents.resumes' && this.profile.documents.resumes.length > 0) {
        // Use the default resume or first available
        const resume = this.profile.documents.resumes.find(r => r.isDefault) || this.profile.documents.resumes[0];
        fileData = resume;
      } else if (mappedField === 'documents.coverLetters' && this.profile.documents.coverLetters.length > 0) {
        const coverLetter = this.profile.documents.coverLetters[0];
        fileData = coverLetter;
      }

      if (!fileData) {
        console.log('No file data available for upload field');
        return;
      }

      console.log(`File upload field detected: ${field.label}. Skipping autofill to preserve upload buttons.`);

      // Don't actually interact with file upload fields to avoid triggering
      // website's upload state changes that remove the upload buttons
      // Just show a notification that the user needs to upload manually
      this.showFileUploadGuidanceNew(element, fileData);
    } catch (error) {
      console.error('Error handling file upload:', error);
    }
  }

  /**
   * Handle select field with smart matching and intelligent component support
   */
  private async handleSelectField(element: HTMLSelectElement, value: string): Promise<void> {
    // First try intelligent component handler in case this is a custom select
    try {
      const success = await this.componentHandler.fillComponent(element, value);
      if (success) {
        console.log('Select field filled using intelligent component handler');
        return;
      }
    } catch (error) {
      console.warn('Intelligent component handler failed for select, using fallback:', error);
    }

    // Fallback to standard select handling
    const options = Array.from(element.options);

    // Try exact match first
    let matchedOption = options.find(
      option =>
        option.value.toLowerCase() === value.toLowerCase() || option.textContent?.toLowerCase() === value.toLowerCase(),
    );

    // Try partial match if exact match fails
    if (!matchedOption) {
      matchedOption = options.find(
        option =>
          option.textContent?.toLowerCase().includes(value.toLowerCase()) ||
          value.toLowerCase().includes(option.textContent?.toLowerCase() || ''),
      );
    }

    // Try common mappings for work authorization
    if (!matchedOption && value.toLowerCase().includes('citizen')) {
      matchedOption = options.find(
        option =>
          option.textContent?.toLowerCase().includes('citizen') ||
          option.textContent?.toLowerCase().includes('authorized') ||
          option.textContent?.toLowerCase().includes('yes'),
      );
    }

    if (matchedOption) {
      element.value = matchedOption.value;
      this.triggerEvents(element);
    } else {
      console.log(`No matching option found for value: ${value}`);
    }
  }

  /**
   * Show notification for file upload fields
   */
  private showFileUploadNotification(element: HTMLInputElement, fileData: any): void {
    // Create a visual indicator near the file input
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: absolute;
      background: #4CAF50;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      max-width: 200px;
    `;
    notification.textContent = `📎 Ready to upload: ${fileData.name || fileData.fileName}`;

    // Position near the file input
    const rect = element.getBoundingClientRect();
    notification.style.top = `${rect.bottom + window.scrollY + 5}px`;
    notification.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(notification);

    // Remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);

    // Add click handler to file input to show file info
    element.addEventListener('click', () => {
      console.log('File upload field clicked. Available file:', fileData);
    });
  }

  /**
   * Send notification to background/popup
   */
  private sendNotification(message: any): void {
    try {
      chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Initialize form detection and visual indicators
   */
  private async initializeFormDetection(): Promise<void> {
    if (!this.options.enableFormDetection) {
      return;
    }

    // Wait for page to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.detectAndIndicateForms());
    } else {
      this.detectAndIndicateForms();
    }

    // Re-detect forms when page content changes (for SPAs)
    const observer = new MutationObserver(() => {
      this.debounce(() => this.detectAndIndicateForms(), 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Debounce utility function
   */
  private debounce(func: () => void, wait: number): void {
    clearTimeout((this as any).debounceTimer);
    (this as any).debounceTimer = setTimeout(func, wait);
  }

  /**
   * Detect forms and show visual indicators
   */
  private async detectAndIndicateForms(): Promise<void> {
    try {
      // Clear existing indicators
      this.clearFormIndicators();

      // Analyze page for forms
      const analysis = await this.analyzeCurrentPage();

      if (analysis.success && analysis.forms.length > 0) {
        this.detectedForms = analysis.forms;
        this.showFormIndicators(analysis);
      }
    } catch (error) {
      console.error('Error detecting forms:', error);
    }
  }

  /**
   * Clear existing form indicators
   */
  private clearFormIndicators(): void {
    // Remove tracked indicators
    this.formIndicators.forEach(indicator => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
    this.formIndicators = [];

    // Also remove any orphaned indicators that might not be tracked
    const orphanedIndicators = document.querySelectorAll('[title*="This field will be filled from your profile"]');
    orphanedIndicators.forEach(indicator => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
  }

  /**
   * Show visual indicators for detected forms
   */
  private showFormIndicators(analysis: FormAnalysisResult): void {
    const bestForm = this.selectBestForm(analysis.forms);
    if (!bestForm) return;

    // Only create main button if enabled
    if (this.options.enableButtonCreation) {
      const indicator = this.createAutofillIndicator(analysis.platform, bestForm);
      document.body.appendChild(indicator);
      this.formIndicators.push(indicator);
    }

    // Add field-level indicators for mapped fields
    bestForm.fields.forEach(field => {
      if (field.mappedProfileField) {
        const fieldElement = document.querySelector(field.selector);
        if (fieldElement) {
          const fieldIndicator = this.createFieldIndicator(field);
          this.positionFieldIndicator(fieldIndicator, fieldElement);
          this.formIndicators.push(fieldIndicator);
        }
      }
    });
  }

  /**
   * Create main autofill availability indicator
   */
  private createAutofillIndicator(platform: string, form: DetectedForm): HTMLElement {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 25px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    const mappedFields = form.fields.filter(f => f.mappedProfileField).length;

    indicator.innerHTML = `
      <span style="font-size: 16px;">🚀</span>
      <span style="font-weight: 500;">Autofill Ready</span>
      <span style="font-size: 12px; opacity: 0.8;">${mappedFields}/${form.fields.length} fields</span>
    `;

    indicator.addEventListener('click', () => {
      this.handleAutofillTrigger({
        type: 'autofill:trigger',
        source: 'popup',
        data: { tabId: 0 },
      });
    });

    // Make the indicator draggable
    this.makeDraggable(indicator, 'traditional-autofill-position');

    return indicator;
  }

  /**
   * Position field indicator appropriately based on field type
   */
  private positionFieldIndicator(indicator: HTMLElement, fieldElement: Element): void {
    const fieldType = (fieldElement as HTMLInputElement).type;

    // For checkboxes and radio buttons, position the indicator outside the clickable area
    if (fieldType === 'checkbox' || fieldType === 'radio') {
      // Find the label or wrapper container
      const label =
        fieldElement.closest('label') ||
        fieldElement.parentElement?.querySelector('label') ||
        document.querySelector(`label[for="${fieldElement.id}"]`);

      if (label) {
        // Position after the label to avoid interfering with clicks
        label.parentNode?.insertBefore(indicator, label.nextSibling);
      } else {
        // Find a suitable container that won't interfere with clicking
        const wrapper =
          fieldElement.closest('.checkbox__wrapper, .radio__wrapper, .form-group, .field-wrapper') ||
          fieldElement.parentElement;
        if (wrapper) {
          wrapper.appendChild(indicator);
        }
      }
    } else {
      // For other field types, use the original positioning
      fieldElement.parentNode?.insertBefore(indicator, fieldElement.nextSibling);
    }
  }

  /**
   * Create field indicator
   */
  private createFieldIndicator(field: FormField): HTMLElement {
    const indicator = document.createElement('div');

    // Make the indicator smaller and less intrusive for checkboxes and radio buttons
    const isCheckboxOrRadio = field.type === 'checkbox' || field.type === 'radio';

    indicator.style.cssText = `
      display: inline-block;
      background: #4CAF50;
      color: white;
      padding: ${isCheckboxOrRadio ? '1px 4px' : '2px 6px'};
      border-radius: 3px;
      font-size: ${isCheckboxOrRadio ? '8px' : '10px'};
      font-weight: 500;
      margin-left: ${isCheckboxOrRadio ? '4px' : '8px'};
      vertical-align: middle;
      opacity: 0.7;
      pointer-events: none;
      z-index: 1000;
      ${isCheckboxOrRadio ? 'position: relative; top: -1px;' : ''}
    `;
    indicator.textContent = '✓ Auto-fillable';
    indicator.title = `This field will be filled from your profile: ${field.mappedProfileField}`;

    return indicator;
  }

  /**
   * Show visual feedback on the page after autofill
   */
  private showAutofillFeedback(result: AutofillResult, platform: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${result.success ? '#4CAF50' : '#f44336'};
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    const icon = result.success ? '✅' : '⚠️';
    const title = result.success ? 'Autofill Complete!' : 'Autofill Partial';

    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">
        ${icon} ${title}
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        Filled ${result.filledCount} of ${result.totalFields} fields on ${platform}
        ${result.skippedFields.length > 0 ? `<br>Skipped: ${result.skippedFields.length}` : ''}
        ${result.errors.length > 0 ? `<br>Errors: ${result.errors.length}` : ''}
      </div>
    `;

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    }, 5000);
  }

  /**
   * Check if an autofill indicator already exists for a field element
   */
  private hasExistingIndicator(fieldElement: Element): boolean {
    return !!fieldElement.parentNode?.querySelector('[title*="This field will be filled from your profile"]');
  }

  /**
   * Show guidance for file upload fields (new method)
   */
  private showFileUploadGuidanceNew(element: HTMLInputElement, fileData: any): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: absolute;
      background: #2196F3;
      color: white;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 13px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 280px;
      line-height: 1.4;
      cursor: pointer;
    `;
    notification.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">📎 File Upload Required</div>
      <div style="font-size: 12px; opacity: 0.9;">
        Please manually upload: <strong>${fileData.name || fileData.fileName}</strong>
      </div>
      <div style="font-size: 11px; margin-top: 4px; opacity: 0.8;">
        Click here to dismiss
      </div>
    `;

    // Position near the file input
    const rect = element.getBoundingClientRect();
    notification.style.top = `${rect.bottom + window.scrollY + 8}px`;
    notification.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(notification);

    // Remove on click or after timeout
    const removeNotification = () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    };

    notification.addEventListener('click', removeNotification);

    setTimeout(removeNotification, 8000);

    // Add a subtle highlight to the file input to draw attention
    const originalBorder = element.style.border;
    const originalBoxShadow = element.style.boxShadow;

    element.style.border = '2px solid #2196F3';
    element.style.boxShadow = '0 0 8px rgba(33, 150, 243, 0.3)';

    setTimeout(() => {
      element.style.border = originalBorder;
      element.style.boxShadow = originalBoxShadow;
    }, 3000);
  }

  /**
   * Make element draggable with position persistence
   */
  private makeDraggable(element: HTMLElement, storageKey: string): void {
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    const dragStart = (e: MouseEvent | TouchEvent) => {
      if (e.type === "touchstart") {
        const touch = (e as TouchEvent).touches[0];
        initialX = touch.clientX - xOffset;
        initialY = touch.clientY - yOffset;
      } else {
        initialX = (e as MouseEvent).clientX - xOffset;
        initialY = (e as MouseEvent).clientY - yOffset;
      }

      if (e.target === element || element.contains(e.target as Node)) {
        isDragging = true;
        element.style.cursor = 'grabbing';
        element.style.userSelect = 'none';
      }
    };

    const dragEnd = () => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      element.style.cursor = 'pointer';
      element.style.userSelect = '';

      // Save position to localStorage
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          x: currentX,
          y: currentY
        }));
      } catch (error) {
        console.warn('[OnDemandAutofill] Failed to save position:', error);
      }
    };

    const drag = (e: MouseEvent | TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        
        if (e.type === "touchmove") {
          const touch = (e as TouchEvent).touches[0];
          currentX = touch.clientX - initialX;
          currentY = touch.clientY - initialY;
        } else {
          currentX = (e as MouseEvent).clientX - initialX;
          currentY = (e as MouseEvent).clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        // Constrain to viewport
        const rect = element.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));

        element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
    };

    // Load saved position
    try {
      const savedPosition = localStorage.getItem(storageKey);
      if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        currentX = x;
        currentY = y;
        xOffset = x;
        yOffset = y;
        element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    } catch (error) {
      console.warn('[OnDemandAutofill] Failed to load saved position:', error);
    }

    // Add event listeners
    element.addEventListener('mousedown', dragStart);
    element.addEventListener('touchstart', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);

    // Add visual feedback for draggable element
    element.style.cursor = 'pointer';
    element.title = 'Click to autofill • Drag to move';
  }
}

// Initialize on-demand autofill with button creation disabled (unified manager handles buttons)
const onDemandAutofill = new OnDemandAutofill({ 
  enableButtonCreation: false,
  enableFormDetection: false 
});

// Export for debugging and AI integration access
(globalThis as any).onDemandAutofill = onDemandAutofill;
(window as any).onDemandAutofill = onDemandAutofill;
