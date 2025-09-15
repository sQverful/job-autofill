/**
 * AI module exports for smart autofill functionality
 */

export { AIServiceClient, aiServiceClient } from './ai-service-client.js';
export { AICacheManager, aiCacheManager } from './ai-cache-manager.js';
export { AIErrorHandler, aiErrorHandler } from './ai-error-handler.js';
export { AIFallbackManager, aiFallbackManager } from './ai-fallback-manager.js';
export { 
  JOB_APPLICATION_SYSTEM_PROMPT,
  JOB_APPLICATION_PROMPT_TEMPLATE,
  PROMPT_EXAMPLES,
  buildUserPrompt,
  generateCoverLetterPrompt,
  validateAnalysisResponse,
  sanitizeHTMLForAnalysis,
  extractFormMetadata
} from './prompt-templates.js';

// Re-export types from shared package
export type {
  AIFormAnalysis,
  AITokenValidationResult,
  AIError,
  AIErrorContext,
  AIErrorResolution,
  ExtractedHTML,
  FormInstruction,
  CachedAnalysis,
  AICache,
  AIPromptTemplate,
  PromptExample
} from '@extension/shared';

// Export enhanced error types
export type { EnhancedAIError } from './ai-error-handler.js';
export type { 
  FallbackConfig, 
  FallbackStrategy, 
  FallbackResult 
} from './ai-fallback-manager.js';