/**
 * Answer Quality Validator
 * 
 * Validates and scores the quality of AI-generated answers
 * for job application questions.
 */

import type { QuestionAnalysis } from './question-analyzer.js';

export interface QualityScore {
  overall: number;
  relevance: number;
  completeness: number;
  specificity: number;
  professionalism: number;
  structure: number;
  length: number;
}

export interface QualityFeedback {
  score: QualityScore;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  isAcceptable: boolean;
}

export class AnswerQualityValidator {
  private readonly minAcceptableScore = 0.6;

  /**
   * Validate and score an answer's quality
   */
  validateAnswer(
    answer: string,
    questionAnalysis: QuestionAnalysis,
    originalQuestion: string
  ): QualityFeedback {
    const score = this.calculateQualityScore(answer, questionAnalysis, originalQuestion);
    const strengths = this.identifyStrengths(answer, score);
    const improvements = this.identifyImprovements(answer, score, questionAnalysis);
    const suggestions = this.generateSuggestions(answer, questionAnalysis, score);
    const isAcceptable = score.overall >= this.minAcceptableScore;

    return {
      score,
      strengths,
      improvements,
      suggestions,
      isAcceptable
    };
  }

  /**
   * Calculate comprehensive quality score
   */
  private calculateQualityScore(
    answer: string,
    questionAnalysis: QuestionAnalysis,
    originalQuestion: string
  ): QualityScore {
    const relevance = this.scoreRelevance(answer, questionAnalysis, originalQuestion);
    const completeness = this.scoreCompleteness(answer, questionAnalysis);
    const specificity = this.scoreSpecificity(answer);
    const professionalism = this.scoreProfessionalism(answer);
    const structure = this.scoreStructure(answer, questionAnalysis);
    const length = this.scoreLength(answer, questionAnalysis);

    const overall = (
      relevance * 0.25 +
      completeness * 0.20 +
      specificity * 0.15 +
      professionalism * 0.15 +
      structure * 0.15 +
      length * 0.10
    );

    return {
      overall: Math.round(overall * 100) / 100,
      relevance: Math.round(relevance * 100) / 100,
      completeness: Math.round(completeness * 100) / 100,
      specificity: Math.round(specificity * 100) / 100,
      professionalism: Math.round(professionalism * 100) / 100,
      structure: Math.round(structure * 100) / 100,
      length: Math.round(length * 100) / 100
    };
  }

  /**
   * Score how relevant the answer is to the question
   */
  private scoreRelevance(
    answer: string,
    questionAnalysis: QuestionAnalysis,
    originalQuestion: string
  ): number {
    const answerLower = answer.toLowerCase();
    const questionLower = originalQuestion.toLowerCase();
    
    let relevanceScore = 0.5; // Base score

    // Check if answer addresses question keywords
    const keywordMatches = questionAnalysis.keywords.filter(keyword =>
      answerLower.includes(keyword.toLowerCase())
    ).length;
    
    if (questionAnalysis.keywords.length > 0) {
      relevanceScore += (keywordMatches / questionAnalysis.keywords.length) * 0.3;
    }

    // Check for question-specific patterns
    switch (questionAnalysis.type) {
      case 'behavioral':
        if (this.containsBehavioralElements(answer)) {
          relevanceScore += 0.2;
        }
        break;
      
      case 'motivational':
        if (this.containsMotivationalElements(answer)) {
          relevanceScore += 0.2;
        }
        break;
      
      case 'skills':
        if (this.containsSkillsElements(answer)) {
          relevanceScore += 0.2;
        }
        break;
      
      case 'experience':
        if (this.containsExperienceElements(answer)) {
          relevanceScore += 0.2;
        }
        break;
    }

    return Math.min(relevanceScore, 1.0);
  }

  /**
   * Score how complete the answer is
   */
  private scoreCompleteness(answer: string, questionAnalysis: QuestionAnalysis): number {
    let completenessScore = 0.5;

    const wordCount = answer.split(/\s+/).length;
    const expectedMinWords = this.getExpectedWordCount(questionAnalysis.expectedLength).min;
    
    if (wordCount >= expectedMinWords) {
      completenessScore += 0.3;
    } else {
      completenessScore -= 0.2;
    }

    // Check for complete thoughts (sentences ending with punctuation)
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length >= 2) {
      completenessScore += 0.2;
    }

    // Check if answer addresses the question directly
    if (this.addressesQuestionDirectly(answer, questionAnalysis)) {
      completenessScore += 0.2;
    }

    return Math.min(completenessScore, 1.0);
  }

  /**
   * Score how specific and detailed the answer is
   */
  private scoreSpecificity(answer: string): number {
    let specificityScore = 0.3;

    // Check for specific examples
    const exampleIndicators = [
      'for example', 'for instance', 'specifically', 'in particular',
      'such as', 'including', 'like when', 'one time'
    ];
    
    if (exampleIndicators.some(indicator => 
      answer.toLowerCase().includes(indicator)
    )) {
      specificityScore += 0.2;
    }

    // Check for quantifiable details
    const numberPattern = /\d+/g;
    const numbers = answer.match(numberPattern);
    if (numbers && numbers.length > 0) {
      specificityScore += 0.2;
    }

    // Check for specific company/role mentions
    if (this.containsSpecificReferences(answer)) {
      specificityScore += 0.2;
    }

    // Avoid generic phrases
    const genericPhrases = [
      'i am a hard worker', 'i am passionate', 'i am dedicated',
      'i work well in teams', 'i am a quick learner'
    ];
    
    const genericCount = genericPhrases.filter(phrase =>
      answer.toLowerCase().includes(phrase)
    ).length;
    
    specificityScore -= genericCount * 0.1;

    return Math.max(0, Math.min(specificityScore, 1.0));
  }

  /**
   * Score the professionalism of the answer
   */
  private scoreProfessionalism(answer: string): number {
    let professionalismScore = 0.7; // Start with good base score

    // Check for professional language
    const professionalIndicators = [
      'experience', 'skills', 'expertise', 'knowledge', 'proficient',
      'accomplished', 'achieved', 'developed', 'managed', 'led',
      'successful', 'proven', 'demonstrated', 'results', 'impact'
    ];

    const professionalCount = professionalIndicators.filter(indicator =>
      answer.toLowerCase().includes(indicator)
    ).length;

    professionalismScore += Math.min(professionalCount * 0.02, 0.2);

    // Check for proper grammar and structure
    if (this.hasProperCapitalization(answer)) {
      professionalismScore += 0.05;
    }

    if (this.hasProperPunctuation(answer)) {
      professionalismScore += 0.05;
    }

    // Penalize for informal language
    const informalWords = [
      'gonna', 'wanna', 'yeah', 'ok', 'cool', 'awesome',
      'super', 'really really', 'totally', 'basically'
    ];

    const informalCount = informalWords.filter(word =>
      answer.toLowerCase().includes(word)
    ).length;

    professionalismScore -= informalCount * 0.1;

    return Math.max(0, Math.min(professionalismScore, 1.0));
  }

  /**
   * Score the structure and organization of the answer
   */
  private scoreStructure(answer: string, questionAnalysis: QuestionAnalysis): number {
    let structureScore = 0.5;

    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Check for appropriate number of sentences
    if (sentences.length >= 2 && sentences.length <= 8) {
      structureScore += 0.2;
    }

    // Check for logical flow (transition words)
    const transitionWords = [
      'first', 'second', 'then', 'next', 'finally', 'however',
      'therefore', 'additionally', 'furthermore', 'as a result'
    ];

    if (transitionWords.some(word => answer.toLowerCase().includes(word))) {
      structureScore += 0.15;
    }

    // Check for STAR method in behavioral questions
    if (questionAnalysis.type === 'behavioral' && this.followsSTARMethod(answer)) {
      structureScore += 0.25;
    }

    // Check for clear opening and closing
    if (this.hasClearOpening(answer)) {
      structureScore += 0.1;
    }

    return Math.min(structureScore, 1.0);
  }

  /**
   * Score the appropriateness of answer length
   */
  private scoreLength(answer: string, questionAnalysis: QuestionAnalysis): number {
    const wordCount = answer.split(/\s+/).length;
    const expectedRange = this.getExpectedWordCount(questionAnalysis.expectedLength);
    
    if (wordCount >= expectedRange.min && wordCount <= expectedRange.max) {
      return 1.0;
    } else if (wordCount < expectedRange.min) {
      // Too short
      const ratio = wordCount / expectedRange.min;
      return Math.max(ratio, 0.3);
    } else {
      // Too long
      const ratio = expectedRange.max / wordCount;
      return Math.max(ratio, 0.5);
    }
  }

  /**
   * Get expected word count range for different length categories
   */
  private getExpectedWordCount(expectedLength: string): { min: number; max: number } {
    switch (expectedLength) {
      case 'short':
        return { min: 20, max: 75 };
      case 'medium':
        return { min: 50, max: 150 };
      case 'long':
        return { min: 100, max: 300 };
      default:
        return { min: 50, max: 150 };
    }
  }

  /**
   * Check if answer contains behavioral elements (STAR method)
   */
  private containsBehavioralElements(answer: string): boolean {
    const behavioralIndicators = [
      'situation', 'task', 'action', 'result', 'challenge', 'problem',
      'when i', 'i faced', 'i handled', 'i managed', 'i led',
      'the outcome', 'as a result', 'this resulted in'
    ];

    return behavioralIndicators.some(indicator =>
      answer.toLowerCase().includes(indicator)
    );
  }

  /**
   * Check if answer contains motivational elements
   */
  private containsMotivationalElements(answer: string): boolean {
    const motivationalIndicators = [
      'interested', 'excited', 'passionate', 'motivated', 'drawn to',
      'appeals to me', 'aligns with', 'opportunity', 'growth', 'learn'
    ];

    return motivationalIndicators.some(indicator =>
      answer.toLowerCase().includes(indicator)
    );
  }

  /**
   * Check if answer contains skills elements
   */
  private containsSkillsElements(answer: string): boolean {
    const skillsIndicators = [
      'skilled in', 'proficient', 'experience with', 'expertise',
      'knowledge of', 'familiar with', 'trained in', 'certified'
    ];

    return skillsIndicators.some(indicator =>
      answer.toLowerCase().includes(indicator)
    );
  }

  /**
   * Check if answer contains experience elements
   */
  private containsExperienceElements(answer: string): boolean {
    const experienceIndicators = [
      'years of', 'previous role', 'in my experience', 'worked on',
      'responsible for', 'achieved', 'accomplished', 'delivered'
    ];

    return experienceIndicators.some(indicator =>
      answer.toLowerCase().includes(indicator)
    );
  }

  /**
   * Check if answer addresses the question directly
   */
  private addressesQuestionDirectly(answer: string, questionAnalysis: QuestionAnalysis): boolean {
    // This is a simplified check - could be enhanced with NLP
    const answerStart = answer.substring(0, 50).toLowerCase();
    
    const directIndicators = [
      'yes', 'no', 'i believe', 'i think', 'in my opinion',
      'my experience', 'i would', 'i have', 'i am'
    ];

    return directIndicators.some(indicator => answerStart.includes(indicator));
  }

  /**
   * Check if answer contains specific references
   */
  private containsSpecificReferences(answer: string): boolean {
    // Look for specific company names, technologies, numbers, etc.
    const specificPatterns = [
      /\b[A-Z][a-z]+ [A-Z][a-z]+\b/, // Company names (Title Case)
      /\$[\d,]+/, // Dollar amounts
      /\d+%/, // Percentages
      /\d+ (years?|months?|weeks?|days?)/, // Time periods
      /\d+ (people|team members|employees)/ // Team sizes
    ];

    return specificPatterns.some(pattern => pattern.test(answer));
  }

  /**
   * Check if answer follows STAR method
   */
  private followsSTARMethod(answer: string): boolean {
    const starIndicators = {
      situation: ['situation', 'context', 'background', 'when'],
      task: ['task', 'goal', 'objective', 'needed to'],
      action: ['i did', 'i took', 'i implemented', 'my approach'],
      result: ['result', 'outcome', 'achieved', 'accomplished']
    };

    let starCount = 0;
    for (const [, indicators] of Object.entries(starIndicators)) {
      if (indicators.some(indicator => answer.toLowerCase().includes(indicator))) {
        starCount++;
      }
    }

    return starCount >= 3; // At least 3 out of 4 STAR elements
  }

  /**
   * Check if answer has proper capitalization
   */
  private hasProperCapitalization(answer: string): boolean {
    const sentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const properlyCapitalized = sentences.filter(sentence => {
      const trimmed = sentence.trim();
      return trimmed.length > 0 && /^[A-Z]/.test(trimmed);
    });

    return properlyCapitalized.length / sentences.length >= 0.8;
  }

  /**
   * Check if answer has proper punctuation
   */
  private hasProperPunctuation(answer: string): boolean {
    // Check if sentences end with proper punctuation
    const sentences = answer.split(/[.!?]+/);
    return sentences.length > 1; // At least one sentence ending found
  }

  /**
   * Check if answer has a clear opening
   */
  private hasClearOpening(answer: string): boolean {
    const openingPhrases = [
      'in my experience', 'i believe', 'i would say', 'from my perspective',
      'based on my', 'i have found', 'in my previous role', 'i am confident'
    ];

    const firstSentence = answer.split(/[.!?]/)[0].toLowerCase();
    return openingPhrases.some(phrase => firstSentence.includes(phrase));
  }

  /**
   * Identify strengths in the answer
   */
  private identifyStrengths(answer: string, score: QualityScore): string[] {
    const strengths: string[] = [];

    if (score.relevance >= 0.8) {
      strengths.push('Directly addresses the question');
    }

    if (score.specificity >= 0.7) {
      strengths.push('Provides specific examples and details');
    }

    if (score.professionalism >= 0.8) {
      strengths.push('Uses professional language and tone');
    }

    if (score.structure >= 0.7) {
      strengths.push('Well-organized and easy to follow');
    }

    if (score.completeness >= 0.8) {
      strengths.push('Comprehensive and thorough response');
    }

    return strengths;
  }

  /**
   * Identify areas for improvement
   */
  private identifyImprovements(
    answer: string,
    score: QualityScore,
    questionAnalysis: QuestionAnalysis
  ): string[] {
    const improvements: string[] = [];

    if (score.relevance < 0.6) {
      improvements.push('Better address the specific question asked');
    }

    if (score.specificity < 0.5) {
      improvements.push('Add more specific examples and concrete details');
    }

    if (score.professionalism < 0.6) {
      improvements.push('Use more professional language and terminology');
    }

    if (score.structure < 0.5) {
      improvements.push('Improve organization and logical flow');
    }

    if (score.length < 0.6) {
      const wordCount = answer.split(/\s+/).length;
      const expected = this.getExpectedWordCount(questionAnalysis.expectedLength);
      
      if (wordCount < expected.min) {
        improvements.push('Provide a more detailed response');
      } else {
        improvements.push('Make the response more concise');
      }
    }

    return improvements;
  }

  /**
   * Generate specific suggestions for improvement
   */
  private generateSuggestions(
    answer: string,
    questionAnalysis: QuestionAnalysis,
    score: QualityScore
  ): string[] {
    const suggestions: string[] = [];

    if (questionAnalysis.type === 'behavioral' && !this.followsSTARMethod(answer)) {
      suggestions.push('Consider using the STAR method: Situation, Task, Action, Result');
    }

    if (score.specificity < 0.6) {
      suggestions.push('Include specific numbers, dates, or measurable outcomes');
      suggestions.push('Mention specific tools, technologies, or methodologies used');
    }

    if (score.relevance < 0.7) {
      suggestions.push('Ensure your answer directly relates to the question asked');
      suggestions.push('Include keywords from the job description or question');
    }

    if (questionAnalysis.category === 'why_interested' && !answer.toLowerCase().includes('company')) {
      suggestions.push('Research and mention specific aspects of the company that interest you');
    }

    if (questionAnalysis.category === 'why_qualified' && score.completeness < 0.7) {
      suggestions.push('Highlight your most relevant qualifications and achievements');
    }

    return suggestions;
  }
}