/**
 * Profile storage service extending existing storage patterns
 */

import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';
import type { UserProfile, ProfileValidationResult } from '@extension/shared';
import { validateUserProfile } from '@extension/shared';

// Default profile structure
const DEFAULT_PROFILE: UserProfile = {
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
  },
  professionalInfo: {
    workExperience: [],
    education: [],
    skills: [],
    certifications: [],
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
};

// Profile storage configuration
const PROFILE_STORAGE_KEY = 'job-autofill-profile';

// Serialization functions for complex data types
const serializeProfile = (profile: UserProfile): string => {
  return JSON.stringify(profile, (key, value) => {
    // Convert Date objects to ISO strings
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });
};

const deserializeProfile = (data: string): UserProfile => {
  return JSON.parse(data, (key, value) => {
    // Convert ISO strings back to Date objects
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  });
};

// Create base storage instance
const baseStorage = createStorage<UserProfile>(
  PROFILE_STORAGE_KEY,
  DEFAULT_PROFILE,
  {
    storageEnum: StorageEnum.Sync, // Use sync storage for cross-device compatibility
    liveUpdate: true,
    serialization: {
      serialize: serializeProfile,
      deserialize: deserializeProfile,
    },
  },
);

// Extended profile storage interface
export interface ProfileStorageType extends BaseStorageType<UserProfile> {
  // Profile management methods
  updatePersonalInfo: (personalInfo: Partial<UserProfile['personalInfo']>) => Promise<void>;
  updateProfessionalInfo: (professionalInfo: Partial<UserProfile['professionalInfo']>) => Promise<void>;
  updatePreferences: (preferences: Partial<UserProfile['preferences']>) => Promise<void>;
  updateDocuments: (documents: Partial<UserProfile['documents']>) => Promise<void>;
  
  // Validation methods
  validate: () => Promise<ProfileValidationResult>;
  isProfileComplete: () => Promise<boolean>;
  
  // Utility methods
  generateProfileId: () => string;
  updateMetadata: () => Promise<void>;
  resetProfile: () => Promise<void>;
  exportProfile: () => Promise<string>;
  importProfile: (profileData: string) => Promise<void>;
  
  // Sync methods
  getLastSyncTime: () => Promise<Date | null>;
  markSynced: () => Promise<void>;
  needsSync: () => Promise<boolean>;
}

// Generate unique profile ID
const generateProfileId = (): string => {
  return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Profile storage implementation
export const profileStorage: ProfileStorageType = {
  ...baseStorage,

  updatePersonalInfo: async (personalInfo: Partial<UserProfile['personalInfo']>) => {
    await baseStorage.set((currentProfile: UserProfile) => {
      const updatedProfile = {
        ...currentProfile,
        personalInfo: {
          ...currentProfile.personalInfo,
          ...personalInfo,
        },
        metadata: {
          ...currentProfile.metadata,
          updatedAt: new Date(),
        },
      };

      // Generate ID if not exists
      if (!updatedProfile.id) {
        updatedProfile.id = generateProfileId();
        updatedProfile.metadata.createdAt = new Date();
      }

      return updatedProfile;
    });
  },

  updateProfessionalInfo: async (professionalInfo: Partial<UserProfile['professionalInfo']>) => {
    await baseStorage.set((currentProfile: UserProfile) => ({
      ...currentProfile,
      professionalInfo: {
        ...currentProfile.professionalInfo,
        ...professionalInfo,
      },
      metadata: {
        ...currentProfile.metadata,
        updatedAt: new Date(),
      },
    }));
  },

  updatePreferences: async (preferences: Partial<UserProfile['preferences']>) => {
    await baseStorage.set((currentProfile: UserProfile) => ({
      ...currentProfile,
      preferences: {
        ...currentProfile.preferences,
        ...preferences,
        // Deep merge for nested objects
        defaultAnswers: {
          ...currentProfile.preferences.defaultAnswers,
          ...(preferences.defaultAnswers || {}),
        },
        jobPreferences: {
          ...currentProfile.preferences.jobPreferences,
          ...(preferences.jobPreferences || {}),
        },
        privacySettings: {
          ...currentProfile.preferences.privacySettings,
          ...(preferences.privacySettings || {}),
        },
      },
      metadata: {
        ...currentProfile.metadata,
        updatedAt: new Date(),
      },
    }));
  },

  updateDocuments: async (documents: Partial<UserProfile['documents']>) => {
    await baseStorage.set((currentProfile: UserProfile) => ({
      ...currentProfile,
      documents: {
        ...currentProfile.documents,
        ...documents,
      },
      metadata: {
        ...currentProfile.metadata,
        updatedAt: new Date(),
      },
    }));
  },

  validate: async (): Promise<ProfileValidationResult> => {
    const profile = await baseStorage.get();
    return validateUserProfile(profile);
  },

  isProfileComplete: async (): Promise<boolean> => {
    const validationResult = await profileStorage.validate();
    return validationResult.isValid && validationResult.warnings.length < 3;
  },

  generateProfileId,

  updateMetadata: async () => {
    await baseStorage.set((currentProfile: UserProfile) => ({
      ...currentProfile,
      metadata: {
        ...currentProfile.metadata,
        updatedAt: new Date(),
        version: currentProfile.metadata.version + 1,
      },
    }));
  },

  resetProfile: async () => {
    const newProfile = {
      ...DEFAULT_PROFILE,
      id: generateProfileId(),
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      },
    };
    await baseStorage.set(newProfile);
  },

  exportProfile: async (): Promise<string> => {
    const profile = await baseStorage.get();
    return serializeProfile(profile);
  },

  importProfile: async (profileData: string) => {
    try {
      const importedProfile = deserializeProfile(profileData);
      
      // Validate imported profile
      const validationResult = validateUserProfile(importedProfile);
      if (!validationResult.isValid) {
        throw new Error(`Invalid profile data: ${validationResult.errors.map((e: any) => e.message).join(', ')}`);
      }

      // Update metadata for import
      const profileToImport = {
        ...importedProfile,
        metadata: {
          ...importedProfile.metadata,
          updatedAt: new Date(),
          lastSyncAt: undefined, // Reset sync status
        },
      };

      await baseStorage.set(profileToImport);
    } catch (error: any) {
      throw new Error(`Failed to import profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  getLastSyncTime: async (): Promise<Date | null> => {
    const profile = await baseStorage.get();
    return profile.metadata.lastSyncAt || null;
  },

  markSynced: async () => {
    await baseStorage.set((currentProfile: UserProfile) => ({
      ...currentProfile,
      metadata: {
        ...currentProfile.metadata,
        lastSyncAt: new Date(),
      },
    }));
  },

  needsSync: async (): Promise<boolean> => {
    const profile = await baseStorage.get();
    if (!profile.metadata.lastSyncAt) return true;
    
    return profile.metadata.updatedAt > profile.metadata.lastSyncAt;
  },
};

// Export default profile for testing and initialization
export { DEFAULT_PROFILE };