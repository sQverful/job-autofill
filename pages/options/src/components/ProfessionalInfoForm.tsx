import React, { useState } from 'react';
import { Button, cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { UserProfile, ProfileValidationError, WorkExperience, Education } from '@extension/shared';

interface ProfessionalInfoFormProps {
  profile: UserProfile;
  errors: ProfileValidationError[];
  onChange: (updates: Partial<UserProfile['professionalInfo']>) => void;
}

export const ProfessionalInfoForm: React.FC<ProfessionalInfoFormProps> = ({
  profile,
  errors,
  onChange,
}) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [skillInput, setSkillInput] = useState('');

  const handleSummaryChange = (summary: string) => {
    onChange({ summary });
  };

  const handleSkillAdd = () => {
    if (skillInput.trim() && !profile.professionalInfo.skills.includes(skillInput.trim())) {
      onChange({
        skills: [...profile.professionalInfo.skills, skillInput.trim()],
      });
      setSkillInput('');
    }
  };

  const handleSkillRemove = (skillToRemove: string) => {
    onChange({
      skills: profile.professionalInfo.skills.filter(skill => skill !== skillToRemove),
    });
  };

  const handleSkillKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSkillAdd();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className={cn(
          'text-lg font-medium mb-4',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>
          Professional Information
        </h3>
        <p className={cn(
          'text-sm mb-6',
          isLight ? 'text-gray-600' : 'text-gray-400'
        )}>
          Add your professional background, skills, and experience.
        </p>
      </div>

      {/* Professional Summary */}
      <div>
        <label className={cn(
          'block text-sm font-medium mb-2',
          isLight ? 'text-gray-700' : 'text-gray-300'
        )}>
          Professional Summary
        </label>
        <textarea
          value={profile.professionalInfo.summary || ''}
          onChange={(e) => handleSummaryChange(e.target.value)}
          placeholder="Write a brief summary of your professional background and career objectives..."
          rows={4}
          className={cn(
            'w-full px-3 py-2 border rounded-md shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            isLight 
              ? 'border-gray-300 bg-white text-gray-900' 
              : 'border-gray-600 bg-gray-700 text-gray-100'
          )}
        />
        <p className={cn(
          'mt-1 text-sm',
          isLight ? 'text-gray-500' : 'text-gray-400'
        )}>
          This will be used for cover letters and summary fields in applications.
        </p>
      </div>

      {/* Skills */}
      <div>
        <label className={cn(
          'block text-sm font-medium mb-2',
          isLight ? 'text-gray-700' : 'text-gray-300'
        )}>
          Skills
        </label>
        <div className="flex space-x-2 mb-3">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyPress={handleSkillKeyPress}
            placeholder="Add a skill (e.g., JavaScript, Project Management)"
            className={cn(
              'flex-1 px-3 py-2 border rounded-md shadow-sm transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
              isLight 
                ? 'border-gray-300 bg-white text-gray-900' 
                : 'border-gray-600 bg-gray-700 text-gray-100'
            )}
          />
          <Button
            onClick={handleSkillAdd}
            disabled={!skillInput.trim()}
            size="sm"
          >
            Add
          </Button>
        </div>
        
        {profile.professionalInfo.skills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {profile.professionalInfo.skills.map((skill, index) => (
              <span
                key={index}
                className={cn(
                  'inline-flex items-center px-3 py-1 rounded-full text-sm',
                  isLight 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-blue-900 text-blue-200'
                )}
              >
                {skill}
                <button
                  onClick={() => handleSkillRemove(skill)}
                  className={cn(
                    'ml-2 transition-colors',
                    isLight 
                      ? 'text-blue-600 hover:text-blue-800' 
                      : 'text-blue-300 hover:text-blue-100'
                  )}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        
        {profile.professionalInfo.skills.length === 0 && (
          <p className={cn(
            'text-sm',
            isLight ? 'text-gray-500' : 'text-gray-400'
          )}>
            No skills added yet. Add relevant skills to improve autofill accuracy.
          </p>
        )}
      </div>

      {/* Work Experience Placeholder */}
      <div>
        <h4 className={cn(
          'text-md font-medium mb-2',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>
          Work Experience
        </h4>
        <div className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center',
          isLight ? 'border-gray-300' : 'border-gray-600'
        )}>
          <p className={cn(
            'mb-2',
            isLight ? 'text-gray-500' : 'text-gray-400'
          )}>
            Work experience management coming soon
          </p>
          <p className={cn(
            'text-sm',
            isLight ? 'text-gray-400' : 'text-gray-500'
          )}>
            For now, you can upload a resume to automatically extract work experience
          </p>
        </div>
      </div>

      {/* Education Placeholder */}
      <div>
        <h4 className={cn(
          'text-md font-medium mb-2',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>
          Education
        </h4>
        <div className={cn(
          'border-2 border-dashed rounded-lg p-6 text-center',
          isLight ? 'border-gray-300' : 'border-gray-600'
        )}>
          <p className={cn(
            'mb-2',
            isLight ? 'text-gray-500' : 'text-gray-400'
          )}>
            Education management coming soon
          </p>
          <p className={cn(
            'text-sm',
            isLight ? 'text-gray-400' : 'text-gray-500'
          )}>
            For now, you can upload a resume to automatically extract education information
          </p>
        </div>
      </div>
    </div>
  );
};