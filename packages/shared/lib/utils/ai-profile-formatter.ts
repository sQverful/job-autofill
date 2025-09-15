/**
 * Profile data formatter for AI API requests
 * Formats user profile data for optimal AI analysis and instruction generation
 */

import type { UserProfile, AIPreferences } from '../types/profile.js';
import type { WorkExperience, Education, Certification } from '../types/profile.js';

// Formatted profile data optimized for AI consumption
export interface AIFormattedProfile {
  personal: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedIn?: string;
    portfolio?: string;
    github?: string;
  };
  professional: {
    currentTitle?: string;
    summary?: string;
    experience: AIFormattedExperience[];
    education: AIFormattedEducation[];
    skills: string[];
    certifications: AIFormattedCertification[];
  };
  preferences: {
    tone: string;
    customInstructions?: string;
    excludedFields: string[];
    fieldMappings: Record<string, string>;
    jobPreferences: {
      desiredSalary?: string;
      workAuthorization: string;
      willingToRelocate: boolean;
      availableStartDate?: string;
      preferredWorkType: string;
      requiresSponsorship: boolean;
    };
  };
  context: {
    profileCompleteness: number;
    lastUpdated: string;
    aiLearningEnabled: boolean;
  };
}

export interface AIFormattedExperience {
  company: string;
  position: string;
  duration: string;
  location: string;
  description: string;
  isCurrent: boolean;
  relevanceScore?: number;
}

export interface AIFormattedEducation {
  institution: string;
  degree: string;
  field: string;
  duration: string;
  gpa?: number;
  honors?: string;
  relevanceScore?: number;
}

export interface AIFormattedCertification {
  name: string;
  issuer: string;
  date: string;
  isActive: boolean;
  relevanceScore?: number;
}

// Field mapping configuration for intelligent form filling
export interface FieldMappingConfig {
  commonMappings: Record<string, string>;
  contextualMappings: Record<string, Record<string, string>>;
  excludePatterns: string[];
  priorityFields: string[];
}

/**
 * AI Profile Formatter class
 */
export class AIProfileFormatter {
  private static readonly DEFAULT_FIELD_MAPPINGS: Record<string, string> = {
    // Personal information mappings
    'first_name': 'personalInfo.firstName',
    'last_name': 'personalInfo.lastName',
    'full_name': 'personalInfo.firstName + personalInfo.lastName',
    'email': 'personalInfo.email',
    'phone': 'personalInfo.phone',
    'address': 'personalInfo.address.street',
    'city': 'personalInfo.address.city',
    'state': 'personalInfo.address.state',
    'zip': 'personalInfo.address.zipCode',
    'country': 'personalInfo.address.country',
    'linkedin': 'personalInfo.linkedInUrl',
    'portfolio': 'personalInfo.portfolioUrl',
    'github': 'personalInfo.githubUrl',
    
    // Professional information mappings
    'current_title': 'workInfo.currentTitle',
    'summary': 'professionalInfo.summary',
    'experience_years': 'workInfo.experience',
    'skills': 'professionalInfo.skills',
    
    // Job preferences mappings
    'desired_salary': 'preferences.jobPreferences.desiredSalaryMin',
    'work_authorization': 'preferences.jobPreferences.workAuthorization',
    'willing_to_relocate': 'preferences.jobPreferences.willingToRelocate',
    'start_date': 'preferences.jobPreferences.availableStartDate',
    'work_type': 'preferences.jobPreferences.preferredWorkType',
    'requires_sponsorship': 'preferences.jobPreferences.requiresSponsorship',
  };

  private static readonly CONTEXTUAL_MAPPINGS: Record<string, Record<string, string>> = {
    'tech_company': {
      'github_url': 'personalInfo.githubUrl',
      'technical_skills': 'professionalInfo.skills',
      'coding_experience': 'workInfo.experience',
    },
    'finance_company': {
      'certifications': 'professionalInfo.certifications',
      'education': 'professionalInfo.education',
      'analytical_skills': 'professionalInfo.skills',
    },
    'startup': {
      'portfolio': 'personalInfo.portfolioUrl',
      'entrepreneurial_experience': 'workInfo.experience',
      'adaptability': 'professionalInfo.summary',
    },
  };

  /**
   * Format user profile for AI API requests
   */
  static formatProfileForAI(
    userProfile: UserProfile,
    jobContext?: { company?: string; role?: string; industry?: string }
  ): AIFormattedProfile {
    const aiPreferences = userProfile.preferences.aiPreferences || this.getDefaultAIPreferences();
    
    return {
      personal: this.formatPersonalInfo(userProfile),
      professional: this.formatProfessionalInfo(userProfile, jobContext),
      preferences: this.formatPreferences(userProfile, aiPreferences),
      context: this.formatContext(userProfile, aiPreferences),
    };
  }

  /**
   * Format personal information
   */
  private static formatPersonalInfo(userProfile: UserProfile) {
    const { personalInfo } = userProfile;
    const { address } = personalInfo;
    
    return {
      name: `${personalInfo.firstName} ${personalInfo.lastName}`.trim(),
      email: personalInfo.email,
      phone: personalInfo.phone,
      location: address ? `${address.city}, ${address.state}` : '',
      linkedIn: personalInfo.linkedInUrl,
      portfolio: personalInfo.portfolioUrl,
      github: personalInfo.githubUrl,
    };
  }

  /**
   * Format professional information with relevance scoring
   */
  private static formatProfessionalInfo(
    userProfile: UserProfile,
    jobContext?: { company?: string; role?: string; industry?: string }
  ) {
    const { professionalInfo, workInfo } = userProfile;
    
    return {
      currentTitle: workInfo?.currentTitle,
      summary: professionalInfo.summary || workInfo?.summary,
      experience: this.formatExperience(professionalInfo.workExperience, jobContext),
      education: this.formatEducation(professionalInfo.education, jobContext),
      skills: this.prioritizeSkills(professionalInfo.skills, jobContext),
      certifications: this.formatCertifications(professionalInfo.certifications, jobContext),
    };
  }

  /**
   * Format work experience with relevance scoring
   */
  private static formatExperience(
    experiences: WorkExperience[],
    jobContext?: { company?: string; role?: string; industry?: string }
  ): AIFormattedExperience[] {
    return experiences
      .map(exp => ({
        company: exp.company,
        position: exp.position,
        duration: this.formatDateRange(exp.startDate, exp.endDate, exp.isCurrent),
        location: exp.location,
        description: exp.description,
        isCurrent: exp.isCurrent,
        relevanceScore: this.calculateExperienceRelevance(exp, jobContext),
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 5); // Limit to top 5 most relevant experiences
  }

  /**
   * Format education with relevance scoring
   */
  private static formatEducation(
    education: Education[],
    jobContext?: { company?: string; role?: string; industry?: string }
  ): AIFormattedEducation[] {
    return education
      .map(edu => ({
        institution: edu.institution,
        degree: edu.degree,
        field: edu.fieldOfStudy,
        duration: this.formatDateRange(edu.startDate, edu.endDate),
        gpa: edu.gpa,
        honors: edu.honors,
        relevanceScore: this.calculateEducationRelevance(edu, jobContext),
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 3); // Limit to top 3 most relevant education entries
  }

  /**
   * Format certifications with relevance scoring
   */
  private static formatCertifications(
    certifications: Certification[],
    jobContext?: { company?: string; role?: string; industry?: string }
  ): AIFormattedCertification[] {
    return certifications
      .map(cert => ({
        name: cert.name,
        issuer: cert.issuer,
        date: cert.issueDate.toISOString().split('T')[0],
        isActive: !cert.expirationDate || cert.expirationDate > new Date(),
        relevanceScore: this.calculateCertificationRelevance(cert, jobContext),
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, 10); // Limit to top 10 most relevant certifications
  }

  /**
   * Prioritize skills based on job context
   */
  private static prioritizeSkills(
    skills: string[],
    jobContext?: { company?: string; role?: string; industry?: string }
  ): string[] {
    if (!jobContext) return skills.slice(0, 15);
    
    // Simple keyword matching for skill prioritization
    const roleKeywords = jobContext.role?.toLowerCase().split(/\s+/) || [];
    const industryKeywords = jobContext.industry?.toLowerCase().split(/\s+/) || [];
    
    const prioritizedSkills = skills
      .map(skill => ({
        skill,
        relevance: this.calculateSkillRelevance(skill, roleKeywords, industryKeywords),
      }))
      .sort((a, b) => b.relevance - a.relevance)
      .map(item => item.skill)
      .slice(0, 15);
    
    return prioritizedSkills;
  }

  /**
   * Format preferences for AI consumption
   */
  private static formatPreferences(userProfile: UserProfile, aiPreferences: AIPreferences) {
    const { jobPreferences } = userProfile.preferences;
    
    return {
      tone: aiPreferences.preferredTone,
      customInstructions: aiPreferences.customInstructions,
      excludedFields: aiPreferences.excludedFields,
      fieldMappings: {
        ...this.DEFAULT_FIELD_MAPPINGS,
        ...aiPreferences.fieldMappingPreferences,
      },
      jobPreferences: {
        desiredSalary: userProfile.preferences.desiredSalary,
        workAuthorization: jobPreferences.workAuthorization,
        willingToRelocate: jobPreferences.willingToRelocate,
        availableStartDate: userProfile.preferences.availableStartDate,
        preferredWorkType: jobPreferences.preferredWorkType,
        requiresSponsorship: jobPreferences.requiresSponsorship,
      },
    };
  }

  /**
   * Format context information
   */
  private static formatContext(userProfile: UserProfile, aiPreferences: AIPreferences) {
    return {
      profileCompleteness: this.calculateProfileCompleteness(userProfile),
      lastUpdated: userProfile.metadata.updatedAt.toISOString(),
      aiLearningEnabled: aiPreferences.learningEnabled,
    };
  }

  /**
   * Get field mapping configuration for intelligent form filling
   */
  static getFieldMappingConfig(
    userProfile: UserProfile,
    jobContext?: { company?: string; role?: string; industry?: string }
  ): FieldMappingConfig {
    const aiPreferences = userProfile.preferences.aiPreferences || this.getDefaultAIPreferences();
    const contextKey = this.getContextKey(jobContext);
    
    return {
      commonMappings: {
        ...this.DEFAULT_FIELD_MAPPINGS,
        ...aiPreferences.fieldMappingPreferences,
      },
      contextualMappings: this.CONTEXTUAL_MAPPINGS,
      excludePatterns: aiPreferences.excludedFields,
      priorityFields: this.getPriorityFields(jobContext),
    };
  }

  /**
   * Create intelligent field mapping suggestions
   */
  static createFieldMappingSuggestions(
    formFields: string[],
    userProfile: UserProfile,
    jobContext?: { company?: string; role?: string; industry?: string }
  ): Record<string, string> {
    const config = this.getFieldMappingConfig(userProfile, jobContext);
    const suggestions: Record<string, string> = {};
    
    for (const field of formFields) {
      const normalizedField = this.normalizeFieldName(field);
      
      // Check common mappings first
      if (config.commonMappings[normalizedField]) {
        suggestions[field] = config.commonMappings[normalizedField];
        continue;
      }
      
      // Check contextual mappings
      const contextKey = this.getContextKey(jobContext);
      if (contextKey && config.contextualMappings[contextKey]?.[normalizedField]) {
        suggestions[field] = config.contextualMappings[contextKey][normalizedField];
        continue;
      }
      
      // Use fuzzy matching for similar field names
      const fuzzyMatch = this.findFuzzyMatch(normalizedField, Object.keys(config.commonMappings));
      if (fuzzyMatch) {
        suggestions[field] = config.commonMappings[fuzzyMatch];
      }
    }
    
    return suggestions;
  }

  /**
   * Calculate profile completeness percentage
   */
  private static calculateProfileCompleteness(userProfile: UserProfile): number {
    let totalFields = 0;
    let completedFields = 0;
    
    // Personal info (weight: 30%)
    const personalFields = ['firstName', 'lastName', 'email', 'phone'];
    totalFields += personalFields.length;
    completedFields += personalFields.filter(field => 
      userProfile.personalInfo[field as keyof typeof userProfile.personalInfo]
    ).length;
    
    // Professional info (weight: 50%)
    totalFields += 4; // summary, skills, experience, education
    if (userProfile.professionalInfo.summary) completedFields++;
    if (userProfile.professionalInfo.skills.length > 0) completedFields++;
    if (userProfile.professionalInfo.workExperience.length > 0) completedFields++;
    if (userProfile.professionalInfo.education.length > 0) completedFields++;
    
    // Preferences (weight: 20%)
    totalFields += 2; // job preferences, privacy settings
    if (userProfile.preferences.jobPreferences.workAuthorization) completedFields++;
    if (userProfile.preferences.privacySettings) completedFields++;
    
    return Math.round((completedFields / totalFields) * 100);
  }

  /**
   * Calculate experience relevance score
   */
  private static calculateExperienceRelevance(
    experience: WorkExperience,
    jobContext?: { company?: string; role?: string; industry?: string }
  ): number {
    let score = 0;
    
    // Recency bonus (0-30 points)
    const monthsAgo = this.getMonthsAgo(experience.endDate || new Date());
    score += Math.max(0, 30 - monthsAgo);
    
    // Current position bonus (20 points)
    if (experience.isCurrent) score += 20;
    
    // Role similarity (0-30 points)
    if (jobContext?.role) {
      score += this.calculateTextSimilarity(experience.position, jobContext.role) * 30;
    }
    
    // Company similarity (0-20 points)
    if (jobContext?.company) {
      score += this.calculateTextSimilarity(experience.company, jobContext.company) * 20;
    }
    
    return Math.min(100, score);
  }

  /**
   * Calculate education relevance score
   */
  private static calculateEducationRelevance(
    education: Education,
    jobContext?: { company?: string; role?: string; industry?: string }
  ): number {
    let score = 0;
    
    // Recency bonus (0-20 points)
    const monthsAgo = this.getMonthsAgo(education.endDate || new Date());
    score += Math.max(0, 20 - monthsAgo / 12);
    
    // Field relevance (0-40 points)
    if (jobContext?.role) {
      score += this.calculateTextSimilarity(education.fieldOfStudy, jobContext.role) * 40;
    }
    
    // GPA bonus (0-20 points)
    if (education.gpa && education.gpa >= 3.5) {
      score += (education.gpa - 3.5) * 40; // Max 20 points for 4.0 GPA
    }
    
    // Honors bonus (20 points)
    if (education.honors) score += 20;
    
    return Math.min(100, score);
  }

  /**
   * Calculate certification relevance score
   */
  private static calculateCertificationRelevance(
    certification: Certification,
    jobContext?: { company?: string; role?: string; industry?: string }
  ): number {
    let score = 0;
    
    // Active certification bonus (30 points)
    if (!certification.expirationDate || certification.expirationDate > new Date()) {
      score += 30;
    }
    
    // Recency bonus (0-20 points)
    const monthsAgo = this.getMonthsAgo(certification.issueDate);
    score += Math.max(0, 20 - monthsAgo / 6);
    
    // Name relevance (0-50 points)
    if (jobContext?.role) {
      score += this.calculateTextSimilarity(certification.name, jobContext.role) * 50;
    }
    
    return Math.min(100, score);
  }

  /**
   * Calculate skill relevance score
   */
  private static calculateSkillRelevance(
    skill: string,
    roleKeywords: string[],
    industryKeywords: string[]
  ): number {
    let score = 0;
    const skillLower = skill.toLowerCase();
    
    // Direct keyword matches
    for (const keyword of roleKeywords) {
      if (skillLower.includes(keyword) || keyword.includes(skillLower)) {
        score += 10;
      }
    }
    
    for (const keyword of industryKeywords) {
      if (skillLower.includes(keyword) || keyword.includes(skillLower)) {
        score += 5;
      }
    }
    
    return score;
  }

  /**
   * Helper methods
   */
  private static formatDateRange(startDate: Date, endDate?: Date, isCurrent?: boolean): string {
    const start = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (isCurrent) return `${start} - Present`;
    if (endDate) {
      const end = endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      return `${start} - ${end}`;
    }
    return start;
  }

  private static getMonthsAgo(date: Date): number {
    const now = new Date();
    return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  }

  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          matches++;
          break;
        }
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
  }

  private static normalizeFieldName(fieldName: string): string {
    return fieldName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private static getContextKey(jobContext?: { company?: string; role?: string; industry?: string }): string | null {
    if (!jobContext) return null;
    
    const industry = jobContext.industry?.toLowerCase();
    const role = jobContext.role?.toLowerCase();
    
    if (industry?.includes('tech') || role?.includes('engineer') || role?.includes('developer')) {
      return 'tech_company';
    }
    if (industry?.includes('finance') || industry?.includes('bank')) {
      return 'finance_company';
    }
    if (industry?.includes('startup') || jobContext.company?.toLowerCase().includes('startup')) {
      return 'startup';
    }
    
    return null;
  }

  private static getPriorityFields(jobContext?: { company?: string; role?: string; industry?: string }): string[] {
    const baseFields = ['first_name', 'last_name', 'email', 'phone'];
    
    if (!jobContext) return baseFields;
    
    const contextKey = this.getContextKey(jobContext);
    const contextualFields = this.CONTEXTUAL_MAPPINGS[contextKey || ''];
    
    return [...baseFields, ...Object.keys(contextualFields || {})];
  }

  private static findFuzzyMatch(target: string, candidates: string[]): string | null {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const candidate of candidates) {
      const score = this.calculateTextSimilarity(target, candidate);
      if (score > bestScore && score > 0.6) { // 60% similarity threshold
        bestScore = score;
        bestMatch = candidate;
      }
    }
    
    return bestMatch;
  }

  private static getDefaultAIPreferences(): AIPreferences {
    return {
      preferredTone: 'professional',
      excludedFields: [],
      learningEnabled: true,
      fieldMappingPreferences: {},
      autoApproveInstructions: false,
      maxInstructionsPerForm: 50,
      confidenceThreshold: 70,
    };
  }
}