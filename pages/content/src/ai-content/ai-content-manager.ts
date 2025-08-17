/**
 * AI Content Manager
 * 
 * Main coordinator for AI content generation system.
 * Orchestrates job context extraction, request formatting, API communication,
 * and response parsing for seamless content generation.
 */

import type { 
  AIContentRequest,
  AIContentResponse,
  ContentGenerationResult,
  AIContentRequestType,
  ContentGenerationPreferences,
  UserProfile,
  JobContext,
  JobPlatform
} from '@extension/shared/lib/types';

import { JobContextExtractor } from './job-context-extractor.js';
import { AIServiceClient } from './ai-service-client.js';
import { ContentRequestFormatter } from './content-request-formatter.js';
import { ResponseParser } from './response-parser.js';
import { QuestionAnalyzer } from './question-analyzer.js';
import { AnswerQualityValidator } from './answer-quality-validator.js';
import type { AIClientConfig, RequestFormattingOptions } from './types.js';

export interface AIContentManagerConfig {
  aiClient: AIClientConfig;
  platform: JobPlatform;
  enableCaching: boolean;
  enableFallbacks: boolean;
  maxRetries: number;
  requestTimeout: number;
}

export interface ContentGenerationOptions {
  preferences?: Partial<ContentGenerationPreferences>;
  formatting?: Partial<RequestFormattingOptions>;
  skipCache?: boolean;
  includeAlternatives?: boolean;
}

export interface GenerationResult {
  success: boolean;
  content?: string;
  alternatives?: string[];
  confidence?: number;
  qualityScore?: number;
  suggestions?: string[];
  warnings?: string[];
  errors?: string[];
  questionAnalysis?: import('./question-analyzer.js').QuestionAnalysis;
  qualityFeedback?: import('./answer-quality-validator.js').QualityFeedback;
  metadata?: {
    requestId: string;
    processingTime: number;
    fromCache: boolean;
    fromFallback: boolean;
  };
}

export class AIContentManager {
  private contextExtractor: JobContextExtractor;
  private aiClient: AIServiceClient;
  private requestFormatter: ContentRequestFormatter;
  private responseParser: ResponseParser;
  private questionAnalyzer: QuestionAnalyzer;
  private qualityValidator: AnswerQualityValidator;
  private config: AIContentManagerConfig;
  private cachedJobContext: JobContext | null = null;
  private lastContextExtraction: number = 0;

  constructor(config: AIContentManagerConfig) {
    this.config = config;
    this.contextExtractor = new JobContextExtractor(config.platform);
    this.aiClient = new AIServiceClient(config.aiClient);
    this.requestFormatter = new ContentRequestFormatter();
    this.responseParser = new ResponseParser();
    this.questionAnalyzer = new QuestionAnalyzer();
    this.qualityValidator = new AnswerQualityValidator();
  }

  /**
   * Generate AI content for a specific type
   */
  async generateContent(
    type: AIContentRequestType,
    userProfile: UserProfile,
    options: ContentGenerationOptions = {}
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      // Get job context
      const jobContext = await this.getJobContext();
      if (!jobContext) {
        return {
          success: false,
          errors: ['Unable to extract job context from current page'],
          metadata: {
            requestId: '',
            processingTime: Date.now() - startTime,
            fromCache: false,
            fromFallback: false
          }
        };
      }

      // Create and validate request
      const request = this.requestFormatter.createRequest(
        type,
        userProfile,
        jobContext,
        options.formatting,
        options.preferences
      );

      const validation = this.requestFormatter.validateRequest(request);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors,
          metadata: {
            requestId: request.id,
            processingTime: Date.now() - startTime,
            fromCache: false,
            fromFallback: false
          }
        };
      }

      // Generate content
      const result = await this.aiClient.generateContent(request);
      
      if (!result.success || !result.response) {
        return {
          success: false,
          errors: result.error ? [result.error.message] : ['Content generation failed'],
          metadata: {
            requestId: request.id,
            processingTime: Date.now() - startTime,
            fromCache: result.cached,
            fromFallback: result.fromFallback
          }
        };
      }

      // Parse and validate response
      const parseResult = this.responseParser.parseResponse(result.response, type);
      
      if (!parseResult.success) {
        return {
          success: false,
          content: parseResult.parsedContent,
          errors: parseResult.errors,
          warnings: parseResult.warnings,
          metadata: {
            requestId: request.id,
            processingTime: Date.now() - startTime,
            fromCache: result.cached,
            fromFallback: result.fromFallback
          }
        };
      }

      // Generate improvement suggestions
      const suggestions = this.responseParser.extractImprovementSuggestions(
        parseResult.parsedContent,
        parseResult.qualityMetrics,
        type
      );

      return {
        success: true,
        content: parseResult.parsedContent,
        alternatives: result.response.alternatives,
        confidence: result.response.confidence,
        qualityScore: result.response.qualityScore?.overall,
        suggestions,
        warnings: parseResult.warnings,
        metadata: {
          requestId: request.id,
          processingTime: Date.now() - startTime,
          fromCache: result.cached,
          fromFallback: result.fromFallback
        }
      };

    } catch (error) {
      console.error('AIContentManager: Error generating content:', error);
      return {
        success: false,
        errors: [`Content generation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        metadata: {
          requestId: '',
          processingTime: Date.now() - startTime,
          fromCache: false,
          fromFallback: false
        }
      };
    }
  }

  /**
   * Generate intelligent answer for a specific question
   */
  async generateQuestionAnswer(
    questionText: string,
    fieldContext: string,
    userProfile: UserProfile,
    existingContent?: string,
    options: ContentGenerationOptions = {}
  ): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      // Analyze the question
      const questionAnalysis = this.questionAnalyzer.analyzeQuestion(questionText, fieldContext);
      
      // Determine the best content type for this question
      const contentType = this.questionAnalyzer.getContentTypeForQuestion(questionAnalysis);
      
      // Get response guidelines
      const guidelines = this.questionAnalyzer.generateResponseGuidelines(questionAnalysis);
      
      // Enhance preferences with question-specific guidance
      const enhancedPreferences = {
        ...options.preferences,
        tone: options.preferences?.tone || guidelines.tone as any,
        length: options.preferences?.length || guidelines.length as any,
        customInstructions: [
          options.preferences?.customInstructions || '',
          `Question type: ${questionAnalysis.type}`,
          `Expected approach: ${guidelines.structure.join('; ')}`,
          `Key points to address: ${guidelines.keyPoints.join('; ')}`,
          questionAnalysis.suggestedApproach.length > 0 ? 
            `Suggested approach: ${questionAnalysis.suggestedApproach.join('; ')}` : ''
        ].filter(Boolean).join('\n')
      };

      // Generate content using the enhanced approach
      const result = await this.generateFieldContent(
        questionText,
        contentType,
        userProfile,
        existingContent,
        { ...options, preferences: enhancedPreferences }
      );

      // If generation was successful, validate the answer quality
      if (result.success && result.content) {
        const qualityFeedback = this.qualityValidator.validateAnswer(
          result.content,
          questionAnalysis,
          questionText
        );

        // Enhance the result with question analysis and quality feedback
        return {
          ...result,
          questionAnalysis,
          qualityFeedback,
          qualityScore: qualityFeedback.score.overall,
          suggestions: [
            ...(result.suggestions || []),
            ...qualityFeedback.suggestions
          ],
          warnings: [
            ...(result.warnings || []),
            ...(qualityFeedback.isAcceptable ? [] : ['Answer quality could be improved'])
          ]
        };
      }

      return {
        ...result,
        questionAnalysis,
        metadata: {
          ...result.metadata,
          requestId: result.metadata?.requestId || '',
          processingTime: Date.now() - startTime,
          fromCache: result.metadata?.fromCache || false,
          fromFallback: result.metadata?.fromFallback || false
        }
      };

    } catch (error) {
      console.error('AIContentManager: Error generating question answer:', error);
      return {
        success: false,
        errors: [`Question answering error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        metadata: {
          requestId: '',
          processingTime: Date.now() - startTime,
          fromCache: false,
          fromFallback: false
        }
      };
    }
  }

  /**
   * Generate content for a specific form field
   */
  async generateFieldContent(
    fieldLabel: string,
    fieldType: AIContentRequestType,
    userProfile: UserProfile,
    existingContent?: string,
    options: ContentGenerationOptions = {}
  ): Promise<GenerationResult> {
    const jobContext = await this.getJobContext();
    if (!jobContext) {
      return {
        success: false,
        errors: ['Unable to extract job context from current page'],
        metadata: {
          requestId: '',
          processingTime: 0,
          fromCache: false,
          fromFallback: false
        }
      };
    }

    const request = this.requestFormatter.createFieldRequest(
      fieldLabel,
      fieldType,
      userProfile,
      jobContext,
      existingContent,
      options.preferences
    );

    const startTime = Date.now();
    const result = await this.aiClient.generateContent(request);

    if (!result.success || !result.response) {
      return {
        success: false,
        errors: result.error ? [result.error.message] : ['Field content generation failed'],
        metadata: {
          requestId: request.id,
          processingTime: Date.now() - startTime,
          fromCache: result.cached,
          fromFallback: result.fromFallback
        }
      };
    }

    const parseResult = this.responseParser.parseResponse(result.response, fieldType);

    return {
      success: parseResult.success,
      content: parseResult.parsedContent,
      alternatives: result.response.alternatives,
      confidence: result.response.confidence,
      qualityScore: result.response.qualityScore?.overall,
      suggestions: this.responseParser.extractImprovementSuggestions(
        parseResult.parsedContent,
        parseResult.qualityMetrics,
        fieldType
      ),
      warnings: parseResult.warnings,
      errors: parseResult.errors,
      metadata: {
        requestId: request.id,
        processingTime: Date.now() - startTime,
        fromCache: result.cached,
        fromFallback: result.fromFallback
      }
    };
  }

  /**
   * Generate content for multiple fields in batch
   */
  async generateBatchContent(
    fields: Array<{
      label: string;
      type: AIContentRequestType;
      existingContent?: string;
    }>,
    userProfile: UserProfile,
    options: ContentGenerationOptions = {}
  ): Promise<Array<GenerationResult & { fieldLabel: string }>> {
    const jobContext = await this.getJobContext();
    if (!jobContext) {
      const errorResult = {
        success: false,
        errors: ['Unable to extract job context from current page'],
        metadata: {
          requestId: '',
          processingTime: 0,
          fromCache: false,
          fromFallback: false
        }
      };
      return fields.map(field => ({ ...errorResult, fieldLabel: field.label }));
    }

    const requests = this.requestFormatter.createBatchRequest(
      fields,
      userProfile,
      jobContext,
      options.preferences
    );

    // Process requests concurrently with rate limiting
    const results = await this.processBatchRequests(requests, fields);
    return results;
  }

  /**
   * Process batch requests with concurrency control
   */
  private async processBatchRequests(
    requests: AIContentRequest[],
    fields: Array<{ label: string; type: AIContentRequestType; existingContent?: string }>
  ): Promise<Array<GenerationResult & { fieldLabel: string }>> {
    const results: Array<GenerationResult & { fieldLabel: string }> = [];
    const concurrencyLimit = 3; // Limit concurrent requests
    
    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit);
      const batchFields = fields.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (request, index) => {
        const startTime = Date.now();
        const field = batchFields[index];
        
        try {
          const result = await this.aiClient.generateContent(request);
          
          if (!result.success || !result.response) {
            return {
              success: false,
              fieldLabel: field.label,
              errors: result.error ? [result.error.message] : ['Content generation failed'],
              metadata: {
                requestId: request.id,
                processingTime: Date.now() - startTime,
                fromCache: result.cached,
                fromFallback: result.fromFallback
              }
            };
          }

          const parseResult = this.responseParser.parseResponse(result.response, field.type);

          return {
            success: parseResult.success,
            fieldLabel: field.label,
            content: parseResult.parsedContent,
            alternatives: result.response.alternatives,
            confidence: result.response.confidence,
            qualityScore: result.response.qualityScore?.overall,
            suggestions: this.responseParser.extractImprovementSuggestions(
              parseResult.parsedContent,
              parseResult.qualityMetrics,
              field.type
            ),
            warnings: parseResult.warnings,
            errors: parseResult.errors,
            metadata: {
              requestId: request.id,
              processingTime: Date.now() - startTime,
              fromCache: result.cached,
              fromFallback: result.fromFallback
            }
          };
        } catch (error) {
          return {
            success: false,
            fieldLabel: field.label,
            errors: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
            metadata: {
              requestId: request.id,
              processingTime: Date.now() - startTime,
              fromCache: false,
              fromFallback: false
            }
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + concurrencyLimit < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Get job context with caching
   */
  private async getJobContext(): Promise<JobContext | null> {
    const now = Date.now();
    const cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Return cached context if still valid
    if (this.cachedJobContext && (now - this.lastContextExtraction) < cacheTimeout) {
      return this.cachedJobContext;
    }

    // Extract fresh context
    try {
      const context = await this.contextExtractor.extractJobContext();
      if (context) {
        this.cachedJobContext = context;
        this.lastContextExtraction = now;
      }
      return context;
    } catch (error) {
      console.error('AIContentManager: Error extracting job context:', error);
      return this.cachedJobContext; // Return cached version if extraction fails
    }
  }

  /**
   * Clear cached job context
   */
  clearJobContextCache(): void {
    this.cachedJobContext = null;
    this.lastContextExtraction = 0;
  }

  /**
   * Get service health status
   */
  getServiceHealth() {
    return this.aiClient.getHealthStatus();
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.clearJobContextCache();
    this.aiClient.clearCache();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AIContentManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.platform) {
      this.contextExtractor = new JobContextExtractor(newConfig.platform);
      this.clearJobContextCache();
    }
    
    if (newConfig.aiClient) {
      this.aiClient = new AIServiceClient({ ...this.config.aiClient, ...newConfig.aiClient });
    }
  }

  /**
   * Test AI service connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      // Create a simple test request
      const testProfile: UserProfile = {
        id: 'test',
        personalInfo: {
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          phone: '555-0123',
          address: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'US'
          }
        },
        professionalInfo: {
          workExperience: [],
          education: [],
          skills: ['Testing'],
          certifications: []
        },
        preferences: {
          defaultAnswers: {},
          jobPreferences: {
            desiredRoles: [],
            preferredLocations: [],
            salaryRange: { min: 0, max: 100000, currency: 'USD' },
            jobTypes: [],
            workArrangements: []
          },
          privacySettings: {
            shareProfile: false,
            allowAnalytics: false,
            marketingEmails: false
          }
        },
        documents: {
          resumes: [],
          coverLetters: []
        },
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSyncAt: new Date()
        }
      };

      const testJobContext: JobContext = {
        jobTitle: 'Test Position',
        companyName: 'Test Company',
        jobDescription: 'This is a test job description for connectivity testing.',
        requirements: ['Test requirement']
      };

      const request = this.requestFormatter.createRequest(
        'summary',
        testProfile,
        testJobContext,
        {},
        { length: 'short' }
      );

      const result = await this.aiClient.generateContent(request);
      const responseTime = Date.now() - startTime;

      if (result.success) {
        return {
          success: true,
          message: 'AI service is connected and responding',
          responseTime
        };
      } else {
        return {
          success: false,
          message: result.error?.message || 'Connection test failed',
          responseTime
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection test error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    // This would typically be implemented with proper metrics collection
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      lastRequestTime: null
    };
  }
}