/**
 * Security Manager - Centralized security and privacy management
 * Integrates all security features: encryption, sanitization, consent, and audit logging
 */

import { HTMLSanitizer, type SanitizationResult } from './html-sanitizer.js';
import { ConsentManager, type ConsentData } from './consent-manager.js';
import { AuditLogger } from './audit-logger.js';

export interface SecurityCheckResult {
  allowed: boolean;
  reason?: string;
  warnings: string[];
  requiresConsent: boolean;
  sanitizationRequired: boolean;
}

export interface SecureProcessingOptions {
  operation: string;
  dataType: string;
  requireConsent?: boolean;
  sanitizeHtml?: boolean;
  logOperation?: boolean;
  maxDataSize?: number;
}

export interface SecureProcessingResult<T = any> {
  success: boolean;
  data?: T;
  sanitizationResult?: SanitizationResult;
  securityWarnings: string[];
  auditLogId?: string;
  error?: string;
}

/**
 * Centralized Security Manager
 */
export class SecurityManager {
  /**
   * Perform comprehensive security check before AI processing
   */
  static async performSecurityCheck(
    operation: string,
    dataSize: number = 0
  ): Promise<SecurityCheckResult> {
    const result: SecurityCheckResult = {
      allowed: false,
      warnings: [],
      requiresConsent: true,
      sanitizationRequired: true,
    };

    try {
      // Check consent
      const consentCheck = await ConsentManager.canUseAIFeatures();
      if (!consentCheck.allowed) {
        result.reason = consentCheck.reason;
        result.requiresConsent = true;
        return result;
      }

      // Check data size limits
      const maxSize = 100000; // 100KB limit for AI processing
      if (dataSize > maxSize) {
        result.reason = `Data size (${dataSize} bytes) exceeds maximum allowed (${maxSize} bytes)`;
        result.warnings.push('Large data size may affect processing performance');
        return result;
      }

      // All checks passed
      result.allowed = true;
      result.requiresConsent = false;

      // Log security check
      await AuditLogger.logSecurityEvent(
        'security_check_performed',
        'low',
        {
          operation,
          dataSize,
          allowed: result.allowed,
          warnings: result.warnings,
        }
      );

    } catch (error) {
      result.reason = 'Security check failed';
      result.warnings.push('Unable to verify security requirements');
      
      await AuditLogger.logError(
        'security_check_failed',
        error instanceof Error ? error : new Error(String(error)),
        { operation, dataSize }
      );
    }

    return result;
  }

  /**
   * Securely process HTML data for AI analysis
   */
  static async securelyProcessHTML(
    html: string,
    options: SecureProcessingOptions
  ): Promise<SecureProcessingResult<string>> {
    const startTime = Date.now();
    const result: SecureProcessingResult<string> = {
      success: false,
      securityWarnings: [],
    };

    try {
      // Perform security check
      const securityCheck = await this.performSecurityCheck(options.operation, html.length);
      if (!securityCheck.allowed) {
        result.error = securityCheck.reason;
        result.securityWarnings = securityCheck.warnings;
        return result;
      }

      // Sanitize HTML if required
      let processedHtml = html;
      if (options.sanitizeHtml !== false) {
        const sanitizationResult = HTMLSanitizer.sanitize(html, {
          removeSensitiveData: true,
          removeScripts: true,
          removeStyles: true,
          removeAttributes: true,
          preserveFormStructure: true,
          maxLength: options.maxDataSize,
        });

        processedHtml = sanitizationResult.sanitizedHtml;
        result.sanitizationResult = sanitizationResult;

        // Add warnings from sanitization
        if (sanitizationResult.warnings.length > 0) {
          result.securityWarnings.push(...sanitizationResult.warnings);
        }

        if (sanitizationResult.sensitiveDataFound) {
          result.securityWarnings.push('Sensitive data was detected and removed');
        }

        // Log data processing
        await AuditLogger.logDataProcessing(
          options.operation,
          {
            dataType: options.dataType,
            dataSize: html.length,
            sanitized: true,
            sensitiveDataFound: sanitizationResult.sensitiveDataFound,
            processingTime: Date.now() - startTime,
          },
          true
        );
      }

      result.success = true;
      result.data = processedHtml;

      // Log successful processing
      if (options.logOperation !== false) {
        await AuditLogger.logAIOperation(
          options.operation,
          {
            dataType: options.dataType,
            originalSize: html.length,
            processedSize: processedHtml.length,
            sanitized: options.sanitizeHtml !== false,
            securityWarnings: result.securityWarnings,
          },
          {
            success: true,
            duration: Date.now() - startTime,
          }
        );
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Processing failed';
      result.securityWarnings.push('Secure processing failed');

      // Log error
      await AuditLogger.logError(
        `${options.operation}_failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          dataType: options.dataType,
          dataSize: html.length,
          processingTime: Date.now() - startTime,
        }
      );
    }

    return result;
  }

  /**
   * Validate and log AI operation
   */
  static async validateAIOperation(
    operation: string,
    data: Record<string, any>,
    tokensUsed?: number,
    modelUsed?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check consent
      const consentCheck = await ConsentManager.canUseAIFeatures();
      if (!consentCheck.allowed) {
        await AuditLogger.logPrivacyEvent(
          'ai_operation_blocked',
          {
            consentRequired: true,
            consentGiven: false,
            dataTypes: ['AI Processing'],
          },
          false
        );
        
        return consentCheck;
      }

      // Log successful validation
      await AuditLogger.logAIOperation(
        operation,
        data,
        {
          success: true,
          tokensUsed,
          modelUsed,
        }
      );

      return { allowed: true };

    } catch (error) {
      await AuditLogger.logError(
        'ai_operation_validation_failed',
        error instanceof Error ? error : new Error(String(error)),
        { operation, data }
      );

      return {
        allowed: false,
        reason: 'Validation failed',
      };
    }
  }

  /**
   * Get security status summary
   */
  static async getSecurityStatus(): Promise<{
    consentStatus: {
      hasValidConsent: boolean;
      consentDate: Date | null;
      enabledFeatures: string[];
      expiryDate: Date | null;
    };
    auditStatus: {
      totalEntries: number;
      recentErrors: number;
      successRate: number;
    };
    securityWarnings: string[];
  }> {
    const consentSummary = await ConsentManager.getConsentSummary();
    const auditStats = await AuditLogger.getStatistics();
    
    const securityWarnings: string[] = [];
    
    // Check for security issues
    if (!consentSummary.hasValidConsent) {
      securityWarnings.push('AI consent not granted or expired');
    }
    
    if (auditStats.successRate < 0.9) {
      securityWarnings.push('High failure rate detected in AI operations');
    }
    
    if (auditStats.recentErrors.length > 10) {
      securityWarnings.push('Multiple recent errors detected');
    }

    return {
      consentStatus: consentSummary,
      auditStatus: {
        totalEntries: auditStats.totalEntries,
        recentErrors: auditStats.recentErrors.length,
        successRate: auditStats.successRate,
      },
      securityWarnings,
    };
  }

  /**
   * Initialize security manager
   */
  static async initialize(): Promise<void> {
    try {
      // Start new audit session
      AuditLogger.startNewSession();
      
      // Log initialization
      await AuditLogger.logSystemEvent(
        'security_manager_initialized',
        {
          timestamp: new Date().toISOString(),
          extensionVersion: chrome.runtime.getManifest().version,
        }
      );

      // Check consent status
      const consentValidation = await ConsentManager.validateConsent();
      if (!consentValidation.isValid) {
        await AuditLogger.logPrivacyEvent(
          'consent_validation_failed',
          {
            consentRequired: true,
            consentGiven: false,
            dataTypes: ['AI Processing'],
          },
          false
        );
      }

    } catch (error) {
      console.error('Failed to initialize SecurityManager:', error);
      await AuditLogger.logError(
        'security_manager_init_failed',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Clean up security data (for user privacy)
   */
  static async cleanupSecurityData(): Promise<void> {
    try {
      // Clear audit logs
      await AuditLogger.clearLog();
      
      // Revoke consent (user initiated)
      await ConsentManager.revokeConsent();
      
      // Log cleanup
      await AuditLogger.logPrivacyEvent(
        'security_data_cleanup',
        {
          consentRequired: false,
          consentGiven: false,
          dataTypes: ['Audit Logs', 'Consent Data'],
          retentionPeriod: 'Immediately deleted',
        }
      );

    } catch (error) {
      console.error('Failed to cleanup security data:', error);
      throw new Error('Failed to cleanup security data');
    }
  }

  /**
   * Export security data for user
   */
  static async exportSecurityData(): Promise<{
    consent: string;
    auditLog: string;
    exportDate: string;
  }> {
    try {
      const consentData = await ConsentManager.exportConsentData();
      const auditData = await AuditLogger.exportLog();
      
      // Log export
      await AuditLogger.logPrivacyEvent(
        'security_data_exported',
        {
          consentRequired: false,
          consentGiven: true,
          dataTypes: ['Consent Data', 'Audit Logs'],
        }
      );

      return {
        consent: consentData,
        auditLog: auditData,
        exportDate: new Date().toISOString(),
      };

    } catch (error) {
      await AuditLogger.logError(
        'security_data_export_failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw new Error('Failed to export security data');
    }
  }
}

// Export utility functions
export const performSecurityCheck = SecurityManager.performSecurityCheck;
export const securelyProcessHTML = SecurityManager.securelyProcessHTML;
export const validateAIOperation = SecurityManager.validateAIOperation;
export const getSecurityStatus = SecurityManager.getSecurityStatus;