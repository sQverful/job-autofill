/**
 * Error propagation and handling system for the extension
 */

import { messageRouter } from './message-router.js';
import { stateManager } from './state-manager.js';
import { createMessage } from './message-types.js';

// Error types
export type ErrorType = 
  | 'network'
  | 'authentication'
  | 'validation'
  | 'permission'
  | 'storage'
  | 'sync'
  | 'autofill'
  | 'ai_service'
  | 'unknown';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Error context interface
export interface ErrorContext {
  component: string;
  action: string;
  userId?: string;
  tabId?: number;
  url?: string;
  userAgent?: string;
  timestamp: Date;
  sessionId: string;
  metadata?: Record<string, any>;
}

// Extension error interface
export interface ExtensionError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  code: string;
  stack?: string;
  context: ErrorContext;
  resolved: boolean;
  reportedToUser: boolean;
  reportedToService: boolean;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  resolvedAt?: Date;
}

// Error recovery strategy
export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'ignore' | 'user_action';
  action?: () => Promise<void>;
  message?: string;
  maxAttempts?: number;
}

// Error handler configuration
interface ErrorHandlerConfig {
  enableReporting: boolean;
  enableUserNotifications: boolean;
  enableLogging: boolean;
  maxErrorHistory: number;
  reportingEndpoint?: string;
}

const DEFAULT_CONFIG: ErrorHandlerConfig = {
  enableReporting: process.env.NODE_ENV === 'production',
  enableUserNotifications: true,
  enableLogging: true,
  maxErrorHistory: 100,
  reportingEndpoint: process.env.ERROR_REPORTING_ENDPOINT,
};

/**
 * Global error handler for the extension
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorHistory: ExtensionError[] = [];
  private sessionId: string;
  private recoveryStrategies = new Map<string, RecoveryStrategy>();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.setupGlobalErrorHandlers();
    this.setupRecoveryStrategies();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections in service worker
    // Service workers use 'self' instead of 'window'
    try {
      self.addEventListener('unhandledrejection', (event) => {
        this.handleError(
          new Error(event.reason?.message || 'Unhandled promise rejection'),
          {
            component: 'global',
            action: 'unhandled_rejection',
            timestamp: new Date(),
            sessionId: this.sessionId,
            metadata: { reason: event.reason },
          },
          'unknown',
          'medium'
        );
      });

      // Handle uncaught errors in service worker
      self.addEventListener('error', (event) => {
        this.handleError(
          new Error(event.message || 'Uncaught error'),
          {
            component: 'global',
            action: 'uncaught_error',
            timestamp: new Date(),
            sessionId: this.sessionId,
            metadata: {
              filename: event.filename || 'unknown',
              lineno: event.lineno || 0,
              colno: event.colno || 0,
            },
          },
          'unknown',
          'high'
        );
      });
    } catch (error) {
      console.warn('Failed to setup global error handlers:', error);
    }

    // Setup Chrome extension error handlers
    if (chrome?.runtime) {
      chrome.runtime.onStartup.addListener(() => {
        this.sessionId = this.generateSessionId();
      });
    }
  }

  /**
   * Setup default recovery strategies
   */
  private setupRecoveryStrategies(): void {
    // Network error recovery
    this.recoveryStrategies.set('network', {
      type: 'retry',
      maxAttempts: 3,
      message: 'Retrying network request...',
    });

    // Authentication error recovery
    this.recoveryStrategies.set('authentication', {
      type: 'user_action',
      message: 'Please log in again to continue.',
    });

    // Storage error recovery
    this.recoveryStrategies.set('storage', {
      type: 'fallback',
      message: 'Using temporary storage due to storage error.',
    });

    // Sync error recovery
    this.recoveryStrategies.set('sync', {
      type: 'retry',
      maxAttempts: 2,
      message: 'Retrying data synchronization...',
    });

    // Autofill error recovery
    this.recoveryStrategies.set('autofill', {
      type: 'fallback',
      message: 'Autofill failed, please fill fields manually.',
    });
  }

  /**
   * Handle error with context
   */
  async handleError(
    error: Error,
    context: Partial<ErrorContext>,
    type: ErrorType = 'unknown',
    severity: ErrorSeverity = 'medium'
  ): Promise<ExtensionError> {
    const extensionError: ExtensionError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message: error.message,
      code: this.generateErrorCode(type, error.message),
      stack: error.stack,
      context: {
        component: 'unknown',
        action: 'unknown',
        timestamp: new Date(),
        sessionId: this.sessionId,
        userAgent: navigator.userAgent,
        ...context,
      },
      resolved: false,
      reportedToUser: false,
      reportedToService: false,
      retryCount: 0,
      maxRetries: this.getMaxRetries(type),
      createdAt: new Date(),
    };

    // Add to error history
    this.addToHistory(extensionError);

    // Log error
    if (this.config.enableLogging) {
      this.logError(extensionError);
    }

    // Attempt recovery
    await this.attemptRecovery(extensionError);

    // Report to user if needed
    if (this.config.enableUserNotifications && this.shouldNotifyUser(extensionError)) {
      this.notifyUser(extensionError);
    }

    // Report to service if enabled
    if (this.config.enableReporting && this.shouldReportToService(extensionError)) {
      this.reportToService(extensionError);
    }

    // Broadcast error to extension components
    this.broadcastError(extensionError);

    return extensionError;
  }

  /**
   * Generate error code
   */
  private generateErrorCode(type: ErrorType, message: string): string {
    const typeCode = type.toUpperCase().substring(0, 3);
    const messageHash = this.hashString(message).toString(36).substring(0, 4);
    return `${typeCode}_${messageHash}`;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get max retries for error type
   */
  private getMaxRetries(type: ErrorType): number {
    const retryMap: Record<ErrorType, number> = {
      network: 3,
      authentication: 1,
      validation: 0,
      permission: 0,
      storage: 2,
      sync: 2,
      autofill: 1,
      ai_service: 2,
      unknown: 1,
    };
    return retryMap[type] || 1;
  }

  /**
   * Add error to history
   */
  private addToHistory(error: ExtensionError): void {
    this.errorHistory.unshift(error);
    
    // Maintain max history size
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(0, this.config.maxErrorHistory);
    }
  }

  /**
   * Log error
   */
  private logError(error: ExtensionError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.type.toUpperCase()}] ${error.message}`;
    
    console[logLevel](`${logMessage}`, {
      id: error.id,
      code: error.code,
      context: error.context,
      stack: error.stack,
    });
  }

  /**
   * Get log level for severity
   */
  private getLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'low': return 'log';
      case 'medium': return 'warn';
      case 'high':
      case 'critical': return 'error';
      default: return 'warn';
    }
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(error: ExtensionError): Promise<void> {
    const strategy = this.recoveryStrategies.get(error.type);
    if (!strategy) return;

    try {
      switch (strategy.type) {
        case 'retry':
          if (error.retryCount < (strategy.maxAttempts || error.maxRetries)) {
            error.retryCount++;
            if (strategy.action) {
              await strategy.action();
              this.resolveError(error.id);
            }
          }
          break;

        case 'fallback':
          if (strategy.action) {
            await strategy.action();
            this.resolveError(error.id);
          }
          break;

        case 'ignore':
          this.resolveError(error.id);
          break;

        case 'user_action':
          // User action required - don't auto-resolve
          break;
      }
    } catch (recoveryError: any) {
      console.error('Error recovery failed:', recoveryError);
    }
  }

  /**
   * Check if user should be notified
   */
  private shouldNotifyUser(error: ExtensionError): boolean {
    // Don't notify for low severity errors
    if (error.severity === 'low') return false;
    
    // Don't notify if already reported
    if (error.reportedToUser) return false;
    
    // Don't spam user with same error type
    const recentSimilarErrors = this.errorHistory.filter(e => 
      e.type === error.type && 
      e.reportedToUser && 
      (Date.now() - e.createdAt.getTime()) < 60000 // Within last minute
    );
    
    return recentSimilarErrors.length < 2;
  }

  /**
   * Notify user about error
   */
  private notifyUser(error: ExtensionError): void {
    const userMessage = this.getUserFriendlyMessage(error);
    const notificationType = this.getNotificationType(error.severity);
    
    stateManager.addNotification(notificationType, userMessage, error.severity !== 'critical');
    error.reportedToUser = true;
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(error: ExtensionError): string {
    const messageMap: Record<ErrorType, string> = {
      network: 'Connection issue. Please check your internet connection.',
      authentication: 'Authentication failed. Please log in again.',
      validation: 'Invalid data provided. Please check your input.',
      permission: 'Permission denied. Please check browser settings.',
      storage: 'Storage error. Your data may not be saved.',
      sync: 'Sync failed. Your data may not be up to date.',
      autofill: 'Autofill failed. Please fill fields manually.',
      ai_service: 'AI service unavailable. Using fallback options.',
      unknown: 'An unexpected error occurred.',
    };

    return messageMap[error.type] || error.message;
  }

  /**
   * Get notification type for severity
   */
  private getNotificationType(severity: ErrorSeverity): 'info' | 'success' | 'warning' | 'error' {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high':
      case 'critical': return 'error';
      default: return 'warning';
    }
  }

  /**
   * Check if error should be reported to service
   */
  private shouldReportToService(error: ExtensionError): boolean {
    // Only report medium and high severity errors
    if (error.severity === 'low') return false;
    
    // Don't report if already reported
    if (error.reportedToService) return false;
    
    // Don't report validation errors
    if (error.type === 'validation') return false;
    
    return true;
  }

  /**
   * Report error to external service
   */
  private async reportToService(error: ExtensionError): Promise<void> {
    if (!this.config.reportingEndpoint) return;

    try {
      await fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            ...error,
            // Remove sensitive information
            context: {
              ...error.context,
              userId: error.context.userId ? 'redacted' : undefined,
            },
          },
          extensionVersion: chrome.runtime.getManifest().version,
          browserInfo: {
            userAgent: navigator.userAgent,
            language: navigator.language,
          },
        }),
      });

      error.reportedToService = true;
    } catch (reportingError) {
      console.error('Failed to report error to service:', reportingError);
    }
  }

  /**
   * Broadcast error to extension components
   */
  private broadcastError(error: ExtensionError): void {
    const errorMessage = createMessage({
      type: 'error' as const,
      source: 'background' as const,
      data: {
        code: error.code,
        message: error.message,
        details: {
          type: error.type,
          severity: error.severity,
          context: error.context,
        },
      },
    });

    messageRouter.broadcastToExtension(errorMessage);
  }

  /**
   * Resolve error
   */
  resolveError(errorId: string): void {
    const error = this.errorHistory.find(e => e.id === errorId);
    if (error && !error.resolved) {
      error.resolved = true;
      error.resolvedAt = new Date();
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(filter?: {
    type?: ErrorType;
    severity?: ErrorSeverity;
    resolved?: boolean;
    limit?: number;
  }): ExtensionError[] {
    let filtered = this.errorHistory;

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(e => e.type === filter.type);
      }
      if (filter.severity) {
        filtered = filtered.filter(e => e.severity === filter.severity);
      }
      if (filter.resolved !== undefined) {
        filtered = filtered.filter(e => e.resolved === filter.resolved);
      }
      if (filter.limit) {
        filtered = filtered.slice(0, filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    resolvedErrors: number;
    unresolvedErrors: number;
  } {
    const stats = {
      totalErrors: this.errorHistory.length,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      resolvedErrors: 0,
      unresolvedErrors: 0,
    };

    this.errorHistory.forEach(error => {
      // Count by type
      stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
      
      // Count by severity
      stats.errorsBySeverity[error.severity] = (stats.errorsBySeverity[error.severity] || 0) + 1;
      
      // Count resolved/unresolved
      if (error.resolved) {
        stats.resolvedErrors++;
      } else {
        stats.unresolvedErrors++;
      }
    });

    return stats;
  }

  /**
   * Register custom recovery strategy
   */
  registerRecoveryStrategy(errorType: ErrorType, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(errorType, strategy);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.errorHistory = [];
    this.recoveryStrategies.clear();
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Convenience functions for common error types
export const handleNetworkError = (error: Error, context: Partial<ErrorContext>) =>
  errorHandler.handleError(error, context, 'network', 'medium');

export const handleAuthError = (error: Error, context: Partial<ErrorContext>) =>
  errorHandler.handleError(error, context, 'authentication', 'high');

export const handleValidationError = (error: Error, context: Partial<ErrorContext>) =>
  errorHandler.handleError(error, context, 'validation', 'low');

export const handleStorageError = (error: Error, context: Partial<ErrorContext>) =>
  errorHandler.handleError(error, context, 'storage', 'medium');

export const handleSyncError = (error: Error, context: Partial<ErrorContext>) =>
  errorHandler.handleError(error, context, 'sync', 'medium');

export const handleAutofillError = (error: Error, context: Partial<ErrorContext>) =>
  errorHandler.handleError(error, context, 'autofill', 'medium');

export const handleAIServiceError = (error: Error, context: Partial<ErrorContext>) =>
  errorHandler.handleError(error, context, 'ai_service', 'medium');