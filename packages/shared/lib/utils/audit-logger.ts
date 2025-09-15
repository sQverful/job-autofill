/**
 * Audit Logging System for AI Operations
 * Tracks AI operations, data usage, and security events for compliance
 */

// Helper function to safely get current URL in both content script and service worker contexts
const getCurrentUrl = (): string => {
  try {
    // Service worker compatible URL detection
    if (typeof globalThis !== 'undefined' && globalThis.location) {
      return globalThis.location.href || 'unknown';
    }
    if (typeof window !== 'undefined' && window.location) {
      return window.location.href || 'unknown';
    }
    return 'service-worker';
  } catch {
    return 'service-worker';
  }
};

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  operation: string;
  category: AuditCategory;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  data: Record<string, any>;
  metadata: {
    userAgent?: string;
    url?: string;
    extensionVersion?: string;
    duration?: number;
    success: boolean;
    errorMessage?: string;
  };
}

export type AuditCategory = 
  | 'ai_operation'
  | 'data_processing'
  | 'security'
  | 'privacy'
  | 'user_action'
  | 'system_event'
  | 'error';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditLogFilter {
  category?: AuditCategory;
  severity?: AuditSeverity;
  operation?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
}

export interface AuditLogStatistics {
  totalEntries: number;
  entriesByCategory: Record<AuditCategory, number>;
  entriesBySeverity: Record<AuditSeverity, number>;
  successRate: number;
  averageDuration: number;
  recentErrors: AuditLogEntry[];
  topOperations: Array<{ operation: string; count: number }>;
}

/**
 * Audit Logger for AI operations and security events
 */
export class AuditLogger {
  private static readonly STORAGE_KEY = 'audit-log-entries';
  private static readonly MAX_ENTRIES = 1000;
  private static readonly RETENTION_DAYS = 90;
  private static sessionId: string = this.generateSessionId();

  /**
   * Log an AI operation
   */
  static async logAIOperation(
    operation: string,
    data: Record<string, any>,
    metadata: {
      success: boolean;
      duration?: number;
      errorMessage?: string;
      tokensUsed?: number;
      modelUsed?: string;
    }
  ): Promise<void> {
    await this.log({
      operation,
      category: 'ai_operation',
      severity: metadata.success ? 'low' : 'medium',
      data: {
        ...data,
        tokensUsed: metadata.tokensUsed,
        modelUsed: metadata.modelUsed,
      },
      metadata: {
        ...metadata,
        url: getCurrentUrl(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  }

  /**
   * Log data processing event
   */
  static async logDataProcessing(
    operation: string,
    data: {
      dataType: string;
      dataSize: number;
      sanitized: boolean;
      sensitiveDataFound: boolean;
      processingTime: number;
    },
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      operation,
      category: 'data_processing',
      severity: data.sensitiveDataFound ? 'high' : 'low',
      data,
      metadata: {
        success,
        errorMessage,
        duration: data.processingTime,
        url: getCurrentUrl(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  }

  /**
   * Log security event
   */
  static async logSecurityEvent(
    operation: string,
    severity: AuditSeverity,
    data: Record<string, any>,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      operation,
      category: 'security',
      severity,
      data,
      metadata: {
        success,
        errorMessage,
        url: getCurrentUrl(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  }

  /**
   * Log privacy event
   */
  static async logPrivacyEvent(
    operation: string,
    data: {
      consentRequired: boolean;
      consentGiven: boolean;
      dataTypes: string[];
      retentionPeriod?: string;
    },
    success: boolean = true
  ): Promise<void> {
    await this.log({
      operation,
      category: 'privacy',
      severity: data.consentRequired && !data.consentGiven ? 'high' : 'low',
      data,
      metadata: {
        success,
        url: getCurrentUrl(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  }

  /**
   * Log user action
   */
  static async logUserAction(
    operation: string,
    data: Record<string, any>,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      operation,
      category: 'user_action',
      severity: 'low',
      data,
      metadata: {
        success,
        errorMessage,
        url: getCurrentUrl(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  }

  /**
   * Log system event
   */
  static async logSystemEvent(
    operation: string,
    data: Record<string, any>,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      operation,
      category: 'system_event',
      severity: success ? 'low' : 'medium',
      data,
      metadata: {
        success,
        errorMessage,
        url: getCurrentUrl(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  }

  /**
   * Log error event
   */
  static async logError(
    operation: string,
    error: Error | string,
    data: Record<string, any> = {},
    severity: AuditSeverity = 'medium'
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    await this.log({
      operation,
      category: 'error',
      severity,
      data: {
        ...data,
        errorStack,
      },
      metadata: {
        success: false,
        errorMessage,
        url: getCurrentUrl(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version,
      },
    });
  }

  /**
   * Core logging method
   */
  private static async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'sessionId'>): Promise<void> {
    try {
      const logEntry: AuditLogEntry = {
        id: this.generateEntryId(),
        timestamp: new Date(),
        sessionId: this.sessionId,
        ...entry,
      };

      // Get existing entries
      const stored = await chrome.storage.local.get(this.STORAGE_KEY);
      const entries: AuditLogEntry[] = stored[this.STORAGE_KEY] || [];

      // Add new entry
      entries.push(logEntry);

      // Clean up old entries
      const cleanedEntries = this.cleanupEntries(entries);

      // Store updated entries
      await chrome.storage.local.set({
        [this.STORAGE_KEY]: cleanedEntries,
      });

      // Log to console for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AuditLogger] ${entry.category}:${entry.operation}`, logEntry);
      }
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw error to avoid breaking the main functionality
    }
  }

  /**
   * Get audit log entries with optional filtering
   */
  static async getEntries(filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    try {
      const stored = await chrome.storage.local.get(this.STORAGE_KEY);
      let entries: AuditLogEntry[] = stored[this.STORAGE_KEY] || [];

      // Parse timestamps
      entries = entries.map(entry => ({
        ...entry,
        timestamp: new Date(entry.timestamp),
      }));

      // Apply filters
      if (filter.category) {
        entries = entries.filter(entry => entry.category === filter.category);
      }

      if (filter.severity) {
        entries = entries.filter(entry => entry.severity === filter.severity);
      }

      if (filter.operation) {
        entries = entries.filter(entry => entry.operation.includes(filter.operation!));
      }

      if (filter.startDate) {
        entries = entries.filter(entry => entry.timestamp >= filter.startDate!);
      }

      if (filter.endDate) {
        entries = entries.filter(entry => entry.timestamp <= filter.endDate!);
      }

      if (filter.success !== undefined) {
        entries = entries.filter(entry => entry.metadata.success === filter.success);
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply limit
      if (filter.limit) {
        entries = entries.slice(0, filter.limit);
      }

      return entries;
    } catch (error) {
      console.error('Failed to get audit log entries:', error);
      return [];
    }
  }

  /**
   * Get audit log statistics
   */
  static async getStatistics(): Promise<AuditLogStatistics> {
    const entries = await this.getEntries();

    const stats: AuditLogStatistics = {
      totalEntries: entries.length,
      entriesByCategory: {
        ai_operation: 0,
        data_processing: 0,
        security: 0,
        privacy: 0,
        user_action: 0,
        system_event: 0,
        error: 0,
      },
      entriesBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      successRate: 0,
      averageDuration: 0,
      recentErrors: [],
      topOperations: [],
    };

    if (entries.length === 0) {
      return stats;
    }

    // Count by category and severity
    let successCount = 0;
    let totalDuration = 0;
    let durationCount = 0;
    const operationCounts: Record<string, number> = {};

    entries.forEach(entry => {
      stats.entriesByCategory[entry.category]++;
      stats.entriesBySeverity[entry.severity]++;

      if (entry.metadata.success) {
        successCount++;
      }

      if (entry.metadata.duration) {
        totalDuration += entry.metadata.duration;
        durationCount++;
      }

      operationCounts[entry.operation] = (operationCounts[entry.operation] || 0) + 1;
    });

    // Calculate success rate
    stats.successRate = successCount / entries.length;

    // Calculate average duration
    stats.averageDuration = durationCount > 0 ? totalDuration / durationCount : 0;

    // Get recent errors
    stats.recentErrors = entries
      .filter(entry => entry.category === 'error')
      .slice(0, 10);

    // Get top operations
    stats.topOperations = Object.entries(operationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([operation, count]) => ({ operation, count }));

    return stats;
  }

  /**
   * Clear audit log
   */
  static async clearLog(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEY);
      
      // Log the clearing action
      await this.logSystemEvent('audit_log_cleared', {
        clearedBy: 'user',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to clear audit log:', error);
      throw new Error('Failed to clear audit log');
    }
  }

  /**
   * Export audit log
   */
  static async exportLog(): Promise<string> {
    const entries = await this.getEntries();
    const stats = await this.getStatistics();

    const exportData = {
      exportDate: new Date().toISOString(),
      extensionVersion: chrome.runtime.getManifest().version,
      statistics: stats,
      entries,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Clean up old entries
   */
  private static cleanupEntries(entries: AuditLogEntry[]): AuditLogEntry[] {
    // Remove entries older than retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

    let cleanedEntries = entries.filter(entry => {
      const entryDate = new Date(entry.timestamp);
      return entryDate > cutoffDate;
    });

    // Limit total number of entries
    if (cleanedEntries.length > this.MAX_ENTRIES) {
      // Keep the most recent entries
      cleanedEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      cleanedEntries = cleanedEntries.slice(0, this.MAX_ENTRIES);
    }

    return cleanedEntries;
  }

  /**
   * Generate unique entry ID
   */
  private static generateEntryId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session ID
   */
  static getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Start new session
   */
  static startNewSession(): void {
    this.sessionId = this.generateSessionId();
    this.logSystemEvent('session_started', {
      sessionId: this.sessionId,
    });
  }
}

// Utility functions for common logging operations
export const logAIOperation = AuditLogger.logAIOperation;
export const logDataProcessing = AuditLogger.logDataProcessing;
export const logSecurityEvent = AuditLogger.logSecurityEvent;
export const logPrivacyEvent = AuditLogger.logPrivacyEvent;
export const logUserAction = AuditLogger.logUserAction;
export const logError = AuditLogger.logError;