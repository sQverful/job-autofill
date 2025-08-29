/**
 * Enhanced Autofill Content Script
 * Improved form detection and autofill based on form samples analysis
 */

import { profileStorage } from '@extension/storage';
import type { 
  UserProfile, 
  DetectedForm, 
  FormField, 
  AutofillResult,
  JobPlatform,
  FieldType 
} from '@extension/shared';

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

/**
 * Enhanced autofill handler with improved form detection
 */
export class EnhancedAutofill {
  private isProcessing = false;
  private profile: UserProfile | null = null;
  private detectedForms: DetectedForm[] = [];
  private formIndicators: HTMLElement[] = [];

  constructor() {
    this.setupMessageHandlers();
    this.loadProfile();
    this.initializeFormDetection();
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
              error: error.message || 'Unknown error occurred'
            });
          });
        return true;
      }

      if (message.type === 'form:analyze') {
        this.analyzeCurrentPage()
          .then(sendResponse)
          .catch(error => {
            console.error('Form analysis failed:', error);
            sendResponse({
              success: false,
              error: error.message || 'Analysis failed'
            });
          });
        return true;
      }
      
      return false;
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
  private async handleAutofillTrigger(message: AutofillTriggerMessage): Promise<AutofillResult> {
    if (this.isProcessing) {
      throw new Error('Autofill already in progress');
    }

    if (!this.profile) {
      throw new Error('Profile not loaded. Please set up your profile first.');
    }

    this.isProcessing = true;

    try {
      console.log('Starting enhanced autofill...');

      const analysis = await this.analyzeCurrentPage();
      if (!analysis.success || analysis.forms.length === 0) {
        throw new Error('No fillable forms detected on this page');
      }

      const targetForm = this.selectBestForm(analysis.forms);
      if (!targetForm) {
        throw new Error('No suitable form found for autofill');
      }

      console.log(`Filling form on ${analysis.platform} platform with ${targetForm.fields.length} fields`);

      const result = await this.performAutofill(targetForm);

      this.sendNotification({
        type: 'autofill:complete',
        data: {
          success: true,
          filledCount: result.filledCount,
          totalFields: result.totalFields,
          platform: analysis.platform,
          duration: result.duration,
          skippedCount: result.skippedFields.length,
          errorCount: result.errors.length
        }
      });

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
        confidence
      };

    } catch (error) {
      return {
        success: false,
        platform: 'custom',
        forms: [],
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Detect platform based on URL and page content
   */
  private detectPlatform(): JobPlatform {
    const hostname = window.location.hostname.toLowerCase();
    const url = window.location.href.toLowerCase();

    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (hostname.includes('workday') || hostname.includes('myworkdayjobs.com')) return 'workday';

    return 'custom';
  }

  /**
   * Enhanced form detection based on form samples analysis
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

    // Method 2: Modern SPA forms without form tags
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
        'main',
        '.content',
        '#main-content'
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
   * Analyze a form element
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
        totalSteps: this.getTotalSteps(formElement)
      };

    } catch (error) {
      console.error('Error analyzing form:', error);
      return null;
    }
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
        totalSteps: this.getTotalStepsFromContainer(container)
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
        return null;
      }

      const confidence = this.calculateFormConfidence(fields, platform) * 0.7;

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
        totalSteps: undefined
      };

    } catch (error) {
      console.error('Error analyzing page as form:', error);
      return null;
    }
  }

  /**
   * Extract fields from any container element with enhanced patterns
   */
  private extractFieldsFromContainer(container: HTMLElement): FormField[] {
    const fields: FormField[] = [];
    
    // Enhanced selectors based on form samples analysis
    const selectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"])',
      'textarea',
      'select',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[role="combobox"]'
    ];
    
    const inputs = container.querySelectorAll(selectors.join(', '));

    for (let i = 0; i < inputs.length; i++) {
      const element = inputs[i] as HTMLElement;
      
      if (this.shouldSkipField(element)) {
        continue;
      }

      const field = this.analyzeFormField(element, i);
      if (field) {
        fields.push(field);
      }
    }

    return fields;
  }

  /**
   * Extract fields from form element
   */
  private extractFormFields(formElement: HTMLFormElement): FormField[] {
    return this.extractFieldsFromContainer(formElement);
  }

  /**
   * Check if field should be skipped
   */
  private shouldSkipField(element: HTMLElement): boolean {
    const inputElement = element as HTMLInputElement;
    
    if (inputElement.type === 'hidden' || inputElement.type === 'submit' || inputElement.type === 'button') {
      return true;
    }

    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return true;
    }

    if (element.hasAttribute('disabled') || element.hasAttribute('readonly')) {
      return true;
    }

    const name = element.getAttribute('name')?.toLowerCase() || '';
    if (name.includes('csrf') || name.includes('token') || name.includes('_method')) {
      return true;
    }

    return false;
  }

  /**
   * Analyze individual form field with enhanced mapping
   */
  private analyzeFormField(element: HTMLElement, index: number): FormField | null {
    try {
      const type = this.getFieldType(element);
      const label = this.getFieldLabel(element);
      const selector = this.generateFieldSelector(element, index);

      if (!type || !selector) {
        return null;
      }

      return {
        id: `field_${index}`,
        type,
        label,
        selector,
        required: element.hasAttribute('required'),
        placeholder: element.getAttribute('placeholder') || undefined,
        options: this.getFieldOptions(element),
        mappedProfileField: this.mapToProfileField(element, label, type),
        validationRules: this.extractValidationRules(element)
      };

    } catch (error) {
      console.error('Error analyzing field:', error);
      return null;
    }
  }

  /**
   * Enhanced field type detection
   */
  private getFieldType(element: HTMLElement): FieldType | null {
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

    return null;
  }

  /**
   * Enhanced field label detection
   */
  private getFieldLabel(element: HTMLElement): string {
    // Try to find associated label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return this.cleanLabelText(label.textContent || '');
      }
    }

    // Try parent label
    const parentLabel = element.closest('label');
    if (parentLabel) {
      return this.cleanLabelText(parentLabel.textContent || '');
    }

    // Try aria-label and aria-labelledby
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return this.cleanLabelText(ariaLabel);
    }

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement) {
        return this.cleanLabelText(labelElement.textContent || '');
      }
    }

    // Try sibling elements
    const siblings = [element.previousElementSibling, element.nextElementSibling];
    for (const sibling of siblings) {
      if (sibling && this.isLabelLikeElement(sibling)) {
        const text = this.cleanLabelText(sibling.textContent || '');
        if (text.length > 0 && text.length < 100) {
          return text;
        }
      }
    }

    // Try placeholder as fallback
    const placeholder = element.getAttribute('placeholder');
    if (placeholder) {
      return this.cleanLabelText(placeholder);
    }

    // Try name attribute
    const name = element.getAttribute('name');
    if (name) {
      return name.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return 'Unknown Field';
  }

  /**
   * Clean and normalize label text
   */
  private cleanLabelText(text: string): string {
    return text
      .trim()
      .replace(/[*:]+$/, '') // Remove trailing asterisks and colons
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Check if an element looks like a label
   */
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

  /**
   * Enhanced field mapping based on form samples analysis
   */
  private mapToProfileField(element: HTMLElement, label: string, type: FieldType): string | undefined {
    const labelLower = label.toLowerCase();
    const name = element.getAttribute('name')?.toLowerCase() || '';
    const id = element.getAttribute('id')?.toLowerCase() || '';
    const placeholder = element.getAttribute('placeholder')?.toLowerCase() || '';
    const ariaLabel = element.getAttribute('aria-label')?.toLowerCase() || '';
    
    // Combine all text sources for better matching
    const allText = `${labelLower} ${name} ${id} ${placeholder} ${ariaLabel}`.toLowerCase();

    // Enhanced personal info mappings
    if (this.matchesPattern(allText, ['first.?name', 'given.?name', 'fname', 'firstname', 'name_first', 'applicant.?first'])) {
      return 'personalInfo.firstName';
    }
    if (this.matchesPattern(allText, ['last.?name', 'family.?name', 'surname', 'lastname', 'lname', 'name_last', 'applicant.?last'])) {
      return 'personalInfo.lastName';
    }
    if (this.matchesPattern(allText, ['full.?name', '^name$', 'applicant.?name', 'candidate.?name', 'your.?name']) && !allText.includes('first') && !allText.includes('last')) {
      return 'personalInfo.firstName'; // User can enter full name in first name field
    }
    if (this.matchesPattern(allText, ['email', 'e-?mail', 'mail', 'contact.?email', 'email.?address', 'applicant.?email'])) {
      return 'personalInfo.email';
    }
    if (this.matchesPattern(allText, ['phone', 'mobile', 'telephone', 'tel', 'contact.?number', 'cell', 'phone.?number'])) {
      return 'personalInfo.phone';
    }

    // Address mappings
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

    // Professional URLs
    if (this.matchesPattern(allText, ['linkedin', 'linked.?in', 'li.?profile'])) {
      return 'personalInfo.linkedInUrl';
    }
    if (this.matchesPattern(allText, ['portfolio', 'website', 'personal.?site', 'web.?site'])) {
      return 'personalInfo.portfolioUrl';
    }
    if (this.matchesPattern(allText, ['github', 'git.?hub', 'gh.?profile'])) {
      return 'personalInfo.githubUrl';
    }

    // Job preferences
    if (this.matchesPattern(allText, ['salary', 'compensation', 'expected.?salary', 'desired.?salary', 'salary.?expectation', 'pay.?rate'])) {
      return 'preferences.jobPreferences.desiredSalaryMin';
    }
    if (this.matchesPattern(allText, ['start.?date', 'available', 'availability', 'join.?date', 'available.?start'])) {
      return 'preferences.jobPreferences.availableStartDate';
    }
    if (this.matchesPattern(allText, ['work.?authorization', 'visa', 'sponsorship', 'eligible.?to.?work', 'authorized.?to.?work', 'employment.?authorization'])) {
      return 'preferences.jobPreferences.workAuthorization';
    }
    if (this.matchesPattern(allText, ['relocat', 'willing.?to.?move', 'move.?for.?job', 'relocation'])) {
      return 'preferences.jobPreferences.willingToRelocate';
    }

    // Cover letter and summary fields
    if (this.matchesPattern(allText, ['cover.?letter', 'motivation', 'why.?interested', 'message', 'additional.?info', 'comments'])) {
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
   * Generate CSS selector for field
   */
  private generateFieldSelector(element: HTMLElement, index: number): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const name = element.getAttribute('name');
    if (name) {
      return `[name="${name}"]`;
    }

    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) {
      return `[data-testid="${dataTestId}"]`;
    }

    const tagName = element.tagName.toLowerCase();
    return `${tagName}:nth-of-type(${index + 1})`;
  }

  /**
   * Get options for select/radio fields
   */
  private getFieldOptions(element: HTMLElement): string[] | undefined {
    if (element.tagName.toLowerCase() === 'select') {
      const options = (element as HTMLSelectElement).querySelectorAll('option');
      return Array.from(options).map(option => option.textContent?.trim() || '').filter(Boolean);
    }
    return undefined;
  }

  /**
   * Extract validation rules from element
   */
  private extractValidationRules(element: HTMLElement): any[] {
    const rules: any[] = [];

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

    return rules;
  }

  /**
   * Check if form is a job application form
   */
  private isJobApplicationForm(form: DetectedForm): boolean {
    const url = window.location.href.toLowerCase();
    const urlIndicators = ['apply', 'application', 'job', 'career', 'position', 'hiring'];
    const hasJobUrl = urlIndicators.some(indicator => url.includes(indicator));

    const pageText = document.body.textContent?.toLowerCase() || '';
    const jobKeywords = ['apply now', 'submit application', 'job application', 'position', 'career opportunity'];
    const hasJobContent = jobKeywords.some(keyword => pageText.includes(keyword));

    const hasPersonalFields = form.fields.some(field => 
      field.mappedProfileField?.startsWith('personalInfo')
    );

    const hasJobRelatedFields = form.fields.some(field => {
      const label = field.label.toLowerCase();
      return label.includes('resume') || 
             label.includes('cv') ||
             label.includes('cover letter') || 
             label.includes('experience') || 
             label.includes('salary') ||
             label.includes('available') ||
             label.includes('start date') ||
             label.includes('work authorization') ||
             label.includes('sponsorship') ||
             label.includes('relocate');
    });

    const hasFileUpload = form.fields.some(field => field.type === 'file');
    const hasTextArea = form.fields.some(field => field.type === 'textarea');

    let score = 0;
    if (hasJobUrl) score += 3;
    if (hasJobContent) score += 2;
    if (hasPersonalFields) score += 3;
    if (hasJobRelatedFields) score += 4;
    if (hasFileUpload) score += 2;
    if (hasTextArea) score += 1;
    if (form.fields.length >= 5) score += 2;

    if (form.platform !== 'custom') {
      score += 2;
    }

    return score >= 4;
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
        const element = document.querySelector(field.selector) as HTMLElement;
        
        if (!element) {
          skippedFields.push({
            fieldId: field.id,
            selector: field.selector,
            reason: 'field_not_found',
            message: 'Field element not found in DOM'
          });
          continue;
        }

        const value = this.getFieldValue(field, this.profile);
        
        if (value === null || value === undefined || value === '') {
          skippedFields.push({
            fieldId: field.id,
            selector: field.selector,
            reason: 'no_mapping',
            message: 'No profile data available for this field'
          });
          continue;
        }

        const success = await this.fillFieldElement(element, field, value);
        
        if (success) {
          filledFields.push({
            fieldId: field.id,
            selector: field.selector,
            value: value,
            source: field.mappedProfileField ? 'profile' : 'default_answer'
          });
        } else {
          errors.push({
            fieldId: field.id,
            selector: field.selector,
            code: 'fill_failed',
            message: 'Failed to fill field with value',
            recoverable: true
          });
        }

      } catch (error) {
        errors.push({
          fieldId: field.id,
          selector: field.selector,
          code: 'unexpected_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          recoverable: false
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
      duration
    };
  }

  /**
   * Get field value from profile
   */
  private getFieldValue(field: FormField, profile: UserProfile): string | null {
    if (!field.mappedProfileField) {
      // Try to get from default answers
      const defaultAnswer = profile.preferences.defaultAnswers[field.label.toLowerCase()];
      if (defaultAnswer) {
        return defaultAnswer;
      }
      return null;
    }

    const fieldPath = field.mappedProfileField.split('.');
    let value: any = profile;

    for (const part of fieldPath) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    // Handle different value types
    if (typeof value === 'string') {
      return value;
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    } else if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    } else if (Array.isArray(value)) {
      return value.join(', ');
    }

    return null;
  }

  /**
   * Fill individual field element
   */
  private async fillFieldElement(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      if (field.type === 'file') {
        await this.handleFileUpload(element as HTMLInputElement, field);
        return true;
      }

      if (element.tagName.toLowerCase() === 'select') {
        await this.handleSelectField(element as HTMLSelectElement, value);
        return true;
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
      element.value = '';
      element.value = value;
      this.triggerEvents(element);
      return true;
    } catch (error) {
      console.error('Error filling text element:', error);
      return false;
    }
  }

  /**
   * Handle checkbox and radio inputs
   */
  private handleCheckboxRadio(element: HTMLInputElement, value: string): boolean {
    try {
      const lowerValue = value.toLowerCase();
      const shouldCheck = lowerValue === 'yes' || lowerValue === 'true' || lowerValue === '1';
      
      if (element.type === 'checkbox') {
        element.checked = shouldCheck;
      } else if (element.type === 'radio') {
        const optionText = element.nextElementSibling?.textContent?.toLowerCase() || '';
        const labelText = element.closest('label')?.textContent?.toLowerCase() || '';
        
        if (optionText.includes(lowerValue) || labelText.includes(lowerValue)) {
          element.checked = true;
        }
      }
      
      this.triggerEvents(element);
      return true;
    } catch (error) {
      console.error('Error handling checkbox/radio:', error);
      return false;
    }
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

      const mappedField = field.mappedProfileField;
      if (mappedField === 'documents.resumes' && this.profile.documents.resumes.length > 0) {
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

      this.showFileUploadNotification(element, fileData);

    } catch (error) {
      console.error('Error handling file upload:', error);
    }
  }

  /**
   * Handle select field with smart matching
   */
  private async handleSelectField(element: HTMLSelectElement, value: string): Promise<void> {
    const options = Array.from(element.options);
    
    let matchedOption = options.find(option => 
      option.value.toLowerCase() === value.toLowerCase() ||
      option.textContent?.toLowerCase() === value.toLowerCase()
    );

    if (!matchedOption) {
      matchedOption = options.find(option => 
        option.textContent?.toLowerCase().includes(value.toLowerCase()) ||
        value.toLowerCase().includes(option.textContent?.toLowerCase() || '')
      );
    }

    if (!matchedOption && value.toLowerCase().includes('citizen')) {
      matchedOption = options.find(option => 
        option.textContent?.toLowerCase().includes('citizen') ||
        option.textContent?.toLowerCase().includes('authorized') ||
        option.textContent?.toLowerCase().includes('yes')
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

    const rect = element.getBoundingClientRect();
    notification.style.top = `${rect.bottom + window.scrollY + 5}px`;
    notification.style.left = `${rect.left + window.scrollX}px`;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);

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
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.detectAndIndicateForms());
    } else {
      this.detectAndIndicateForms();
    }

    const observer = new MutationObserver(() => {
      this.debounce(() => this.detectAndIndicateForms(), 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Debounce utility function
   */
  private debounce(func: Function, wait: number): void {
    clearTimeout((this as any).debounceTimer);
    (this as any).debounceTimer = setTimeout(func, wait);
  }

  /**
   * Detect forms and show visual indicators
   */
  private async detectAndIndicateForms(): Promise<void> {
    try {
      this.clearFormIndicators();

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
    this.formIndicators.forEach(indicator => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    });
    this.formIndicators = [];
  }

  /**
   * Show visual indicators for detected forms
   */
  private showFormIndicators(analysis: FormAnalysisResult): void {
    const bestForm = this.selectBestForm(analysis.forms);
    if (!bestForm) return;

    const indicator = this.createAutofillIndicator(analysis.platform, bestForm);
    document.body.appendChild(indicator);
    this.formIndicators.push(indicator);

    bestForm.fields.forEach(field => {
      if (field.mappedProfileField) {
        const fieldElement = document.querySelector(field.selector);
        if (fieldElement) {
          const fieldIndicator = this.createFieldIndicator(field);
          fieldElement.parentNode?.insertBefore(fieldIndicator, fieldElement.nextSibling);
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
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; animation: pulse 2s infinite;"></div>
        <div>
          <div style="font-weight: 600;">Autofill Available</div>
          <div style="font-size: 11px; opacity: 0.9;">${mappedFields} fields ready • ${platform}</div>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    indicator.addEventListener('click', async () => {
      try {
        indicator.style.opacity = '0.7';
        indicator.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 12px; height: 12px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div>Filling form...</div>
          </div>
        `;

        const spinStyle = document.createElement('style');
        spinStyle.textContent = `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(spinStyle);

        await this.handleAutofillTrigger({
          type: 'autofill:trigger',
          source: 'popup',
          data: { tabId: 0 }
        });

      } catch (error) {
        console.error('Autofill failed:', error);
        indicator.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div>❌ Autofill failed</div>
          </div>
        `;
      }
    });

    indicator.addEventListener('mouseenter', () => {
      indicator.style.transform = 'scale(1.05)';
      indicator.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
    });

    indicator.addEventListener('mouseleave', () => {
      indicator.style.transform = 'scale(1)';
      indicator.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    });

    return indicator;
  }

  /**
   * Create field-level indicator
   */
  private createFieldIndicator(field: FormField): HTMLElement {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      display: inline-block;
      background: #4CAF50;
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 500;
      margin-left: 8px;
      vertical-align: middle;
      opacity: 0.8;
    `;
    indicator.textContent = '✓ Auto-fillable';
    indicator.title = `This field will be filled from your profile: ${field.mappedProfileField}`;

    return indicator;
  }

  /**
   * Show autofill completion feedback
   */
  private showAutofillFeedback(result: AutofillResult, platform: string): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${result.success ? '#4CAF50' : '#FF9800'};
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

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

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

  // Helper methods for form analysis
  private calculateFormConfidence(fields: FormField[], platform: JobPlatform): number {
    let score = 0;
    score += Math.min(fields.length * 0.1, 0.5);
    const mappedFields = fields.filter(f => f.mappedProfileField);
    score += mappedFields.length * 0.1;
    if (platform !== 'custom') score += 0.2;
    const jobFields = fields.filter(f => {
      const label = f.label.toLowerCase();
      return label.includes('resume') || label.includes('experience') || label.includes('salary');
    });
    score += jobFields.length * 0.1;
    return Math.min(score, 1.0);
  }

  private calculateConfidence(platform: JobPlatform, forms: DetectedForm[]): number {
    if (forms.length === 0) return 0;
    const avgConfidence = forms.reduce((sum, form) => sum + form.confidence, 0) / forms.length;
    return avgConfidence;
  }

  private getSupportedFeatures(fields: FormField[], platform: JobPlatform): any[] {
    const features = ['basic_info'];
    if (fields.some(f => f.type === 'file')) features.push('file_upload');
    if (fields.some(f => f.type === 'textarea')) features.push('ai_content');
    return features;
  }

  private isMultiStepForm(formElement: HTMLFormElement): boolean {
    const stepIndicators = formElement.querySelectorAll('.step, [data-step], .wizard-step');
    return stepIndicators.length > 1;
  }

  private isMultiStepContainer(container: HTMLElement): boolean {
    const stepSelectors = ['.step', '.wizard-step', '[data-step]', '.progress-step'];
    for (const selector of stepSelectors) {
      if (container.querySelectorAll(selector).length > 1) return true;
    }
    return false;
  }

  private isMultiStepPage(): boolean {
    const stepIndicators = document.querySelectorAll('.step, [data-step], .wizard-step, .progress-step');
    return stepIndicators.length > 1;
  }

  private getCurrentStep(formElement: HTMLFormElement): number | undefined {
    const activeStep = formElement.querySelector('.step.active, [data-step].active, .wizard-step.active');
    if (activeStep) {
      const stepAttr = activeStep.getAttribute('data-step');
      if (stepAttr) return parseInt(stepAttr);
    }
    return undefined;
  }

  private getCurrentStepFromContainer(container: HTMLElement): number | undefined {
    const activeSelectors = ['.step.active', '.wizard-step.active', '[data-step].active'];
    for (const selector of activeSelectors) {
      const activeStep = container.querySelector(selector);
      if (activeStep) {
        const stepAttr = activeStep.getAttribute('data-step');
        if (stepAttr) return parseInt(stepAttr);
      }
    }
    return undefined;
  }

  private getTotalSteps(formElement: HTMLFormElement): number | undefined {
    const steps = formElement.querySelectorAll('.step, [data-step], .wizard-step');
    return steps.length > 1 ? steps.length : undefined;
  }

  private getTotalStepsFromContainer(container: HTMLElement): number | undefined {
    const stepSelectors = ['.step', '.wizard-step', '[data-step]', '.progress-step'];
    for (const selector of stepSelectors) {
      const steps = container.querySelectorAll(selector);
      if (steps.length > 1) return steps.length;
    }
    return undefined;
  }

  private generateFormId(formElement: HTMLFormElement): string {
    if (formElement.id) return formElement.id;
    const name = formElement.getAttribute('name');
    if (name) return name;
    return `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateContainerId(container: HTMLElement): string {
    if (container.id) return `container_${container.id}`;
    const className = container.className.split(' ')[0];
    if (className) return `container_${className}`;
    return `container_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private selectBestForm(forms: DetectedForm[]): DetectedForm | null {
    if (forms.length === 0) return null;
    if (forms.length === 1) return forms[0];
    return forms.sort((a, b) => {
      const scoreA = a.confidence + (a.fields.length * 0.01);
      const scoreB = b.confidence + (b.fields.length * 0.01);
      return scoreB - scoreA;
    })[0];
  }
}

// Initialize enhanced autofill
const enhancedAutofill = new EnhancedAutofill();

// Export for debugging
(globalThis as any).enhancedAutofill = enhancedAutofill;