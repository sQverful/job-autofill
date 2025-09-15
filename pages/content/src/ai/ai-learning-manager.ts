/**
 * AI Learning Manager
 * Handles learning from user interactions and improving AI accuracy over time
 */

import type { 
  FormInstruction, 
  ExecutionResult, 
  UserProfile, 
  AIFormAnalysis 
} from '@extension/shared';

export interface LearningEvent {
  type: 'success' | 'failure' | 'correction';
  instruction: FormInstruction;
  actualValue?: string;
  expectedValue?: string;
  timestamp: Date;
  url: string;
  formContext: {
    domain: string;
    formType: string;
    fieldCount: number;
  };
}

export interface SuccessPattern {
  selector: string;
  action: string;
  value: string;
  domain: string;
  successCount: number;
  lastUsed: Date;
}

export interface FeedbackData {
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  timestamp: Date;
  url: string;
  analysisId: string;
}

export interface UsageAnalytics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageAccuracy: number;
  averageExecutionTime: number;
  lastUsed: Date;
  dailyUsage: Record<string, number>;
  monthlyUsage: Record<string, number>;
}

/**
 * AI Learning Manager implementation
 */
export class AILearningManager {
  private learningEvents: LearningEvent[] = [];
  private successPatterns: Map<string, SuccessPattern> = new Map();
  private feedbackData: FeedbackData[] = [];
  private usageAnalytics: UsageAnalytics;

  constructor() {
    this.usageAnalytics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageAccuracy: 0,
      averageExecutionTime: 0,
      lastUsed: new Date(),
      dailyUsage: {},
      monthlyUsage: {}
    };

    this.loadLearningData();
  }

  /**
   * Record a learning event from instruction execution
   */
  recordLearningEvent(
    instruction: FormInstruction,
    result: ExecutionResult,
    url: string
  ): void {
    const domain = new URL(url).hostname;
    const event: LearningEvent = {
      type: result.success ? 'success' : 'failure',
      instruction,
      actualValue: result.actualValue,
      expectedValue: instruction.value,
      timestamp: new Date(),
      url,
      formContext: {
        domain,
        formType: this.detectFormType(url),
        fieldCount: 1 // This could be enhanced to count total fields
      }
    };

    this.learningEvents.push(event);
    
    // Update success patterns
    if (result.success) {
      this.updateSuccessPattern(instruction, domain);
    }

    // Update usage analytics
    this.updateUsageAnalytics(result);

    // Keep only last 1000 events
    if (this.learningEvents.length > 1000) {
      this.learningEvents = this.learningEvents.slice(-1000);
    }

    this.saveLearningData();
  }

  /**
   * Record user correction for learning
   */
  recordUserCorrection(
    originalInstruction: FormInstruction,
    correctedValue: string,
    url: string
  ): void {
    const domain = new URL(url).hostname;
    const event: LearningEvent = {
      type: 'correction',
      instruction: originalInstruction,
      actualValue: correctedValue,
      expectedValue: originalInstruction.value,
      timestamp: new Date(),
      url,
      formContext: {
        domain,
        formType: this.detectFormType(url),
        fieldCount: 1
      }
    };

    this.learningEvents.push(event);
    
    // Update success pattern with corrected value
    const correctedInstruction = { ...originalInstruction, value: correctedValue };
    this.updateSuccessPattern(correctedInstruction, domain);

    this.saveLearningData();
  }

  /**
   * Record user feedback on AI performance
   */
  recordFeedback(
    rating: 1 | 2 | 3 | 4 | 5,
    comment: string | undefined,
    analysisId: string,
    url: string
  ): void {
    const feedback: FeedbackData = {
      rating,
      comment,
      timestamp: new Date(),
      url,
      analysisId
    };

    this.feedbackData.push(feedback);

    // Keep only last 100 feedback entries
    if (this.feedbackData.length > 100) {
      this.feedbackData = this.feedbackData.slice(-100);
    }

    this.saveLearningData();
  }

  /**
   * Get success patterns for optimization
   */
  getSuccessPatterns(domain?: string): SuccessPattern[] {
    const patterns = Array.from(this.successPatterns.values());
    
    if (domain) {
      return patterns.filter(pattern => pattern.domain === domain);
    }
    
    return patterns.sort((a, b) => b.successCount - a.successCount);
  }

  /**
   * Get learning insights for analytics
   */
  getLearningInsights(): {
    totalEvents: number;
    successRate: number;
    topDomains: Array<{ domain: string; count: number }>;
    recentCorrections: number;
    averageFeedbackRating: number;
    usageAnalytics: UsageAnalytics;
  } {
    const domainCounts = new Map<string, number>();
    let corrections = 0;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    this.learningEvents.forEach(event => {
      const domain = new URL(event.url).hostname;
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      
      if (event.type === 'correction' && event.timestamp > thirtyDaysAgo) {
        corrections++;
      }
    });

    const topDomains = Array.from(domainCounts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const averageFeedbackRating = this.feedbackData.length > 0
      ? this.feedbackData.reduce((sum, feedback) => sum + feedback.rating, 0) / this.feedbackData.length
      : 0;

    return {
      totalEvents: this.learningEvents.length,
      successRate: this.usageAnalytics.averageAccuracy,
      topDomains,
      recentCorrections: corrections,
      averageFeedbackRating,
      usageAnalytics: this.usageAnalytics
    };
  }

  /**
   * Get optimization suggestions based on learning data
   */
  getOptimizationSuggestions(): Array<{
    type: 'pattern' | 'correction' | 'feedback';
    suggestion: string;
    confidence: number;
  }> {
    const suggestions: Array<{
      type: 'pattern' | 'correction' | 'feedback';
      suggestion: string;
      confidence: number;
    }> = [];

    // Analyze success patterns
    const patterns = this.getSuccessPatterns();
    if (patterns.length > 0) {
      const topPattern = patterns[0];
      suggestions.push({
        type: 'pattern',
        suggestion: `Consider prioritizing ${topPattern.action} actions on ${topPattern.domain} - ${topPattern.successCount} successes`,
        confidence: Math.min(topPattern.successCount / 10, 1)
      });
    }

    // Analyze corrections
    const recentCorrections = this.learningEvents
      .filter(event => event.type === 'correction')
      .slice(-10);
    
    if (recentCorrections.length > 5) {
      suggestions.push({
        type: 'correction',
        suggestion: 'High number of recent corrections detected - consider reviewing AI prompts',
        confidence: recentCorrections.length / 10
      });
    }

    // Analyze feedback
    const recentFeedback = this.feedbackData.slice(-10);
    if (recentFeedback.length > 0) {
      const avgRating = recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length;
      if (avgRating < 3) {
        suggestions.push({
          type: 'feedback',
          suggestion: `Low user satisfaction (${avgRating.toFixed(1)}/5) - consider improving AI accuracy`,
          confidence: (3 - avgRating) / 2
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Export learning data for analysis
   */
  exportLearningData(): {
    events: LearningEvent[];
    patterns: SuccessPattern[];
    feedback: FeedbackData[];
    analytics: UsageAnalytics;
    insights: ReturnType<typeof this.getLearningInsights>;
  } {
    return {
      events: this.learningEvents,
      patterns: Array.from(this.successPatterns.values()),
      feedback: this.feedbackData,
      analytics: this.usageAnalytics,
      insights: this.getLearningInsights()
    };
  }

  /**
   * Clear learning data (for privacy)
   */
  clearLearningData(): void {
    this.learningEvents = [];
    this.successPatterns.clear();
    this.feedbackData = [];
    this.usageAnalytics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageAccuracy: 0,
      averageExecutionTime: 0,
      lastUsed: new Date(),
      dailyUsage: {},
      monthlyUsage: {}
    };

    this.saveLearningData();
  }

  /**
   * Update success pattern
   */
  private updateSuccessPattern(instruction: FormInstruction, domain: string): void {
    const patternKey = `${domain}:${instruction.action}:${instruction.selector}`;
    const existing = this.successPatterns.get(patternKey);

    if (existing) {
      existing.successCount++;
      existing.lastUsed = new Date();
      existing.value = instruction.value || existing.value;
    } else {
      this.successPatterns.set(patternKey, {
        selector: instruction.selector,
        action: instruction.action,
        value: instruction.value || '',
        domain,
        successCount: 1,
        lastUsed: new Date()
      });
    }
  }

  /**
   * Update usage analytics
   */
  private updateUsageAnalytics(result: ExecutionResult): void {
    this.usageAnalytics.totalOperations++;
    
    if (result.success) {
      this.usageAnalytics.successfulOperations++;
    } else {
      this.usageAnalytics.failedOperations++;
    }

    this.usageAnalytics.averageAccuracy = 
      this.usageAnalytics.successfulOperations / this.usageAnalytics.totalOperations;

    // Update execution time average
    const currentAvg = this.usageAnalytics.averageExecutionTime;
    const newTime = result.executionTime;
    this.usageAnalytics.averageExecutionTime = 
      (currentAvg * (this.usageAnalytics.totalOperations - 1) + newTime) / this.usageAnalytics.totalOperations;

    this.usageAnalytics.lastUsed = new Date();

    // Update daily/monthly usage
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);
    
    this.usageAnalytics.dailyUsage[today] = (this.usageAnalytics.dailyUsage[today] || 0) + 1;
    this.usageAnalytics.monthlyUsage[thisMonth] = (this.usageAnalytics.monthlyUsage[thisMonth] || 0) + 1;
  }

  /**
   * Detect form type from URL
   */
  private detectFormType(url: string): string {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('apply') || urlLower.includes('application')) {
      return 'job_application';
    }
    if (urlLower.includes('contact')) {
      return 'contact_form';
    }
    if (urlLower.includes('signup') || urlLower.includes('register')) {
      return 'registration';
    }
    if (urlLower.includes('login')) {
      return 'login';
    }
    
    return 'unknown';
  }

  /**
   * Load learning data from storage
   */
  private async loadLearningData(): Promise<void> {
    try {
      const stored = localStorage.getItem('ai-learning-data');
      if (stored) {
        const data = JSON.parse(stored);
        this.learningEvents = data.events || [];
        this.feedbackData = data.feedback || [];
        this.usageAnalytics = { ...this.usageAnalytics, ...data.analytics };
        
        // Restore success patterns
        if (data.patterns) {
          data.patterns.forEach((pattern: SuccessPattern) => {
            const key = `${pattern.domain}:${pattern.action}:${pattern.selector}`;
            this.successPatterns.set(key, pattern);
          });
        }
      }
    } catch (error) {
      console.warn('[AILearningManager] Failed to load learning data:', error);
    }
  }

  /**
   * Save learning data to storage
   */
  private saveLearningData(): void {
    try {
      const data = {
        events: this.learningEvents,
        patterns: Array.from(this.successPatterns.values()),
        feedback: this.feedbackData,
        analytics: this.usageAnalytics
      };
      
      localStorage.setItem('ai-learning-data', JSON.stringify(data));
    } catch (error) {
      console.warn('[AILearningManager] Failed to save learning data:', error);
    }
  }
}

// Export singleton instance
export const aiLearningManager = new AILearningManager();