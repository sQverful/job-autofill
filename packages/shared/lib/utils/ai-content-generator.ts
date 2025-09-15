/**
 * AI Content Generator
 * Generates personalized content for job applications using user profile data
 */

import type { UserProfile } from '../types/profile.js';
import type { AIFormattedProfile } from './ai-profile-formatter.js';

export interface ContentGenerationContext {
  company?: string;
  role?: string;
  industry?: string;
  fieldLabel?: string;
  fieldType: 'why_company' | 'why_role' | 'technical_problem' | 'cover_letter' | 'general';
}

/**
 * AI Content Generator class
 */
export class AIContentGenerator {
  /**
   * Generate personalized content for job application fields
   */
  static generatePersonalizedContent(
    formattedProfile: AIFormattedProfile,
    context: ContentGenerationContext
  ): string {
    switch (context.fieldType) {
      case 'why_company':
        return this.generateWhyCompanyResponse(formattedProfile, context);
      case 'why_role':
        return this.generateWhyRoleResponse(formattedProfile, context);
      case 'technical_problem':
        return this.generateTechnicalProblemResponse(formattedProfile, context);
      case 'cover_letter':
        return this.generateCoverLetterContent(formattedProfile, context);
      default:
        return this.generateGeneralResponse(formattedProfile, context);
    }
  }

  /**
   * Generate "Why this company" response
   */
  private static generateWhyCompanyResponse(
    profile: AIFormattedProfile,
    context: ContentGenerationContext
  ): string {
    const experience = profile.professional.experience[0];
    const skills = profile.professional.skills.slice(0, 3);
    const company = context.company || 'this company';
    
    const reasons = [];
    
    // Connect current experience to company
    if (experience) {
      reasons.push(`My ${experience.duration} experience at ${experience.company} as ${experience.position} has prepared me well for ${company}'s technical challenges`);
    }
    
    // Highlight relevant skills
    if (skills.length > 0) {
      reasons.push(`My expertise in ${skills.join(', ')} aligns perfectly with ${company}'s technology stack`);
    }
    
    // Add role-specific connection
    if (context.role) {
      reasons.push(`The ${context.role} position represents the next logical step in my career progression`);
    }
    
    // Add industry-specific insight
    if (context.industry === 'technology') {
      reasons.push(`I'm particularly drawn to ${company}'s innovative approach to solving complex technical problems`);
    }
    
    return reasons.join('. ') + '.';
  }

  /**
   * Generate "Why this role" response
   */
  private static generateWhyRoleResponse(
    profile: AIFormattedProfile,
    context: ContentGenerationContext
  ): string {
    const experience = profile.professional.experience[0];
    const skills = profile.professional.skills.slice(0, 4);
    const role = context.role || 'this role';
    
    const points = [];
    
    // Career progression narrative
    if (experience) {
      points.push(`Building on my experience as ${experience.position} at ${experience.company}`);
    }
    
    // Skills alignment
    if (skills.length > 0) {
      points.push(`I can leverage my skills in ${skills.join(', ')} to make an immediate impact`);
    }
    
    // Growth opportunity
    points.push(`This ${role} position offers the perfect opportunity to expand my technical leadership and drive meaningful results`);
    
    // Add specific achievements if available
    if (experience?.description) {
      points.push(`My track record of ${experience.description.toLowerCase()} demonstrates my ability to excel in this role`);
    }
    
    return points.join('. ') + '.';
  }

  /**
   * Generate technical problem response
   */
  private static generateTechnicalProblemResponse(
    profile: AIFormattedProfile,
    context: ContentGenerationContext
  ): string {
    const experience = profile.professional.experience[0];
    const skills = profile.professional.skills.slice(0, 3);
    
    if (!experience) {
      return `I recently tackled a challenging problem involving ${skills[0] || 'system optimization'} that required creative problem-solving and technical expertise.`;
    }
    
    const problem = this.generateTechnicalProblemExample(experience, skills);
    return problem;
  }

  /**
   * Generate a technical problem example based on user's experience
   */
  private static generateTechnicalProblemExample(
    experience: any,
    skills: string[]
  ): string {
    const company = experience.company;
    const role = experience.position;
    const tech = skills[0] || 'the technology stack';
    
    // Create a realistic technical problem based on their background
    const problems = [
      `At ${company}, I encountered a performance bottleneck in our ${tech} application that was causing 3-second load times. I analyzed the database queries, implemented caching strategies, and optimized the data flow, reducing load times to under 500ms and improving user satisfaction by 40%.`,
      
      `While working as ${role} at ${company}, I faced a complex integration challenge between multiple ${tech} services. I designed a robust API gateway solution that handled failover scenarios and implemented circuit breaker patterns, resulting in 99.9% uptime and seamless data synchronization.`,
      
      `During my time at ${company}, I solved a critical scalability issue where our ${tech} system couldn't handle peak traffic loads. I redesigned the architecture using microservices principles, implemented horizontal scaling, and optimized resource allocation, enabling the system to handle 10x the original traffic volume.`
    ];
    
    // Select problem based on role type
    if (role.toLowerCase().includes('senior') || role.toLowerCase().includes('lead')) {
      return problems[1]; // Architecture/integration problem
    } else if (role.toLowerCase().includes('engineer')) {
      return problems[0]; // Performance problem
    } else {
      return problems[2]; // Scalability problem
    }
  }

  /**
   * Generate cover letter content
   */
  private static generateCoverLetterContent(
    profile: AIFormattedProfile,
    context: ContentGenerationContext
  ): string {
    const experience = profile.professional.experience[0];
    const education = profile.professional.education[0];
    const skills = profile.professional.skills.slice(0, 4);
    
    const paragraphs = [];
    
    // Opening paragraph
    paragraphs.push(`I am excited to apply for the ${context.role || 'position'} at ${context.company || 'your company'}. With ${experience?.duration || 'several years'} of experience in ${skills.slice(0, 2).join(' and ')}, I am confident I can contribute significantly to your team.`);
    
    // Experience paragraph
    if (experience) {
      paragraphs.push(`In my current role as ${experience.position} at ${experience.company}, I have ${experience.description || 'developed expertise in building scalable solutions'}. My experience with ${skills.join(', ')} has prepared me to tackle the technical challenges at ${context.company || 'your organization'}.`);
    }
    
    // Education/skills paragraph
    if (education) {
      paragraphs.push(`My ${education.degree} in ${education.field} from ${education.institution} provided a strong foundation, which I have built upon through hands-on experience with ${skills.slice(0, 3).join(', ')}.`);
    }
    
    // Closing paragraph
    paragraphs.push(`I am particularly drawn to ${context.company || 'your company'}'s innovative approach and would welcome the opportunity to discuss how my background in ${skills[0]} and ${skills[1]} can contribute to your team's success.`);
    
    return paragraphs.join('\n\n');
  }

  /**
   * Generate general response
   */
  private static generateGeneralResponse(
    profile: AIFormattedProfile,
    context: ContentGenerationContext
  ): string {
    const experience = profile.professional.experience[0];
    const skills = profile.professional.skills.slice(0, 3);
    
    if (experience) {
      return `With my background as ${experience.position} at ${experience.company} and expertise in ${skills.join(', ')}, I bring ${experience.duration} of relevant experience to this opportunity.`;
    }
    
    return `My expertise in ${skills.join(', ')} and passion for ${context.industry || 'technology'} make me well-suited for this position.`;
  }

  /**
   * Detect field type from label or context
   */
  static detectFieldType(fieldLabel: string, fieldContext?: string): ContentGenerationContext['fieldType'] {
    const label = fieldLabel.toLowerCase();
    const context = fieldContext?.toLowerCase() || '';
    const combined = `${label} ${context}`;
    
    if (combined.includes('why') && (combined.includes('company') || combined.includes('organization'))) {
      return 'why_company';
    }
    
    if (combined.includes('why') && (combined.includes('role') || combined.includes('position') || combined.includes('job'))) {
      return 'why_role';
    }
    
    if (combined.includes('technical') && (combined.includes('problem') || combined.includes('challenge') || combined.includes('solution'))) {
      return 'technical_problem';
    }
    
    if (combined.includes('cover') && combined.includes('letter')) {
      return 'cover_letter';
    }
    
    return 'general';
  }

  /**
   * Extract company and role from job context
   */
  static extractJobContext(
    url: string,
    pageTitle: string,
    formHTML: string
  ): { company?: string; role?: string; industry?: string } {
    const context: { company?: string; role?: string; industry?: string } = {};
    
    // Extract company from URL
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        context.company = parts[parts.length - 2];
        // Capitalize first letter
        context.company = context.company.charAt(0).toUpperCase() + context.company.slice(1);
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
    
    // Extract role from page title
    const rolePatterns = [
      /apply.*for\s+([^-|]+)/i,
      /([^-|]+)\s+at\s+/i,
      /position:\s*([^-|]+)/i,
      /job:\s*([^-|]+)/i
    ];
    
    for (const pattern of rolePatterns) {
      const match = pageTitle.match(pattern);
      if (match) {
        context.role = match[1].trim();
        break;
      }
    }
    
    // Extract industry hints
    const industryKeywords = {
      'technology': ['tech', 'software', 'engineering', 'developer', 'startup'],
      'finance': ['finance', 'banking', 'investment', 'fintech'],
      'healthcare': ['health', 'medical', 'pharma', 'biotech'],
      'consulting': ['consulting', 'advisory', 'strategy'],
    };
    
    const contentLower = `${pageTitle} ${formHTML}`.toLowerCase();
    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        context.industry = industry;
        break;
      }
    }
    
    return context;
  }
}