/**
 * Form detection and autofill data models
 */

// Supported job platforms
export type JobPlatform =
  | 'linkedin'
  | 'indeed'
  | 'workday'
  | 'custom'
  | 'smartrecruiters'
  | 'teamtailor'
  | 'greenhouse'
  | 'lever'
  | 'bamboohr'
  | 'jobvite'
  | 'icims'
  | 'company_careers';

// Form field types
export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'date'
  | 'number'
  | 'url';

// AI content types
export type AIContentType =
  | 'cover_letter'
  | 'question_response'
  | 'summary'
  | 'objective'
  | 'why_interested'
  | 'why_qualified';

// Autofill features supported by platform
export type AutofillFeature =
  | 'basic_info'
  | 'work_experience'
  | 'education'
  | 'skills'
  | 'file_upload'
  | 'ai_content'
  | 'default_answers';

// Job context extracted from posting
export interface JobContext {
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  requirements: string[];
  benefits?: string[];
  location?: string;
  salaryRange?: {
    min?: number;
    max?: number;
    currency: string;
  };
  jobType?: 'full_time' | 'part_time' | 'contract' | 'internship';
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
}

// Individual form field detection
export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  selector: string;
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select/radio fields
  mappedProfileField?: string;
  aiContentType?: AIContentType;
  validationRules?: FieldValidationRule[];
}

// Field validation rules
export interface FieldValidationRule {
  type: 'required' | 'email' | 'phone' | 'url' | 'minLength' | 'maxLength' | 'pattern';
  value?: string | number;
  message: string;
}

// Detected form structure
export interface DetectedForm {
  platform: JobPlatform;
  formId: string;
  url: string;
  fields: FormField[];
  jobContext?: JobContext;
  confidence: number;
  supportedFeatures: AutofillFeature[];
  detectedAt: Date;
  isMultiStep: boolean;
  currentStep?: number;
  totalSteps?: number;
}

// Form detection result
export interface FormDetectionResult {
  success: boolean;
  forms: DetectedForm[];
  errors: FormDetectionError[];
  platformSpecificData?: Record<string, any>;
}

export interface FormDetectionError {
  code: string;
  message: string;
  field?: string;
  selector?: string;
}

// Autofill operation result
export interface AutofillResult {
  success: boolean;
  filledFields: FilledField[];
  skippedFields: SkippedField[];
  errors: AutofillError[];
  totalFields: number;
  filledCount: number;
  duration: number; // milliseconds
}

export interface FilledField {
  fieldId: string;
  selector: string;
  value: string | boolean | File;
  source: 'profile' | 'ai' | 'default_answer';
}

export interface SkippedField {
  fieldId: string;
  selector: string;
  reason: 'no_mapping' | 'validation_failed' | 'field_not_found' | 'user_preference';
  message: string;
}

export interface AutofillError {
  fieldId: string;
  selector: string;
  code: string;
  message: string;
  recoverable: boolean;
}
