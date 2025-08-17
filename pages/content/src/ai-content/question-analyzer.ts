/**
 * Question Analyzer
 * 
 * Analyzes and classifies job application questions to provide
 * better context-aware AI responses.
 */

import type { AIContentRequestType } from '@extension/shared/lib/types';

export interface QuestionAnalysis {
  type: QuestionType;
  category: QuestionCategory;
  intent: QuestionIntent;
  keywords: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  expectedLength: 'short' | 'medium' | 'long';
  confidence: number;
  suggestedApproach: string[];
}

export type QuestionType = 
  | 'behavioral'
  | 'situational'
  | 'technical'
  | 'motivational'
  | 'experience'
  | 'skills'
  | 'cultural_fit'
  | 'career_goals'
  | 'open_ended';

export type QuestionCategory =
  | 'why_interested'
  | 'why_qualified'
  | 'experience_examples'
  | 'problem_solving'
  | 'leadership'
  | 'teamwork'
  | 'challenges'
  | 'achievements'
  | 'career_development'
  | 'company_culture'
  | 'general';

export type QuestionIntent =
  | 'assess_fit'
  | 'evaluate_skills'
  | 'understand_motivation'
  | 'gauge_experience'
  | 'test_problem_solving'
  | 'check_cultural_alignment'
  | 'explore_career_goals'
  | 'verify_qualifications';

export class QuestionAnalyzer {
  private behavioralPatterns = [
    'tell me about a time',
    'describe a situation',
    'give me an example',
    'can you share an experience',
    'walk me through',
    'how did you handle',
    'what would you do if'
  ];

  private motivationalPatterns = [
    'why do you want',
    'what interests you',
    'why are you interested',
    'what attracts you',
    'why this company',
    'why this role',
    'what motivates you'
  ];

  private skillsPatterns = [
    'what are your strengths',
    'describe your skills',
    'what can you bring',
    'how would you',
    'what is your experience with',
    'rate your proficiency',
    'how familiar are you'
  ];

  private experiencePatterns = [
    'years of experience',
    'previous role',
    'in your last job',
    'tell me about your background',
    'describe your experience',
    'what have you worked on'
  ];

  /**
   * Analyze a question to determine its type, intent, and optimal response approach
   */
  analyzeQuestion(questionText: string, fieldContext?: string): QuestionAnalysis {
    const normalizedText = this.normalizeText(questionText);
    const fullContext = fieldContext ? `${questionText} ${fieldContext}` : questionText;
    const normalizedContext = this.normalizeText(fullContext);

    const type = this.classifyQuestionType(normalizedText);
    const category = this.categorizeQuestion(normalizedContext);
    const intent = this.determineIntent(normalizedContext, type);
    const keywords = this.extractKeywords(normalizedText);
    const complexity = this.assessComplexity(normalizedText);
    const expectedLength = this.determineExpectedLength(normalizedText, type);
    const confidence = this.calculateConfidence(normalizedText, type, category);
    const suggestedApproach = this.generateApproachSuggestions(type, category, intent);

    return {
      type,
      category,
      intent,
      keywords,
      complexity,
      expectedLength,
      confidence,
      suggestedApproach
    };
  }

  /**
   * Get the most appropriate AI content type for a question
   */
  getContentTypeForQuestion(analysis: QuestionAnalysis): AIContentRequestType {
    switch (analysis.category) {
      case 'why_interested':
        return 'why_interested';
      case 'why_qualified':
        return 'why_qualified';
      case 'experience_examples':
      case 'problem_solving':
      case 'leadership':
      case 'teamwork':
      case 'challenges':
      case 'achievements':
        return 'question_response';
      case 'career_development':
      case 'career_goals':
        return 'objective';
      default:
        return 'question_response';
    }
  }

  /**
   * Generate response guidelines based on question analysis
   */
  generateResponseGuidelines(analysis: QuestionAnalysis): {
    structure: string[];
    keyPoints: string[];
    examples: string[];
    tone: string;
    length: string;
  } {
    const guidelines = {
      structure: [] as string[],
      keyPoints: [] as string[],
      examples: [] as string[],
      tone: 'professional',
      length: analysis.expectedLength
    };

    switch (analysis.type) {
      case 'behavioral':
        guidelines.structure = [
          'Start with a brief context',
          'Describe the specific situation',
          'Explain the actions you took',
          'Share the positive results or outcomes',
          'Reflect on what you learned'
        ];
        guidelines.keyPoints = [
          'Use the STAR method (Situation, Task, Action, Result)',
          'Be specific and quantify results when possible',
          'Focus on your individual contributions',
          'Show problem-solving skills'
        ];
        guidelines.examples = [
          'In my previous role at [Company], I faced a situation where...',
          'The challenge was to... within a tight deadline',
          'I took the initiative to... which resulted in...'
        ];
        break;

      case 'motivational':
        guidelines.structure = [
          'Express genuine interest',
          'Connect to your career goals',
          'Mention specific aspects that appeal to you',
          'Show you\'ve researched the company/role'
        ];
        guidelines.keyPoints = [
          'Be authentic and specific',
          'Avoid generic responses',
          'Connect your values to the company\'s mission',
          'Show long-term thinking'
        ];
        guidelines.examples = [
          'I\'m particularly drawn to this role because...',
          'Your company\'s commitment to... aligns with my values',
          'This opportunity would allow me to...'
        ];
        break;

      case 'skills':
        guidelines.structure = [
          'State your relevant skills clearly',
          'Provide specific examples of application',
          'Mention any certifications or training',
          'Connect skills to the role requirements'
        ];
        guidelines.keyPoints = [
          'Match skills to job requirements',
          'Provide concrete examples',
          'Show continuous learning',
          'Quantify your proficiency level'
        ];
        break;

      case 'experience':
        guidelines.structure = [
          'Summarize relevant experience',
          'Highlight key achievements',
          'Show progression and growth',
          'Connect to the target role'
        ];
        guidelines.keyPoints = [
          'Focus on relevant experience',
          'Quantify achievements',
          'Show career progression',
          'Demonstrate impact'
        ];
        break;

      default:
        guidelines.structure = [
          'Address the question directly',
          'Provide specific examples',
          'Show your thought process',
          'Connect to the role/company'
        ];
        guidelines.keyPoints = [
          'Be clear and concise',
          'Use specific examples',
          'Show your value proposition',
          'Demonstrate fit for the role'
        ];
    }

    return guidelines;
  }

  /**
   * Normalize text for analysis
   */
  private normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Classify the type of question
   */
  private classifyQuestionType(text: string): QuestionType {
    if (this.matchesPatterns(text, this.behavioralPatterns)) {
      return 'behavioral';
    }

    if (this.matchesPatterns(text, this.motivationalPatterns)) {
      return 'motivational';
    }

    if (this.matchesPatterns(text, this.skillsPatterns)) {
      return 'skills';
    }

    if (this.matchesPatterns(text, this.experiencePatterns)) {
      return 'experience';
    }

    if (text.includes('technical') || text.includes('coding') || text.includes('programming')) {
      return 'technical';
    }

    if (text.includes('culture') || text.includes('team') || text.includes('values')) {
      return 'cultural_fit';
    }

    if (text.includes('career') || text.includes('future') || text.includes('goals')) {
      return 'career_goals';
    }

    if (text.includes('situation') || text.includes('scenario') || text.includes('would you')) {
      return 'situational';
    }

    return 'open_ended';
  }

  /**
   * Categorize the question into specific categories
   */
  private categorizeQuestion(text: string): QuestionCategory {
    const categoryPatterns = {
      why_interested: ['why interested', 'why do you want', 'what attracts', 'why this', 'why are you interested'],
      why_qualified: ['why qualified', 'why should we hire', 'what makes you suitable'],
      challenges: ['challenge', 'difficult', 'conflict', 'disagreement', 'faced a difficult challenge'],
      experience_examples: ['tell me about a time', 'give an example', 'describe a situation'],
      problem_solving: ['problem', 'solve', 'difficult situation', 'obstacle'],
      leadership: ['leadership', 'lead a team', 'manage', 'supervise'],
      teamwork: ['team', 'collaborate', 'work with others', 'group project'],
      achievements: ['achievement', 'accomplishment', 'proud of', 'success'],
      career_development: ['career', 'professional development', 'growth', 'future'],
      company_culture: ['culture', 'values', 'work environment', 'team dynamics']
    };

    // Check patterns in order of specificity (more specific first)
    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      if (this.matchesPatterns(text, patterns)) {
        return category as QuestionCategory;
      }
    }

    return 'general';
  }

  /**
   * Determine the intent behind the question
   */
  private determineIntent(text: string, type: QuestionType): QuestionIntent {
    const intentMap: Record<QuestionType, QuestionIntent> = {
      behavioral: 'evaluate_skills',
      situational: 'test_problem_solving',
      technical: 'verify_qualifications',
      motivational: 'understand_motivation',
      experience: 'gauge_experience',
      skills: 'evaluate_skills',
      cultural_fit: 'check_cultural_alignment',
      career_goals: 'explore_career_goals',
      open_ended: 'assess_fit'
    };

    return intentMap[type] || 'assess_fit';
  }

  /**
   * Extract relevant keywords from the question
   */
  private extractKeywords(text: string): string[] {
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'you', 'your', 'me', 'my', 'we', 'our', 'they', 'their', 'it', 'its'
    ]);

    return text.split(' ')
      .filter(word => word.length > 2 && !commonWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  /**
   * Assess the complexity of the question
   */
  private assessComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = text.split(' ').length;
    const hasMultipleParts = text.includes('and') || text.includes('or') || text.includes('also');
    const hasConditionals = text.includes('if') || text.includes('when') || text.includes('how');

    if (wordCount > 20 || (hasMultipleParts && hasConditionals)) {
      return 'complex';
    } else if (wordCount > 10 || hasMultipleParts || hasConditionals) {
      return 'moderate';
    } else {
      return 'simple';
    }
  }

  /**
   * Determine expected response length
   */
  private determineExpectedLength(text: string, type: QuestionType): 'short' | 'medium' | 'long' {
    const lengthIndicators = {
      short: ['briefly', 'in a few words', 'summarize', 'list'],
      long: ['describe in detail', 'explain thoroughly', 'tell me about', 'walk me through']
    };

    if (this.matchesPatterns(text, lengthIndicators.short)) {
      return 'short';
    }

    if (this.matchesPatterns(text, lengthIndicators.long) || type === 'behavioral') {
      return 'long';
    }

    return 'medium';
  }

  /**
   * Calculate confidence in the analysis
   */
  private calculateConfidence(text: string, type: QuestionType, category: QuestionCategory): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for clear patterns
    if (type !== 'open_ended') confidence += 0.2;
    if (category !== 'general') confidence += 0.2;

    // Adjust based on text clarity
    const wordCount = text.split(' ').length;
    if (wordCount >= 5 && wordCount <= 30) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Generate approach suggestions for answering the question
   */
  private generateApproachSuggestions(
    type: QuestionType, 
    category: QuestionCategory, 
    intent: QuestionIntent
  ): string[] {
    const suggestions: string[] = [];

    switch (type) {
      case 'behavioral':
        suggestions.push('Use the STAR method (Situation, Task, Action, Result)');
        suggestions.push('Choose a specific, relevant example from your experience');
        suggestions.push('Quantify results and impact where possible');
        break;

      case 'motivational':
        suggestions.push('Research the company and role beforehand');
        suggestions.push('Connect your personal values to the company mission');
        suggestions.push('Be specific about what excites you');
        break;

      case 'skills':
        suggestions.push('Match your skills to the job requirements');
        suggestions.push('Provide concrete examples of skill application');
        suggestions.push('Mention relevant certifications or training');
        break;

      case 'experience':
        suggestions.push('Focus on relevant experience for this role');
        suggestions.push('Highlight progression and growth');
        suggestions.push('Quantify achievements and impact');
        break;

      default:
        suggestions.push('Address the question directly and clearly');
        suggestions.push('Use specific examples to support your points');
        suggestions.push('Connect your response to the role requirements');
    }

    // Add category-specific suggestions
    if (category === 'problem_solving') {
      suggestions.push('Show your analytical thinking process');
      suggestions.push('Demonstrate creativity in finding solutions');
    }

    if (category === 'leadership') {
      suggestions.push('Highlight your ability to influence and motivate others');
      suggestions.push('Show how you handle responsibility and decision-making');
    }

    return suggestions;
  }

  /**
   * Check if text matches any of the given patterns
   */
  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }
}