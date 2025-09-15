import React, { useState, useEffect } from 'react';
import { Button, LoadingSpinner, cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { AISettings, AITokenValidationResult } from '@extension/shared';

interface AIConfigurationManagerProps {
  onSettingsChange?: (settings: AISettings) => void;
}

export const AIConfigurationManager: React.FC<AIConfigurationManagerProps> = ({
  onSettingsChange,
}) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<AITokenValidationResult | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);

  // Load AI settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const { aiSettingsStorage } = await import('@extension/storage');
        
        const currentSettings = await aiSettingsStorage.get();
        const tokenExists = await aiSettingsStorage.hasToken();
        
        setSettings(currentSettings);
        setHasToken(tokenExists);
        
        if (onSettingsChange) {
          onSettingsChange(currentSettings);
        }
      } catch (error) {
        console.error('Failed to load AI settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [onSettingsChange]);

  const handleTokenValidation = async () => {
    if (!tokenInput.trim()) {
      setValidationResult({
        isValid: false,
        error: 'Please enter an API token',
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const { aiSettingsStorage } = await import('@extension/storage');
      const result = await aiSettingsStorage.validateToken(tokenInput);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveToken = async () => {
    if (!validationResult?.isValid) {
      await handleTokenValidation();
      return;
    }

    setIsSaving(true);
    try {
      const { aiSettingsStorage } = await import('@extension/storage');
      await aiSettingsStorage.setToken(tokenInput);
      
      const updatedSettings = await aiSettingsStorage.get();
      setSettings(updatedSettings);
      setHasToken(true);
      setTokenInput('');
      setValidationResult(null);
      
      if (onSettingsChange) {
        onSettingsChange(updatedSettings);
      }
    } catch (error) {
      console.error('Failed to save token:', error);
      setValidationResult({
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to save token',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteToken = async () => {
    try {
      const { aiSettingsStorage } = await import('@extension/storage');
      await aiSettingsStorage.deleteToken();
      
      const updatedSettings = await aiSettingsStorage.get();
      setSettings(updatedSettings);
      setHasToken(false);
      setShowDeleteConfirm(false);
      setTokenInput('');
      setValidationResult(null);
      
      if (onSettingsChange) {
        onSettingsChange(updatedSettings);
      }
    } catch (error) {
      console.error('Failed to delete token:', error);
    }
  };

  const handleToggleAIMode = async () => {
    if (!settings) return;

    try {
      const { aiSettingsStorage } = await import('@extension/storage');
      
      if (settings.enabled) {
        await aiSettingsStorage.disableAI();
      } else {
        await aiSettingsStorage.enableAI();
      }
      
      const updatedSettings = await aiSettingsStorage.get();
      setSettings(updatedSettings);
      
      if (onSettingsChange) {
        onSettingsChange(updatedSettings);
      }
    } catch (error) {
      console.error('Failed to toggle AI mode:', error);
    }
  };

  const handleModelChange = async (model: AISettings['model']) => {
    if (!settings) return;

    try {
      const { aiSettingsStorage } = await import('@extension/storage');
      await aiSettingsStorage.updateModel(model);
      
      const updatedSettings = await aiSettingsStorage.get();
      setSettings(updatedSettings);
      
      if (onSettingsChange) {
        onSettingsChange(updatedSettings);
      }
    } catch (error) {
      console.error('Failed to update model:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center space-x-3">
          <LoadingSpinner />
          <span className={cn(isLight ? 'text-gray-600' : 'text-gray-400')}>
            Loading AI configuration...
          </span>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className={cn(
        'border rounded-lg p-6',
        isLight ? 'border-red-200 bg-red-50' : 'border-red-800 bg-red-900/20'
      )}>
        <p className={cn(isLight ? 'text-red-800' : 'text-red-200')}>
          Failed to load AI configuration. Please refresh the page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className={cn(
          'text-lg font-medium mb-2',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>
          AI-Powered Smart Autofill
        </h3>
        <p className={cn(
          'text-sm',
          isLight ? 'text-gray-600' : 'text-gray-400'
        )}>
          Enable AI Mode to unlock intelligent form analysis and automated filling using OpenAI's language models.
        </p>
      </div>

      {/* AI Mode Toggle */}
      <div className={cn(
        'border rounded-lg p-4',
        isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className={cn(
              'font-medium',
              isLight ? 'text-gray-900' : 'text-gray-100'
            )}>
              AI Mode
            </h4>
            <p className={cn(
              'text-sm mt-1',
              isLight ? 'text-gray-600' : 'text-gray-400'
            )}>
              {settings.enabled && hasToken 
                ? 'AI-powered autofill is active' 
                : 'Traditional autofill mode'}
            </p>
          </div>
          
          <button
            onClick={handleToggleAIMode}
            disabled={!hasToken}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              settings.enabled && hasToken
                ? 'bg-blue-600'
                : 'bg-gray-200',
              !hasToken && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                settings.enabled && hasToken ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
        
        {!hasToken && (
          <p className={cn(
            'text-xs mt-2',
            isLight ? 'text-yellow-600' : 'text-yellow-400'
          )}>
            Add an OpenAI API token to enable AI Mode
          </p>
        )}
      </div>

      {/* Token Configuration */}
      <div className={cn(
        'border rounded-lg p-4',
        isLight ? 'border-gray-200' : 'border-gray-700'
      )}>
        <h4 className={cn(
          'font-medium mb-3',
          isLight ? 'text-gray-900' : 'text-gray-100'
        )}>
          OpenAI API Token
        </h4>
        
        {hasToken ? (
          <div className="space-y-3">
            <div className={cn(
              'flex items-center space-x-2 p-3 rounded-md',
              isLight ? 'bg-green-50 border border-green-200' : 'bg-green-900/20 border border-green-800'
            )}>
              <div className={cn(
                'w-2 h-2 rounded-full',
                isLight ? 'bg-green-500' : 'bg-green-400'
              )} />
              <span className={cn(
                'text-sm font-medium',
                isLight ? 'text-green-800' : 'text-green-200'
              )}>
                API token is configured and secure
              </span>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Delete Token
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className={cn(
                'block text-sm font-medium mb-2',
                isLight ? 'text-gray-700' : 'text-gray-300'
              )}>
                Enter your OpenAI API token
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="sk-..."
                className={cn(
                  'w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                  isLight 
                    ? 'border-gray-300 bg-white text-gray-900' 
                    : 'border-gray-600 bg-gray-700 text-gray-100'
                )}
              />
            </div>
            
            {validationResult && (
              <div className={cn(
                'p-3 rounded-md text-sm',
                validationResult.isValid
                  ? isLight 
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-green-900/20 border border-green-800 text-green-200'
                  : isLight
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-red-900/20 border border-red-800 text-red-200'
              )}>
                {validationResult.isValid ? (
                  <div className="flex items-center space-x-2">
                    <span>✓</span>
                    <span>Token is valid and ready to use</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>✗</span>
                    <span>{validationResult.error}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex space-x-2">
              <Button
                onClick={handleTokenValidation}
                disabled={isValidating || !tokenInput.trim()}
                loading={isValidating}
                variant="outline"
                size="sm"
              >
                {isValidating ? 'Validating...' : 'Validate Token'}
              </Button>
              
              <Button
                onClick={handleSaveToken}
                disabled={isSaving || !tokenInput.trim()}
                loading={isSaving}
                size="sm"
              >
                {isSaving ? 'Saving...' : 'Save Token'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Model Configuration */}
      {hasToken && (
        <div className={cn(
          'border rounded-lg p-4',
          isLight ? 'border-gray-200' : 'border-gray-700'
        )}>
          <h4 className={cn(
            'font-medium mb-3',
            isLight ? 'text-gray-900' : 'text-gray-100'
          )}>
            AI Model Settings
          </h4>
          
          <div className="space-y-3">
            <div>
              <label className={cn(
                'block text-sm font-medium mb-2',
                isLight ? 'text-gray-700' : 'text-gray-300'
              )}>
                Model
              </label>
              <select
                value={settings.model}
                onChange={(e) => handleModelChange(e.target.value as AISettings['model'])}
                className={cn(
                  'w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                  isLight 
                    ? 'border-gray-300 bg-white text-gray-900' 
                    : 'border-gray-600 bg-gray-700 text-gray-100'
                )}
              >
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster, Lower Cost)</option>
                <option value="gpt-4">GPT-4 (More Accurate, Higher Cost)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={cn(
            'rounded-lg p-6 max-w-md w-full mx-4',
            isLight ? 'bg-white' : 'bg-gray-800'
          )}>
            <h3 className={cn(
              'text-lg font-medium mb-2',
              isLight ? 'text-gray-900' : 'text-gray-100'
            )}>
              Delete API Token
            </h3>
            <p className={cn(
              'text-sm mb-4',
              isLight ? 'text-gray-600' : 'text-gray-400'
            )}>
              Are you sure you want to delete your OpenAI API token? This will disable AI Mode and you'll need to re-enter your token to use AI features again.
            </p>
            
            <div className="flex space-x-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteToken}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Token
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};