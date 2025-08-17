/**
 * Comprehensive platform detector that automatically detects and uses
 * the appropriate platform-specific form detection module
 */

import type {
  FormDetectionResult,
  JobPlatform,
  DetectedForm
} from '@extension/shared/lib/types/form-detection';

import {
  LinkedInFormDetector,
  IndeedFormDetector,
  WorkdayFormDetector,
  CustomFormDetector,
  detectPlatform
} from './platforms';

export interface PlatformDetectionConfig {
  enableAllPlatforms: boolean;
  platformPriority: JobPlatform[];
  fallbackToCustom: boolean;
  maxDetectionTime: number;
}

export const DEFAULT_PLATFORM_CONFIG: PlatformDetectionConfig = {
  enableAllPlatforms: true,
  platformPriority: ['linkedin', 'indeed', 'workday', 'custom'],
  fallbackToCustom: true,
  maxDetectionTime: 10000 // 10 seconds
};

/**
 * Comprehensive platform detector that automatically detects forms
 * across all supported job platforms
 */
export class PlatformFormDetector {
  private config: PlatformDetectionConfig;
  private detectors: Map<JobPlatform, any>;

  constructor(config: PlatformDetectionConfig = DEFAULT_PLATFORM_CONFIG) {
    this.config = config;
    this.detectors = new Map();
    this.initializeDetectors();
  }

  /**
   * Initialize platform-specific detectors
   */
  private initializeDetectors(): void {
    if (this.config.enableAllPlatforms) {
      this.detectors.set('linkedin', new LinkedInFormDetector());
      this.detectors.set('indeed', new IndeedFormDetector());
      this.detectors.set('workday', new WorkdayFormDetector());
      this.detectors.set('custom', new CustomFormDetector());
    }
  }

  /**
   * Detect forms using the most appropriate platform detector
   */
  async detectForms(document: Document = window.document): Promise<FormDetectionResult> {
    const startTime = Date.now();
    
    try {
      // First, detect the platform
      const detectedPlatform = detectPlatform(document);
      
      // Try platform-specific detection first
      const platformResult = await this.detectForPlatform(detectedPlatform, document);
      
      // If platform-specific detection found forms, return them
      if (platformResult.success && platformResult.forms.length > 0) {
        return {
          ...platformResult,
          platformSpecificData: {
            ...platformResult.platformSpecificData,
            detectedPlatform,
            detectionMethod: 'platform_specific'
          }
        };
      }

      // If no forms found and fallback is enabled, try other platforms
      if (this.config.fallbackToCustom && platformResult.forms.length === 0) {
        const fallbackResult = await this.detectWithFallback(detectedPlatform, document, startTime);
        if (fallbackResult.forms.length > 0) {
          return fallbackResult;
        }
      }

      // Return the original platform result (even if empty)
      return {
        ...platformResult,
        platformSpecificData: {
          ...platformResult.platformSpecificData,
          detectedPlatform,
          detectionMethod: 'platform_specific',
          fallbackAttempted: this.config.fallbackToCustom
        }
      };

    } catch (error) {
      return {
        success: false,
        forms: [],
        errors: [{
          code: 'PLATFORM_DETECTION_ERROR',
          message: `Platform detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        platformSpecificData: {
          detectionMethod: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Detect forms for a specific platform
   */
  private async detectForPlatform(platform: JobPlatform, document: Document): Promise<FormDetectionResult> {
    const detector = this.detectors.get(platform);
    if (!detector) {
      return {
        success: false,
        forms: [],
        errors: [{
          code: 'DETECTOR_NOT_FOUND',
          message: `No detector available for platform: ${platform}`
        }]
      };
    }

    // Call the appropriate platform-specific detection method
    switch (platform) {
      case 'linkedin':
        return await detector.detectLinkedInForms(document);
      case 'indeed':
        return await detector.detectIndeedForms(document);
      case 'workday':
        return await detector.detectWorkdayForms(document);
      case 'custom':
      default:
        return await detector.detectCustomForms(document);
    }
  }

  /**
   * Try fallback detection with other platforms
   */
  private async detectWithFallback(
    originalPlatform: JobPlatform, 
    document: Document, 
    startTime: number
  ): Promise<FormDetectionResult> {
    const allForms: DetectedForm[] = [];
    const allErrors: any[] = [];
    const platformResults: Record<string, any> = {};

    // Try other platforms in priority order
    for (const platform of this.config.platformPriority) {
      // Skip the original platform (already tried)
      if (platform === originalPlatform) continue;
      
      // Check timeout
      if (Date.now() - startTime > this.config.maxDetectionTime) {
        allErrors.push({
          code: 'DETECTION_TIMEOUT',
          message: `Detection timeout exceeded: ${this.config.maxDetectionTime}ms`
        });
        break;
      }

      try {
        const result = await this.detectForPlatform(platform, document);
        platformResults[platform] = result;
        
        if (result.success && result.forms.length > 0) {
          // Mark forms as detected by fallback
          const fallbackForms = result.forms.map(form => ({
            ...form,
            platform: originalPlatform, // Keep original platform but note fallback
            formId: `${platform}_fallback_${form.formId}`
          }));
          
          allForms.push(...fallbackForms);
        }
        
        if (result.errors) {
          allErrors.push(...result.errors);
        }
      } catch (error) {
        allErrors.push({
          code: 'FALLBACK_ERROR',
          message: `Fallback detection failed for ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return {
      success: allForms.length > 0,
      forms: allForms,
      errors: allErrors,
      platformSpecificData: {
        detectedPlatform: originalPlatform,
        detectionMethod: 'fallback',
        fallbackResults: platformResults,
        detectionTime: Date.now() - startTime
      }
    };
  }

  /**
   * Detect forms on all platforms simultaneously (for debugging/comparison)
   */
  async detectFormsOnAllPlatforms(document: Document = window.document): Promise<Record<JobPlatform, FormDetectionResult>> {
    const results: Record<JobPlatform, FormDetectionResult> = {} as any;
    
    const detectionPromises = this.config.platformPriority.map(async (platform) => {
      try {
        const result = await this.detectForPlatform(platform, document);
        return { platform, result };
      } catch (error) {
        return {
          platform,
          result: {
            success: false,
            forms: [],
            errors: [{
              code: 'PLATFORM_ERROR',
              message: `Detection failed for ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          }
        };
      }
    });

    const detectionResults = await Promise.all(detectionPromises);
    
    for (const { platform, result } of detectionResults) {
      results[platform] = result;
    }

    return results;
  }

  /**
   * Get detection statistics for debugging
   */
  async getDetectionStats(document: Document = window.document): Promise<{
    detectedPlatform: JobPlatform;
    platformResults: Record<JobPlatform, FormDetectionResult>;
    totalForms: number;
    totalErrors: number;
    bestPlatform: JobPlatform | null;
    detectionTime: number;
  }> {
    const startTime = Date.now();
    const detectedPlatform = detectPlatform(document);
    const platformResults = await this.detectFormsOnAllPlatforms(document);
    
    let totalForms = 0;
    let totalErrors = 0;
    let bestPlatform: JobPlatform | null = null;
    let maxForms = 0;

    for (const [platform, result] of Object.entries(platformResults)) {
      totalForms += result.forms.length;
      totalErrors += result.errors.length;
      
      if (result.forms.length > maxForms) {
        maxForms = result.forms.length;
        bestPlatform = platform as JobPlatform;
      }
    }

    return {
      detectedPlatform,
      platformResults,
      totalForms,
      totalErrors,
      bestPlatform,
      detectionTime: Date.now() - startTime
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PlatformDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize detectors if platform settings changed
    if (newConfig.enableAllPlatforms !== undefined || newConfig.platformPriority) {
      this.detectors.clear();
      this.initializeDetectors();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): PlatformDetectionConfig {
    return { ...this.config };
  }
}