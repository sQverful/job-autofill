import React, { useState, useEffect } from 'react';
import { cn, Button, LoadingSpinner } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage, profileStorage } from '@extension/storage';
import type { UserProfile } from '@extension/shared';

interface PopupState {
  currentTab: chrome.tabs.Tab | null;
  profile: UserProfile | null;
  profileComplete: boolean;
  autofillStatus: 'idle' | 'analyzing' | 'filling' | 'complete' | 'error';
  error: string | null;
  lastResult: AutofillResult | null;
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
    lastResult: null
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
        email: profile?.personalInfo?.email 
      });
      
      setState(prev => ({
        ...prev,
        currentTab: tab,
        profile,
        profileComplete
      }));

    } catch (error) {
      console.error('Failed to initialize popup:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to initialize extension'
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

      chrome.tabs.sendMessage(state.currentTab.id, message, (response) => {
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
        data: { tabId: state.currentTab.id }
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
            duration: result.duration
          }
        }));
      } else {
        throw new Error(result.error || 'Autofill failed');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        autofillStatus: 'error',
        error: error instanceof Error ? error.message : 'Failed to fill form'
      }));
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
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
      <div className="flex items-center justify-center h-96 w-80">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={cn(
      'w-80 min-h-96 p-4 space-y-4',
      isLight ? 'bg-white text-gray-900' : 'bg-gray-900 text-gray-100'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <img 
            src={chrome.runtime.getURL('icon-34.png')} 
            alt="Job Autofill" 
            className="w-6 h-6"
          />
          <h1 className="text-lg font-semibold">Job Autofill</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenOptions}
          className="text-xs"
        >
          Settings
        </Button>
      </div>

      {/* Profile Status */}
      {!state.profileComplete && (
        <div className={cn(
          'p-3 rounded-lg border',
          isLight ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-yellow-900/20 border-yellow-700 text-yellow-300'
        )}>
          <p className="text-sm">Please complete your profile to use autofill features.</p>
          <div className="flex space-x-2 mt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenOptions}
              className="flex-1"
            >
              Complete Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={initializePopup}
              className="px-3"
            >
              ↻
            </Button>
          </div>
        </div>
      )}

      {/* Current Page Info */}
      <div className={cn(
        'p-3 rounded-lg border',
        isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <div className="flex items-center space-x-2 mb-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            state.currentTab ? 'bg-green-500' : 'bg-red-500'
          )} />
          <span className="text-sm font-medium">
            {state.currentTab ? 'Page Active' : 'No Active Page'}
          </span>
        </div>
        {state.currentTab && (
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {state.currentTab.title}
          </p>
        )}
      </div>

      {/* Fill Out Button */}
      <div className="space-y-3">
        <Button
          variant="primary"
          size="lg"
          onClick={handleFillOutForm}
          disabled={!state.profileComplete || state.autofillStatus === 'analyzing' || state.autofillStatus === 'filling'}
          className="w-full"
        >
          {(state.autofillStatus === 'analyzing' || state.autofillStatus === 'filling') && (
            <div className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          )}
          Fill Out Form
        </Button>
        
        <p className={cn(
          'text-xs text-center',
          state.autofillStatus === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
        )}>
          {getStatusMessage()}
        </p>
      </div>

      {/* Last Result */}
      {state.lastResult && state.autofillStatus === 'complete' && (
        <div className={cn(
          'p-3 rounded-lg border',
          isLight ? 'bg-green-50 border-green-200 text-green-800' : 'bg-green-900/20 border-green-700 text-green-300'
        )}>
          <div className="text-sm">
            <div className="font-medium">Autofill Complete</div>
            <div className="mt-1 space-y-1">
              <div>Fields filled: {state.lastResult.filledCount}/{state.lastResult.totalFields}</div>
              <div>Platform: {state.lastResult.platform}</div>
              <div>Duration: {state.lastResult.duration}ms</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenOptions}
          className="w-full"
        >
          Manage Profile
        </Button>
      </div>
    </div>
  );
};