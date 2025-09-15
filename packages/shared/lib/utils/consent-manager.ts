/**
 * User Consent Management for AI Features
 * Handles user consent for AI data processing and privacy compliance
 */

export interface ConsentData {
  aiProcessing: boolean;
  dataSharing: boolean;
  analytics: boolean;
  timestamp: Date;
  version: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConsentOptions {
  required: boolean;
  description: string;
  dataTypes: string[];
  retentionPeriod?: string;
  thirdParties?: string[];
}

export interface ConsentConfiguration {
  aiProcessing: ConsentOptions;
  dataSharing: ConsentOptions;
  analytics: ConsentOptions;
}

export interface ConsentValidationResult {
  isValid: boolean;
  missingConsents: string[];
  expiredConsents: string[];
  warnings: string[];
}

/**
 * Consent Manager for AI features
 */
export class ConsentManager {
  private static readonly CONSENT_VERSION = '1.0.0';
  private static readonly CONSENT_EXPIRY_DAYS = 365; // 1 year
  private static readonly STORAGE_KEY = 'user-consent-data';

  private static readonly DEFAULT_CONFIGURATION: ConsentConfiguration = {
    aiProcessing: {
      required: true,
      description: 'Allow AI processing of form data to provide intelligent autofill suggestions',
      dataTypes: ['Form field data', 'HTML structure', 'User profile information'],
      retentionPeriod: 'Data is processed in real-time and not stored permanently',
      thirdParties: ['OpenAI (for AI processing)'],
    },
    dataSharing: {
      required: false,
      description: 'Share anonymized usage data to improve AI accuracy and performance',
      dataTypes: ['Form success rates', 'Error patterns', 'Performance metrics'],
      retentionPeriod: '12 months',
      thirdParties: ['Analytics service providers'],
    },
    analytics: {
      required: false,
      description: 'Collect usage analytics to improve the extension experience',
      dataTypes: ['Feature usage', 'Performance metrics', 'Error logs'],
      retentionPeriod: '24 months',
      thirdParties: ['Google Analytics'],
    },
  };

  /**
   * Get current consent data
   */
  static async getConsent(): Promise<ConsentData | null> {
    try {
      const stored = await chrome.storage.local.get(this.STORAGE_KEY);
      const consentData = stored[this.STORAGE_KEY];
      
      if (!consentData) {
        return null;
      }

      // Parse stored data
      return {
        ...consentData,
        timestamp: new Date(consentData.timestamp),
      };
    } catch (error) {
      console.error('Failed to get consent data:', error);
      return null;
    }
  }

  /**
   * Set user consent
   */
  static async setConsent(consent: Partial<ConsentData>): Promise<void> {
    try {
      const consentData: ConsentData = {
        aiProcessing: consent.aiProcessing ?? false,
        dataSharing: consent.dataSharing ?? false,
        analytics: consent.analytics ?? false,
        timestamp: new Date(),
        version: this.CONSENT_VERSION,
        userAgent: navigator.userAgent,
        ...consent,
      };

      await chrome.storage.local.set({
        [this.STORAGE_KEY]: consentData,
      });

      // Log consent change for audit
      this.logConsentChange(consentData);
    } catch (error) {
      console.error('Failed to set consent data:', error);
      throw new Error('Failed to save consent preferences');
    }
  }

  /**
   * Check if user has given consent for specific feature
   */
  static async hasConsent(feature: keyof ConsentData): Promise<boolean> {
    if (feature === 'timestamp' || feature === 'version' || feature === 'ipAddress' || feature === 'userAgent') {
      return true; // These are metadata fields
    }

    const consent = await this.getConsent();
    if (!consent) {
      return false;
    }

    // Check if consent is expired
    const isExpired = this.isConsentExpired(consent);
    if (isExpired) {
      return false;
    }

    return consent[feature] === true;
  }

  /**
   * Validate current consent status
   */
  static async validateConsent(): Promise<ConsentValidationResult> {
    const consent = await this.getConsent();
    const result: ConsentValidationResult = {
      isValid: true,
      missingConsents: [],
      expiredConsents: [],
      warnings: [],
    };

    if (!consent) {
      result.isValid = false;
      result.missingConsents = ['aiProcessing']; // Only required consent
      return result;
    }

    // Check if consent is expired
    if (this.isConsentExpired(consent)) {
      result.isValid = false;
      result.expiredConsents = ['aiProcessing'];
      result.warnings.push('Consent has expired and needs to be renewed');
      return result;
    }

    // Check required consents
    const config = this.DEFAULT_CONFIGURATION;
    Object.entries(config).forEach(([key, options]) => {
      if (options.required && !consent[key as keyof ConsentData]) {
        result.isValid = false;
        result.missingConsents.push(key);
      }
    });

    // Check version compatibility
    if (consent.version !== this.CONSENT_VERSION) {
      result.warnings.push('Consent was given for a different version of the privacy policy');
    }

    return result;
  }

  /**
   * Check if consent is expired
   */
  static isConsentExpired(consent: ConsentData): boolean {
    const expiryDate = new Date(consent.timestamp);
    expiryDate.setDate(expiryDate.getDate() + this.CONSENT_EXPIRY_DAYS);
    return new Date() > expiryDate;
  }

  /**
   * Revoke all consents
   */
  static async revokeConsent(): Promise<void> {
    try {
      await chrome.storage.local.remove(this.STORAGE_KEY);
      
      // Log consent revocation
      this.logConsentChange({
        aiProcessing: false,
        dataSharing: false,
        analytics: false,
        timestamp: new Date(),
        version: this.CONSENT_VERSION,
      });
    } catch (error) {
      console.error('Failed to revoke consent:', error);
      throw new Error('Failed to revoke consent');
    }
  }

  /**
   * Get consent configuration for UI display
   */
  static getConsentConfiguration(): ConsentConfiguration {
    return this.DEFAULT_CONFIGURATION;
  }

  /**
   * Generate consent summary for display
   */
  static async getConsentSummary(): Promise<{
    hasValidConsent: boolean;
    consentDate: Date | null;
    enabledFeatures: string[];
    expiryDate: Date | null;
    version: string | null;
  }> {
    const consent = await this.getConsent();
    const validation = await this.validateConsent();

    if (!consent) {
      return {
        hasValidConsent: false,
        consentDate: null,
        enabledFeatures: [],
        expiryDate: null,
        version: null,
      };
    }

    const enabledFeatures: string[] = [];
    if (consent.aiProcessing) enabledFeatures.push('AI Processing');
    if (consent.dataSharing) enabledFeatures.push('Data Sharing');
    if (consent.analytics) enabledFeatures.push('Analytics');

    const expiryDate = new Date(consent.timestamp);
    expiryDate.setDate(expiryDate.getDate() + this.CONSENT_EXPIRY_DAYS);

    return {
      hasValidConsent: validation.isValid,
      consentDate: consent.timestamp,
      enabledFeatures,
      expiryDate,
      version: consent.version,
    };
  }

  /**
   * Check if AI features can be used
   */
  static async canUseAIFeatures(): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    const hasAIConsent = await this.hasConsent('aiProcessing');
    
    if (!hasAIConsent) {
      const consent = await this.getConsent();
      if (!consent) {
        return {
          allowed: false,
          reason: 'No consent given for AI processing',
        };
      }
      
      if (this.isConsentExpired(consent)) {
        return {
          allowed: false,
          reason: 'Consent has expired',
        };
      }
      
      return {
        allowed: false,
        reason: 'AI processing consent not granted',
      };
    }

    return { allowed: true };
  }

  /**
   * Log consent changes for audit purposes
   */
  private static logConsentChange(consent: ConsentData): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action: 'consent_change',
      data: {
        aiProcessing: consent.aiProcessing,
        dataSharing: consent.dataSharing,
        analytics: consent.analytics,
        version: consent.version,
      },
    };

    console.log('[ConsentManager] Consent changed:', logEntry);
    
    // In a production environment, this could be sent to an audit log service
    // For now, we'll store it locally for debugging
    this.storeAuditLog(logEntry);
  }

  /**
   * Store audit log entry
   */
  private static async storeAuditLog(entry: any): Promise<void> {
    try {
      const auditKey = 'consent-audit-log';
      const stored = await chrome.storage.local.get(auditKey);
      const auditLog = stored[auditKey] || [];
      
      auditLog.push(entry);
      
      // Keep only last 100 entries
      if (auditLog.length > 100) {
        auditLog.splice(0, auditLog.length - 100);
      }
      
      await chrome.storage.local.set({
        [auditKey]: auditLog,
      });
    } catch (error) {
      console.error('Failed to store audit log:', error);
    }
  }

  /**
   * Get audit log for debugging/compliance
   */
  static async getAuditLog(): Promise<any[]> {
    try {
      const auditKey = 'consent-audit-log';
      const stored = await chrome.storage.local.get(auditKey);
      return stored[auditKey] || [];
    } catch (error) {
      console.error('Failed to get audit log:', error);
      return [];
    }
  }

  /**
   * Clear audit log
   */
  static async clearAuditLog(): Promise<void> {
    try {
      const auditKey = 'consent-audit-log';
      await chrome.storage.local.remove(auditKey);
    } catch (error) {
      console.error('Failed to clear audit log:', error);
    }
  }

  /**
   * Export consent data for user download
   */
  static async exportConsentData(): Promise<string> {
    const consent = await this.getConsent();
    const auditLog = await this.getAuditLog();
    
    const exportData = {
      consent,
      auditLog,
      exportDate: new Date().toISOString(),
      version: this.CONSENT_VERSION,
    };

    return JSON.stringify(exportData, null, 2);
  }
}

// Utility functions for easy access
export const getConsent = ConsentManager.getConsent;
export const setConsent = ConsentManager.setConsent;
export const hasConsent = ConsentManager.hasConsent;
export const validateConsent = ConsentManager.validateConsent;
export const canUseAIFeatures = ConsentManager.canUseAIFeatures;