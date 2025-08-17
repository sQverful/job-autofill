/**
 * Privacy controls and data deletion capabilities
 */

import { profileStorage } from '@extension/storage';
import { apiClient } from '../api/api-client.js';
import { cacheManager } from '../api/cache-manager.js';
import { authManager } from './auth-manager.js';
import { CryptoManager } from './crypto-manager.js';
import { messageRouter } from '../messaging/message-router.js';
import { stateManager } from '../messaging/state-manager.js';
import { createMessage } from '../messaging/message-types.js';

// Privacy settings interface
export interface PrivacySettings {
  dataCollection: {
    analytics: boolean;
    usageStats: boolean;
    errorReporting: boolean;
    performanceMetrics: boolean;
  };
  dataSharing: {
    aiContentGeneration: boolean;
    profileSuggestions: boolean;
    platformOptimization: boolean;
  };
  dataRetention: {
    profileData: 'indefinite' | '1year' | '2years' | '5years';
    activityLogs: 'none' | '30days' | '90days' | '1year';
    errorLogs: 'none' | '7days' | '30days' | '90days';
  };
  security: {
    twoFactorAuth: boolean;
    sessionTimeout: number; // in minutes
    deviceTrust: boolean;
    biometricAuth: boolean;
  };
  compliance: {
    gdprConsent: boolean;
    ccpaOptOut: boolean;
    consentDate: Date | null;
    lastUpdated: Date;
  };
}

// Data export format
export interface DataExport {
  exportId: string;
  userId: string;
  exportDate: Date;
  format: 'json' | 'csv' | 'xml';
  data: {
    profile: any;
    settings: any;
    activityLogs: any[];
    documents: any[];
  };
  metadata: {
    version: string;
    totalRecords: number;
    fileSize: number;
  };
}

// Data deletion request
export interface DeletionRequest {
  requestId: string;
  userId: string;
  requestDate: Date;
  deletionType: 'partial' | 'complete';
  dataTypes: string[];
  reason?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedDate?: Date;
}

// Default privacy settings
const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  dataCollection: {
    analytics: false,
    usageStats: false,
    errorReporting: true,
    performanceMetrics: false,
  },
  dataSharing: {
    aiContentGeneration: true,
    profileSuggestions: false,
    platformOptimization: false,
  },
  dataRetention: {
    profileData: 'indefinite',
    activityLogs: '90days',
    errorLogs: '30days',
  },
  security: {
    twoFactorAuth: false,
    sessionTimeout: 60, // 1 hour
    deviceTrust: true,
    biometricAuth: false,
  },
  compliance: {
    gdprConsent: false,
    ccpaOptOut: false,
    consentDate: null,
    lastUpdated: new Date(),
  },
};

/**
 * Privacy manager for data protection and compliance
 */
export class PrivacyManager {
  private cryptoManager: CryptoManager;
  private privacyStorage: any;

  constructor() {
    this.cryptoManager = new CryptoManager();
    this.initializeStorage();
    this.setupMessageHandlers();
  }

  /**
   * Initialize privacy settings storage
   */
  private initializeStorage(): void {
    this.privacyStorage = chrome.storage.sync || chrome.storage.local;
  }

  /**
   * Setup message handlers for privacy operations
   */
  private setupMessageHandlers(): void {
    messageRouter.on('privacy:getSettings', async () => {
      return this.getPrivacySettings();
    });

    messageRouter.on('privacy:updateSettings', async (message) => {
      return this.updatePrivacySettings(message.data);
    });

    messageRouter.on('privacy:exportData', async (message) => {
      return this.exportUserData(message.data?.format || 'json');
    });

    messageRouter.on('privacy:deleteData', async (message) => {
      return this.requestDataDeletion(message.data);
    });

    messageRouter.on('privacy:revokeConsent', async () => {
      return this.revokeConsent();
    });
  }

  /**
   * Get current privacy settings
   */
  async getPrivacySettings(): Promise<PrivacySettings> {
    try {
      const result = await this.privacyStorage.get('privacy-settings');
      const stored = result['privacy-settings'];
      
      if (!stored) {
        // First time - return defaults and save them
        await this.updatePrivacySettings(DEFAULT_PRIVACY_SETTINGS);
        return DEFAULT_PRIVACY_SETTINGS;
      }

      // Merge with defaults to handle new settings
      return this.mergePrivacySettings(DEFAULT_PRIVACY_SETTINGS, stored);
    } catch (error) {
      console.error('Failed to get privacy settings:', error);
      return DEFAULT_PRIVACY_SETTINGS;
    }
  }

  /**
   * Update privacy settings
   */
  async updatePrivacySettings(updates: Partial<PrivacySettings>): Promise<PrivacySettings> {
    const currentSettings = await this.getPrivacySettings();
    const newSettings = this.mergePrivacySettings(currentSettings, updates);
    
    // Update last modified date
    newSettings.compliance.lastUpdated = new Date();
    
    try {
      await this.privacyStorage.set({
        'privacy-settings': newSettings,
      });

      // Update application state
      stateManager.updateState({
        ui: {
          ...stateManager.getStateSlice('ui'),
          settings: {
            ...stateManager.getStateSlice('ui').settings,
            notifications: newSettings.dataCollection.analytics,
          },
        },
      });

      // Broadcast settings update
      this.broadcastPrivacyUpdate(newSettings);
      
      return newSettings;
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
      throw new Error('Failed to update privacy settings');
    }
  }

  /**
   * Merge privacy settings with deep merge
   */
  private mergePrivacySettings(base: PrivacySettings, updates: Partial<PrivacySettings>): PrivacySettings {
    const merged = { ...base };
    
    Object.keys(updates).forEach(key => {
      const updateKey = key as keyof PrivacySettings;
      const updateValue = updates[updateKey];
      
      if (updateValue && typeof updateValue === 'object' && !Array.isArray(updateValue)) {
        merged[updateKey] = { ...base[updateKey], ...updateValue } as any;
      } else if (updateValue !== undefined) {
        merged[updateKey] = updateValue as any;
      }
    });
    
    return merged;
  }

  /**
   * Grant consent for data processing
   */
  async grantConsent(consentTypes: string[]): Promise<void> {
    const settings = await this.getPrivacySettings();
    
    const updates: Partial<PrivacySettings> = {
      compliance: {
        ...settings.compliance,
        gdprConsent: consentTypes.includes('gdpr'),
        ccpaOptOut: !consentTypes.includes('ccpa'),
        consentDate: new Date(),
      },
    };

    // Enable data collection based on consent
    if (consentTypes.includes('analytics')) {
      updates.dataCollection = {
        ...settings.dataCollection,
        analytics: true,
        usageStats: true,
      };
    }

    await this.updatePrivacySettings(updates);
  }

  /**
   * Revoke consent and disable data collection
   */
  async revokeConsent(): Promise<void> {
    const updates: Partial<PrivacySettings> = {
      dataCollection: {
        analytics: false,
        usageStats: false,
        errorReporting: false,
        performanceMetrics: false,
      },
      dataSharing: {
        aiContentGeneration: false,
        profileSuggestions: false,
        platformOptimization: false,
      },
      compliance: {
        gdprConsent: false,
        ccpaOptOut: true,
        consentDate: null,
        lastUpdated: new Date(),
      },
    };

    await this.updatePrivacySettings(updates);
    
    // Also clear existing data
    await this.clearAnalyticsData();
  }

  /**
   * Export user data in requested format
   */
  async exportUserData(format: 'json' | 'csv' | 'xml' = 'json'): Promise<DataExport> {
    try {
      const authState = await authManager.getAuthState();
      if (!authState.isAuthenticated || !authState.user) {
        throw new Error('Authentication required for data export');
      }

      // Collect all user data
      const profile = await profileStorage.get();
      const privacySettings = await this.getPrivacySettings();
      const activityLogs = await this.getActivityLogs();
      
      const exportData: DataExport = {
        exportId: this.cryptoManager.generateSecureUUID(),
        userId: authState.user.id,
        exportDate: new Date(),
        format,
        data: {
          profile: this.sanitizeForExport(profile),
          settings: privacySettings,
          activityLogs: activityLogs,
          documents: profile.documents || {},
        },
        metadata: {
          version: chrome.runtime.getManifest().version,
          totalRecords: 0,
          fileSize: 0,
        },
      };

      // Calculate metadata
      const serialized = JSON.stringify(exportData.data);
      exportData.metadata.fileSize = new Blob([serialized]).size;
      exportData.metadata.totalRecords = this.countRecords(exportData.data);

      // Convert to requested format
      if (format === 'csv') {
        // Convert to CSV format (simplified)
        exportData.data = this.convertToCSV(exportData.data) as any;
      } else if (format === 'xml') {
        // Convert to XML format (simplified)
        exportData.data = this.convertToXML(exportData.data) as any;
      }

      return exportData;
    } catch (error) {
      console.error('Data export failed:', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Request data deletion
   */
  async requestDataDeletion(options: {
    deletionType: 'partial' | 'complete';
    dataTypes?: string[];
    reason?: string;
  }): Promise<DeletionRequest> {
    const authState = await authManager.getAuthState();
    if (!authState.isAuthenticated || !authState.user) {
      throw new Error('Authentication required for data deletion');
    }

    const deletionRequest: DeletionRequest = {
      requestId: this.cryptoManager.generateSecureUUID(),
      userId: authState.user.id,
      requestDate: new Date(),
      deletionType: options.deletionType,
      dataTypes: options.dataTypes || [],
      reason: options.reason,
      status: 'pending',
    };

    try {
      // Process deletion request
      await this.processDeletionRequest(deletionRequest);
      
      return deletionRequest;
    } catch (error) {
      console.error('Data deletion failed:', error);
      deletionRequest.status = 'failed';
      throw new Error('Failed to process data deletion request');
    }
  }

  /**
   * Process data deletion request
   */
  private async processDeletionRequest(request: DeletionRequest): Promise<void> {
    request.status = 'processing';

    try {
      if (request.deletionType === 'complete') {
        // Complete account deletion
        await this.deleteAllUserData();
      } else {
        // Partial deletion based on data types
        await this.deleteSpecificData(request.dataTypes);
      }

      request.status = 'completed';
      request.completedDate = new Date();
    } catch (error) {
      request.status = 'failed';
      throw error;
    }
  }

  /**
   * Delete all user data
   */
  private async deleteAllUserData(): Promise<void> {
    // Clear profile data
    await profileStorage.resetProfile();
    
    // Clear authentication data
    await authManager.logout();
    
    // Clear privacy settings
    await this.privacyStorage.remove('privacy-settings');
    
    // Clear cache
    await cacheManager.clear();
    
    // Clear crypto data
    await this.cryptoManager.clearAllCryptoData();
    
    // Clear all Chrome storage
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
    
    // Notify API to delete server-side data
    try {
      await apiClient.deleteProfile();
    } catch (error) {
      console.warn('Failed to delete server-side data:', error);
    }
  }

  /**
   * Delete specific data types
   */
  private async deleteSpecificData(dataTypes: string[]): Promise<void> {
    for (const dataType of dataTypes) {
      switch (dataType) {
        case 'profile':
          await profileStorage.resetProfile();
          break;
        case 'documents':
          await profileStorage.updateDocuments({ resumes: [], coverLetters: [] });
          break;
        case 'activity':
          await this.clearActivityLogs();
          break;
        case 'cache':
          await cacheManager.clear();
          break;
        case 'settings':
          await this.privacyStorage.remove('privacy-settings');
          break;
      }
    }
  }

  /**
   * Clear analytics and usage data
   */
  private async clearAnalyticsData(): Promise<void> {
    // Clear local analytics data
    await chrome.storage.local.remove([
      'analytics-data',
      'usage-stats',
      'performance-metrics',
    ]);
    
    // Clear activity logs
    await this.clearActivityLogs();
  }

  /**
   * Clear activity logs
   */
  private async clearActivityLogs(): Promise<void> {
    await chrome.storage.local.remove('activity-logs');
  }

  /**
   * Get activity logs (if enabled)
   */
  private async getActivityLogs(): Promise<any[]> {
    const settings = await this.getPrivacySettings();
    if (settings.dataRetention.activityLogs === 'none') {
      return [];
    }

    try {
      const result = await chrome.storage.local.get('activity-logs');
      return result['activity-logs'] || [];
    } catch (error) {
      console.error('Failed to get activity logs:', error);
      return [];
    }
  }

  /**
   * Sanitize data for export (remove sensitive information)
   */
  private sanitizeForExport(data: any): any {
    if (!data) return data;
    
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    if (sanitized.metadata) {
      delete sanitized.metadata.lastSyncAt;
    }
    
    return sanitized;
  }

  /**
   * Count total records in export data
   */
  private countRecords(data: any): number {
    let count = 0;
    
    if (data.profile) count++;
    if (data.settings) count++;
    if (data.activityLogs) count += data.activityLogs.length;
    if (data.documents) {
      count += (data.documents.resumes || []).length;
      count += (data.documents.coverLetters || []).length;
    }
    
    return count;
  }

  /**
   * Convert data to CSV format (simplified)
   */
  private convertToCSV(data: any): string {
    // This is a simplified CSV conversion
    // In a real implementation, you'd want a proper CSV library
    const lines: string[] = [];
    
    // Add profile data
    if (data.profile) {
      lines.push('Profile Data');
      lines.push(`Name,${data.profile.personalInfo?.firstName || ''} ${data.profile.personalInfo?.lastName || ''}`);
      lines.push(`Email,${data.profile.personalInfo?.email || ''}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Convert data to XML format (simplified)
   */
  private convertToXML(data: any): string {
    // This is a simplified XML conversion
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<userdata>\n';
    
    if (data.profile) {
      xml += '  <profile>\n';
      xml += `    <name>${data.profile.personalInfo?.firstName || ''} ${data.profile.personalInfo?.lastName || ''}</name>\n`;
      xml += `    <email>${data.profile.personalInfo?.email || ''}</email>\n`;
      xml += '  </profile>\n';
    }
    
    xml += '</userdata>';
    return xml;
  }

  /**
   * Broadcast privacy settings update
   */
  private broadcastPrivacyUpdate(settings: PrivacySettings): void {
    const message = createMessage({
      type: 'privacy:updated' as any,
      source: 'background' as const,
      data: settings,
    });
    
    messageRouter.broadcastToExtension(message);
  }

  /**
   * Check if data collection is allowed
   */
  async isDataCollectionAllowed(type: keyof PrivacySettings['dataCollection']): Promise<boolean> {
    const settings = await this.getPrivacySettings();
    return settings.dataCollection[type];
  }

  /**
   * Check if data sharing is allowed
   */
  async isDataSharingAllowed(type: keyof PrivacySettings['dataSharing']): Promise<boolean> {
    const settings = await this.getPrivacySettings();
    return settings.dataSharing[type];
  }

  /**
   * Get privacy compliance status
   */
  async getComplianceStatus(): Promise<{
    gdprCompliant: boolean;
    ccpaCompliant: boolean;
    consentRequired: boolean;
    lastUpdated: Date;
  }> {
    const settings = await this.getPrivacySettings();
    
    return {
      gdprCompliant: settings.compliance.gdprConsent,
      ccpaCompliant: settings.compliance.ccpaOptOut,
      consentRequired: !settings.compliance.consentDate,
      lastUpdated: settings.compliance.lastUpdated,
    };
  }
}

// Export singleton instance
export const privacyManager = new PrivacyManager();