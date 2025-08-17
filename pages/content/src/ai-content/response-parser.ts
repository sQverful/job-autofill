/**
 * Response Parser
 * 
 * Parses and validates AI-generated content responses,
 * ensuring quality and proper formatting for job applications.
 */

import type { 
  AIContentResponse, 
  AIContentRequestType,
  ContentQualityMetrics 
} from '@extension/shared/lib/types';
import type { ResponseParsingConfig } from './types.js';

export class ResponseParser {
  private config: ResponseParsingConfig;

  constructor(config?: Partial<ResponseParsingConfig>) {
    this.config = {
      validation: {
        minLength: 10,
        maxLength: 5000,
        requiredElements: [],
        forbiddenPatterns: [
          /\[.*?\]/g, // Remove placeholder brackets
          /\{.*?\}/g, // Remove template variables
          /<.*?>/g,   // Remove HTML tags
        ]
      },
      postProcessing: {
        trimWhitespace: true,
        removeEmptyLines: true,
        formatParagraphs: true,
        addSignature: false
      },
      ...config
    };
  }

  /**
   * Parse and validate AI response
   */
  parseResponse(
    response: AIContentResponse,
    requestType: AIContentRequestType
  ): {
    success: boolean;
    parsedContent: string;
    qualityMetrics: ContentQualityMetrics;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Initial validation
      const validationResult = this.validateResponse(response, requestType);
      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);

      if (validationResult.errors.length > 0) {
        return {
          success: false,
          parsedContent: response.content,
          qualityMetrics: this.calculateQualityMetrics(response.content),
          warnings,
          errors
        };
      }

      // Parse and clean content
      let parsedContent = this.cleanContent(response.content);
      
      // Apply type-specific formatting
      parsedContent = this.applyTypeSpecificFormatting(parsedContent, requestType);
      
      // Post-process content
      parsedContent = this.postProcessContent(parsedContent);
      
      // Final validation
      const finalValidation = this.validateParsedContent(parsedContent, requestType);
      warnings.push(...finalValidation.warnings);
      
      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(parsedContent);
      
      // Add quality-based warnings
      if (qualityMetrics.readabilityScore < 0.6) {
        warnings.push('Content may be difficult to read');
      }
      
      if (qualityMetrics.professionalismScore < 0.7) {
        warnings.push('Content may not sound professional enough');
      }

      return {
        success: true,
        parsedContent,
        qualityMetrics,
        warnings,
        errors
      };

    } catch (error) {
      console.error('ResponseParser: Error parsing response:', error);
      return {
        success: false,
        parsedContent: response.content,
        qualityMetrics: this.calculateQualityMetrics(response.content),
        warnings,
        errors: [...errors, `Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate AI response structure and content
   */
  private validateResponse(
    response: AIContentResponse,
    requestType: AIContentRequestType
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!response.content) {
      errors.push('Response content is empty');
      return { errors, warnings };
    }

    // Check content length
    if (response.content.length < this.config.validation.minLength) {
      errors.push(`Content too short (minimum ${this.config.validation.minLength} characters)`);
    }

    if (response.content.length > this.config.validation.maxLength) {
      warnings.push(`Content very long (${response.content.length} characters)`);
    }

    // Check for forbidden patterns
    for (const pattern of this.config.validation.forbiddenPatterns) {
      if (pattern.test(response.content)) {
        warnings.push('Content contains template placeholders or formatting issues');
        break;
      }
    }

    // Type-specific validation
    const typeValidation = this.validateContentByType(response.content, requestType);
    errors.push(...typeValidation.errors);
    warnings.push(...typeValidation.warnings);

    // Check confidence score
    if (response.confidence < 0.5) {
      warnings.push('AI confidence is low for this response');
    }

    return { errors, warnings };
  }

  /**
   * Validate content based on request type
   */
  private validateContentByType(
    content: string,
    requestType: AIContentRequestType
  ): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lowerContent = content.toLowerCase();

    switch (requestType) {
      case 'cover_letter':
        if (!lowerContent.includes('dear') && !lowerContent.includes('hello')) {
          warnings.push('Cover letter may be missing a proper greeting');
        }
        if (!lowerContent.includes('sincerely') && !lowerContent.includes('best regards') && 
            !lowerContent.includes('thank you')) {
          warnings.push('Cover letter may be missing a proper closing');
        }
        if (content.length < 200) {
          warnings.push('Cover letter seems quite short');
        }
        break;

      case 'question_response':
        if (content.length < 50) {
          warnings.push('Response seems very brief for a question answer');
        }
        if (!this.containsSpecificExample(content)) {
          warnings.push('Response may benefit from specific examples');
        }
        break;

      case 'summary':
        if (content.length > 300) {
          warnings.push('Professional summary is quite long');
        }
        if (!this.containsSkillsOrExperience(content)) {
          warnings.push('Summary may be missing key skills or experience');
        }
        break;

      case 'objective':
        if (content.length > 200) {
          warnings.push('Career objective is quite long');
        }
        if (!lowerContent.includes('seek') && !lowerContent.includes('looking') && 
            !lowerContent.includes('goal')) {
          warnings.push('Objective may not clearly state career goals');
        }
        break;

      case 'why_interested':
        if (!this.containsCompanySpecificContent(content)) {
          warnings.push('Response may benefit from more company-specific details');
        }
        break;

      case 'why_qualified':
        if (!this.containsSpecificExample(content)) {
          warnings.push('Response should include specific examples of qualifications');
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Clean content by removing unwanted elements
   */
  private cleanContent(content: string): string {
    let cleaned = content;

    // Remove forbidden patterns
    for (const pattern of this.config.validation.forbiddenPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Remove common AI artifacts
    cleaned = cleaned.replace(/^(Here's|Here is|I'd be happy to|I can help you with)/i, '');
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Remove excessive line breaks
    cleaned = cleaned.replace(/\s+/g, ' '); // Normalize whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Apply type-specific formatting
   */
  private applyTypeSpecificFormatting(
    content: string,
    requestType: AIContentRequestType
  ): string {
    switch (requestType) {
      case 'cover_letter':
        return this.formatCoverLetter(content);
      
      case 'question_response':
        return this.formatQuestionResponse(content);
      
      case 'summary':
        return this.formatSummary(content);
      
      case 'objective':
        return this.formatObjective(content);
      
      default:
        return content;
    }
  }

  /**
   * Format cover letter content
   */
  private formatCoverLetter(content: string): string {
    let formatted = content;

    // Ensure proper paragraph breaks
    formatted = formatted.replace(/\.\s+([A-Z])/g, '.\n\n$1');
    
    // Ensure greeting is on its own line
    formatted = formatted.replace(/^(Dear[^,]+,)\s*/, '$1\n\n');
    
    // Ensure closing is on its own line
    formatted = formatted.replace(/\s+(Sincerely|Best regards|Thank you)[^,]*,?\s*$/, '\n\n$1,');

    return formatted;
  }

  /**
   * Format question response content
   */
  private formatQuestionResponse(content: string): string {
    // Ensure proper sentence structure
    let formatted = content;
    
    // Add periods if missing at end of sentences
    formatted = formatted.replace(/([a-z])\s+([A-Z])/g, '$1. $2');
    
    return formatted;
  }

  /**
   * Format summary content
   */
  private formatSummary(content: string): string {
    // Ensure summary is concise and well-structured
    let formatted = content;
    
    // Remove redundant phrases
    formatted = formatted.replace(/\b(I am|I'm)\s+/gi, '');
    formatted = formatted.replace(/^(Professional\s+)?summary:?\s*/i, '');
    
    return formatted;
  }

  /**
   * Format objective content
   */
  private formatObjective(content: string): string {
    let formatted = content;
    
    // Remove redundant objective indicators
    formatted = formatted.replace(/^(Career\s+)?objective:?\s*/i, '');
    formatted = formatted.replace(/^(My\s+)?(goal|objective)\s+is\s+to\s+/i, 'To ');
    
    return formatted;
  }

  /**
   * Post-process content according to configuration
   */
  private postProcessContent(content: string): string {
    let processed = content;

    if (this.config.postProcessing.trimWhitespace) {
      processed = processed.trim();
    }

    if (this.config.postProcessing.removeEmptyLines) {
      processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
    }

    if (this.config.postProcessing.formatParagraphs) {
      // Ensure proper paragraph spacing
      processed = processed.replace(/\n{3,}/g, '\n\n');
      processed = processed.replace(/([.!?])\s*\n\s*([A-Z])/g, '$1\n\n$2');
    }

    return processed;
  }

  /**
   * Validate parsed content
   */
  private validateParsedContent(
    content: string,
    requestType: AIContentRequestType
  ): { warnings: string[] } {
    const warnings: string[] = [];

    // Check for common issues
    if (content.includes('  ')) {
      warnings.push('Content contains double spaces');
    }

    if (content.includes('\n\n\n')) {
      warnings.push('Content has excessive line breaks');
    }

    // Check for incomplete sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const incompleteSentences = sentences.filter(s => s.trim().length < 10);
    
    if (incompleteSentences.length > 0) {
      warnings.push('Content may contain incomplete sentences');
    }

    return { warnings };
  }

  /**
   * Calculate quality metrics for content
   */
  private calculateQualityMetrics(content: string): ContentQualityMetrics {
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      readabilityScore: this.calculateReadabilityScore(content, words, sentences),
      keywordRelevance: this.calculateKeywordRelevance(content),
      professionalismScore: this.calculateProfessionalismScore(content),
      uniquenessScore: this.calculateUniquenessScore(content)
    };
  }

  /**
   * Calculate readability score (simplified Flesch Reading Ease)
   */
  private calculateReadabilityScore(content: string, words: string[], sentences: string[]): number {
    if (sentences.length === 0 || words.length === 0) return 0;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = words.reduce((sum, word) => sum + this.countSyllables(word), 0) / words.length;
    
    // Simplified Flesch Reading Ease formula
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    
    // Normalize to 0-1 scale
    return Math.max(0, Math.min(1, score / 100));
  }

  /**
   * Count syllables in a word (approximation)
   */
  private countSyllables(word: string): number {
    const vowels = 'aeiouy';
    let count = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i].toLowerCase());
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }
    
    // Handle silent 'e'
    if (word.endsWith('e') && count > 1) {
      count--;
    }
    
    return Math.max(1, count);
  }

  /**
   * Calculate keyword relevance score
   */
  private calculateKeywordRelevance(content: string): number {
    const professionalKeywords = [
      'experience', 'skills', 'expertise', 'knowledge', 'proficient',
      'accomplished', 'achieved', 'developed', 'managed', 'led',
      'successful', 'proven', 'demonstrated', 'results', 'impact'
    ];
    
    const lowerContent = content.toLowerCase();
    const foundKeywords = professionalKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    );
    
    return foundKeywords.length / professionalKeywords.length;
  }

  /**
   * Calculate professionalism score
   */
  private calculateProfessionalismScore(content: string): number {
    let score = 0.8; // Base score
    
    const lowerContent = content.toLowerCase();
    
    // Positive indicators
    const professionalPhrases = [
      'i am pleased', 'i would welcome', 'i look forward',
      'thank you for', 'i believe', 'i am confident',
      'my experience', 'i have developed', 'i am excited'
    ];
    
    const professionalCount = professionalPhrases.filter(phrase => 
      lowerContent.includes(phrase)
    ).length;
    
    score += (professionalCount / professionalPhrases.length) * 0.2;
    
    // Negative indicators
    const informalWords = [
      'gonna', 'wanna', 'yeah', 'ok', 'cool', 'awesome',
      'super', 'really really', 'totally', 'basically'
    ];
    
    const informalCount = informalWords.filter(word => 
      lowerContent.includes(word)
    ).length;
    
    score -= informalCount * 0.1;
    
    // Check for proper capitalization
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const properlyCapitalized = sentences.filter(s => 
      /^[A-Z]/.test(s.trim())
    ).length;
    
    if (sentences.length > 0) {
      score += (properlyCapitalized / sentences.length) * 0.1;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate uniqueness score (anti-template detection)
   */
  private calculateUniquenessScore(content: string): number {
    const commonTemplatePhases = [
      'i am writing to express my interest',
      'i am excited to apply',
      'please find my resume attached',
      'i look forward to hearing from you',
      'thank you for your consideration'
    ];
    
    const lowerContent = content.toLowerCase();
    const templateCount = commonTemplatePhases.filter(phrase => 
      lowerContent.includes(phrase)
    ).length;
    
    // Higher template usage = lower uniqueness
    return Math.max(0, 1 - (templateCount / commonTemplatePhases.length));
  }

  /**
   * Check if content contains specific examples
   */
  private containsSpecificExample(content: string): boolean {
    const exampleIndicators = [
      'for example', 'for instance', 'specifically', 'in my role',
      'at my previous', 'during my time', 'when i', 'i successfully',
      'i achieved', 'i led', 'i managed', 'i developed'
    ];
    
    const lowerContent = content.toLowerCase();
    return exampleIndicators.some(indicator => lowerContent.includes(indicator));
  }

  /**
   * Check if content contains skills or experience mentions
   */
  private containsSkillsOrExperience(content: string): boolean {
    const skillsKeywords = [
      'experience', 'skilled', 'proficient', 'expertise',
      'knowledge', 'background', 'years', 'specializ'
    ];
    
    const lowerContent = content.toLowerCase();
    return skillsKeywords.some(keyword => lowerContent.includes(keyword));
  }

  /**
   * Check if content contains company-specific information
   */
  private containsCompanySpecificContent(content: string): boolean {
    // This is a simplified check - in practice, you'd compare against known company info
    const companyIndicators = [
      'company', 'organization', 'team', 'mission', 'values',
      'culture', 'reputation', 'industry', 'products', 'services'
    ];
    
    const lowerContent = content.toLowerCase();
    return companyIndicators.some(indicator => lowerContent.includes(indicator));
  }

  /**
   * Extract suggestions for content improvement
   */
  extractImprovementSuggestions(
    content: string,
    qualityMetrics: ContentQualityMetrics,
    requestType: AIContentRequestType
  ): string[] {
    const suggestions: string[] = [];

    if (qualityMetrics.wordCount < 50) {
      suggestions.push('Consider adding more detail to strengthen your response');
    }

    if (qualityMetrics.readabilityScore < 0.6) {
      suggestions.push('Try using shorter sentences and simpler words for better readability');
    }

    if (qualityMetrics.keywordRelevance < 0.3) {
      suggestions.push('Include more relevant professional keywords and terminology');
    }

    if (qualityMetrics.professionalismScore < 0.7) {
      suggestions.push('Use more formal, professional language');
    }

    if (qualityMetrics.uniquenessScore < 0.5) {
      suggestions.push('Make your response more personalized and less template-like');
    }

    // Type-specific suggestions
    if (requestType === 'cover_letter' && !this.containsSpecificExample(content)) {
      suggestions.push('Add specific examples of your achievements or experience');
    }

    if (requestType === 'question_response' && qualityMetrics.wordCount > 200) {
      suggestions.push('Consider making your response more concise');
    }

    return suggestions;
  }
}