/**
 * Comprehensive AI Error Handler
 * Provides error classification, resolution strategies, and fallback mechanisms
 */

import type { 
  AIError, 
  AIErrorContext, 
  AIErrorResolution,
  AISettings
} from '@extension/shared';

// Enhanced error classification with severity levels
export interface EnhancedAIError extends Error {
  type: AIError;
  context: AIErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  userActionRequired: boolean;
  fallbackAvailable: boolean;
}

// Retry configuration for different error types
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

// Error resolution strategy configuration
interface ErrorResolutionConfig {
  [key in AIError]: {
    action: AIErrorResolution['action'];
    message: string;
    fallbackStrategy?: AIErrorResolution['fallbackStrategy'];
    retryConfig?: RetryConfig;
    userGuidance?: string[];
    preventionTips?: string[];
  };
}

/**
 * Comprehensive AI Error Handler
 */
export class AIErrorHandler {
  private static instance: AIErrorHandler;
  private errorResolutionConfig: ErrorResolutionConfig;
  private errorHistory: Map<string, EnhancedAIError[]> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  private constructor() {
    this.errorResolutionConfig = this.initializeErrorResolutionConfig();
  }

  static getInstance(): AIErrorHandler {
    if (!AIErrorHandler.instance) {
      AIErrorHandler.instance = new AIErrorHandler();
    }
    return AIErrorHandler.instance;
  }

  /**
   * Initialize error resolution configuration
   */
  private initializeErrorResolutionConfig(): ErrorResolutionConfig {
    return {
      INVALID_TOKEN: {
        action: 'user_action_required',
        message: 'Your OpenAI API token is invalid or expired',
        userGuidance: [
          'Check that your token starts with "sk-"',
          'Verify the token is correctly copied from OpenAI dashboard',
          'Ensure your OpenAI account has sufficient credits',
          'Try generating a new API token'
        ],
        preventionTips: [
          'Store your token securely',
          'Monitor your OpenAI account usage',
          'Set up billing alerts in your OpenAI account'
        ]
      },

      API_RATE_LIMIT: {
        action: 'retry',
        message: 'OpenAI API rate limit exceeded. Retrying with backoff...',
        fallbackStrategy: 'traditional_autofill',
        retryConfig: {
          maxAttempts: 5,
          baseDelay: 2000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          jitter: true
        },
        userGuidance: [
          'Rate limits are temporary and will reset automatically',
          'Consider upgrading your OpenAI plan for higher limits',
          'Use traditional autofill while waiting'
        ],
        preventionTips: [
          'Enable caching to reduce API calls',
          'Avoid rapid successive AI autofill attempts',
          'Consider upgrading to OpenAI Pro for higher limits'
        ]
      },

      API_QUOTA_EXCEEDED: {
        action: 'user_action_required',
        message: 'OpenAI API quota exceeded. Please check your billing settings',
        userGuidance: [
          'Add payment method to your OpenAI account',
          'Increase your usage limits in OpenAI dashboard',
          'Check your current usage and billing status',
          'Consider upgrading your OpenAI plan'
        ],
        preventionTips: [
          'Set up billing alerts in OpenAI dashboard',
          'Monitor your monthly usage regularly',
          'Enable caching to reduce API consumption'
        ]
      },

      NETWORK_ERROR: {
        action: 'retry',
        message: 'Network connection error. Retrying...',
        fallbackStrategy: 'traditional_autofill',
        retryConfig: {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          backoffMultiplier: 2,
          jitter: true
        },
        userGuidance: [
          'Check your internet connection',
          'Try refreshing the page',
          'Use traditional autofill if network issues persist'
        ],
        preventionTips: [
          'Ensure stable internet connection',
          'Consider using offline mode when available'
        ]
      },

      INVALID_RESPONSE: {
        action: 'fallback',
        message: 'AI returned an invalid response. Using traditional autofill',
        fallbackStrategy: 'traditional_autofill',
        retryConfig: {
          maxAttempts: 2,
          baseDelay: 1000,
          maxDelay: 5000,
          backoffMultiplier: 1.5,
          jitter: false
        },
        userGuidance: [
          'This is usually a temporary issue with the AI service',
          'Traditional autofill will be used instead',
          'Try AI autofill again in a few minutes'
        ],
        preventionTips: [
          'Report persistent issues to support',
          'Keep the extension updated'
        ]
      },

      PARSING_ERROR: {
        action: 'fallback',
        message: 'Failed to parse AI response. Using traditional autofill',
        fallbackStrategy: 'traditional_autofill',
        retryConfig: {
          maxAttempts: 1,
          baseDelay: 1000,
          maxDelay: 2000,
          backoffMultiplier: 1,
          jitter: false
        },
        userGuidance: [
          'AI response format was unexpected',
          'Traditional autofill will work normally',
          'This issue has been logged for improvement'
        ],
        preventionTips: [
          'Keep the extension updated',
          'Report if this happens frequently'
        ]
      },

      EXECUTION_FAILED: {
        action: 'fallback',
        message: 'AI instruction execution failed. Trying traditional autofill',
        fallbackStrategy: 'traditional_autofill',
        userGuidance: [
          'The form structure may have changed',
          'Traditional autofill will attempt to fill the form',
          'You can manually complete any remaining fields'
        ],
        preventionTips: [
          'Refresh the page if forms appear broken',
          'Report forms that consistently fail'
        ]
      },

      CACHE_ERROR: {
        action: 'retry',
        message: 'Cache error occurred. Retrying without cache...',
        retryConfig: {
          maxAttempts: 2,
          baseDelay: 500,
          maxDelay: 2000,
          backoffMultiplier: 2,
          jitter: false
        },
        userGuidance: [
          'Cache will be cleared and rebuilt',
          'This may slightly slow down the next request'
        ],
        preventionTips: [
          'Clear extension data if cache errors persist'
        ]
      },

      ENCRYPTION_ERROR: {
        action: 'user_action_required',
        message: 'Token encryption/decryption failed. Please re-enter your API token',
        userGuidance: [
          'Your stored API token may be corrupted',
          'Please re-enter your OpenAI API token in settings',
          'This will resolve the encryption issue'
        ],
        preventionTips: [
          'Avoid modifying extension storage manually',
          'Keep the extension updated'
        ]
      }
    };
  }

  /**
   * Classify and enhance an error with additional context
   */
  classifyError(error: Error, context: Partial<AIErrorContext> = {}): EnhancedAIError {
    const message = error.message?.toLowerCase() || '';
    let aiErrorType: AIError;
    let severity: EnhancedAIError['severity'];
    let recoverable = true;
    let userActionRequired = false;
    let fallbackAvailable = true;

    // Classify error type based on message content
    if (message.includes('token') && (message.includes('invalid') || message.includes('unauthorized'))) {
      aiErrorType = 'INVALID_TOKEN';
      severity = 'high';
      userActionRequired = true;
      fallbackAvailable = true;
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
      aiErrorType = 'API_RATE_LIMIT';
      severity = 'medium';
      recoverable = true;
      fallbackAvailable = true;
    } else if (message.includes('quota') || message.includes('billing') || message.includes('insufficient')) {
      aiErrorType = 'API_QUOTA_EXCEEDED';
      severity = 'high';
      userActionRequired = true;
      fallbackAvailable = true;
    } else if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      aiErrorType = 'NETWORK_ERROR';
      severity = 'medium';
      recoverable = true;
      fallbackAvailable = true;
    } else if (message.includes('parse') || message.includes('json') || message.includes('format')) {
      aiErrorType = 'PARSING_ERROR';
      severity = 'low';
      recoverable = false;
      fallbackAvailable = true;
    } else if (message.includes('execution') || message.includes('instruction') || message.includes('selector')) {
      aiErrorType = 'EXECUTION_FAILED';
      severity = 'medium';
      recoverable = false;
      fallbackAvailable = true;
    } else if (message.includes('cache')) {
      aiErrorType = 'CACHE_ERROR';
      severity = 'low';
      recoverable = true;
      fallbackAvailable = false;
    } else if (message.includes('encrypt') || message.includes('decrypt')) {
      aiErrorType = 'ENCRYPTION_ERROR';
      severity = 'high';
      userActionRequired = true;
      fallbackAvailable = true;
    } else {
      aiErrorType = 'INVALID_RESPONSE';
      severity = 'medium';
      recoverable = false;
      fallbackAvailable = true;
    }

    const enhancedError: EnhancedAIError = Object.assign(error, {
      type: aiErrorType,
      context: {
        operation: 'unknown',
        timestamp: new Date(),
        retryCount: 0,
        ...context
      },
      severity,
      recoverable,
      userActionRequired,
      fallbackAvailable
    });

    // Record error in history
    this.recordError(enhancedError);

    return enhancedError;
  }

  /**
   * Get resolution strategy for an error
   */
  getErrorResolution(error: EnhancedAIError): AIErrorResolution {
    const config = this.errorResolutionConfig[error.type];
    const operationKey = `${error.context.operation}_${error.type}`;
    const currentRetryCount = this.retryAttempts.get(operationKey) || 0;

    // Check if we've exceeded retry attempts
    if (config.retryConfig && currentRetryCount >= config.retryConfig.maxAttempts) {
      return {
        action: 'fallback',
        message: `Maximum retry attempts exceeded. ${config.fallbackStrategy ? 'Using fallback strategy' : 'Operation aborted'}`,
        fallbackStrategy: config.fallbackStrategy
      };
    }

    // Build resolution with retry configuration
    const resolution: AIErrorResolution = {
      action: config.action,
      message: config.message,
      fallbackStrategy: config.fallbackStrategy
    };

    // Add retry configuration if applicable
    if (config.retryConfig && config.action === 'retry') {
      const delay = this.calculateRetryDelay(config.retryConfig, currentRetryCount);
      resolution.retryDelay = delay;
      resolution.maxRetries = config.retryConfig.maxAttempts;
    }

    return resolution;
  }

  /**
   * Execute retry with exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Partial<AIErrorContext> = {}
  ): Promise<T> {
    const operationKey = `${operationName}_${Date.now()}`;
    let lastError: EnhancedAIError | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        // Reset retry count on success
        this.retryAttempts.delete(operationKey);
        return await operation();
      } catch (error: any) {
        const enhancedError = this.classifyError(error, {
          ...context,
          operation: operationName,
          retryCount: attempt
        });

        lastError = enhancedError;
        this.retryAttempts.set(operationKey, attempt + 1);

        const resolution = this.getErrorResolution(enhancedError);

        // If not retryable or max attempts reached, throw
        if (resolution.action !== 'retry' || attempt >= 4) {
          throw enhancedError;
        }

        // Wait before retry
        if (resolution.retryDelay) {
          console.log(`[AIErrorHandler] Retrying ${operationName} in ${resolution.retryDelay}ms (attempt ${attempt + 1})`);
          await this.delay(resolution.retryDelay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(config: RetryConfig, attemptNumber: number): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

    if (config.jitter) {
      // Add random jitter (±25%)
      const jitterRange = cappedDelay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.max(0, cappedDelay + jitter);
    }

    return cappedDelay;
  }

  /**
   * Get user-friendly error message with guidance
   */
  getUserFriendlyMessage(error: EnhancedAIError): {
    title: string;
    message: string;
    guidance: string[];
    preventionTips: string[];
    canRetry: boolean;
    canUseFallback: boolean;
  } {
    const config = this.errorResolutionConfig[error.type];
    
    return {
      title: this.getErrorTitle(error.type),
      message: config.message,
      guidance: config.userGuidance || [],
      preventionTips: config.preventionTips || [],
      canRetry: error.recoverable && config.action === 'retry',
      canUseFallback: error.fallbackAvailable
    };
  }

  /**
   * Get error title for UI display
   */
  private getErrorTitle(errorType: AIError): string {
    const titles: Record<AIError, string> = {
      INVALID_TOKEN: 'Invalid API Token',
      API_RATE_LIMIT: 'Rate Limit Exceeded',
      API_QUOTA_EXCEEDED: 'API Quota Exceeded',
      NETWORK_ERROR: 'Network Connection Error',
      INVALID_RESPONSE: 'Invalid AI Response',
      PARSING_ERROR: 'Response Parsing Error',
      EXECUTION_FAILED: 'Execution Failed',
      CACHE_ERROR: 'Cache Error',
      ENCRYPTION_ERROR: 'Token Security Error'
    };

    return titles[errorType] || 'AI Error';
  }

  /**
   * Record error in history for analysis
   */
  private recordError(error: EnhancedAIError): void {
    const key = error.context.operation || 'unknown';
    
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }

    const history = this.errorHistory.get(key)!;
    history.push(error);

    // Keep only last 10 errors per operation
    if (history.length > 10) {
      history.shift();
    }

    // Log error for debugging
    console.error(`[AIErrorHandler] ${error.type} in ${error.context.operation}:`, {
      message: error.message,
      severity: error.severity,
      recoverable: error.recoverable,
      context: error.context
    });
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByType: Record<AIError, number>;
    errorsByOperation: Record<string, number>;
    recentErrors: EnhancedAIError[];
  } {
    const stats = {
      totalErrors: 0,
      errorsByType: {} as Record<AIError, number>,
      errorsByOperation: {} as Record<string, number>,
      recentErrors: [] as EnhancedAIError[]
    };

    // Initialize error type counters
    Object.keys(this.errorResolutionConfig).forEach(type => {
      stats.errorsByType[type as AIError] = 0;
    });

    // Count errors
    for (const [operation, errors] of this.errorHistory.entries()) {
      stats.errorsByOperation[operation] = errors.length;
      stats.totalErrors += errors.length;

      errors.forEach(error => {
        stats.errorsByType[error.type]++;
        
        // Collect recent errors (last 24 hours)
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (error.context.timestamp > dayAgo) {
          stats.recentErrors.push(error);
        }
      });
    }

    // Sort recent errors by timestamp
    stats.recentErrors.sort((a, b) => 
      b.context.timestamp.getTime() - a.context.timestamp.getTime()
    );

    return stats;
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
    this.retryAttempts.clear();
    console.log('[AIErrorHandler] Error history cleared');
  }

  /**
   * Check if operation should use fallback based on error history
   */
  shouldUseFallback(operation: string): boolean {
    const history = this.errorHistory.get(operation);
    if (!history || history.length === 0) return false;

    // Use fallback if last 3 attempts failed with non-recoverable errors
    const recentErrors = history.slice(-3);
    return recentErrors.length >= 3 && 
           recentErrors.every(error => !error.recoverable);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const aiErrorHandler = AIErrorHandler.getInstance();