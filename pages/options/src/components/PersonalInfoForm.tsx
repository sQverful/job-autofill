import React from 'react';
import { Input, FormField } from '@extension/ui';
import type { UserProfile, ValidationError } from '@extension/shared';

interface PersonalInfoFormProps {
  profile: UserProfile;
  errors: ValidationError[];
  onChange: (updates: Partial<UserProfile['personalInfo']>) => void;
}

export const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({
  profile,
  errors,
  onChange,
}) => {
  const getFieldError = (fieldName: string) => {
    return errors.find(error => error.field === fieldName)?.message;
  };

  const handleInputChange = (field: keyof UserProfile['personalInfo'], value: string) => {
    if (field === 'address') return; // Handle address separately
    onChange({ [field]: value });
  };

  const handleAddressChange = (field: keyof UserProfile['personalInfo']['address'], value: string) => {
    onChange({
      address: {
        ...profile.personalInfo.address,
        [field]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Personal Information
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This information will be used to automatically fill personal details in job applications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="First Name"
          error={getFieldError('personalInfo.firstName')}
          required
        >
          <Input
            value={profile.personalInfo.firstName}
            onChange={(e) => handleInputChange('firstName', e.target.value)}
            placeholder="Enter your first name"
          />
        </FormField>

        <FormField
          label="Last Name"
          error={getFieldError('personalInfo.lastName')}
          required
        >
          <Input
            value={profile.personalInfo.lastName}
            onChange={(e) => handleInputChange('lastName', e.target.value)}
            placeholder="Enter your last name"
          />
        </FormField>

        <FormField
          label="Email Address"
          error={getFieldError('personalInfo.email')}
          required
        >
          <Input
            type="email"
            value={profile.personalInfo.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="your.email@example.com"
          />
        </FormField>

        <FormField
          label="Phone Number"
          error={getFieldError('personalInfo.phone')}
          required
        >
          <Input
            type="tel"
            value={profile.personalInfo.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="(555) 123-4567"
          />
        </FormField>

        <FormField
          label="LinkedIn URL"
          error={getFieldError('personalInfo.linkedInUrl')}
        >
          <Input
            type="url"
            value={profile.personalInfo.linkedInUrl || ''}
            onChange={(e) => handleInputChange('linkedInUrl', e.target.value)}
            placeholder="https://linkedin.com/in/yourprofile"
          />
        </FormField>

        <FormField
          label="Portfolio URL"
          error={getFieldError('personalInfo.portfolioUrl')}
        >
          <Input
            type="url"
            value={profile.personalInfo.portfolioUrl || ''}
            onChange={(e) => handleInputChange('portfolioUrl', e.target.value)}
            placeholder="https://yourportfolio.com"
          />
        </FormField>

        <FormField
          label="GitHub URL"
          error={getFieldError('personalInfo.githubUrl')}
        >
          <Input
            type="url"
            value={profile.personalInfo.githubUrl || ''}
            onChange={(e) => handleInputChange('githubUrl', e.target.value)}
            placeholder="https://github.com/yourusername"
          />
        </FormField>
      </div>

      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Address
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <FormField
              label="Street Address"
              error={getFieldError('personalInfo.address.street')}
              required
            >
              <Input
                value={profile.personalInfo.address.street}
                onChange={(e) => handleAddressChange('street', e.target.value)}
                placeholder="123 Main Street"
              />
            </FormField>
          </div>

          <FormField
            label="City"
            error={getFieldError('personalInfo.address.city')}
            required
          >
            <Input
              value={profile.personalInfo.address.city}
              onChange={(e) => handleAddressChange('city', e.target.value)}
              placeholder="San Francisco"
            />
          </FormField>

          <FormField
            label="State/Province"
            error={getFieldError('personalInfo.address.state')}
            required
          >
            <Input
              value={profile.personalInfo.address.state}
              onChange={(e) => handleAddressChange('state', e.target.value)}
              placeholder="CA"
            />
          </FormField>

          <FormField
            label="ZIP/Postal Code"
            error={getFieldError('personalInfo.address.zipCode')}
            required
          >
            <Input
              value={profile.personalInfo.address.zipCode}
              onChange={(e) => handleAddressChange('zipCode', e.target.value)}
              placeholder="94105"
            />
          </FormField>

          <FormField
            label="Country"
            error={getFieldError('personalInfo.address.country')}
            required
          >
            <Input
              value={profile.personalInfo.address.country}
              onChange={(e) => handleAddressChange('country', e.target.value)}
              placeholder="United States"
            />
          </FormField>
        </div>
      </div>
    </div>
  );
};