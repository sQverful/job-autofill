import React, { useState, useEffect } from 'react';
import { Button, LoadingSpinner } from '@extension/ui';
import { validateUserProfile } from '@extension/shared';
import type { UserProfile, ProfileValidationResult } from '@extension/shared';
import { PersonalInfoForm } from './PersonalInfoForm';
import { ProfessionalInfoForm } from './ProfessionalInfoForm';
import { ResumeUpload } from './ResumeUpload';
import { DefaultAnswersForm } from './DefaultAnswersForm';
import { TestDataManager } from './TestDataManager';
import { ResumeParserService } from '../services/resumeParser';

interface ProfileManagerProps {
  onSave?: (profile: UserProfile) => Promise<void>;
  onCancel?: () => void;
}

// Default profile structure
const createDefaultProfile = (): UserProfile => ({
  id: '',
  personalInfo: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: '',
    },
    linkedInUrl: '',
    portfolioUrl: '',
    githubUrl: '',
  },
  professionalInfo: {
    workExperience: [],
    education: [],
    skills: [],
    certifications: [],
    summary: '',
  },
  preferences: {
    defaultAnswers: {},
    jobPreferences: {
      workAuthorization: 'citizen',
      requiresSponsorship: false,
      willingToRelocate: false,
      availableStartDate: new Date(),
      preferredWorkType: 'remote',
    },
    privacySettings: {
      shareAnalytics: true,
      shareUsageData: true,
      allowAIContentGeneration: true,
      dataSyncEnabled: true,
    },
  },
  documents: {
    resumes: [],
    coverLetters: [],
  },
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
  },
});

export const ProfileManager: React.FC<ProfileManagerProps> = ({
  onSave,
  onCancel,
}) => {
  const [profile, setProfile] = useState<UserProfile>(createDefaultProfile());
  const [validation, setValidation] = useState<ProfileValidationResult>({ isValid: true, errors: [], warnings: [] });
  const [activeSection, setActiveSection] = useState<'personal' | 'professional' | 'documents' | 'answers' | 'testdata'>('personal');
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load existing profile from storage on component mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setIsLoading(true);
        const { profileStorage } = await import('@extension/storage');
        const existingProfile = await profileStorage.get();
        
        // Only use existing profile if it has meaningful data (not just default empty profile)
        if (existingProfile && (existingProfile.id || existingProfile.personalInfo.firstName)) {
          setProfile(existingProfile);
          setHasUnsavedChanges(false); // Profile is loaded from storage, so no unsaved changes
        } else {
          setProfile(createDefaultProfile());
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
        setProfile(createDefaultProfile());
        setHasUnsavedChanges(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Validate profile whenever it changes (but not on initial load)
  useEffect(() => {
    if (!isLoading) {
      const validationResult = validateUserProfile(profile);
      setValidation(validationResult);
      setHasUnsavedChanges(true);
    }
  }, [profile, isLoading]);

  const handlePersonalInfoChange = (updates: Partial<UserProfile['personalInfo']>) => {
    setProfile(prev => ({
      ...prev,
      personalInfo: {
        ...prev.personalInfo,
        ...updates,
      },
      metadata: {
        ...prev.metadata,
        updatedAt: new Date(),
      },
    }));
  };

  const handleProfessionalInfoChange = (updates: Partial<UserProfile['professionalInfo']>) => {
    setProfile(prev => ({
      ...prev,
      professionalInfo: {
        ...prev.professionalInfo,
        ...updates,
      },
      metadata: {
        ...prev.metadata,
        updatedAt: new Date(),
      },
    }));
  };

  const handleDocumentsChange = (updates: Partial<UserProfile['documents']>) => {
    setProfile(prev => ({
      ...prev,
      documents: {
        ...prev.documents,
        ...updates,
      },
      metadata: {
        ...prev.metadata,
        updatedAt: new Date(),
      },
    }));
  };

  const handlePreferencesChange = (updates: Partial<UserProfile['preferences']>) => {
    setProfile(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...updates,
      },
      metadata: {
        ...prev.metadata,
        updatedAt: new Date(),
      },
    }));
  };

  const handleResumeParseAndApply = async (file: File): Promise<Partial<UserProfile>> => {
    try {
      const parsedData = await ResumeParserService.parseResume(file);
      
      // Apply parsed data to profile
      if (parsedData.personalInfo || parsedData.professionalInfo) {
        setProfile(prev => ({
          ...prev,
          personalInfo: {
            ...prev.personalInfo,
            ...parsedData.personalInfo,
          },
          professionalInfo: {
            ...prev.professionalInfo,
            ...parsedData.professionalInfo,
            // Merge arrays instead of replacing
            workExperience: parsedData.professionalInfo?.workExperience 
              ? [...prev.professionalInfo.workExperience, ...parsedData.professionalInfo.workExperience]
              : prev.professionalInfo.workExperience,
            education: parsedData.professionalInfo?.education
              ? [...prev.professionalInfo.education, ...parsedData.professionalInfo.education]
              : prev.professionalInfo.education,
            skills: parsedData.professionalInfo?.skills
              ? [...new Set([...prev.professionalInfo.skills, ...parsedData.professionalInfo.skills])]
              : prev.professionalInfo.skills,
            certifications: parsedData.professionalInfo?.certifications
              ? [...prev.professionalInfo.certifications, ...parsedData.professionalInfo.certifications]
              : prev.professionalInfo.certifications,
          },
          metadata: {
            ...prev.metadata,
            updatedAt: new Date(),
          },
        }));
      }
      
      return parsedData;
    } catch (error) {
      console.error('Resume parsing failed:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!validation.isValid) {
      return;
    }

    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(profile);
      }
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      // TODO: Show error message to user
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) {
        return;
      }
    }
    
    if (onCancel) {
      onCancel();
    }
  };

  const handleApplyTestData = (testProfile: UserProfile) => {
    // Generate new ID if the test profile doesn't have one
    const profileWithId = {
      ...testProfile,
      id: testProfile.id || `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      metadata: {
        ...testProfile.metadata,
        updatedAt: new Date(),
      },
    };
    
    setProfile(profileWithId);
    setHasUnsavedChanges(true);
  };

  const handleSaveTestProfile = async (testProfile: UserProfile) => {
    // This function is called by TestDataManager to save the profile immediately
    if (onSave) {
      try {
        await onSave(testProfile);
        // Update the local state to reflect the saved profile
        setProfile(testProfile);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Failed to save test profile:', error);
        throw error;
      }
    }
  };

  const handleClearTestData = () => {
    const confirmed = window.confirm('This will clear all profile data and return to an empty profile. Are you sure?');
    if (confirmed) {
      setProfile(createDefaultProfile());
      setHasUnsavedChanges(true);
    }
  };

  const sections = [
    { id: 'personal', label: 'Personal Information' },
    { id: 'professional', label: 'Professional Information' },
    { id: 'documents', label: 'Documents & Resume' },
    { id: 'answers', label: 'Default Answers' },
    { id: 'testdata', label: 'Test Data' },
  ] as const;

  // Show loading spinner while profile is being loaded
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 flex items-center justify-center min-h-96">
        <div className="flex items-center space-x-3">
          <LoadingSpinner />
          <span className="text-gray-600 dark:text-gray-400">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Profile Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Complete your profile to enable automatic job application filling. All information is stored securely and encrypted.
        </p>
      </div>

      {/* Validation Summary */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="mb-6 space-y-2">
          {validation.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                Please fix the following errors:
              </h3>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index}>• {error.message}</li>
                ))}
              </ul>
            </div>
          )}
          
          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Recommendations:
              </h3>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>• {warning.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Section Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="-mb-px flex space-x-8">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeSection === section.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {section.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Form Content */}
      <div className="mb-8">
        {activeSection === 'personal' && (
          <PersonalInfoForm
            profile={profile}
            errors={validation.errors}
            onChange={handlePersonalInfoChange}
          />
        )}

        {activeSection === 'professional' && (
          <ProfessionalInfoForm
            profile={profile}
            errors={validation.errors}
            onChange={handleProfessionalInfoChange}
          />
        )}

        {activeSection === 'documents' && (
          <ResumeUpload
            profile={profile}
            onChange={handleDocumentsChange}
            onParseResume={handleResumeParseAndApply}
          />
        )}

        {activeSection === 'answers' && (
          <DefaultAnswersForm
            profile={profile}
            errors={validation.errors}
            onChange={handlePreferencesChange}
          />
        )}

        {activeSection === 'testdata' && (
          <TestDataManager
            onApplyTestData={handleApplyTestData}
            onClearTestData={handleClearTestData}
            onSaveProfile={handleSaveTestProfile}
            currentProfile={profile}
          />
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          {hasUnsavedChanges && (
            <span className="text-sm text-yellow-600 dark:text-yellow-400">
              You have unsaved changes
            </span>
          )}
          
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Profile completion: {Math.round(((validation.errors.length === 0 ? 1 : 0) + 
              (validation.warnings.length < 3 ? 1 : 0)) * 50)}%
          </span>
        </div>

        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={!validation.isValid || isSaving}
            loading={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </div>

      {/* Progress Indicator */}
      {isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
            <LoadingSpinner />
            <span className="text-gray-900 dark:text-gray-100">Saving your profile...</span>
          </div>
        </div>
      )}
    </div>
  );
};