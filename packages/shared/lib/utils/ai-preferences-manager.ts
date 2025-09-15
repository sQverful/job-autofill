/**
 * AI Preferences Manager
 * Manages AI-specific user preferences and learning data
 */

import type { UserProfile, AIUserContext, AIPreferences } from '../types/index.js';

export interface AILearningEvent {
  type: 'success' | 'failure' | 'correction';
  instruction: any;
  actualValue?: string;
  userCorrection?: string;
  timestamp: Date;
  url: string;
  formContext?: any;
}

/**
 * AI Preferences Manager utility class
 */
export class AIPreferencesManager {
  
  /**
   * Get default AI preferences
   */
  static getDefaultPreferences(): AIPreferences {
    return {
      preferredTone: 'professional',
      customInstructions: undefined,
      excludedFields: [],
      learningEnabled: true,
      confidenceThreshold: 0.7,
      maxInstructionsPerForm: 50,
      fieldMappingPreferences: {},
      autoApproveInstructions: false
    };
  }

  /**
   * Initialize AI preferences in user profile if not present
   */
  static initializeAIPreferences(userProfile: UserProfile): UserProfile {
    if (!userProfile.preferences) {
      userProfile.preferences = {
        defaultAnswers: {},
        jobPreferences: {
          workAuthorization: 'citizen',
          requiresSponsorship: false,
          willingToRelocate: false,
          availableStartDate: new Date(),
          preferredWorkType: 'remote'
        },
        privacySettings: {
          shareAnalytics: false,
          shareUsageData: false,
          allowAIContentGeneration: true,
          dataSyncEnabled: true
        },
        aiPreferences: this.getDefaultPreferences()
      };
    }

    if (!userProfile.preferences.aiPreferences) {
      userProfile.preferences.aiPreferences = this.getDefaultPreferences();
    }
    
    return userProfile;
  }

  /**
   * Check if a field should be excluded from AI autofill
   */
  static isFieldExcluded(
    userProfile: UserProfile, 
    fieldName: string, 
    selector: string
  ): boolean {
    const aiPreferences = userProfile.preferences?.aiPreferences;
    if (!aiPreferences) {
      return false;
    }

    // Check excluded fields list
    const excludedFields = aiPreferences.excludedFields || [];
    
    // Check by field name
    if (fieldName && excludedFields.some(excluded => 
      fieldName.toLowerCase().includes(excluded.toLowerCase())
    )) {
      return true;
    }

    // Check by selector
    if (selector && excludedFields.some(excluded => 
      selector.toLowerCase().includes(excluded.toLowerCase())
    )) {
      return true;
    }

    return false;
  }

  /**
   * Record a learning event for AI improvement
   */
  static recordLearningEvent(
    userProfile: UserProfile, 
    event: AILearningEvent
  ): UserProfile {
    const updatedProfile = this.initializeAIPreferences(userProfile);

    if (!updatedProfile.preferences.aiPreferences.learningEnabled) {
      return updatedProfile; // Learning disabled
    }

    // Initialize learning data if not present
    if (!updatedProfile.metadata.aiLearningData) {
      updatedProfile.metadata.aiLearningData = {
        events: [],
        patterns: {},
        corrections: {}
      };
    }

    const learningData = updatedProfile.metadata.aiLearningData;

    // Add event to events array
    learningData.events.push(event);

    // Record pattern
    const patternKey = this.generatePatternKey(event);
    if (!learningData.patterns[patternKey]) {
      learningData.patterns[patternKey] = { success: 0, failure: 0 };
    }
    
    if (event.type === 'success') {
      learningData.patterns[patternKey].success++;
    } else {
      learningData.patterns[patternKey].failure++;
    }

    // Store user corrections if applicable
    if (event.actualValue && event.actualValue !== event.instruction.value) {
      const correctionKey = `${patternKey}:${event.timestamp.getTime()}`;
      learningData.corrections[correctionKey] = {
        originalInstruction: event.instruction,
        correctedValue: event.actualValue,
        timestamp: event.timestamp,
        url: event.url
      };
    }

    // Keep only last 1000 events
    if (learningData.events.length > 1000) {
      learningData.events = learningData.events.slice(-1000);
    }

    return updatedProfile;
  }

  /**
   * Generate a pattern key for learning
   */
  private static generatePatternKey(event: AILearningEvent): string {
    const instruction = event.instruction;
    const domain = new URL(event.url).hostname;
    
    return `${domain}:${instruction.action}:${instruction.selector}`;
  }

  /**
   * Update AI preferences
   */
  static updatePreferences(
    userProfile: UserProfile, 
    updates: Partial<AIPreferences>
  ): UserProfile {
    const currentPreferences = userProfile.preferences?.aiPreferences || this.getDefaultPreferences();
    
    return {
      ...userProfile,
      preferences: {
        ...userProfile.preferences,
        aiPreferences: {
          ...currentPreferences,
          ...updates
        }
      }
    };
  }

  /**
   * Update AI preferences (alias for updatePreferences)
   */
  static updateAIPreferences(
    userProfile: UserProfile, 
    updates: Partial<AIPreferences>
  ): UserProfile {
    const currentPreferences = userProfile.preferences?.aiPreferences || this.getDefaultPreferences();
    
    // Handle field mapping preferences merging
    let updatedFieldMappings = currentPreferences.fieldMappingPreferences;
    if (updates.fieldMappingPreferences) {
      updatedFieldMappings = {
        ...currentPreferences.fieldMappingPreferences,
        ...updates.fieldMappingPreferences
      };
    }
    
    const updatedProfile = {
      ...userProfile,
      preferences: {
        ...userProfile.preferences,
        aiPreferences: {
          ...currentPreferences,
          ...updates,
          fieldMappingPreferences: updatedFieldMappings
        }
      },
      metadata: {
        ...userProfile.metadata,
        version: userProfile.metadata.version + 1,
        updatedAt: new Date()
      }
    };
    
    return updatedProfile;
  }

  /**
   * Add field to exclusion list
   */
  static addExcludedField(
    userProfile: UserProfile, 
    fieldName: string
  ): UserProfile {
    const currentPreferences = userProfile.preferences?.aiPreferences || this.getDefaultPreferences();
    const excludedFields = [...currentPreferences.excludedFields];
    
    if (!excludedFields.includes(fieldName)) {
      excludedFields.push(fieldName);
    }

    return this.updatePreferences(userProfile, { excludedFields });
  }

  /**
   * Remove field from exclusion list
   */
  static removeExcludedField(
    userProfile: UserProfile, 
    fieldName: string
  ): UserProfile {
    const currentPreferences = userProfile.preferences?.aiPreferences || this.getDefaultPreferences();
    const excludedFields = currentPreferences.excludedFields.filter(field => field !== fieldName);

    return this.updatePreferences(userProfile, { excludedFields });
  }

  /**
   * Add field mapping preference
   */
  static addFieldMapping(
    userProfile: UserProfile,
    fieldName: string,
    profilePath: string
  ): UserProfile {
    const currentPreferences = userProfile.preferences?.aiPreferences || this.getDefaultPreferences();
    const fieldMappingPreferences = {
      ...currentPreferences.fieldMappingPreferences,
      [fieldName]: profilePath
    };

    return this.updatePreferences(userProfile, { fieldMappingPreferences });
  }

  /**
   * Get learning insights for user
   */
  static getLearningInsights(userProfile: UserProfile): {
    totalOperations: number;
    successRate: number;
    topSuccessPatterns: Array<{ pattern: string; count: number }>;
    topFailurePatterns: Array<{ pattern: string; count: number }>;
    recentCorrections: number;
  } {
    const learningData = (userProfile as any).aiLearningData;
    
    if (!learningData) {
      return {
        totalOperations: 0,
        successRate: 0,
        topSuccessPatterns: [],
        topFailurePatterns: [],
        recentCorrections: 0
      };
    }

    // Get top patterns
    const topSuccessPatterns = Object.entries(learningData.successPatterns || {})
      .map(([pattern, count]) => ({ pattern, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topFailurePatterns = Object.entries(learningData.failurePatterns || {})
      .map(([pattern, count]) => ({ pattern, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Count recent corrections (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentCorrections = (learningData.userCorrections || [])
      .filter((correction: any) => new Date(correction.timestamp) > thirtyDaysAgo)
      .length;

    return {
      totalOperations: learningData.performanceMetrics?.totalOperations || 0,
      successRate: learningData.performanceMetrics?.successRate || 0,
      topSuccessPatterns,
      topFailurePatterns,
      recentCorrections
    };
  }
}