import React, { useState, useEffect } from 'react';
import { cn, Button, LoadingSpinner } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage, profileStorage } from '@extension/storage';
import type { UserProfile } from '@extension/shared';
import { ProfileForm, ProfileView, SettingsView } from './index';

interface PopupState {
  currentTab: chrome.tabs.Tab | null;
  profile: UserProfile | null;
  profileComplete: boolean;
  autofillStatus: 'idle' | 'analyzing' | 'filling' | 'complete' | 'error';
  error: string | null;
  lastResult: AutofillResult | null;
  activeTab: 'autofill' | 'profile' | 'settings';
  showEditForm: boolean;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
}

interface AutofillResult {
  success: boolean;
  filledCount: number;
  totalFields: number;
  platform: string;
  duration: number;
}

export const AutofillControlPopup: React.FC = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [state, setState] = useState<PopupState>({
    currentTab: null,
    profile: null,
    profileComplete: false,
    autofillStatus: 'idle',
    error: null,
    lastResult: null,
    activeTab: 'autofill',
    showEditForm: false,
    saveStatus: 'idle',
  });
  const [loading, setLoading] = useState(true);

  // Initialize popup state
  useEffect(() => {
    initializePopup();
  }, []);

  // Listen for profile changes
  useEffect(() => {
    const handleStorageChange = () => {
      initializePopup();
    };

    // Listen for storage changes
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const initializePopup = async () => {
    try {
      setLoading(true);

      // Get current tab
      const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

      // Load profile and check completion
      const profile = await profileStorage.get();
      const profileComplete = await profileStorage.isProfileComplete();

      console.log('Profile loaded:', {
        hasProfile: !!profile,
        profileComplete,
        profileId: profile?.id,
        firstName: profile?.personalInfo?.firstName,
        email: profile?.personalInfo?.email,
      });

      setState(prev => ({
        ...prev,
        currentTab: tab,
        profile,
        profileComplete,
      }));
    } catch (error) {
      console.error('Failed to initialize popup:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to initialize extension',
      }));
    } finally {
      setLoading(false);
    }
  };

  const sendMessageToTab = async (message: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!state.currentTab?.id) {
        reject(new Error('No active tab'));
        return;
      }

      chrome.tabs.sendMessage(state.currentTab.id, message, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  };

  const handleFillOutForm = async () => {
    if (!state.currentTab?.id || !state.profileComplete) return;

    try {
      setState(prev => ({ ...prev, autofillStatus: 'analyzing', error: null }));

      // Send message to content script to trigger autofill
      const result = await sendMessageToTab({
        type: 'autofill:trigger',
        data: { tabId: state.currentTab.id },
      });

      if (result.success) {
        setState(prev => ({
          ...prev,
          autofillStatus: 'complete',
          lastResult: {
            success: true,
            filledCount: result.filledCount,
            totalFields: result.totalFields,
            platform: result.platform || 'unknown',
            duration: result.duration,
          },
        }));
      } else {
        throw new Error(result.error || 'Autofill failed');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        autofillStatus: 'error',
        error: error instanceof Error ? error.message : 'Failed to fill form',
      }));
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const handleProfileUpdate = async (profile: UserProfile): Promise<void> => {
    setState(prev => ({ ...prev, saveStatus: 'saving' }));
    try {
      await profileStorage.set(profile);
      const profileComplete = await profileStorage.isProfileComplete();
      setState(prev => ({
        ...prev,
        profile,
        showEditForm: false,
        saveStatus: 'success',
        profileComplete,
      }));
      setTimeout(() => setState(prev => ({ ...prev, saveStatus: 'idle' })), 2000);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setState(prev => ({ ...prev, saveStatus: 'error' }));
      setTimeout(() => setState(prev => ({ ...prev, saveStatus: 'idle' })), 3000);
    }
  };

  const handleProfileImport = async (profile: UserProfile): Promise<void> => {
    await handleProfileUpdate(profile);
  };

  const exportProfile = (): void => {
    if (!state.profile) return;

    const dataStr = JSON.stringify(state.profile, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'job-autofill-profile.json';
    link.click();

    URL.revokeObjectURL(url);
  };

  const getStatusMessage = () => {
    if (!state.profileComplete) {
      return 'Please complete your profile to use autofill';
    }

    switch (state.autofillStatus) {
      case 'analyzing':
        return 'Analyzing page for forms...';
      case 'filling':
        return 'Filling out form...';
      case 'complete':
        return state.lastResult
          ? `Successfully filled ${state.lastResult.filledCount} of ${state.lastResult.totalFields} fields`
          : 'Form filled successfully';
      case 'error':
        return state.error || 'An error occurred';
      default:
        return 'Ready to fill forms on job application pages';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[700px] w-[480px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-[700px] w-[480px] flex-col',
        isLight ? 'bg-white text-gray-900' : 'bg-gray-900 text-gray-100',
      )}>
      {/* Header */}
      <div className={cn('flex-shrink-0 px-3 py-2', isLight ? 'bg-blue-600 text-white' : 'bg-blue-700 text-white')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <img src={chrome.runtime.getURL('icon-34.png')} alt="Apply Ninja" className="h-5 w-5" />
            <div>
              <h1 className="text-base font-semibold">Apply Ninja</h1>
              <p className="text-xs opacity-90">Manage your application data</p>
            </div>
          </div>
          <div className="ml-2">
            <button
              onClick={exampleThemeStorage.toggle}
              className="rounded p-1.5 transition-colors hover:bg-white/10"
              title={`Switch to ${isLight ? 'dark' : 'light'} mode`}>
              <span className="text-sm">{isLight ? '🌙' : '☀️'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save Status */}
      {state.saveStatus === 'saving' && (
        <div
          className="flex-shrink-0 bg-blue-100 p-2 text-center text-sm text-blue-800"
          role="status"
          aria-live="polite">
          <div className="flex items-center justify-center">
            <div
              className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
              aria-hidden="true"></div>
            Saving profile...
          </div>
        </div>
      )}
      {state.saveStatus === 'success' && (
        <div
          className="flex-shrink-0 bg-green-100 p-2 text-center text-sm text-green-800"
          role="status"
          aria-live="polite">
          <div className="flex items-center justify-center">
            <span className="mr-2" aria-hidden="true">
              ✓
            </span>
            Profile saved successfully!
          </div>
        </div>
      )}
      {state.saveStatus === 'error' && (
        <div
          className="flex-shrink-0 bg-red-100 p-2 text-center text-sm text-red-800"
          role="alert"
          aria-live="assertive">
          <div className="flex items-center justify-center">
            <span className="mr-2" aria-hidden="true">
              ✗
            </span>
            Failed to save profile. Please try again.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div
        className={cn('flex flex-shrink-0 border-b', isLight ? 'border-gray-200' : 'border-gray-700')}
        role="tablist"
        aria-label="Extension sections">
        <button
          onClick={() => setState(prev => ({ ...prev, activeTab: 'autofill' }))}
          role="tab"
          aria-selected={state.activeTab === 'autofill'}
          aria-controls="autofill-panel"
          id="autofill-tab"
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
            state.activeTab === 'autofill'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : isLight
                ? 'text-gray-600 hover:text-gray-800'
                : 'text-gray-400 hover:text-gray-200',
          )}>
          Autofill
        </button>
        <button
          onClick={() => setState(prev => ({ ...prev, activeTab: 'profile' }))}
          role="tab"
          aria-selected={state.activeTab === 'profile'}
          aria-controls="profile-panel"
          id="profile-tab"
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
            state.activeTab === 'profile'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : isLight
                ? 'text-gray-600 hover:text-gray-800'
                : 'text-gray-400 hover:text-gray-200',
          )}>
          Profile
        </button>
        <button
          onClick={() => setState(prev => ({ ...prev, activeTab: 'settings' }))}
          role="tab"
          aria-selected={state.activeTab === 'settings'}
          aria-controls="settings-panel"
          id="settings-tab"
          className={cn(
            'flex-1 px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
            state.activeTab === 'settings'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : isLight
                ? 'text-gray-600 hover:text-gray-800'
                : 'text-gray-400 hover:text-gray-200',
          )}>
          Settings
        </button>
      </div>

      {/* Content - Scrollable Area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-3 sm:p-4">
          <div
            role="tabpanel"
            id="autofill-panel"
            aria-labelledby="autofill-tab"
            hidden={state.activeTab !== 'autofill'}>
            {state.activeTab === 'autofill' && renderAutofillTab()}
          </div>
          <div role="tabpanel" id="profile-panel" aria-labelledby="profile-tab" hidden={state.activeTab !== 'profile'}>
            {state.activeTab === 'profile' && renderProfileTab()}
          </div>
          <div
            role="tabpanel"
            id="settings-panel"
            aria-labelledby="settings-tab"
            hidden={state.activeTab !== 'settings'}>
            {state.activeTab === 'settings' && renderSettingsTab()}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className={cn(
          'flex-shrink-0 border-t px-3 py-1.5',
          isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800',
        )}>
        <div className={cn('flex items-center justify-between text-xs', isLight ? 'text-gray-600' : 'text-gray-400')}>
          <span>v0.5.0</span>
          <button
            onClick={handleOpenOptions}
            className={cn('transition-colors hover:underline', isLight ? 'text-blue-600' : 'text-blue-400')}>
            Advanced Settings
          </button>
        </div>
      </div>
    </div>
  );

  function renderAutofillTab() {
    return (
      <div className="space-y-4">
        {/* Profile Status */}
        {!state.profileComplete && (
          <div
            className={cn(
              'rounded-lg border p-3',
              isLight
                ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
                : 'border-yellow-700 bg-yellow-900/20 text-yellow-300',
            )}>
            <p className="text-sm">Please complete your profile to use autofill features.</p>
            <div className="mt-2 flex space-x-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setState(prev => ({ ...prev, activeTab: 'profile' }))}
                className="flex-1">
                Complete Profile
              </Button>
              <Button variant="outline" size="sm" onClick={initializePopup} className="px-3">
                ↻
              </Button>
            </div>
          </div>
        )}

        {/* Current Page Info */}
        <div
          className={cn(
            'rounded-lg border p-3',
            isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800',
          )}>
          <div className="mb-2 flex items-center space-x-2">
            <div className={cn('h-2 w-2 rounded-full', state.currentTab ? 'bg-green-500' : 'bg-red-500')} />
            <span className="text-sm font-medium">{state.currentTab ? 'Page Active' : 'No Active Page'}</span>
          </div>
          {state.currentTab && (
            <p className="truncate text-xs text-gray-600 dark:text-gray-400">{state.currentTab.title}</p>
          )}
        </div>

        {/* Fill Out Button */}
        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            onClick={handleFillOutForm}
            disabled={
              !state.profileComplete || state.autofillStatus === 'analyzing' || state.autofillStatus === 'filling'
            }
            className="w-full transition-all duration-200 hover:scale-105 active:scale-95">
            {(state.autofillStatus === 'analyzing' || state.autofillStatus === 'filling') && (
              <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
            )}
            Fill Out Form
          </Button>

          <p
            className={cn(
              'text-center text-xs',
              state.autofillStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400',
            )}>
            {getStatusMessage()}
          </p>
        </div>

        {/* Last Result */}
        {state.lastResult && state.autofillStatus === 'complete' && (
          <div
            className={cn(
              'rounded-lg border p-3',
              isLight
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-green-700 bg-green-900/20 text-green-300',
            )}>
            <div className="text-sm">
              <div className="font-medium">Autofill Complete</div>
              <div className="mt-1 space-y-1">
                <div>
                  Fields filled: {state.lastResult.filledCount}/{state.lastResult.totalFields}
                </div>
                <div>Platform: {state.lastResult.platform}</div>
                <div>Duration: {state.lastResult.duration}ms</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderProfileTab() {
    return (
      <div>
        {state.profile &&
        state.profile.personalInfo &&
        (state.profile.personalInfo.firstName || state.profile.personalInfo.email) &&
        !state.showEditForm ? (
          <ProfileView
            profile={state.profile}
            onEdit={() => setState(prev => ({ ...prev, showEditForm: true }))}
            onExport={exportProfile}
          />
        ) : (
          <ProfileForm
            profile={state.profile}
            onSave={handleProfileUpdate}
            onCancel={() => setState(prev => ({ ...prev, showEditForm: false }))}
          />
        )}
      </div>
    );
  }

  function renderSettingsTab() {
    return <SettingsView onImport={handleProfileImport} />;
  }
};
