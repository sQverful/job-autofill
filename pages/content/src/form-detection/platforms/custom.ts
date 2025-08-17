/**
 * Custom/fallback form detection module
 * Handles unknown job platforms and generic application forms
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

export interface CustomFormPatterns {
  jobKeywords: string[];
  applicationKeywords: string[];
  formSelectors: string[];
  fieldSelectors: string[];
  submitSelectors: string[];
  fileUploadSelectors: string[];
}

export const CUSTOM_FORM_PATTERNS: CustomFormPatterns = {
  jobKeywords: [
    'job', 'career', 'position', 'role', 'employment', 'hiring', 'recruit',
    'application', 'apply', 'candidate', 'opportunity', 'opening'
  ],
  applicationKeywords: [
    'apply', 'application', 'submit', 'candidate', 'applicant',
    'resume', 'cv', 'cover letter', 'personal information'
  ],
  formSelectors: [
    'form[class*="job"], form[class*="career"], form[class*="apply"]',
    'form[id*="job"], form[id*="career"], form[id*="apply"]',
    'div[class*="application"], div[class*="apply"], div[class*="job-form"]',
    'section[class*="application"], section[class*="apply"]',
    '.application-form, .job-application, .career-form, .apply-form'
  ],
  fieldSelectors: [
    'input[type="text"], input[type="email"], input[type="tel"]',
    'textarea', 'select',
    'input[type="checkbox"], input[type="radio"]',
    'input[type="file"]'
  ],
  submitSelectors: [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:contains("submit"), button:contains("apply"), button:contains("send")',
    '[class*="submit"], [class*="apply"], [id*="submit"], [id*="apply"]'
  ],
  fileUploadSelectors: [
    'input[type="file"]',
    '[class*="upload"], [class*="file"], [class*="resume"], [class*="cv"]',
    '[id*="upload"], [id*="file"], [id*="resume"], [id*="cv"]'
  ]
};

/**
 * Custom/fallback form detector for unknown platforms
 */
export class CustomFormDetector extends BaseFormDetector {
  private confidenceScorer: ConfidenceScorer;
  private patterns: CustomFormPatterns;

  constructor(patterns: CustomFormPatterns = CUSTOM_FORM_PATTERNS) {
    super({
      minConfidenceThreshold: 0.5, // Lower threshold for custom forms
      maxFormsPerPage: 10,
      enableJobContextExtraction: true,
      fieldDetectionTimeout: 5000
    });
    this.confidenceScorer = new ConfidenceScorer();
    this.patterns = patterns;
  }

  /**
   * Detect custom/unknown platform forms
   */
  async detectCustomForms(document: Document = window.document): Promise<FormDetectionResult> {
    try {
      const forms: DetectedForm[] = [];
      
      // Check if this looks like a job-related page
      if (!this.isJobRelatedPage(document)) {
        return {
          success: true,
          forms: [],
          errors: []
        };
      }

      // Look for forms using various selectors
      const potentialForms = this.findPotentialForms(document);
      
      for (const formElement of potentialForms) {
        const detectedForm = await this.analyzeCustomForm(formElement, document);
        if (detectedForm) {
          forms.push(detectedForm);
        }
      }

      return {
        success: true,
        forms,
        errors: [],
        platformSpecificData: {
          isJobRelated: this.isJobRelatedPage(document),
          detectedPatterns: this.getDetectedPatterns(document),
          confidence: this.calculatePageConfidence(document)
        }
      };
    } catch (error) {
      return {
        success: false,
        forms: [],
        errors: [{
          code: 'CUSTOM_DETECTION_ERROR',
          message: `Custom form detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Check if page appears to be job-related
   */
  private isJobRelatedPage(document: Document): boolean {
    const url = document.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = document.body.textContent?.toLowerCase() || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content')?.toLowerCase() || '';
    
    const combinedText = `${url} ${title} ${bodyText} ${metaDescription}`;
    
    // Check for job-related keywords
    const jobKeywordMatches = this.patterns.jobKeywords.filter(keyword => 
      combinedText.includes(keyword)
    ).length;
    
    // Check for application-related keywords
    const applicationKeywordMatches = this.patterns.applicationKeywords.filter(keyword => 
      combinedText.includes(keyword)
    ).length;
    
    // Require at least 2 job keywords or 1 job + 1 application keyword
    return jobKeywordMatches >= 2 || (jobKeywordMatches >= 1 && applicationKeywordMatches >= 1);
  }

  /**
   * Find potential form elements
   */
  private findPotentialForms(document: Document): HTMLElement[] {
    const forms: HTMLElement[] = [];
    const foundElements = new Set<HTMLElement>();
    
    // Try each form selector pattern
    for (const selector of this.patterns.formSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (!foundElements.has(element as HTMLElement)) {
            foundElements.add(element as HTMLElement);
            forms.push(element as HTMLElement);
          }
        });
      } catch (error) {
        // Skip invalid selectors
        console.warn(`Invalid selector: ${selector}`, error);
      }
    }
    
    // If no forms found with specific selectors, look for containers with form fields
    if (forms.length === 0) {
      const containers = document.querySelectorAll('div, section, main, article');
      for (const container of containers) {
        const fieldCount = container.querySelectorAll(this.patterns.fieldSelectors.join(', ')).length;
        if (fieldCount >= 3) { // Minimum threshold for considering it a form
          forms.push(container as HTMLElement);
        }
      }
    }
    
    return forms;
  }

  /**
   * Analyze a custom form element
   */
  private async analyzeCustomForm(formElement: HTMLElement, document: Document): Promise<DetectedForm | null> {
    const fields = this.detectCustomFields(formElement);
    
    if (fields.length === 0) {
      return null;
    }

    const formId = `custom_form_${Date.now()}`;
    const confidence = this.calculateCustomFormConfidence(formElement, fields, document);
    const supportedFeatures = this.getCustomSupportedFeatures(fields);
    const jobContext = this.extractCustomJobContext(document);
    const isMultiStep = this.isCustomMultiStep(formElement);

    return {
      platform: 'custom',
      formId,
      url: document.location.href,
      fields,
      jobContext,
      confidence,
      supportedFeatures,
      detectedAt: new Date(),
      isMultiStep,
      currentStep: isMultiStep ? this.getCustomCurrentStep(formElement) : undefined,
      totalSteps: isMultiStep ? this.getCustomTotalSteps(formElement) : undefined
    };
  }

  /**
   * Detect form fields in custom forms
   */
  private detectCustomFields(formElement: HTMLElement): FormField[] {
    const fields: FormField[] = [];

    try {
      // Get all potential form fields
      const fieldElements = formElement.querySelectorAll(this.patterns.fieldSelectors.join(', '));
      
      fieldElements.forEach((element, index) => {
        const field = this.createCustomField(element as HTMLElement, index);
        if (field) {
          fields.push(field);
        }
      });

    } catch (error) {
      console.warn('Error detecting custom fields:', error);
    }

    return fields;
  }

  /**
   * Create a custom form field
   */
  private createCustomField(element: HTMLElement, index: number): FormField | null {
    const input = element as HTMLInputElement;
    const tagName = element.tagName.toLowerCase();
    const type = input.type?.toLowerCase() || tagName;
    
    // Skip hidden fields and buttons
    if (type === 'hidden' || type === 'submit' || type === 'button') {
      return null;
    }

    const id = element.id || `custom_field_${index}`;
    const label = this.extractCustomFieldLabel(element);
    const selector = this.generateCustomSelector(element);
    const required = this.isCustomFieldRequired(element);
    const placeholder = input.placeholder;

    const mappedFieldType = this.mapCustomFieldType(type, element);
    const mappedProfileField = this.mapCustomProfileField(label, mappedFieldType, placeholder);
    const options = this.extractCustomFieldOptions(element);

    return {
      id,
      type: mappedFieldType,
      label,
      selector,
      required,
      placeholder,
      options,
      mappedProfileField,
      validationRules: this.extractCustomValidationRules(element)
    };
  }

  /**
   * Extract field label for custom forms
   */
  private extractCustomFieldLabel(element: HTMLElement): string {
    // Try multiple strategies to find labels
    
    // 1. Associated label element
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label?.textContent?.trim()) {
        return label.textContent.trim();
      }
    }

    // 2. Parent label
    const parentLabel = element.closest('label');
    if (parentLabel?.textContent) {
      return parentLabel.textContent.replace((element as HTMLInputElement).value || '', '').trim();
    }

    // 3. Previous sibling text
    let previousElement = element.previousElementSibling;
    while (previousElement) {
      if (previousElement.textContent?.trim()) {
        const text = previousElement.textContent.trim();
        if (text.length > 0 && text.length < 100) { // Reasonable label length
          return text;
        }
      }
      previousElement = previousElement.previousElementSibling;
    }

    // 4. Parent element text (excluding input value)
    const parent = element.parentElement;
    if (parent) {
      const parentText = parent.textContent || '';
      const inputValue = (element as HTMLInputElement).value || '';
      const labelText = parentText.replace(inputValue, '').trim();
      if (labelText && labelText.length < 100) {
        return labelText;
      }
    }

    // 5. Aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel?.trim()) {
      return ariaLabel.trim();
    }

    // 6. Placeholder as fallback
    const placeholder = (element as HTMLInputElement).placeholder;
    if (placeholder?.trim()) {
      return placeholder.trim();
    }

    // 7. Name attribute as last resort
    const name = (element as HTMLInputElement).name;
    if (name) {
      // Convert camelCase or snake_case to readable text
      return name
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .trim();
    }

    return 'Custom Field';
  }

  /**
   * Generate selector for custom form fields
   */
  private generateCustomSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if ((element as HTMLInputElement).name) {
      return `[name="${(element as HTMLInputElement).name}"]`;
    }

    // Generate a more specific selector
    const tagName = element.tagName.toLowerCase();
    const type = (element as HTMLInputElement).type;
    const className = element.className;
    
    let selector = tagName;
    
    if (type) {
      selector += `[type="${type}"]`;
    }
    
    if (className) {
      const classes = className.split(' ').filter(cls => cls.length > 0);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    
    return selector;
  }

  /**
   * Check if custom field is required
   */
  private isCustomFieldRequired(element: HTMLElement): boolean {
    const input = element as HTMLInputElement;
    
    // Standard required attribute
    if (input.required || input.getAttribute('aria-required') === 'true') {
      return true;
    }

    // Check for required class
    if (element.classList.contains('required')) {
      return true;
    }

    // Check for asterisk in nearby text
    const label = this.extractCustomFieldLabel(element);
    if (label.includes('*') || label.toLowerCase().includes('required')) {
      return true;
    }

    // Check parent element for required indicators
    const parent = element.parentElement;
    if (parent) {
      const parentText = parent.textContent?.toLowerCase() || '';
      if (parentText.includes('required') || parentText.includes('*')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Map custom field types
   */
  private mapCustomFieldType(htmlType: string, element: HTMLElement): any {
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
   * Map custom fields to profile data
   */
  private mapCustomProfileField(label: string, type: any, placeholder?: string): string | undefined {
    const text = `${label} ${placeholder || ''}`.toLowerCase();
    
    // Personal information mappings
    if (text.includes('first name') || text.includes('given name')) return 'personalInfo.firstName';
    if (text.includes('last name') || text.includes('family name') || text.includes('surname')) return 'personalInfo.lastName';
    if (text.includes('full name') && !text.includes('first') && !text.includes('last')) return 'personalInfo.fullName';
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

    // Common application questions
    if (text.includes('work authorization') || text.includes('authorized to work')) return 'preferences.defaultAnswers.workAuthorization';
    if (text.includes('sponsorship') || text.includes('visa sponsorship')) return 'preferences.defaultAnswers.sponsorship';
    if (text.includes('start date') || text.includes('available to start')) return 'preferences.defaultAnswers.startDate';
    if (text.includes('salary') || text.includes('compensation')) return 'preferences.defaultAnswers.salaryExpectation';
    if (text.includes('notice period') || text.includes('availability')) return 'preferences.defaultAnswers.noticePeriod';

    return undefined;
  }

  /**
   * Extract options for custom select/radio fields
   */
  private extractCustomFieldOptions(element: HTMLElement): string[] | undefined {
    if (element.tagName.toLowerCase() === 'select') {
      const options = Array.from((element as HTMLSelectElement).options);
      return options.map(option => option.textContent || option.value).filter(Boolean);
    }

    if ((element as HTMLInputElement).type === 'radio') {
      const name = (element as HTMLInputElement).name;
      if (name) {
        const radioGroup = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        return Array.from(radioGroup).map(radio => {
          const label = this.extractCustomFieldLabel(radio as HTMLElement);
          return label !== 'Custom Field' ? label : (radio as HTMLInputElement).value;
        });
      }
    }

    return undefined;
  }

  /**
   * Extract validation rules for custom fields
   */
  private extractCustomValidationRules(element: HTMLElement): any[] {
    const rules: any[] = [];
    const input = element as HTMLInputElement;

    if (this.isCustomFieldRequired(element)) {
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
   * Calculate confidence for custom forms
   */
  private calculateCustomFormConfidence(formElement: HTMLElement, fields: FormField[], document: Document): number {
    let confidence = 0.3; // Lower base confidence for custom forms

    // Page-level job relevance boost
    const pageConfidence = this.calculatePageConfidence(document);
    confidence += pageConfidence * 0.3;

    // Field count and quality
    const fieldCount = fields.length;
    if (fieldCount >= 5) confidence += 0.2;
    if (fieldCount >= 10) confidence += 0.1;

    // Profile mapping boost
    const mappedFields = fields.filter(f => f.mappedProfileField).length;
    if (fieldCount > 0) {
      confidence += (mappedFields / fieldCount) * 0.2;
    }

    // Form structure indicators
    const hasSubmitButton = formElement.querySelector(this.patterns.submitSelectors.join(', '));
    if (hasSubmitButton) confidence += 0.1;

    const hasFileUpload = formElement.querySelector(this.patterns.fileUploadSelectors.join(', '));
    if (hasFileUpload) confidence += 0.1;

    // Required fields boost
    const requiredFields = fields.filter(f => f.required).length;
    if (requiredFields >= 2) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate page-level confidence for job relevance
   */
  private calculatePageConfidence(document: Document): number {
    const url = document.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const bodyText = document.body.textContent?.toLowerCase() || '';
    const combinedText = `${url} ${title} ${bodyText}`;

    let confidence = 0;

    // Job keyword density
    const jobKeywordMatches = this.patterns.jobKeywords.filter(keyword => 
      combinedText.includes(keyword)
    ).length;
    confidence += Math.min(jobKeywordMatches / this.patterns.jobKeywords.length, 0.5);

    // Application keyword density
    const applicationKeywordMatches = this.patterns.applicationKeywords.filter(keyword => 
      combinedText.includes(keyword)
    ).length;
    confidence += Math.min(applicationKeywordMatches / this.patterns.applicationKeywords.length, 0.3);

    // URL indicators
    if (url.includes('career') || url.includes('job') || url.includes('apply')) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Get supported features for custom forms
   */
  private getCustomSupportedFeatures(fields: FormField[]): AutofillFeature[] {
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

    // Skills might be present
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
   * Extract job context from custom pages
   */
  private extractCustomJobContext(document: Document): JobContext | undefined {
    try {
      const jobTitle = this.extractCustomJobTitle(document);
      const companyName = this.extractCustomCompanyName(document);
      const jobDescription = this.extractCustomJobDescription(document);

      if (!jobTitle && !companyName) {
        return undefined;
      }

      return {
        jobTitle: jobTitle || 'Position',
        companyName: companyName || 'Company',
        jobDescription: jobDescription || '',
        requirements: this.extractCustomRequirements(document),
        location: this.extractCustomLocation(document),
        jobType: this.extractCustomJobType(document)
      };
    } catch (error) {
      console.warn('Failed to extract custom job context:', error);
      return undefined;
    }
  }

  private extractCustomJobTitle(document: Document): string | undefined {
    // Try various selectors for job titles
    const selectors = [
      'h1', 'h2', '.job-title', '.position-title', '.title',
      '[class*="job"], [class*="title"], [class*="position"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && text.length > 5 && text.length < 100) {
          // Check if it looks like a job title
          const lowerText = text.toLowerCase();
          if (this.patterns.jobKeywords.some(keyword => lowerText.includes(keyword))) {
            return text;
          }
        }
      }
    }

    return undefined;
  }

  private extractCustomCompanyName(document: Document): string | undefined {
    // Try various selectors for company names
    const selectors = [
      '.company', '.employer', '.organization',
      '[class*="company"], [class*="employer"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    // Try to extract from page title or URL
    const title = document.title;
    const url = document.location.hostname;
    
    // Simple heuristic: if title contains " - " or " | ", company might be after separator
    const separators = [' - ', ' | ', ' at '];
    for (const separator of separators) {
      if (title.includes(separator)) {
        const parts = title.split(separator);
        if (parts.length > 1) {
          return parts[parts.length - 1].trim();
        }
      }
    }

    return undefined;
  }

  private extractCustomJobDescription(document: Document): string {
    const selectors = [
      '.description', '.job-description', '.content',
      '[class*="description"], [class*="content"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return '';
  }

  private extractCustomRequirements(document: Document): string[] {
    const requirements: string[] = [];
    const text = document.body.textContent?.toLowerCase() || '';
    
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

    return requirements.slice(0, 10);
  }

  private extractCustomLocation(document: Document): string | undefined {
    const selectors = [
      '.location', '.address', '[class*="location"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent?.trim()) {
        return element.textContent.trim();
      }
    }

    return undefined;
  }

  private extractCustomJobType(document: Document): JobContext['jobType'] | undefined {
    const text = document.body.textContent?.toLowerCase() || '';
    
    if (text.includes('full time') || text.includes('full-time')) return 'full_time';
    if (text.includes('part time') || text.includes('part-time')) return 'part_time';
    if (text.includes('contract') || text.includes('contractor')) return 'contract';
    if (text.includes('intern') || text.includes('internship')) return 'internship';

    return undefined;
  }

  /**
   * Check if custom form is multi-step
   */
  private isCustomMultiStep(formElement: HTMLElement): boolean {
    const indicators = [
      'button:contains("next"), button:contains("continue")',
      '.step, .page, [class*="step"], [class*="page"]',
      '.progress, .stepper, [class*="progress"]'
    ];

    return indicators.some(selector => {
      try {
        return formElement.querySelector(selector) !== null;
      } catch {
        return false;
      }
    });
  }

  private getCustomCurrentStep(formElement: HTMLElement): number {
    const stepElements = formElement.querySelectorAll('.step, [class*="step"], [data-step]');
    for (const element of stepElements) {
      if (element.classList.contains('current') || element.classList.contains('active')) {
        const stepText = element.textContent || element.getAttribute('data-step');
        const stepMatch = stepText?.match(/(\d+)/);
        if (stepMatch) {
          return parseInt(stepMatch[1], 10);
        }
      }
    }
    return 1;
  }

  private getCustomTotalSteps(formElement: HTMLElement): number | undefined {
    const stepElements = formElement.querySelectorAll('.step, [class*="step"], [data-step]');
    return stepElements.length > 0 ? stepElements.length : undefined;
  }

  /**
   * Get detected patterns for debugging
   */
  private getDetectedPatterns(document: Document): string[] {
    const patterns: string[] = [];
    const text = document.body.textContent?.toLowerCase() || '';
    const url = document.location.href.toLowerCase();

    // Check which patterns were detected
    this.patterns.jobKeywords.forEach(keyword => {
      if (text.includes(keyword) || url.includes(keyword)) {
        patterns.push(`job_keyword:${keyword}`);
      }
    });

    this.patterns.applicationKeywords.forEach(keyword => {
      if (text.includes(keyword) || url.includes(keyword)) {
        patterns.push(`application_keyword:${keyword}`);
      }
    });

    return patterns;
  }
}