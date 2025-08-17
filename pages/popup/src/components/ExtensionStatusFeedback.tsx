import React, { useState } from 'react';
import { cn, Button } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

interface ExtensionStatusFeedbackProps {
  status: 'idle' | 'detecting' | 'filling' | 'complete' | 'error';
  progress: number;
  error: string | null;
}

export const ExtensionStatusFeedback: React.FC<ExtensionStatusFeedbackProps> = ({
  status,
  progress,
  error
}) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [showHelp, setShowHelp] = useState(false);

  const getStatusDisplay = () => {
    switch (status) {
      case 'detecting':
        return {
          icon: (
            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          title: 'Detecting Forms',
          description: 'Scanning the page for job application forms...',
          color: 'blue'
        };
      case 'filling':
        return {
          icon: (
            <svg className="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
          title: 'Filling Form',
          description: 'Populating form fields with your information...',
          color: 'blue'
        };
      case 'complete':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          title: 'Autofill Complete',
          description: 'Form has been successfully filled. Please review before submitting.',
          color: 'green'
        };
      case 'error':
        return {
          icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          title: 'Autofill Error',
          description: error || 'An error occurred during autofill. Please try again.',
          color: 'red'
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();

  const getProgressBarColor = () => {
    switch (status) {
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const handleRetry = () => {
    // Send retry message to background script
    chrome.runtime.sendMessage({
      type: 'autofill:retry',
      source: 'popup',
      id: `popup_${Date.now()}`,
      timestamp: Date.now()
    });
  };

  const handleReportIssue = () => {
    // Open issue reporting form or email
    const subject = encodeURIComponent('Job Autofill Extension Issue');
    const body = encodeURIComponent(`
Error Details:
- Status: ${status}
- Error: ${error || 'N/A'}
- URL: ${window.location.href}
- Timestamp: ${new Date().toISOString()}

Please describe the issue you encountered:
    `);
    
    chrome.tabs.create({
      url: `mailto:support@example.com?subject=${subject}&body=${body}`
    });
  };

  const handleOpenHelp = () => {
    chrome.tabs.create({
      url: 'https://help.example.com/job-autofill'
    });
  };

  // Don't show anything if idle
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Status Display */}
      {statusDisplay && (
        <div className={cn(
          'p-3 rounded-lg border',
          statusDisplay.color === 'green' && (isLight ? 'bg-green-50 border-green-200' : 'bg-green-900/20 border-green-700'),
          statusDisplay.color === 'blue' && (isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-700'),
          statusDisplay.color === 'red' && (isLight ? 'bg-red-50 border-red-200' : 'bg-red-900/20 border-red-700')
        )}>
          <div className="flex items-start space-x-3">
            <div className={cn(
              'flex-shrink-0 mt-0.5',
              statusDisplay.color === 'green' && 'text-green-600',
              statusDisplay.color === 'blue' && 'text-blue-600',
              statusDisplay.color === 'red' && 'text-red-600'
            )}>
              {statusDisplay.icon}
            </div>
            <div className="flex-1">
              <h4 className={cn(
                'text-sm font-medium',
                statusDisplay.color === 'green' && (isLight ? 'text-green-800' : 'text-green-300'),
                statusDisplay.color === 'blue' && (isLight ? 'text-blue-800' : 'text-blue-300'),
                statusDisplay.color === 'red' && (isLight ? 'text-red-800' : 'text-red-300')
              )}>
                {statusDisplay.title}
              </h4>
              <p className={cn(
                'text-xs mt-1',
                statusDisplay.color === 'green' && (isLight ? 'text-green-700' : 'text-green-400'),
                statusDisplay.color === 'blue' && (isLight ? 'text-blue-700' : 'text-blue-400'),
                statusDisplay.color === 'red' && (isLight ? 'text-red-700' : 'text-red-400')
              )}>
                {statusDisplay.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {(status === 'detecting' || status === 'filling') && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className={cn(
            'w-full bg-gray-200 rounded-full h-2',
            isLight ? 'bg-gray-200' : 'bg-gray-700'
          )}>
            <div
              className={cn('h-2 rounded-full transition-all duration-300', getProgressBarColor())}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success Actions */}
      {status === 'complete' && (
        <div className="space-y-2">
          <div className={cn(
            'p-2 rounded text-xs',
            isLight ? 'bg-green-100 text-green-800' : 'bg-green-900/30 text-green-300'
          )}>
            <p className="font-medium mb-1">✅ Next Steps:</p>
            <ul className="space-y-1 text-xs">
              <li>• Review all filled information for accuracy</li>
              <li>• Customize any AI-generated content</li>
              <li>• Upload additional documents if needed</li>
              <li>• Submit your application</li>
            </ul>
          </div>
        </div>
      )}

      {/* Error Actions */}
      {status === 'error' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="text-xs"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReportIssue}
              className="text-xs"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Report Issue
            </Button>
          </div>

          {/* Error Resolution Guidance */}
          <div className={cn(
            'p-2 rounded text-xs',
            isLight ? 'bg-red-100 text-red-800' : 'bg-red-900/30 text-red-300'
          )}>
            <p className="font-medium mb-1">🔧 Troubleshooting Tips:</p>
            <ul className="space-y-1 text-xs">
              <li>• Refresh the page and try again</li>
              <li>• Check if you're signed in to the extension</li>
              <li>• Ensure your profile is complete</li>
              <li>• Try filling the form manually if issues persist</li>
            </ul>
          </div>
        </div>
      )}

      {/* Help and Documentation */}
      <div className={cn(
        'border-t pt-3',
        isLight ? 'border-gray-200' : 'border-gray-700'
      )}>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={cn(
            'w-full flex items-center justify-between text-left text-sm hover:bg-opacity-50 transition-colors p-2 rounded',
            isLight ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
          )}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Help & Documentation</span>
          </div>
          <svg 
            className={cn(
              'w-4 h-4 transition-transform',
              showHelp ? 'rotate-180' : ''
            )}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showHelp && (
          <div className={cn(
            'mt-2 p-3 rounded border space-y-2',
            isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
          )}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenHelp}
              className="w-full text-xs justify-start"
            >
              <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              User Guide
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => chrome.tabs.create({ url: 'https://help.example.com/faq' })}
              className="w-full text-xs justify-start"
            >
              <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              FAQ
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => chrome.tabs.create({ url: 'https://help.example.com/contact' })}
              className="w-full text-xs justify-start"
            >
              <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Support
            </Button>

            <div className={cn(
              'pt-2 border-t text-xs',
              isLight ? 'border-gray-200 text-gray-500' : 'border-gray-600 text-gray-400'
            )}>
              <p>Need help? Our support team is here to assist you with any issues or questions.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};