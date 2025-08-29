import React, { useState, useEffect } from 'react';
import { Button, Switch } from '@extension/ui';
import { 
  generateSampleUserProfile, 
  generateAlternativeSampleProfiles,
  downloadSampleResume,
  simulateResumeUpload,
  createSampleCoverLetterBlob
} from '@extension/shared';
import { testDataStorage } from '@extension/storage';
import type { UserProfile } from '@extension/shared';
import type { TestDataConfig } from '@extension/storage';

interface TestDataManagerProps {
  onApplyTestData: (profile: UserProfile) => void;
  onClearTestData: () => void;
  onSaveProfile?: (profile: UserProfile) => Promise<void>;
  currentProfile: UserProfile;
  className?: string;
}

export const TestDataManager: React.FC<TestDataManagerProps> = ({
  onApplyTestData,
  onClearTestData,
  onSaveProfile,
  currentProfile,
  className,
}) => {
  const [isTestDataEnabled, setIsTestDataEnabled] = useState(false);
  const [profileType, setProfileType] = useState<TestDataConfig['profileType']>('default');
  const [isLoading, setIsLoading] = useState(false);

  // Load test data state on component mount
  useEffect(() => {
    const loadTestDataState = async () => {
      try {
        const enabled = await testDataStorage.isTestDataEnabled();
        const type = await testDataStorage.getProfileType();
        setIsTestDataEnabled(enabled);
        setProfileType(type);
      } catch (error) {
        console.error('Failed to load test data state:', error);
      }
    };

    loadTestDataState();
  }, []);

  const handleToggleTestData = async (enabled: boolean) => {
    setIsLoading(true);
    try {
      if (enabled) {
        // Enable test data and apply it
        await testDataStorage.enableTestData(profileType);
        const testProfile = generateTestProfile(profileType);
        
        // Apply the test data to the UI
        onApplyTestData(testProfile);
        
        // Save the profile to storage immediately to ensure it's persisted
        if (onSaveProfile) {
          await onSaveProfile(testProfile);
        }
      } else {
        // Disable test data and clear profile
        await testDataStorage.disableTestData();
        onClearTestData();
      }
      setIsTestDataEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle test data:', error);
      // Reset the toggle state on error
      setIsTestDataEnabled(!enabled);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileTypeChange = async (newType: TestDataConfig['profileType']) => {
    setIsLoading(true);
    try {
      await testDataStorage.setProfileType(newType);
      setProfileType(newType);
      
      // If test data is currently enabled, apply the new profile type
      if (isTestDataEnabled) {
        const testProfile = generateTestProfile(newType);
        onApplyTestData(testProfile);
      }
    } catch (error) {
      console.error('Failed to change profile type:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTestProfile = (type: TestDataConfig['profileType']): UserProfile => {
    if (type === 'default') {
      return generateSampleUserProfile();
    } else {
      const alternatives = generateAlternativeSampleProfiles();
      return alternatives[type] || generateSampleUserProfile();
    }
  };

  const handleQuickApply = async () => {
    setIsLoading(true);
    try {
      const testProfile = generateTestProfile(profileType);
      
      // Apply the test data to the UI
      onApplyTestData(testProfile);
      
      // Save the profile to storage immediately to ensure it's persisted
      if (onSaveProfile) {
        await onSaveProfile(testProfile);
      }
      
      // Enable test data mode if not already enabled
      if (!isTestDataEnabled) {
        await testDataStorage.enableTestData(profileType);
        setIsTestDataEnabled(true);
      }
    } catch (error) {
      console.error('Failed to apply test data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSampleResume = () => {
    try {
      downloadSampleResume(profileType);
    } catch (error) {
      console.error('Failed to download sample resume:', error);
    }
  };

  const handleDownloadSampleCoverLetter = () => {
    try {
      const blob = createSampleCoverLetterBlob(profileType);
      const url = URL.createObjectURL(blob);
      
      const profileNames = {
        default: 'john_doe',
        'frontend-developer': 'sarah_chen',
        'backend-developer': 'michael_rodriguez',
      };
      
      const fileName = `${profileNames[profileType]}_sample_cover_letter.txt`;
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL object
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download sample cover letter:', error);
    }
  };

  const profileTypeOptions = [
    { value: 'default', label: 'Full Stack Developer', description: 'Comprehensive profile with diverse skills' },
    { value: 'frontend-developer', label: 'Frontend Developer', description: 'UI/UX focused with React and design skills' },
    { value: 'backend-developer', label: 'Backend Developer', description: 'Server-side focused with Python and cloud skills' },
  ] as const;

  return (
    <div className={`bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-1">
            Test Data Mode
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Use sample profile data for testing and demonstration purposes
          </p>
        </div>
        
        {isTestDataEnabled && (
          <div className="flex items-center space-x-2 bg-blue-100 dark:bg-blue-800 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
              Test Data Active
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Main Toggle */}
        <Switch
          checked={isTestDataEnabled}
          onChange={handleToggleTestData}
          disabled={isLoading}
          label="Use Test Data"
          description={isTestDataEnabled 
            ? "Test data is currently active. Your profile will be replaced with sample data."
            : "Enable to populate your profile with realistic sample data for testing."
          }
        />

        {/* Profile Type Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            Profile Type
          </label>
          <div className="grid grid-cols-1 gap-3">
            {profileTypeOptions.map((option) => (
              <label
                key={option.value}
                className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                  profileType === option.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <input
                  type="radio"
                  name="profileType"
                  value={option.value}
                  checked={profileType === option.value}
                  onChange={(e) => handleProfileTypeChange(e.target.value as TestDataConfig['profileType'])}
                  disabled={isLoading}
                  className="sr-only"
                />
                <div className="flex flex-1">
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      profileType === option.value
                        ? 'border-blue-500'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {profileType === option.value && (
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <span className={`block text-sm font-medium ${
                      profileType === option.value
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {option.label}
                    </span>
                    <span className={`block text-sm ${
                      profileType === option.value
                        ? 'text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {option.description}
                    </span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <div className="flex space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickApply}
              disabled={isLoading}
              loading={isLoading}
            >
              Apply Test Data
            </Button>
            
            {isTestDataEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggleTestData(false)}
                disabled={isLoading}
              >
                Clear Test Data
              </Button>
            )}
          </div>

          {/* Sample File Downloads */}
          <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Sample Files for Testing
            </h4>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSampleResume}
                disabled={isLoading}
              >
                Download Sample Resume
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSampleCoverLetter}
                disabled={isLoading}
              >
                Download Sample Cover Letter
              </Button>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Use these sample files to test resume upload and file attachment functionality
            </p>
          </div>
        </div>

        {/* Warning Message */}
        {isTestDataEnabled && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Warning:</strong> Test data will replace your current profile information. 
                  Make sure to save any important data before enabling test mode.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};