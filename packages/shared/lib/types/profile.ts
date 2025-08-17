/**
 * Core data models for job application autofill functionality
 */

// Address information
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Work experience entry
export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  description: string;
  location: string;
}

// Education entry
export interface Education {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: Date;
  endDate?: Date;
  gpa?: number;
  honors?: string;
}

// Certification entry
export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expirationDate?: Date;
  credentialId?: string;
  credentialUrl?: string;
}

// Job preferences
export interface JobPreferences {
  desiredSalaryMin?: number;
  desiredSalaryMax?: number;
  workAuthorization: 'citizen' | 'permanent_resident' | 'visa_holder' | 'requires_sponsorship';
  requiresSponsorship: boolean;
  willingToRelocate: boolean;
  availableStartDate: Date;
  preferredWorkType: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  noticePeriod?: string;
}

// Privacy settings
export interface PrivacySettings {
  shareAnalytics: boolean;
  shareUsageData: boolean;
  allowAIContentGeneration: boolean;
  dataSyncEnabled: boolean;
}

// Resume document
export interface ResumeDocument {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  fileType: 'pdf' | 'docx';
  uploadDate: Date;
  isDefault: boolean;
  cloudUrl?: string;
  localPath?: string;
}

// Cover letter template
export interface CoverLetterTemplate {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdDate: Date;
  lastModified: Date;
}

// Main user profile interface
export interface UserProfile {
  id: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: Address;
    linkedInUrl?: string;
    portfolioUrl?: string;
    githubUrl?: string;
  };
  professionalInfo: {
    workExperience: WorkExperience[];
    education: Education[];
    skills: string[];
    certifications: Certification[];
    summary?: string;
  };
  preferences: {
    defaultAnswers: Record<string, string>;
    jobPreferences: JobPreferences;
    privacySettings: PrivacySettings;
  };
  documents: {
    resumes: ResumeDocument[];
    coverLetters: CoverLetterTemplate[];
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    lastSyncAt?: Date;
    version: number;
  };
}

// Profile validation result
export interface ProfileValidationResult {
  isValid: boolean;
  errors: ProfileValidationError[];
  warnings: ProfileValidationWarning[];
}

export interface ProfileValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ProfileValidationWarning {
  field: string;
  message: string;
  code: string;
}