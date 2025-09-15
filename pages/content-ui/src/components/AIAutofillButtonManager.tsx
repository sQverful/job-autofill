import React, { useState, useEffect, useCallback } from 'react';
import { AIAutofillButton } from './AIAutofillButton';
import type { AIAutofillProgress, AISettings } from '@extension/shared';

interface AIAutofillButtonManagerProps {
  onAIAutofillStart?: () => void;
  onAIAutofillComplete?: (result: any) => void;
  onAIAutofillError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * React component that manages the AI autofill button state and interactions
 */
export const AIAutofillButtonManager: React.FC<AIAutofillButtonManagerProps> = ({
  onAIAutofillStart,
  onAIAutofillComplete,
  onAIAutofillError,
  className,
  style
}) => {
  const [aiModeEnabled, setAIModeEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<AIAutofillProgress | null>(null);
  const [hasValidToken, setHasValidToken] = useState(false);
  const [formsDetected, setFormsDetected] = useState(false);

  // Check AI Mode status on mount
  useEffect(() => {
    checkAIModeStatus();
    detectForms();
    setupStorageListener();
    setupMessageListener();
  }, []);

  /**
   * Check current AI Mode status
   */
  const checkAIModeStatus = useCallback(async () => {
    try {
      const { aiSettingsStorage } = await import('@extension/storage');
      const settings = await aiSettingsStorage.get();
      setAIModeEnabled(settings.enabled);
      const hasToken = await aiSettingsStorage.hasToken();
      setHasValidToken(hasToken);
    } catch (error) {
      console.error('[AIAutofillButtonManager] Failed to check AI Mode status:', error);
      setAIModeEnabled(false);
      setHasValidToken(false);
    }
  }, []);

  /**
   * Detect forms on the current page
   */
  const detectForms = useCallback(() => {
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    
    // Consider page to have forms if there are form elements or standalone inputs
    const hasFormElements = forms.length > 0 || inputs.length >= 3;
    
    // Additional checks for job application indicators
    const url = window.location.href.toLowerCase();
    const hasJobKeywords = ['apply', 'application', 'job', 'career', 'position'].some(keyword => 
      url.includes(keyword)
    );
    
    const pageText = document.body.textContent?.toLowerCase() || '';
    const hasJobContent = ['apply now', 'submit application', 'job application'].some(phrase =>
      pageText.includes(phrase)
    );

    const detected = hasFormElements && (hasJobKeywords || hasJobContent || forms.length > 0);
    setFormsDetected(detected);
  }, []);

  /**
   * Set up storage change listener
   */
  const setupStorageListener = useCallback(() => {
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.aiSettings) {
        const newSettings = changes.aiSettings.newValue as AISettings;
        setAIModeEnabled(newSettings?.enabled || false);
        setHasValidToken(!!newSettings?.apiToken);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  /**
   * Set up message listener for real-time updates
   */
  const setupMessageListener = useCallback(() => {
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
      switch (message.type) {
        case 'ai-mode-changed':
          setAIModeEnabled(message.enabled);
          break;
        case 'ai-autofill-progress':
          setProgress(message.progress);
          break;
        case 'forms-detected':
          setFormsDetected(message.detected);
          break;
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  /**
   * Handle AI autofill button click
   */
  const handleAIAutofillClick = useCallback(async () => {
    if (!aiModeEnabled || !hasValidToken) {
      // Open settings to configure AI Mode
      chrome.runtime.sendMessage({
        type: 'open-options',
        section: 'ai-settings'
      });
      return;
    }

    if (isLoading) {
      return; // Prevent multiple clicks during processing
    }

    setIsLoading(true);
    setProgress({
      stage: 'analyzing',
      progress: 0,
      message: 'Starting AI autofill...'
    });

    try {
      onAIAutofillStart?.();

      // Import AI autofill controller dynamically
      const { aiAutofillController } = await import('../../../content/src/ai-autofill-controller.js');
      
      // Set up progress tracking
      const progressHandler = (progressUpdate: AIAutofillProgress) => {
        setProgress(progressUpdate);
      };
      
      aiAutofillController.onProgress(progressHandler);

      try {
        // Perform AI autofill
        const result = await aiAutofillController.performAIAutofill();
        
        setProgress({
          stage: 'completed',
          progress: 100,
          message: `Completed: ${result.successfulInstructions}/${result.totalInstructions} fields filled`
        });

        onAIAutofillComplete?.(result);

        // Clear progress after a delay
        setTimeout(() => {
          setProgress(null);
        }, 3000);

      } finally {
        aiAutofillController.offProgress(progressHandler);
      }

    } catch (error: any) {
      console.error('[AIAutofillButtonManager] AI autofill failed:', error);
      
      setProgress({
        stage: 'error',
        progress: 0,
        message: `AI autofill failed: ${error.message}`
      });

      onAIAutofillError?.(error);

      // Clear error progress after a delay
      setTimeout(() => {
        setProgress(null);
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  }, [aiModeEnabled, hasValidToken, isLoading, onAIAutofillStart, onAIAutofillComplete, onAIAutofillError]);

  /**
   * Handle cancel operation
   */
  const handleCancel = useCallback(async () => {
    try {
      const { aiAutofillController } = await import('../../../content/src/ai-autofill-controller.js');
      aiAutofillController.cancel();
      
      setIsLoading(false);
      setProgress({
        stage: 'error',
        progress: 0,
        message: 'AI autofill cancelled'
      });

      // Clear progress after a delay
      setTimeout(() => {
        setProgress(null);
      }, 2000);
    } catch (error) {
      console.error('[AIAutofillButtonManager] Failed to cancel AI autofill:', error);
    }
  }, []);

  // Don't render if no forms are detected
  if (!formsDetected) {
    return null;
  }

  const isDisabled = !aiModeEnabled || !hasValidToken;

  return (
    <div className={className} style={style}>
      <AIAutofillButton
        onClick={handleAIAutofillClick}
        disabled={isDisabled && !isLoading}
        isLoading={isLoading}
        progress={progress}
        onCancel={isLoading ? handleCancel : undefined}
        aiModeEnabled={aiModeEnabled}
      />
      
      {/* Additional status information */}
      {!aiModeEnabled && formsDetected && (
        <div className="mt-2 text-xs text-gray-600 text-center">
          <span>Enable AI Mode in settings for intelligent autofill</span>
        </div>
      )}
      
      {aiModeEnabled && !hasValidToken && (
        <div className="mt-2 text-xs text-red-600 text-center">
          <span>Configure OpenAI API token in settings</span>
        </div>
      )}
    </div>
  );
};