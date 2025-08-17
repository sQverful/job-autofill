/**
 * Workday-specific form detection module
 * Handles Workday career portal forms and multi-step application processes
 */

import type {
  DetectedForm,
  FormField,
  FormDetectionResult,
  JobContext,
  AutofillFeature
} from '@extension/shared/lib/types/form-detection';
import { BaseFormDetector } from '../base-detector';
import { ConfidenceScorer } from '../confidence-scorer';

export interface WorkdayFormSelectors {
  applicationForm: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  formContainer: string;
  textFields: string;
  dropdowns: string;
  checkboxes: string;
  radioButtons: string;
  fileUpload: string;
  textAreas: string;
  submitButton: string;
  nextButton: string;
  stepIndicator: string;
  progressBar: string;
  applyButton: string;
}

export const WORKDAY_SELECTORS: WorkdayFormSelectors = {
  applicationForm: '[data-automation-id*="applicationForm"], .css-application-form, [data-uxi-element-id*="applicationForm"]',
  jobTitle: '[data-automation-id*="jobTitle"], [data-automation-id*="jobPostingTitle"], h1[data-automation-id]',
  companyName: '[data-automation-id*="company"], [data-automation-id*="organization"]',
  jobDescription: '[data-automation-id*="jobDescription"], [data-automation-id*="jobPosting"]',
  formContainer: '[data-automation-id*="formContainer"], .css-form-container, [data-uxi-element-id*="form"]',
  textFields: 'input[type="text"], input[type="email"], input[type="tel"], input[data-automation-id]',
  dropdowns: 'select, [data-automation-id*="dropdown"], [data-automation-id*="select"]',
  checkboxes: 'input[type="checkbox"], [data-automation-id*="checkbox"]',
  radioButtons: 'input[type="radio"], [data-automation-id*="radio"]',
  fileUpload: 'input[type="file"], [data-automation-id*="fileUpload"], [data-automation-id*="attachment"]',
  textAreas: 'textarea, [data-automation-id*="textArea"]',
  submitButton: '[data-automation-id*="submitApplication"], [data-automation-id*="submit"], button[type="submit"]',
  nextButton: '[data-automation-id*="next"], [data-automation-id*="continue"]',
  stepIndicator: '[data-automation-id*="step"], [data-automation-id*="progress"]',
  progressBar: '.css-progress, [data-automation-id*="progressBar"]',
  applyButton: '[data-automation-id*="apply"], .css-apply-button'
};

/**
 * Workday-specific form detector
 */
export class WorkdayFormDetector extends BaseFormDetector {
  private confidenceScorer: ConfidenceScorer;

  constructor() {
    super({
      minConfidenceThreshold: 0.7,
      maxFormsPerPage: 5, // Workday often has multiple form sections
      enableJobContextExtraction: true,
      fieldDetectionTimeout: 7000 // Workday forms can be slow to load
    });
    this.confidenceScorer = new ConfidenceScorer();
  }

  /**
   * Detect Workday application forms
   */
  async detectWorkdayForms(document: Document = window.document): Promise<FormDetectionResult> {
    try {
      const forms: DetectedForm[] = [];
      
      // Check if we're on a Workday career portal
      if (!this.isWorkdayCareerPortal(document)) {
        return {
          success: true,
          forms: [],
          errors: []
        };
      }

      // Look for Workday application forms
      const applicationForms = document.querySelectorAll(WORKDAY_SELECTORS.applicationForm);
      
      for (const formElement of applicationForms) {
        const detectedForm = await this.analyzeWorkdayForm(formElement as HTMLElement, document);
        if (detectedForm) {
          forms.push(detectedForm);
        }
      }

      // If no specific application forms found, look for form containers
      if (forms.length === 0) {
        const formContainers = document.querySelectorAll(WORKDAY_SELECTORS.formContainer);
        for (const container of formContainers) {
          const detectedForm = await this.analyzeWorkdayForm(container as HTMLElement, document);
          if (detectedForm) {
            forms.push(detectedForm);
          }
        }
      }

      // Check for apply buttons that might trigger forms
      const applyButton = document.querySelector(WORKDAY_SELECTORS.applyButton);
      if (applyButton && forms.length === 0) {
        const buttonForm = await this.createWorkdayApplyButtonForm(applyButton as HTMLElement, document);
        if (buttonForm) {
          forms.push(buttonForm);
        }
      }

      return {
        success: true,
        forms,
        errors: [],
        platformSpecificData: {
          isWorkdayPortal: true,
          hasMultiStepProcess: this.hasWorkdayMultiStepProcess(document),
          currentStep: this.getWorkdayGlobalCurrentStep(document),
          totalSteps: this.getWorkdayGlobalTotalSteps(document),
          portalType: this.getWorkdayPortalType(document)
        }
      };
    } catch (error) {
      return {
        success: false,
        forms: [],
        errors: [{
          code: 'WORKDAY_DETECTION_ERROR',
          message: `Workday form detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Check if current page is a Workday career portal
   */
  private isWorkdayCareerPortal(document: Document): boolean {
    const url = document.location.href.toLowerCase();
    const hostname = document.location.hostname.toLowerCase();
    
    // Check for Workday-specific indicators
    const workdayIndicators = [
      url.includes('workday'),
      url.includes('wd1.myworkdaysite.com'),
      url.includes('wd5.myworkdaysite.com'),
      hostname.includes('myworkdaysite.com'),
      document.querySelector('[data-automation-id]') !== null,
      document.querySelector('.css-application-form') !== null,
      document.body.className.includes('wd-'),
      document.title.toLowerCase().includes('workday')
    ];

    return workdayIndicators.some(indicator => indicator);
  }

  /**
   * Analyze a Workday form element
   */
  private async analyzeWorkdayForm(formElement: HTMLElement, document: Document): Promise<DetectedForm | null> {
    const fields = this.detectWorkdayFields(formElement);
    
    if (fields.length === 0) {
      return null;
    }

    const formId = `workday_form_${Date.now()}`;
    const confidence = this.confidenceScorer.calculateConfidence(formElement, fields, 'workday', document);
    const supportedFeatures = this.getWorkdaySupportedFeatures(fields);
    const jobContext = this.extractWorkdayJobContext(document);
    const isMultiStep = this.isWorkdayMultiStep(formElement);

    return {
      platform: 'workday',
      formId,
      url: document.location.href,
      fields,
      jobContext,
      confidence,
      supportedFeatures,
      detectedAt: new Date(),
      isMultiStep,
      currentStep: isMultiStep ? this.getWorkdayCurrentStep(formElement, document) : undefined,
      totalSteps: isMultiStep ? this.getWorkdayTotalSteps(formElement, document) : undefined
    };
  }

  /**
   * Detect form fields specific to Workday
   */
  private detectWorkdayFields(formElement: HTMLElement): FormField[] {
    const fields: FormField[] = [];

    try {
      // Text inputs
      const textInputs = formElement.querySelectorAll(WORKDAY_SELECTORS.textFields);
      textInputs.forEach((input, index) => {
        const field = this.createWorkdayField(input as HTMLElement, 'text', index);
        if (field) fields.push(field);
      });

      // Text areas
      const textAreas = formElement.querySelectorAll(WORKDAY_SELECTORS.textAreas);
      textAreas.forEach((textarea, index) => {
        const field = this.createWorkdayField(textarea as HTMLElement, 'textarea', index + 1000);
        if (field) fields.push(field);
      });

      // Dropdowns (Workday uses many dropdowns)
      const dropdowns = formElement.querySelectorAll(WORKDAY_SELECTORS.dropdowns);
      dropdowns.forEach((select, index) => {
        const field = this.createWorkdayField(select as HTMLElement, 'select', index + 2000);
        if (field) fields.push(field);
      });

      // File uploads
      const fileInputs = formElement.querySelectorAll(WORKDAY_SELECTORS.fileUpload);
      fileInputs.forEach((input, index) => {
        const field = this.createWorkdayField(input as HTMLElement, 'file', index + 3000);
        if (field) fields.push(field);
      });

      // Checkboxes
      const checkboxes = formElement.querySelectorAll(WORKDAY_SELECTORS.checkboxes);
      checkboxes.forEach((input, index) => {
        const field = this.createWorkdayField(input as HTMLElement, 'checkbox', index + 4000);
        if (field) fields.push(field);
      });

      // Radio buttons
      const radioButtons = formElement.querySelectorAll(WORKDAY_SELECTORS.radioButtons);
      radioButtons.forEach((input, index) => {
        const field = this.createWorkdayField(input as HTMLElement, 'radio', index + 5000);
        if (field) fields.push(field);
      });

    } catch (error) {
      console.warn('Error detecting Workday fields:', error);
    }

    return fields;
  }

  /**
   * Create a Workday-specific form field
   */
  private createWorkdayField(element: HTMLElement, fieldType: string, index: number): FormField | null {
    const input = element as HTMLInputElement;
    const tagName = element.tagName.toLowerCase();
    const type = input.type?.toLowerCase() || tagName;
    
    // Skip hidden fields and buttons
    if (type === 'hidden' || type === 'submit' || type === 'button') {
      return null;
    }

    const id = element.id || `workday_field_${index}`;
    const label = this.extractWorkdayFieldLabel(element);
    const selector = this.generateWorkdaySelector(element);
    const required = this.isWorkdayFieldRequired(element);
    const placeholder = input.placeholder;

    const mappedFieldType = this.mapWorkdayFieldType(type, element);
    const mappedProfileField = this.mapWorkdayProfileField(label, mappedFieldType, placeholder);
    const options = this.extractWorkdayFieldOptions(element);

    return {
      id,
      type: mappedFieldType,
      label,
      selector,
      required,
      placeholder,
      options,
      mappedProfileField,
      validationRules: this.extractWorkdayValidationRules(element)
    };
  }

  /**
   * Extract field label for Workday forms
   */
  private extractWorkdayFieldLabel(element: HTMLElement): string {
    // Workday-specific label selectors
    const workdayLabelSelectors = [
      '[data-automation-id*="label"]',
      '.css-field-label',
      '[data-uxi-element-id*="label"]'
    ];

    // Try Workday-specific selectors first
    for (const selector of workdayLabelSelectors) {
      const label = element.closest('[data-automation-id], .css-field')?.querySelector(selector);
      if (label?.textContent?.trim()) {
        return label.textContent.trim();
      }
    }

    // Check for data-automation-id on the element itself
    const automationId = element.getAttribute('data-automation-id');
    if (automationId) {
      // Convert automation ID to readable label
      const readableLabel = automationId
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
      if (readableLabel && readableLabel !== automationId) {
        return readableLabel;
      }
    }

    // Standard label detection
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label?.textContent) {
        return label.textContent.trim();
      }
    }

    // Look for parent label
    const parentLabel = element.closest('label');
    if (parentLabel?.textContent) {
      return parentLabel.textContent.replace((element as HTMLInputElement).value || '', '').trim();
    }

    // Check for aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    // Use placeholder or name as fallback
    const placeholder = (element as HTMLInputElement).placeholder;
    const name = (element as HTMLInputElement).name;
    
    return placeholder || name || 'Workday Field';
  }

  /**
   * Generate Workday-specific selector
   */
  private generateWorkdaySelector(element: HTMLElement): string {
    // Workday heavily uses data-automation-id
    const automationId = element.getAttribute('data-automation-id');
    if (automationId) {
      return `[data-automation-id="${automationId}"]`;
    }

    if (element.id) {
      return `#${element.id}`;
    }

    const uxiElementId = element.getAttribute('data-uxi-element-id');
    if (uxiElementId) {
      return `[data-uxi-element-id="${uxiElementId}"]`;
    }

    if ((element as HTMLInputElement).name) {
      return `[name="${(element as HTMLInputElement).name}"]`;
    }

    // Generate selector based on Workday form structure
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const type = (element as HTMLInputElement).type ? `[type="${(element as HTMLInputElement).type}"]` : '';
    
    return `${tagName}${className}${type}`;
  }

  /**
   * Check if Workday field is required
   */
  private isWorkdayFieldRequired(element: HTMLElement): boolean {
    const input = element as HTMLInputElement;
    
    // Standard required attribute
    if (input.required || input.getAttribute('aria-required') === 'true') {
      return true;
    }

    // Workday-specific required indicators
    const automationId = element.getAttribute('data-automation-id');
    if (automationId && automationId.includes('required')) {
      return true;
    }

    // Check for required class or data attribute
    if (element.classList.contains('required') || element.getAttribute('data-required') === 'true') {
      return true;
    }

    // Check for asterisk in label
    const label = this.extractWorkdayFieldLabel(element);
    return label.includes('*') || label.includes('required');
  }

  /**
   * Map Workday field types
   */
  private mapWorkdayFieldType(htmlType: string, element: HTMLElement): any {
    const typeMap: Record<string, any> = {
      'text': 'text',
      'email': 'email',
      'tel': 'phone',
      'phone': 'phone',
      'textarea': 'textarea',
      'select': 'select',
      'select-one': 'select',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'file': 'file',
      'date': 'date',
      'number': 'number',
      'url': 'url'
    };

    // Workday-specific field type detection
    const automationId = element.getAttribute('data-automation-id') || '';
    if (automationId.includes('dropdown') || automationId.includes('select')) {
      return 'select';
    }
    if (automationId.includes('textArea')) {
      return 'textarea';
    }
    if (automationId.includes('fileUpload') || automationId.includes('attachment')) {
      return 'file';
    }

    return typeMap[htmlType] || 'text';
  }

  /**
   * Map Workday fields to profile data
   */
  private mapWorkdayProfileField(label: string, type: any, placeholder?: string): string | undefined {
    const text = `${label} ${placeholder || ''}`.toLowerCase();
    
    // Personal information mappings
    if (text.includes('first name') || text.includes('given name')) return 'personalInfo.firstName';
    if (text.includes('last name') || text.includes('family name') || text.includes('surname')) return 'personalInfo.lastName';
    if (text.includes('email') || text.includes('e-mail')) return 'personalInfo.email';
    if (text.includes('phone') || text.includes('mobile') || text.includes('telephone')) return 'personalInfo.phone';
    if (text.includes('address') || text.includes('street')) return 'personalInfo.address';
    if (text.includes('city')) return 'personalInfo.address.city';
    if (text.includes('state') || text.includes('province')) return 'personalInfo.address.state';
    if (text.includes('zip') || text.includes('postal')) return 'personalInfo.address.zipCode';
    if (text.includes('country')) return 'personalInfo.address.country';

    // Professional information
    if (text.includes('resume') || text.includes('cv')) return 'documents.resumes[0]';
    if (text.includes('cover letter')) return 'documents.coverLetters[0]';
    if (text.includes('linkedin') || text.includes('profile url')) return 'professionalInfo.linkedinUrl';
    if (text.includes('website') || text.includes('portfolio')) return 'professionalInfo.portfolioUrl';
    if (text.includes('current company') || text.includes('employer')) return 'professionalInfo.workExperience[0].company';
    if (text.includes('current title') || text.includes('job title')) return 'professionalInfo.workExperience[0].title';
    if (text.includes('university') || text.includes('school') || text.includes('education')) return 'professionalInfo.education[0].institution';
    if (text.includes('degree')) return 'professionalInfo.education[0].degree';
    if (text.includes('major') || text.includes('field of study')) return 'professionalInfo.education[0].fieldOfStudy';
    if (text.includes('graduation') || text.includes('grad date')) return 'professionalInfo.education[0].graduationDate';

    // Common Workday application questions
    if (text.includes('work authorization') || text.includes('authorized to work')) return 'preferences.defaultAnswers.workAuthorization';
    if (text.includes('sponsorship') || text.includes('visa sponsorship')) return 'preferences.defaultAnswers.sponsorship';
    if (text.includes('start date') || text.includes('available to start')) return 'preferences.defaultAnswers.startDate';
    if (text.includes('salary') || text.includes('compensation')) return 'preferences.defaultAnswers.salaryExpectation';
    if (text.includes('notice period') || text.includes('availability')) return 'preferences.defaultAnswers.noticePeriod';

    return undefined;
  }

  /**
   * Extract options for Workday select/radio fields
   */
  private extractWorkdayFieldOptions(element: HTMLElement): string[] | undefined {
    if (element.tagName.toLowerCase() === 'select') {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.map(option => option.textContent || option.value).filter(Boolean);
    }

    if ((element as HTMLInputElement).type === 'radio') {
      const name = (element as HTMLInputElement).name;
      if (name) {
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        return Array.from(radioGroup).map(radio => {
          const label = this.extractWorkdayFieldLabel(radio as HTMLElement);
          return label !== 'Workday Field' ? label : (radio as HTMLInputElement).value;
        });
      }
    }

    return undefined;
  }

  /**
   * Extract validation rules for Workday fields
   */
  private extractWorkdayValidationRules(element: HTMLElement): any[] {
    const rules: any[] = [];
    const input = element as HTMLInputElement;

    if (this.isWorkdayFieldRequired(element)) {
      rules.push({ type: 'required', message: 'This field is required' });
    }

    if (input.type === 'email') {
      rules.push({ type: 'email', message: 'Please enter a valid email address' });
    }

    if (input.minLength) {
      rules.push({ type: 'minLength', value: input.minLength, message: `Minimum length is ${input.minLength}` });
    }

    if (input.maxLength) {
      rules.push({ type: 'maxLength', value: input.maxLength, message: `Maximum length is ${input.maxLength}` });
    }

    return rules;
  }

  /**
   * Get supported features for Workday forms
   */
  private getWorkdaySupportedFeatures(fields: FormField[]): AutofillFeature[] {
    const features: AutofillFeature[] = [];

    // Check for basic info fields
    const hasBasicInfo = fields.some(f => 
      f.mappedProfileField?.startsWith('personalInfo.')
    );
    if (hasBasicInfo) features.push('basic_info');

    // Check for work experience fields
    const hasWorkExperience = fields.some(f => 
      f.mappedProfileField?.includes('workExperience')
    );
    if (hasWorkExperience) features.push('work_experience');

    // Check for education fields
    const hasEducation = fields.some(f => 
      f.mappedProfileField?.includes('education')
    );
    if (hasEducation) features.push('education');

    // Check for file upload fields
    const hasFileUpload = fields.some(f => f.type === 'file');
    if (hasFileUpload) features.push('file_upload');

    // Check for text areas that might need AI content
    const hasTextAreas = fields.some(f => f.type === 'textarea');
    if (hasTextAreas) features.push('ai_content');

    // Skills are common in Workday applications
    features.push('skills');

    // Default answers for common questions
    features.push('default_answers');

    return features;
  }

  /**
   * Extract Workday job context
   */
  private extractWorkdayJobContext(document: Document): JobContext | undefined {
    try {
      const jobTitle = this.extractWorkdayJobTitle(document);
      const companyName = this.extractWorkdayCompanyName(document);
      const jobDescription = this.extractWorkdayJobDescription(document);

      if (!jobTitle && !companyName) {
        return undefined;
      }

      return {
        jobTitle: jobTitle || 'Workday Position',
        companyName: companyName || 'Workday Company',
        jobDescription: jobDescription || '',
        requirements: this.extractWorkdayRequirements(document),
        location: this.extractWorkdayLocation(document),
        jobType: this.extractWorkdayJobType(document)
      };
    } catch (error) {
      console.warn('Failed to extract Workday job context:', error);
      return undefined;
    }
  }

  private extractWorkdayJobTitle(document: Document): string | undefined {
    const element = document.querySelector(WORKDAY_SELECTORS.jobTitle);
    return element?.textContent?.trim();
  }

  private extractWorkdayCompanyName(document: Document): string | undefined {
    const element = document.querySelector(WORKDAY_SELECTORS.companyName);
    return element?.textContent?.trim();
  }

  private extractWorkdayJobDescription(document: Document): string {
    const element = document.querySelector(WORKDAY_SELECTORS.jobDescription);
    return element?.textContent?.trim() || '';
  }

  private extractWorkdayRequirements(document: Document): string[] {
    const requirements: string[] = [];
    const descriptionElement = document.querySelector(WORKDAY_SELECTORS.jobDescription);
    
    if (descriptionElement) {
      const text = descriptionElement.textContent?.toLowerCase() || '';
      const requirementPatterns = [
        /requirements?:?\s*([^.]+)/gi,
        /qualifications?:?\s*([^.]+)/gi,
        /must have:?\s*([^.]+)/gi,
        /required:?\s*([^.]+)/gi
      ];

      for (const pattern of requirementPatterns) {
        const matches = text.match(pattern);
        if (matches) {
          requirements.push(...matches.map(match => match.trim()));
        }
      }
    }

    return requirements.slice(0, 10);
  }

  private extractWorkdayLocation(document: Document): string | undefined {
    const selectors = [
      '[data-automation-id*="location"]',
      '[data-automation-id*="jobLocation"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractWorkdayJobType(document: Document): JobContext['jobType'] | undefined {
    const text = document.body.textContent?.toLowerCase() || '';
    
    if (text.includes('full time') || text.includes('full-time')) return 'full_time';
    if (text.includes('part time') || text.includes('part-time')) return 'part_time';
    if (text.includes('contract') || text.includes('contractor')) return 'contract';
    if (text.includes('intern') || text.includes('internship')) return 'internship';

    return undefined;
  }

  /**
   * Check if Workday form is multi-step
   */
  private isWorkdayMultiStep(formElement: HTMLElement): boolean {
    const nextButton = formElement.querySelector(WORKDAY_SELECTORS.nextButton);
    const stepIndicators = formElement.querySelectorAll(WORKDAY_SELECTORS.stepIndicator);
    const progressBar = formElement.querySelector(WORKDAY_SELECTORS.progressBar);
    
    return !!nextButton || stepIndicators.length > 1 || !!progressBar;
  }

  private getWorkdayCurrentStep(formElement: HTMLElement, document: Document): number {
    // Try to find current step from step indicators
    const currentStepElement = formElement.querySelector('[data-automation-id*="currentStep"], .css-current-step');
    if (currentStepElement) {
      const stepText = currentStepElement.textContent || currentStepElement.getAttribute('data-automation-id');
      const stepMatch = stepText?.match(/(\d+)/);
      if (stepMatch) {
        return parseInt(stepMatch[1], 10);
      }
    }

    // Check global step indicators
    return this.getWorkdayGlobalCurrentStep(document) || 1;
  }

  private getWorkdayTotalSteps(formElement: HTMLElement, document: Document): number {
    const stepIndicators = formElement.querySelectorAll(WORKDAY_SELECTORS.stepIndicator);
    if (stepIndicators.length > 0) {
      return stepIndicators.length;
    }

    // Check global step indicators
    return this.getWorkdayGlobalTotalSteps(document);
  }

  /**
   * Check if Workday has multi-step process globally
   */
  private hasWorkdayMultiStepProcess(document: Document): boolean {
    const globalStepIndicators = document.querySelectorAll(WORKDAY_SELECTORS.stepIndicator);
    const globalProgressBar = document.querySelector(WORKDAY_SELECTORS.progressBar);
    
    return globalStepIndicators.length > 1 || !!globalProgressBar;
  }

  private getWorkdayGlobalCurrentStep(document: Document): number | undefined {
    const currentStepElement = document.querySelector('[data-automation-id*="currentStep"], .css-current-step');
    if (currentStepElement) {
      const stepText = currentStepElement.textContent || currentStepElement.getAttribute('data-automation-id');
      const stepMatch = stepText?.match(/(\d+)/);
      if (stepMatch) {
        return parseInt(stepMatch[1], 10);
      }
    }
    return undefined;
  }

  private getWorkdayGlobalTotalSteps(document: Document): number | undefined {
    const stepIndicators = document.querySelectorAll(WORKDAY_SELECTORS.stepIndicator);
    return stepIndicators.length > 0 ? stepIndicators.length : undefined;
  }

  /**
   * Get Workday portal type
   */
  private getWorkdayPortalType(document: Document): string {
    const url = document.location.href.toLowerCase();
    
    if (url.includes('apply')) return 'application';
    if (url.includes('job')) return 'job_posting';
    if (url.includes('career')) return 'career_portal';
    
    return 'unknown';
  }

  /**
   * Create a form for Workday apply button
   */
  private async createWorkdayApplyButtonForm(buttonElement: HTMLElement, document: Document): Promise<DetectedForm | null> {
    const formId = `workday_apply_button_${Date.now()}`;
    const jobContext = this.extractWorkdayJobContext(document);
    
    const fields: FormField[] = [{
      id: 'workday_apply_trigger',
      type: 'text',
      label: 'Apply',
      selector: WORKDAY_SELECTORS.applyButton,
      required: false,
      mappedProfileField: undefined
    }];

    return {
      platform: 'workday',
      formId,
      url: document.location.href,
      fields,
      jobContext,
      confidence: 0.8,
      supportedFeatures: ['basic_info', 'work_experience', 'education', 'file_upload', 'ai_content', 'default_answers'],
      detectedAt: new Date(),
      isMultiStep: true, // Workday is typically multi-step
      currentStep: 0,
      totalSteps: undefined
    };
  }
}