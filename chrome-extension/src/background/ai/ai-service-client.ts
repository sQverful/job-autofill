/**
 * OpenAI API service client for smart autofill functionality
 * Handles authentication, form analysis, and response processing
 */

import type { 
  AIFormAnalysis, 
  AITokenValidationResult, 
  AIError, 
  AIErrorContext, 
  AIErrorResolution,
  ExtractedHTML,
  UserProfile
} from '@extension/shared';
import type { AISettingsStorageType } from '@extension/storage';
import { aiSettingsStorage } from '@extension/storage';
// Temporarily disable these imports to fix service worker compatibility
// import { aiPerformanceMonitor } from './ai-performance-monitor';
// import { aiErrorHandler } from './ai-error-handler';
// import { aiCacheManager } from './ai-cache-manager';
import { 
  JOB_APPLICATION_SYSTEM_PROMPT,
  buildUserPrompt, 
  sanitizeHTMLForAnalysis, 
  extractFormMetadata,
  validateAnalysisResponse 
} from './prompt-templates';

// OpenAI API configuration
export interface OpenAIConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  maxTokens: number;
  temperature: number;
}

// Default OpenAI configuration
const DEFAULT_CONFIG: OpenAIConfig = {
  baseUrl: 'https://api.openai.com/v1',
  timeout: 25000, // 25 seconds for AI requests (increased for complex forms)
  retryAttempts: 2, // Reduced retries to prevent long delays
  retryDelay: 1000, // 1 second retry delay
  maxTokens: 2000,
  temperature: 0.3,
};

// OpenAI API request/response types
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens: number;
  temperature: number;
  response_format?: { type: 'json_object' };
}

interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

// Simplified interfaces for service worker compatibility

/**
 * Simplified OpenAI API service client for service worker compatibility
 */
export class AIServiceClient {
  private config: OpenAIConfig;

  constructor(config: Partial<OpenAIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate OpenAI API token
   */
  async validateToken(token?: string): Promise<AITokenValidationResult> {
    try {
      const tokenToValidate = token || await aiSettingsStorage.getToken();
      
      if (!tokenToValidate) {
        return {
          isValid: false,
          error: 'No API token provided'
        };
      }

      // Basic format validation
      if (!tokenToValidate.startsWith('sk-')) {
        return {
          isValid: false,
          error: 'Invalid token format. OpenAI tokens should start with "sk-"'
        };
      }

      // Test API call to validate token
      const response = await this.makeRequest('/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenToValidate}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Extract available models
        const availableModels = data.data?.map((model: any) => model.id) || [];
        const hasGPT4 = availableModels.some((model: string) => model.includes('gpt-4'));
        const hasGPT35 = availableModels.some((model: string) => model.includes('gpt-3.5'));

        return {
          isValid: true,
          model: hasGPT4 ? 'gpt-4' : hasGPT35 ? 'gpt-3.5-turbo' : 'unknown',
          rateLimitInfo: {
            requestsPerMinute: 60, // Default OpenAI limits
            tokensPerMinute: 90000,
            requestsPerDay: 200,
          },
        };
      } else {
        const errorData = await response.json() as OpenAIErrorResponse;
        return {
          isValid: false,
          error: errorData.error?.message || 'Token validation failed'
        };
      }
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Token validation failed',
      };
    }
  }

  /**
   * Analyze HTML form structure using OpenAI
   */
  async analyzeForm(
    extractedHTML: ExtractedHTML,
    userProfile: UserProfile,
    jobContext?: any
  ): Promise<AIFormAnalysis> {
    const token = await aiSettingsStorage.getToken();
    if (!token) {
      throw new Error('No API token available');
    }

    const settings = await aiSettingsStorage.get();
    
    console.log('AI Analysis: Making API request');
    const systemPrompt = await this.buildSystemPrompt();
    const userPrompt = await this.buildUserPrompt(extractedHTML, userProfile, jobContext);

    const request: OpenAIRequest = {
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      response_format: { type: 'json_object' }
    };

    const response = await this.makeOpenAIRequest('/chat/completions', request, token);
    const analysis = await this.parseFormAnalysisResponse(response, extractedHTML);
    
    // Log token usage
    this.logTokenUsage(response, 'Form Analysis');
    
    return analysis;
  }

  /**
   * Build system prompt for form analysis
   */
  private async buildSystemPrompt(): Promise<string> {
    return JOB_APPLICATION_SYSTEM_PROMPT;
  }

  /**
   * Build user prompt with form HTML and profile data
   */
  private async buildUserPrompt(
    extractedHTML: ExtractedHTML,
    userProfile: UserProfile,
    jobContext?: any
  ): Promise<string> {
    // Sanitize HTML for analysis
    const sanitizedHTML = sanitizeHTMLForAnalysis(extractedHTML.html);
    
    // Extract additional metadata
    const formMetadata = extractFormMetadata(sanitizedHTML, extractedHTML.metadata.url);
    
    return buildUserPrompt(sanitizedHTML, userProfile, jobContext, formMetadata);
  }

  /**
   * Generate hash for user profile to use in cache keys
   */
  private async generateProfileHash(userProfile: UserProfile): Promise<string> {
    const relevantData = {
      personal: userProfile.personalInfo,
      experience: userProfile.workExperience?.slice(0, 3),
      education: userProfile.education?.slice(0, 2),
      skills: userProfile.skills?.slice(0, 10),
    };
    
    const profileString = JSON.stringify(relevantData);
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < profileString.length; i++) {
      const char = profileString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Parse OpenAI response into AIFormAnalysis
   */
  private async parseFormAnalysisResponse(
    response: OpenAIResponse,
    extractedHTML: ExtractedHTML
  ): Promise<AIFormAnalysis> {
    try {
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      
      // Validate response structure using prompt templates
      if (!validateAnalysisResponse(parsed)) {
        throw new Error('Invalid response format: failed validation');
      }

      // Validate each instruction
      const validatedInstructions = parsed.instructions.map((instruction: any, index: number) => {
        if (!instruction.action || !instruction.selector) {
          throw new Error(`Invalid instruction at index ${index}: missing action or selector`);
        }

        return {
          action: instruction.action,
          selector: instruction.selector,
          value: instruction.value || '',
          options: instruction.options || [],
          reasoning: instruction.reasoning || '',
          confidence: Math.max(0, Math.min(100, instruction.confidence || 50)),
          priority: Math.max(1, Math.min(10, instruction.priority || 5))
        };
      });

      return {
        instructions: validatedInstructions,
        confidence: Math.max(0, Math.min(100, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'Form analysis completed',
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
        metadata: {
          analysisId: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          model: response.model,
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } catch (error: any) {
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Make OpenAI API request
   */
  private async makeOpenAIRequest(
    endpoint: string,
    data: OpenAIRequest,
    token: string
  ): Promise<OpenAIResponse> {
    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json() as OpenAIErrorResponse;
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }

      throw error;
    }
  }

  // Simplified request handling - no complex queueing for service worker compatibility

  // Complex queueing and batching methods removed for service worker compatibility

  // Rate limiting and error handling methods simplified for service worker compatibility

  /**
   * Log token usage for API requests
   */
  private logTokenUsage(response: OpenAIResponse, operation: string): void {
    const usage = response.usage;
    if (!usage) return;

    const cost = this.estimateCost(usage.total_tokens, response.model);
    
    console.group(`🤖 AI API Usage - ${operation}`);
    console.log(`📊 Tokens Used: ${usage.total_tokens.toLocaleString()}`);
    console.log(`   ├─ Prompt: ${usage.prompt_tokens.toLocaleString()}`);
    console.log(`   └─ Completion: ${usage.completion_tokens.toLocaleString()}`);
    console.log(`💰 Estimated Cost: $${cost.toFixed(4)}`);
    console.log(`🤖 Model: ${response.model}`);
    console.log(`⏱️ Timestamp: ${new Date().toLocaleTimeString()}`);
    console.groupEnd();

    // Track cumulative usage
    this.updateCumulativeUsage(usage.total_tokens, cost);
  }

  /**
   * Estimate cost based on model and token usage
   */
  private estimateCost(tokens: number, model: string): number {
    // OpenAI pricing (as of 2024) - approximate rates
    const rates: Record<string, number> = {
      'gpt-4': 0.00003, // $0.03 per 1K tokens
      'gpt-4-turbo': 0.00001, // $0.01 per 1K tokens  
      'gpt-3.5-turbo': 0.000002, // $0.002 per 1K tokens
    };

    const modelKey = Object.keys(rates).find(key => model?.includes(key)) || 'gpt-3.5-turbo';
    return (tokens / 1000) * rates[modelKey];
  }

  /**
   * Estimate token usage for a request
   */
  private estimateTokenUsage(request: OpenAIRequest): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    const messageContent = request.messages.map(m => m.content).join(' ');
    const estimatedInputTokens = Math.ceil(messageContent.length / 4);
    const estimatedOutputTokens = request.max_tokens || 2000;
    
    return estimatedInputTokens + estimatedOutputTokens;
  }

  /**
   * Track cumulative token usage
   */
  private updateCumulativeUsage(tokens: number, cost: number): void {
    if (!(globalThis as any).aiUsageTracker) {
      (globalThis as any).aiUsageTracker = {
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        sessionStart: new Date(),
      };
    }

    const tracker = (globalThis as any).aiUsageTracker;
    tracker.totalTokens += tokens;
    tracker.totalCost += cost;
    tracker.requestCount += 1;

    // Log session summary every 5 requests
    if (tracker.requestCount % 5 === 0) {
      console.group('📈 AI Usage Session Summary');
      console.log(`🔢 Total Requests: ${tracker.requestCount}`);
      console.log(`📊 Total Tokens: ${tracker.totalTokens.toLocaleString()}`);
      console.log(`💰 Total Cost: $${tracker.totalCost.toFixed(4)}`);
      console.log(`⏱️ Session Duration: ${Math.round((Date.now() - tracker.sessionStart.getTime()) / 1000 / 60)} minutes`);
      console.groupEnd();
    }
  }

  // Simplified error creation for service worker compatibility

  /**
   * Get error resolution strategy
   */
  getErrorResolution(error: any): AIErrorResolution {
    const errorType = (error as any).type as AIError;
    
    switch (errorType) {
      case 'INVALID_TOKEN':
        return {
          action: 'user_action_required',
          message: 'Please check your OpenAI API token in settings',
        };
      
      case 'API_RATE_LIMIT':
        return {
          action: 'retry',
          message: 'Rate limit exceeded. Retrying in a moment...',
          retryDelay: 60000, // 1 minute
          maxRetries: 3,
        };
      
      case 'API_QUOTA_EXCEEDED':
        return {
          action: 'user_action_required',
          message: 'OpenAI API quota exceeded. Please check your billing settings.',
        };
      
      case 'NETWORK_ERROR':
        return {
          action: 'retry',
          message: 'Network error. Retrying...',
          retryDelay: 5000, // 5 seconds
          maxRetries: 3,
        };
      
      case 'PARSING_ERROR':
      case 'INVALID_RESPONSE':
        return {
          action: 'fallback',
          message: 'AI analysis failed. Falling back to traditional autofill.',
          fallbackStrategy: 'traditional_autofill',
        };
      
      default:
        return {
          action: 'fallback',
          message: 'AI autofill encountered an error. Using traditional autofill.',
          fallbackStrategy: 'traditional_autofill',
        };
    }
  }
}

// Export singleton instance
export const aiServiceClient = new AIServiceClient();