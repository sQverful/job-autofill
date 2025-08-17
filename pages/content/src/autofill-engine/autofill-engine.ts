/**
 * Main autofill engine that coordinates field mapping and data insertion
 */

import type { 
  DetectedForm, 
  UserProfile, 
  AutofillResult, 
  FilledField, 
  SkippedField, 
  AutofillError 
} from '@extension/shared/lib/types';

import { FieldMapper, type FieldMapping } from './field-mapper';
import { DataInserter, type InsertionResult } from './data-inserter';
import { FileUploadHandler, type FileUploadResult } from './file-upload-handler';
import { AutofillFeedback, type FeedbackOptions, type ProgressState } from './autofill-feedback';

export interface AutofillConfig {
  maxConcurrentFields: number;
  insertionDelay: number;
  skipOptionalFields: boolean;
  validateBeforeInsertion: boolean;
  enableProgressCallback: boolean;
  feedbackOptions: FeedbackOptions;
}

export interface AutofillOptions {
  skipFields?: string[]; // Field IDs to skip
  onlyFields?: string[]; // Only fill these field IDs
  dryRun?: boolean; // Don't actually fill, just return what would be filled
  progressCallback?: (progress: AutofillProgress) => void;
}

export interface AutofillProgress {
  totalFields: number;
  processedFields: number;
  filledFields: number;
  skippedFields: number;
  errors: number;
  currentField?: string;
}

export const DEFAULT_AUTOFILL_CONFIG: AutofillConfig = {
  maxConcurrentFields: 3,
  insertionDelay: 100,
  skipOptionalFields: false,
  validateBeforeInsertion: true,
  enableProgressCallback: true,
  feedbackOptions: {
    showHighlights: true,
    highlightDuration: 3000,
    showProgressIndicator: true,
    showErrorMessages: true,
    enableUndo: true,
    animationDuration: 300
  }
};

export class AutofillEngine {
  private fieldMapper: FieldMapper;
  private dataInserter: DataInserter;
  private fileUploadHandler: FileUploadHandler;
  private feedback: AutofillFeedback;
  private config: AutofillConfig;

  constructor(config: Partial<AutofillConfig> = {}) {
    this.config = { ...DEFAULT_AUTOFILL_CONFIG, ...config };
    this.fieldMapper = new FieldMapper();
    this.dataInserter = new DataInserter();
    this.fileUploadHandler = new FileUploadHandler();
    this.feedback = new AutofillFeedback(this.config.feedbackOptions);
  }

  /**
   * Autofill a detected form with user profile data
   */
  async autofillForm(
    form: DetectedForm, 
    profile: UserProfile, 
    options: AutofillOptions = {}
  ): Promise<AutofillResult> {
    const startTime = Date.now();
    const filledFields: FilledField[] = [];
    const skippedFields: SkippedField[] = [];
    const errors: AutofillError[] = [];

    try {
      // Filter fields based on options
      const fieldsToProcess = this.filterFields(form.fields, options);
      
      // Map fields to profile data
      const fieldMappings = this.fieldMapper.mapFields(fieldsToProcess);
      
      // Initialize progress tracking
      const progress: AutofillProgress = {
        totalFields: fieldsToProcess.length,
        processedFields: 0,
        filledFields: 0,
        skippedFields: 0,
        errors: 0
      };

      // Show initial progress
      const progressState: ProgressState = {
        isActive: true,
        totalFields: progress.totalFields,
        processedFields: progress.processedFields,
        errors: progress.errors
      };
      this.feedback.showProgress(progressState);

      // Process fields in batches to avoid overwhelming the page
      const batches = this.createBatches(fieldMappings, this.config.maxConcurrentFields);

      for (const batch of batches) {
        const batchPromises = batch.map(mapping => 
          this.processFieldMapping(mapping, form, profile, options, progress)
        );

        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            const { filled, skipped, error } = result.value;
            
            if (filled) filledFields.push(filled);
            if (skipped) skippedFields.push(skipped);
            if (error) errors.push(error);
          } else {
            errors.push({
              fieldId: 'unknown',
              selector: 'unknown',
              code: 'BATCH_PROCESSING_ERROR',
              message: result.reason?.message || 'Batch processing failed',
              recoverable: true
            });
          }

          progress.processedFields++;
          
          // Update progress display
          const progressState: ProgressState = {
            isActive: true,
            totalFields: progress.totalFields,
            processedFields: progress.processedFields,
            errors: progress.errors,
            currentField: progress.currentField
          };
          this.feedback.showProgress(progressState);
          
          if (options.progressCallback && this.config.enableProgressCallback) {
            options.progressCallback(progress);
          }
        }

        // Add delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.insertionDelay));
        }
      }

      // Handle unmapped fields
      const mappedFieldIds = new Set(fieldMappings.map(m => m.fieldId));
      const unmappedFields = fieldsToProcess.filter(field => !mappedFieldIds.has(field.id));
      
      for (const field of unmappedFields) {
        skippedFields.push({
          fieldId: field.id,
          selector: field.selector,
          reason: 'no_mapping',
          message: `No mapping found for field: ${field.label}`
        });
      }

      const duration = Date.now() - startTime;

      const result: AutofillResult = {
        success: errors.length === 0 || filledFields.length > 0,
        filledFields,
        skippedFields,
        errors,
        totalFields: fieldsToProcess.length,
        filledCount: filledFields.length,
        duration
      };

      // Show feedback for the result
      if (!options.dryRun) {
        this.feedback.showResult(result);
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: AutofillResult = {
        success: false,
        filledFields,
        skippedFields,
        errors: [{
          fieldId: 'engine',
          selector: 'engine',
          code: 'ENGINE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown engine error',
          recoverable: false
        }],
        totalFields: form.fields.length,
        filledCount: filledFields.length,
        duration
      };

      // Show error feedback
      if (!options.dryRun) {
        this.feedback.showResult(result);
      }

      return result;
    }
  }

  /**
   * Process a single field mapping
   */
  private async processFieldMapping(
    mapping: FieldMapping,
    form: DetectedForm,
    profile: UserProfile,
    options: AutofillOptions,
    progress: AutofillProgress
  ): Promise<{
    filled?: FilledField;
    skipped?: SkippedField;
    error?: AutofillError;
  }> {
    const field = form.fields.find(f => f.id === mapping.fieldId);
    if (!field) {
      return {
        error: {
          fieldId: mapping.fieldId,
          selector: 'unknown',
          code: 'FIELD_NOT_FOUND',
          message: `Field not found: ${mapping.fieldId}`,
          recoverable: false
        }
      };
    }

    progress.currentField = field.label;

    try {
      // Get value from profile
      const rawValue = this.fieldMapper.getProfileValue(profile, mapping.profilePath);
      
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        return {
          skipped: {
            fieldId: field.id,
            selector: field.selector,
            reason: 'no_mapping',
            message: `No value found in profile for path: ${mapping.profilePath}`
          }
        };
      }

      // Transform value if transformer is provided
      const transformedValue = this.fieldMapper.transformValue(rawValue, mapping.transformer);

      // Validate value if validator is provided
      if (this.config.validateBeforeInsertion && 
          !this.fieldMapper.validateValue(transformedValue, mapping.validator)) {
        return {
          skipped: {
            fieldId: field.id,
            selector: field.selector,
            reason: 'validation_failed',
            message: `Value validation failed for field: ${field.label}`
          }
        };
      }

      // Skip if dry run
      if (options.dryRun) {
        return {
          filled: {
            fieldId: field.id,
            selector: field.selector,
            value: transformedValue,
            source: 'profile'
          }
        };
      }

      // Handle file uploads separately
      if (field.type === 'file') {
        const fileUploadResult = await this.handleFileUpload(field, profile);
        if (fileUploadResult.success) {
          progress.filledFields++;
          return {
            filled: {
              fieldId: field.id,
              selector: field.selector,
              value: fileUploadResult.fileName || 'file uploaded',
              source: 'profile'
            }
          };
        } else {
          progress.errors++;
          return {
            error: {
              fieldId: field.id,
              selector: field.selector,
              code: fileUploadResult.error?.code || 'FILE_UPLOAD_FAILED',
              message: fileUploadResult.error?.message || 'File upload failed',
              recoverable: fileUploadResult.error?.recoverable || true
            }
          };
        }
      }

      // Insert data for non-file fields
      const insertionResult: InsertionResult = await this.dataInserter.insertData(
        field, 
        transformedValue, 
        'profile'
      );

      if (insertionResult.success && insertionResult.filledField) {
        progress.filledFields++;
        return { filled: insertionResult.filledField };
      } else if (insertionResult.error) {
        progress.errors++;
        return {
          error: {
            fieldId: field.id,
            selector: field.selector,
            code: insertionResult.error.code,
            message: insertionResult.error.message,
            recoverable: insertionResult.error.recoverable
          }
        };
      }

      return {
        skipped: {
          fieldId: field.id,
          selector: field.selector,
          reason: 'field_not_found',
          message: 'Field insertion failed for unknown reason'
        }
      };

    } catch (error) {
      progress.errors++;
      return {
        error: {
          fieldId: field.id,
          selector: field.selector,
          code: 'PROCESSING_ERROR',
          message: error instanceof Error ? error.message : 'Unknown processing error',
          recoverable: true
        }
      };
    }
  }

  /**
   * Filter fields based on options
   */
  private filterFields(fields: FormField[], options: AutofillOptions): FormField[] {
    let filteredFields = [...fields];

    // Filter by onlyFields if specified
    if (options.onlyFields && options.onlyFields.length > 0) {
      filteredFields = filteredFields.filter(field => 
        options.onlyFields!.includes(field.id)
      );
    }

    // Filter out skipFields if specified
    if (options.skipFields && options.skipFields.length > 0) {
      filteredFields = filteredFields.filter(field => 
        !options.skipFields!.includes(field.id)
      );
    }

    // Skip optional fields if configured
    if (this.config.skipOptionalFields) {
      filteredFields = filteredFields.filter(field => field.required);
    }

    return filteredFields;
  }

  /**
   * Create batches of field mappings for concurrent processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Add custom field mapping
   */
  addCustomMapping(fieldId: string, profilePath: string, transformer?: (value: any) => any): void {
    this.fieldMapper.addCustomMapping(fieldId, {
      fieldId,
      profilePath,
      transformer,
      priority: 100 // High priority for custom mappings
    });
  }

  /**
   * Remove custom field mapping
   */
  removeCustomMapping(fieldId: string): void {
    this.fieldMapper.removeCustomMapping(fieldId);
  }

  /**
   * Get current configuration
   */
  getConfig(): AutofillConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutofillConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Handle file upload for a specific field
   */
  private async handleFileUpload(field: FormField, profile: UserProfile): Promise<FileUploadResult> {
    // Get available documents from profile
    const documents = profile.documents.resumes;
    
    if (!documents || documents.length === 0) {
      return {
        success: false,
        fieldId: field.id,
        error: {
          code: 'NO_DOCUMENTS_AVAILABLE',
          message: 'No resume documents available for upload',
          recoverable: false
        }
      };
    }

    // Use file upload handler to perform the upload
    return await this.fileUploadHandler.uploadFile(field, documents);
  }

  /**
   * Clear all visual feedback
   */
  clearFeedback(): void {
    this.feedback.clearHighlights();
    this.feedback.hideProgress();
    this.feedback.hideErrors();
    this.feedback.hideUndoButton();
  }

  /**
   * Manually trigger undo operation
   */
  undoLastAutofill(): void {
    this.feedback.performUndo();
  }

  /**
   * Update feedback options
   */
  updateFeedbackOptions(options: Partial<FeedbackOptions>): void {
    this.feedback.updateOptions(options);
    this.config.feedbackOptions = { ...this.config.feedbackOptions, ...options };
  }

  /**
   * Get current feedback options
   */
  getFeedbackOptions(): FeedbackOptions {
    return { ...this.config.feedbackOptions };
  }

  /**
   * Cleanup all resources
   */
  cleanup(): void {
    this.feedback.cleanup();
  }
}