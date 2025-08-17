/**
 * Data validation utilities for profile information
 */

import type { 
  UserProfile, 
  Address, 
  WorkExperience, 
  Education, 
  Certification,
  ProfileValidationResult,
  ProfileValidationError,
  ProfileValidationWarning
} from '../types/profile.js';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (supports various formats)
const PHONE_REGEX = /^[\+]?[1-9][\d]{0,15}$/;

// URL validation regex
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

// Validation error codes
export const ValidationErrorCodes = {
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE: 'INVALID_PHONE',
  INVALID_URL: 'INVALID_URL',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_LENGTH: 'INVALID_LENGTH',
  INVALID_FORMAT: 'INVALID_FORMAT',
  FUTURE_DATE: 'FUTURE_DATE',
  DATE_RANGE_INVALID: 'DATE_RANGE_INVALID',
} as const;

// Validation warning codes
export const ValidationWarningCodes = {
  MISSING_OPTIONAL: 'MISSING_OPTIONAL',
  INCOMPLETE_PROFILE: 'INCOMPLETE_PROFILE',
  OLD_DATA: 'OLD_DATA',
  SUSPICIOUS_FORMAT: 'SUSPICIOUS_FORMAT',
} as const;

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates phone number format
 */
export function validatePhone(phone: string): boolean {
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  return PHONE_REGEX.test(cleanPhone);
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): boolean {
  return URL_REGEX.test(url.trim());
}

/**
 * Validates date is not in the future
 */
export function validatePastDate(date: Date): boolean {
  return date <= new Date();
}

/**
 * Validates date range (start date before end date)
 */
export function validateDateRange(startDate: Date, endDate?: Date): boolean {
  if (!endDate) return true;
  return startDate <= endDate;
}

/**
 * Validates string length
 */
export function validateLength(value: string, min: number, max?: number): boolean {
  const length = value.trim().length;
  if (length < min) return false;
  if (max && length > max) return false;
  return true;
}

/**
 * Validates address information
 */
export function validateAddress(address: Address): ProfileValidationError[] {
  const errors: ProfileValidationError[] = [];

  if (!address.street?.trim()) {
    errors.push({
      field: 'address.street',
      message: 'Street address is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!address.city?.trim()) {
    errors.push({
      field: 'address.city',
      message: 'City is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!address.state?.trim()) {
    errors.push({
      field: 'address.state',
      message: 'State is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!address.zipCode?.trim()) {
    errors.push({
      field: 'address.zipCode',
      message: 'ZIP code is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!address.country?.trim()) {
    errors.push({
      field: 'address.country',
      message: 'Country is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  return errors;
}

/**
 * Validates work experience entry
 */
export function validateWorkExperience(experience: WorkExperience): ProfileValidationError[] {
  const errors: ProfileValidationError[] = [];

  if (!experience.company?.trim()) {
    errors.push({
      field: 'workExperience.company',
      message: 'Company name is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!experience.position?.trim()) {
    errors.push({
      field: 'workExperience.position',
      message: 'Position title is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!validatePastDate(experience.startDate)) {
    errors.push({
      field: 'workExperience.startDate',
      message: 'Start date cannot be in the future',
      code: ValidationErrorCodes.FUTURE_DATE,
    });
  }

  if (!experience.isCurrent && experience.endDate) {
    if (!validatePastDate(experience.endDate)) {
      errors.push({
        field: 'workExperience.endDate',
        message: 'End date cannot be in the future',
        code: ValidationErrorCodes.FUTURE_DATE,
      });
    }

    if (!validateDateRange(experience.startDate, experience.endDate)) {
      errors.push({
        field: 'workExperience.dateRange',
        message: 'End date must be after start date',
        code: ValidationErrorCodes.DATE_RANGE_INVALID,
      });
    }
  }

  if (!validateLength(experience.description, 10, 2000)) {
    errors.push({
      field: 'workExperience.description',
      message: 'Description must be between 10 and 2000 characters',
      code: ValidationErrorCodes.INVALID_LENGTH,
    });
  }

  return errors;
}

/**
 * Validates education entry
 */
export function validateEducation(education: Education): ProfileValidationError[] {
  const errors: ProfileValidationError[] = [];

  if (!education.institution?.trim()) {
    errors.push({
      field: 'education.institution',
      message: 'Institution name is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!education.degree?.trim()) {
    errors.push({
      field: 'education.degree',
      message: 'Degree is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!education.fieldOfStudy?.trim()) {
    errors.push({
      field: 'education.fieldOfStudy',
      message: 'Field of study is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!validatePastDate(education.startDate)) {
    errors.push({
      field: 'education.startDate',
      message: 'Start date cannot be in the future',
      code: ValidationErrorCodes.FUTURE_DATE,
    });
  }

  if (education.endDate) {
    if (!validateDateRange(education.startDate, education.endDate)) {
      errors.push({
        field: 'education.dateRange',
        message: 'End date must be after start date',
        code: ValidationErrorCodes.DATE_RANGE_INVALID,
      });
    }
  }

  if (education.gpa !== undefined && (education.gpa < 0 || education.gpa > 4.0)) {
    errors.push({
      field: 'education.gpa',
      message: 'GPA must be between 0.0 and 4.0',
      code: ValidationErrorCodes.INVALID_FORMAT,
    });
  }

  return errors;
}

/**
 * Validates certification entry
 */
export function validateCertification(certification: Certification): ProfileValidationError[] {
  const errors: ProfileValidationError[] = [];

  if (!certification.name?.trim()) {
    errors.push({
      field: 'certification.name',
      message: 'Certification name is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!certification.issuer?.trim()) {
    errors.push({
      field: 'certification.issuer',
      message: 'Issuer is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!validatePastDate(certification.issueDate)) {
    errors.push({
      field: 'certification.issueDate',
      message: 'Issue date cannot be in the future',
      code: ValidationErrorCodes.FUTURE_DATE,
    });
  }

  if (certification.expirationDate && !validateDateRange(certification.issueDate, certification.expirationDate)) {
    errors.push({
      field: 'certification.dateRange',
      message: 'Expiration date must be after issue date',
      code: ValidationErrorCodes.DATE_RANGE_INVALID,
    });
  }

  if (certification.credentialUrl && !validateUrl(certification.credentialUrl)) {
    errors.push({
      field: 'certification.credentialUrl',
      message: 'Invalid credential URL format',
      code: ValidationErrorCodes.INVALID_URL,
    });
  }

  return errors;
}

/**
 * Validates complete user profile
 */
export function validateUserProfile(profile: UserProfile): ProfileValidationResult {
  const errors: ProfileValidationError[] = [];
  const warnings: ProfileValidationWarning[] = [];

  // Validate personal information
  if (!profile.personalInfo.firstName?.trim()) {
    errors.push({
      field: 'personalInfo.firstName',
      message: 'First name is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!profile.personalInfo.lastName?.trim()) {
    errors.push({
      field: 'personalInfo.lastName',
      message: 'Last name is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  }

  if (!profile.personalInfo.email?.trim()) {
    errors.push({
      field: 'personalInfo.email',
      message: 'Email is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  } else if (!validateEmail(profile.personalInfo.email)) {
    errors.push({
      field: 'personalInfo.email',
      message: 'Invalid email format',
      code: ValidationErrorCodes.INVALID_EMAIL,
    });
  }

  if (!profile.personalInfo.phone?.trim()) {
    errors.push({
      field: 'personalInfo.phone',
      message: 'Phone number is required',
      code: ValidationErrorCodes.REQUIRED_FIELD,
    });
  } else if (!validatePhone(profile.personalInfo.phone)) {
    errors.push({
      field: 'personalInfo.phone',
      message: 'Invalid phone number format',
      code: ValidationErrorCodes.INVALID_PHONE,
    });
  }

  // Validate address
  errors.push(...validateAddress(profile.personalInfo.address));

  // Validate optional URLs
  if (profile.personalInfo.linkedInUrl && !validateUrl(profile.personalInfo.linkedInUrl)) {
    errors.push({
      field: 'personalInfo.linkedInUrl',
      message: 'Invalid LinkedIn URL format',
      code: ValidationErrorCodes.INVALID_URL,
    });
  }

  if (profile.personalInfo.portfolioUrl && !validateUrl(profile.personalInfo.portfolioUrl)) {
    errors.push({
      field: 'personalInfo.portfolioUrl',
      message: 'Invalid portfolio URL format',
      code: ValidationErrorCodes.INVALID_URL,
    });
  }

  if (profile.personalInfo.githubUrl && !validateUrl(profile.personalInfo.githubUrl)) {
    errors.push({
      field: 'personalInfo.githubUrl',
      message: 'Invalid GitHub URL format',
      code: ValidationErrorCodes.INVALID_URL,
    });
  }

  // Validate work experience
  profile.professionalInfo.workExperience.forEach((experience, index) => {
    const experienceErrors = validateWorkExperience(experience);
    errors.push(...experienceErrors.map(error => ({
      ...error,
      field: `professionalInfo.workExperience[${index}].${error.field.replace('workExperience.', '')}`,
    })));
  });

  // Validate education
  profile.professionalInfo.education.forEach((education, index) => {
    const educationErrors = validateEducation(education);
    errors.push(...educationErrors.map(error => ({
      ...error,
      field: `professionalInfo.education[${index}].${error.field.replace('education.', '')}`,
    })));
  });

  // Validate certifications
  profile.professionalInfo.certifications.forEach((certification, index) => {
    const certificationErrors = validateCertification(certification);
    errors.push(...certificationErrors.map(error => ({
      ...error,
      field: `professionalInfo.certifications[${index}].${error.field.replace('certification.', '')}`,
    })));
  });

  // Add warnings for incomplete profile
  if (profile.professionalInfo.workExperience.length === 0) {
    warnings.push({
      field: 'professionalInfo.workExperience',
      message: 'No work experience added. Consider adding your professional background.',
      code: ValidationWarningCodes.INCOMPLETE_PROFILE,
    });
  }

  if (profile.professionalInfo.education.length === 0) {
    warnings.push({
      field: 'professionalInfo.education',
      message: 'No education added. Consider adding your educational background.',
      code: ValidationWarningCodes.INCOMPLETE_PROFILE,
    });
  }

  if (profile.professionalInfo.skills.length === 0) {
    warnings.push({
      field: 'professionalInfo.skills',
      message: 'No skills added. Consider adding relevant skills.',
      code: ValidationWarningCodes.INCOMPLETE_PROFILE,
    });
  }

  if (profile.documents.resumes.length === 0) {
    warnings.push({
      field: 'documents.resumes',
      message: 'No resume uploaded. Upload a resume for automatic file attachment.',
      code: ValidationWarningCodes.INCOMPLETE_PROFILE,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}