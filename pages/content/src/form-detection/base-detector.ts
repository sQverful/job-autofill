/**
 * Base form detection utilities for job application forms
 * Provides core DOM analysis and field classification functionality
 */

import type {
  DetectedForm,
  FormField,
  FieldType,
  JobPlatform,
  FormDetectionResult,
  FormDetectionError,
  AutofillFeature,
  JobContext
} from '@extension/shared/lib/types/form-detection';

export interface FormDetectionConfig {
  minConfidenceThreshold: number;
  maxFormsPerPage: number;
  enableJobContextExtraction: boolean;
  fieldDetectionTimeout: number;
}

export const DEFAULT_DETECTION_CONFIG: FormDetectionConfig = {
  minConfidenceThreshold: 0.6,
  maxFormsPerPage: 5,
  enableJobContextExtraction: true,
  fieldDetectionTimeout: 5000
};

/**
 * Core form detection engine
 */
export class BaseFormDetector {
  private config: FormDetectionConfig;
  private detectionStartTime: number = 0;

  constructor(config: FormDetectionConfig = DEFAULT_DETECTION_CONFIG) {
    this.config = config;
  }

  /**
   * Main entry point for form detection
   */
  async detectForms(document: Document = window.document): Promise<FormDetectionResult> {
    this.detectionStartTime = Date.now();
    const errors: FormDetectionError[] = [];
    const forms: DetectedForm[] = [];

    try {
      // Find all form elements on the page
      const formElements = this.findFormElements(document);
      
      if (formElements.length === 0) {
        return {
          success: true,
          forms: [],
          errors: []
        };
      }

      // Analyze each form
      for (const formElement of formElements.slice(0, this.config.maxFormsPerPage)) {
        try {
          const detectedForm = await this.analyzeForm(formElement, document);
          if (detectedForm && detectedForm.confidence >= this.config.minConfidenceThreshold) {
            forms.push(detectedForm);
          }
        } catch (error) {
          errors.push({
            code: 'FORM_ANALYSIS_ERROR',
            message: `Failed to analyze form: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      return {
        success: true,
        forms,
        errors
      };
    } catch (error) {
      return {
        success: false,
        forms: [],
        errors: [{
          code: 'DETECTION_FAILED',
          message: `Form detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Find all potential form elements on the page
   */
  private findFormElements(document: Document): HTMLElement[] {
    const forms: HTMLElement[] = [];
    
    // Look for actual form elements
    const formTags = document.querySelectorAll('form');
    if (formTags && formTags.length > 0) {
      forms.push(...Array.from(formTags));
    }

    // Look for div containers that might contain form fields (common in SPAs)
    const potentialFormContainers = document.querySelectorAll(
      'div[class*="form"], div[class*="application"], div[class*="apply"], ' +
      'div[id*="form"], div[id*="application"], div[id*="apply"], ' +
      'section[class*="form"], section[class*="application"]'
    );
    
    if (potentialFormContainers && potentialFormContainers.length > 0) {
      for (const container of potentialFormContainers) {
        const inputElements = container.querySelectorAll('input, textarea, select');
        const inputCount = inputElements ? inputElements.length : 0;
        if (inputCount >= 3) { // Minimum threshold for considering it a form
          forms.push(container as HTMLElement);
        }
      }
    }

    return forms;
  }

  /**
   * Analyze a single form element
   */
  private async analyzeForm(formElement: HTMLElement, document: Document): Promise<DetectedForm | null> {
    const formId = this.generateFormId(formElement);
    const fields = this.detectFormFields(formElement);
    
    if (fields.length === 0) {
      return null;
    }

    const platform = this.detectPlatform(document);
    const confidence = this.calculateConfidence(formElement, fields, platform);
    const supportedFeatures = this.determineSupportedFeatures(fields, platform);
    const jobContext = this.config.enableJobContextExtraction 
      ? this.extractJobContext(document) 
      : undefined;

    const isMultiStep = this.detectMultiStepForm(formElement);

    return {
      platform,
      formId,
      url: document.location.href,
      fields,
      jobContext,
      confidence,
      supportedFeatures,
      detectedAt: new Date(),
      isMultiStep,
      currentStep: isMultiStep ? this.getCurrentStep(formElement) : undefined,
      totalSteps: isMultiStep ? this.getTotalSteps(formElement) : undefined
    };
  }

  /**
   * Generate a unique ID for the form
   */
  private generateFormId(formElement: HTMLElement): string {
    const id = formElement.id || formElement.className || 'unknown';
    const timestamp = Date.now();
    return `form_${id}_${timestamp}`.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * Detect and classify form fields
   */
  private detectFormFields(formElement: HTMLElement): FormField[] {
    const fields: FormField[] = [];
    
    try {
      const inputElements = formElement.querySelectorAll(
        'input, textarea, select, button[type="file"]'
      );

      console.log('inputElements:', inputElements, 'type:', typeof inputElements);

      // Defensive check to ensure inputElements is iterable
      if (!inputElements || typeof inputElements.forEach !== 'function') {
        console.log('inputElements is not iterable, returning empty fields');
        return fields;
      }

      inputElements.forEach((element, index) => {
        const field = this.classifyFormField(element as HTMLElement, index);
        if (field) {
          fields.push(field);
        }
      });
    } catch (error) {
      console.log('Error in detectFormFields:', error);
      throw error;
    }

    return fields;
  }

  /**
   * Classify a single form field
   */
  private classifyFormField(element: HTMLElement, index: number): FormField | null {
    const tagName = element.tagName.toLowerCase();
    const type = (element as HTMLInputElement).type?.toLowerCase() || tagName;
    const id = element.id || `field_${index}`;
    const label = this.extractFieldLabel(element);
    const selector = this.generateSelector(element);
    const required = this.isFieldRequired(element);
    const placeholder = (element as HTMLInputElement).placeholder;

    // Skip hidden fields and submit buttons
    if (type === 'hidden' || type === 'submit' || type === 'button') {
      return null;
    }

    const fieldType = this.mapToFieldType(type, element);
    const mappedProfileField = this.mapToProfileField(label, fieldType, placeholder);
    const options = this.extractFieldOptions(element);

    return {
      id,
      type: fieldType,
      label,
      selector,
      required,
      placeholder,
      options,
      mappedProfileField,
      validationRules: this.extractValidationRules(element)
    };
  }

  /**
   * Map HTML input types to our FieldType enum
   */
  private mapToFieldType(htmlType: string, element: HTMLElement): FieldType {
    const typeMap: Record<string, FieldType> = {
      'text': 'text',
      'email': 'email',
      'tel': 'phone',
      'phone': 'phone',
      'textarea': 'textarea',
      'select': 'select',
      'select-one': 'select',
      'select-multiple': 'select',
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
   * Extract field label from various sources
   */
  private extractFieldLabel(element: HTMLElement): string {
    // Try to find associated label
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

    // Look for nearby text nodes or spans
    const previousSibling = element.previousElementSibling;
    if (previousSibling?.textContent) {
      return previousSibling.textContent.trim();
    }

    // Use placeholder or name as fallback
    const placeholder = (element as HTMLInputElement).placeholder;
    const name = (element as HTMLInputElement).name;
    
    return placeholder || name || 'Unknown Field';
  }

  /**
   * Generate a reliable CSS selector for the element
   */
  private generateSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.name) {
      return `[name="${element.name}"]`;
    }

    // Generate a more specific selector based on structure
    const tagName = element.tagName.toLowerCase();
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
    const type = (element as HTMLInputElement).type ? `[type="${(element as HTMLInputElement).type}"]` : '';
    
    return `${tagName}${className}${type}`;
  }

  /**
   * Check if field is required
   */
  private isFieldRequired(element: HTMLElement): boolean {
    const input = element as HTMLInputElement;
    return input.required || 
           input.getAttribute('aria-required') === 'true' ||
           element.classList.contains('required') ||
           !!element.querySelector('.required, [required]');
  }

  /**
   * Extract options for select/radio fields
   */
  private extractFieldOptions(element: HTMLElement): string[] | undefined {
    if (element.tagName.toLowerCase() === 'select') {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.map(option => option.textContent || option.value).filter(Boolean);
    }

    if ((element as HTMLInputElement).type === 'radio') {
      const name = (element as HTMLInputElement).name;
      if (name) {
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        return Array.from(radioGroup).map(radio => {
          const label = this.extractFieldLabel(radio as HTMLElement);
          return label !== 'Unknown Field' ? label : (radio as HTMLInputElement).value;
        });
      }
    }

    return undefined;
  }

  /**
   * Map field to profile data based on label and type
   */
  private mapToProfileField(label: string, type: FieldType, placeholder?: string): string | undefined {
    const text = `${label} ${placeholder || ''}`.toLowerCase();
    
    // Personal information mappings
    if (text.includes('first name') || text.includes('firstname')) return 'personalInfo.firstName';
    if (text.includes('last name') || text.includes('lastname') || text.includes('surname')) return 'personalInfo.lastName';
    if (text.includes('email')) return 'personalInfo.email';
    if (text.includes('phone') || text.includes('mobile') || text.includes('telephone')) return 'personalInfo.phone';
    if (text.includes('address') || text.includes('street')) return 'personalInfo.address';
    if (text.includes('city')) return 'personalInfo.address.city';
    if (text.includes('state') || text.includes('province')) return 'personalInfo.address.state';
    if (text.includes('zip') || text.includes('postal')) return 'personalInfo.address.zipCode';
    if (text.includes('country')) return 'personalInfo.address.country';

    // Professional information mappings
    if (text.includes('resume') || text.includes('cv')) return 'documents.resumes[0]';
    if (text.includes('cover letter')) return 'documents.coverLetters[0]';
    if (text.includes('linkedin') || text.includes('profile url')) return 'professionalInfo.linkedinUrl';
    if (text.includes('portfolio') || text.includes('website')) return 'professionalInfo.portfolioUrl';
    if (text.includes('current company') || text.includes('employer')) return 'professionalInfo.workExperience[0].company';
    if (text.includes('current title') || text.includes('job title')) return 'professionalInfo.workExperience[0].title';
    if (text.includes('university') || text.includes('school') || text.includes('education')) return 'professionalInfo.education[0].institution';
    if (text.includes('degree')) return 'professionalInfo.education[0].degree';
    if (text.includes('major') || text.includes('field of study')) return 'professionalInfo.education[0].fieldOfStudy';
    if (text.includes('graduation') || text.includes('grad date')) return 'professionalInfo.education[0].graduationDate';

    return undefined;
  }

  /**
   * Extract validation rules from element
   */
  private extractValidationRules(element: HTMLElement): any[] {
    const rules: any[] = [];
    const input = element as HTMLInputElement;

    if (input.required) {
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

    if (input.pattern) {
      rules.push({ type: 'pattern', value: input.pattern, message: 'Please match the required format' });
    }

    return rules;
  }

  /**
   * Detect the job platform based on URL and page content
   */
  private detectPlatform(document: Document): JobPlatform {
    const url = document.location.href.toLowerCase();
    const hostname = document.location.hostname.toLowerCase();

    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (url.includes('workday') || document.querySelector('[class*="workday"], [id*="workday"]')) return 'workday';

    return 'custom';
  }

  /**
   * Calculate confidence score for form detection
   */
  private calculateConfidence(formElement: HTMLElement, fields: FormField[], platform: JobPlatform): number {
    let confidence = 0.5; // Base confidence

    // Platform-specific boost
    if (platform !== 'custom') {
      confidence += 0.2;
    }

    // Field count boost
    const fieldCount = fields.length;
    if (fieldCount >= 5) confidence += 0.1;
    if (fieldCount >= 10) confidence += 0.1;

    // Required fields boost
    const requiredFields = fields.filter(f => f.required).length;
    if (requiredFields >= 3) confidence += 0.1;

    // Profile mapping boost
    const mappedFields = fields.filter(f => f.mappedProfileField).length;
    confidence += (mappedFields / fieldCount) * 0.2;

    // Job-related keywords boost
    const formText = formElement.textContent?.toLowerCase() || '';
    const jobKeywords = ['apply', 'application', 'job', 'career', 'position', 'resume', 'cv'];
    const keywordMatches = jobKeywords.filter(keyword => formText.includes(keyword)).length;
    confidence += (keywordMatches / jobKeywords.length) * 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Determine supported autofill features based on detected fields
   */
  private determineSupportedFeatures(fields: FormField[], platform: JobPlatform): AutofillFeature[] {
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

    // Skills are typically in text fields or textareas
    const hasSkillsFields = fields.some(f => 
      f.label.toLowerCase().includes('skill') || 
      f.label.toLowerCase().includes('experience')
    );
    if (hasSkillsFields) features.push('skills');

    // Default answers for common questions
    features.push('default_answers');

    return features;
  }

  /**
   * Extract job context from the page
   */
  private extractJobContext(document: Document): JobContext | undefined {
    try {
      const jobTitle = this.extractJobTitle(document);
      const companyName = this.extractCompanyName(document);
      const jobDescription = this.extractJobDescription(document);

      if (!jobTitle && !companyName) {
        return undefined;
      }

      return {
        jobTitle: jobTitle || 'Unknown Position',
        companyName: companyName || 'Unknown Company',
        jobDescription: jobDescription || '',
        requirements: this.extractRequirements(document),
        location: this.extractLocation(document),
        jobType: this.extractJobType(document)
      };
    } catch (error) {
      console.warn('Failed to extract job context:', error);
      return undefined;
    }
  }

  private extractJobTitle(document: Document): string | undefined {
    const selectors = [
      'h1[class*="job"], h1[class*="title"]',
      '[data-testid*="job-title"]',
      '.job-title, .position-title',
      'h1, h2'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractCompanyName(document: Document): string | undefined {
    const selectors = [
      '[class*="company"], [class*="employer"]',
      '[data-testid*="company"]',
      '.company-name, .employer-name'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractJobDescription(document: Document): string {
    const selectors = [
      '[class*="description"], [class*="job-description"]',
      '[data-testid*="description"]',
      '.description, .job-details'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  private extractRequirements(document: Document): string[] {
    const requirements: string[] = [];
    const text = document.body.textContent?.toLowerCase() || '';
    
    // Look for common requirement patterns
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

    return requirements.slice(0, 10); // Limit to first 10 requirements
  }

  private extractLocation(document: Document): string | undefined {
    const selectors = [
      '[class*="location"], [class*="address"]',
      '[data-testid*="location"]',
      '.location, .job-location'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractJobType(document: Document): JobContext['jobType'] | undefined {
    const text = document.body.textContent?.toLowerCase() || '';
    
    if (text.includes('full time') || text.includes('full-time')) return 'full_time';
    if (text.includes('part time') || text.includes('part-time')) return 'part_time';
    if (text.includes('contract') || text.includes('contractor')) return 'contract';
    if (text.includes('intern') || text.includes('internship')) return 'internship';

    return undefined;
  }

  /**
   * Detect if this is a multi-step form
   */
  private detectMultiStepForm(formElement: HTMLElement): boolean {
    const indicators = [
      '[class*="step"], [class*="page"]',
      '[data-step], [data-page]',
      '.progress, .stepper',
      'button[class*="next"], button[class*="continue"]'
    ];

    return indicators.some(selector => formElement.querySelector(selector) !== null);
  }

  private getCurrentStep(formElement: HTMLElement): number | undefined {
    const stepElement = formElement.querySelector('[data-step], [class*="step-"]');
    if (stepElement) {
      const stepText = stepElement.textContent || stepElement.getAttribute('data-step');
      const stepMatch = stepText?.match(/(\d+)/);
      if (stepMatch) {
        return parseInt(stepMatch[1], 10);
      }
    }
    return 1; // Default to step 1
  }

  private getTotalSteps(formElement: HTMLElement): number | undefined {
    const totalElement = formElement.querySelector('[data-total-steps]');
    if (totalElement) {
      const total = totalElement.getAttribute('data-total-steps');
      if (total) {
        return parseInt(total, 10);
      }
    }

    // Try to count step indicators
    const stepIndicators = formElement.querySelectorAll('[class*="step"], .progress li, .stepper li');
    return stepIndicators.length > 0 ? stepIndicators.length : undefined;
  }
}