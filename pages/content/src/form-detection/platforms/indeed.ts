/**
 * Indeed-specific form detection module
 * Handles Indeed job application forms and quick apply detection
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

export interface IndeedFormSelectors {
  applyButton: string;
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
  continueButton: string;
}

export const INDEED_SELECTORS: IndeedFormSelectors = {
  applyButton: '[data-jk] .ia-IndeedApplyButton, .indeed-apply-button, [data-testid="apply-button"]',
  applicationForm: '.ia-IndeedApplyForm, .indeed-apply-form, [data-testid="application-form"]',
  jobTitle: '[data-testid="jobTitle"], .jobsearch-JobInfoHeader-title, h1[data-testid="job-title"]',
  companyName: '[data-testid="companyName"], .jobsearch-InlineCompanyRating, [data-testid="company-name"]',
  jobDescription: '[data-testid="jobDescription"], .jobsearch-jobDescriptionText, [data-testid="job-description"]',
  formContainer: '.ia-IndeedApplyForm-container, .indeed-apply-form-container, [data-testid="form-container"]',
  textFields: 'input[type="text"], input[type="email"], input[type="tel"], input[name*="name"], input[name*="email"], input[name*="phone"]',
  dropdowns: 'select, .ia-Dropdown, [data-testid="dropdown"]',
  checkboxes: 'input[type="checkbox"]',
  radioButtons: 'input[type="radio"]',
  fileUpload: 'input[type="file"], .ia-FileUpload, [data-testid="file-upload"]',
  textAreas: 'textarea, [data-testid="textarea"]',
  submitButton: '[data-testid="submit-application"], .ia-IndeedApplyForm-submitButton, button[type="submit"]',
  continueButton: '[data-testid="continue-button"], .ia-IndeedApplyForm-continueButton'
};

/**
 * Indeed-specific form detector
 */
export class IndeedFormDetector extends BaseFormDetector {
  private confidenceScorer: ConfidenceScorer;

  constructor() {
    super({
      minConfidenceThreshold: 0.7,
      maxFormsPerPage: 3,
      enableJobContextExtraction: true,
      fieldDetectionTimeout: 5000
    });
    this.confidenceScorer = new ConfidenceScorer();
  }

  /**
   * Detect Indeed application forms
   */
  async detectIndeedForms(document: Document = window.document): Promise<FormDetectionResult> {
    try {
      const forms: DetectedForm[] = [];
      
      // Check if we're on an Indeed job page
      if (!this.isIndeedJobPage(document)) {
        return {
          success: true,
          forms: [],
          errors: []
        };
      }

      // Look for Indeed Apply forms
      const applicationForms = document.querySelectorAll(INDEED_SELECTORS.applicationForm);
      
      for (const formElement of applicationForms) {
        const detectedForm = await this.analyzeIndeedForm(formElement as HTMLElement, document);
        if (detectedForm) {
          forms.push(detectedForm);
        }
      }

      // Also check for apply buttons that might trigger forms
      const applyButton = document.querySelector(INDEED_SELECTORS.applyButton);
      if (applyButton && forms.length === 0) {
        const buttonForm = await this.createIndeedApplyButtonForm(applyButton as HTMLElement, document);
        if (buttonForm) {
          forms.push(buttonForm);
        }
      }

      // Check for external application forms (employer's website)
      const externalForms = await this.detectExternalIndeedForms(document);
      forms.push(...externalForms);

      return {
        success: true,
        forms,
        errors: [],
        platformSpecificData: {
          hasIndeedApply: !!document.querySelector(INDEED_SELECTORS.applyButton),
          hasExternalApplication: this.hasExternalApplication(document),
          formType: this.getIndeedFormType(document)
        }
      };
    } catch (error) {
      return {
        success: false,
        forms: [],
        errors: [{
          code: 'INDEED_DETECTION_ERROR',
          message: `Indeed form detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Check if current page is an Indeed job page
   */
  private isIndeedJobPage(document: Document): boolean {
    const url = document.location.href.toLowerCase();
    const hostname = document.location.hostname.toLowerCase();
    
    return hostname.includes('indeed.com') && 
           (url.includes('/job/') || url.includes('/apply/') || 
            document.querySelector(INDEED_SELECTORS.jobTitle) !== null);
  }

  /**
   * Analyze an Indeed form element
   */
  private async analyzeIndeedForm(formElement: HTMLElement, document: Document): Promise<DetectedForm | null> {
    const fields = this.detectIndeedFields(formElement);
    
    if (fields.length === 0) {
      return null;
    }

    const formId = `indeed_form_${Date.now()}`;
    const confidence = this.confidenceScorer.calculateConfidence(formElement, fields, 'indeed', document);
    const supportedFeatures = this.getIndeedSupportedFeatures(fields);
    const jobContext = this.extractIndeedJobContext(document);
    const isMultiStep = this.isIndeedMultiStep(formElement);

    return {
      platform: 'indeed',
      formId,
      url: document.location.href,
      fields,
      jobContext,
      confidence,
      supportedFeatures,
      detectedAt: new Date(),
      isMultiStep,
      currentStep: isMultiStep ? this.getIndeedCurrentStep(formElement) : undefined,
      totalSteps: isMultiStep ? this.getIndeedTotalSteps(formElement) : undefined
    };
  }

  /**
   * Detect form fields specific to Indeed
   */
  private detectIndeedFields(formElement: HTMLElement): FormField[] {
    const fields: FormField[] = [];

    try {
      // Text inputs
      const textInputs = formElement.querySelectorAll(INDEED_SELECTORS.textFields);
      textInputs.forEach((input, index) => {
        const field = this.createIndeedField(input as HTMLElement, 'text', index);
        if (field) fields.push(field);
      });

      // Text areas (cover letters, additional info)
      const textAreas = formElement.querySelectorAll(INDEED_SELECTORS.textAreas);
      textAreas.forEach((textarea, index) => {
        const field = this.createIndeedField(textarea as HTMLElement, 'textarea', index + 1000);
        if (field) fields.push(field);
      });

      // Dropdowns
      const dropdowns = formElement.querySelectorAll(INDEED_SELECTORS.dropdowns);
      dropdowns.forEach((select, index) => {
        const field = this.createIndeedField(select as HTMLElement, 'select', index + 2000);
        if (field) fields.push(field);
      });

      // File uploads
      const fileInputs = formElement.querySelectorAll(INDEED_SELECTORS.fileUpload);
      fileInputs.forEach((input, index) => {
        const field = this.createIndeedField(input as HTMLElement, 'file', index + 3000);
        if (field) fields.push(field);
      });

      // Checkboxes
      const checkboxes = formElement.querySelectorAll(INDEED_SELECTORS.checkboxes);
      checkboxes.forEach((input, index) => {
        const field = this.createIndeedField(input as HTMLElement, 'checkbox', index + 4000);
        if (field) fields.push(field);
      });

      // Radio buttons
      const radioButtons = formElement.querySelectorAll(INDEED_SELECTORS.radioButtons);
      radioButtons.forEach((input, index) => {
        const field = this.createIndeedField(input as HTMLElement, 'radio', index + 5000);
        if (field) fields.push(field);
      });

    } catch (error) {
      console.warn('Error detecting Indeed fields:', error);
    }

    return fields;
  }

  /**
   * Create an Indeed-specific form field
   */
  private createIndeedField(element: HTMLElement, fieldType: string, index: number): FormField | null {
    const input = element as HTMLInputElement;
    const tagName = element.tagName.toLowerCase();
    const type = input.type?.toLowerCase() || tagName;
    
    // Skip hidden fields and buttons
    if (type === 'hidden' || type === 'submit' || type === 'button') {
      return null;
    }

    const id = element.id || `indeed_field_${index}`;
    const label = this.extractIndeedFieldLabel(element);
    const selector = this.generateIndeedSelector(element);
    const required = this.isIndeedFieldRequired(element);
    const placeholder = input.placeholder;

    const mappedFieldType = this.mapIndeedFieldType(type, element);
    const mappedProfileField = this.mapIndeedProfileField(label, mappedFieldType, placeholder);
    const options = this.extractIndeedFieldOptions(element);

    return {
      id,
      type: mappedFieldType,
      label,
      selector,
      required,
      placeholder,
      options,
      mappedProfileField,
      validationRules: this.extractIndeedValidationRules(element)
    };
  }

  /**
   * Extract field label for Indeed forms
   */
  private extractIndeedFieldLabel(element: HTMLElement): string {
    // Indeed-specific label selectors
    const indeedLabelSelectors = [
      '.ia-FormField-label',
      '.ia-Label',
      '[data-testid*="label"]',
      '.form-field-label'
    ];

    // Try Indeed-specific selectors first
    for (const selector of indeedLabelSelectors) {
      const label = element.closest('.ia-FormField, .form-field')?.querySelector(selector);
      if (label?.textContent?.trim()) {
        return label.textContent.trim();
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
    
    return placeholder || name || 'Indeed Field';
  }

  /**
   * Generate Indeed-specific selector
   */
  private generateIndeedSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    // Try Indeed-specific attributes
    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    if ((element as HTMLInputElement).name) {
      return `[name="${(element as HTMLInputElement).name}"]`;
    }

    // Generate selector based on Indeed form structure
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const type = (element as HTMLInputElement).type ? `[type="${(element as HTMLInputElement).type}"]` : '';
    
    return `${tagName}${className}${type}`;
  }

  /**
   * Check if Indeed field is required
   */
  private isIndeedFieldRequired(element: HTMLElement): boolean {
    const input = element as HTMLInputElement;
    
    // Standard required attribute
    if (input.required || input.getAttribute('aria-required') === 'true') {
      return true;
    }

    // Indeed-specific required indicators
    const formField = element.closest('.ia-FormField, .form-field');
    if (formField) {
      const requiredIndicator = formField.querySelector('.required, [data-testid*="required"], .ia-FormField--required');
      if (requiredIndicator) {
        return true;
      }
    }

    // Check for asterisk in label
    const label = this.extractIndeedFieldLabel(element);
    return label.includes('*') || label.includes('required');
  }

  /**
   * Map Indeed field types
   */
  private mapIndeedFieldType(htmlType: string, element: HTMLElement): any {
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

    return typeMap[htmlType] || 'text';
  }

  /**
   * Map Indeed fields to profile data
   */
  private mapIndeedProfileField(label: string, type: any, placeholder?: string): string | undefined {
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

    // Common Indeed application questions
    if (text.includes('work authorization') || text.includes('authorized to work')) return 'preferences.defaultAnswers.workAuthorization';
    if (text.includes('sponsorship') || text.includes('visa sponsorship')) return 'preferences.defaultAnswers.sponsorship';
    if (text.includes('start date') || text.includes('available to start')) return 'preferences.defaultAnswers.startDate';
    if (text.includes('salary') || text.includes('compensation')) return 'preferences.defaultAnswers.salaryExpectation';
    if (text.includes('notice period') || text.includes('availability')) return 'preferences.defaultAnswers.noticePeriod';

    return undefined;
  }

  /**
   * Extract options for Indeed select/radio fields
   */
  private extractIndeedFieldOptions(element: HTMLElement): string[] | undefined {
    if (element.tagName.toLowerCase() === 'select') {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.map(option => option.textContent || option.value).filter(Boolean);
    }

    if ((element as HTMLInputElement).type === 'radio') {
      const name = (element as HTMLInputElement).name;
      if (name) {
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        return Array.from(radioGroup).map(radio => {
          const label = this.extractIndeedFieldLabel(radio as HTMLElement);
          return label !== 'Indeed Field' ? label : (radio as HTMLInputElement).value;
        });
      }
    }

    return undefined;
  }

  /**
   * Extract validation rules for Indeed fields
   */
  private extractIndeedValidationRules(element: HTMLElement): any[] {
    const rules: any[] = [];
    const input = element as HTMLInputElement;

    if (this.isIndeedFieldRequired(element)) {
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
   * Get supported features for Indeed forms
   */
  private getIndeedSupportedFeatures(fields: FormField[]): AutofillFeature[] {
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

    // Skills are common in Indeed applications
    features.push('skills');

    // Default answers for common questions
    features.push('default_answers');

    return features;
  }

  /**
   * Extract Indeed job context
   */
  private extractIndeedJobContext(document: Document): JobContext | undefined {
    try {
      const jobTitle = this.extractIndeedJobTitle(document);
      const companyName = this.extractIndeedCompanyName(document);
      const jobDescription = this.extractIndeedJobDescription(document);

      if (!jobTitle && !companyName) {
        return undefined;
      }

      return {
        jobTitle: jobTitle || 'Indeed Position',
        companyName: companyName || 'Indeed Company',
        jobDescription: jobDescription || '',
        requirements: this.extractIndeedRequirements(document),
        location: this.extractIndeedLocation(document),
        jobType: this.extractIndeedJobType(document)
      };
    } catch (error) {
      console.warn('Failed to extract Indeed job context:', error);
      return undefined;
    }
  }

  private extractIndeedJobTitle(document: Document): string | undefined {
    const element = document.querySelector(INDEED_SELECTORS.jobTitle);
    return element?.textContent?.trim();
  }

  private extractIndeedCompanyName(document: Document): string | undefined {
    const element = document.querySelector(INDEED_SELECTORS.companyName);
    return element?.textContent?.trim();
  }

  private extractIndeedJobDescription(document: Document): string {
    const element = document.querySelector(INDEED_SELECTORS.jobDescription);
    return element?.textContent?.trim() || '';
  }

  private extractIndeedRequirements(document: Document): string[] {
    const requirements: string[] = [];
    const descriptionElement = document.querySelector(INDEED_SELECTORS.jobDescription);
    
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

  private extractIndeedLocation(document: Document): string | undefined {
    const selectors = [
      '[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-subtitle',
      '.jobsearch-DesktopStickyContainer-subtitle'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractIndeedJobType(document: Document): JobContext['jobType'] | undefined {
    const text = document.body.textContent?.toLowerCase() || '';
    
    if (text.includes('full time') || text.includes('full-time')) return 'full_time';
    if (text.includes('part time') || text.includes('part-time')) return 'part_time';
    if (text.includes('contract') || text.includes('contractor')) return 'contract';
    if (text.includes('intern') || text.includes('internship')) return 'internship';

    return undefined;
  }

  /**
   * Check if Indeed form is multi-step
   */
  private isIndeedMultiStep(formElement: HTMLElement): boolean {
    const continueButton = formElement.querySelector(INDEED_SELECTORS.continueButton);
    const stepIndicators = formElement.querySelectorAll('[data-testid*="step"], .step-indicator');
    
    return !!continueButton || stepIndicators.length > 1;
  }

  private getIndeedCurrentStep(formElement: HTMLElement): number {
    const stepElement = formElement.querySelector('[data-testid*="current-step"], .step-current');
    if (stepElement) {
      const stepText = stepElement.textContent || stepElement.getAttribute('data-testid');
      const stepMatch = stepText?.match(/(\d+)/);
      if (stepMatch) {
        return parseInt(stepMatch[1], 10);
      }
    }
    return 1;
  }

  private getIndeedTotalSteps(formElement: HTMLElement): number {
    const stepIndicators = formElement.querySelectorAll('[data-testid*="step"], .step-indicator');
    return stepIndicators.length > 0 ? stepIndicators.length : undefined;
  }

  /**
   * Create a form for Indeed apply button
   */
  private async createIndeedApplyButtonForm(buttonElement: HTMLElement, document: Document): Promise<DetectedForm | null> {
    const formId = `indeed_apply_button_${Date.now()}`;
    const jobContext = this.extractIndeedJobContext(document);
    
    const fields: FormField[] = [{
      id: 'indeed_apply_trigger',
      type: 'text',
      label: 'Apply Now',
      selector: INDEED_SELECTORS.applyButton,
      required: false,
      mappedProfileField: undefined
    }];

    return {
      platform: 'indeed',
      formId,
      url: document.location.href,
      fields,
      jobContext,
      confidence: 0.8,
      supportedFeatures: ['basic_info', 'work_experience', 'education', 'file_upload', 'ai_content', 'default_answers'],
      detectedAt: new Date(),
      isMultiStep: false,
      currentStep: undefined,
      totalSteps: undefined
    };
  }

  /**
   * Detect external application forms (when Indeed redirects to employer's site)
   */
  private async detectExternalIndeedForms(document: Document): Promise<DetectedForm[]> {
    const forms: DetectedForm[] = [];
    
    // Check if we're on an external site but came from Indeed
    const referrer = document.referrer.toLowerCase();
    const isFromIndeed = referrer.includes('indeed.com');
    
    if (isFromIndeed) {
      // Use base detector to find forms on external site
      const baseResult = await super.detectForms(document);
      
      // Mark these as Indeed-related external forms
      for (const form of baseResult.forms) {
        const indeedForm: DetectedForm = {
          ...form,
          platform: 'indeed',
          formId: `indeed_external_${form.formId}`,
          supportedFeatures: [...form.supportedFeatures, 'default_answers']
        };
        forms.push(indeedForm);
      }
    }
    
    return forms;
  }

  /**
   * Check if page has external application
   */
  private hasExternalApplication(document: Document): boolean {
    const externalLinks = document.querySelectorAll('a[href*="apply"], a[href*="career"], a[href*="job"]');
    return externalLinks.length > 0 && !document.querySelector(INDEED_SELECTORS.applicationForm);
  }

  /**
   * Get Indeed form type
   */
  private getIndeedFormType(document: Document): string {
    if (document.querySelector(INDEED_SELECTORS.applicationForm)) {
      return 'indeed_apply';
    }
    if (this.hasExternalApplication(document)) {
      return 'external_redirect';
    }
    return 'unknown';
  }
}