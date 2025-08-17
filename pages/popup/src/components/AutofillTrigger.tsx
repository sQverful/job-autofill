import React from 'react';
import { cn, Button } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

interface AutofillTriggerProps {
  formDetected: boolean;
  autofillStatus: 'idle' | 'detecting' | 'filling' | 'complete' | 'error';
  onTrigger: () => void;
  disabled: boolean;
}

export const AutofillTrigger: React.FC<AutofillTriggerProps> = ({
  formDetected,
  autofillStatus,
  onTrigger,
  disabled
}) => {
  const { isLight } = useStorage(exampleThemeStorage);

  const getButtonText = (): string => {
    switch (autofillStatus) {
      case 'detecting':
        return 'Detecting Forms...';
      case 'filling':
        return 'Filling Form...';
      case 'complete':
        return 'Autofill Complete';
      case 'error':
        return 'Retry Autofill';
      default:
        return formDetected ? 'Fill Application' : 'No Form Detected';
    }
  };

  const getButtonVariant = (): 'primary' | 'secondary' | 'danger' | 'outline' => {
    switch (autofillStatus) {
      case 'complete':
        return 'secondary';
      case 'error':
        return 'danger';
      default:
        return 'primary';
    }
  };

  const isLoading = autofillStatus === 'detecting' || autofillStatus === 'filling';

  return (
    <div className="space-y-3">
      {/* Main Autofill Button */}
      <Button
        variant={getButtonVariant()}
        size="lg"
        onClick={onTrigger}
        disabled={disabled}
        loading={isLoading}
        className="w-full"
      >
        {!isLoading && (
          <svg 
            className="w-4 h-4 mr-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
        )}
        {getButtonText()}
      </Button>

      {/* Quick Actions */}
      {formDetected && autofillStatus === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {/* Handle partial fill */}}
            className="text-xs"
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
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
              />
            </svg>
            Basic Info
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {/* Handle AI content */}}
            className="text-xs"
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
                d="M13 10V3L4 14h7v7l9-11h-7z" 
              />
            </svg>
            AI Content
          </Button>
        </div>
      )}

      {/* Success Message */}
      {autofillStatus === 'complete' && (
        <div className={cn(
          'p-3 rounded-lg border flex items-center space-x-2',
          isLight ? 'bg-green-50 border-green-200 text-green-800' : 'bg-green-900/20 border-green-700 text-green-300'
        )}>
          <svg 
            className="w-4 h-4 flex-shrink-0" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 13l4 4L19 7" 
            />
          </svg>
          <div>
            <p className="text-sm font-medium">Autofill Complete!</p>
            <p className="text-xs">Please review the filled information before submitting.</p>
          </div>
        </div>
      )}

      {/* Tips */}
      {formDetected && autofillStatus === 'idle' && (
        <div className={cn(
          'p-2 rounded text-xs',
          isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/20 text-blue-300'
        )}>
          <p className="font-medium mb-1">💡 Pro Tip:</p>
          <p>Review and customize filled information before submitting your application.</p>
        </div>
      )}
    </div>
  );
};