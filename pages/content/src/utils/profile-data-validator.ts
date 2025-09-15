/**
 * Profile Data Completeness Validation
 * Ensures all common form fields have corresponding profile values with intelligent defaults
 */

import type { UserProfile, FormField, FieldType } from '@extension/shared';

export interface ProfileValueResult {
  value: string | null;
  source: 'profile' | 'default' | 'fallback' | 'context';
  confidence: number;
  alternatives?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  suggestions: Record<string, string>;
  completeness: number;
}

/**
 * Enhanced profile data validator with intelligent defaults and fallback generation
 */
export class ProfileDataValidator {
  private readonly demographicFields = [
    'privacy_consent',
    'pronouns', 
    'gender_identity',
    'sexual_orientation',
    'disability',
    'neurodivergent',
    'ethnicity',
    'veteran_status',
    'transgender'
  ];

  private readonly workAuthorizationFields = [
    'work_authorization',
    'visa_sponsorship',
    'sponsorship_required',
    'us_person',
    'right_to_work'
  ];

  private readonly commonFields = [
    'start_date',
    'availability',
    'salary_expectations',
    'salary_range',
    'relocation',
    'remote_work',
    'years_experience',
    'relevant_experience',
    'why_interested',
    'motivation',
    'cover_letter',
    'references'
  ];

  /**
   * Get profile value with intelligent defaults and fallback generation
   */
  getProfileValue(field: FormField, profile: UserProfile): ProfileValueResult {
    // First try to get from mapped profile field
    if (field.mappedProfileField) {
      const profileValue = this.getValueFromProfilePath(field.mappedProfileField, profile);
      if (profileValue !== null) {
        return {
          value: profileValue,
          source: 'profile',
          confidence: 1.0
        };
      }
    }

    // Try to get from default answers by exact key match
    const defaultValue = this.getDefaultAnswerValue(field, profile);
    if (defaultValue !== null) {
      return {
        value: defaultValue,
        source: 'default',
        confidence: 0.9
      };
    }

    // Generate intelligent fallback based on field context
    const fallbackValue = this.generateFallbackValue(field, profile);
    if (fallbackValue !== null) {
      return {
        value: fallbackValue,
        source: 'fallback',
        confidence: 0.7,
        alternatives: this.generateAlternativeValues(field, profile)
      };
    }

    // Generate context-based value as last resort
    const contextValue = this.generateContextBasedValue(field, profile);
    return {
      value: contextValue,
      source: 'context',
      confidence: 0.5,
      alternatives: this.generateAlternativeValues(field, profile)
    };
  }

  /**
   * Validate profile data completeness for common form fields
   */
  validateProfileCompleteness(profile: UserProfile): ValidationResult {
    const missingFields: string[] = [];
    const suggestions: Record<string, string> = {};
    let totalFields = 0;
    let completedFields = 0;

    // Check essential demographic fields
    for (const fieldKey of this.demographicFields) {
      totalFields++;
      const hasValue = this.hasDefaultAnswer(fieldKey, profile);
      if (hasValue) {
        completedFields++;
      } else {
        missingFields.push(fieldKey);
        suggestions[fieldKey] = this.getDefaultDemographicValue(fieldKey);
      }
    }

    // Check work authorization fields
    for (const fieldKey of this.workAuthorizationFields) {
      totalFields++;
      const hasValue = this.hasDefaultAnswer(fieldKey, profile) || 
                      this.hasWorkAuthorizationValue(profile);
      if (hasValue) {
        completedFields++;
      } else {
        missingFields.push(fieldKey);
        suggestions[fieldKey] = this.getDefaultWorkAuthorizationValue(fieldKey, profile);
      }
    }

    // Check common application fields
    for (const fieldKey of this.commonFields) {
      totalFields++;
      const hasValue = this.hasDefaultAnswer(fieldKey, profile);
      if (hasValue) {
        completedFields++;
      } else {
        missingFields.push(fieldKey);
        suggestions[fieldKey] = this.getDefaultCommonFieldValue(fieldKey, profile);
      }
    }

    const completeness = totalFields > 0 ? completedFields / totalFields : 0;

    return {
      isValid: missingFields.length === 0,
      missingFields,
      suggestions,
      completeness
    };
  }

  /**
   * Get value from profile using dot notation path
   */
  private getValueFromProfilePath(path: string, profile: UserProfile): string | null {
    const fieldPath = path.split('.');
    let value: any = profile;

    for (const part of fieldPath) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return this.formatProfileValue(value);
  }

  /**
   * Format profile value to string
   */
  private formatProfileValue(value: any): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      return value.trim() || null;
    } else if (typeof value === 'number') {
      return value.toString();
    } else if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    } else if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    } else if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : null;
    }

    return String(value);
  }

  /**
   * Get value from default answers with fuzzy matching
   */
  private getDefaultAnswerValue(field: FormField, profile: UserProfile): string | null {
    const defaultAnswers = profile.preferences.defaultAnswers;
    const label = field.label.toLowerCase();

    // Direct key match
    if (defaultAnswers[label]) {
      return defaultAnswers[label];
    }

    // Try mapped profile field key
    if (field.mappedProfileField) {
      const fieldKey = field.mappedProfileField.split('.').pop();
      if (fieldKey && defaultAnswers[fieldKey]) {
        return defaultAnswers[fieldKey];
      }
    }

    // Fuzzy matching for common patterns
    for (const [key, answer] of Object.entries(defaultAnswers)) {
      if (this.isFieldMatch(label, key) || this.isFieldMatch(key, label)) {
        return answer;
      }
    }

    return null;
  }

  /**
   * Check if two field identifiers match (fuzzy matching)
   */
  private isFieldMatch(field1: string, field2: string): boolean {
    const normalize = (str: string) => str.toLowerCase().replace(/[_\s-]/g, '');
    const normalized1 = normalize(field1);
    const normalized2 = normalize(field2);

    // Exact match
    if (normalized1 === normalized2) return true;

    // Substring match (minimum 4 characters)
    if (normalized1.length >= 4 && normalized2.length >= 4) {
      return normalized1.includes(normalized2) || normalized2.includes(normalized1);
    }

    return false;
  }

  /**
   * Generate intelligent fallback value based on field context
   */
  private generateFallbackValue(field: FormField, profile: UserProfile): string | null {
    const label = field.label.toLowerCase();
    const fieldType = field.type;

    // Demographic fields get "Prefer not to say"
    if (this.isDemographicField(label)) {
      return 'Prefer not to say';
    }

    // Work authorization fields
    if (this.isWorkAuthorizationField(label)) {
      return this.getDefaultWorkAuthorizationValue(label, profile);
    }

    // Date fields
    if (fieldType === 'date' || this.isDateField(label)) {
      return this.getDefaultDateValue(label, profile);
    }

    // Salary fields
    if (this.isSalaryField(label)) {
      return this.getDefaultSalaryValue(profile);
    }

    // Text fields with context
    if (fieldType === 'textarea' || this.isLongTextField(label)) {
      return this.getDefaultTextValue(label, profile);
    }

    // Boolean-like fields
    if (this.isBooleanField(label)) {
      return this.getDefaultBooleanValue(label, profile);
    }

    // Experience fields
    if (this.isExperienceField(label)) {
      return this.getDefaultExperienceValue(profile);
    }

    return null;
  }

  /**
   * Generate context-based value as last resort
   */
  private generateContextBasedValue(field: FormField, profile: UserProfile): string | null {
    const label = field.label.toLowerCase();

    // For required fields, provide generic but appropriate responses
    if (field.required) {
      if (this.isDemographicField(label)) {
        return 'Prefer not to say';
      }
      
      if (this.isWorkAuthorizationField(label)) {
        return 'Please contact me to discuss';
      }

      if (field.type === 'email') {
        return profile.personalInfo.email || '';
      }

      if (field.type === 'phone') {
        return profile.personalInfo.phone || '';
      }

      if (this.isTextualField(field.type)) {
        return 'Please contact me for details';
      }
    }

    return null;
  }

  /**
   * Generate alternative values for a field
   */
  private generateAlternativeValues(field: FormField, profile: UserProfile): string[] {
    const alternatives: string[] = [];
    const label = field.label.toLowerCase();

    if (this.isDemographicField(label)) {
      alternatives.push('Prefer not to say', 'I choose not to disclose', 'Not specified');
    }

    if (this.isWorkAuthorizationField(label)) {
      alternatives.push(
        'Yes, I am authorized to work',
        'No, I require sponsorship',
        'Please contact me to discuss'
      );
    }

    if (this.isSalaryField(label)) {
      alternatives.push(
        'Competitive and negotiable',
        'Based on market rates',
        'Open to discussion'
      );
    }

    return alternatives;
  }

  /**
   * Check if profile has default answer for a field
   */
  private hasDefaultAnswer(fieldKey: string, profile: UserProfile): boolean {
    const defaultAnswers = profile.preferences.defaultAnswers;
    return Boolean(defaultAnswers[fieldKey] && defaultAnswers[fieldKey].trim());
  }

  /**
   * Check if profile has work authorization information
   */
  private hasWorkAuthorizationValue(profile: UserProfile): boolean {
    return Boolean(profile.preferences.jobPreferences.workAuthorization);
  }

  /**
   * Get default value for demographic fields
   */
  private getDefaultDemographicValue(fieldKey: string): string {
    const demographicDefaults: Record<string, string> = {
      'privacy_consent': 'I consent to the processing of my personal data',
      'pronouns': 'Prefer not to say',
      'gender_identity': 'Prefer not to say',
      'sexual_orientation': 'Prefer not to say',
      'disability': 'Prefer not to say',
      'neurodivergent': 'Prefer not to say',
      'ethnicity': 'Prefer not to say',
      'veteran_status': 'Prefer not to say',
      'transgender': 'Prefer not to say'
    };

    return demographicDefaults[fieldKey] || 'Prefer not to say';
  }

  /**
   * Get default work authorization value
   */
  private getDefaultWorkAuthorizationValue(fieldKey: string, profile: UserProfile): string {
    // Try to use profile work authorization first
    const workAuth = profile.preferences.jobPreferences.workAuthorization;
    if (workAuth) {
      const authMap: Record<string, string> = {
        'citizen': 'Yes, I am a citizen',
        'permanent_resident': 'Yes, I am a permanent resident',
        'visa_holder': 'Yes, I have work authorization',
        'requires_sponsorship': 'No, I require sponsorship'
      };
      
      if (authMap[workAuth]) {
        return authMap[workAuth];
      }
    }

    // Default responses based on field type
    const workAuthDefaults: Record<string, string> = {
      'work_authorization': 'Yes, I am authorized to work',
      'visa_sponsorship': 'No, I do not require sponsorship',
      'sponsorship_required': 'No',
      'us_person': 'Please contact me to discuss',
      'right_to_work': 'Yes, I have the right to work'
    };

    return workAuthDefaults[fieldKey] || 'Please contact me to discuss';
  }

  /**
   * Get default value for common application fields
   */
  private getDefaultCommonFieldValue(fieldKey: string, profile: UserProfile): string {
    const commonDefaults: Record<string, string> = {
      'start_date': 'Available within 2-4 weeks notice',
      'availability': 'Available within 2-4 weeks notice',
      'salary_expectations': 'Competitive and negotiable based on role and responsibilities',
      'salary_range': 'Open to discussion based on the complete compensation package',
      'relocation': 'Open to discussing relocation for the right opportunity',
      'remote_work': 'Comfortable with remote, hybrid, or on-site arrangements',
      'years_experience': `${this.estimateExperience(profile)} years of relevant experience`,
      'relevant_experience': 'My background aligns well with the requirements for this position',
      'why_interested': 'I am excited about this opportunity and believe my skills would be a great fit',
      'motivation': 'I am passionate about contributing to innovative projects and growing my career',
      'cover_letter': 'Please find my resume attached. I look forward to discussing this opportunity further.',
      'references': 'Professional references available upon request'
    };

    return commonDefaults[fieldKey] || 'Please contact me for additional information';
  }

  /**
   * Estimate years of experience from profile
   */
  private estimateExperience(profile: UserProfile): number {
    const workExperience = profile.professionalInfo.workExperience;
    if (!workExperience || workExperience.length === 0) {
      return 2; // Default to 2 years
    }

    // Calculate total experience
    let totalMonths = 0;
    const now = new Date();

    for (const job of workExperience) {
      const startDate = new Date(job.startDate);
      const endDate = job.isCurrent ? now : new Date(job.endDate || now);
      
      const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                    (endDate.getMonth() - startDate.getMonth());
      totalMonths += Math.max(0, months);
    }

    return Math.max(1, Math.round(totalMonths / 12));
  }

  /**
   * Get default date value based on field context
   */
  private getDefaultDateValue(label: string, profile: UserProfile): string {
    if (label.includes('start') || label.includes('available')) {
      // Default to 4 weeks from now
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 28);
      return futureDate.toISOString().split('T')[0];
    }

    // Default to today for other date fields
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get default salary value
   */
  private getDefaultSalaryValue(profile: UserProfile): string {
    const jobPrefs = profile.preferences.jobPreferences;
    
    if (jobPrefs.desiredSalaryMin && jobPrefs.desiredSalaryMax) {
      return `$${jobPrefs.desiredSalaryMin.toLocaleString()} - $${jobPrefs.desiredSalaryMax.toLocaleString()}`;
    } else if (jobPrefs.desiredSalaryMin) {
      return `$${jobPrefs.desiredSalaryMin.toLocaleString()}+`;
    }

    return 'Competitive and negotiable based on role and market rates';
  }

  /**
   * Get default text value for long text fields
   */
  private getDefaultTextValue(label: string, profile: UserProfile): string {
    if (label.includes('cover') || label.includes('letter')) {
      return profile.professionalInfo.summary || 
             'I am excited to apply for this position and believe my experience would be valuable to your team.';
    }

    if (label.includes('why') || label.includes('interest')) {
      return 'I am interested in this role because it aligns with my career goals and offers opportunities for growth.';
    }

    if (label.includes('summary') || label.includes('about')) {
      return profile.professionalInfo.summary || 
             'Experienced professional with a strong background in software development and a passion for innovation.';
    }

    return 'Please contact me for additional details.';
  }

  /**
   * Get default boolean value
   */
  private getDefaultBooleanValue(label: string, profile: UserProfile): string {
    if (label.includes('relocat')) {
      return profile.preferences.jobPreferences.willingToRelocate ? 'Yes' : 'No';
    }

    if (label.includes('remote')) {
      const workType = profile.preferences.jobPreferences.preferredWorkType;
      return workType === 'remote' || workType === 'flexible' ? 'Yes' : 'Open to discussion';
    }

    if (label.includes('sponsor') || label.includes('visa')) {
      // Check if the question is asking if they REQUIRE sponsorship
      if (label.includes('require') || label.includes('need')) {
        return profile.preferences.jobPreferences.requiresSponsorship ? 'Yes' : 'No';
      }
      // If asking if they have authorization (opposite question)
      return profile.preferences.jobPreferences.requiresSponsorship ? 'No' : 'Yes';
    }
    
    if (label.includes('travel') && label.includes('office')) {
      // For office travel questions, check relocation willingness as a proxy
      return profile.preferences.jobPreferences.willingToRelocate ? 'Yes' : 'No';
    }

    return 'Yes';
  }

  // Field type detection helpers
  private isDemographicField(label: string): boolean {
    const demographicKeywords = [
      'gender', 'pronouns', 'ethnicity', 'race', 'disability', 'veteran', 
      'neurodivergent', 'transgender', 'sexual', 'orientation', 'privacy'
    ];
    return demographicKeywords.some(keyword => label.includes(keyword));
  }

  private isWorkAuthorizationField(label: string): boolean {
    const workAuthKeywords = [
      'work authorization', 'visa', 'sponsor', 'eligible to work', 
      'authorized to work', 'right to work', 'us person'
    ];
    return workAuthKeywords.some(keyword => label.includes(keyword));
  }

  private isDateField(label: string): boolean {
    const dateKeywords = ['date', 'start', 'available', 'begin', 'when'];
    return dateKeywords.some(keyword => label.includes(keyword));
  }

  private isSalaryField(label: string): boolean {
    const salaryKeywords = ['salary', 'compensation', 'pay', 'wage', 'rate', 'expected'];
    return salaryKeywords.some(keyword => label.includes(keyword));
  }

  private isLongTextField(label: string): boolean {
    const textKeywords = ['cover', 'letter', 'why', 'summary', 'about', 'describe', 'explain'];
    return textKeywords.some(keyword => label.includes(keyword));
  }

  private isBooleanField(label: string): boolean {
    const booleanKeywords = ['willing', 'able', 'can you', 'do you', 'are you', 'have you'];
    return booleanKeywords.some(keyword => label.includes(keyword));
  }

  private isTextualField(type: FieldType): boolean {
    return ['text', 'textarea', 'email', 'phone', 'url'].includes(type);
  }

  private isExperienceField(label: string): boolean {
    const experienceKeywords = ['experience', 'years', 'background', 'relevant'];
    return experienceKeywords.some(keyword => label.includes(keyword));
  }

  /**
   * Get default experience value
   */
  private getDefaultExperienceValue(profile: UserProfile): string {
    const years = this.estimateExperience(profile);
    return `${years} years of relevant experience`;
  }
}