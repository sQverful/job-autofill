import React, { useState } from 'react';
import { Button, cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { UserProfile, ProfileValidationError } from '@extension/shared';

interface DefaultAnswersFormProps {
  profile: UserProfile;
  errors: ProfileValidationError[];
  onChange: (updates: Partial<UserProfile['preferences']>) => void;
}

export const DefaultAnswersForm: React.FC<DefaultAnswersFormProps> = ({
  profile,
  errors,
  onChange,
}) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  const handleAddAnswer = () => {
    if (newQuestion.trim() && newAnswer.trim()) {
      const updatedAnswers = {
        ...profile.preferences.defaultAnswers,
        [newQuestion.trim()]: newAnswer.trim(),
      };
      
      onChange({
        defaultAnswers: updatedAnswers,
      });
      
      setNewQuestion('');
      setNewAnswer('');
    }
  };

  const handleRemoveAnswer = (question: string) => {
    const updatedAnswers = { ...profile.preferences.defaultAnswers };
    delete updatedAnswers[question];
    
    onChange({
      defaultAnswers: updatedAnswers,
    });
  };

  const handleJobPreferenceChange = (field: string, value: any) => {
    onChange({
      jobPreferences: {
        ...profile.preferences.jobPreferences,
        [field]: value,
      },
    });
  };

  const commonQuestions = [
    'Why are you interested in this position?',
    'Why do you want to work for this company?',
    'What are your salary expectations?',
    'When can you start?',
    'Are you willing to relocate?',
    'Do you require visa sponsorship?',
    'What is your notice period?',
    'Tell us about yourself',
    'What are your career goals?',
    'Why are you leaving your current job?',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className={cn(
          'text-lg font-medium mb-4',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>
          Default Answers & Preferences
        </h3>
        <p className={cn(
          'text-sm mb-6',
          isLight ? 'text-gray-600' : 'text-gray-400'
        )}>
          Set up default answers for common application questions and configure your job preferences.
        </p>
      </div>

      {/* Job Preferences */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Job Preferences
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Work Authorization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Work Authorization Status
            </label>
            <select
              value={profile.preferences.jobPreferences.workAuthorization}
              onChange={(e) => handleJobPreferenceChange('workAuthorization', e.target.value)}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              )}
            >
              <option value="citizen">US Citizen</option>
              <option value="permanent_resident">Permanent Resident</option>
              <option value="visa_holder">Visa Holder</option>
              <option value="requires_sponsorship">Requires Sponsorship</option>
            </select>
          </div>

          {/* Preferred Work Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preferred Work Type
            </label>
            <select
              value={profile.preferences.jobPreferences.preferredWorkType}
              onChange={(e) => handleJobPreferenceChange('preferredWorkType', e.target.value)}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              )}
            >
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
              <option value="flexible">Flexible</option>
            </select>
          </div>

          {/* Willing to Relocate */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={profile.preferences.jobPreferences.willingToRelocate}
                onChange={(e) => handleJobPreferenceChange('willingToRelocate', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Willing to relocate
              </span>
            </label>
          </div>

          {/* Requires Sponsorship */}
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={profile.preferences.jobPreferences.requiresSponsorship}
                onChange={(e) => handleJobPreferenceChange('requiresSponsorship', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Requires visa sponsorship
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Default Answers */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Default Answers
        </h4>
        
        {/* Add New Answer */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Question
            </label>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Enter a common application question"
              className={cn(
                'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              )}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Answer
            </label>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Enter your default answer for this question"
              rows={3}
              className={cn(
                'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              )}
            />
          </div>
          
          <Button
            onClick={handleAddAnswer}
            disabled={!newQuestion.trim() || !newAnswer.trim()}
            size="sm"
          >
            Add Default Answer
          </Button>
        </div>

        {/* Common Questions Quick Add */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quick add common questions:
          </p>
          <div className="flex flex-wrap gap-2">
            {commonQuestions
              .filter(q => !profile.preferences.defaultAnswers[q])
              .slice(0, 5)
              .map((question) => (
                <button
                  key={question}
                  onClick={() => setNewQuestion(question)}
                  className={cn(
                    'px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md',
                    'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  )}
                >
                  {question}
                </button>
              ))}
          </div>
        </div>

        {/* Existing Answers */}
        {Object.keys(profile.preferences.defaultAnswers).length > 0 ? (
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Default Answers ({Object.keys(profile.preferences.defaultAnswers).length})
            </h5>
            
            {Object.entries(profile.preferences.defaultAnswers).map(([question, answer]) => (
              <div
                key={question}
                className={cn(
                  'p-4 border border-gray-200 dark:border-gray-700 rounded-lg',
                  'bg-gray-50 dark:bg-gray-800'
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <h6 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {question}
                  </h6>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveAnswer(question)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Remove
                  </Button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {answer}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className={cn(
            'border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center'
          )}>
            <p className="text-gray-500 dark:text-gray-400">
              No default answers set up yet. Add answers to common questions to speed up applications.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};