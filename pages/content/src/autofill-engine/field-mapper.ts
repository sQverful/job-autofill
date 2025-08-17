/**
 * Field mapping utilities for autofill engine
 * Maps form fields to user profile data
 */

import type { FormField, UserProfile } from '@extension/shared/lib/types';

export interface FieldMapping {
  fieldId: string;
  profilePath: string;
  transformer?: (value: any) => string | boolean | number;
  validator?: (value: any) => boolean;
  priority: number; // Higher priority mappings are preferred
}

export interface FieldMappingRule {
  patterns: string[]; // Field label/name patterns to match
  profilePath: string;
  transformer?: (value: any) => string | boolean | number;
  validator?: (value: any) => boolean;
  fieldTypes: string[]; // Applicable field types
  priority: number;
}

// Default field mapping rules
export const DEFAULT_FIELD_MAPPINGS: FieldMappingRule[] = [
  // Personal Information
  {
    patterns: ['first.*name', 'fname', 'given.*name'],
    profilePath: 'personalInfo.firstName',
    fieldTypes: ['text'],
    priority: 10
  },
  {
    patterns: ['last.*name', 'lname', 'family.*name', 'surname'],
    profilePath: 'personalInfo.lastName',
    fieldTypes: ['text'],
    priority: 10
  },
  {
    patterns: ['full.*name', 'name', 'applicant.*name'],
    profilePath: 'personalInfo',
    transformer: (personalInfo) => `${personalInfo.firstName} ${personalInfo.lastName}`,
    fieldTypes: ['text'],
    priority: 8
  },
  {
    patterns: ['email', 'e-mail', 'email.*address'],
    profilePath: 'personalInfo.email',
    validator: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    fieldTypes: ['email', 'text'],
    priority: 10
  },
  {
    patterns: ['phone', 'telephone', 'mobile', 'cell', 'contact.*number'],
    profilePath: 'personalInfo.phone',
    transformer: (phone) => phone.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3'),
    fieldTypes: ['phone', 'text'],
    priority: 10
  },
  
  // Address Information
  {
    patterns: ['address', 'street', 'address.*line.*1'],
    profilePath: 'personalInfo.address.street',
    fieldTypes: ['text'],
    priority: 9
  },
  {
    patterns: ['city', 'town'],
    profilePath: 'personalInfo.address.city',
    fieldTypes: ['text'],
    priority: 9
  },
  {
    patterns: ['state', 'province', 'region'],
    profilePath: 'personalInfo.address.state',
    fieldTypes: ['text', 'select'],
    priority: 9
  },
  {
    patterns: ['zip', 'postal.*code', 'zipcode'],
    profilePath: 'personalInfo.address.zipCode',
    fieldTypes: ['text'],
    priority: 9
  },
  {
    patterns: ['country'],
    profilePath: 'personalInfo.address.country',
    fieldTypes: ['text', 'select'],
    priority: 9
  },
  
  // Professional URLs
  {
    patterns: ['linkedin', 'linkedin.*url', 'linkedin.*profile'],
    profilePath: 'personalInfo.linkedInUrl',
    validator: (value) => !value || value.includes('linkedin.com'),
    fieldTypes: ['url', 'text'],
    priority: 8
  },
  {
    patterns: ['portfolio', 'website', 'personal.*website'],
    profilePath: 'personalInfo.portfolioUrl',
    validator: (value) => !value || /^https?:\/\/.+/.test(value),
    fieldTypes: ['url', 'text'],
    priority: 7
  },
  {
    patterns: ['github', 'github.*url', 'github.*profile'],
    profilePath: 'personalInfo.githubUrl',
    validator: (value) => !value || value.includes('github.com'),
    fieldTypes: ['url', 'text'],
    priority: 7
  },
  
  // Job Preferences
  {
    patterns: ['work.*authorization', 'authorized.*work', 'visa.*status'],
    profilePath: 'preferences.jobPreferences.workAuthorization',
    transformer: (auth) => {
      const authMap = {
        'citizen': 'Yes, I am authorized to work in this country',
        'permanent_resident': 'Yes, I am a permanent resident',
        'visa_holder': 'Yes, I have a valid work visa',
        'requires_sponsorship': 'No, I require sponsorship'
      };
      return authMap[auth] || auth;
    },
    fieldTypes: ['select', 'radio'],
    priority: 9
  },
  {
    patterns: ['sponsorship', 'require.*sponsorship', 'visa.*sponsorship'],
    profilePath: 'preferences.jobPreferences.requiresSponsorship',
    transformer: (requires) => requires ? 'Yes' : 'No',
    fieldTypes: ['select', 'radio', 'checkbox'],
    priority: 9
  },
  {
    patterns: ['start.*date', 'available.*date', 'availability'],
    profilePath: 'preferences.jobPreferences.availableStartDate',
    transformer: (date) => {
      if (date instanceof Date) {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
      return date;
    },
    fieldTypes: ['date', 'text'],
    priority: 8
  },
  {
    patterns: ['relocate', 'willing.*relocate', 'relocation'],
    profilePath: 'preferences.jobPreferences.willingToRelocate',
    transformer: (willing) => willing ? 'Yes' : 'No',
    fieldTypes: ['select', 'radio', 'checkbox'],
    priority: 8
  },
  
  // Salary Information
  {
    patterns: ['salary.*min', 'minimum.*salary', 'salary.*expectation.*min'],
    profilePath: 'preferences.jobPreferences.desiredSalaryMin',
    transformer: (salary) => salary ? salary.toString() : '',
    fieldTypes: ['number', 'text'],
    priority: 7
  },
  {
    patterns: ['salary.*max', 'maximum.*salary', 'salary.*expectation.*max'],
    profilePath: 'preferences.jobPreferences.desiredSalaryMax',
    transformer: (salary) => salary ? salary.toString() : '',
    fieldTypes: ['number', 'text'],
    priority: 7
  },
  
  // Experience and Education
  {
    patterns: ['years.*experience', 'experience.*years', 'total.*experience'],
    profilePath: 'professionalInfo.workExperience',
    transformer: (experiences) => {
      if (!experiences || experiences.length === 0) return '0';
      const totalYears = experiences.reduce((total, exp) => {
        const start = new Date(exp.startDate);
        const end = exp.endDate ? new Date(exp.endDate) : new Date();
        const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
        return total + years;
      }, 0);
      return Math.round(totalYears).toString();
    },
    fieldTypes: ['number', 'text', 'select'],
    priority: 8
  },
  {
    patterns: ['education.*level', 'degree', 'highest.*education'],
    profilePath: 'professionalInfo.education',
    transformer: (education) => {
      if (!education || education.length === 0) return '';
      // Return the highest degree
      const degrees = education.map(edu => edu.degree);
      const degreeHierarchy = ['PhD', 'Doctorate', 'Master', 'Bachelor', 'Associate', 'High School'];
      for (const degree of degreeHierarchy) {
        if (degrees.some(d => d.toLowerCase().includes(degree.toLowerCase()))) {
          return degree;
        }
      }
      return degrees[0] || '';
    },
    fieldTypes: ['select', 'text'],
    priority: 8
  },
  
  // Skills
  {
    patterns: ['skills', 'technical.*skills', 'key.*skills'],
    profilePath: 'professionalInfo.skills',
    transformer: (skills) => Array.isArray(skills) ? skills.join(', ') : skills,
    fieldTypes: ['textarea', 'text'],
    priority: 7
  }
];

export class FieldMapper {
  private mappingRules: FieldMappingRule[];
  private customMappings: Map<string, FieldMapping> = new Map();

  constructor(mappingRules: FieldMappingRule[] = DEFAULT_FIELD_MAPPINGS) {
    this.mappingRules = [...mappingRules].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Add a custom field mapping for a specific field
   */
  addCustomMapping(fieldId: string, mapping: FieldMapping): void {
    this.customMappings.set(fieldId, mapping);
  }

  /**
   * Remove a custom field mapping
   */
  removeCustomMapping(fieldId: string): void {
    this.customMappings.delete(fieldId);
  }

  /**
   * Map form fields to profile data paths
   */
  mapFields(fields: FormField[]): FieldMapping[] {
    const mappings: FieldMapping[] = [];

    for (const field of fields) {
      // Check for custom mapping first
      if (this.customMappings.has(field.id)) {
        mappings.push(this.customMappings.get(field.id)!);
        continue;
      }

      // Find best matching rule
      const mapping = this.findBestMapping(field);
      if (mapping) {
        mappings.push({
          fieldId: field.id,
          profilePath: mapping.profilePath,
          transformer: mapping.transformer,
          validator: mapping.validator,
          priority: mapping.priority
        });
      }
    }

    return mappings.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Find the best mapping rule for a field
   */
  private findBestMapping(field: FormField): FieldMappingRule | null {
    const fieldText = this.normalizeFieldText(field.label);
    const fieldName = this.normalizeFieldText(field.id);
    const fieldPlaceholder = field.placeholder ? this.normalizeFieldText(field.placeholder) : '';

    for (const rule of this.mappingRules) {
      // Check if field type matches
      if (!rule.fieldTypes.includes(field.type)) {
        continue;
      }

      // Check if any pattern matches
      const matchesPattern = rule.patterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(fieldText) || regex.test(fieldName) || regex.test(fieldPlaceholder);
      });

      if (matchesPattern) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Normalize field text for pattern matching
   */
  private normalizeFieldText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get value from profile using dot notation path
   */
  getProfileValue(profile: UserProfile, path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], profile);
  }

  /**
   * Apply transformer to a value if provided
   */
  transformValue(value: any, transformer?: (value: any) => any): any {
    if (transformer && value !== undefined && value !== null) {
      try {
        return transformer(value);
      } catch (error) {
        console.warn('Field transformation failed:', error);
        return value;
      }
    }
    return value;
  }

  /**
   * Validate a value using the provided validator
   */
  validateValue(value: any, validator?: (value: any) => boolean): boolean {
    if (!validator) return true;
    try {
      return validator(value);
    } catch (error) {
      console.warn('Field validation failed:', error);
      return false;
    }
  }
}