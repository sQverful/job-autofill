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

// Enhanced user profile interface with comprehensive fields
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
  workInfo?: {
    currentTitle?: string;
    experience?: string;
    skills?: string[];
    linkedinUrl?: string;
    portfolioUrl?: string;
    githubUrl?: string;
    workExperience?: WorkExperience[];
    summary?: string;
  };
  professionalInfo: {
    workExperience: WorkExperience[];
    education: Education[];
    skills: string[];
    certifications: Certification[];
    summary?: string;
  };
  preferences: {
    desiredSalary?: string;
    availableStartDate?: string;
    workAuthorization?: string;
    willingToRelocate?: boolean;
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

// Profile state management types for popup components
export interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  activeTab: 'profile' | 'settings';
  showEditForm: boolean;
  lastSaved?: Date;
  hasUnsavedChanges: boolean;
}

export interface ProfileFormState {
  isValid: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
  touchedFields: Set<string>;
  isSubmitting: boolean;
}

export interface ProfileImportState {
  isImporting: boolean;
  importProgress: number;
  importError?: string;
  importSuccess: boolean;
}

export interface ProfileExportState {
  isExporting: boolean;
  exportError?: string;
  exportSuccess: boolean;
  lastExportDate?: Date;
}

// Profile completion tracking
export interface ProfileCompletionStatus {
  overall: number; // 0-100 percentage
  sections: {
    personalInfo: number;
    workInfo: number;
    preferences: number;
  };
  missingFields: string[];
  recommendations: string[];
}

// Profile management actions
export type ProfileAction = 
  | { type: 'LOAD_PROFILE_START' }
  | { type: 'LOAD_PROFILE_SUCCESS'; payload: UserProfile }
  | { type: 'LOAD_PROFILE_ERROR'; payload: string }
  | { type: 'SAVE_PROFILE_START' }
  | { type: 'SAVE_PROFILE_SUCCESS'; payload: UserProfile }
  | { type: 'SAVE_PROFILE_ERROR'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: 'profile' | 'settings' }
  | { type: 'TOGGLE_EDIT_FORM'; payload: boolean }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'IMPORT_PROFILE_START' }
  | { type: 'IMPORT_PROFILE_SUCCESS'; payload: UserProfile }
  | { type: 'IMPORT_PROFILE_ERROR'; payload: string }
  | { type: 'EXPORT_PROFILE_START' }
  | { type: 'EXPORT_PROFILE_SUCCESS' }
  | { type: 'EXPORT_PROFILE_ERROR'; payload: string }
  | { type: 'RESET_STATE' };