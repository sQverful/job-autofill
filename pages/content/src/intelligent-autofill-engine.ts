/**
 * Intelligent Autofill Engine
 * Integrates all intelligent detection and handling components
 */

import { IntelligentDetector } from './detection/intelligent-detector';
import { UniversalComponentHandler } from './components/universal-handler';
import { SmartFileUploader } from './upload/smart-uploader';
import { DynamicFormMonitor } from './monitoring/dynamic-form-monitor';
import type { DetectedForm, FormField, AutofillResult, UserProfile } from '@extension/shared';
import { safeQuerySelector } from './utils/safe-selector';

export interface IntelligentAutofillOptions {
  enableLearning: boolean;
  enableFileUpload: boolean;
  enableDynamicMonitoring: boolean;
  maxRetries: number;
  retryDelay: number;
}

export interface AutofillProgress {
  totalFields: number;
  filledFields: number;
  skippedFields: number;
  errorFields: number;
  currentField?: string;
  status: 'starting' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Main intelligent autofill engine that coordinates all components
 */
export class IntelligentAutofillEngine {
  private detector: IntelligentDetector;
  private componentHandler: UniversalComponentHandler;
  private fileUploader: SmartFileUploader;
  private formMonitor: DynamicFormMonitor;
  private options: IntelligentAutofillOptions;
  private progressCallback?: (progress: AutofillProgress) => void;

  constructor(options: Partial<IntelligentAutofillOptions> = {}) {
    this.options = {
      enableLearning: true,
      enableFileUpload: true,
      enableDynamicMonitoring: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };

    this.detector = new IntelligentDetector();
    this.componentHandler = new UniversalComponentHandler();
    this.fileUploader = new SmartFileUploader();
    this.formMonitor = new DynamicFormMonitor();

    this.setupFormMonitoring();
  }

  /**
   * Set progress callback for autofill operations
   */
  setProgressCallback(callback: (progress: AutofillProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Detect forms on the current page using intelligent detection
   */
  async detectForms(): Promise<DetectedForm[]> {
    try {
      console.log('Starting intelligent form detection...');
      const forms = await this.detector.detectForms();
      
      if (this.options.enableDynamicMonitoring) {
        // Register forms for dynamic monitoring
        for (const form of forms) {
          this.formMonitor.registerForm(form);
        }
        
        if (!this.formMonitor['isMonitoring']) {
          this.formMonitor.startMonitoring();
        }
      }

      console.log(`Detected ${forms.length} forms using intelligent detection`);
      return forms;
    } catch (error) {
      console.error('Intelligent form detection failed:', error);
      return [];
    }
  }

  /**
   * Perform intelligent autofill on detected forms
   */
  async performAutofill(forms: DetectedForm[], profile: UserProfile): Promise<AutofillResult> {
    if (forms.length === 0) {
      return {
        success: false,
        filledCount: 0,
        totalFields: 0,
        skippedFields: [],
        errors: ['No forms detected'],
        duration: 0
      };
    }

    const startTime = Date.now();
    const targetForm = this.selectBestForm(forms);
    
    console.log(`Starting intelligent autofill on form: ${targetForm.formId}`);
    
    const progress: AutofillProgress = {
      totalFields: targetForm.fields.length,
      filledFields: 0,
      skippedFields: 0,
      errorFields: 0,
      status: 'starting'
    };

    this.updateProgress(progress);

    const result = await this.fillForm(targetForm, profile, progress);
    
    // Learn from successful fills if enabled
    if (this.options.enableLearning && result.success) {
      await this.learnFromSuccessfulFill(targetForm, result);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Fill a single form with intelligent component handling
   */
  private async fillForm(form: DetectedForm, profile: UserProfile, progress: AutofillProgress): Promise<AutofillResult> {
    const filledFields: any[] = [];
    const skippedFields: any[] = [];
    const errors: any[] = [];

    progress.status = 'in_progress';
    this.updateProgress(progress);

    for (let i = 0; i < form.fields.length; i++) {
      const field = form.fields[i];
      progress.currentField = field.label;
      this.updateProgress(progress);

      try {
        const element = await this.findFieldElement(field);
        
        if (!element) {
          skippedFields.push({
            fieldId: field.id,
            selector: field.selector,
            reason: 'element_not_found',
            message: 'Field element not found in DOM'
          });
          progress.skippedFields++;
          continue;
        }

        const value = this.getFieldValue(field, profile);
        
        if (value === null || value === undefined) {
          skippedFields.push({
            fieldId: field.id,
            selector: field.selector,
            reason: 'no_value',
            message: 'No value available for this field'
          });
          progress.skippedFields++;
          continue;
        }

        const fillResult = await this.fillField(element, field, value);
        
        if (fillResult.success) {
          filledFields.push({
            fieldId: field.id,
            selector: field.selector,
            value: value,
            method: fillResult.method
          });
          progress.filledFields++;
          
          // Update form monitor
          if (this.options.enableDynamicMonitoring) {
            this.formMonitor.updateFilledField(form.formId, field.selector);
          }
          
          // Learn from successful fill
          if (this.options.enableLearning && element) {
            this.detector.learnFromSuccessfulFill(element, field.mappedProfileField || '');
          }
        } else {
          errors.push({
            fieldId: field.id,
            selector: field.selector,
            error: fillResult.error,
            message: fillResult.message
          });
          progress.errorFields++;
        }

        this.updateProgress(progress);
        
        // Small delay between fields to avoid overwhelming the page
        await this.sleep(100);

      } catch (error) {
        errors.push({
          fieldId: field.id,
          selector: field.selector,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Failed to fill field'
        });
        progress.errorFields++;
      }
    }

    progress.status = filledFields.length > 0 ? 'completed' : 'failed';
    this.updateProgress(progress);

    return {
      success: filledFields.length > 0,
      filledCount: filledFields.length,
      totalFields: form.fields.length,
      filledFields,
      skippedFields,
      errors,
      duration: 0 // Will be set by caller
    };
  }

  /**
   * Find field element with retry logic
   */
  private async findFieldElement(field: FormField): Promise<HTMLElement | null> {
    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      const element = safeQuerySelector(field.selector) as HTMLElement;
      
      if (element) {
        return element;
      }

      // Wait before retry
      if (attempt < this.options.maxRetries - 1) {
        await this.sleep(this.options.retryDelay);
      }
    }

    return null;
  }

  /**
   * Fill individual field using appropriate handler
   */
  private async fillField(element: HTMLElement, field: FormField, value: string): Promise<{
    success: boolean;
    method?: string;
    error?: string;
    message?: string;
  }> {
    try {
      // Handle file upload fields
      if (field.type === 'file' && this.options.enableFileUpload) {
        return await this.handleFileUpload(element as HTMLInputElement, field, value);
      }

      // Use universal component handler for other fields
      const success = await this.componentHandler.fillComponent(element, value);
      
      if (success) {
        return {
          success: true,
          method: 'universal_component_handler'
        };
      } else {
        return {
          success: false,
          error: 'component_handler_failed',
          message: 'Universal component handler could not fill the field'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'unknown_error',
        message: 'Exception occurred while filling field'
      };
    }
  }

  /**
   * Handle file upload using smart uploader
   */
  private async handleFileUpload(element: HTMLInputElement, field: FormField, filePath: string): Promise<{
    success: boolean;
    method?: string;
    error?: string;
    message?: string;
  }> {
    try {
      // For now, we'll simulate file upload since we don't have actual files
      // In a real implementation, this would get the file from the profile
      console.log(`File upload requested for field ${field.id}: ${filePath}`);
      
      // Create a dummy file for demonstration
      const dummyFile = new File(['dummy content'], 'resume.pdf', { type: 'application/pdf' });
      
      const uploadResult = await this.fileUploader.uploadFile(element, dummyFile);
      
      return {
        success: uploadResult.success,
        method: uploadResult.method,
        error: uploadResult.error,
        message: uploadResult.requiresManualIntervention ? 
          'Manual intervention required' : undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'file_upload_error',
        message: 'File upload failed'
      };
    }
  }

  /**
   * Get field value from profile
   */
  private getFieldValue(field: FormField, profile: UserProfile): string | null {
    if (!field.mappedProfileField) {
      return null;
    }

    try {
      // Navigate the profile object using the mapped field path
      const path = field.mappedProfileField.split('.');
      let value: any = profile;
      
      for (const key of path) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
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
        return value ? 'true' : 'false';
      } else if (Array.isArray(value)) {
        return value.join(', ');
      } else if (value && typeof value === 'object') {
        // For objects, try to get a string representation
        return value.toString();
      }

      return null;
    } catch (error) {
      console.error('Error getting field value:', error);
      return null;
    }
  }

  /**
   * Select the best form for autofill
   */
  private selectBestForm(forms: DetectedForm[]): DetectedForm {
    if (forms.length === 1) {
      return forms[0];
    }

    // Sort by confidence and number of mapped fields
    return forms.sort((a, b) => {
      const scoreA = a.confidence + (a.fields.filter(f => f.mappedProfileField).length * 0.1);
      const scoreB = b.confidence + (b.fields.filter(f => f.mappedProfileField).length * 0.1);
      return scoreB - scoreA;
    })[0];
  }

  /**
   * Learn from successful autofill operation
   */
  private async learnFromSuccessfulFill(form: DetectedForm, result: AutofillResult): Promise<void> {
    try {
      console.log(`Learning from successful autofill: ${result.filledCount}/${result.totalFields} fields filled`);
      
      // The individual field learning is already handled in fillField method
      // Here we could implement form-level learning patterns
      
      // Store successful form patterns
      const formPattern = {
        platform: form.platform,
        url: form.url,
        fieldCount: form.fields.length,
        successRate: result.filledCount / result.totalFields,
        timestamp: Date.now()
      };
      
      // Save to local storage for future reference
      const existingPatterns = JSON.parse(localStorage.getItem('autofill_form_patterns') || '[]');
      existingPatterns.push(formPattern);
      
      // Keep only the last 100 patterns
      if (existingPatterns.length > 100) {
        existingPatterns.splice(0, existingPatterns.length - 100);
      }
      
      localStorage.setItem('autofill_form_patterns', JSON.stringify(existingPatterns));
    } catch (error) {
      console.warn('Failed to learn from successful fill:', error);
    }
  }

  /**
   * Setup form monitoring event handlers
   */
  private setupFormMonitoring(): void {
    if (!this.options.enableDynamicMonitoring) {
      return;
    }

    // Listen for step changes
    this.formMonitor.addEventListener('step_change', (event: any) => {
      console.log(`Form step changed: ${event.data.oldStep} -> ${event.data.newStep}`);
      // Could trigger re-detection or continue autofill on new step
    });

    // Listen for new fields
    this.formMonitor.addEventListener('field_added', (event: any) => {
      console.log('New field detected:', event.data);
      // Could trigger autofill on the new field
    });

    // Listen for new content
    this.formMonitor.addEventListener('content_loaded', (event: any) => {
      console.log('New form content loaded:', event.data);
      // Could trigger re-detection of forms
    });
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(progress: AutofillProgress): void {
    if (this.progressCallback) {
      this.progressCallback({ ...progress });
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop all monitoring and cleanup
   */
  cleanup(): void {
    if (this.options.enableDynamicMonitoring) {
      this.formMonitor.stopMonitoring();
    }
  }

  /**
   * Get current form states from monitor
   */
  getFormStates(): Map<string, any> {
    return this.formMonitor.getAllFormStates();
  }

  /**
   * Manually trigger form re-detection
   */
  async redetectForms(): Promise<DetectedForm[]> {
    console.log('Manually triggering form re-detection...');
    return await this.detectForms();
  }

  /**
   * Test component detection on a specific element
   */
  async testComponentDetection(element: HTMLElement): Promise<any> {
    return await this.componentHandler.detectComponent(element);
  }

  /**
   * Get file upload guidance for a field
   */
  getFileUploadGuidance(field: HTMLInputElement, file: File): string[] {
    const uploader = new SmartFileUploader();
    return uploader['generateGuidanceSteps'](field, file);
  }
}