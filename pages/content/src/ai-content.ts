/**
 * AI Content module - exports types and interfaces for AI-powered content generation
 */

// Import types for use in interfaces
import type {
  AIContentRequestType,
  ContentGenerationPreferences,
  ContentGenerationResult
} from '@extension/shared/lib/types/ai-content';

// Re-export types from shared package
export type {
  AIContentRequestType,
  ContentGenerationPreferences,
  AIContentRequest,
  AIContentResponse,
  AIServiceConfig,
  ContentGenerationResult as GenerationResult,
  AIContentError,
  ContentCacheEntry,
  ContentQualityMetrics,
  ContentTemplate
} from '@extension/shared/lib/types/ai-content';

// Re-export profile and job context types
export type {
  UserProfile
} from '@extension/shared/lib/types/profile';

export type {
  JobContext
} from '@extension/shared/lib/types/form-detection';

// AI Content Manager Configuration
export interface AIContentManagerConfig {
  aiClient: {
    provider: 'openai' | 'claude' | 'custom';
    model: string;
    apiKey?: string;
    baseUrl?: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
    retryAttempts: number;
  };
  contentSettings: {
    enableCache: boolean;
    cacheExpiration: number; // milliseconds
    maxCacheSize: number;
    enableFallback: boolean;
    fallbackTemplates: boolean;
  };
  uiSettings: {
    showIndicators: boolean;
    enablePreview: boolean;
    autoDetectFields: boolean;
    showAlternatives: boolean;
  };
  permissions: {
    allowDataCollection: boolean;
    allowAnalytics: boolean;
    allowImprovement: boolean;
  };
}

// AI Content Manager Interface
export interface AIContentManager {
  generateContent(
    type: AIContentRequestType,
    preferences: Partial<ContentGenerationPreferences>,
    existingContent?: string
  ): Promise<ContentGenerationResult>;
  
  getServiceHealth(): Promise<{
    available: boolean;
    latency: number;
    errorRate: number;
    lastCheck: Date;
  }>;
  
  clearCache(): Promise<void>;
  updateConfig(config: Partial<AIContentManagerConfig>): Promise<void>;
}