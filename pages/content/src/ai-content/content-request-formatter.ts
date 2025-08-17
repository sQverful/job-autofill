/**
 * Content Request Formatter
 * 
 * Formats and validates AI content generation requests,
 * ensuring proper structure and context for optimal results.
 */

import type { 
  AIContentRequest, 
  AIContentRequestType,
  ContentGenerationPreferences,
  UserProfile,
  JobContext 
} from '@extension/shared/lib/types';
import type { RequestFormattingOptions, GenerationContext } from './types.js';

export class ContentRequestFormatter {
  private defaultPreferences: ContentGenerationPreferences = {
    tone: 'professional',
    length: 'medium',
    focus: [],
    includePersonalExperience: true,
    includeSkills: true,
    includeEducation: true
  };

  /**
   * Create a formatted AI content request
   */
  createRequest(
    type: AIContentRequestType,
    userProfile: UserProfile,
    jobContext: JobContext,
    options: Partial<RequestFormattingOptions> = {},
    preferences: Partial<ContentGenerationPreferences> = {},
    specificQuestion?: string
  ): AIContentRequest {
    const requestId = this.generateRequestId();
    const context = this.buildGenerationContext(requestId, userProfile.id);
    
    const formattedRequest: AIContentRequest = {
      id: requestId,
      type,
      context: {
        jobDescription: this.formatJobDescription(jobContext, options),
        companyInfo: this.formatCompanyInfo(jobContext),
        userProfile: this.formatUserProfile(userProfile, preferences),
        specificQuestion,
        fieldLabel: options.templateVariables?.fieldLabel,
        existingContent: options.templateVariables?.existingContent
      },
      preferences: {
        ...this.defaultPreferences,
        ...preferences,
        focus: this.determineFocus(type, jobContext, preferences.focus || [])
      },
      metadata: {
        requestedAt: new Date(),
        userId: userProfile.id,
        sessionId: context.sessionId
      }
    };

    return this.validateAndEnhanceRequest(formattedRequest, options);
  }

  /**
   * Format job description with context limits
   */
  private formatJobDescription(
    jobContext: JobContext, 
    options: Partial<RequestFormattingOptions>
  ): string {
    const maxLength = options.maxContextLength || 2000;
    let description = jobContext.jobDescription;

    // Add job title and company for context
    if (jobContext.jobTitle) {
      description = `Position: ${jobContext.jobTitle}\n\n${description}`;
    }

    if (jobContext.companyName) {
      description = `Company: ${jobContext.companyName}\n${description}`;
    }

    // Add requirements if available and space permits
    if (jobContext.requirements.length > 0 && description.length < maxLength * 0.7) {
      const requirementsText = jobContext.requirements.slice(0, 5).join('\n• ');
      description += `\n\nKey Requirements:\n• ${requirementsText}`;
    }

    // Add location and job type if available
    const additionalInfo = [];
    if (jobContext.location) additionalInfo.push(`Location: ${jobContext.location}`);
    if (jobContext.jobType) additionalInfo.push(`Type: ${jobContext.jobType}`);
    if (jobContext.experienceLevel) additionalInfo.push(`Level: ${jobContext.experienceLevel}`);

    if (additionalInfo.length > 0 && description.length < maxLength * 0.8) {
      description += `\n\n${additionalInfo.join(' | ')}`;
    }

    // Truncate if too long
    if (description.length > maxLength) {
      description = description.substring(0, maxLength - 3) + '...';
    }

    return description;
  }

  /**
   * Format company information
   */
  private formatCompanyInfo(jobContext: JobContext): string {
    let companyInfo = jobContext.companyName || '';

    // Add additional context if available
    if (jobContext.location) {
      companyInfo += ` (${jobContext.location})`;
    }

    return companyInfo;
  }

  /**
   * Format user profile based on preferences
   */
  private formatUserProfile(
    userProfile: UserProfile, 
    preferences: Partial<ContentGenerationPreferences>
  ): UserProfile {
    const formatted = { ...userProfile };

    // Filter profile data based on preferences
    if (!preferences.includePersonalExperience) {
      formatted.professionalInfo.workExperience = [];
    }

    if (!preferences.includeSkills) {
      formatted.professionalInfo.skills = [];
    }

    if (!preferences.includeEducation) {
      formatted.professionalInfo.education = [];
    }

    // Limit the amount of data to prevent context overflow
    formatted.professionalInfo.workExperience = formatted.professionalInfo.workExperience.slice(0, 3);
    formatted.professionalInfo.education = formatted.professionalInfo.education.slice(0, 2);
    formatted.professionalInfo.skills = formatted.professionalInfo.skills.slice(0, 10);

    return formatted;
  }

  /**
   * Determine focus areas based on request type and context
   */
  private determineFocus(
    type: AIContentRequestType,
    jobContext: JobContext,
    userFocus: string[]
  ): string[] {
    const focus = [...userFocus];

    // Add type-specific focus areas
    const typeFocus = {
      cover_letter: ['experience', 'motivation', 'company_fit'],
      question_response: ['specific_skills', 'examples', 'results'],
      summary: ['key_achievements', 'core_skills', 'career_progression'],
      objective: ['career_goals', 'value_proposition', 'alignment'],
      why_interested: ['company_research', 'role_alignment', 'career_growth'],
      why_qualified: ['relevant_experience', 'skill_match', 'achievements'],
      custom_response: ['context_specific', 'personalization']
    };

    focus.push(...(typeFocus[type] || []));

    // Add job-context specific focus
    if (jobContext.experienceLevel === 'senior') {
      focus.push('leadership', 'strategic_thinking');
    } else if (jobContext.experienceLevel === 'entry') {
      focus.push('learning_ability', 'enthusiasm', 'potential');
    }

    // Add skill-based focus from job requirements
    const skillKeywords = ['technical', 'programming', 'management', 'communication', 'analytical'];
    const jobText = jobContext.jobDescription.toLowerCase();
    
    skillKeywords.forEach(skill => {
      if (jobText.includes(skill)) {
        focus.push(skill);
      }
    });

    // Remove duplicates and limit
    return [...new Set(focus)].slice(0, 5);
  }

  /**
   * Validate and enhance request
   */
  private validateAndEnhanceRequest(
    request: AIContentRequest,
    options: Partial<RequestFormattingOptions>
  ): AIContentRequest {
    // Validate required fields
    if (!request.context.userProfile.id) {
      throw new Error('User profile ID is required');
    }

    if (!request.context.jobDescription && !request.context.specificQuestion) {
      throw new Error('Either job description or specific question is required');
    }

    // Enhance with examples if requested
    if (options.includeExamples) {
      request.context.existingContent = this.getExampleContent(request.type);
    }

    // Add template variables
    if (options.templateVariables) {
      Object.entries(options.templateVariables).forEach(([key, value]) => {
        if (key !== 'fieldLabel' && key !== 'existingContent') {
          request.preferences.customInstructions = 
            (request.preferences.customInstructions || '') + `\n${key}: ${value}`;
        }
      });
    }

    return request;
  }

  /**
   * Get example content for request type
   */
  private getExampleContent(type: AIContentRequestType): string {
    const examples = {
      cover_letter: `Example structure:
- Opening: Express interest and mention the specific role
- Body: Highlight 2-3 relevant experiences or skills
- Closing: Express enthusiasm and next steps`,

      question_response: `Example approach:
- Start with a direct answer
- Provide a specific example or experience
- Explain the impact or result
- Connect back to the role requirements`,

      summary: `Example format:
- Professional title or area of expertise
- Years of experience and key industries
- 2-3 core competencies or achievements
- Value proposition for employers`,

      objective: `Example structure:
- Career stage and direction
- Specific role or industry interest
- Key skills or experiences to leverage
- Value you bring to organizations`,

      why_interested: `Example approach:
- Specific aspects of the role that appeal to you
- Company values or mission alignment
- Growth opportunities you see
- How it fits your career goals`,

      why_qualified: `Example structure:
- Direct experience relevant to the role
- Specific skills that match requirements
- Quantifiable achievements or results
- Unique value proposition`,

      custom_response: `Tailor your response to:
- Address the specific question directly
- Use relevant examples from your experience
- Show understanding of the role/company
- Demonstrate your value proposition`
    };

    return examples[type] || '';
  }

  /**
   * Build generation context
   */
  private buildGenerationContext(requestId: string, userId: string): GenerationContext {
    return {
      requestId,
      userId,
      sessionId: this.generateSessionId(),
      pageUrl: window.location.href,
      platform: this.detectPlatform(),
      timestamp: new Date(),
      userAgent: navigator.userAgent
    };
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): string {
    const hostname = window.location.hostname.toLowerCase();
    
    if (hostname.includes('linkedin')) return 'linkedin';
    if (hostname.includes('indeed')) return 'indeed';
    if (hostname.includes('workday')) return 'workday';
    if (hostname.includes('greenhouse')) return 'greenhouse';
    if (hostname.includes('lever')) return 'lever';
    
    return 'custom';
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    // Try to get existing session ID from sessionStorage
    let sessionId = sessionStorage.getItem('ai_content_session_id');
    
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('ai_content_session_id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Create request for specific field
   */
  createFieldRequest(
    fieldLabel: string,
    fieldType: AIContentRequestType,
    userProfile: UserProfile,
    jobContext: JobContext,
    existingContent?: string,
    preferences: Partial<ContentGenerationPreferences> = {}
  ): AIContentRequest {
    return this.createRequest(
      fieldType,
      userProfile,
      jobContext,
      {
        templateVariables: {
          fieldLabel,
          existingContent
        }
      },
      preferences,
      `Please provide content for the field labeled: "${fieldLabel}"`
    );
  }

  /**
   * Create batch request for multiple fields
   */
  createBatchRequest(
    fields: Array<{
      label: string;
      type: AIContentRequestType;
      existingContent?: string;
    }>,
    userProfile: UserProfile,
    jobContext: JobContext,
    preferences: Partial<ContentGenerationPreferences> = {}
  ): AIContentRequest[] {
    return fields.map(field => 
      this.createFieldRequest(
        field.label,
        field.type,
        userProfile,
        jobContext,
        field.existingContent,
        preferences
      )
    );
  }

  /**
   * Validate request before sending
   */
  validateRequest(request: AIContentRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!request.id) errors.push('Request ID is required');
    if (!request.type) errors.push('Request type is required');
    if (!request.context.userProfile.id) errors.push('User profile ID is required');
    if (!request.metadata.userId) errors.push('User ID is required');

    // Check content requirements
    if (!request.context.jobDescription && !request.context.specificQuestion) {
      errors.push('Either job description or specific question is required');
    }

    // Check preferences
    if (!request.preferences.tone) errors.push('Tone preference is required');
    if (!request.preferences.length) errors.push('Length preference is required');

    // Validate enum values
    const validTones = ['professional', 'casual', 'enthusiastic', 'confident'];
    if (!validTones.includes(request.preferences.tone)) {
      errors.push('Invalid tone preference');
    }

    const validLengths = ['short', 'medium', 'long'];
    if (!validLengths.includes(request.preferences.length)) {
      errors.push('Invalid length preference');
    }

    const validTypes = [
      'cover_letter', 'question_response', 'summary', 'objective',
      'why_interested', 'why_qualified', 'custom_response'
    ];
    if (!validTypes.includes(request.type)) {
      errors.push('Invalid request type');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}