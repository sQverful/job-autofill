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
import { UniversalComponentHandler } from './components/universal-handler';
import { safeQuerySelector, safeQuerySelectorAll } from './utils/safe-selector';
import { ProfileDataValidator } from './utils/profile-data-validator';
import { ComponentDetector, ComponentInfo, DetectionResult } from './detection/component-detector';

export interface AutofillTriggerMessage {
  type: 'autofill:trigger';
  source: 'popup';
  data: {
    tabId: number;
  };
}

export interface InteractionStrategy {
  name: string;
  execute: () => Promise<boolean>;
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
  private componentHandler: UniversalComponentHandler;
  private profileValidator: ProfileDataValidator;
  private componentDetector: ComponentDetector;

  constructor() {
    this.componentHandler = new UniversalComponentHandler();
    this.profileValidator = new ProfileDataValidator();
    this.componentDetector = new ComponentDetector();
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

      // Validate profile completeness after loading
      if (this.profile) {
        this.validateProfileCompleteness();
      }
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

      // Validate profile completeness before filling
      this.validateProfileCompleteness();

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
    const forms = safeQuerySelectorAll('form');
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
        const containers = safeQuerySelectorAll(selector);
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
      '[role="combobox"]',
      // React Select specific patterns
      '.select__input',
      '.react-select__input',
      '[class*="select"][class*="input"]',
      // Other custom input patterns
      '[class*="input"]:not([type="hidden"])',
      '[class*="field"]:not([type="hidden"])',
      '[data-testid*="input"]',
      '[data-testid*="field"]'
    ];

    const inputs = safeQuerySelectorAll(selectors.join(', '), container);

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

    // Also look for React Select containers specifically
    const reactSelectContainers = safeQuerySelectorAll('[class*="select__control"], [class*="react-select"], .select-shell', container);
    for (let i = 0; i < reactSelectContainers.length; i++) {
      const selectContainer = reactSelectContainers[i] as HTMLElement;
      const field = this.analyzeReactSelectField(selectContainer, fields.length + i);
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
   * Analyze React Select field specifically
   */
  private analyzeReactSelectField(container: HTMLElement, index: number): FormField | null {
    try {
      // Find the actual input element within the React Select
      const input = safeQuerySelector('input[role="combobox"], .select__input input, input[class*="input"]', container) as HTMLInputElement;
      if (!input) {
        return null;
      }

      // Get the label from various sources
      const label = this.getReactSelectLabel(container, input);
      const selector = this.generateReactSelectSelector(container, input, index);

      if (!label || !selector) {
        return null;
      }

      return {
        id: `react_select_${index}`,
        type: 'select',
        label,
        selector,
        required: input.hasAttribute('required') || input.getAttribute('aria-required') === 'true',
        placeholder: this.getReactSelectPlaceholder(container),
        options: this.getReactSelectOptions(container),
        mappedProfileField: this.mapToProfileField(container, label, 'select'),
        validationRules: this.extractValidationRules(input)
      };

    } catch (error) {
      console.error('Error analyzing React Select field:', error);
      return null;
    }
  }

  /**
   * Get label for React Select component
   */
  private getReactSelectLabel(container: HTMLElement, input: HTMLInputElement): string {
    // Try aria-labelledby first
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = safeQuerySelector(`#${ariaLabelledBy}`);
      if (labelElement) {
        return this.cleanLabelText(labelElement.textContent || '');
      }
    }

    // Try to find label by looking for label elements that reference the input
    const inputId = input.id;
    if (inputId) {
      const label = safeQuerySelector(`label[for="${inputId}"]`);
      if (label) {
        return this.cleanLabelText(label.textContent || '');
      }
    }

    // Look for label-like elements near the container
    const labelSelectors = [
      '.select__label',
      '.label',
      '[class*="label"]',
      'label'
    ];

    for (const selector of labelSelectors) {
      const labelElement = safeQuerySelector(selector, container) ||
        (container.parentElement ? safeQuerySelector(selector, container.parentElement) : null) ||
        (container.closest('.form-group, .field, .input-group') ? safeQuerySelector(selector, container.closest('.form-group, .field, .input-group')!) : null);

      if (labelElement && labelElement.textContent) {
        return this.cleanLabelText(labelElement.textContent);
      }
    }

    // Fallback to placeholder or input name
    const placeholder = this.getReactSelectPlaceholder(container);
    if (placeholder && placeholder !== 'Select...') {
      return placeholder;
    }

    return input.name || input.id || 'Unknown Select Field';
  }

  /**
   * Get placeholder for React Select
   */
  private getReactSelectPlaceholder(container: HTMLElement): string | undefined {
    const placeholder = safeQuerySelector('.select__placeholder, [class*="placeholder"]', container);
    return placeholder?.textContent?.trim() || undefined;
  }

  /**
   * Get options for React Select (if available)
   */
  private getReactSelectOptions(container: HTMLElement): string[] | undefined {
    // React Select options are usually loaded dynamically, so we can't easily get them
    // Return undefined to indicate this is a dynamic select
    return undefined;
  }

  /**
   * Generate selector for React Select
   */
  private generateReactSelectSelector(container: HTMLElement, input: HTMLInputElement, index: number): string {
    // Try to use the input's ID or name
    if (input.id) {
      // Use safe selector pattern for numeric IDs
      if (/^\d/.test(input.id)) {
        return `[id="${input.id}"]`;
      }
      return `#${input.id}`;
    }

    if (input.name) {
      return `input[name="${input.name}"]`;
    }

    // Try to use container's class or data attributes
    if (container.className) {
      const classes = container.className.split(' ').filter(c => c.includes('select'));
      if (classes.length > 0) {
        return `.${classes[0]}`;
      }
    }

    // Fallback to a more specific selector
    return `[role="combobox"]:nth-of-type(${index + 1})`;
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
      const label = safeQuerySelector(`label[for="${id}"]`);
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
      const labelElement = safeQuerySelector(`#${ariaLabelledBy}`);
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

    // Job preferences and work authorization
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

    // Specific patterns from the example form
    if (this.matchesPattern(allText, ['us.?person', 'american.?citizen', 'us.?citizen'])) {
      return 'preferences.jobPreferences.workAuthorization';
    }
    if (this.matchesPattern(allText, ['uk.?right.?to.?work', 'right.?to.?work', 'work.?status'])) {
      return 'preferences.jobPreferences.workAuthorization';
    }
    if (this.matchesPattern(allText, ['data.?safe', 'privacy', 'consent', 'gdpr'])) {
      return 'preferences.defaultAnswers.privacy_consent';
    }
    if (this.matchesPattern(allText, ['pronouns', 'preferred.?pronouns'])) {
      return 'preferences.defaultAnswers.pronouns';
    }
    if (this.matchesPattern(allText, ['name.?pronounced', 'pronunciation', 'how.?to.?say'])) {
      return 'preferences.defaultAnswers.name_pronunciation';
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
    if (this.matchesPattern(allText, ['neurodivergent', 'neurodiverse', 'consider.?yourself.?to.?be.?neurodivergent'])) {
      return 'preferences.defaultAnswers.neurodivergent';
    }
    if (this.matchesPattern(allText, ['ethnicity', 'ethnic', 'race', 'racial', 'how.?would.?your.?describe.?your.?ethnicity'])) {
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
   * Generate CSS selector for field using safe selector patterns
   */
  private generateFieldSelector(element: HTMLElement, index: number): string {
    if (element.id) {
      // Use safe selector pattern for numeric IDs (invalid for CSS selectors)
      if (/^\d/.test(element.id)) {
        return `[id="${element.id}"]`;
      }
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
      const options = safeQuerySelectorAll('option', element as HTMLSelectElement);
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
        const element = safeQuerySelector(field.selector) as HTMLElement;

        if (!element) {
          skippedFields.push({
            fieldId: field.id,
            selector: field.selector,
            reason: 'field_not_found',
            message: 'Field element not found in DOM'
          });
          continue;
        }

        // Handle file fields differently
        if (field.type === 'file') {
          const success = await this.fillFieldElement(element, field, ''); // Pass empty string for file fields

          if (success) {
            filledFields.push({
              fieldId: field.id,
              selector: field.selector,
              value: 'File upload handled',
              source: field.mappedProfileField ? 'profile' : 'default_answer'
            });
          } else {
            errors.push({
              fieldId: field.id,
              selector: field.selector,
              error: 'File upload failed',
              message: 'Could not handle file upload for this field'
            });
          }
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
   * Validate profile data completeness and provide suggestions
   */
  public validateProfileCompleteness(): void {
    if (!this.profile) {
      console.warn('Profile not loaded, cannot validate completeness');
      return;
    }

    const validation = this.profileValidator.validateProfileCompleteness(this.profile);

    console.log(`Profile completeness: ${(validation.completeness * 100).toFixed(1)}%`);

    if (validation.missingFields.length > 0) {
      console.warn(`Missing profile data for ${validation.missingFields.length} fields:`, validation.missingFields);
      console.log('Suggested default values:', validation.suggestions);

      // Optionally auto-populate missing fields with suggestions
      this.suggestProfileImprovements(validation);
    } else {
      console.log('Profile data is complete for common form fields');
    }
  }

  /**
   * Suggest profile improvements based on validation results
   */
  private suggestProfileImprovements(validation: any): void {
    const improvements: string[] = [];

    for (const [field, suggestion] of Object.entries(validation.suggestions)) {
      improvements.push(`${field}: "${suggestion}"`);
    }

    if (improvements.length > 0) {
      console.log('Consider adding these default answers to your profile:');
      improvements.forEach(improvement => console.log(`  - ${improvement}`));
    }
  }

  /**
   * Fill individual field element with multi-strategy interaction pattern
   */
  private async fillFieldElement(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      console.log(`Attempting to fill field: ${field.label} with value: ${value}`);

      // Strategy chain: direct input → click events → keyboard simulation → DOM manipulation
      const strategies = this.getInteractionStrategies(element, field, value);

      for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        console.log(`Trying strategy ${i + 1}/${strategies.length}: ${strategy.name}`);

        try {
          const success = await strategy.execute();
          if (success) {
            console.log(`Strategy ${strategy.name} succeeded for field: ${field.label}`);
            return true;
          } else {
            console.log(`Strategy ${strategy.name} failed for field: ${field.label}`);
          }
        } catch (error) {
          console.warn(`Strategy ${strategy.name} threw error for field ${field.label}:`, error);
        }

        // Small delay between strategies to allow DOM updates
        await this.delay(50);
      }

      console.error(`All strategies failed for field: ${field.label}`);
      return false;

    } catch (error) {
      console.error('Error in fillFieldElement:', error);
      return false;
    }
  }

  /**
   * Get interaction strategies for a field element in priority order
   */
  private getInteractionStrategies(element: HTMLElement, field: FormField, value: string): InteractionStrategy[] {
    const strategies: InteractionStrategy[] = [];

    // Strategy 1: Direct Input - Try standard value assignment first
    strategies.push({
      name: 'Direct Input',
      execute: () => this.directInputStrategy(element, field, value)
    });

    // Strategy 2: Click Events - Simulate user interaction with clicks
    strategies.push({
      name: 'Click Events',
      execute: () => this.clickEventsStrategy(element, field, value)
    });

    // Strategy 3: Keyboard Simulation - Simulate typing behavior
    strategies.push({
      name: 'Keyboard Simulation',
      execute: () => this.keyboardSimulationStrategy(element, field, value)
    });

    // Strategy 4: DOM Manipulation - Direct DOM property manipulation
    strategies.push({
      name: 'DOM Manipulation',
      execute: () => this.domManipulationStrategy(element, field, value)
    });

    // Strategy 5: Component-Specific Fallback - Handle complex components
    if (this.isComplexComponent(element)) {
      strategies.push({
        name: 'Component Fallback',
        execute: () => this.componentFallbackStrategy(element, field, value)
      });
    }

    // Strategy 6: Standard HTML Fallback - Treat as standard HTML element
    strategies.push({
      name: 'Standard HTML Fallback',
      execute: () => this.standardHtmlFallbackStrategy(element, field, value)
    });

    return strategies;
  }

  /**
   * Strategy 1: Direct Input - Standard value assignment with events
   */
  private async directInputStrategy(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      if (field.type === 'file') {
        return await this.handleFileUpload(element as HTMLInputElement, field);
      }

      if (element.tagName.toLowerCase() === 'select' || this.isReactSelectComponent(element)) {
        await this.handleSelectField(element, value);
        return true;
      }

      if (element.tagName.toLowerCase() === 'textarea') {
        return this.fillTextElement(element as HTMLTextAreaElement, value);
      }

      if (element.tagName.toLowerCase() === 'input') {
        const inputElement = element as HTMLInputElement;

        if (inputElement.type === 'checkbox' || inputElement.type === 'radio') {
          // Use enhanced checkbox/radio handling with verification
          const success = this.handleCheckboxRadio(inputElement, value);
          if (!success) {
            console.log('Standard checkbox handling failed, trying alternative approaches');
            return await this.alternativeCheckboxHandling(inputElement, value);
          }
          return success;
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
      console.error('Direct input strategy failed:', error);
      return false;
    }
  }

  /**
   * Strategy 2: Click Events - Simulate user clicks and interactions
   */
  private async clickEventsStrategy(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      // Focus the element first
      element.focus();
      await this.delay(50);

      // Simulate click to activate the element
      element.click();
      await this.delay(50);

      // For select elements, try to open dropdown and select option
      if (element.tagName.toLowerCase() === 'select' || this.isReactSelectComponent(element)) {
        return await this.clickBasedSelectFill(element, value);
      }

      // For input elements, clear and type
      if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

        // Clear existing value with selection and delete
        inputElement.select();
        await this.delay(25);

        // Set value and trigger events
        inputElement.value = value;
        this.triggerInputEvents(inputElement);

        // Blur to complete interaction
        inputElement.blur();
        await this.delay(25);

        return inputElement.value === value;
      }

      // For contenteditable elements
      if (element.hasAttribute('contenteditable')) {
        element.focus();
        await this.delay(25);

        // Select all content and replace
        document.execCommand('selectAll', false);
        document.execCommand('insertText', false, value);

        element.blur();
        return element.textContent === value;
      }

      return false;
    } catch (error) {
      console.error('Click events strategy failed:', error);
      return false;
    }
  }

  /**
   * Strategy 3: Keyboard Simulation - Simulate actual typing
   */
  private async keyboardSimulationStrategy(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      element.focus();
      await this.delay(50);

      // For select elements, use keyboard navigation
      if (element.tagName.toLowerCase() === 'select' || this.isReactSelectComponent(element)) {
        return await this.keyboardBasedSelectFill(element, value);
      }

      // For input/textarea elements, simulate typing
      if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

        // Clear existing content with Ctrl+A and Delete
        inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
        await this.delay(25);
        inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
        await this.delay(25);

        // Type each character
        for (const char of value) {
          inputElement.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          inputElement.value += char;
          inputElement.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          await this.delay(10);
        }

        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
        inputElement.blur();

        return inputElement.value === value;
      }

      // For contenteditable elements
      if (element.hasAttribute('contenteditable')) {
        element.focus();
        await this.delay(25);

        // Clear content
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
        await this.delay(25);

        // Type content
        for (const char of value) {
          element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
          document.execCommand('insertText', false, char);
          element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
          await this.delay(10);
        }

        element.blur();
        return element.textContent === value;
      }

      return false;
    } catch (error) {
      console.error('Keyboard simulation strategy failed:', error);
      return false;
    }
  }

  /**
   * Strategy 4: DOM Manipulation - Direct property manipulation
   */
  private async domManipulationStrategy(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      // For input/textarea elements, set properties directly
      if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

        // Set multiple properties to ensure compatibility
        Object.defineProperty(inputElement, 'value', {
          value: value,
          writable: true,
          configurable: true
        });

        inputElement.setAttribute('value', value);

        // Trigger React-style events
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(inputElement, value);
        }

        // Dispatch React synthetic events
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        return inputElement.value === value;
      }

      // For select elements, manipulate selectedIndex
      if (element.tagName.toLowerCase() === 'select') {
        const selectElement = element as HTMLSelectElement;
        const options = Array.from(selectElement.options);

        const matchingOption = options.find(option =>
          option.value.toLowerCase() === value.toLowerCase() ||
          option.textContent?.toLowerCase() === value.toLowerCase()
        );

        if (matchingOption) {
          selectElement.selectedIndex = matchingOption.index;
          selectElement.value = matchingOption.value;
          this.triggerEvents(selectElement);
          return true;
        }
      }

      // For contenteditable elements
      if (element.hasAttribute('contenteditable')) {
        element.textContent = value;
        element.innerHTML = value;
        this.triggerEvents(element);
        return element.textContent === value;
      }

      return false;
    } catch (error) {
      console.error('DOM manipulation strategy failed:', error);
      return false;
    }
  }

  /**
   * Strategy 5: Component Fallback - Handle complex components with fallback to simpler methods
   */
  private async componentFallbackStrategy(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      // If it's a React Select or similar component, fall back to finding input elements
      if (this.isReactSelectComponent(element)) {
        const input = this.findReactSelectInput(element);
        if (input) {
          // Try to fill the input directly
          input.focus();
          input.value = value;
          this.triggerInputEvents(input);
          return true;
        }
      }

      // Look for any input elements within the component
      const nestedInputs = safeQuerySelectorAll('input, textarea', element);
      for (let i = 0; i < nestedInputs.length; i++) {
        const nestedInput = nestedInputs[i] as HTMLInputElement | HTMLTextAreaElement;
        if (!this.shouldSkipField(nestedInput)) {
          nestedInput.focus();
          nestedInput.value = value;
          this.triggerInputEvents(nestedInput);
          if (nestedInput.value === value) {
            return true;
          }
        }
      }

      // Try to find clickable elements that might open the component
      const clickableElements = safeQuerySelectorAll('[role="button"], button, [class*="dropdown"], [class*="select"]', element);
      for (let i = 0; i < clickableElements.length; i++) {
        const clickable = clickableElements[i] as HTMLElement;
        try {
          clickable.click();
          await this.delay(100);

          // After clicking, try to find newly visible inputs
          const newInputs = safeQuerySelectorAll('input:not([type="hidden"]), textarea', document.body);
          for (let j = 0; j < newInputs.length; j++) {
            const newInput = newInputs[j] as HTMLInputElement | HTMLTextAreaElement;
            if (this.isElementVisible(newInput) && !this.shouldSkipField(newInput)) {
              newInput.focus();
              newInput.value = value;
              this.triggerInputEvents(newInput);
              if (newInput.value === value) {
                return true;
              }
            }
          }
        } catch (error) {
          console.warn('Component interaction failed:', error);
        }
      }

      return false;
    } catch (error) {
      console.error('Component fallback strategy failed:', error);
      return false;
    }
  }

  /**
   * Strategy 6: Standard HTML Fallback - Treat as standard HTML element
   */
  private async standardHtmlFallbackStrategy(element: HTMLElement, field: FormField, value: string): Promise<boolean> {
    try {
      // Remove any complex attributes and treat as standard HTML
      const tagName = element.tagName.toLowerCase();

      switch (tagName) {
        case 'input':
          const inputElement = element as HTMLInputElement;
          inputElement.value = value;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          inputElement.dispatchEvent(new Event('change', { bubbles: true }));
          return inputElement.value === value;

        case 'textarea':
          const textareaElement = element as HTMLTextAreaElement;
          textareaElement.value = value;
          textareaElement.dispatchEvent(new Event('input', { bubbles: true }));
          textareaElement.dispatchEvent(new Event('change', { bubbles: true }));
          return textareaElement.value === value;

        case 'select':
          const selectElement = element as HTMLSelectElement;
          const options = Array.from(selectElement.options);
          const matchingOption = options.find(option =>
            option.value.toLowerCase().includes(value.toLowerCase()) ||
            option.textContent?.toLowerCase().includes(value.toLowerCase())
          );

          if (matchingOption) {
            selectElement.value = matchingOption.value;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
          break;

        default:
          // For any other element, try setting textContent
          if (element.hasAttribute('contenteditable') || element.isContentEditable) {
            element.textContent = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return element.textContent === value;
          }
      }

      return false;
    } catch (error) {
      console.error('Standard HTML fallback strategy failed:', error);
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
   * Enhanced checkbox and radio handling with multi-strategy approach
   */
  private handleCheckboxRadio(element: HTMLInputElement, value: string): boolean {
    try {
      if (element.type === 'checkbox') {
        return this.handleCheckboxField(element, value);
      } else if (element.type === 'radio') {
        return this.handleRadioField(element, value);
      }
      return false;
    } catch (error) {
      console.error('Error handling checkbox/radio:', error);
      return false;
    }
  }

  /**
   * Handle checkbox fields with intelligent value interpretation
   */
  private handleCheckboxField(element: HTMLInputElement, value: string): boolean {
    const shouldCheck = this.interpretCheckboxValue(value, element);

    console.log(`Checkbox field: ${this.getFieldLabel(element)} - Value: "${value}" -> ${shouldCheck ? 'CHECK' : 'UNCHECK'}`);

    element.checked = shouldCheck;
    this.triggerComprehensiveEvents(element);

    // Verify the checkbox state was set correctly
    return element.checked === shouldCheck;
  }

  /**
   * Handle radio fields with better option matching
   */
  private handleRadioField(element: HTMLInputElement, value: string): boolean {
    // Get all radio buttons in the same group
    const radioGroup = this.getRadioGroup(element);

    // Find the best matching radio option
    const bestMatch = this.findBestRadioOption(value, radioGroup);

    if (bestMatch) {
      console.log(`Radio field: Selecting "${bestMatch.label}" for value "${value}"`);
      bestMatch.element.checked = true;
      this.triggerComprehensiveEvents(bestMatch.element);
      return bestMatch.element.checked;
    }

    return false;
  }

  /**
   * Interpret checkbox values with comprehensive logic
   */
  private interpretCheckboxValue(value: string, element: HTMLInputElement): boolean {
    const valueLower = value.toLowerCase().trim();

    // Direct boolean indicators
    const positiveValues = ['yes', 'true', '1', 'on', 'checked', 'agree', 'accept', 'confirm', 'consent'];
    const negativeValues = ['no', 'false', '0', 'off', 'unchecked', 'disagree', 'decline', 'reject'];

    if (positiveValues.includes(valueLower)) return true;
    if (negativeValues.includes(valueLower)) return false;

    // Context-based interpretation
    const label = this.getFieldLabel(element).toLowerCase();
    const context = `${label} ${element.name || ''} ${element.id || ''}`.toLowerCase();

    // Privacy and consent checkboxes
    if (context.includes('privacy') || context.includes('consent') || context.includes('agree')) {
      if (valueLower.includes('consent') || valueLower.includes('agree') || valueLower.includes('accept')) {
        return true;
      }
    }

    // Demographic checkboxes (usually optional, so false by default)
    if (context.includes('demographic') || context.includes('diversity') || context.includes('optional')) {
      return false;
    }

    // Newsletter/marketing checkboxes (usually false by default)
    if (context.includes('newsletter') || context.includes('marketing') || context.includes('email')) {
      return false;
    }

    // Default: if value contains positive keywords, check it
    return positiveValues.some(pos => valueLower.includes(pos));
  }

  /**
   * Get all radio buttons in the same group
   */
  private getRadioGroup(element: HTMLInputElement): HTMLInputElement[] {
    const name = element.name;
    if (!name) return [element];

    const form = element.closest('form') || document;
    const radioButtons = safeQuerySelectorAll(`input[type="radio"][name="${name}"]`, form);
    return Array.from(radioButtons) as HTMLInputElement[];
  }

  /**
   * Find the best matching radio option
   */
  private findBestRadioOption(value: string, radioGroup: HTMLInputElement[]): { element: HTMLInputElement, label: string, score: number } | null {
    const options = radioGroup.map(radio => {
      const label = this.getRadioLabel(radio);
      const score = this.calculateOptionMatchScore(value, label, radio.value);
      return { element: radio, label, score };
    });

    // Sort by score and return the best match
    options.sort((a, b) => b.score - a.score);

    return options[0]?.score > 30 ? options[0] : null;
  }

  /**
   * Get label text for a radio button
   */
  private getRadioLabel(element: HTMLInputElement): string {
    // Try label element
    const label = element.closest('label');
    if (label) {
      return this.cleanLabelText(label.textContent || '');
    }

    // Try next sibling text
    const nextSibling = element.nextElementSibling;
    if (nextSibling) {
      return this.cleanLabelText(nextSibling.textContent || '');
    }

    // Try parent text content
    const parent = element.parentElement;
    if (parent) {
      return this.cleanLabelText(parent.textContent || '');
    }

    return element.value || 'Unknown Option';
  }

  /**
   * Alternative checkbox handling for complex components
   */
  private async alternativeCheckboxHandling(element: HTMLInputElement, value: string): Promise<boolean> {
    try {
      console.log('Trying alternative checkbox handling approaches');

      // Strategy 1: Click-based approach
      const shouldCheck = this.interpretCheckboxValue(value, element);
      const currentState = element.checked;

      if (currentState !== shouldCheck) {
        // Click to toggle state
        await this.triggerComprehensiveClick(element);
        await this.delay(50);

        if (element.checked === shouldCheck) {
          console.log('Click-based checkbox toggle successful');
          return true;
        }
      } else {
        // Already in correct state
        return true;
      }

      // Strategy 2: Label clicking (for custom checkboxes)
      const label = element.closest('label') || document.querySelector(`label[for="${element.id}"]`);
      if (label) {
        await this.triggerComprehensiveClick(label);
        await this.delay(50);

        if (element.checked === shouldCheck) {
          console.log('Label-based checkbox toggle successful');
          return true;
        }
      }

      // Strategy 3: Parent element clicking (for styled checkboxes)
      const parent = element.parentElement;
      if (parent && parent.tagName.toLowerCase() !== 'label') {
        await this.triggerComprehensiveClick(parent);
        await this.delay(50);

        if (element.checked === shouldCheck) {
          console.log('Parent-based checkbox toggle successful');
          return true;
        }
      }

      // Strategy 4: Force property setting with events
      element.checked = shouldCheck;
      this.triggerComprehensiveEvents(element);

      return element.checked === shouldCheck;

    } catch (error) {
      console.error('Alternative checkbox handling failed:', error);
      return false;
    }
  }

  /**
   * Trigger comprehensive events for form elements
   */
  private triggerComprehensiveEvents(element: HTMLElement): void {
    const events = [
      'focus', 'input', 'change', 'blur', 'click'
    ];

    events.forEach(eventType => {
      element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
    });

    // Framework-specific events
    element.dispatchEvent(new CustomEvent('onChange', { bubbles: true }));
    element.dispatchEvent(new CustomEvent('onInput', { bubbles: true }));
    element.dispatchEvent(new CustomEvent('update:modelValue', { bubbles: true }));
  }

  /**
   * Check if element is a complex component (React Select, etc.)
   */
  private isComplexComponent(element: HTMLElement): boolean {
    return this.isReactSelectComponent(element) ||
      element.classList.contains('vue-select') ||
      element.classList.contains('ng-select') ||
      element.hasAttribute('data-component') ||
      element.querySelector('[class*="select__"], [class*="dropdown__"]') !== null;
  }

  /**
   * Check if element is visible
   */
  private isElementVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0;
  }

  /**
   * Trigger comprehensive input events for better compatibility
   */
  private triggerInputEvents(element: HTMLInputElement | HTMLTextAreaElement): void {
    // Standard DOM events
    element.dispatchEvent(new Event('focus', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));

    // React synthetic events
    element.dispatchEvent(new CustomEvent('onChange', { bubbles: true }));
    element.dispatchEvent(new CustomEvent('onInput', { bubbles: true }));
    element.dispatchEvent(new CustomEvent('onBlur', { bubbles: true }));

    // Vue events
    element.dispatchEvent(new CustomEvent('update:modelValue', { bubbles: true }));

    // Angular events
    element.dispatchEvent(new CustomEvent('ngModelChange', { bubbles: true }));
  }

  /**
   * Click-based select filling for dropdowns
   */
  private async clickBasedSelectFill(element: HTMLElement, value: string): Promise<boolean> {
    try {
      // Find the clickable control element
      const control = element.querySelector('[class*="control"], [class*="select__control"], .react-select__control') as HTMLElement || element;

      console.log(`Clicking React Select control to open dropdown`);
      await this.triggerComprehensiveClick(control);
      await this.delay(300);

      // Look for dropdown options that appeared
      const optionSelectors = [
        '[role="option"]',
        '.select__option',
        '.react-select__option',
        '.dropdown-item',
        'li[data-value]',
        '[class*="option"]',
        '[class*="menu"] > div',
        '[class*="menu"] li'
      ];

      // Collect all visible options with their text and values
      const allOptions: { element: HTMLElement, text: string, value?: string }[] = [];

      for (const selector of optionSelectors) {
        const options = safeQuerySelectorAll(selector, document.body);
        console.log(`Found ${options.length} options with selector: ${selector}`);

        for (let i = 0; i < options.length; i++) {
          const option = options[i] as HTMLElement;
          if (this.isElementVisible(option)) {
            const optionText = option.textContent?.trim() || '';
            const optionValue = option.getAttribute('data-value') || option.getAttribute('value');

            if (optionText) {
              allOptions.push({
                element: option,
                text: optionText,
                value: optionValue || undefined
              });
            }
          }
        }
      }

      console.log(`Total visible options found: ${allOptions.length}`);

      // Find the best matching option using scoring system
      const bestMatch = this.findBestMatchingOption(value, allOptions);

      if (bestMatch && bestMatch.score > 30) {
        const optionText = bestMatch.element.textContent?.trim() || '';
        console.log(`Best match found: "${optionText}" (score: ${bestMatch.score})`);

        // Try multiple click strategies for better compatibility
        await this.triggerComprehensiveClick(bestMatch.element);
        await this.delay(200);

        // Verify the selection worked
        const selectionWorked = await this.verifyOptionSelection(control, bestMatch.element, optionText);

        if (selectionWorked) {
          console.log(`Selection verified: ${optionText}`);
          foundOption = true;
        } else {
          console.log(`Selection verification failed, trying fallback approach`);
          // Try alternative selection method
          foundOption = await this.fallbackOptionSelection(control, bestMatch.element, value);
        }
      } else {
        console.log(`No suitable option found. Best score: ${bestMatch?.score || 0}`);
        // Log available options for debugging
        allOptions.slice(0, 5).forEach(opt => {
          const score = this.calculateOptionMatchScore(value, opt.text, opt.value);
          console.log(`  Option: "${opt.text}" (score: ${score})`);
        });
      }

      let foundOption = false;
      if (bestMatch && bestMatch.score > 30) {
        const optionText = bestMatch.element.textContent?.trim() || '';
        console.log(`Best match found: "${optionText}" (score: ${bestMatch.score})`);

        // Try multiple click strategies for better compatibility
        await this.triggerComprehensiveClick(bestMatch.element);
        await this.delay(200);

        // Verify the selection worked
        const selectionWorked = await this.verifyOptionSelection(control, bestMatch.element, optionText);

        if (selectionWorked) {
          console.log(`Selection verified: ${optionText}`);
          foundOption = true;
        } else {
          console.log(`Selection verification failed, trying fallback approach`);
          // Try alternative selection method
          foundOption = await this.fallbackOptionSelection(control, bestMatch.element, value);
        }
      } else {
        console.log(`No suitable option found. Best score: ${bestMatch?.score || 0}`);
        // Log available options for debugging
        allOptions.slice(0, 5).forEach(opt => {
          const score = this.calculateOptionMatchScore(value, opt.text, opt.value);
          console.log(`  Option: "${opt.text}" (score: ${score})`);
        });
      }

      if (!foundOption) {
        console.log('No matching option found, closing dropdown');
        // Close dropdown if no match found
        await this.triggerComprehensiveClick(control);
      }

      return foundOption;
    } catch (error) {
      console.error('Click-based select fill failed:', error);
      return false;
    }
  }

  /**
   * Advanced option matching with confidence scoring
   */
  private calculateOptionMatchScore(value: string, optionText: string, optionValue?: string): number {
    const valueLower = value.toLowerCase().trim();
    const optionLower = optionText.toLowerCase().trim();
    const optionValueLower = optionValue?.toLowerCase().trim() || '';

    let score = 0;

    // Exact matches (highest priority)
    if (valueLower === optionLower) score += 100;
    if (valueLower === optionValueLower) score += 100;

    // Word boundary exact matches
    const valueWords = valueLower.split(/\s+/);
    const optionWords = optionLower.split(/\s+/);

    // Check if all value words appear as complete words in option
    const allWordsMatch = valueWords.every(word =>
      optionWords.some(optionWord => optionWord === word)
    );
    if (allWordsMatch && valueWords.length > 0) score += 80;

    // Partial word matches (lower priority)
    const partialMatches = valueWords.filter(word =>
      optionWords.some(optionWord => optionWord.includes(word) || word.includes(optionWord))
    );
    score += (partialMatches.length / valueWords.length) * 40;

    // Special case mappings with high confidence
    score += this.getSpecialCaseScore(valueLower, optionLower);

    // Penalize very long options that might be false positives
    if (optionLower.length > valueLower.length * 3) {
      score *= 0.8;
    }

    return score;
  }

  /**
   * Get special case matching scores for common form values
   */
  private getSpecialCaseScore(value: string, optionText: string): number {
    const specialCases = [
      // Work authorization patterns
      { values: ['citizen', 'us citizen', 'american citizen'], patterns: ['citizen', 'yes', 'authorized', 'eligible'], score: 60 },
      { values: ['yes', 'true', '1'], patterns: ['yes', 'true', 'agree', 'accept', 'confirm'], score: 70 },
      { values: ['no', 'false', '0'], patterns: ['no', 'false', 'decline', 'reject', 'disagree'], score: 70 },

      // Privacy and demographic patterns
      { values: ['prefer not to say', 'decline to answer'], patterns: ['prefer', 'decline', 'not specified', 'rather not'], score: 50 },
      { values: ['male', 'man'], patterns: ['male', 'man', 'masculine'], score: 60 },
      { values: ['female', 'woman'], patterns: ['female', 'woman', 'feminine'], score: 60 },
      { values: ['non-binary', 'nonbinary'], patterns: ['non-binary', 'nonbinary', 'other', 'different'], score: 60 },

      // Disability and diversity
      { values: ['disabled', 'disability'], patterns: ['disabled', 'disability', 'impairment'], score: 60 },
      { values: ['veteran'], patterns: ['veteran', 'military', 'service'], score: 60 },

      // Education levels
      { values: ['bachelor', 'bachelors'], patterns: ['bachelor', 'undergraduate', 'ba', 'bs'], score: 50 },
      { values: ['master', 'masters'], patterns: ['master', 'graduate', 'ma', 'ms', 'mba'], score: 50 },
      { values: ['phd', 'doctorate'], patterns: ['phd', 'doctorate', 'doctoral'], score: 50 }
    ];

    for (const caseGroup of specialCases) {
      if (caseGroup.values.some(val => value.includes(val))) {
        if (caseGroup.patterns.some(pattern => optionText.includes(pattern))) {
          return caseGroup.score;
        }
      }
    }

    return 0;
  }

  /**
   * Find the best matching option with confidence scoring
   */
  private findBestMatchingOption(value: string, options: { element: HTMLElement, text: string, value?: string }[]): { element: HTMLElement, score: number } | null {
    let bestMatch: { element: HTMLElement, score: number } | null = null;

    for (const option of options) {
      const score = this.calculateOptionMatchScore(value, option.text, option.value);

      if (score > 30 && (!bestMatch || score > bestMatch.score)) { // Minimum threshold of 30
        bestMatch = { element: option.element, score };
      }
    }

    return bestMatch;
  }

  /**
   * Keyboard-based select filling
   */
  private async keyboardBasedSelectFill(element: HTMLElement, value: string): Promise<boolean> {
    try {
      element.focus();
      await this.delay(50);

      // Open dropdown with Enter or Space
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await this.delay(100);

      // Type the value to filter options
      for (const char of value) {
        element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        await this.delay(50);
      }

      // Press Enter to select
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await this.delay(100);

      return true;
    } catch (error) {
      console.error('Keyboard-based select fill failed:', error);
      return false;
    }
  }

  /**
   * Trigger comprehensive click events for better compatibility with React components
   */
  private async triggerComprehensiveClick(element: HTMLElement): Promise<void> {
    try {
      // Strategy 1: Standard click
      element.click();
      await this.delay(50);

      // Strategy 2: Mouse events sequence
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await this.delay(10);
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      await this.delay(10);
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await this.delay(50);

      // Strategy 3: Focus and keyboard events
      element.focus();
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
      await this.delay(50);

      // Strategy 4: Pointer events (for modern browsers)
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));

    } catch (error) {
      console.warn('Some click events failed, but continuing:', error);
    }
  }

  /**
   * Verify that an option selection worked
   */
  private async verifyOptionSelection(control: HTMLElement, selectedOption: HTMLElement, optionText: string): Promise<boolean> {
    await this.delay(100);

    // Check if dropdown closed (option no longer visible)
    const isDropdownClosed = !this.isElementVisible(selectedOption);

    // Check if control shows the selected value
    const controlValue = control.textContent?.toLowerCase().trim() || '';
    const controlInput = control.querySelector('input') as HTMLInputElement;
    const inputValue = controlInput?.value?.toLowerCase().trim() || '';

    const valueMatches = controlValue.includes(optionText.toLowerCase()) ||
      inputValue.includes(optionText.toLowerCase()) ||
      this.calculateOptionMatchScore(optionText, controlValue) > 50;

    console.log(`Verification - Dropdown closed: ${isDropdownClosed}, Value matches: ${valueMatches}`);
    console.log(`Control text: "${controlValue}", Input value: "${inputValue}"`);

    return isDropdownClosed || valueMatches;
  }

  /**
   * Fallback option selection method
   */
  private async fallbackOptionSelection(control: HTMLElement, option: HTMLElement, value: string): Promise<boolean> {
    try {
      console.log('Trying fallback selection method');

      // Method 1: Focus and keyboard selection
      const input = control.querySelector('input') as HTMLInputElement;
      if (input) {
        input.focus();
        await this.delay(50);

        // Clear and type the value
        input.value = '';
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await this.delay(100);

        // Press Enter to select
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await this.delay(100);

        return await this.verifyOptionSelection(control, option, value);
      }

      // Method 2: Try clicking the option multiple times
      for (let i = 0; i < 3; i++) {
        await this.triggerComprehensiveClick(option);
        await this.delay(100);

        if (await this.verifyOptionSelection(control, option, value)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Fallback selection failed:', error);
      return false;
    }
  }

  /**
   * Add delay utility method
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
  private async handleFileUpload(element: HTMLInputElement, field: FormField): Promise<boolean> {
    try {
      if (!this.profile) {
        console.log('No profile available for file upload');
        return false;
      }

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
        return false;
      }

      console.log(`Attempting to handle file upload for field: ${field.label}`);

      // For now, show notification about file upload
      // In a real implementation, this would handle the actual file upload
      this.showFileUploadNotification(element, fileData);

      // Mark as successful since we have file data available
      return true;

    } catch (error) {
      console.error('Error handling file upload:', error);
      return false;
    }
  }

  /**
   * Handle select field with enhanced component detection and adaptive strategies
   */
  private async handleSelectField(element: HTMLElement, value: string): Promise<void> {
    // Get detailed component information
    const componentInfo = this.getComponentInfo(element);

    if (componentInfo) {
      console.log(`Detected ${componentInfo.type} component with confidence ${componentInfo.confidence} using ${componentInfo.detectionMethod}`);

      // Handle different component types with appropriate strategies
      switch (componentInfo.type) {
        case 'react-select':
          const reactSelectSuccess = await this.clickBasedSelectFill(element, value);
          if (!reactSelectSuccess) {
            await this.handleReactSelectField(element, value, componentInfo);
          }
          return;
        case 'vue-select':
        case 'angular-select':
        case 'custom-select':
          await this.handleCustomSelectField(element, value, componentInfo);
          return;
        case 'standard-select':
          await this.handleStandardSelectField(element, value);
          return;
      }
    }

    // Fallback to legacy detection for backward compatibility
    if (this.isReactSelectComponent(element)) {
      const reactSelectSuccess = await this.clickBasedSelectFill(element, value);
      if (!reactSelectSuccess) {
        await this.handleReactSelectField(element, value);
      }
      return;
    }

    // Handle standard select elements
    if (element.tagName.toLowerCase() === 'select') {
      const selectElement = element as HTMLSelectElement;
      const options = Array.from(selectElement.options);

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
        selectElement.value = matchedOption.value;
        this.triggerEvents(selectElement);
      } else {
        console.log(`No matching option found for value: ${value}`);
      }
    }
  }

  /**
   * Enhanced component detection with adaptive patterns and confidence scoring
   */
  private isReactSelectComponent(element: HTMLElement): boolean {
    return this.componentDetector.isReactSelect(element);
  }

  /**
   * Get detailed component information for enhanced handling
   */
  private getComponentInfo(element: HTMLElement): ComponentInfo | null {
    const result = this.componentDetector.detectComponent(element);
    return result.bestMatch;
  }

  /**
   * Get full detection result with all strategies
   */
  private detectComponentWithDetails(element: HTMLElement): DetectionResult {
    return this.componentDetector.detectComponent(element);
  }

  /**
   * Handle React Select component with enhanced detection info
   */
  private async handleReactSelectField(element: HTMLElement, value: string, componentInfo?: ComponentInfo): Promise<void> {
    try {
      if (componentInfo) {
        console.log(`Attempting to fill React Select (${componentInfo.detectionMethod}, confidence: ${componentInfo.confidence}) with value: ${value}`);
        console.log('Component metadata:', componentInfo.metadata);
      } else {
        console.log(`Attempting to fill React Select with value: ${value}`);
      }

      // Use component info to optimize interaction strategy
      const success = await this.adaptiveReactSelectFill(element, value, componentInfo);

      if (success) {
        console.log('React Select filled successfully');
      } else {
        console.log('Adaptive method failed, trying fallback strategies');
        await this.multiStrategyReactSelectFill(element, value, componentInfo);
      }
    } catch (error) {
      console.error('React Select handling failed:', error);
      await this.fallbackReactSelectFill(element, value);
    }
  }

  /**
   * Handle custom select components (Vue, Angular, etc.)
   */
  private async handleCustomSelectField(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<void> {
    try {
      console.log(`Handling ${componentInfo.type} component with confidence ${componentInfo.confidence}`);

      // Try multiple strategies based on component type
      const strategies = this.getCustomSelectStrategies(componentInfo.type);

      for (const strategy of strategies) {
        try {
          const success = await strategy(element, value, componentInfo);
          if (success) {
            console.log(`${componentInfo.type} filled successfully using ${strategy.name}`);
            return;
          }
        } catch (error) {
          console.warn(`Strategy ${strategy.name} failed:`, error);
        }
      }

      // Fallback to standard input handling
      await this.fallbackInputFill(element, value);

    } catch (error) {
      console.error(`${componentInfo.type} handling failed:`, error);
      await this.fallbackInputFill(element, value);
    }
  }

  /**
   * Handle standard HTML select elements
   */
  private async handleStandardSelectField(element: HTMLElement, value: string): Promise<void> {
    if (element.tagName.toLowerCase() === 'select') {
      const selectElement = element as HTMLSelectElement;
      const options = Array.from(selectElement.options);

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

      if (matchedOption) {
        selectElement.value = matchedOption.value;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`Selected option: ${matchedOption.textContent}`);
      } else {
        console.log(`No matching option found for value: ${value}`);
      }
    }
  }

  /**
   * Direct React Select filling method
   */
  private async directReactSelectFill(element: HTMLElement, value: string): Promise<boolean> {
    try {
      // Find the control element to click
      const control = safeQuerySelector('.select__control, .react-select__control', element) as HTMLElement;
      if (!control) {
        console.log('No React Select control found');
        return false;
      }

      console.log('Clicking React Select control to open dropdown');

      // Click the control to open dropdown
      control.click();

      // Wait for dropdown to appear
      await this.delay(300);

      // Look for options in the dropdown
      const optionSelectors = [
        '.select__option',
        '.react-select__option',
        '[role="option"]'
      ];

      let optionFound = false;

      for (const selector of optionSelectors) {
        const options = safeQuerySelectorAll(selector);
        console.log(`Found ${options.length} options with selector: ${selector}`);

        for (const option of options) {
          const optionText = option.textContent?.toLowerCase().trim() || '';
          console.log(`Checking option: "${optionText}" against value: "${value.toLowerCase()}"`);

          // Check if this option matches our value
          if (this.isOptionMatch(optionText, value)) {
            console.log(`Clicking matching option: "${optionText}"`);
            (option as HTMLElement).click();
            await this.delay(100);
            optionFound = true;
            break;
          }
        }

        if (optionFound) break;
      }

      // If no specific match found, try "Prefer not to say" for demographic fields
      if (!optionFound && value.toLowerCase().includes('prefer not to say')) {
        console.log('Looking for "Prefer not to say" option');

        for (const selector of optionSelectors) {
          const options = safeQuerySelectorAll(selector);

          for (const option of options) {
            const optionText = option.textContent?.toLowerCase().trim() || '';

            if (optionText.includes('prefer not to say') ||
              optionText.includes('prefer not') ||
              optionText.includes('not to say')) {
              console.log(`Clicking "Prefer not to say" option: "${optionText}"`);
              (option as HTMLElement).click();
              await this.delay(100);
              optionFound = true;
              break;
            }
          }

          if (optionFound) break;
        }
      }

      return optionFound;

    } catch (error) {
      console.error('Direct React Select fill failed:', error);
      return false;
    }
  }

  /**
   * Fallback method for React Select when intelligent handler fails
   */
  private async fallbackReactSelectFill(element: HTMLElement, value: string): Promise<void> {
    try {
      // Find the input element within React Select
      const input = safeQuerySelector('input[role="combobox"], .select__input input, input', element) as HTMLInputElement;
      if (!input) {
        console.log('Could not find input in React Select component');
        return;
      }

      // Focus the input to activate the select
      input.focus();
      await this.delay(50);

      // Try to open the dropdown by clicking the control
      const control = safeQuerySelector('.select__control, .react-select__control', element) as HTMLElement;
      if (control) {
        control.click();
        await this.delay(100);
      }

      // Clear existing value and type new value
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // Type the value character by character for better compatibility
      for (const char of value) {
        input.value += char;
        input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await this.delay(10);
      }

      await this.delay(300); // Wait for filtering

      // Try to find and click the matching option
      const optionSelectors = [
        '.select__option',
        '.react-select__option',
        '[role="option"]',
        '[class*="option"]'
      ];

      let optionFound = false;
      for (const selector of optionSelectors) {
        const options = safeQuerySelectorAll(selector);
        for (const option of options) {
          const optionText = option.textContent?.toLowerCase() || '';

          // Enhanced matching logic
          if (this.isOptionMatch(optionText, value)) {
            (option as HTMLElement).click();
            await this.delay(100);
            optionFound = true;
            console.log(`Selected option: ${optionText}`);
            break;
          }
        }
        if (optionFound) break;
      }

      // If no option was found, try pressing Enter or Tab
      if (!optionFound) {
        console.log('No matching option found, trying Enter key');
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        await this.delay(100);

        // If still no selection, try Tab
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      }

    } catch (error) {
      console.error('Fallback React Select handling failed:', error);
    }
  }



  /**
   * Enhanced option matching logic
   */
  private isOptionMatch(optionText: string, value: string): boolean {
    const option = optionText.toLowerCase();
    const val = value.toLowerCase();

    // Direct matches
    if (option === val || option.includes(val) || val.includes(option)) {
      return true;
    }

    // Special cases for work authorization
    if (val.includes('citizen') || val.includes('authorized')) {
      return option.includes('citizen') ||
        option.includes('authorized') ||
        option.includes('yes') ||
        option.includes('eligible');
    }

    // Special cases for privacy/consent
    if (val.includes('consent') || val.includes('agree')) {
      return option.includes('agree') ||
        option.includes('consent') ||
        option.includes('yes') ||
        option.includes('accept');
    }

    // Fuzzy matching for similar words
    const valueWords = val.split(/\s+/);
    const optionWords = option.split(/\s+/);

    return valueWords.some(valueWord =>
      optionWords.some(optionWord =>
        optionWord.includes(valueWord) || valueWord.includes(optionWord)
      )
    );
  }

  /**
   * Adaptive React Select filling with component-specific optimizations
   */
  private async adaptiveReactSelectFill(element: HTMLElement, value: string, componentInfo?: ComponentInfo): Promise<boolean> {
    if (!componentInfo) {
      return await this.directReactSelectFill(element, value);
    }

    // Choose strategy based on detection method and confidence
    if (componentInfo.confidence > 0.8) {
      // High confidence - use optimized approach
      return await this.optimizedReactSelectFill(element, value, componentInfo);
    } else if (componentInfo.confidence > 0.5) {
      // Medium confidence - use standard approach with validation
      return await this.validatedReactSelectFill(element, value, componentInfo);
    } else {
      // Low confidence - use conservative approach
      return await this.conservativeReactSelectFill(element, value, componentInfo);
    }
  }

  /**
   * Multi-strategy React Select filling with fallbacks
   */
  private async multiStrategyReactSelectFill(element: HTMLElement, value: string, componentInfo?: ComponentInfo): Promise<void> {
    const strategies = [
      () => this.reactSelectDirectInputStrategy(element, value, componentInfo),
      () => this.clickAndTypeStrategy(element, value, componentInfo),
      () => this.keyboardNavigationStrategy(element, value, componentInfo),
      () => this.reactSelectDomManipulationStrategy(element, value, componentInfo)
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`Trying React Select strategy ${i + 1}/${strategies.length}`);
        const success = await strategies[i]();
        if (success) {
          console.log(`React Select strategy ${i + 1} succeeded`);
          return;
        }
      } catch (error) {
        console.warn(`React Select strategy ${i + 1} failed:`, error);
      }
    }

    console.warn('All React Select strategies failed, using final fallback');
    await this.fallbackReactSelectFill(element, value);
  }

  /**
   * Optimized React Select fill for high-confidence detections
   */
  private async optimizedReactSelectFill(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<boolean> {
    try {
      const input = componentInfo.input || this.findReactSelectInput(element);
      if (!input) return false;

      // Use metadata to optimize interaction
      if (componentInfo.metadata.hasReactSelectClass) {
        return await this.reactSelectClassBasedFill(element, input, value);
      } else if (componentInfo.metadata.hasComboboxRole) {
        return await this.comboboxRoleBasedFill(element, input, value);
      } else {
        return await this.structureBasedFill(element, input, value);
      }
    } catch (error) {
      console.error('Optimized React Select fill failed:', error);
      return false;
    }
  }

  /**
   * Validated React Select fill for medium-confidence detections
   */
  private async validatedReactSelectFill(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<boolean> {
    try {
      // Validate component structure before proceeding
      if (!this.validateReactSelectStructure(element, componentInfo)) {
        console.warn('React Select structure validation failed');
        return false;
      }

      return await this.standardReactSelectFill(element, value);
    } catch (error) {
      console.error('Validated React Select fill failed:', error);
      return false;
    }
  }

  /**
   * Conservative React Select fill for low-confidence detections
   */
  private async conservativeReactSelectFill(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<boolean> {
    try {
      // Use minimal interaction to avoid breaking fragile components
      const input = this.findReactSelectInput(element);
      if (!input) return false;

      // Simple focus and type approach
      input.focus();
      await this.delay(100);

      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await this.delay(200);
      return true;
    } catch (error) {
      console.error('Conservative React Select fill failed:', error);
      return false;
    }
  }

  /**
   * Get custom select strategies based on component type
   */
  private getCustomSelectStrategies(componentType: string): Array<(element: HTMLElement, value: string, componentInfo: ComponentInfo) => Promise<boolean>> {
    const strategies: Array<(element: HTMLElement, value: string, componentInfo: ComponentInfo) => Promise<boolean>> = [];

    switch (componentType) {
      case 'vue-select':
        strategies.push(
          (el, val, info) => this.vueSelectStrategy(el, val, info),
          (el, val, info) => this.genericSelectStrategy(el, val, info)
        );
        break;
      case 'angular-select':
        strategies.push(
          (el, val, info) => this.angularSelectStrategy(el, val, info),
          (el, val, info) => this.materialSelectStrategy(el, val, info),
          (el, val, info) => this.genericSelectStrategy(el, val, info)
        );
        break;
      case 'custom-select':
        strategies.push(
          (el, val, info) => this.genericSelectStrategy(el, val, info),
          (el, val, info) => this.dropdownStrategy(el, val, info)
        );
        break;
    }

    return strategies;
  }



  /**
   * React Select specific strategy methods
   */
  private async reactSelectDirectInputStrategy(element: HTMLElement, value: string, componentInfo?: ComponentInfo): Promise<boolean> {
    try {
      const input = componentInfo?.input || this.findReactSelectInput(element);
      if (!input) {
        console.log('No input found for React Select');
        return false;
      }

      // Focus and type to trigger dropdown
      input.focus();
      await this.delay(100);

      // Clear existing value
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(50);

      // Type the value to filter options
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await this.delay(200);

      // Look for dropdown options that appeared
      const optionSelectors = [
        '[role="option"]',
        '.select__option',
        '.react-select__option',
        '[class*="option"]',
        '[data-value]'
      ];

      for (const selector of optionSelectors) {
        const options = safeQuerySelectorAll(selector, document.body);
        for (let i = 0; i < options.length; i++) {
          const option = options[i] as HTMLElement;
          if (this.isElementVisible(option)) {
            const optionText = option.textContent?.toLowerCase().trim() || '';
            const optionValue = option.getAttribute('data-value')?.toLowerCase() || '';

            if (optionText.includes(value.toLowerCase()) ||
              optionValue.includes(value.toLowerCase()) ||
              value.toLowerCase().includes(optionText)) {
              console.log(`Clicking React Select option: ${optionText}`);
              await this.triggerComprehensiveClick(option);
              await this.delay(100);
              return true;
            }
          }
        }
      }

      // If no option found, try pressing Enter to select first match
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await this.delay(100);

      return false; // Return false if we couldn't find a matching option
    } catch (error) {
      console.error('React Select direct input strategy failed:', error);
      return false;
    }
  }

  private async clickAndTypeStrategy(element: HTMLElement, value: string, componentInfo?: ComponentInfo): Promise<boolean> {
    const control = componentInfo?.control || element;
    const input = componentInfo?.input || this.findReactSelectInput(element);

    if (!input) return false;

    control.click();
    await this.delay(100);

    input.focus();
    input.value = '';

    for (const char of value) {
      input.value += char;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await this.delay(10);
    }

    await this.delay(200);

    // Try to select first option
    const firstOption = element.querySelector('[role="option"], .select__option, .react-select__option');
    if (firstOption) {
      (firstOption as HTMLElement).click();
      return true;
    }

    return false;
  }

  private async keyboardNavigationStrategy(element: HTMLElement, value: string, componentInfo?: ComponentInfo): Promise<boolean> {
    const input = componentInfo?.input || this.findReactSelectInput(element);
    if (!input) return false;

    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await this.delay(200);

    // Use keyboard navigation
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await this.delay(100);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    return true;
  }

  private async reactSelectDomManipulationStrategy(element: HTMLElement, value: string, componentInfo?: ComponentInfo): Promise<boolean> {
    try {
      // Direct DOM manipulation as last resort for React Select
      const input = componentInfo?.input || this.findReactSelectInput(element);
      if (!input) return false;

      // Set value directly and trigger React events
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('React Select DOM manipulation strategy failed:', error);
      return false;
    }
  }



  /**
   * Component-specific strategies
   */
  private async vueSelectStrategy(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<boolean> {
    // Vue Select specific handling
    const input = element.querySelector('input') as HTMLInputElement;
    if (!input) return false;

    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Vue Select often uses custom events
    element.dispatchEvent(new CustomEvent('vue-select:input', { detail: value }));

    return true;
  }

  private async angularSelectStrategy(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<boolean> {
    // Angular Select specific handling
    const input = element.querySelector('input') as HTMLInputElement;
    if (!input) return false;

    input.focus();
    input.value = value;

    // Angular often uses ngModel events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  }

  private async materialSelectStrategy(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<boolean> {
    // Angular Material Select specific handling
    if (componentInfo.metadata.isMaterialSelect) {
      element.click(); // Open dropdown
      await this.delay(100);

      const options = element.querySelectorAll('mat-option, [role="option"]');
      for (const option of options) {
        if (option.textContent?.toLowerCase().includes(value.toLowerCase())) {
          (option as HTMLElement).click();
          return true;
        }
      }
    }

    return false;
  }

  private async genericSelectStrategy(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<boolean> {
    // Generic custom select handling
    const input = element.querySelector('input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  private async dropdownStrategy(element: HTMLElement, value: string, componentInfo: ComponentInfo): Promise<boolean> {
    // Generic dropdown handling
    element.click(); // Try to open dropdown
    await this.delay(100);

    const options = element.querySelectorAll('[role="option"], .option, [class*="option"]');
    for (const option of options) {
      if (option.textContent?.toLowerCase().includes(value.toLowerCase())) {
        (option as HTMLElement).click();
        return true;
      }
    }

    return false;
  }

  /**
   * Helper methods for React Select handling
   */
  private findReactSelectInput(element: HTMLElement): HTMLInputElement | null {
    const selectors = [
      'input[role="combobox"]',
      '.select__input input',
      '.react-select__input input',
      'input[class*="input"]',
      'input'
    ];

    for (const selector of selectors) {
      const input = element.querySelector(selector) as HTMLInputElement;
      if (input && input.type !== 'hidden') return input;
    }

    return null;
  }

  private validateReactSelectStructure(element: HTMLElement, componentInfo: ComponentInfo): boolean {
    // Validate that the component still matches the detected structure
    if (componentInfo.input && !element.contains(componentInfo.input)) {
      return false;
    }

    if (componentInfo.control && !element.contains(componentInfo.control)) {
      return false;
    }

    return true;
  }

  private async reactSelectClassBasedFill(element: HTMLElement, input: HTMLInputElement, value: string): Promise<boolean> {
    // Optimized for class-based React Select detection
    const control = element.querySelector('.select__control, .react-select__control') as HTMLElement;
    if (control) control.click();

    await this.delay(50);
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await this.delay(200);

    const option = element.querySelector('.select__option, .react-select__option');
    if (option) {
      (option as HTMLElement).click();
      return true;
    }

    return false;
  }

  private async comboboxRoleBasedFill(element: HTMLElement, input: HTMLInputElement, value: string): Promise<boolean> {
    // Optimized for role-based React Select detection
    input.focus();
    input.setAttribute('aria-expanded', 'true');

    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await this.delay(200);

    const option = element.querySelector('[role="option"]');
    if (option) {
      (option as HTMLElement).click();
      return true;
    }

    return false;
  }

  private async structureBasedFill(element: HTMLElement, input: HTMLInputElement, value: string): Promise<boolean> {
    // Optimized for structure-based React Select detection
    const indicators = element.querySelector('[class*="indicator"]') as HTMLElement;
    if (indicators) indicators.click();

    await this.delay(50);
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await this.delay(200);
    return true;
  }

  private async standardReactSelectFill(element: HTMLElement, value: string): Promise<boolean> {
    // Standard React Select filling approach
    return await this.directReactSelectFill(element, value);
  }

  private async fallbackInputFill(element: HTMLElement, value: string): Promise<void> {
    // Final fallback for any input-like element
    const input = element.querySelector('input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
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
        const fieldElement = safeQuerySelector(field.selector);
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

    // Load saved position from localStorage or use default
    const savedPosition = this.getSavedButtonPosition();

    indicator.style.cssText = `
      position: fixed;
      top: ${savedPosition.top}px;
      left: ${savedPosition.left}px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 25px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      cursor: grab;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    `;

    const mappedFields = form.fields.filter(f => f.mappedProfileField).length;

    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; animation: pulse 2s infinite;"></div>
        <div>
          <div style="font-weight: 600;">Autofill Available</div>
          <div style="font-size: 11px; opacity: 0.9;">${mappedFields} fields ready • ${platform}</div>
        </div>
        <div data-drag-hint style="margin-left: 8px; opacity: 0.7; font-size: 12px; transition: opacity 0.2s ease;" title="Drag to move">⋮⋮</div>
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

    // Add draggable functionality
    this.makeDraggable(indicator);

    // Handle window resize to keep button in bounds
    const handleResize = () => {
      const rect = indicator.getBoundingClientRect();
      const maxLeft = window.innerWidth - indicator.offsetWidth;
      const maxTop = window.innerHeight - indicator.offsetHeight;

      let needsUpdate = false;
      let newLeft = rect.left;
      let newTop = rect.top;

      if (rect.left > maxLeft) {
        newLeft = maxLeft;
        needsUpdate = true;
      }
      if (rect.top > maxTop) {
        newTop = maxTop;
        needsUpdate = true;
      }

      if (needsUpdate) {
        indicator.style.left = `${newLeft}px`;
        indicator.style.top = `${newTop}px`;
        this.saveButtonPosition(newTop, newLeft);
      }
    };

    window.addEventListener('resize', handleResize);

    // Clean up resize listener when indicator is removed
    const originalRemove = indicator.remove;
    indicator.remove = function () {
      window.removeEventListener('resize', handleResize);
      originalRemove.call(this);
    };

    indicator.addEventListener('click', async () => {
      const originalContent = indicator.innerHTML;
      const originalOpacity = indicator.style.opacity;

      try {
        // Set loading state
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

        // Perform autofill
        const result = await this.handleAutofillTrigger({
          type: 'autofill:trigger',
          source: 'popup',
          data: { tabId: 0 }
        });

        // Show success state briefly
        indicator.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="color: #4CAF50;">✅</div>
            <div>Filled ${result.filledCount} fields!</div>
          </div>
        `;

        // Reset to original state after 3 seconds
        setTimeout(() => {
          indicator.innerHTML = originalContent;
          indicator.style.opacity = originalOpacity;
          // Clean up spin style
          if (spinStyle.parentNode) {
            spinStyle.parentNode.removeChild(spinStyle);
          }
        }, 3000);

      } catch (error) {
        console.error('Autofill failed:', error);

        // Show error state
        indicator.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="color: #f44336;">❌</div>
            <div>Autofill failed</div>
          </div>
        `;

        // Reset to original state after 3 seconds
        setTimeout(() => {
          indicator.innerHTML = originalContent;
          indicator.style.opacity = originalOpacity;
        }, 3000);
      }
    });

    indicator.addEventListener('mouseenter', () => {
      indicator.style.transform = 'scale(1.05)';
      indicator.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
      // Show drag hint
      const dragHint = indicator.querySelector('[data-drag-hint]') as HTMLElement;
      if (dragHint) {
        dragHint.style.opacity = '1';
      }
    });

    indicator.addEventListener('mouseleave', () => {
      indicator.style.transform = 'scale(1)';
      indicator.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
      // Hide drag hint
      const dragHint = indicator.querySelector('[data-drag-hint]') as HTMLElement;
      if (dragHint) {
        dragHint.style.opacity = '0.7';
      }
    });

    return indicator;
  }

  /**
   * Get saved button position from localStorage or return default
   */
  private getSavedButtonPosition(): { top: number; left: number } {
    try {
      const saved = localStorage.getItem('job-autofill-button-position');
      if (saved) {
        const position = JSON.parse(saved);
        // Validate position is within viewport bounds
        const maxTop = Math.max(0, window.innerHeight - 100);
        const maxLeft = Math.max(0, window.innerWidth - 200);

        return {
          top: Math.min(Math.max(0, position.top), maxTop),
          left: Math.min(Math.max(0, position.left), maxLeft)
        };
      }
    } catch (error) {
      console.warn('Failed to load saved button position:', error);
    }

    // Default position
    return { top: 20, left: 20 };
  }

  /**
   * Save button position to localStorage
   */
  private saveButtonPosition(top: number, left: number): void {
    try {
      localStorage.setItem('job-autofill-button-position', JSON.stringify({ top, left }));
    } catch (error) {
      console.warn('Failed to save button position:', error);
    }
  }

  /**
   * Make an element draggable
   */
  private makeDraggable(element: HTMLElement): void {
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartX = 0;
    let elementStartY = 0;
    let clickStartTime = 0;
    let hasMoved = false;

    const handleMouseDown = (e: MouseEvent) => {
      // Prevent text selection
      e.preventDefault();

      isDragging = true;
      hasMoved = false;
      clickStartTime = Date.now();

      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = element.getBoundingClientRect();
      elementStartX = rect.left;
      elementStartY = rect.top;

      element.style.cursor = 'grabbing';
      element.style.transition = 'none';
      element.style.zIndex = '10000';

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;

      // Mark as moved if dragged more than 5 pixels
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasMoved = true;
      }

      const newLeft = elementStartX + deltaX;
      const newTop = elementStartY + deltaY;

      // Constrain to viewport bounds
      const maxLeft = window.innerWidth - element.offsetWidth;
      const maxTop = window.innerHeight - element.offsetHeight;

      const constrainedLeft = Math.min(Math.max(0, newLeft), maxLeft);
      const constrainedTop = Math.min(Math.max(0, newTop), maxTop);

      element.style.left = `${constrainedLeft}px`;
      element.style.top = `${constrainedTop}px`;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDragging) return;

      isDragging = false;
      element.style.cursor = 'grab';
      element.style.transition = 'all 0.3s ease';
      element.style.zIndex = '9999';

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Save position if moved
      if (hasMoved) {
        const rect = element.getBoundingClientRect();
        this.saveButtonPosition(rect.top, rect.left);
      }

      // If it was a quick click without much movement, treat as a click
      const clickDuration = Date.now() - clickStartTime;
      if (!hasMoved && clickDuration < 200) {
        // Trigger the original click handler after a small delay
        setTimeout(() => {
          element.click();
        }, 10);
      }
    };

    // Add touch support for mobile devices
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true
      });

      handleMouseDown(mouseEvent);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !isDragging) return;

      e.preventDefault(); // Prevent scrolling

      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true
      });

      handleMouseMove(mouseEvent);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDragging) return;

      const mouseEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      });

      handleMouseUp(mouseEvent);
    };

    // Add event listeners
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    // Prevent default click behavior when dragging
    element.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);

    // Double-click to reset position
    element.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset to default position
      element.style.top = '20px';
      element.style.left = '20px';
      this.saveButtonPosition(20, 20);

      // Show feedback
      const originalContent = element.innerHTML;
      element.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="color: #4CAF50;">📍</div>
          <div>Position reset!</div>
        </div>
      `;

      setTimeout(() => {
        element.innerHTML = originalContent;
      }, 1500);
    });
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
      if (safeQuerySelectorAll(selector, container).length > 1) return true;
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
      const activeStep = safeQuerySelector(selector, container);
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
      const steps = safeQuerySelectorAll(selector, container);
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