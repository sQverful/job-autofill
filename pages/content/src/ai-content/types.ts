/**
 * AI Content System Internal Types
 */

import type { 
  AIContentRequest, 
  AIContentResponse, 
  AIContentError,
  ContentGenerationResult,
  AIServiceConfig 
} from '@extension/shared/lib/types';

// Job context extraction configuration
export interface ContextExtractionConfig {
  selectors: {
    jobTitle: string[];
    companyName: string[];
    jobDescription: string[];
    requirements: string[];
    benefits: string[];
    location: string[];
    salary: string[];
  };
  fallbackStrategies: {
    useMetaTags: boolean;
    useStructuredData: boolean;
    useHeuristics: boolean;
  };
  timeout: number; // milliseconds
}

// AI service client configuration
export interface AIClientConfig extends AIServiceConfig {
  endpoints: {
    generate: string;
    validate: string;
    feedback: string;
  };
  headers: Record<string, string>;
  cache: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number;
  };
}

// Content request formatting options
export interface RequestFormattingOptions {
  includeContext: boolean;
  includeExamples: boolean;
  maxContextLength: number;
  templateVariables: Record<string, string>;
}

// Response parsing configuration
export interface ResponseParsingConfig {
  validation: {
    minLength: number;
    maxLength: number;
    requiredElements: string[];
    forbiddenPatterns: RegExp[];
  };
  postProcessing: {
    trimWhitespace: boolean;
    removeEmptyLines: boolean;
    formatParagraphs: boolean;
    addSignature: boolean;
  };
}

// Content generation context
export interface GenerationContext {
  requestId: string;
  userId: string;
  sessionId?: string;
  pageUrl: string;
  platform: string;
  timestamp: Date;
  userAgent: string;
}

// Service health status
export interface ServiceHealthStatus {
  available: boolean;
  responseTime: number;
  errorRate: number;
  lastCheck: Date;
  version: string;
  features: string[];
}