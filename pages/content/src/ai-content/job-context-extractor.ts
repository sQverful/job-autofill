/**
 * Job Context Extractor
 * 
 * Extracts job-related information from application pages to provide
 * context for AI content generation.
 */

import type { JobContext, JobPlatform } from '@extension/shared/lib/types';
import type { ContextExtractionConfig } from './types.js';

export class JobContextExtractor {
  private config: ContextExtractionConfig;
  private platform: JobPlatform;

  constructor(platform: JobPlatform, config?: Partial<ContextExtractionConfig>) {
    this.platform = platform;
    this.config = {
      selectors: {
        jobTitle: [
          'h1[data-test="job-title"]', // LinkedIn
          '.jobsearch-JobInfoHeader-title', // Indeed
          '[data-automation-id="jobPostingHeader"]', // Workday
          'h1.job-title',
          '.job-header h1',
          '[class*="job-title"]',
          '[class*="position-title"]'
        ],
        companyName: [
          '[data-test="job-company-name"]',
          '.jobsearch-InlineCompanyRating',
          '[data-automation-id="company"]',
          '.company-name',
          '[class*="company"]',
          '.employer-name'
        ],
        jobDescription: [
          '[data-test="job-description"]',
          '#jobDescriptionText',
          '[data-automation-id="jobPostingDescription"]',
          '.job-description',
          '.description',
          '[class*="job-description"]'
        ],
        requirements: [
          '[data-test="job-requirements"]',
          '.jobsearch-JobDescriptionSection-section',
          '[data-automation-id="requirements"]',
          '.requirements',
          '.qualifications',
          '[class*="requirements"]'
        ],
        benefits: [
          '[data-test="job-benefits"]',
          '.jobsearch-Benefits',
          '[data-automation-id="benefits"]',
          '.benefits',
          '.perks',
          '[class*="benefits"]'
        ],
        location: [
          '[data-test="job-location"]',
          '.jobsearch-JobInfoHeader-subtitle',
          '[data-automation-id="location"]',
          '.location',
          '.job-location',
          '[class*="location"]'
        ],
        salary: [
          '[data-test="job-salary"]',
          '.jobsearch-SalaryGuide',
          '[data-automation-id="salary"]',
          '.salary',
          '.compensation',
          '[class*="salary"]'
        ]
      },
      fallbackStrategies: {
        useMetaTags: true,
        useStructuredData: true,
        useHeuristics: true
      },
      timeout: 5000,
      ...config
    };
  }

  /**
   * Extract job context from the current page
   */
  async extractJobContext(): Promise<JobContext | null> {
    try {
      const context: Partial<JobContext> = {};

      // Extract basic job information
      context.jobTitle = this.extractJobTitle();
      context.companyName = this.extractCompanyName();
      context.jobDescription = this.extractJobDescription();
      context.requirements = this.extractRequirements();
      context.benefits = this.extractBenefits();
      context.location = this.extractLocation();
      context.salaryRange = this.extractSalaryRange();

      // Extract additional metadata
      context.jobType = this.extractJobType();
      context.experienceLevel = this.extractExperienceLevel();

      // Validate that we have minimum required information
      if (!context.jobTitle && !context.companyName && !context.jobDescription) {
        console.warn('JobContextExtractor: Insufficient job context extracted');
        return null;
      }

      return {
        jobTitle: context.jobTitle || 'Unknown Position',
        companyName: context.companyName || 'Unknown Company',
        jobDescription: context.jobDescription || '',
        requirements: context.requirements || [],
        benefits: context.benefits,
        location: context.location,
        salaryRange: context.salaryRange,
        jobType: context.jobType,
        experienceLevel: context.experienceLevel
      };
    } catch (error) {
      console.error('JobContextExtractor: Error extracting job context:', error);
      return null;
    }
  }

  /**
   * Extract job title from page
   */
  private extractJobTitle(): string | undefined {
    const title = this.extractTextFromSelectors(this.config.selectors.jobTitle);
    if (title) return this.cleanText(title);

    // Fallback strategies
    if (this.config.fallbackStrategies.useMetaTags) {
      const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (metaTitle) return this.cleanText(metaTitle);
    }

    if (this.config.fallbackStrategies.useStructuredData) {
      const structuredData = this.extractFromStructuredData('title');
      if (structuredData) return this.cleanText(structuredData);
    }

    return undefined;
  }

  /**
   * Extract company name from page
   */
  private extractCompanyName(): string | undefined {
    const company = this.extractTextFromSelectors(this.config.selectors.companyName);
    if (company) return this.cleanText(company);

    // Fallback strategies
    if (this.config.fallbackStrategies.useMetaTags) {
      const metaSite = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
      if (metaSite) return this.cleanText(metaSite);
    }

    if (this.config.fallbackStrategies.useStructuredData) {
      const structuredData = this.extractFromStructuredData('hiringOrganization');
      if (structuredData) return this.cleanText(structuredData);
    }

    return undefined;
  }

  /**
   * Extract job description from page
   */
  private extractJobDescription(): string {
    const description = this.extractTextFromSelectors(this.config.selectors.jobDescription);
    if (description) return this.cleanText(description);

    // Fallback to meta description
    if (this.config.fallbackStrategies.useMetaTags) {
      const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
      if (metaDesc) return this.cleanText(metaDesc);
    }

    return '';
  }

  /**
   * Extract job requirements from page
   */
  private extractRequirements(): string[] {
    const requirements: string[] = [];
    
    // Try to find requirements section
    const reqElements = this.findElementsBySelectors(this.config.selectors.requirements);
    
    for (const element of reqElements) {
      const text = element.textContent?.trim();
      if (text) {
        // Split by common delimiters and clean
        const items = text.split(/[•\n\r]|(?:\d+\.)|(?:-\s)/)
          .map(item => this.cleanText(item))
          .filter(item => item.length > 10); // Filter out short fragments
        
        requirements.push(...items);
      }
    }

    // Look for bullet points or list items within job description
    if (requirements.length === 0) {
      const listItems = document.querySelectorAll('li, p');
      for (const item of listItems) {
        const text = item.textContent?.trim();
        if (text && this.isRequirementText(text)) {
          requirements.push(this.cleanText(text));
        }
      }
    }

    return [...new Set(requirements)]; // Remove duplicates
  }

  /**
   * Extract benefits from page
   */
  private extractBenefits(): string[] | undefined {
    const benefits: string[] = [];
    
    const benefitElements = this.findElementsBySelectors(this.config.selectors.benefits);
    
    for (const element of benefitElements) {
      const text = element.textContent?.trim();
      if (text) {
        const items = text.split(/[•\n\r]|(?:\d+\.)|(?:-\s)/)
          .map(item => this.cleanText(item))
          .filter(item => item.length > 5);
        
        benefits.push(...items);
      }
    }

    return benefits.length > 0 ? [...new Set(benefits)] : undefined;
  }

  /**
   * Extract location from page
   */
  private extractLocation(): string | undefined {
    const location = this.extractTextFromSelectors(this.config.selectors.location);
    if (location) return this.cleanText(location);

    // Look for structured data
    if (this.config.fallbackStrategies.useStructuredData) {
      const structuredData = this.extractFromStructuredData('jobLocation');
      if (structuredData) return this.cleanText(structuredData);
    }

    return undefined;
  }

  /**
   * Extract salary range from page
   */
  private extractSalaryRange(): JobContext['salaryRange'] | undefined {
    const salaryText = this.extractTextFromSelectors(this.config.selectors.salary);
    if (!salaryText) return undefined;

    // Parse salary information using regex
    const salaryRegex = /\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/g;
    const matches = salaryRegex.exec(salaryText);
    
    if (matches) {
      const min = parseInt(matches[1].replace(/,/g, ''));
      const max = matches[2] ? parseInt(matches[2].replace(/,/g, '')) : undefined;
      
      return {
        min,
        max,
        currency: 'USD' // Default to USD, could be enhanced to detect currency
      };
    }

    return undefined;
  }

  /**
   * Extract job type from description
   */
  private extractJobType(): JobContext['jobType'] | undefined {
    const description = this.extractJobDescription().toLowerCase();
    
    if (description.includes('full-time') || description.includes('full time')) {
      return 'full_time';
    }
    if (description.includes('part-time') || description.includes('part time')) {
      return 'part_time';
    }
    if (description.includes('contract') || description.includes('contractor')) {
      return 'contract';
    }
    if (description.includes('intern') || description.includes('internship')) {
      return 'internship';
    }

    return undefined;
  }

  /**
   * Extract experience level from description
   */
  private extractExperienceLevel(): JobContext['experienceLevel'] | undefined {
    const description = this.extractJobDescription().toLowerCase();
    
    if (description.includes('senior') || description.includes('lead') || description.includes('principal')) {
      return 'senior';
    }
    if (description.includes('entry') || description.includes('junior') || description.includes('graduate')) {
      return 'entry';
    }
    if (description.includes('executive') || description.includes('director') || description.includes('vp')) {
      return 'executive';
    }
    if (description.includes('mid') || description.includes('intermediate')) {
      return 'mid';
    }

    return undefined;
  }

  /**
   * Extract text from multiple selectors
   */
  private extractTextFromSelectors(selectors: string[]): string | undefined {
    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element?.textContent?.trim()) {
          return element.textContent.trim();
        }
      } catch (error) {
        console.warn(`JobContextExtractor: Invalid selector "${selector}":`, error);
      }
    }
    return undefined;
  }

  /**
   * Find elements by multiple selectors
   */
  private findElementsBySelectors(selectors: string[]): Element[] {
    const elements: Element[] = [];
    
    for (const selector of selectors) {
      try {
        const found = document.querySelectorAll(selector);
        elements.push(...Array.from(found));
      } catch (error) {
        console.warn(`JobContextExtractor: Invalid selector "${selector}":`, error);
      }
    }
    
    return elements;
  }

  /**
   * Extract data from structured data (JSON-LD)
   */
  private extractFromStructuredData(property: string): string | undefined {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      
      for (const script of scripts) {
        const data = JSON.parse(script.textContent || '');
        
        if (data['@type'] === 'JobPosting') {
          const value = this.getNestedProperty(data, property);
          if (value) return String(value);
        }
      }
    } catch (error) {
      console.warn('JobContextExtractor: Error parsing structured data:', error);
    }
    
    return undefined;
  }

  /**
   * Get nested property from object
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check if text looks like a job requirement
   */
  private isRequirementText(text: string): boolean {
    const requirementKeywords = [
      'experience', 'required', 'must have', 'should have',
      'bachelor', 'master', 'degree', 'certification',
      'skills', 'knowledge', 'proficient', 'familiar'
    ];
    
    const lowerText = text.toLowerCase();
    return requirementKeywords.some(keyword => lowerText.includes(keyword)) && 
           text.length > 20 && text.length < 500;
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s.,!?()-]/g, '') // Remove special characters
      .trim();
  }
}