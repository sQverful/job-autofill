import React, { useEffect, useState } from 'react';
import { Button, LoadingSpinner, cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { UserProfile } from '@extension/shared';

interface ProfileFormProps {
  profile: UserProfile | null;
  onSave: (profile: UserProfile) => Promise<void>;
  onCancel?: () => void;
}

const defaultProfile: UserProfile = {
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
  workInfo: {
    currentTitle: '',
    experience: '',
    skills: [],
    linkedinUrl: '',
    portfolioUrl: '',
    githubUrl: '',
    workExperience: [],
    summary: '',
  },
  professionalInfo: {
    workExperience: [],
    education: [],
    skills: [],
    certifications: [],
    summary: '',
  },
  preferences: {
    desiredSalary: '',
    availableStartDate: '',
    workAuthorization: '',
    willingToRelocate: false,
    defaultAnswers: {},
    jobPreferences: {
      workAuthorization: 'citizen',
      requiresSponsorship: false,
      willingToRelocate: false,
      availableStartDate: new Date(),
      preferredWorkType: 'remote',
    },
    privacySettings: {
      shareAnalytics: false,
      shareUsageData: false,
      allowAIContentGeneration: false,
      dataSyncEnabled: false,
    },
    aiPreferences: {
      preferredTone: 'professional',
      customInstructions: '',
      excludedFields: [],
      learningEnabled: true,
      fieldMappingPreferences: {},
      autoApproveInstructions: false,
      maxInstructionsPerForm: 5,
      confidenceThreshold: 0.8,
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
};

export const ProfileForm: React.FC<ProfileFormProps> = ({ profile, onSave, onCancel }) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [formData, setFormData] = useState<UserProfile>(() => {
    if (profile) {
      return {
        ...defaultProfile,
        ...profile,
        personalInfo: { ...defaultProfile.personalInfo, ...profile.personalInfo },
        workInfo: { ...defaultProfile.workInfo, ...profile.workInfo },
        preferences: { ...defaultProfile.preferences, ...profile.preferences },
      };
    }
    return defaultProfile;
  });

  const [activeSection, setActiveSection] = useState<'personal' | 'work' | 'preferences'>('personal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form data when profile prop changes
  useEffect(() => {
    if (profile) {
      setFormData({
        ...defaultProfile,
        ...profile,
        personalInfo: { ...defaultProfile.personalInfo, ...profile.personalInfo },
        workInfo: { ...defaultProfile.workInfo, ...profile.workInfo },
        preferences: { ...defaultProfile.preferences, ...profile.preferences },
      });
    } else {
      setFormData(defaultProfile);
    }
  }, [profile]);

  const handleInputChange = (
    section: 'personalInfo' | 'workInfo' | 'preferences',
    field: string,
    value: string | boolean,
  ) => {
    setFormData(prev => {
      const next = { ...prev };

      if (section === 'personalInfo') {
        if (field.startsWith('address.')) {
          const addressField = field.replace('address.', '');
          next.personalInfo.address = {
            ...next.personalInfo.address,
            [addressField]: value as string,
          };
        } else {
          (next.personalInfo as any)[field] = value;
        }
      } else if (section === 'workInfo') {
        if (field === 'skills' && typeof value === 'string') {
          // handled by handleSkillsChange
        } else {
          (next.workInfo as any)[field] = value;
        }
      } else {
        // preferences
        (next.preferences as any)[field] = value;
      }

      return next;
    });
  };

  const handleSkillsChange = (skills: string) => {
    const skillsArray = skills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    setFormData(prev => ({ 
      ...prev, 
      workInfo: { 
        ...prev.workInfo!, 
        skills: skillsArray 
      },
      professionalInfo: {
        ...prev.professionalInfo,
        skills: skillsArray
      }
    }));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const profileToSave = {
        ...formData,
        metadata: {
          ...formData.metadata,
          updatedAt: new Date(),
        },
      };
      await onSave(profileToSave);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClassName = () => cn(
    'rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors',
    isLight 
      ? 'border-gray-300 bg-white text-gray-900 focus:border-blue-500' 
      : 'border-gray-600 bg-gray-800 text-gray-100 focus:border-blue-400'
  );

  const renderPersonalInfo = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="First Name"
          value={formData.personalInfo.firstName}
          onChange={e => handleInputChange('personalInfo', 'firstName', e.target.value)}
          className={getInputClassName()}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={formData.personalInfo.lastName}
          onChange={e => handleInputChange('personalInfo', 'lastName', e.target.value)}
          className={getInputClassName()}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="email"
          placeholder="Email"
          value={formData.personalInfo.email}
          onChange={e => handleInputChange('personalInfo', 'email', e.target.value)}
          className={getInputClassName()}
        />
        <input
          type="tel"
          placeholder="Phone"
          value={formData.personalInfo.phone}
          onChange={e => handleInputChange('personalInfo', 'phone', e.target.value)}
          className={getInputClassName()}
        />
      </div>
      <input
        type="text"
        placeholder="Street Address"
        value={formData.personalInfo.address.street}
        onChange={e => handleInputChange('personalInfo', 'address.street', e.target.value)}
        className={cn(getInputClassName(), 'w-full')}
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="City"
          value={formData.personalInfo.address.city}
          onChange={e => handleInputChange('personalInfo', 'address.city', e.target.value)}
          className={getInputClassName()}
        />
        <input
          type="text"
          placeholder="State"
          value={formData.personalInfo.address.state}
          onChange={e => handleInputChange('personalInfo', 'address.state', e.target.value)}
          className={getInputClassName()}
        />
        <input
          type="text"
          placeholder="ZIP"
          value={formData.personalInfo.address.zipCode}
          onChange={e => handleInputChange('personalInfo', 'address.zipCode', e.target.value)}
          className={getInputClassName()}
        />
      </div>
      <input
        type="text"
        placeholder="Country"
        value={formData.personalInfo.address.country}
        onChange={e => handleInputChange('personalInfo', 'address.country', e.target.value)}
        className={cn(getInputClassName(), 'w-full')}
      />
      <div className="space-y-2">
        <input
          type="url"
          placeholder="LinkedIn URL"
          value={formData.personalInfo.linkedInUrl || ''}
          onChange={e => handleInputChange('personalInfo', 'linkedInUrl', e.target.value)}
          className={cn(getInputClassName(), 'w-full')}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="url"
            placeholder="Portfolio URL"
            value={formData.personalInfo.portfolioUrl || ''}
            onChange={e => handleInputChange('personalInfo', 'portfolioUrl', e.target.value)}
            className={getInputClassName()}
          />
          <input
            type="url"
            placeholder="GitHub URL"
            value={formData.personalInfo.githubUrl || ''}
            onChange={e => handleInputChange('personalInfo', 'githubUrl', e.target.value)}
            className={getInputClassName()}
          />
        </div>
      </div>
    </div>
  );

  const renderWorkInfo = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Current Job Title"
          value={formData.workInfo?.currentTitle || ''}
          onChange={e => handleInputChange('workInfo', 'currentTitle', e.target.value)}
          className={getInputClassName()}
        />
        <input
          type="text"
          placeholder="Years of Experience"
          value={formData.workInfo?.experience || ''}
          onChange={e => handleInputChange('workInfo', 'experience', e.target.value)}
          className={getInputClassName()}
        />
      </div>
      <textarea
        placeholder="Professional Summary (brief overview of your background)"
        value={formData.workInfo?.summary || ''}
        onChange={e => handleInputChange('workInfo', 'summary', e.target.value)}
        className={cn(getInputClassName(), 'w-full resize-none')}
        rows={3}
      />
      <textarea
        placeholder="Skills (comma-separated, e.g., JavaScript, React, Node.js)"
        value={formData.workInfo?.skills?.join(', ') || ''}
        onChange={e => handleSkillsChange(e.target.value)}
        className={cn(getInputClassName(), 'w-full resize-none')}
        rows={2}
      />
      <input
        type="url"
        placeholder="LinkedIn URL"
        value={formData.workInfo?.linkedinUrl || ''}
        onChange={e => handleInputChange('workInfo', 'linkedinUrl', e.target.value)}
        className={cn(getInputClassName(), 'w-full')}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="url"
          placeholder="Portfolio URL"
          value={formData.workInfo?.portfolioUrl || ''}
          onChange={e => handleInputChange('workInfo', 'portfolioUrl', e.target.value)}
          className={getInputClassName()}
        />
        <input
          type="url"
          placeholder="GitHub URL"
          value={formData.workInfo?.githubUrl || ''}
          onChange={e => handleInputChange('workInfo', 'githubUrl', e.target.value)}
          className={getInputClassName()}
        />
      </div>
    </div>
  );

  const renderPreferences = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Desired Salary"
          value={formData.preferences.desiredSalary || ''}
          onChange={e => handleInputChange('preferences', 'desiredSalary', e.target.value)}
          className={getInputClassName()}
        />
        <div className="space-y-1">
          <label className={cn(
            'block text-xs',
            isLight ? 'text-gray-600' : 'text-gray-400'
          )}>Available Start Date</label>
          <input
            type="date"
            value={formData.preferences.availableStartDate || ''}
            onChange={e => handleInputChange('preferences', 'availableStartDate', e.target.value)}
            className={getInputClassName()}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={formData.preferences.workAuthorization || ''}
          onChange={e => handleInputChange('preferences', 'workAuthorization', e.target.value)}
          className={getInputClassName()}>
          <option value="">Work Authorization</option>
          <option value="US Citizen">US Citizen</option>
          <option value="Green Card">Green Card Holder</option>
          <option value="H1B">H1B Visa</option>
          <option value="F1 OPT">F1 OPT</option>
          <option value="L1">L1 Visa</option>
          <option value="TN">TN Visa</option>
          <option value="Other">Other</option>
          <option value="Requires Sponsorship">Requires Sponsorship</option>
        </select>
        <select
          value={formData.preferences.jobPreferences?.preferredWorkType || 'remote'}
          onChange={e => handleInputChange('preferences', 'preferredWorkType', e.target.value)}
          className={getInputClassName()}>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site</option>
          <option value="flexible">Flexible</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.preferences.willingToRelocate || false}
            onChange={e => handleInputChange('preferences', 'willingToRelocate', e.target.checked)}
            className="rounded transition-colors"
          />
          <span className={cn(
            'text-sm',
            isLight ? 'text-gray-700' : 'text-gray-300'
          )}>Willing to relocate</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={formData.preferences.jobPreferences?.requiresSponsorship || false}
            onChange={e => handleInputChange('preferences', 'requiresSponsorship', e.target.checked)}
            className="rounded transition-colors"
          />
          <span className={cn(
            'text-sm',
            isLight ? 'text-gray-700' : 'text-gray-300'
          )}>Requires sponsorship</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Section Navigation */}
      <div className="mb-4 flex flex-shrink-0 text-xs">
        <button
          onClick={() => setActiveSection('personal')}
          className={cn(
            'flex-1 rounded-l px-2 py-1 transition-colors',
            activeSection === 'personal' 
              ? (isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/50 text-blue-300')
              : (isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300')
          )}>
          Personal
        </button>
        <button
          onClick={() => setActiveSection('work')}
          className={cn(
            'flex-1 px-2 py-1 transition-colors',
            activeSection === 'work' 
              ? (isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/50 text-blue-300')
              : (isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300')
          )}>
          Work
        </button>
        <button
          onClick={() => setActiveSection('preferences')}
          className={cn(
            'flex-1 rounded-r px-2 py-1 transition-colors',
            activeSection === 'preferences' 
              ? (isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-900/50 text-blue-300')
              : (isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300')
          )}>
          Preferences
        </button>
      </div>

      {/* Form Content - Scrollable */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        <div className="space-y-4 pb-4">
          {activeSection === 'personal' && renderPersonalInfo()}
          {activeSection === 'work' && renderWorkInfo()}
          {activeSection === 'preferences' && renderPreferences()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-shrink-0 space-x-2">
        <Button
          onClick={handleSave}
          disabled={isSubmitting}
          variant="primary"
          className="flex-1 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </div>
          ) : (
            'Save Profile'
          )}
        </Button>
        {onCancel && (
          <Button
            onClick={onCancel}
            disabled={isSubmitting}
            variant="outline"
            className="flex-1 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};