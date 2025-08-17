import React, { useState } from 'react';
import { cn, Button, ToggleButton } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

interface QuickSettingsProps {}

export const QuickSettings: React.FC<QuickSettingsProps> = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [isExpanded, setIsExpanded] = useState(false);
  const [settings, setSettings] = useState({
    autoDetectForms: true,
    enableAIContent: true,
    showNotifications: true,
    autoUploadResume: true
  });

  const handleSettingChange = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    
    // Send message to background script to update settings
    chrome.runtime.sendMessage({
      type: 'settings:update',
      source: 'popup',
      data: { [key]: !settings[key] },
      id: `popup_${Date.now()}`,
      timestamp: Date.now()
    });
  };

  const handleOpenFullSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className={cn(
      'border rounded-lg',
      isLight ? 'border-gray-200' : 'border-gray-700'
    )}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full p-3 flex items-center justify-between text-left hover:bg-opacity-50 transition-colors',
          isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
        )}
      >
        <div className="flex items-center space-x-2">
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
          <span className="text-sm font-medium">Quick Settings</span>
        </div>
        <svg 
          className={cn(
            'w-4 h-4 transition-transform',
            isExpanded ? 'rotate-180' : ''
          )}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M19 9l-7 7-7-7" 
          />
        </svg>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className={cn(
          'border-t p-3 space-y-3',
          isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'
        )}>
          {/* Auto Detect Forms */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-detect Forms</p>
              <p className="text-xs text-gray-500">Automatically scan pages for job application forms</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoDetectForms}
                onChange={() => handleSettingChange('autoDetectForms')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Enable AI Content */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">AI Content Generation</p>
              <p className="text-xs text-gray-500">Use AI to generate cover letters and responses</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableAIContent}
                onChange={() => handleSettingChange('enableAIContent')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Show Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-xs text-gray-500">Show notifications for autofill status</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showNotifications}
                onChange={() => handleSettingChange('showNotifications')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Auto Upload Resume */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-upload Resume</p>
              <p className="text-xs text-gray-500">Automatically attach resume to file upload fields</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoUploadResume}
                onChange={() => handleSettingChange('autoUploadResume')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Full Settings Button */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenFullSettings}
              className="w-full text-xs"
            >
              <svg 
                className="w-3 h-3 mr-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" 
                />
              </svg>
              Open Full Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};