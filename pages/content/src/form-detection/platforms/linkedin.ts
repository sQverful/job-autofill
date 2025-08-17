/**
 * LinkedIn-specific form detection module
 * Handles Easy Apply forms and LinkedIn job application detection
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

export interface LinkedInFormSelectors {
  easyApplyModal: string;
  easyApplyButton: string;
  formContainer: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  applicationForm: string;
  nextButton: string;
  submitButton: string;
  fileUpload: string;
  textFields: string;
  dropdowns: string;
  checkboxes: string;
  radioButtons: string;
}

export const LINKEDIN_SELECTORS: LinkedInFormSelectors = {
  easyApplyModal: '.jobs-easy-apply-modal, [data-test-modal="easy-apply-modal"]',
  easyApplyButton: '.jobs-apply-button--top-card, .jobs-s-apply button, [data-control-name="jobdetails_topcard_inapply"]',
  formContainer: '.jobs-easy-apply-content, .jobs-easy-apply-form-container',
  jobTitle: '.jobs-unified-top-card__job-title, .job-details-jobs-unified-top-card__job-title, h1[data-test-job-title]',
  companyName: '.jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__company-name, [data-test-employer-name]',
  jobDescription: '.jobs-description-content__text, .jobs-box__html-content, [data-test-job-description]',
  applicationForm: '.jobs-easy-apply-form, .jobs-easy-apply-form-section',
  nextButton: '.jobs-easy-apply-form-section__next-btn, [aria-label="Continue to next step"], [data-easy-apply-next-button]',
  submitButton: '.jobs-easy-apply-form-section__submit-btn, [aria-label="Submit application"], [data-easy-apply-submit-button]',
  fileUpload: 'input[type="file"], .jobs-document-upload, [data-test-file-upload]',
  textFields: 'input[type="text"], input[type="email"], input[type="tel"], textarea',
  dropdowns: 'select, .jobs-easy-apply-form-element--dropdown',
  checkboxes: 'input[type="checkbox"]',
  radioButtons: 'input[type="radio"]'
};

/**
 * LinkedIn-specific form detector
 */
export class LinkedInFormDetector extends BaseFormDetector {
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
   * Detect LinkedIn Easy Apply forms
   */
  async detectLinkedInForms(document: Document = window.document): Promise<FormDetectionResult> {
    try {
      const forms: DetectedForm[] = [];
      
      // Check if we're on a LinkedIn job page
      if (!this.isLinkedInJobPage(document)) {
        return {
          success: true,
          forms: [],
          errors: []
        };
      }

      // Look for Easy Apply modal or form
      const easyApplyModal = document.querySelector(LINKEDIN_SELECTORS.easyApplyModal);
      const formContainer = document.querySelector(LINKEDIN_SELECTORS.formContainer);
      
      if (easyApplyModal || formContainer) {
        const formElement = (easyApplyModal || formContainer) as HTMLElement;
        const detectedForm = await this.analyzeLinkedInForm(formElement, document);
        
        if (detectedForm) {
          forms.push(detectedForm);
        }
      }

      // Also check for potential Easy Apply buttons that might trigger forms
      const easyApplyButton = document.querySelector(LINKEDIN_SELECTORS.easyApplyButton);
      if (easyApplyButton && forms.length === 0) {
        // Create a placeholder form for the Easy Apply button
        const buttonForm = await this.createEasyApplyButtonForm(easyApplyButton as HTMLElement, document);
        if (buttonForm) {
          forms.push(buttonForm);
        }
      }

      return {
        success: true,
        forms,
        errors: [],
        platformSpecificData: {
          hasEasyApply: !!easyApplyButton,
          modalVisible: !!easyApplyModal,
          formVisible: !!formContainer
        }
      };
    } catch (error) {
      return {
        success: false,
        forms: [],
        errors: [{
          code: 'LINKEDIN_DETECTION_ERROR',
          message: `LinkedIn form detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Check if current page is a LinkedIn job page
   */
  private isLinkedInJobPage(document: Document): boolean {
    const url = document.location.href.toLowerCase();
    const hostname = document.location.hostname.toLowerCase();
    
    return hostname.includes('linkedin.com') && 
           (url.includes('/jobs/') || url.includes('/job/') || 
            document.querySelector(LINKEDIN_SELECTORS.jobTitle) !== null);
  }

  /**
   * Analyze a LinkedIn form element
   */
  private async analyzeLinkedInForm(formElement: HTMLElement, document: Document): Promise<DetectedForm | null> {
    const fields = this.detectLinkedInFields(formElement);
    
    if (fields.length === 0) {
      return null;
    }

    const formId = `linkedin_form_${Date.now()}`;
    const confidence = this.confidenceScorer.calculateConfidence(formElement, fields, 'linkedin', document);
    const supportedFeatures = this.getLinkedInSupportedFeatures(fields);
    const jobContext = this.extractLinkedInJobContext(document);
    const isMultiStep = this.isLinkedInMultiStep(formElement);

    return {
      platform: 'linkedin',
      formId,
      url: document.location.href,
      fields,
      jobContext,
      confidence,
      supportedFeatures,
      detectedAt: new Date(),
      isMultiStep,
      currentStep: isMultiStep ? this.getLinkedInCurrentStep(formElement) : undefined,
      totalSteps: isMultiStep ? this.getLinkedInTotalSteps(formElement) : undefined
    };
  }

  /**
   * Detect form fields specific to LinkedIn
   */
  private detectLinkedInFields(formElement: HTMLElement): FormField[] {
    const fields: FormField[] = [];

    try {
      // Text inputs (name, email, phone, etc.)
      const textInputs = formElement.querySelectorAll(LINKEDIN_SELECTORS.textFields);
      textInputs.forEach((input, index) => {
        const field = this.createLinkedInField(input as HTMLElement, 'text', index);
        if (field) fields.push(field);
      });

      // Dropdowns (experience level, location, etc.)
      const dropdowns = formElement.querySelectorAll(LINKEDIN_SELECTORS.dropdowns);
      dropdowns.forEach((select, index) => {
        const field = this.createLinkedInField(select as HTMLElement, 'select', index + 1000);
        if (field) fields.push(field);
      });

      // File uploads (resume, cover letter)
      const fileInputs = formElement.querySelectorAll(LINKEDIN_SELECTORS.fileUpload);
      fileInputs.forEach((input, index) => {
        const field = this.createLinkedInField(input as HTMLElement, 'file', index + 2000);
        if (field) fields.push(field);
      });

      // Checkboxes (agreements, preferences)
      const checkboxes = formElement.querySelectorAll(LINKEDIN_SELECTORS.checkboxes);
      checkboxes.forEach((input, index) => {
        const field = this.createLinkedInField(input as HTMLElement, 'checkbox', index + 3000);
        if (field) fields.push(field);
      });

      // Radio buttons (yes/no questions)
      const radioButtons = formElement.querySelectorAll(LINKEDIN_SELECTORS.radioButtons);
      radioButtons.forEach((input, index) => {
        const field = this.createLinkedInField(input as HTMLElement, 'radio', index + 4000);
        if (field) fields.push(field);
      });

    } catch (error) {
      console.warn('Error detecting LinkedIn fields:', error);
    }

    return fields;
  }

  /**
   * Create a LinkedIn-specific form field
   */
  private createLinkedInField(element: HTMLElement, fieldType: string, index: number): FormField | null {
    const input = element as HTMLInputElement;
    const tagName = element.tagName.toLowerCase();
    const type = input.type?.toLowerCase() || tagName;
    
    // Skip hidden fields and buttons
    if (type === 'hidden' || type === 'submit' || type === 'button') {
      return null;
    }

    const id = element.id || `linkedin_field_${index}`;
    const label = this.extractLinkedInFieldLabel(element);
    const selector = this.generateLinkedInSelector(element);
    const required = this.isLinkedInFieldRequired(element);
    const placeholder = input.placeholder;

    const mappedFieldType = this.mapLinkedInFieldType(type, element);
    const mappedProfileField = this.mapLinkedInProfileField(label, mappedFieldType, placeholder);
    const options = this.extractLinkedInFieldOptions(element);

    return {
      id,
      type: mappedFieldType,
      label,
      selector,
      required,
      placeholder,
      options,
      mappedProfileField,
      validationRules: this.extractLinkedInValidationRules(element)
    };
  }

  /**
   * Extract field label for LinkedIn forms
   */
  private extractLinkedInFieldLabel(element: HTMLElement): string {
    // LinkedIn-specific label selectors
    const linkedInLabelSelectors = [
      '.jobs-easy-apply-form-element__label',
      '.fb-form-element-label',
      '.artdeco-text-input--label',
      '[data-test-form-element-label]'
    ];

    // Try LinkedIn-specific selectors first
    for (const selector of linkedInLabelSelectors) {
      const label = element.closest('.jobs-easy-apply-form-element, .fb-form-element')?.querySelector(selector);
      if (label?.textContent?.trim()) {
        return label.textContent.trim();
      }
    }

    // Try standard label detection
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label?.textContent) {
        return label.textContent.trim();
      }
    }

    // Look for parent label or nearby text
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
    
    return placeholder || name || 'LinkedIn Field';
  }

  /**
   * Generate LinkedIn-specific selector
   */
  private generateLinkedInSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    // Try LinkedIn-specific attributes
    const testId = element.getAttribute('data-test-single-typeahead-entity') || 
                   element.getAttribute('data-test-text-entity-list-form-component') ||
                   element.getAttribute('data-test-form-element');
    
    if (testId) {
      return `[data-test-single-typeahead-entity="${testId}"], [data-test-text-entity-list-form-component="${testId}"], [data-test-form-element="${testId}"]`;
    }

    if ((element as HTMLInputElement).name) {
      return `[name="${(element as HTMLInputElement).name}"]`;
    }

    // Generate selector based on LinkedIn form structure
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const type = (element as HTMLInputElement).type ? `[type="${(element as HTMLInputElement).type}"]` : '';
    
    return `${tagName}${className}${type}`;
  }

  /**
   * Check if LinkedIn field is required
   */
  private isLinkedInFieldRequired(element: HTMLElement): boolean {
    const input = element as HTMLInputElement;
    
    // Standard required attribute
    if (input.required || input.getAttribute('aria-required') === 'true') {
      return true;
    }

    // LinkedIn-specific required indicators
    const formElement = element.closest('.jobs-easy-apply-form-element, .fb-form-element');
    if (formElement) {
      const requiredIndicator = formElement.querySelector('.required, [data-test-required], .jobs-easy-apply-form-element--required');
      if (requiredIndicator) {
        return true;
      }
    }

    // Check for asterisk in label
    const label = this.extractLinkedInFieldLabel(element);
    return label.includes('*') || label.includes('required');
  }

  /**
   * Map LinkedIn field types
   */
  private mapLinkedInFieldType(htmlType: string, element: HTMLElement): any {
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

    // LinkedIn-specific field type detection
    const className = element.className.toLowerCase();
    if (className.includes('typeahead') || className.includes('dropdown')) {
      return 'select';
    }

    return typeMap[htmlType] || 'text';
  }

  /**
   * Map LinkedIn fields to profile data
   */
  private mapLinkedInProfileField(label: string, type: any, placeholder?: string): string | undefined {
    const text = `${label} ${placeholder || ''}`.toLowerCase();
    
    // LinkedIn-specific mappings
    if (text.includes('first name') || text.includes('given name')) return 'personalInfo.firstName';
    if (text.includes('last name') || text.includes('family name') || text.includes('surname')) return 'personalInfo.lastName';
    if (text.includes('email') || text.includes('e-mail')) return 'personalInfo.email';
    if (text.includes('phone') || text.includes('mobile') || text.includes('telephone')) return 'personalInfo.phone';
    if (text.includes('location') || text.includes('city') || text.includes('address')) return 'personalInfo.address';
    
    // Professional information
    if (text.includes('resume') || text.includes('cv') || text.includes('upload your resume')) return 'documents.resumes[0]';
    if (text.includes('cover letter')) return 'documents.coverLetters[0]';
    if (text.includes('linkedin') || text.includes('profile url')) return 'professionalInfo.linkedinUrl';
    if (text.includes('website') || text.includes('portfolio')) return 'professionalInfo.portfolioUrl';
    if (text.includes('current company') || text.includes('employer')) return 'professionalInfo.workExperience[0].company';
    if (text.includes('current title') || text.includes('job title') || text.includes('position')) return 'professionalInfo.workExperience[0].title';
    if (text.includes('university') || text.includes('school') || text.includes('education')) return 'professionalInfo.education[0].institution';
    if (text.includes('degree')) return 'professionalInfo.education[0].degree';
    if (text.includes('major') || text.includes('field of study')) return 'professionalInfo.education[0].fieldOfStudy';
    if (text.includes('graduation') || text.includes('grad date')) return 'professionalInfo.education[0].graduationDate';
    
    // Common LinkedIn application questions
    if (text.includes('work authorization') || text.includes('authorized to work')) return 'preferences.defaultAnswers.workAuthorization';
    if (text.includes('sponsorship') || text.includes('visa sponsorship')) return 'preferences.defaultAnswers.sponsorship';
    if (text.includes('start date') || text.includes('available to start')) return 'preferences.defaultAnswers.startDate';
    if (text.includes('salary') || text.includes('compensation')) return 'preferences.defaultAnswers.salaryExpectation';
    if (text.includes('notice period') || text.includes('availability')) return 'preferences.defaultAnswers.noticePeriod';

    return undefined;
  }

  /**
   * Extract options for LinkedIn select/radio fields
   */
  private extractLinkedInFieldOptions(element: HTMLElement): string[] | undefined {
    if (element.tagName.toLowerCase() === 'select') {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.map(option => option.textContent || option.value).filter(Boolean);
    }

    if ((element as HTMLInputElement).type === 'radio') {
      const name = (element as HTMLInputElement).name;
      if (name) {
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        return Array.from(radioGroup).map(radio => {
          const label = this.extractLinkedInFieldLabel(radio as HTMLElement);
          return label !== 'LinkedIn Field' ? label : (radio as HTMLInputElement).value;
        });
      }
    }

    return undefined;
  }

  /**
   * Extract validation rules for LinkedIn fields
   */
  private extractLinkedInValidationRules(element: HTMLElement): any[] {
    const rules: any[] = [];
    const input = element as HTMLInputElement;

    if (this.isLinkedInFieldRequired(element)) {
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
   * Get supported features for LinkedIn forms
   */
  private getLinkedInSupportedFeatures(fields: FormField[]): AutofillFeature[] {
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

    // LinkedIn Easy Apply typically supports AI content for cover letters
    const hasTextAreas = fields.some(f => f.type === 'textarea');
    if (hasTextAreas) features.push('ai_content');

    // Skills are common in LinkedIn applications
    features.push('skills');

    // Default answers for common questions
    features.push('default_answers');

    return features;
  }

  /**
   * Extract LinkedIn job context
   */
  private extractLinkedInJobContext(document: Document): JobContext | undefined {
    try {
      const jobTitle = this.extractLinkedInJobTitle(document);
      const companyName = this.extractLinkedInCompanyName(document);
      const jobDescription = this.extractLinkedInJobDescription(document);

      if (!jobTitle && !companyName) {
        return undefined;
      }

      return {
        jobTitle: jobTitle || 'LinkedIn Position',
        companyName: companyName || 'LinkedIn Company',
        jobDescription: jobDescription || '',
        requirements: this.extractLinkedInRequirements(document),
        location: this.extractLinkedInLocation(document),
        jobType: this.extractLinkedInJobType(document)
      };
    } catch (error) {
      console.warn('Failed to extract LinkedIn job context:', error);
      return undefined;
    }
  }

  private extractLinkedInJobTitle(document: Document): string | undefined {
    const element = document.querySelector(LINKEDIN_SELECTORS.jobTitle);
    return element?.textContent?.trim();
  }

  private extractLinkedInCompanyName(document: Document): string | undefined {
    const element = document.querySelector(LINKEDIN_SELECTORS.companyName);
    return element?.textContent?.trim();
  }

  private extractLinkedInJobDescription(document: Document): string {
    const element = document.querySelector(LINKEDIN_SELECTORS.jobDescription);
    return element?.textContent?.trim() || '';
  }

  private extractLinkedInRequirements(document: Document): string[] {
    const requirements: string[] = [];
    const descriptionElement = document.querySelector(LINKEDIN_SELECTORS.jobDescription);
    
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

  private extractLinkedInLocation(document: Document): string | undefined {
    const selectors = [
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__primary-description-container',
      '[data-test-job-location]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractLinkedInJobType(document: Document): JobContext['jobType'] | undefined {
    const text = document.body.textContent?.toLowerCase() || '';
    
    if (text.includes('full time') || text.includes('full-time')) return 'full_time';
    if (text.includes('part time') || text.includes('part-time')) return 'part_time';
    if (text.includes('contract') || text.includes('contractor')) return 'contract';
    if (text.includes('intern') || text.includes('internship')) return 'internship';

    return undefined;
  }

  /**
   * Check if LinkedIn form is multi-step
   */
  private isLinkedInMultiStep(formElement: HTMLElement): boolean {
    const nextButton = formElement.querySelector(LINKEDIN_SELECTORS.nextButton);
    const stepIndicators = formElement.querySelectorAll('.jobs-easy-apply-form-section__step, [data-test-step-indicator]');
    
    return !!nextButton || stepIndicators.length > 1;
  }

  private getLinkedInCurrentStep(formElement: HTMLElement): number {
    const stepElement = formElement.querySelector('[data-test-current-step], .jobs-easy-apply-form-section__step--current');
    if (stepElement) {
      const stepText = stepElement.textContent || stepElement.getAttribute('data-test-current-step');
      const stepMatch = stepText?.match(/(\d+)/);
      if (stepMatch) {
        return parseInt(stepMatch[1], 10);
      }
    }
    return 1;
  }

  private getLinkedInTotalSteps(formElement: HTMLElement): number {
    const stepIndicators = formElement.querySelectorAll('.jobs-easy-apply-form-section__step, [data-test-step-indicator]');
    return stepIndicators.length > 0 ? stepIndicators.length : undefined;
  }

  /**
   * Create a form for Easy Apply button (before modal opens)
   */
  private async createEasyApplyButtonForm(buttonElement: HTMLElement, document: Document): Promise<DetectedForm | null> {
    const formId = `linkedin_easy_apply_button_${Date.now()}`;
    const jobContext = this.extractLinkedInJobContext(document);
    
    // Create a minimal form representation for the Easy Apply button
    const fields: FormField[] = [{
      id: 'easy_apply_trigger',
      type: 'text',
      label: 'Easy Apply',
      selector: LINKEDIN_SELECTORS.easyApplyButton,
      required: false,
      mappedProfileField: undefined
    }];

    return {
      platform: 'linkedin',
      formId,
      url: document.location.href,
      fields,
      jobContext,
      confidence: 0.8, // High confidence for Easy Apply button
      supportedFeatures: ['basic_info', 'work_experience', 'education', 'file_upload', 'ai_content', 'default_answers'],
      detectedAt: new Date(),
      isMultiStep: true, // Easy Apply is typically multi-step
      currentStep: 0, // Before form opens
      totalSteps: undefined
    };
  }
}