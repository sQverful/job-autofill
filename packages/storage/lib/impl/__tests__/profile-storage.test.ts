/**
 * Unit tests for profile storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { profileStorage, DEFAULT_PROFILE } from '../profile-storage.js';
import type { UserProfile } from '@extension/shared';

// Mock chrome storage API
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    onChanged: {
      addListener: vi.fn(),
    },
  },
  sync: {
    get: vi.fn(),
    set: vi.fn(),
    onChanged: {
      addListener: vi.fn(),
    },
  },
};

// Mock globalThis.chrome
Object.defineProperty(globalThis, 'chrome', {
  value: {
    storage: mockStorage,
  },
  writable: true,
});

describe('Profile Storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockStorage.sync.get.mockResolvedValue({});
    mockStorage.sync.set.mockResolvedValue(undefined);
  });

  describe('Basic Storage Operations', () => {
    it('should return default profile when no data exists', async () => {
      mockStorage.sync.get.mockResolvedValue({});
      
      const profile = await profileStorage.get();
      expect(profile.personalInfo.firstName).toBe('');
      expect(profile.personalInfo.lastName).toBe('');
      expect(profile.professionalInfo.workExperience).toEqual([]);
    });

    it('should generate profile ID when updating personal info', async () => {
      mockStorage.sync.get.mockResolvedValue({});
      
      await profileStorage.updatePersonalInfo({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });

      expect(mockStorage.sync.set).toHaveBeenCalled();
      const setCall = mockStorage.sync.set.mock.calls[0][0];
      const profileData = JSON.parse(setCall['job-autofill-profile']);
      
      expect(profileData.id).toBeTruthy();
      expect(profileData.personalInfo.firstName).toBe('John');
      expect(profileData.personalInfo.lastName).toBe('Doe');
      expect(profileData.personalInfo.email).toBe('john@example.com');
    });
  });

  describe('Profile Updates', () => {
    it('should update personal information correctly', async () => {
      const existingProfile = {
        ...DEFAULT_PROFILE,
        id: 'existing-id',
        personalInfo: {
          ...DEFAULT_PROFILE.personalInfo,
          firstName: 'Jane',
        },
      };
      
      mockStorage.sync.get.mockResolvedValue({
        'job-autofill-profile': JSON.stringify(existingProfile),
      });

      await profileStorage.updatePersonalInfo({
        lastName: 'Smith',
        email: 'jane.smith@example.com',
      });

      expect(mockStorage.sync.set).toHaveBeenCalled();
      const setCall = mockStorage.sync.set.mock.calls[0][0];
      const profileData = JSON.parse(setCall['job-autofill-profile']);
      
      expect(profileData.personalInfo.firstName).toBe('Jane'); // Preserved
      expect(profileData.personalInfo.lastName).toBe('Smith'); // Updated
      expect(profileData.personalInfo.email).toBe('jane.smith@example.com'); // Updated
    });

    it('should update professional information correctly', async () => {
      mockStorage.sync.get.mockResolvedValue({});

      const workExperience = [{
        id: 'work-1',
        company: 'Test Company',
        position: 'Developer',
        startDate: new Date('2020-01-01'),
        isCurrent: true,
        description: 'Test description',
        location: 'Remote',
      }];

      await profileStorage.updateProfessionalInfo({
        workExperience,
        skills: ['JavaScript', 'TypeScript'],
      });

      expect(mockStorage.sync.set).toHaveBeenCalled();
      const setCall = mockStorage.sync.set.mock.calls[0][0];
      const profileData = JSON.parse(setCall['job-autofill-profile']);
      
      expect(profileData.professionalInfo.workExperience).toHaveLength(1);
      expect(profileData.professionalInfo.skills).toEqual(['JavaScript', 'TypeScript']);
    });

    it('should deep merge preferences correctly', async () => {
      const existingProfile = {
        ...DEFAULT_PROFILE,
        preferences: {
          ...DEFAULT_PROFILE.preferences,
          defaultAnswers: { question1: 'answer1' },
          jobPreferences: {
            ...DEFAULT_PROFILE.preferences.jobPreferences,
            workAuthorization: 'permanent_resident' as const,
          },
        },
      };
      
      mockStorage.sync.get.mockResolvedValue({
        'job-autofill-profile': JSON.stringify(existingProfile),
      });

      await profileStorage.updatePreferences({
        defaultAnswers: { question2: 'answer2' },
        jobPreferences: {
          ...DEFAULT_PROFILE.preferences.jobPreferences,
          requiresSponsorship: true,
        },
      });

      expect(mockStorage.sync.set).toHaveBeenCalled();
      const setCall = mockStorage.sync.set.mock.calls[0][0];
      const profileData = JSON.parse(setCall['job-autofill-profile']);
      
      // Should preserve existing and add new
      expect(profileData.preferences.defaultAnswers).toEqual({
        question1: 'answer1',
        question2: 'answer2',
      });
      
      // Should merge job preferences
      expect(profileData.preferences.jobPreferences.workAuthorization).toBe('permanent_resident');
      expect(profileData.preferences.jobPreferences.requiresSponsorship).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate profile and return results', async () => {
      const validProfile = {
        ...DEFAULT_PROFILE,
        personalInfo: {
          ...DEFAULT_PROFILE.personalInfo,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zipCode: '12345',
            country: 'USA',
          },
        },
      };
      
      mockStorage.sync.get.mockResolvedValue({
        'job-autofill-profile': JSON.stringify(validProfile),
      });

      const result = await profileStorage.validate();
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect incomplete profile', async () => {
      mockStorage.sync.get.mockResolvedValue({});

      const isComplete = await profileStorage.isProfileComplete();
      expect(isComplete).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should generate unique profile IDs', () => {
      const id1 = profileStorage.generateProfileId();
      const id2 = profileStorage.generateProfileId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^profile_\d+_[a-z0-9]+$/);
    });

    it('should reset profile to default', async () => {
      mockStorage.sync.get.mockResolvedValue({});

      await profileStorage.resetProfile();

      expect(mockStorage.sync.set).toHaveBeenCalled();
      const setCall = mockStorage.sync.set.mock.calls[0][0];
      const profileData = JSON.parse(setCall['job-autofill-profile']);
      
      expect(profileData.id).toBeTruthy();
      expect(profileData.personalInfo.firstName).toBe('');
      expect(profileData.professionalInfo.workExperience).toEqual([]);
    });

    it('should export profile as JSON string', async () => {
      const testProfile = {
        ...DEFAULT_PROFILE,
        personalInfo: {
          ...DEFAULT_PROFILE.personalInfo,
          firstName: 'Test',
        },
      };
      
      mockStorage.sync.get.mockResolvedValue({
        'job-autofill-profile': JSON.stringify(testProfile),
      });

      const exported = await profileStorage.exportProfile();
      const parsed = JSON.parse(exported);
      
      expect(parsed.personalInfo.firstName).toBe('Test');
    });

    it('should import valid profile data', async () => {
      const profileToImport = {
        ...DEFAULT_PROFILE,
        id: 'imported-id',
        personalInfo: {
          ...DEFAULT_PROFILE.personalInfo,
          firstName: 'Imported',
          lastName: 'User',
          email: 'imported@example.com',
          phone: '9876543210',
          address: {
            street: '456 Import St',
            city: 'Import City',
            state: 'NY',
            zipCode: '54321',
            country: 'USA',
          },
        },
      };

      const profileJson = JSON.stringify(profileToImport);
      await profileStorage.importProfile(profileJson);

      expect(mockStorage.sync.set).toHaveBeenCalled();
      const setCall = mockStorage.sync.set.mock.calls[0][0];
      const profileData = JSON.parse(setCall['job-autofill-profile']);
      
      expect(profileData.personalInfo.firstName).toBe('Imported');
      expect(profileData.personalInfo.lastName).toBe('User');
    });

    it('should reject invalid profile data on import', async () => {
      const invalidProfile = {
        personalInfo: {
          firstName: 'Test',
          // Missing required fields
        },
      };

      const profileJson = JSON.stringify(invalidProfile);
      
      await expect(profileStorage.importProfile(profileJson)).rejects.toThrow('Failed to import profile');
    });
  });

  describe('Sync Methods', () => {
    it('should track sync status correctly', async () => {
      mockStorage.sync.get.mockResolvedValue({});

      // Initially should need sync
      const needsSync1 = await profileStorage.needsSync();
      expect(needsSync1).toBe(true);

      // After marking synced, should not need sync
      await profileStorage.markSynced();
      
      expect(mockStorage.sync.set).toHaveBeenCalled();
      const setCall = mockStorage.sync.set.mock.calls[0][0];
      const profileData = JSON.parse(setCall['job-autofill-profile']);
      expect(profileData.metadata.lastSyncAt).toBeTruthy();
    });

    it('should return null for last sync time when never synced', async () => {
      mockStorage.sync.get.mockResolvedValue({});

      const lastSync = await profileStorage.getLastSyncTime();
      expect(lastSync).toBeNull();
    });
  });
});