import React from 'react';
import { cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { UserProfile, ProfileValidationError } from '@extension/shared';

interface PersonalInfoFormProps {
  profile: UserProfile;
  errors: ProfileValidationError[];
  onChange: (updates: Partial<UserProfile['personalInfo']>) => void;
}

interface InputFieldProps {
  label: string;
  field: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  profile: UserProfile;
  getFieldError: (fieldPath: string) => string | undefined;
  handleInputChange: (field: string, value: string) => void;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  field,
  type = 'text',
  placeholder,
  required = false,
  profile,
  getFieldError,
  handleInputChange,
}) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const value = field.startsWith('address.')
    ? profile.personalInfo.address[field.replace('address.', '') as keyof typeof profile.personalInfo.address]
    : profile.personalInfo[field as keyof typeof profile.personalInfo];

  const error = getFieldError(`personalInfo.${field}`);

  return (
    <div>
      <label className={cn(
        'mb-1 block text-sm font-medium',
        isLight ? 'text-gray-700' : 'text-gray-300'
      )}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={(value as string) || ''}
        onChange={e => handleInputChange(field, e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
          error 
            ? (isLight ? 'border-red-300' : 'border-red-600')
            : (isLight ? 'border-gray-300' : 'border-gray-600'),
          isLight 
            ? 'bg-white text-gray-900' 
            : 'bg-gray-700 text-gray-100',
        )}
      />
      {error && (
        <p className={cn(
          'mt-1 text-sm',
          isLight ? 'text-red-600' : 'text-red-400'
        )}>{error}</p>
      )}
    </div>
  );
};

export const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({ profile, errors, onChange }) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const getFieldError = (fieldPath: string) => {
    return errors.find(error => error.field === fieldPath)?.message;
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.replace('address.', '');
      onChange({
        address: {
          ...profile.personalInfo.address,
          [addressField]: value,
        },
      });
    } else {
      onChange({
        [field]: value,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className={cn(
          'mb-4 text-lg font-medium',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>Personal Information</h3>
        <p className={cn(
          'mb-6 text-sm',
          isLight ? 'text-gray-600' : 'text-gray-400'
        )}>
          This information will be used to automatically fill out job application forms.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <InputField
          label="First Name"
          field="firstName"
          placeholder="John"
          required
          profile={profile}
          getFieldError={getFieldError}
          handleInputChange={handleInputChange}
        />

        <InputField
          label="Last Name"
          field="lastName"
          placeholder="Doe"
          required
          profile={profile}
          getFieldError={getFieldError}
          handleInputChange={handleInputChange}
        />

        <InputField
          label="Email Address"
          field="email"
          type="email"
          placeholder="john.doe@example.com"
          required
          profile={profile}
          getFieldError={getFieldError}
          handleInputChange={handleInputChange}
        />

        <InputField
          label="Phone Number"
          field="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          required
          profile={profile}
          getFieldError={getFieldError}
          handleInputChange={handleInputChange}
        />
      </div>

      <div>
        <h4 className={cn(
          'text-md mb-4 font-medium',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>Address</h4>
        <div className="grid grid-cols-1 gap-4">
          <InputField
            label="Street Address"
            field="address.street"
            placeholder="123 Main Street"
            required
            profile={profile}
            getFieldError={getFieldError}
            handleInputChange={handleInputChange}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <InputField
              label="City"
              field="address.city"
              placeholder="New York"
              required
              profile={profile}
              getFieldError={getFieldError}
              handleInputChange={handleInputChange}
            />

            <InputField
              label="State/Province"
              field="address.state"
              placeholder="NY"
              required
              profile={profile}
              getFieldError={getFieldError}
              handleInputChange={handleInputChange}
            />

            <InputField
              label="ZIP/Postal Code"
              field="address.zipCode"
              placeholder="10001"
              required
              profile={profile}
              getFieldError={getFieldError}
              handleInputChange={handleInputChange}
            />
          </div>

          <InputField
            label="Country"
            field="address.country"
            placeholder="United States"
            required
            profile={profile}
            getFieldError={getFieldError}
            handleInputChange={handleInputChange}
          />
        </div>
      </div>

      <div>
        <h4 className={cn(
          'text-md mb-4 font-medium',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>Professional Links (Optional)</h4>
        <div className="grid grid-cols-1 gap-4">
          <InputField
            label="LinkedIn Profile"
            field="linkedInUrl"
            type="url"
            placeholder="https://linkedin.com/in/johndoe"
            profile={profile}
            getFieldError={getFieldError}
            handleInputChange={handleInputChange}
          />

          <InputField
            label="Portfolio Website"
            field="portfolioUrl"
            type="url"
            placeholder="https://johndoe.com"
            profile={profile}
            getFieldError={getFieldError}
            handleInputChange={handleInputChange}
          />

          <InputField
            label="GitHub Profile"
            field="githubUrl"
            type="url"
            placeholder="https://github.com/johndoe"
            profile={profile}
            getFieldError={getFieldError}
            handleInputChange={handleInputChange}
          />
        </div>
      </div>
    </div>
  );
};
