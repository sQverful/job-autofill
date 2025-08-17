/**
 * AI Content Generation System
 * 
 * This module provides AI-powered content generation for job applications,
 * including cover letters, question responses, and other personalized content.
 */

export { JobContextExtractor } from './job-context-extractor.js';
export { AIServiceClient } from './ai-service-client.js';
export { ContentRequestFormatter } from './content-request-formatter.js';
export { ResponseParser } from './response-parser.js';
export { QuestionAnalyzer } from './question-analyzer.js';
export { AnswerQualityValidator } from './answer-quality-validator.js';
export { AIContentManager } from './ai-content-manager.js';

export type * from './types.js';

// Re-export main manager and types for convenience
export type {
  AIContentManagerConfig,
  ContentGenerationOptions,
  GenerationResult
} from './ai-content-manager.js';

export type {
  QuestionAnalysis,
  QuestionType,
  QuestionCategory,
  QuestionIntent
} from './question-analyzer.js';

export type {
  QualityScore,
  QualityFeedback
} from './answer-quality-validator.js';