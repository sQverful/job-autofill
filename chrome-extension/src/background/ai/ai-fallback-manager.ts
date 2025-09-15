/**
 * AI Fallback Manager
 * Handles automatic fallback to traditional autofill when AI fails
 */

import type { 
  AIErrorResolution,
  AutofillResult,
  AIAutofillResult,
  AIFormAnalysis,
  ExecutionResult
} from '@extension/shared';
import type { EnhancedAIError } from './ai-error-handler.js';

// Fallback strategy configuration
export interface FallbackConfig {
  enableAutoFallback: boolean;
  fallbackTimeout: number;
  maxFallbackAttempts: number;
  fallbackStrategies: FallbackStrategy[];
  notifyUser: boolean;
}

// Individual fallback strategy
export interface FallbackStrategy {
  name: string;
  priority: number;
  conditions: FallbackCondition[];
  handler: () => Promise<AutofillResult>;
  description: string;
}

// Conditions for when to use a fallback strategy
export interface FallbackCondition {
  errorTypes?: string[];
  operationTypes?: string[];
  minFailureCount?: number;
  timeWindow?: number; // milliseconds
}

// Fallback execution result
export interface FallbackResult {
  success: boolean;
  strategyUsed: string;
  result?: AutofillResult;
  error?: string;
  executionTime: number;
  fallbackReason: string;
}

/**
 * AI Fallback Manager
 */
export class AIFallbackManager {
  private static instance: AIFallbackManager;
  private config: FallbackConfig;
  private fallbackStrategies: Map<string, FallbackStrategy> = new Map();
  private fallbackHistory: FallbackResult[] = [];
  private isInitialized = false;

  private constructor() {
    this.config = this.getDefaultConfig();
  }

  static getInstance(): AIFallbackManager {
    if (!AIFallbackManager.instance) {
      AIFallbackManager.instance = new AIFallbackManager();
    }
    return AIFallbackManager.instance;
  }

  /**
   * Initialize fallback manager with strategies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.registerDefaultStrategies();
      this.isInitialized = true;
      console.log('[AIFallbackManager] Initialized with', this.fallbackStrategies.size, 'strategies');
    } catch (error) {
      console.error('[AIFallbackManager] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get default fallback configuration
   */
  private getDefaultConfig(): FallbackConfig {
    return {
      enableAutoFallback: true,
      fallbackTimeout: 30000, // 30 seconds
      maxFallbackAttempts: 3,
      fallbackStrategies: [],
      notifyUser: true
    };
  }

  /**
   * Register default fallback strategies
   */
  private async registerDefaultStrategies(): Promise<void> {
    // Strategy 1: Enhanced Autofill
    this.registerStrategy({
      name: 'enhanced_autofill',
      priority: 1,
      conditions: [
        {
          errorTypes: ['API_RATE_LIMIT', 'API_QUOTA_EXCEEDED', 'NETWORK_ERROR', 'INVALID_RESPONSE'],
          minFailureCount: 1
        }
      ],
      handler: async () => {
        return await this.executeEnhancedAutofill();
      },
      description: 'Use Enhanced Autofill with intelligent field detection'
    });

    // Strategy 2: On-Demand Autofill
    this.registerStrategy({
      name: 'on_demand_autofill',
      priority: 2,
      conditions: [
        {
          errorTypes: ['EXECUTION_FAILED', 'PARSING_ERROR'],
          minFailureCount: 1
        }
      ],
      handler: async () => {
        return await this.executeOnDemandAutofill();
      },
      description: 'Use On-Demand Autofill with manual field mapping'
    });

    // Strategy 3: Basic Form Fill
    this.registerStrategy({
      name: 'basic_form_fill',
      priority: 3,
      conditions: [
        {
          errorTypes: ['INVALID_TOKEN', 'ENCRYPTION_ERROR'],
          minFailureCount: 1
        }
      ],
      handler: async () => {
        return await this.executeBasicFormFill();
      },
      description: 'Basic form filling using simple field matching'
    });

    // Strategy 4: Manual Mode
    this.registerStrategy({
      name: 'manual_mode',
      priority: 4,
      conditions: [
        {
          minFailureCount: 3
        }
      ],
      handler: async () => {
        return await this.executeManualMode();
      },
      description: 'Provide manual filling guidance to user'
    });
  }

  /**
   * Register a fallback strategy
   */
  registerStrategy(strategy: FallbackStrategy): void {
    this.fallbackStrategies.set(strategy.name, strategy);
    console.log(`[AIFallbackManager] Registered strategy: ${strategy.name}`);
  }

  /**
   * Execute fallback based on error and context
   */
  async executeFallback(
    error: EnhancedAIError,
    resolution: AIErrorResolution,
    context: {
      operation: string;
      url?: string;
      formData?: any;
    }
  ): Promise<FallbackResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.config.enableAutoFallback) {
      return {
        success: false,
        strategyUsed: 'none',
        error: 'Auto-fallback is disabled',
        executionTime: 0,
        fallbackReason: 'Fallback disabled in configuration'
      };
    }

    const startTime = performance.now();
    const fallbackReason = `AI ${error.type}: ${error.message}`;

    try {
      // Find appropriate fallback strategy
      const strategy = this.selectFallbackStrategy(error, context);
      
      if (!strategy) {
        return {
          success: false,
          strategyUsed: 'none',
          error: 'No suitable fallback strategy found',
          executionTime: performance.now() - startTime,
          fallbackReason
        };
      }

      console.log(`[AIFallbackManager] Executing fallback strategy: ${strategy.name}`);

      // Execute fallback with timeout
      const result = await this.executeWithTimeout(
        strategy.handler,
        this.config.fallbackTimeout,
        strategy.name
      );

      const fallbackResult: FallbackResult = {
        success: result.success,
        strategyUsed: strategy.name,
        result,
        executionTime: performance.now() - startTime,
        fallbackReason
      };

      // Record fallback execution
      this.recordFallback(fallbackResult);

      // Notify user if configured
      if (this.config.notifyUser) {
        this.notifyUserOfFallback(strategy, result);
      }

      return fallbackResult;

    } catch (fallbackError: any) {
      const fallbackResult: FallbackResult = {
        success: false,
        strategyUsed: 'unknown',
        error: fallbackError.message,
        executionTime: performance.now() - startTime,
        fallbackReason
      };

      this.recordFallback(fallbackResult);
      return fallbackResult;
    }
  }

  /**
   * Select appropriate fallback strategy based on error and context
   */
  private selectFallbackStrategy(
    error: EnhancedAIError,
    context: { operation: string; url?: string; formData?: any }
  ): FallbackStrategy | null {
    const candidates: Array<{ strategy: FallbackStrategy; score: number }> = [];

    for (const strategy of this.fallbackStrategies.values()) {
      const score = this.calculateStrategyScore(strategy, error, context);
      if (score > 0) {
        candidates.push({ strategy, score });
      }
    }

    // Sort by score (descending) then by priority (ascending)
    candidates.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.strategy.priority - b.strategy.priority;
    });

    return candidates.length > 0 ? candidates[0].strategy : null;
  }

  /**
   * Calculate strategy suitability score
   */
  private calculateStrategyScore(
    strategy: FallbackStrategy,
    error: EnhancedAIError,
    context: { operation: string; url?: string; formData?: any }
  ): number {
    let score = 0;

    for (const condition of strategy.conditions) {
      // Check error type match
      if (condition.errorTypes) {
        if (condition.errorTypes.includes(error.type)) {
          score += 10;
        } else {
          continue; // Skip this condition if error type doesn't match
        }
      }

      // Check operation type match
      if (condition.operationTypes) {
        if (condition.operationTypes.includes(context.operation)) {
          score += 5;
        } else {
          continue; // Skip this condition if operation type doesn't match
        }
      }

      // Check failure count
      if (condition.minFailureCount) {
        const recentFailures = this.getRecentFailureCount(context.operation, condition.timeWindow);
        if (recentFailures >= condition.minFailureCount) {
          score += 3;
        }
      }
    }

    // Bonus for higher priority strategies
    score += (10 - strategy.priority);

    return score;
  }

  /**
   * Get recent failure count for an operation
   */
  private getRecentFailureCount(operation: string, timeWindow: number = 300000): number {
    const cutoff = Date.now() - timeWindow;
    return this.fallbackHistory.filter(result => 
      !result.success && 
      result.executionTime > cutoff
    ).length;
  }

  /**
   * Execute Enhanced Autofill fallback
   */
  private async executeEnhancedAutofill(): Promise<AutofillResult> {
    try {
      // Send message to content script to execute enhanced autofill
      return await this.executeContentScriptFallback('enhanced_autofill');
    } catch (error: any) {
      throw new Error(`Enhanced Autofill fallback failed: ${error.message}`);
    }
  }

  /**
   * Execute On-Demand Autofill fallback
   */
  private async executeOnDemandAutofill(): Promise<AutofillResult> {
    try {
      // Send message to content script to execute on-demand autofill
      return await this.executeContentScriptFallback('on_demand_autofill');
    } catch (error: any) {
      throw new Error(`On-Demand Autofill fallback failed: ${error.message}`);
    }
  }

  /**
   * Execute Basic Form Fill fallback
   */
  private async executeBasicFormFill(): Promise<AutofillResult> {
    try {
      // Send message to content script to execute basic form fill
      return await this.executeContentScriptFallback('basic_form_fill');
    } catch (error: any) {
      throw new Error(`Basic Form Fill fallback failed: ${error.message}`);
    }
  }

  /**
   * Execute fallback via content script message
   */
  private async executeContentScriptFallback(strategy: string): Promise<AutofillResult> {
    try {
      // Get active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage(tabs[0].id, {
        type: 'ai:execute-fallback',
        data: { strategy }
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Fallback execution failed');
      }

      return response.data;
    } catch (error: any) {
      throw new Error(`Content script fallback failed: ${error.message}`);
    }
  }



  /**
   * Execute Manual Mode fallback
   */
  private async executeManualMode(): Promise<AutofillResult> {
    // Manual mode provides guidance rather than automatic filling
    const guidance = [
      'AI autofill is currently unavailable',
      'Please fill the form manually using your profile information',
      'Check the extension popup for your saved profile data',
      'You can try AI autofill again later'
    ];

    // Show guidance to user (this would typically be a UI notification)
    console.log('[AIFallbackManager] Manual mode guidance:', guidance);

    return {
      success: false,
      filledCount: 0,
      totalFields: 0,
      errors: [],
      executionTime: 0,
      strategy: 'manual_mode',
      message: 'Manual filling required - AI autofill unavailable'
    };
  }

  /**
   * Execute strategy with timeout
   */
  private async executeWithTimeout<T>(
    handler: () => Promise<T>,
    timeout: number,
    strategyName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Fallback strategy '${strategyName}' timed out after ${timeout}ms`));
      }, timeout);

      handler()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Record fallback execution for analysis
   */
  private recordFallback(result: FallbackResult): void {
    this.fallbackHistory.push(result);

    // Keep only last 50 fallback records
    if (this.fallbackHistory.length > 50) {
      this.fallbackHistory.shift();
    }

    console.log(`[AIFallbackManager] Fallback executed:`, {
      strategy: result.strategyUsed,
      success: result.success,
      executionTime: result.executionTime,
      reason: result.fallbackReason
    });
  }

  /**
   * Notify user of fallback execution
   */
  private notifyUserOfFallback(strategy: FallbackStrategy, result: AutofillResult): void {
    const message = result.success 
      ? `AI autofill failed, but ${strategy.description.toLowerCase()} succeeded`
      : `AI autofill failed, and ${strategy.description.toLowerCase()} also encountered issues`;

    // This would typically show a toast notification or update the UI
    console.log(`[AIFallbackManager] User notification: ${message}`);
  }

  /**
   * Convert fallback result to AI autofill result format
   */
  convertToAIResult(
    fallbackResult: FallbackResult,
    originalError: EnhancedAIError
  ): AIAutofillResult {
    const mockAnalysis: AIFormAnalysis = {
      instructions: [],
      confidence: 0,
      reasoning: `Fallback used due to ${originalError.type}: ${originalError.message}`,
      warnings: [`AI autofill failed, used ${fallbackResult.strategyUsed} fallback`],
      metadata: {
        analysisId: `fallback_${Date.now()}`,
        timestamp: new Date(),
        model: 'fallback',
        tokensUsed: 0
      }
    };

    const mockExecutionResults: ExecutionResult[] = [];

    return {
      success: fallbackResult.success,
      aiAnalysis: mockAnalysis,
      executionResults: mockExecutionResults,
      totalInstructions: 0,
      successfulInstructions: fallbackResult.result?.filledCount || 0,
      failedInstructions: 0,
      totalExecutionTime: fallbackResult.executionTime,
      fallbackUsed: true,
      errors: fallbackResult.error ? [fallbackResult.error] : []
    };
  }

  /**
   * Get fallback statistics
   */
  getFallbackStatistics(): {
    totalFallbacks: number;
    successfulFallbacks: number;
    failedFallbacks: number;
    strategiesUsed: Record<string, number>;
    averageExecutionTime: number;
    recentFallbacks: FallbackResult[];
  } {
    const stats = {
      totalFallbacks: this.fallbackHistory.length,
      successfulFallbacks: this.fallbackHistory.filter(r => r.success).length,
      failedFallbacks: this.fallbackHistory.filter(r => !r.success).length,
      strategiesUsed: {} as Record<string, number>,
      averageExecutionTime: 0,
      recentFallbacks: this.fallbackHistory.slice(-10)
    };

    // Count strategy usage
    this.fallbackHistory.forEach(result => {
      stats.strategiesUsed[result.strategyUsed] = 
        (stats.strategiesUsed[result.strategyUsed] || 0) + 1;
    });

    // Calculate average execution time
    if (this.fallbackHistory.length > 0) {
      const totalTime = this.fallbackHistory.reduce((sum, result) => sum + result.executionTime, 0);
      stats.averageExecutionTime = totalTime / this.fallbackHistory.length;
    }

    return stats;
  }

  /**
   * Update fallback configuration
   */
  updateConfig(newConfig: Partial<FallbackConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[AIFallbackManager] Configuration updated:', this.config);
  }

  /**
   * Clear fallback history
   */
  clearHistory(): void {
    this.fallbackHistory = [];
    console.log('[AIFallbackManager] Fallback history cleared');
  }
}

// Export singleton instance
export const aiFallbackManager = AIFallbackManager.getInstance();