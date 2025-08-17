import React, { useState, useEffect } from 'react';
import { cn, Button, LoadingSpinner } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { PageStatusDisplay } from './PageStatusDisplay';
import { AutofillTrigger } from './AutofillTrigger';
import { QuickSettings } from './QuickSettings';
import { ActivitySummary } from './ActivitySummary';
import { ExtensionStatusFeedback } from './ExtensionStatusFeedback';
import type { 
  ExtensionMessage, 
  AutofillStatusMessage, 
  FormDetectedMessage,
  AuthStatusMessage,
  FormCheckMessage,
  ActivityRecentMessage,
  AutofillTriggerMessage
} from '../../../../chrome-extension/src/background/messaging/message-types';

interface PopupState {
  currentTab: chrome.tabs.Tab | null;
  isAuthenticated: boolean;
  formDetected: boolean;
  autofillStatus: 'idle' | 'detecting' | 'filling' | 'complete' | 'error';
  autofillProgress: number;
  error: string | null;
  platform: string | null;
  fieldCount: number;
  confidence: number;
  recentActions: RecentAction[];
}

interface RecentAction {
  id: string;
  type: 'autofill' | 'form_detected' | 'profile_updated';
  timestamp: Date;
  description: string;
  success: boolean;
}

export const AutofillControlPopup: React.FC = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [state, setState] = useState<PopupState>({
    currentTab: null,
    isAuthenticated: false,
    formDetected: false,
    autofillStatus: 'idle',
    autofillProgress: 0,
    error: null,
    platform: null,
    fieldCount: 0,
    confidence: 0,
    recentActions: []
  });
  const [loading, setLoading] = useState(true);

  // Initialize popup state
  useEffect(() => {
    initializePopup();
    setupMessageListeners();
    
    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  const initializePopup = async () => {
    try {
      setLoading(true);
      
      // Get current tab
      const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });
      
      // Set basic state first
      setState(prev => ({
        ...prev,
        currentTab: tab,
        isAuthenticated: false, // Default to false
        formDetected: false, // Default to false
        platform: null,
        fieldCount: 0,
        confidence: 0,
        recentActions: []
      }));

      // Try to get auth status with timeout
      try {
        const authResponse = await Promise.race([
          sendMessage({
            type: 'auth:status',
            source: 'popup'
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 2000))
        ]);
        
        setState(prev => ({
          ...prev,
          isAuthenticated: authResponse?.data?.isAuthenticated || false
        }));
      } catch (error) {
        console.warn('Auth check failed:', error);
      }

      // Try to check form detection with timeout
      if (tab.id) {
        try {
          const formResponse = await Promise.race([
            sendMessage({
              type: 'form:check',
              source: 'popup',
              data: { tabId: tab.id }
            } as FormCheckMessage),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Form check timeout')), 2000))
          ]);
          
          setState(prev => ({
            ...prev,
            formDetected: formResponse?.data?.detected || false,
            platform: formResponse?.data?.platform || null,
            fieldCount: formResponse?.data?.fieldCount || 0,
            confidence: formResponse?.data?.confidence || 0
          }));
        } catch (error) {
          console.warn('Form check failed:', error);
        }
      }

      // Try to get recent actions with timeout
      try {
        const actionsResponse = await Promise.race([
          sendMessage({
            type: 'activity:recent',
            source: 'popup'
          } as ActivityRecentMessage),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Activity timeout')), 2000))
        ]);
        
        setState(prev => ({
          ...prev,
          recentActions: actionsResponse?.data?.actions || []
        }));
      } catch (error) {
        console.warn('Activity check failed:', error);
      }

    } catch (error) {
      console.error('Failed to initialize popup:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to initialize extension',
        currentTab: null,
        isAuthenticated: false,
        formDetected: false
      }));
    } finally {
      setLoading(false);
    }
  };

  const setupMessageListeners = () => {
    const handleMessage = (message: ExtensionMessage) => {
      switch (message.type) {
        case 'autofill:status':
          const statusMsg = message as AutofillStatusMessage;
          setState(prev => ({
            ...prev,
            autofillStatus: statusMsg.data.status,
            autofillProgress: statusMsg.data.progress || 0,
            error: statusMsg.data.error || null
          }));
          break;
          
        case 'form:detected':
          const formMsg = message as FormDetectedMessage;
          setState(prev => ({
            ...prev,
            formDetected: true,
            platform: formMsg.data.platform,
            fieldCount: formMsg.data.fieldCount,
            confidence: formMsg.data.confidence
          }));
          break;
          
        case 'auth:status':
          const authMsg = message as AuthStatusMessage;
          setState(prev => ({
            ...prev,
            isAuthenticated: authMsg.data.isAuthenticated
          }));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
  };

  const sendMessage = async (message: Omit<ExtensionMessage, 'id' | 'timestamp'>): Promise<any> => {
    return new Promise((resolve, reject) => {
      const fullMessage = {
        ...message,
        id: `popup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };

      chrome.runtime.sendMessage(fullMessage, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  };

  const handleAutofillTrigger = async () => {
    if (!state.currentTab?.id) return;
    
    try {
      setState(prev => ({ ...prev, autofillStatus: 'filling', error: null }));
      
      await sendMessage({
        type: 'autofill:trigger',
        source: 'popup',
        data: { tabId: state.currentTab.id! }
      } as AutofillTriggerMessage);
    } catch (error) {
      setState(prev => ({
        ...prev,
        autofillStatus: 'error',
        error: 'Failed to trigger autofill'
      }));
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
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

      {/* Authentication Status */}
      {!state.isAuthenticated && (
        <div className={cn(
          'p-3 rounded-lg border',
          isLight ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-yellow-900/20 border-yellow-700 text-yellow-300'
        )}>
          <p className="text-sm">Please sign in to use autofill features.</p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenOptions}
            className="mt-2 w-full"
          >
            Sign In
          </Button>
        </div>
      )}

      {/* Page Status Display */}
      <PageStatusDisplay
        currentTab={state.currentTab}
        formDetected={state.formDetected}
        platform={state.platform}
        fieldCount={state.fieldCount}
        confidence={state.confidence}
      />

      {/* Autofill Trigger */}
      {state.isAuthenticated && (
        <AutofillTrigger
          formDetected={state.formDetected}
          autofillStatus={state.autofillStatus}
          onTrigger={handleAutofillTrigger}
          disabled={!state.formDetected || state.autofillStatus === 'filling'}
        />
      )}

      {/* Extension Status and Feedback */}
      <ExtensionStatusFeedback
        status={state.autofillStatus}
        progress={state.autofillProgress}
        error={state.error}
      />

      {/* Quick Settings */}
      <QuickSettings />

      {/* Activity Summary */}
      <ActivitySummary actions={state.recentActions} />
    </div>
  );
};