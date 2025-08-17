/**
 * AI content generation data models
 */

import type { UserProfile } from './profile.js';
import type { JobContext } from './form-detection.js';

// AI content request types
export type AIContentRequestType = 
  | 'cover_letter' 
  | 'question_response' 
  | 'summary'
  | 'objective'
  | 'why_interested'
  | 'why_qualified'
  | 'custom_response';

// Content generation preferences
export interface ContentGenerationPreferences {
  tone: 'professional' | 'casual' | 'enthusiastic' | 'confident';
  length: 'short' | 'medium' | 'long';
  focus: string[];
  includePersonalExperience: boolean;
  includeSkills: boolean;
  includeEducation: boolean;
  customInstructions?: string;
}

// AI content request
export interface AIContentRequest {
  id: string;
  type: AIContentRequestType;
  context: {
    jobDescription: string;
    companyInfo: string;
    userProfile: UserProfile;
    specificQuestion?: string;
    fieldLabel?: string;
    existingContent?: string;
  };
  preferences: ContentGenerationPreferences;
  metadata: {
    requestedAt: Date;
    userId: string;
    sessionId?: string;
  };
}

// AI content response
export interface AIContentResponse {
  id: string;
  requestId: string;
  content: string;
  confidence: number;
  suggestions: string[];
  alternatives?: string[];
  metadata: {
    generatedAt: Date;
    model: string;
    tokens: number;
    processingTime: number; // milliseconds
    version: string;
  };
  qualityScore?: {
    relevance: number;
    coherence: number;
    professionalism: number;
    overall: number;
  };
}

// AI service configuration
export interface AIServiceConfig {
  provider: 'openai' | 'claude' | 'custom';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
  timeout: number; // milliseconds
  retryAttempts: number;
}

// Content generation result
export interface ContentGenerationResult {
  success: boolean;
  response?: AIContentResponse;
  error?: AIContentError;
  cached: boolean;
  fromFallback: boolean;
}

export interface AIContentError {
  code: string;
  message: string;
  type: 'network' | 'authentication' | 'rate_limit' | 'content_policy' | 'service_unavailable';
  retryable: boolean;
  retryAfter?: number; // seconds
}

// Content cache entry
export interface ContentCacheEntry {
  id: string;
  requestHash: string;
  content: string;
  confidence: number;
  createdAt: Date;
  expiresAt: Date;
  usageCount: number;
  lastUsed: Date;
}

// Content quality metrics
export interface ContentQualityMetrics {
  wordCount: number;
  sentenceCount: number;
  readabilityScore: number;
  keywordRelevance: number;
  professionalismScore: number;
  uniquenessScore: number;
}

// Content template for common responses
export interface ContentTemplate {
  id: string;
  name: string;
  type: AIContentRequestType;
  template: string;
  variables: string[];
  isDefault: boolean;
  createdAt: Date;
  lastModified: Date;
  usageCount: number;
}