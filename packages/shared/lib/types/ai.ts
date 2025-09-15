/**
 * AI-specific data models and types for smart autofill functionality
 */

// AI Settings Configuration
export interface AISettings {
  enabled: boolean;
  apiToken?: string;
  model: 'gpt-4' | 'gpt-3.5-turbo';
  maxTokens: number;
  temperature: number;
  cacheEnabled: boolean;
  autoTrigger: boolean;
}

// AI Form Analysis Result
export interface AIFormAnalysis {
  instructions: FormInstruction[];
  confidence: number;
  reasoning: string;
  warnings: string[];
  metadata: {
    analysisId: string;
    timestamp: Date;
    model: string;
    tokensUsed: number;
  };
}

// Form Instruction for AI execution
export interface FormInstruction {
  action: 'fill' | 'select' | 'click' | 'upload';
  selector: string;
  value?: string;
  options?: string[];
  reasoning: string;
  confidence: number;
  priority: number;
}

// AI Cache Entry
export interface CachedAnalysis {
  analysis: AIFormAnalysis;
  timestamp: Date;
  url: string;
  hits: number;
  htmlHash: string;
  priority?: number;
  lastAccessed?: Date;
  size?: number;
}

// AI Cache Storage
export interface AICache {
  analyses: Record<string, CachedAnalysis>;
  maxSize: number;
  ttl: number; // Time to live in milliseconds
  totalHits: number;
  lastCleanup: Date;
}

// Extended User Profile for AI Context
export interface AIUserContext {
  aiPreferences: {
    preferredTone: 'professional' | 'casual' | 'enthusiastic';
    customInstructions?: string;
    excludedFields: string[];
    learningEnabled: boolean;
  };
}

// Import UserProfile from profile types
import type { UserProfile } from './profile.js';

// AI Execution Result
export interface ExecutionResult {
  instruction: FormInstruction;
  success: boolean;
  error?: string;
  actualValue?: string;
  executionTime: number;
  retryCount: number;
}

// AI Autofill Result
export interface AIAutofillResult {
  success: boolean;
  aiAnalysis: AIFormAnalysis;
  executionResults: ExecutionResult[];
  totalInstructions: number;
  successfulInstructions: number;
  failedInstructions: number;
  totalExecutionTime: number;
  fallbackUsed: boolean;
  errors: string[];
}

// AI Progress Tracking
export interface AIAutofillProgress {
  stage: 'analyzing' | 'executing' | 'completed' | 'error';
  progress: number; // 0-100
  currentInstruction?: FormInstruction;
  message: string;
  estimatedTimeRemaining?: number;
}

// Extracted HTML for AI Analysis
export interface ExtractedHTML {
  html: string;
  hash: string;
  metadata: {
    url: string;
    timestamp: Date;
    formCount: number;
    fieldCount: number;
    pageTitle: string;
    fieldTypes?: Record<string, number>;
    hasFileUploads?: boolean;
    hasMultiStep?: boolean;
    estimatedComplexity?: 'low' | 'medium' | 'high';
  };
}

// AI Error Types
export type AIError = 
  | 'INVALID_TOKEN'
  | 'API_RATE_LIMIT'
  | 'API_QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'PARSING_ERROR'
  | 'EXECUTION_FAILED'
  | 'CACHE_ERROR'
  | 'ENCRYPTION_ERROR';

// AI Error Context
export interface AIErrorContext {
  operation: string;
  url?: string;
  timestamp: Date;
  retryCount: number;
  additionalInfo?: Record<string, any>;
}

// AI Error Resolution
export interface AIErrorResolution {
  action: 'retry' | 'fallback' | 'abort' | 'user_action_required';
  message: string;
  fallbackStrategy?: 'traditional_autofill' | 'manual_mode';
  retryDelay?: number;
  maxRetries?: number;
}

// AI Token Validation Result
export interface AITokenValidationResult {
  isValid: boolean;
  error?: string;
  model?: string;
  remainingQuota?: number;
  rateLimitInfo?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
    requestsPerDay: number;
  };
}

// AI Learning Data
export interface AILearningData {
  successPatterns: Record<string, number>;
  failurePatterns: Record<string, number>;
  userCorrections: Array<{
    originalInstruction: FormInstruction;
    correctedValue: string;
    timestamp: Date;
    url: string;
  }>;
  performanceMetrics: {
    averageAccuracy: number;
    averageExecutionTime: number;
    totalOperations: number;
    successRate: number;
  };
}

// AI Prompt Template
export interface AIPromptTemplate {
  system: string;
  user: string;
  examples: PromptExample[];
  version: string;
}

// Prompt Example for AI training
export interface PromptExample {
  input: {
    html: string;
    profile: Record<string, any>;
    context?: Record<string, any>;
  };
  output: AIFormAnalysis;
}

// Import JobContext from form-detection instead of redefining
import type { JobContext } from './form-detection.js';

// AI Security Settings
export interface AISecuritySettings {
  encryptTokens: boolean;
  sanitizeHTML: boolean;
  auditLogging: boolean;
  dataRetentionDays: number;
  allowedDomains: string[];
  blockedDomains: string[];
}

// AI Usage Analytics
export interface AIUsageAnalytics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  tokensUsed: number;
  cacheHitRate: number;
  lastUsed: Date;
  dailyUsage: Record<string, number>;
  monthlyUsage: Record<string, number>;
}