/**
 * Data synchronization manager for profile and settings
 */

import type { UserProfile } from '@extension/shared';
import { profileStorage } from '@extension/storage';
import { apiClient } from './api-client.js';

// Sync status types
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  lastSyncTime: Date | null;
  lastError: string | null;
  pendingChanges: boolean;
}

// Sync conflict resolution strategies
export type ConflictResolution = 'local' | 'remote' | 'merge' | 'manual';

export interface SyncConflict {
  field: string;
  localValue: any;
  remoteValue: any;
  timestamp: Date;
}

// Sync manager class
export class SyncManager {
  private syncState: SyncState = {
    status: 'idle',
    lastSyncTime: null,
    lastError: null,
    pendingChanges: false,
  };

  private syncInProgress = false;
  private syncListeners: ((state: SyncState) => void)[] = [];
  private autoSyncInterval: number | null = null;

  constructor() {
    this.initializeAutoSync();
    this.setupStorageListener();
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Add sync state listener
   */
  addSyncListener(listener: (state: SyncState) => void): () => void {
    this.syncListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  /**
   * Update sync state and notify listeners
   */
  private updateSyncState(updates: Partial<SyncState>): void {
    this.syncState = { ...this.syncState, ...updates };
    this.syncListeners.forEach(listener => listener(this.syncState));
  }

  /**
   * Initialize automatic sync
   */
  private initializeAutoSync(): void {
    // Sync every 5 minutes
    this.autoSyncInterval = setInterval(() => {
      this.syncIfNeeded();
    }, 5 * 60 * 1000);
  }

  /**
   * Setup storage change listener
   */
  private setupStorageListener(): void {
    // Listen for profile changes to mark as pending sync
    profileStorage.subscribe(() => {
      const profile = profileStorage.getSnapshot();
      if (profile && this.syncState.status !== 'syncing') {
        this.updateSyncState({ pendingChanges: true });
      }
    });
  }

  /**
   * Check if sync is needed and perform if necessary
   */
  async syncIfNeeded(): Promise<void> {
    if (this.syncInProgress) return;

    const needsSync = await profileStorage.needsSync();
    if (needsSync || this.syncState.pendingChanges) {
      await this.sync();
    }
  }

  /**
   * Force sync profile data
   */
  async sync(force = false): Promise<void> {
    if (this.syncInProgress && !force) return;

    this.syncInProgress = true;
    this.updateSyncState({ status: 'syncing', lastError: null });

    try {
      // Check if we're online
      if (!navigator.onLine) {
        throw new Error('No internet connection');
      }

      // Check API health
      const isHealthy = await apiClient.healthCheck();
      if (!isHealthy) {
        throw new Error('API service unavailable');
      }

      // Get local profile
      const localProfile = await profileStorage.get();
      
      // Get remote profile
      let remoteProfile: UserProfile | null = null;
      try {
        remoteProfile = await apiClient.getProfile();
      } catch (error: any) {
        // If profile doesn't exist remotely, we'll create it
        if (!error.message.includes('404') && !error.message.includes('not found')) {
          throw error;
        }
      }

      // Determine sync strategy
      if (!remoteProfile) {
        // Upload local profile to remote
        await this.uploadProfile(localProfile);
      } else if (!localProfile.metadata.lastSyncAt) {
        // First sync - check for conflicts
        const conflicts = this.detectConflicts(localProfile, remoteProfile);
        if (conflicts.length > 0) {
          await this.resolveConflicts(localProfile, remoteProfile, conflicts);
        } else {
          await this.mergeProfiles(localProfile, remoteProfile);
        }
      } else {
        // Regular sync - compare timestamps
        const localUpdated = localProfile.metadata.updatedAt;
        const remoteUpdated = remoteProfile.metadata.updatedAt;

        if (localUpdated > remoteUpdated) {
          // Local is newer - upload
          await this.uploadProfile(localProfile);
        } else if (remoteUpdated > localUpdated) {
          // Remote is newer - download
          await this.downloadProfile(remoteProfile);
        } else {
          // Same timestamp - just mark as synced
          await profileStorage.markSynced();
        }
      }

      this.updateSyncState({
        status: 'idle',
        lastSyncTime: new Date(),
        pendingChanges: false,
      });

    } catch (error: any) {
      console.error('Sync failed:', error);
      
      const status = error.message.includes('internet') || error.message.includes('network') 
        ? 'offline' 
        : 'error';

      this.updateSyncState({
        status,
        lastError: error.message,
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Upload local profile to remote
   */
  private async uploadProfile(profile: UserProfile): Promise<void> {
    const updatedProfile = await apiClient.updateProfile(profile);
    
    // Update local profile with any server-side changes
    await profileStorage.set(updatedProfile);
    await profileStorage.markSynced();
  }

  /**
   * Download remote profile to local
   */
  private async downloadProfile(profile: UserProfile): Promise<void> {
    await profileStorage.set(profile);
    await profileStorage.markSynced();
  }

  /**
   * Detect conflicts between local and remote profiles
   */
  private detectConflicts(local: UserProfile, remote: UserProfile): SyncConflict[] {
    const conflicts: SyncConflict[] = [];

    // Check personal info conflicts
    const personalFields = ['firstName', 'lastName', 'email', 'phone'] as const;
    personalFields.forEach(field => {
      if (local.personalInfo[field] !== remote.personalInfo[field] && 
          local.personalInfo[field] && remote.personalInfo[field]) {
        conflicts.push({
          field: `personalInfo.${field}`,
          localValue: local.personalInfo[field],
          remoteValue: remote.personalInfo[field],
          timestamp: new Date(),
        });
      }
    });

    // Check for work experience conflicts (simplified)
    if (local.professionalInfo.workExperience.length !== remote.professionalInfo.workExperience.length) {
      conflicts.push({
        field: 'professionalInfo.workExperience',
        localValue: local.professionalInfo.workExperience,
        remoteValue: remote.professionalInfo.workExperience,
        timestamp: new Date(),
      });
    }

    return conflicts;
  }

  /**
   * Resolve conflicts using merge strategy
   */
  private async resolveConflicts(
    local: UserProfile, 
    remote: UserProfile, 
    conflicts: SyncConflict[],
    strategy: ConflictResolution = 'merge'
  ): Promise<void> {
    let resolvedProfile: UserProfile;

    switch (strategy) {
      case 'local':
        resolvedProfile = local;
        break;
      case 'remote':
        resolvedProfile = remote;
        break;
      case 'merge':
      default:
        resolvedProfile = await this.mergeProfiles(local, remote);
        break;
    }

    // Upload resolved profile
    await this.uploadProfile(resolvedProfile);
  }

  /**
   * Merge local and remote profiles intelligently
   */
  private async mergeProfiles(local: UserProfile, remote: UserProfile): Promise<UserProfile> {
    const merged: UserProfile = {
      ...remote, // Start with remote as base
      id: local.id || remote.id,
      
      // Merge personal info - prefer non-empty values
      personalInfo: {
        ...remote.personalInfo,
        ...Object.fromEntries(
          Object.entries(local.personalInfo).filter(([_, value]) => 
            value && value !== ''
          )
        ),
      },

      // Merge professional info - combine arrays
      professionalInfo: {
        workExperience: this.mergeArrays(
          local.professionalInfo.workExperience,
          remote.professionalInfo.workExperience,
          'id'
        ),
        education: this.mergeArrays(
          local.professionalInfo.education,
          remote.professionalInfo.education,
          'id'
        ),
        skills: [...new Set([
          ...local.professionalInfo.skills,
          ...remote.professionalInfo.skills
        ])],
        certifications: this.mergeArrays(
          local.professionalInfo.certifications,
          remote.professionalInfo.certifications,
          'id'
        ),
        summary: local.professionalInfo.summary || remote.professionalInfo.summary,
      },

      // Merge preferences - prefer local settings
      preferences: {
        ...remote.preferences,
        ...local.preferences,
        defaultAnswers: {
          ...remote.preferences.defaultAnswers,
          ...local.preferences.defaultAnswers,
        },
      },

      // Merge documents
      documents: {
        resumes: this.mergeArrays(
          local.documents.resumes,
          remote.documents.resumes,
          'id'
        ),
        coverLetters: this.mergeArrays(
          local.documents.coverLetters,
          remote.documents.coverLetters,
          'id'
        ),
      },

      // Update metadata
      metadata: {
        ...local.metadata,
        updatedAt: new Date(),
        version: Math.max(local.metadata.version, remote.metadata.version) + 1,
      },
    };

    // Save merged profile locally first
    await profileStorage.set(merged);
    
    return merged;
  }

  /**
   * Merge arrays by unique key
   */
  private mergeArrays<T extends Record<string, any>>(
    local: T[], 
    remote: T[], 
    keyField: keyof T
  ): T[] {
    const merged = new Map<any, T>();

    // Add remote items first
    remote.forEach(item => merged.set(item[keyField], item));
    
    // Add/update with local items
    local.forEach(item => merged.set(item[keyField], item));

    return Array.from(merged.values());
  }

  /**
   * Handle offline mode
   */
  async handleOfflineMode(): Promise<void> {
    this.updateSyncState({ 
      status: 'offline',
      pendingChanges: await profileStorage.needsSync(),
    });
  }

  /**
   * Handle online mode
   */
  async handleOnlineMode(): Promise<void> {
    if (this.syncState.status === 'offline') {
      this.updateSyncState({ status: 'idle' });
      await this.syncIfNeeded();
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
    this.syncListeners.length = 0;
  }
}

// Export singleton instance
export const syncManager = new SyncManager();