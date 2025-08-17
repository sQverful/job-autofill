/**
 * Autofill engine for job application forms
 * Provides field mapping, data insertion, and autofill control functionality
 */

export { AutofillEngine, DEFAULT_AUTOFILL_CONFIG } from './autofill-engine';
export type { AutofillConfig, AutofillOptions, AutofillProgress } from './autofill-engine';

export { FieldMapper, DEFAULT_FIELD_MAPPINGS } from './field-mapper';
export type { FieldMapping, FieldMappingRule } from './field-mapper';

export { DataInserter } from './data-inserter';
export type { InsertionResult, InsertionError } from './data-inserter';

export { FileUploadHandler } from './file-upload-handler';
export type { FileUploadResult, FileUploadError, FileUploadOptions } from './file-upload-handler';

export { AutofillFeedback } from './autofill-feedback';
export type { FeedbackOptions, HighlightStyle } from './autofill-feedback';

// Re-export types from shared package for convenience
export type {
  AutofillResult,
  FilledField,
  SkippedField,
  AutofillError,
  DetectedForm,
  FormField,
  UserProfile
} from '@extension/shared/lib/types';