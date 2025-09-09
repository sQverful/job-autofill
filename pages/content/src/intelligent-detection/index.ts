/**
 * Intelligent Detection System Exports
 * Main entry point for all intelligent detection components
 */

// Core detection engine
export { IntelligentDetector } from '../detection/intelligent-detector';
export type { 
  DetectionStrategy, 
  FieldPattern, 
  ComponentDetectionResult 
} from '../detection/intelligent-detector';

// Universal component handler
export { UniversalComponentHandler } from '../components/universal-handler';
export { ReactSelectHandler } from '../components/universal-handler';
export { VueSelectHandler } from '../components/universal-handler';
export { AngularMaterialHandler } from '../components/universal-handler';
export { CustomDropdownHandler } from '../components/universal-handler';
export { StandardInputHandler } from '../components/universal-handler';
export type { 
  ComponentHandler, 
  ComponentDetectionResult as ComponentResult 
} from '../components/universal-handler';

// Smart file uploader
export { SmartFileUploader } from '../upload/smart-uploader';
export type { 
  FileUploadStrategy, 
  UploadResult, 
  FileFormatInfo 
} from '../upload/smart-uploader';

// Dynamic form monitor
export { DynamicFormMonitor } from '../monitoring/dynamic-form-monitor';
export type { 
  FormState, 
  FormChangeEvent, 
  ValidationRule 
} from '../monitoring/dynamic-form-monitor';

// Main intelligent autofill engine
export { IntelligentAutofillEngine } from '../intelligent-autofill-engine';
export type { 
  IntelligentAutofillOptions, 
  AutofillProgress 
} from '../intelligent-autofill-engine';

// Test utilities
export { IntelligentAutofillTester } from '../test-intelligent-detection';

/**
 * Create a new intelligent autofill engine with default options
 */
export function createIntelligentAutofillEngine(options?: Partial<IntelligentAutofillOptions>) {
  return new IntelligentAutofillEngine(options);
}

/**
 * Create a new intelligent detector
 */
export function createIntelligentDetector() {
  return new IntelligentDetector();
}

/**
 * Create a new universal component handler
 */
export function createUniversalComponentHandler() {
  return new UniversalComponentHandler();
}

/**
 * Create a new smart file uploader
 */
export function createSmartFileUploader() {
  return new SmartFileUploader();
}

/**
 * Create a new dynamic form monitor
 */
export function createDynamicFormMonitor() {
  return new DynamicFormMonitor();
}

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * Feature flags for intelligent detection capabilities
 */
export const FEATURES = {
  INTELLIGENT_DETECTION: true,
  FRAMEWORK_SUPPORT: {
    REACT: true,
    VUE: true,
    ANGULAR: true,
    CUSTOM: true
  },
  FILE_UPLOAD: {
    DIRECT_API: true,
    DRAG_DROP: true,
    CLIPBOARD: true,
    BROWSER_SPECIFIC: true,
    USER_GUIDED: true
  },
  DYNAMIC_MONITORING: {
    MULTI_STEP_FORMS: true,
    ASYNC_CONTENT: true,
    IFRAME_SUPPORT: true,
    VALIDATION_TRACKING: true
  },
  ADAPTIVE_LEARNING: {
    PATTERN_LEARNING: true,
    SUCCESS_TRACKING: true,
    CROSS_DOMAIN: true
  }
} as const;