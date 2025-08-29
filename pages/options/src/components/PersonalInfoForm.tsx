import React from 'react';
import { cn } from '@extension/ui';
import type { UserProfile, ProfileValidationError } from '@extension/shared';

interface PersonalInfoFormProps {
  profile: UserProfile;
  errors: ProfileValidationError[];
  onChange: (updates: Partial<UserProfile['personalInfo']>) => void;
}

export const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({
  profile,
  errors,
  onChange,
}) => {
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

  const InputField: React.FC<{
    label: string;
    field: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
  }> = ({ label, field, type = 'text', placeholder, required = false }) => {
    const value = field.startsWith('address.') 
      ? profile.personalInfo.address[field.replace('address.', '') as keyof typeof profile.personalInfo.address]
      : profile.personalInfo[field as keyof typeof profile.personalInfo];
    
    const error = getFieldError(`personalInfo.${field}`);

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type={type}
          value={value as string || ''}
          onChange={(e) => handleInputChange(field, e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            error 
              ? 'border-red-300 dark:border-red-600' 
              : 'border-gray-300 dark:border-gray-600',
            'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
          )}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Personal Information
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          This information will be used to automatically fill out job application forms.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputField
          label="First Name"
          field="firstName"
          placeholder="John"
          required
        />
        
        <InputField
          label="Last Name"
          field="lastName"
          placeholder="Doe"
          required
        />
        
        <InputField
          label="Email Address"
          field="email"
          type="email"
          placeholder="john.doe@example.com"
          required
        />
        
        <InputField
          label="Phone Number"
          field="phone"
          type="tel"
          placeholder="+1 (555) 123-4567"
          required
        />
      </div>

      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Address
        </h4>
        <div className="grid grid-cols-1 gap-4">
          <InputField
            label="Street Address"
            field="address.street"
            placeholder="123 Main Street"
            required
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField
              label="City"
              field="address.city"
              placeholder="New York"
              required
            />
            
            <InputField
              label="State/Province"
              field="address.state"
              placeholder="NY"
              required
            />
            
            <InputField
              label="ZIP/Postal Code"
              field="address.zipCode"
              placeholder="10001"
              required
            />
          </div>
          
          <InputField
            label="Country"
            field="address.country"
            placeholder="United States"
            required
          />
        </div>
      </div>

      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
          Professional Links (Optional)
        </h4>
        <div className="grid grid-cols-1 gap-4">
          <InputField
            label="LinkedIn Profile"
            field="linkedInUrl"
            type="url"
            placeholder="https://linkedin.com/in/johndoe"
          />
          
          <InputField
            label="Portfolio Website"
            field="portfolioUrl"
            type="url"
            placeholder="https://johndoe.com"
          />
          
          <InputField
            label="GitHub Profile"
            field="githubUrl"
            type="url"
            placeholder="https://github.com/johndoe"
          />
        </div>
      </div>
    </div>
  );
};