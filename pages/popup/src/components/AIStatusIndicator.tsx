import React, { useState, useEffect } from 'react';
import { cn, Button } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { AISettings } from '@extension/shared';

interface AIStatusIndicatorProps {
  onOpenSettings?: () => void;
}

export const AIStatusIndicator: React.FC<AIStatusIndicatorProps> = ({
  onOpenSettings,
}) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load AI settings and token status
  useEffect(() => {
    const loadAIStatus = async () => {
      try {
        setIsLoading(true);
        const { aiSettingsStorage } = await import('@extension/storage');
        
        const settings = await aiSettingsStorage.get();
        const tokenExists = await aiSettingsStorage.hasToken();
        
        setAISettings(settings);
        setHasToken(tokenExists);
      } catch (error) {
        console.error('Failed to load AI status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAIStatus();

    // Listen for storage changes to update AI status in real-time
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes['ai-settings'] || changes['ai-encrypted-token']) {
        loadAIStatus();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const handleToggleAIMode = async () => {
    if (!aiSettings || !hasToken) return;

    try {
      const { aiSettingsStorage } = await import('@extension/storage');
      
      if (aiSettings.enabled) {
        await aiSettingsStorage.disableAI();
      } else {
        await aiSettingsStorage.enableAI();
      }
      
      // Settings will be updated via storage change listener
    } catch (error) {
      console.error('Failed to toggle AI mode:', error);
    }
  };

  const getAIStatusInfo = () => {
    if (!hasToken) {
      return {
        status: 'no-token',
        label: 'AI Mode Unavailable',
        description: 'No API token configured',
        color: 'gray',
        canToggle: false,
      };
    }

    if (aiSettings?.enabled) {
      return {
        status: 'enabled',
        label: 'AI Mode Active',
        description: `Using ${aiSettings.model}`,
        color: 'green',
        canToggle: true,
      };
    }

    return {
      status: 'disabled',
      label: 'AI Mode Disabled',
      description: 'Traditional autofill active',
      color: 'yellow',
      canToggle: true,
    };
  };

  if (isLoading) {
    return (
      <div className={cn(
        'rounded-lg border p-3',
        isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'
      )}>
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" />
          <span className="text-sm">Loading AI status...</span>
        </div>
      </div>
    );
  }

  const statusInfo = getAIStatusInfo();

  return (
    <div className={cn(
      'rounded-lg border p-3',
      isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={cn(
            'h-2 w-2 rounded-full',
            statusInfo.color === 'green' && 'bg-green-500',
            statusInfo.color === 'yellow' && 'bg-yellow-500',
            statusInfo.color === 'gray' && 'bg-gray-400'
          )} />
          <div>
            <div className="text-sm font-medium">{statusInfo.label}</div>
            <div className={cn(
              'text-xs',
              isLight ? 'text-gray-600' : 'text-gray-400'
            )}>
              {statusInfo.description}
            </div>
          </div>
        </div>

        {statusInfo.canToggle && (
          <button
            onClick={handleToggleAIMode}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              aiSettings?.enabled && hasToken
                ? 'bg-blue-600'
                : 'bg-gray-300'
            )}
          >
            <span
              className={cn(
                'inline-block h-3 w-3 transform rounded-full bg-white transition-transform',
                aiSettings?.enabled && hasToken ? 'translate-x-5' : 'translate-x-1'
              )}
            />
          </button>
        )}
      </div>

      {statusInfo.status === 'no-token' && (
        <div className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenSettings}
            className="w-full text-xs"
          >
            Configure AI Settings
          </Button>
        </div>
      )}
    </div>
  );
};