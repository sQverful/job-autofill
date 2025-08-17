import React from 'react';
import { cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

interface PageStatusDisplayProps {
  currentTab: chrome.tabs.Tab | null;
  formDetected: boolean;
  platform: string | null;
  fieldCount: number;
  confidence: number;
}

export const PageStatusDisplay: React.FC<PageStatusDisplayProps> = ({
  currentTab,
  formDetected,
  platform,
  fieldCount,
  confidence
}) => {
  const { isLight } = useStorage(exampleThemeStorage);

  const getPlatformDisplayName = (platform: string | null): string => {
    switch (platform) {
      case 'linkedin': return 'LinkedIn';
      case 'indeed': return 'Indeed';
      case 'workday': return 'Workday';
      case 'custom': return 'Job Site';
      default: return 'Unknown';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return isLight ? 'text-green-600' : 'text-green-400';
    if (confidence >= 0.6) return isLight ? 'text-yellow-600' : 'text-yellow-400';
    return isLight ? 'text-red-600' : 'text-red-400';
  };

  const getConfidenceText = (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const isJobSite = currentTab?.url && (
    currentTab.url.includes('linkedin.com') ||
    currentTab.url.includes('indeed.com') ||
    currentTab.url.includes('workday.com') ||
    currentTab.url.includes('jobs') ||
    currentTab.url.includes('career')
  );

  return (
    <div className={cn(
      'p-3 rounded-lg border',
      isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
    )}>
      <h3 className="text-sm font-medium mb-2">Current Page Status</h3>
      
      {/* Page URL */}
      <div className="mb-2">
        <p className="text-xs text-gray-500 mb-1">Page:</p>
        <p className="text-sm truncate" title={currentTab?.url}>
          {currentTab?.title || 'Unknown Page'}
        </p>
      </div>

      {/* Form Detection Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">Form Detection:</span>
        <div className="flex items-center space-x-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            formDetected 
              ? 'bg-green-500' 
              : isJobSite 
                ? 'bg-yellow-500' 
                : 'bg-gray-400'
          )} />
          <span className="text-xs">
            {formDetected 
              ? 'Form Detected' 
              : isJobSite 
                ? 'Scanning...' 
                : 'No Form'
            }
          </span>
        </div>
      </div>

      {/* Platform and Details */}
      {formDetected && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Platform:</span>
            <span className="text-xs font-medium">
              {getPlatformDisplayName(platform)}
            </span>
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Fields Found:</span>
            <span className="text-xs font-medium">{fieldCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Confidence:</span>
            <div className="flex items-center space-x-1">
              <span className={cn('text-xs font-medium', getConfidenceColor(confidence))}>
                {getConfidenceText(confidence)}
              </span>
              <span className="text-xs text-gray-500">
                ({Math.round(confidence * 100)}%)
              </span>
            </div>
          </div>
        </>
      )}

      {/* No form detected message */}
      {!formDetected && isJobSite && (
        <div className={cn(
          'mt-2 p-2 rounded text-xs',
          isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/20 text-blue-300'
        )}>
          Navigate to a job application form to enable autofill.
        </div>
      )}

      {/* Not a job site message */}
      {!isJobSite && (
        <div className={cn(
          'mt-2 p-2 rounded text-xs',
          isLight ? 'bg-gray-100 text-gray-600' : 'bg-gray-700 text-gray-400'
        )}>
          Visit a supported job site (LinkedIn, Indeed, Workday) to use autofill.
        </div>
      )}
    </div>
  );
};