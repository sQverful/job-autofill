/**
 * Confidence scoring system for form detection
 * Provides sophisticated algorithms to score form detection accuracy
 */

import type { FormField, JobPlatform, DetectedForm } from '@extension/shared/lib/types/form-detection';

export interface ConfidenceFactors {
  platformMatch: number;
  fieldCount: number;
  requiredFields: number;
  profileMapping: number;
  jobKeywords: number;
  formStructure: number;
  fieldTypes: number;
  labelQuality: number;
}

export interface ScoringWeights {
  platformMatch: number;
  fieldCount: number;
  requiredFields: number;
  profileMapping: number;
  jobKeywords: number;
  formStructure: number;
  fieldTypes: number;
  labelQuality: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  platformMatch: 0.25,
  fieldCount: 0.15,
  requiredFields: 0.10,
  profileMapping: 0.20,
  jobKeywords: 0.10,
  formStructure: 0.10,
  fieldTypes: 0.05,
  labelQuality: 0.05
};

/**
 * Advanced confidence scoring for form detection
 */
export class ConfidenceScorer {
  private weights: ScoringWeights;

  constructor(weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS) {
    this.weights = weights;
  }

  /**
   * Calculate overall confidence score for a detected form
   */
  calculateConfidence(
    formElement: HTMLElement,
    fields: FormField[],
    platform: JobPlatform,
    document: Document = window.document
  ): number {
    const factors = this.calculateConfidenceFactors(formElement, fields, platform, document);
    
    const weightedScore = 
      factors.platformMatch * this.weights.platformMatch +
      factors.fieldCount * this.weights.fieldCount +
      factors.requiredFields * this.weights.requiredFields +
      factors.profileMapping * this.weights.profileMapping +
      factors.jobKeywords * this.weights.jobKeywords +
      factors.formStructure * this.weights.formStructure +
      factors.fieldTypes * this.weights.fieldTypes +
      factors.labelQuality * this.weights.labelQuality;

    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, weightedScore));
  }

  /**
   * Calculate individual confidence factors
   */
  calculateConfidenceFactors(
    formElement: HTMLElement,
    fields: FormField[],
    platform: JobPlatform,
    document: Document
  ): ConfidenceFactors {
    return {
      platformMatch: this.scorePlatformMatch(platform, document),
      fieldCount: this.scoreFieldCount(fields),
      requiredFields: this.scoreRequiredFields(fields),
      profileMapping: this.scoreProfileMapping(fields),
      jobKeywords: this.scoreJobKeywords(formElement, document),
      formStructure: this.scoreFormStructure(formElement),
      fieldTypes: this.scoreFieldTypes(fields),
      labelQuality: this.scoreLabelQuality(fields)
    };
  }

  /**
   * Score platform match confidence
   */
  private scorePlatformMatch(platform: JobPlatform, document: Document): number {
    const url = document.location.href.toLowerCase();
    const hostname = document.location.hostname.toLowerCase();

    switch (platform) {
      case 'linkedin':
        if (hostname.includes('linkedin.com') && url.includes('jobs')) {
          return 1.0;
        }
        if (hostname.includes('linkedin.com')) {
          return 0.8;
        }
        return 0.0;

      case 'indeed':
        if (hostname.includes('indeed.com') && (url.includes('apply') || url.includes('job'))) {
          return 1.0;
        }
        if (hostname.includes('indeed.com')) {
          return 0.8;
        }
        return 0.0;

      case 'workday':
        if (url.includes('workday') || document.querySelector('[class*="workday"], [id*="workday"]')) {
          return 1.0;
        }
        // Check for common Workday indicators
        const workdayIndicators = [
          'wd-', 'workday', 'talent', 'careers'
        ];
        const hasWorkdayIndicators = workdayIndicators.some(indicator => 
          url.includes(indicator) || document.body.className.includes(indicator)
        );
        return hasWorkdayIndicators ? 0.7 : 0.0;

      case 'custom':
        // For custom platforms, look for job-related indicators
        const jobIndicators = ['career', 'job', 'apply', 'position', 'hiring'];
        const hasJobIndicators = jobIndicators.some(indicator => 
          url.includes(indicator) || document.title.toLowerCase().includes(indicator)
        );
        return hasJobIndicators ? 0.6 : 0.3;

      default:
        return 0.0;
    }
  }

  /**
   * Score based on field count
   */
  private scoreFieldCount(fields: FormField[]): number {
    const count = fields.length;
    
    if (count < 3) return 0.0;      // Too few fields for a job application
    if (count < 5) return 0.3;      // Minimal application form
    if (count < 10) return 0.6;     // Standard application form
    if (count < 20) return 0.9;     // Comprehensive application form
    return 1.0;                     // Very detailed application form
  }

  /**
   * Score based on required fields
   */
  private scoreRequiredFields(fields: FormField[]): number {
    const totalFields = fields.length;
    const requiredFields = fields.filter(f => f.required).length;
    
    if (totalFields === 0) return 0.0;
    
    const requiredRatio = requiredFields / totalFields;
    
    // Job applications typically have 30-70% required fields
    if (requiredRatio >= 0.3 && requiredRatio <= 0.7) {
      return 1.0;
    }
    if (requiredRatio >= 0.2 && requiredRatio <= 0.8) {
      return 0.8;
    }
    if (requiredRatio >= 0.1 && requiredRatio <= 0.9) {
      return 0.6;
    }
    
    return 0.3; // Too few or too many required fields
  }

  /**
   * Score based on profile field mapping
   */
  private scoreProfileMapping(fields: FormField[]): number {
    const totalFields = fields.length;
    const mappedFields = fields.filter(f => f.mappedProfileField).length;
    
    if (totalFields === 0) return 0.0;
    
    const mappingRatio = mappedFields / totalFields;
    
    // Higher mapping ratio indicates better job application form detection
    if (mappingRatio >= 0.7) return 1.0;
    if (mappingRatio >= 0.5) return 0.8;
    if (mappingRatio >= 0.3) return 0.6;
    if (mappingRatio >= 0.1) return 0.4;
    
    return 0.2;
  }

  /**
   * Score based on job-related keywords
   */
  private scoreJobKeywords(formElement: HTMLElement, document: Document): number {
    const formText = (formElement.textContent || '').toLowerCase();
    const pageText = (document.body.textContent || '').toLowerCase();
    const combinedText = `${formText} ${pageText}`;

    const jobKeywords = [
      'apply', 'application', 'job', 'career', 'position', 'role',
      'resume', 'cv', 'cover letter', 'experience', 'qualification',
      'employment', 'hiring', 'recruit', 'candidate', 'applicant'
    ];

    const strongJobKeywords = [
      'job application', 'apply now', 'submit application', 'career opportunity',
      'position details', 'job posting', 'employment application'
    ];

    let score = 0;
    let keywordCount = 0;

    // Check for strong job keywords (higher weight)
    for (const keyword of strongJobKeywords) {
      if (combinedText.includes(keyword)) {
        score += 0.3;
        keywordCount++;
      }
    }

    // Check for regular job keywords
    for (const keyword of jobKeywords) {
      if (combinedText.includes(keyword)) {
        score += 0.1;
        keywordCount++;
      }
    }

    // Normalize score based on keyword density
    const maxScore = 1.0;
    const normalizedScore = Math.min(score, maxScore);
    
    // Bonus for keyword diversity
    const diversityBonus = Math.min(keywordCount / jobKeywords.length, 0.2);
    
    return Math.min(normalizedScore + diversityBonus, 1.0);
  }

  /**
   * Score based on form structure
   */
  private scoreFormStructure(formElement: HTMLElement): number {
    let score = 0.5; // Base score

    // Check for proper form structure
    const hasFormTag = formElement.tagName.toLowerCase() === 'form';
    if (hasFormTag) score += 0.2;

    // Check for fieldsets or sections
    const hasFieldsets = formElement.querySelectorAll('fieldset, section, .form-section').length > 0;
    if (hasFieldsets) score += 0.1;

    // Check for labels
    const inputs = formElement.querySelectorAll('input, textarea, select');
    const labels = formElement.querySelectorAll('label');
    const labelRatio = inputs.length > 0 ? labels.length / inputs.length : 0;
    if (labelRatio >= 0.8) score += 0.1;
    else if (labelRatio >= 0.5) score += 0.05;

    // Check for submit button
    const hasSubmitButton = formElement.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    if (hasSubmitButton) score += 0.1;

    // Check for form validation attributes
    const hasValidation = formElement.querySelector('[required], [pattern], [minlength], [maxlength]');
    if (hasValidation) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Score based on field type diversity
   */
  private scoreFieldTypes(fields: FormField[]): number {
    const fieldTypes = new Set(fields.map(f => f.type));
    const typeCount = fieldTypes.size;
    
    // Job applications typically have diverse field types
    if (typeCount >= 5) return 1.0;
    if (typeCount >= 4) return 0.8;
    if (typeCount >= 3) return 0.6;
    if (typeCount >= 2) return 0.4;
    
    return 0.2;
  }

  /**
   * Score based on label quality
   */
  private scoreLabelQuality(fields: FormField[]): number {
    if (fields.length === 0) return 0.0;

    let qualityScore = 0;
    let totalFields = fields.length;

    for (const field of fields) {
      const label = field.label.toLowerCase();
      
      // Check if label is meaningful (not just "Unknown Field" or similar)
      if (label === 'unknown field' || label === '' || label.length < 2) {
        continue; // Skip poor quality labels
      }

      // Bonus for descriptive labels
      if (label.length >= 5 && label.includes(' ')) {
        qualityScore += 1.0;
      } else if (label.length >= 3) {
        qualityScore += 0.7;
      } else {
        qualityScore += 0.3;
      }
    }

    return totalFields > 0 ? qualityScore / totalFields : 0.0;
  }

  /**
   * Get detailed confidence breakdown for debugging
   */
  getConfidenceBreakdown(
    formElement: HTMLElement,
    fields: FormField[],
    platform: JobPlatform,
    document: Document = window.document
  ): { factors: ConfidenceFactors; weightedScores: Record<string, number>; totalScore: number } {
    const factors = this.calculateConfidenceFactors(formElement, fields, platform, document);
    
    const weightedScores = {
      platformMatch: factors.platformMatch * this.weights.platformMatch,
      fieldCount: factors.fieldCount * this.weights.fieldCount,
      requiredFields: factors.requiredFields * this.weights.requiredFields,
      profileMapping: factors.profileMapping * this.weights.profileMapping,
      jobKeywords: factors.jobKeywords * this.weights.jobKeywords,
      formStructure: factors.formStructure * this.weights.formStructure,
      fieldTypes: factors.fieldTypes * this.weights.fieldTypes,
      labelQuality: factors.labelQuality * this.weights.labelQuality
    };

    const totalScore = Object.values(weightedScores).reduce((sum, score) => sum + score, 0);

    return {
      factors,
      weightedScores,
      totalScore: Math.max(0, Math.min(1, totalScore))
    };
  }
}