/**
 * Intelligent Field Mapper
 * Uses AI analysis and user preferences to create smart field mappings
 */

import type { UserProfile, AIPreferences } from '../types/profile.js';
import type { FormInstruction } from '../types/ai.js';
import { AIProfileFormatter, type FieldMappingConfig } from './ai-profile-formatter.js';
import { AIPreferencesManager } from './ai-preferences-manager.js';

// Field analysis result
export interface FieldAnalysisResult {
  fieldName: string;
  fieldType: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'file';
  selector: string;
  suggestedMapping?: string;
  confidence: number;
  reasoning: string;
  isExcluded: boolean;
  priority: number;
}

// Mapping suggestion with context
export interface MappingSuggestion {
  fieldName: string;
  selector: string;
  profilePath: string;
  value: any;
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    profilePath: string;
    value: any;
    confidence: number;
  }>;
}

// Field mapping context
export interface FieldMappingContext {
  url: string;
  pageTitle: string;
  formContext?: {
    company?: string;
    role?: string;
    industry?: string;
  };
  userPreferences: AIPreferences;
  previousMappings?: Record<string, string>;
}

/**
 * Intelligent Field Mapper class
 */
export class IntelligentFieldMapper {
  private static readonly FIELD_TYPE_PATTERNS = {
    email: [
      /email/i, /e-mail/i, /mail/i, /@/
    ],
    phone: [
      /phone/i, /tel/i, /mobile/i, /cell/i, /number/i
    ],
    name: [
      /name/i, /first.*name/i, /last.*name/i, /full.*name/i
    ],
    address: [
      /address/i, /street/i, /city/i, /state/i, /zip/i, /postal/i, /country/i
    ],
    experience: [
      /experience/i, /years/i, /work/i, /employment/i, /job/i, /career/i
    ],
    education: [
      /education/i, /school/i, /university/i, /college/i, /degree/i, /gpa/i
    ],
    skills: [
      /skill/i, /competenc/i, /expertise/i, /proficienc/i, /technical/i
    ],
    salary: [
      /salary/i, /compensation/i, /pay/i, /wage/i, /income/i, /expected/i
    ],
    date: [
      /date/i, /start/i, /end/i, /available/i, /begin/i
    ],
    file: [
      /resume/i, /cv/i, /upload/i, /attach/i, /document/i, /file/i
    ],
    visa: [
      /visa/i, /sponsor/i, /authorization/i, /work.*permit/i, /immigration/i
    ],
    relocation: [
      /relocat/i, /move/i, /willing.*to.*move/i, /travel/i
    ],
    remote: [
      /remote/i, /work.*from.*home/i, /distributed/i, /location/i
    ],
  };

  private static readonly SENSITIVE_PATTERNS = [
    /ssn/i, /social.*security/i, /tax.*id/i, /passport/i,
    /driver.*license/i, /credit.*card/i, /bank.*account/i,
    /password/i, /pin/i, /security.*question/i, /mother.*maiden/i
  ];

  /**
   * Analyze form fields and create intelligent mappings
   */
  static analyzeFormFields(
    formFields: Array<{ name: string; type: string; selector: string; placeholder?: string; label?: string }>,
    userProfile: UserProfile,
    context: FieldMappingContext
  ): FieldAnalysisResult[] {
    const results: FieldAnalysisResult[] = [];
    
    for (const field of formFields) {
      const analysis = this.analyzeField(field, userProfile, context);
      results.push(analysis);
    }

    // Sort by priority (higher priority first)
    return results.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Generate mapping suggestions based on field analysis
   */
  static generateMappingSuggestions(
    fieldAnalysis: FieldAnalysisResult[],
    userProfile: UserProfile,
    context: FieldMappingContext
  ): MappingSuggestion[] {
    const suggestions: MappingSuggestion[] = [];
    const formattedProfile = AIProfileFormatter.formatProfileForAI(userProfile, context.formContext);
    
    for (const field of fieldAnalysis) {
      if (field.isExcluded || !field.suggestedMapping) {
        continue;
      }

      const suggestion = this.createMappingSuggestion(field, formattedProfile, userProfile, context);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Create form instructions from mapping suggestions
   */
  static createFormInstructions(
    suggestions: MappingSuggestion[],
    userProfile: UserProfile,
    context: FieldMappingContext
  ): FormInstruction[] {
    const instructions: FormInstruction[] = [];
    const preferences = userProfile.preferences.aiPreferences || AIPreferencesManager.getDefaultPreferences();
    
    // Filter suggestions by confidence threshold
    const filteredSuggestions = suggestions.filter(
      suggestion => suggestion.confidence >= preferences.confidenceThreshold
    );

    // Limit number of instructions
    const limitedSuggestions = filteredSuggestions.slice(0, preferences.maxInstructionsPerForm);

    for (const suggestion of limitedSuggestions) {
      const instruction = this.createInstruction(suggestion, context);
      if (instruction) {
        instructions.push(instruction);
      }
    }

    return instructions;
  }

  /**
   * Learn from user corrections to improve future mappings
   */
  static learnFromCorrection(
    originalInstruction: FormInstruction,
    userCorrection: string,
    userProfile: UserProfile,
    context: FieldMappingContext
  ): UserProfile {
    // Extract field name from selector
    const fieldName = this.extractFieldNameFromSelector(originalInstruction.selector);
    
    if (fieldName) {
      // Add or update field mapping preference
      userProfile = AIPreferencesManager.addFieldMapping(
        userProfile,
        fieldName,
        `custom:${userCorrection}`
      );

      // Record learning event
      userProfile = AIPreferencesManager.recordLearningEvent(userProfile, {
        type: 'correction',
        instruction: originalInstruction,
        actualValue: userCorrection,
        userCorrection,
        timestamp: new Date(),
        url: context.url,
        formContext: context.formContext,
      });
    }

    return userProfile;
  }

  /**
   * Update field mapping preferences based on successful fills
   */
  static learnFromSuccess(
    instruction: FormInstruction,
    userProfile: UserProfile,
    context: FieldMappingContext
  ): UserProfile {
    return AIPreferencesManager.recordLearningEvent(userProfile, {
      type: 'success',
      instruction,
      timestamp: new Date(),
      url: context.url,
      formContext: context.formContext,
    });
  }

  /**
   * Private helper methods
   */
  private static analyzeField(
    field: { name: string; type: string; selector: string; placeholder?: string; label?: string },
    userProfile: UserProfile,
    context: FieldMappingContext
  ): FieldAnalysisResult {
    const fieldText = `${field.name} ${field.placeholder || ''} ${field.label || ''}`.toLowerCase();
    
    // Check if field is excluded
    const isExcluded = this.isFieldExcluded(fieldText, field.selector, context.userPreferences);
    
    // Determine field type
    const fieldType = this.determineFieldType(field, fieldText);
    
    // Find suggested mapping
    const suggestedMapping = isExcluded ? undefined : this.findSuggestedMapping(
      field.name,
      fieldText,
      fieldType,
      userProfile,
      context
    );
    
    // Calculate confidence
    const confidence = this.calculateMappingConfidence(
      field.name,
      fieldText,
      fieldType,
      suggestedMapping,
      context
    );
    
    // Determine priority
    const priority = this.calculateFieldPriority(fieldType, field.name, fieldText, context);
    
    // Generate reasoning
    const reasoning = this.generateReasoning(fieldType, suggestedMapping, confidence, isExcluded);

    return {
      fieldName: field.name,
      fieldType,
      selector: field.selector,
      suggestedMapping,
      confidence,
      reasoning,
      isExcluded,
      priority,
    };
  }

  private static isFieldExcluded(
    fieldText: string,
    selector: string,
    preferences: AIPreferences
  ): boolean {
    // Check sensitive patterns first
    if (this.SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldText) || pattern.test(selector))) {
      return true;
    }

    // Check user-defined exclusions
    return preferences.excludedFields.some(pattern => {
      const patternLower = pattern.toLowerCase();
      return fieldText.includes(patternLower) || selector.toLowerCase().includes(patternLower);
    });
  }

  private static determineFieldType(
    field: { type: string },
    fieldText: string
  ): FieldAnalysisResult['fieldType'] {
    // Use HTML input type first
    switch (field.type.toLowerCase()) {
      case 'email':
        return 'email';
      case 'tel':
      case 'phone':
        return 'tel';
      case 'file':
        return 'file';
      case 'checkbox':
        return 'checkbox';
      case 'radio':
        return 'radio';
      case 'select':
      case 'select-one':
      case 'select-multiple':
        return 'select';
      case 'textarea':
        return 'textarea';
      default:
        // Analyze field text for type hints
        for (const [type, patterns] of Object.entries(this.FIELD_TYPE_PATTERNS)) {
          if (patterns.some(pattern => pattern.test(fieldText))) {
            switch (type) {
              case 'email':
                return 'email';
              case 'phone':
                return 'tel';
              case 'file':
                return 'file';
              default:
                return 'text';
            }
          }
        }
        return 'text';
    }
  }

  private static findSuggestedMapping(
    fieldName: string,
    fieldText: string,
    fieldType: FieldAnalysisResult['fieldType'],
    userProfile: UserProfile,
    context: FieldMappingContext
  ): string | undefined {
    const config = AIProfileFormatter.getFieldMappingConfig(userProfile, context.formContext);
    
    // Check custom mappings first
    const normalizedFieldName = this.normalizeFieldName(fieldName);
    if (config.commonMappings[normalizedFieldName]) {
      return config.commonMappings[normalizedFieldName];
    }

    // Check contextual mappings
    const contextKey = this.getContextKey(context.formContext);
    if (contextKey && config.contextualMappings[contextKey]?.[normalizedFieldName]) {
      return config.contextualMappings[contextKey][normalizedFieldName];
    }

    // Use pattern matching based on field type
    return this.findPatternBasedMapping(fieldText, fieldType, userProfile);
  }

  private static findPatternBasedMapping(
    fieldText: string,
    fieldType: FieldAnalysisResult['fieldType'],
    userProfile: UserProfile
  ): string | undefined {
    // Email fields
    if (fieldType === 'email' || this.FIELD_TYPE_PATTERNS.email.some(p => p.test(fieldText))) {
      return 'personal.email';
    }

    // Phone fields
    if (fieldType === 'tel' || this.FIELD_TYPE_PATTERNS.phone.some(p => p.test(fieldText))) {
      return 'personal.phone';
    }

    // Name fields
    if (this.FIELD_TYPE_PATTERNS.name.some(p => p.test(fieldText))) {
      if (/first.*name/i.test(fieldText) || fieldText.includes('firstname')) return 'personal.firstName';
      if (/last.*name/i.test(fieldText) || fieldText.includes('lastname')) return 'personal.lastName';
      if (/full.*name/i.test(fieldText) || fieldText.includes('fullname')) return 'personal.name';
      return 'personal.name';
    }

    // Address fields
    if (this.FIELD_TYPE_PATTERNS.address.some(p => p.test(fieldText))) {
      if (/street/i.test(fieldText)) return 'personal.address.street';
      if (/city/i.test(fieldText)) return 'personal.address.city';
      if (/state/i.test(fieldText)) return 'personal.address.state';
      if (/zip|postal/i.test(fieldText)) return 'personal.address.zipCode';
      if (/country/i.test(fieldText)) return 'personal.address.country';
      return 'personal.location';
    }

    // Experience fields
    if (this.FIELD_TYPE_PATTERNS.experience.some(p => p.test(fieldText))) {
      if (/years/i.test(fieldText)) return 'professional.experience.length';
      if (/current.*title|position/i.test(fieldText)) return 'professional.currentTitle';
      return 'professional.experience[0].position';
    }

    // Education fields
    if (this.FIELD_TYPE_PATTERNS.education.some(p => p.test(fieldText))) {
      if (/degree/i.test(fieldText)) return 'professional.education[0].degree';
      if (/school|university|college/i.test(fieldText)) return 'professional.education[0].institution';
      if (/gpa/i.test(fieldText)) return 'professional.education[0].gpa';
      return 'professional.education[0].field';
    }

    // Skills fields
    if (this.FIELD_TYPE_PATTERNS.skills.some(p => p.test(fieldText))) {
      return 'professional.skills';
    }

    // Salary fields
    if (this.FIELD_TYPE_PATTERNS.salary.some(p => p.test(fieldText))) {
      return 'preferences.jobPreferences.desiredSalary';
    }

    // Date fields
    if (this.FIELD_TYPE_PATTERNS.date.some(p => p.test(fieldText))) {
      if (/start|available|begin/i.test(fieldText)) return 'preferences.jobPreferences.availableStartDate';
      return 'custom.date';
    }

    // File fields
    if (fieldType === 'file' || this.FIELD_TYPE_PATTERNS.file.some(p => p.test(fieldText))) {
      if (/resume|cv/i.test(fieldText)) return 'documents.resumes[0]';
      return 'documents.files';
    }

    // Visa sponsorship fields
    if (this.FIELD_TYPE_PATTERNS.visa.some(p => p.test(fieldText))) {
      return 'preferences.jobPreferences.requiresSponsorship';
    }

    // Relocation fields
    if (this.FIELD_TYPE_PATTERNS.relocation.some(p => p.test(fieldText))) {
      return 'preferences.jobPreferences.willingToRelocate';
    }

    // Remote work fields
    if (this.FIELD_TYPE_PATTERNS.remote.some(p => p.test(fieldText))) {
      return 'preferences.jobPreferences.preferredWorkType';
    }

    return undefined;
  }

  private static calculateMappingConfidence(
    fieldName: string,
    fieldText: string,
    fieldType: FieldAnalysisResult['fieldType'],
    suggestedMapping: string | undefined,
    context: FieldMappingContext
  ): number {
    if (!suggestedMapping) return 0;

    let confidence = 50; // Base confidence

    // Boost confidence for exact field type matches
    if (fieldType === 'email' && suggestedMapping.includes('email')) confidence += 30;
    if (fieldType === 'tel' && suggestedMapping.includes('phone')) confidence += 30;
    if (fieldType === 'file' && suggestedMapping.includes('documents')) confidence += 25;

    // Boost confidence for strong text matches
    const strongMatches = [
      { pattern: /first.*name/i, mapping: 'firstName', boost: 25 },
      { pattern: /last.*name/i, mapping: 'lastName', boost: 25 },
      { pattern: /email/i, mapping: 'email', boost: 25 },
      { pattern: /phone/i, mapping: 'phone', boost: 25 },
    ];

    for (const match of strongMatches) {
      if (match.pattern.test(fieldText) && suggestedMapping.includes(match.mapping)) {
        confidence += match.boost;
      }
    }

    // Reduce confidence for ambiguous fields
    if (fieldText.includes('other') || fieldText.includes('additional')) {
      confidence -= 20;
    }

    // Boost confidence if we have previous successful mappings
    if (context.previousMappings?.[fieldName] === suggestedMapping) {
      confidence += 15;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  private static calculateFieldPriority(
    fieldType: FieldAnalysisResult['fieldType'],
    fieldName: string,
    fieldText: string,
    context: FieldMappingContext
  ): number {
    let priority = 5; // Base priority

    // High priority for essential fields
    if (fieldType === 'email' || fieldText.includes('email')) priority = 10;
    if (fieldText.includes('name')) priority = 9;
    if (fieldType === 'tel' || fieldText.includes('phone')) priority = 8;

    // Medium priority for professional fields
    if (fieldText.includes('experience') || fieldText.includes('skill')) priority = 7;
    if (fieldText.includes('education') || fieldText.includes('degree')) priority = 6;

    // Lower priority for optional fields
    if (fieldText.includes('optional') || fieldText.includes('additional')) priority = 3;
    if (fieldText.includes('marketing') || fieldText.includes('newsletter')) priority = 2;

    // Boost priority for required fields
    if (fieldText.includes('required') || fieldText.includes('*')) priority += 2;

    return Math.max(1, Math.min(10, priority));
  }

  private static generateReasoning(
    fieldType: FieldAnalysisResult['fieldType'],
    suggestedMapping: string | undefined,
    confidence: number,
    isExcluded: boolean
  ): string {
    if (isExcluded) {
      return 'Field excluded due to sensitive content or user preferences';
    }

    if (!suggestedMapping) {
      return 'No suitable mapping found in user profile';
    }

    const reasons: string[] = [];

    if (confidence >= 80) {
      reasons.push('Strong match between field and profile data');
    } else if (confidence >= 60) {
      reasons.push('Good match with some uncertainty');
    } else {
      reasons.push('Weak match, may need manual review');
    }

    if (fieldType === 'email' && suggestedMapping.includes('email')) {
      reasons.push('Email field type matches profile email');
    }

    if (fieldType === 'tel' && suggestedMapping.includes('phone')) {
      reasons.push('Phone field type matches profile phone');
    }

    return reasons.join('; ');
  }

  private static createMappingSuggestion(
    field: FieldAnalysisResult,
    formattedProfile: any,
    userProfile: UserProfile,
    context: FieldMappingContext
  ): MappingSuggestion | null {
    if (!field.suggestedMapping) return null;

    const value = this.extractValueFromProfile(field.suggestedMapping, formattedProfile, userProfile);
    if (value === undefined || value === null || value === '') return null;

    // Generate alternatives
    const alternatives = this.generateAlternatives(field, formattedProfile, userProfile);

    return {
      fieldName: field.fieldName,
      selector: field.selector,
      profilePath: field.suggestedMapping,
      value,
      confidence: field.confidence,
      reasoning: field.reasoning,
      alternatives,
    };
  }

  private static extractValueFromProfile(
    profilePath: string,
    formattedProfile: any,
    userProfile: UserProfile
  ): any {
    // Handle special cases first
    if (profilePath === 'personal.firstName') {
      return formattedProfile.personal?.name?.split(' ')[0] || userProfile.personalInfo?.firstName;
    }
    if (profilePath === 'personal.lastName') {
      return formattedProfile.personal?.name?.split(' ')[1] || userProfile.personalInfo?.lastName;
    }

    const pathParts = profilePath.split('.');
    let current = formattedProfile;

    for (const part of pathParts) {
      if (part.includes('[') && part.includes(']')) {
        // Handle array access like "experience[0]"
        const [arrayName, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        current = current?.[arrayName]?.[index];
      } else {
        current = current?.[part];
      }

      if (current === undefined) break;
    }

    return current;
  }

  private static generateAlternatives(
    field: FieldAnalysisResult,
    formattedProfile: any,
    userProfile: UserProfile
  ): Array<{ profilePath: string; value: any; confidence: number }> {
    const alternatives: Array<{ profilePath: string; value: any; confidence: number }> = [];

    // For name fields, provide alternatives
    if (field.fieldName.toLowerCase().includes('name')) {
      if (field.suggestedMapping !== 'personal.name') {
        const fullName = formattedProfile.personal?.name;
        if (fullName) {
          alternatives.push({
            profilePath: 'personal.name',
            value: fullName,
            confidence: 85,
          });
        }
      }

      if (field.suggestedMapping !== 'personal.firstName') {
        const firstName = formattedProfile.personal?.name?.split(' ')[0];
        if (firstName) {
          alternatives.push({
            profilePath: 'personal.firstName',
            value: firstName,
            confidence: 80,
          });
        }
      }
    }

    // For experience fields, provide multiple experience entries
    if (field.fieldName.toLowerCase().includes('experience')) {
      const experiences = formattedProfile.professional?.experience || [];
      for (let i = 0; i < Math.min(3, experiences.length); i++) {
        if (experiences[i]) {
          alternatives.push({
            profilePath: `professional.experience[${i}].position`,
            value: experiences[i].position,
            confidence: 75 - (i * 10),
          });
        }
      }
    }

    return alternatives.slice(0, 3); // Limit to top 3 alternatives
  }

  private static createInstruction(
    suggestion: MappingSuggestion,
    context: FieldMappingContext
  ): FormInstruction | null {
    if (suggestion.value === undefined || suggestion.value === null) return null;

    // Determine action based on field type and value
    let action: FormInstruction['action'] = 'fill';
    let value = suggestion.value;

    // Handle boolean values for radio buttons and checkboxes
    if (typeof value === 'boolean') {
      action = 'click';
      
      // For radio buttons, we need to select the appropriate option
      if (suggestion.selector.includes('radio') || suggestion.selector.includes('boolean')) {
        // Modify selector to target the correct radio button
        const baseSelector = suggestion.selector.replace(/\[value="[^"]*"\]/, '');
        const targetValue = value ? 'true' : 'false';
        value = targetValue;
        
        // Update selector to target the specific radio button
        if (baseSelector.includes('name=')) {
          const updatedSelector = `${baseSelector}[value="${targetValue}"]`;
          suggestion.selector = updatedSelector;
        }
      }
    }

    // Handle different value types
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        value = value.join(', ');
      } else {
        value = JSON.stringify(value);
      }
    }

    // Convert confidence to 0-100 scale if needed
    const confidence = Math.max(0, Math.min(100, suggestion.confidence));

    return {
      action,
      selector: suggestion.selector,
      value: value.toString(),
      options: [],
      reasoning: suggestion.reasoning,
      confidence,
      priority: this.calculateInstructionPriority(suggestion, context),
    };
  }

  private static calculateInstructionPriority(
    suggestion: MappingSuggestion,
    context: FieldMappingContext
  ): number {
    let priority = 5;

    // High priority for essential fields
    if (suggestion.profilePath.includes('email')) priority = 10;
    if (suggestion.profilePath.includes('name')) priority = 9;
    if (suggestion.profilePath.includes('phone')) priority = 8;

    // Adjust based on confidence
    if (suggestion.confidence >= 90) priority += 2;
    else if (suggestion.confidence >= 70) priority += 1;
    else if (suggestion.confidence < 50) priority -= 2;

    return Math.max(1, Math.min(10, priority));
  }

  private static extractFieldNameFromSelector(selector: string): string | null {
    // Try to extract field name from various selector patterns
    const patterns = [
      /name=["']([^"']+)["']/,
      /id=["']([^"']+)["']/,
      /#([a-zA-Z][\w-]*)/,
      /\.([a-zA-Z][\w-]*)/,
      /\[name=["']([^"']+)["']\]/,
    ];

    for (const pattern of patterns) {
      const match = selector.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private static normalizeFieldName(fieldName: string): string {
    return fieldName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private static getContextKey(
    formContext?: { company?: string; role?: string; industry?: string }
  ): string | null {
    if (!formContext) return null;

    const industry = formContext.industry?.toLowerCase();
    const role = formContext.role?.toLowerCase();

    if (industry?.includes('tech') || role?.includes('engineer') || role?.includes('developer')) {
      return 'tech_company';
    }
    if (industry?.includes('finance') || industry?.includes('bank')) {
      return 'finance_company';
    }
    if (industry?.includes('startup') || formContext.company?.toLowerCase().includes('startup')) {
      return 'startup';
    }

    return null;
  }
}