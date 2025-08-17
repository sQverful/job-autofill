/**
 * AI Service Client
 * 
 * Handles communication with AI content generation services,
 * including request management, caching, and error handling.
 */

import type { 
  AIContentRequest, 
  AIContentResponse, 
  ContentGenerationResult,
  AIContentError 
} from '@extension/shared/lib/types';
import type { AIClientConfig, ServiceHealthStatus } from './types.js';

export class AIServiceClient {
  private config: AIClientConfig;
  private cache: Map<string, { response: AIContentResponse; expiresAt: number }>;
  private healthStatus: ServiceHealthStatus;

  constructor(config: AIClientConfig) {
    this.config = config;
    this.cache = new Map();
    this.healthStatus = {
      available: true,
      responseTime: 0,
      errorRate: 0,
      lastCheck: new Date(),
      version: '1.0.0',
      features: ['content_generation', 'caching', 'retry']
    };
  }

  /**
   * Generate AI content based on request
   */
  async generateContent(request: AIContentRequest): Promise<ContentGenerationResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first if enabled
      if (this.config.cache.enabled) {
        const cached = this.getCachedResponse(request);
        if (cached) {
          return {
            success: true,
            response: cached,
            cached: true,
            fromFallback: false
          };
        }
      }

      // Check service health
      if (!this.healthStatus.available) {
        return this.handleServiceUnavailable();
      }

      // Make API request
      const response = await this.makeAPIRequest(request);
      
      // Cache successful response
      if (this.config.cache.enabled && response) {
        this.cacheResponse(request, response);
      }

      // Update health metrics
      this.updateHealthMetrics(Date.now() - startTime, true);

      return {
        success: true,
        response,
        cached: false,
        fromFallback: false
      };

    } catch (error) {
      console.error('AIServiceClient: Error generating content:', error);
      
      // Update health metrics
      this.updateHealthMetrics(Date.now() - startTime, false);
      
      // Try fallback strategies
      const fallbackResult = await this.tryFallbackStrategies(request);
      if (fallbackResult) {
        return fallbackResult;
      }

      return {
        success: false,
        error: this.createErrorFromException(error),
        cached: false,
        fromFallback: false
      };
    }
  }

  /**
   * Make HTTP request to AI service
   */
  private async makeAPIRequest(request: AIContentRequest): Promise<AIContentResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(this.config.endpoints.generate, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...this.config.headers
        },
        body: JSON.stringify(this.formatRequestPayload(request)),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseAPIResponse(data, request);

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Format request payload for API
   */
  private formatRequestPayload(request: AIContentRequest): any {
    return {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: this.buildSystemPrompt(request)
        },
        {
          role: 'user',
          content: this.buildUserPrompt(request)
        }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      metadata: {
        request_id: request.id,
        user_id: request.metadata.userId,
        type: request.type
      }
    };
  }

  /**
   * Build system prompt for AI
   */
  private buildSystemPrompt(request: AIContentRequest): string {
    const basePrompt = `You are a professional career assistant helping job seekers create compelling application materials. 
Your responses should be professional, personalized, and tailored to the specific job and company.`;

    const typeSpecificPrompts = {
      cover_letter: 'Create a professional cover letter that highlights relevant experience and demonstrates genuine interest in the role.',
      question_response: 'Provide a thoughtful, specific answer that showcases relevant skills and experience.',
      summary: 'Write a concise professional summary that highlights key qualifications and career achievements.',
      objective: 'Create a clear career objective that aligns with the job requirements and company goals.',
      why_interested: 'Explain genuine interest in the role and company, connecting personal goals with the opportunity.',
      why_qualified: 'Highlight specific qualifications, skills, and experiences that make the candidate ideal for this role.',
      custom_response: 'Provide a tailored response that addresses the specific question or prompt.'
    };

    return `${basePrompt}\n\n${typeSpecificPrompts[request.type] || typeSpecificPrompts.custom_response}`;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(request: AIContentRequest): string {
    const { context, preferences } = request;
    
    let prompt = `Please help me create content for a job application.\n\n`;
    
    // Add job context
    if (context.jobDescription) {
      prompt += `Job Description:\n${context.jobDescription}\n\n`;
    }
    
    if (context.companyInfo) {
      prompt += `Company: ${context.companyInfo}\n\n`;
    }

    if (context.specificQuestion) {
      prompt += `Question: ${context.specificQuestion}\n\n`;
    }

    // Add user profile context
    prompt += `My Background:\n`;
    if (context.userProfile.professionalInfo.workExperience.length > 0) {
      prompt += `Work Experience: ${context.userProfile.professionalInfo.workExperience
        .map(exp => `${exp.title} at ${exp.company} (${exp.duration})`)
        .join(', ')}\n`;
    }
    
    if (context.userProfile.professionalInfo.skills.length > 0) {
      prompt += `Skills: ${context.userProfile.professionalInfo.skills.join(', ')}\n`;
    }

    if (context.userProfile.professionalInfo.education.length > 0) {
      prompt += `Education: ${context.userProfile.professionalInfo.education
        .map(edu => `${edu.degree} in ${edu.field} from ${edu.institution}`)
        .join(', ')}\n`;
    }

    // Add preferences
    prompt += `\nPreferences:\n`;
    prompt += `- Tone: ${preferences.tone}\n`;
    prompt += `- Length: ${preferences.length}\n`;
    
    if (preferences.focus.length > 0) {
      prompt += `- Focus on: ${preferences.focus.join(', ')}\n`;
    }

    if (preferences.customInstructions) {
      prompt += `- Additional instructions: ${preferences.customInstructions}\n`;
    }

    return prompt;
  }

  /**
   * Parse API response
   */
  private parseAPIResponse(data: any, request: AIContentRequest): AIContentResponse {
    const content = data.choices?.[0]?.message?.content || data.content || '';
    
    return {
      id: this.generateResponseId(),
      requestId: request.id,
      content: content.trim(),
      confidence: this.calculateConfidence(content, data),
      suggestions: this.extractSuggestions(data),
      alternatives: data.alternatives || [],
      metadata: {
        generatedAt: new Date(),
        model: this.config.model,
        tokens: data.usage?.total_tokens || 0,
        processingTime: Date.now() - request.metadata.requestedAt.getTime(),
        version: this.healthStatus.version
      },
      qualityScore: this.calculateQualityScore(content)
    };
  }

  /**
   * Calculate content confidence score
   */
  private calculateConfidence(content: string, apiData: any): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on content length
    if (content.length < 50) confidence -= 0.2;
    if (content.length > 500) confidence += 0.1;

    // Adjust based on API confidence if available
    if (apiData.confidence) {
      confidence = (confidence + apiData.confidence) / 2;
    }

    // Adjust based on token usage efficiency
    if (apiData.usage?.total_tokens) {
      const efficiency = Math.min(apiData.usage.total_tokens / this.config.maxTokens, 1);
      confidence += (efficiency - 0.5) * 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Extract suggestions from API response
   */
  private extractSuggestions(data: any): string[] {
    return data.suggestions || [];
  }

  /**
   * Calculate quality score for content
   */
  private calculateQualityScore(content: string): AIContentResponse['qualityScore'] {
    const wordCount = content.split(/\s+/).length;
    const sentenceCount = content.split(/[.!?]+/).length;
    
    // Basic quality metrics
    const relevance = this.calculateRelevanceScore(content);
    const coherence = this.calculateCoherenceScore(content);
    const professionalism = this.calculateProfessionalismScore(content);
    
    return {
      relevance,
      coherence,
      professionalism,
      overall: (relevance + coherence + professionalism) / 3
    };
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevanceScore(content: string): number {
    // Simple keyword-based relevance scoring
    const professionalKeywords = [
      'experience', 'skills', 'qualified', 'expertise', 'background',
      'achievements', 'results', 'successful', 'proven', 'demonstrated'
    ];
    
    const lowerContent = content.toLowerCase();
    const keywordCount = professionalKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    ).length;
    
    return Math.min(keywordCount / 5, 1); // Normalize to 0-1
  }

  /**
   * Calculate coherence score
   */
  private calculateCoherenceScore(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return 0.5;
    
    // Simple coherence check based on sentence length variation
    const lengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    
    // Lower variance indicates better coherence
    return Math.max(0, 1 - (variance / 100));
  }

  /**
   * Calculate professionalism score
   */
  private calculateProfessionalismScore(content: string): number {
    let score = 0.8; // Base score
    
    // Check for professional language
    const professionalPhrases = [
      'i am', 'i have', 'my experience', 'i would', 'i believe',
      'dear', 'sincerely', 'best regards', 'thank you'
    ];
    
    const lowerContent = content.toLowerCase();
    const professionalCount = professionalPhrases.filter(phrase => 
      lowerContent.includes(phrase)
    ).length;
    
    score += (professionalCount / professionalPhrases.length) * 0.2;
    
    // Penalize for informal language
    const informalWords = ['gonna', 'wanna', 'yeah', 'ok', 'cool', 'awesome'];
    const informalCount = informalWords.filter(word => 
      lowerContent.includes(word)
    ).length;
    
    score -= informalCount * 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get cached response if available and not expired
   */
  private getCachedResponse(request: AIContentRequest): AIContentResponse | null {
    const cacheKey = this.generateCacheKey(request);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.response;
    }
    
    // Remove expired entry
    if (cached) {
      this.cache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Cache response
   */
  private cacheResponse(request: AIContentRequest, response: AIContentResponse): void {
    const cacheKey = this.generateCacheKey(request);
    const expiresAt = Date.now() + (this.config.cache.ttl * 1000);
    
    // Check cache size limit
    if (this.cache.size >= this.config.cache.maxSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(cacheKey, { response, expiresAt });
  }

  /**
   * Generate cache key for request
   */
  private generateCacheKey(request: AIContentRequest): string {
    const keyData = {
      type: request.type,
      jobDescription: request.context.jobDescription?.substring(0, 100),
      userProfile: request.context.userProfile.id,
      preferences: request.preferences
    };
    
    return btoa(JSON.stringify(keyData));
  }

  /**
   * Try fallback strategies when main service fails
   */
  private async tryFallbackStrategies(request: AIContentRequest): Promise<ContentGenerationResult | null> {
    // Try cached responses from similar requests
    const similarCached = this.findSimilarCachedResponse(request);
    if (similarCached) {
      return {
        success: true,
        response: similarCached,
        cached: true,
        fromFallback: true
      };
    }

    // Try template-based fallback
    const templateResponse = this.generateTemplateResponse(request);
    if (templateResponse) {
      return {
        success: true,
        response: templateResponse,
        cached: false,
        fromFallback: true
      };
    }

    return null;
  }

  /**
   * Find similar cached response
   */
  private findSimilarCachedResponse(request: AIContentRequest): AIContentResponse | null {
    // Simple similarity check based on request type and user profile
    for (const [key, cached] of this.cache.entries()) {
      if (cached.expiresAt > Date.now()) {
        try {
          const keyData = JSON.parse(atob(key));
          if (keyData.type === request.type && 
              keyData.userProfile === request.context.userProfile.id) {
            return cached.response;
          }
        } catch (error) {
          // Invalid cache key, skip
        }
      }
    }
    
    return null;
  }

  /**
   * Generate template-based response as fallback
   */
  private generateTemplateResponse(request: AIContentRequest): AIContentResponse | null {
    const templates = {
      cover_letter: `Dear Hiring Manager,

I am writing to express my interest in the position at ${request.context.companyInfo || 'your company'}. With my background in ${request.context.userProfile.professionalInfo.skills.slice(0, 3).join(', ')}, I believe I would be a valuable addition to your team.

${request.context.userProfile.professionalInfo.workExperience.length > 0 ? 
  `In my previous role as ${request.context.userProfile.professionalInfo.workExperience[0].title}, I gained valuable experience that directly relates to this position.` : 
  'I am eager to bring my skills and enthusiasm to this role.'}

Thank you for considering my application. I look forward to hearing from you.

Best regards,
${request.context.userProfile.personalInfo.firstName} ${request.context.userProfile.personalInfo.lastName}`,
      
      question_response: `Based on my experience and background, I believe I can contribute significantly to this role. My skills in ${request.context.userProfile.professionalInfo.skills.slice(0, 2).join(' and ')} align well with the requirements.`,
      
      summary: `${request.context.userProfile.professionalInfo.workExperience.length > 0 ? 
        `Experienced professional with a background in ${request.context.userProfile.professionalInfo.workExperience[0].title}.` : 
        'Motivated professional'} Skilled in ${request.context.userProfile.professionalInfo.skills.slice(0, 3).join(', ')}.`
    };

    const template = templates[request.type as keyof typeof templates];
    if (!template) return null;

    return {
      id: this.generateResponseId(),
      requestId: request.id,
      content: template,
      confidence: 0.6, // Lower confidence for template responses
      suggestions: [],
      alternatives: [],
      metadata: {
        generatedAt: new Date(),
        model: 'template',
        tokens: template.split(/\s+/).length,
        processingTime: 0,
        version: 'fallback-1.0'
      },
      qualityScore: {
        relevance: 0.7,
        coherence: 0.8,
        professionalism: 0.9,
        overall: 0.8
      }
    };
  }

  /**
   * Handle service unavailable scenario
   */
  private handleServiceUnavailable(): ContentGenerationResult {
    return {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI content generation service is currently unavailable',
        type: 'service_unavailable',
        retryable: true,
        retryAfter: 60
      },
      cached: false,
      fromFallback: false
    };
  }

  /**
   * Create error from exception
   */
  private createErrorFromException(error: any): AIContentError {
    if (error.name === 'AbortError') {
      return {
        code: 'TIMEOUT',
        message: 'Request timed out',
        type: 'network',
        retryable: true
      };
    }

    if (error.message?.includes('401')) {
      return {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
        type: 'authentication',
        retryable: false
      };
    }

    if (error.message?.includes('429')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Rate limit exceeded',
        type: 'rate_limit',
        retryable: true,
        retryAfter: 60
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      type: 'service_unavailable',
      retryable: true
    };
  }

  /**
   * Update health metrics
   */
  private updateHealthMetrics(responseTime: number, success: boolean): void {
    this.healthStatus.responseTime = responseTime;
    this.healthStatus.lastCheck = new Date();
    
    // Simple error rate calculation (could be enhanced with sliding window)
    if (!success) {
      this.healthStatus.errorRate = Math.min(this.healthStatus.errorRate + 0.1, 1);
      this.healthStatus.available = this.healthStatus.errorRate < 0.5;
    } else {
      this.healthStatus.errorRate = Math.max(this.healthStatus.errorRate - 0.05, 0);
      this.healthStatus.available = true;
    }
  }

  /**
   * Generate unique response ID
   */
  private generateResponseId(): string {
    return `ai_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current service health status
   */
  getHealthStatus(): ServiceHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}