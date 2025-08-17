import React, { useState } from 'react';
import { Input, FormField, Textarea, Button, Select } from '@extension/ui';
import type { UserProfile, ValidationError } from '@extension/shared';

interface DefaultAnswersFormProps {
  profile: UserProfile;
  errors: ValidationError[];
  onChange: (updates: Partial<UserProfile['preferences']>) => void;
}

const commonQuestions = [
  'Why are you interested in this position?',
  'Why do you want to work for our company?',
  'What are your salary expectations?',
  'When can you start?',
  'Are you willing to relocate?',
  'Do you require visa sponsorship?',
  'What is your preferred work arrangement?',
  'Tell us about yourself',
  'What are your career goals?',
  'Why are you leaving your current job?',
];

const workAuthorizationOptions = [
  { value: 'citizen', label: 'US Citizen' },
  { value: 'permanent_resident', label: 'Permanent Resident' },
  { value: 'work_visa', label: 'Work Visa (H1B, L1, etc.)' },
  { value: 'student_visa', label: 'Student Visa (F1 with OPT/CPT)' },
  { value: 'other', label: 'Other' },
];

const workTypeOptions = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
  { value: 'flexible', label: 'Flexible' },
];

export const DefaultAnswersForm: React.FC<DefaultAnswersFormProps> = ({
  profile,
  errors,
  onChange,
}) => {
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const handleJobPreferenceChange = (field: keyof UserProfile['preferences']['jobPreferences'], value: any) => {
    onChange({
      jobPreferences: {
        ...profile.preferences.jobPreferences,
        [field]: value,
      },
    });
  };

  const handlePrivacySettingChange = (field: keyof UserProfile['preferences']['privacySettings'], value: boolean) => {
    onChange({
      privacySettings: {
        ...profile.preferences.privacySettings,
        [field]: value,
      },
    });
  };

  const handleAddDefaultAnswer = () => {
    if (newQuestion.trim() && newAnswer.trim()) {
      onChange({
        defaultAnswers: {
          ...profile.preferences.defaultAnswers,
          [newQuestion.trim()]: newAnswer.trim(),
        },
      });
      setNewQuestion('');
      setNewAnswer('');
    }
  };

  const handleUpdateDefaultAnswer = (question: string, answer: string) => {
    onChange({
      defaultAnswers: {
        ...profile.preferences.defaultAnswers,
        [question]: answer,
      },
    });
  };

  const handleRemoveDefaultAnswer = (question: string) => {
    const updatedAnswers = { ...profile.preferences.defaultAnswers };
    delete updatedAnswers[question];
    onChange({ defaultAnswers: updatedAnswers });
  };

  const handleAddCommonQuestion = (question: string) => {
    if (!profile.preferences.defaultAnswers[question]) {
      onChange({
        defaultAnswers: {
          ...profile.preferences.defaultAnswers,
          [question]: '',
        },
      });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Default Answers & Preferences
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Set up default answers for common application questions and configure your job preferences.
        </p>
      </div>

      {/* Job Preferences */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Job Preferences
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Work Authorization Status"
            error={getFieldError('preferences.jobPreferences.workAuthorization')}
            required
          >
            <Select
              value={profile.preferences.jobPreferences.workAuthorization}
              onChange={(e) => handleJobPreferenceChange('workAuthorization', e.target.value)}
              options={workAuthorizationOptions}
            />
          </FormField>

          <FormField
            label="Preferred Work Type"
            error={getFieldError('preferences.jobPreferences.preferredWorkType')}
          >
            <Select
              value={profile.preferences.jobPreferences.preferredWorkType}
              onChange={(e) => handleJobPreferenceChange('preferredWorkType', e.target.value)}
              options={workTypeOptions}
            />
          </FormField>

          <FormField
            label="Available Start Date"
            error={getFieldError('preferences.jobPreferences.availableStartDate')}
          >
            <Input
              type="date"
              value={profile.preferences.jobPreferences.availableStartDate.toISOString().split('T')[0]}
              onChange={(e) => handleJobPreferenceChange('availableStartDate', new Date(e.target.value))}
            />
          </FormField>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="requiresSponsorship"
                checked={profile.preferences.jobPreferences.requiresSponsorship}
                onChange={(e) => handleJobPreferenceChange('requiresSponsorship', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="requiresSponsorship" className="text-sm text-gray-700 dark:text-gray-300">
                Requires visa sponsorship
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="willingToRelocate"
                checked={profile.preferences.jobPreferences.willingToRelocate}
                onChange={(e) => handleJobPreferenceChange('willingToRelocate', e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="willingToRelocate" className="text-sm text-gray-700 dark:text-gray-300">
                Willing to relocate
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Common Questions Quick Add */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Common Application Questions
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Click to add common questions to your default answers:
        </p>
        <div className="flex flex-wrap gap-2">
          {commonQuestions.map((question) => (
            <button
              key={question}
              onClick={() => handleAddCommonQuestion(question)}
              disabled={!!profile.preferences.defaultAnswers[question]}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                profile.preferences.defaultAnswers[question]
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600 dark:border-gray-700'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
              }`}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Default Answers */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Default Answers
        </h4>
        
        {/* Add New Answer */}
        <div className="space-y-4 mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Add New Default Answer
          </h5>
          <FormField label="Question">
            <Input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Enter the question..."
            />
          </FormField>
          <FormField label="Your Answer">
            <Textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Enter your default answer..."
              rows={3}
            />
          </FormField>
          <Button
            onClick={handleAddDefaultAnswer}
            disabled={!newQuestion.trim() || !newAnswer.trim()}
          >
            Add Answer
          </Button>
        </div>

        {/* Existing Answers */}
        <div className="space-y-4">
          {Object.entries(profile.preferences.defaultAnswers).map(([question, answer]) => (
            <div key={question} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {question}
                </h5>
                <Button
                  onClick={() => handleRemoveDefaultAnswer(question)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remove
                </Button>
              </div>
              <Textarea
                value={answer}
                onChange={(e) => handleUpdateDefaultAnswer(question, e.target.value)}
                placeholder="Enter your answer..."
                rows={3}
              />
            </div>
          ))}
          
          {Object.keys(profile.preferences.defaultAnswers).length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No default answers configured yet.</p>
              <p className="text-sm">Add answers to common questions to speed up your applications.</p>
            </div>
          )}
        </div>
      </div>

      {/* Privacy Settings */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Privacy Settings
        </h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Share Analytics Data
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Help improve the extension by sharing anonymous usage data
              </p>
            </div>
            <input
              type="checkbox"
              checked={profile.preferences.privacySettings.shareAnalytics}
              onChange={(e) => handlePrivacySettingChange('shareAnalytics', e.target.checked)}
              className="ml-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Share Usage Data
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Share how you use features to help us improve the extension
              </p>
            </div>
            <input
              type="checkbox"
              checked={profile.preferences.privacySettings.shareUsageData}
              onChange={(e) => handlePrivacySettingChange('shareUsageData', e.target.checked)}
              className="ml-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Allow AI Content Generation
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable AI-powered content suggestions and improvements
              </p>
            </div>
            <input
              type="checkbox"
              checked={profile.preferences.privacySettings.allowAIContentGeneration}
              onChange={(e) => handlePrivacySettingChange('allowAIContentGeneration', e.target.checked)}
              className="ml-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Data Sync
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Sync your profile across devices (requires account)
              </p>
            </div>
            <input
              type="checkbox"
              checked={profile.preferences.privacySettings.dataSyncEnabled}
              onChange={(e) => handlePrivacySettingChange('dataSyncEnabled', e.target.checked)}
              className="ml-4"
            />
          </div>
        </div>
      </div>
    </div>
  );
};