/**
 * Form detection utilities for job application forms
 * Provides comprehensive form detection, field classification, and confidence scoring
 */

export { BaseFormDetector, DEFAULT_DETECTION_CONFIG } from './base-detector';
export type { FormDetectionConfig } from './base-detector';

export { ConfidenceScorer, DEFAULT_SCORING_WEIGHTS } from './confidence-scorer';
export type { ConfidenceFactors, ScoringWeights } from './confidence-scorer';

// Comprehensive platform detector
export { PlatformFormDetector, DEFAULT_PLATFORM_CONFIG } from './platform-detector';
export type { PlatformDetectionConfig } from './platform-detector';

// Platform-specific detectors
export {
  LinkedInFormDetector,
  IndeedFormDetector,
  WorkdayFormDetector,
  CustomFormDetector,
  LINKEDIN_SELECTORS,
  INDEED_SELECTORS,
  WORKDAY_SELECTORS,
  CUSTOM_FORM_PATTERNS,
  createPlatformDetector,
  detectPlatform,
  getAllPlatformDetectors
} from './platforms';

export type {
  LinkedInFormSelectors,
  IndeedFormSelectors,
  WorkdayFormSelectors,
  CustomFormPatterns
} from './platforms';

// Re-export types from shared package for convenience
export type {
  DetectedForm,
  FormField,
  FieldType,
  JobPlatform,
  FormDetectionResult,
  FormDetectionError,
  AutofillFeature,
  JobContext,
  AutofillResult,
  FilledField,
  SkippedField,
  AutofillError
} from '@extension/shared/lib/types/form-detection';