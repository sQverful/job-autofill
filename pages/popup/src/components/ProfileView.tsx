import React from 'react';
import { Button, cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { UserProfile } from '@extension/shared';

interface ProfileViewProps {
  profile: UserProfile;
  onEdit: () => void;
  onExport: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onEdit, onExport }) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const personalInfo = profile.personalInfo;
  const workInfo = profile.workInfo;
  const preferences = profile.preferences;

  const getCompletionPercentage = () => {
    const fields = [
      personalInfo.firstName,
      personalInfo.lastName,
      personalInfo.email,
      personalInfo.phone,
      personalInfo.address.street,
      personalInfo.address.city,
      personalInfo.address.state,
      personalInfo.address.zipCode,
      workInfo?.currentTitle,
      workInfo?.experience,
      workInfo?.summary,
      preferences.workAuthorization,
      preferences.desiredSalary,
      preferences.availableStartDate,
    ];
    
    const filledFields = fields.filter(field => field && field.trim() !== '').length;
    const skillsBonus = (workInfo?.skills && workInfo.skills.length > 0) ? 1 : 0;
    const urlsBonus = [personalInfo.linkedInUrl, personalInfo.portfolioUrl, personalInfo.githubUrl]
      .filter(url => url && url.trim() !== '').length * 0.5;
    
    const totalScore = filledFields + skillsBonus + urlsBonus;
    const maxScore = fields.length + 1 + 1.5; // +1 for skills, +1.5 for URLs
    
    return Math.round((totalScore / maxScore) * 100);
  };

  const completionPercentage = getCompletionPercentage();

  return (
    <div className="space-y-4">
      {/* Profile Completion Status */}
      <div className={cn(
        'rounded-lg p-3 border',
        isLight 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200' 
          : 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-700'
      )}>
        <div className="flex items-center justify-between mb-2">
          <h3 className={cn(
            'text-sm font-medium',
            isLight ? 'text-blue-900' : 'text-blue-100'
          )}>Profile Completion</h3>
          <span className={cn(
            'text-sm font-semibold',
            isLight ? 'text-blue-700' : 'text-blue-300'
          )}>{completionPercentage}%</span>
        </div>
        <div className={cn(
          'w-full rounded-full h-2',
          isLight ? 'bg-blue-200' : 'bg-blue-800'
        )}>
          <div 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionPercentage}%` }}
          ></div>
        </div>
        {completionPercentage < 100 && (
          <p className={cn(
            'text-xs mt-1',
            isLight ? 'text-blue-600' : 'text-blue-300'
          )}>
            Complete your profile for better autofill results
          </p>
        )}
      </div>

      {/* Personal Info */}
      <div className={cn(
        'rounded-lg p-3 border',
        isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <h3 className={cn(
          'text-sm font-medium mb-2 flex items-center',
          isLight ? 'text-gray-700' : 'text-gray-200'
        )}>
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          Personal Information
        </h3>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Name:</strong> 
            <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>{personalInfo.firstName} {personalInfo.lastName}</span>
          </div>
          <div className="flex justify-between">
            <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Email:</strong> 
            <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>{personalInfo.email}</span>
          </div>
          <div className="flex justify-between">
            <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Phone:</strong> 
            <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>{personalInfo.phone}</span>
          </div>
          <div className="flex justify-between">
            <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Address:</strong> 
            <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>
              {personalInfo.address.street && `${personalInfo.address.street}, `}
              {personalInfo.address.city && personalInfo.address.state 
                ? `${personalInfo.address.city}, ${personalInfo.address.state} ${personalInfo.address.zipCode}`.trim()
                : 'Not specified'
              }
            </span>
          </div>
          {personalInfo.linkedInUrl && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>LinkedIn:</strong> 
              <a 
                href={personalInfo.linkedInUrl} 
                className={cn(
                  'hover:underline transition-colors',
                  isLight ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'
                )}
                target="_blank" 
                rel="noopener noreferrer"
              >
                Profile
              </a>
            </div>
          )}
          {personalInfo.portfolioUrl && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Portfolio:</strong> 
              <a 
                href={personalInfo.portfolioUrl} 
                className={cn(
                  'hover:underline transition-colors',
                  isLight ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'
                )}
                target="_blank" 
                rel="noopener noreferrer"
              >
                Website
              </a>
            </div>
          )}
          {personalInfo.githubUrl && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>GitHub:</strong> 
              <a 
                href={personalInfo.githubUrl} 
                className={cn(
                  'hover:underline transition-colors',
                  isLight ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'
                )}
                target="_blank" 
                rel="noopener noreferrer"
              >
                Profile
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Work Info */}
      <div className={cn(
        'rounded-lg p-3 border',
        isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <h3 className={cn(
          'text-sm font-medium mb-2 flex items-center',
          isLight ? 'text-gray-700' : 'text-gray-200'
        )}>
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          Work Information
        </h3>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Title:</strong> 
            <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>{workInfo?.currentTitle || 'Not specified'}</span>
          </div>
          <div className="flex justify-between">
            <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Experience:</strong> 
            <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>{workInfo?.experience || 'Not specified'}</span>
          </div>
          {workInfo?.summary && (
            <div className="pt-1">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Summary:</strong>
              <p className={cn(
                'mt-1 text-xs leading-relaxed',
                isLight ? 'text-gray-800' : 'text-gray-200'
              )}>
                {workInfo.summary.length > 100 
                  ? `${workInfo.summary.substring(0, 100)}...` 
                  : workInfo.summary
                }
              </p>
            </div>
          )}
          {workInfo?.skills && workInfo.skills.length > 0 && (
            <div className="pt-1">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Skills:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {workInfo.skills.slice(0, 4).map((skill, index) => (
                  <span 
                    key={index}
                    className={cn(
                      'inline-block text-xs px-2 py-0.5 rounded-full',
                      isLight ? 'bg-blue-100 text-blue-800' : 'bg-blue-900/50 text-blue-300'
                    )}
                  >
                    {skill}
                  </span>
                ))}
                {workInfo.skills.length > 4 && (
                  <span className={cn(
                    'inline-block text-xs px-2 py-0.5 rounded-full',
                    isLight ? 'bg-gray-100 text-gray-600' : 'bg-gray-700 text-gray-300'
                  )}>
                    +{workInfo.skills.length - 4} more
                  </span>
                )}
              </div>
            </div>
          )}
          {workInfo?.linkedinUrl && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>LinkedIn:</strong> 
              <a 
                href={workInfo.linkedinUrl} 
                className={cn(
                  'hover:underline transition-colors',
                  isLight ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'
                )}
                target="_blank" 
                rel="noopener noreferrer"
              >
                Profile
              </a>
            </div>
          )}
          {workInfo?.portfolioUrl && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Portfolio:</strong> 
              <a 
                href={workInfo.portfolioUrl} 
                className={cn(
                  'hover:underline transition-colors',
                  isLight ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'
                )}
                target="_blank" 
                rel="noopener noreferrer"
              >
                Website
              </a>
            </div>
          )}
          {workInfo?.githubUrl && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>GitHub:</strong> 
              <a 
                href={workInfo.githubUrl} 
                className={cn(
                  'hover:underline transition-colors',
                  isLight ? 'text-blue-600 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'
                )}
                target="_blank" 
                rel="noopener noreferrer"
              >
                Profile
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className={cn(
        'rounded-lg p-3 border',
        isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <h3 className={cn(
          'text-sm font-medium mb-2 flex items-center',
          isLight ? 'text-gray-700' : 'text-gray-200'
        )}>
          <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
          Job Preferences
        </h3>
        <div className="space-y-1 text-xs">
          {preferences.desiredSalary && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Salary:</strong> 
              <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>{preferences.desiredSalary}</span>
            </div>
          )}
          {preferences.availableStartDate && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Start Date:</strong> 
              <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>{preferences.availableStartDate}</span>
            </div>
          )}
          {preferences.workAuthorization && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Authorization:</strong> 
              <span className={cn(isLight ? 'text-gray-800' : 'text-gray-200')}>{preferences.workAuthorization}</span>
            </div>
          )}
          {preferences.jobPreferences?.preferredWorkType && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Work Type:</strong> 
              <span className={cn(
                'capitalize',
                isLight ? 'text-gray-800' : 'text-gray-200'
              )}>{preferences.jobPreferences.preferredWorkType}</span>
            </div>
          )}
          <div className="flex justify-between">
            <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Relocate:</strong> 
            <span className={cn(
              'text-xs font-medium',
              preferences.willingToRelocate 
                ? (isLight ? 'text-green-600' : 'text-green-400')
                : (isLight ? 'text-gray-600' : 'text-gray-400')
            )}>
              {preferences.willingToRelocate ? 'Yes' : 'No'}
            </span>
          </div>
          {preferences.jobPreferences?.requiresSponsorship && (
            <div className="flex justify-between">
              <strong className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>Sponsorship:</strong> 
              <span className={cn(
                'text-xs font-medium',
                isLight ? 'text-orange-600' : 'text-orange-400'
              )}>Required</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-2 pt-2">
        <Button
          onClick={onEdit}
          variant="primary"
          className="flex-1 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          Edit Profile
        </Button>
        <Button
          onClick={onExport}
          variant="outline"
          className="flex-1 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          Export
        </Button>
      </div>
    </div>
  );
};