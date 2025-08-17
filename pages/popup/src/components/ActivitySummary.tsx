import React, { useState } from 'react';
import { cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

interface RecentAction {
  id: string;
  type: 'autofill' | 'form_detected' | 'profile_updated' | 'ai_generated' | 'error';
  timestamp: Date;
  description: string;
  success: boolean;
  details?: string;
}

interface ActivitySummaryProps {
  actions: RecentAction[];
}

export const ActivitySummary: React.FC<ActivitySummaryProps> = ({ actions }) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [isExpanded, setIsExpanded] = useState(false);

  const getActionIcon = (type: string, success: boolean) => {
    if (!success) {
      return (
        <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    }

    switch (type) {
      case 'autofill':
        return (
          <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      case 'form_detected':
        return (
          <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      case 'profile_updated':
        return (
          <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'ai_generated':
        return (
          <svg className="w-3 h-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      default:
        return (
          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const recentActions = actions.slice(0, isExpanded ? 10 : 3);

  if (actions.length === 0) {
    return (
      <div className={cn(
        'p-3 rounded-lg border text-center',
        isLight ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-gray-800 border-gray-700 text-gray-400'
      )}>
        <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">No recent activity</p>
        <p className="text-xs">Your autofill actions will appear here</p>
      </div>
    );
  }

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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <span className="text-sm font-medium">Recent Activity</span>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs',
            isLight ? 'bg-blue-100 text-blue-800' : 'bg-blue-900 text-blue-200'
          )}>
            {actions.length}
          </span>
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

      {/* Activity List */}
      {isExpanded && (
        <div className={cn(
          'border-t max-h-64 overflow-y-auto',
          isLight ? 'border-gray-200' : 'border-gray-700'
        )}>
          {recentActions.map((action, index) => (
            <div
              key={action.id}
              className={cn(
                'p-3 flex items-start space-x-3',
                index !== recentActions.length - 1 && (isLight ? 'border-b border-gray-100' : 'border-b border-gray-700'),
                isLight ? 'hover:bg-gray-50' : 'hover:bg-gray-800'
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getActionIcon(action.type, action.success)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {action.description}
                </p>
                {action.details && (
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {action.details}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {formatTimestamp(action.timestamp)}
                </p>
              </div>
            </div>
          ))}
          
          {actions.length > 10 && isExpanded && (
            <div className={cn(
              'p-3 text-center border-t',
              isLight ? 'border-gray-200 text-gray-500' : 'border-gray-700 text-gray-400'
            )}>
              <p className="text-xs">Showing last 10 activities</p>
            </div>
          )}
        </div>
      )}

      {/* Summary when collapsed */}
      {!isExpanded && recentActions.length > 0 && (
        <div className={cn(
          'border-t p-3',
          isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800'
        )}>
          <div className="space-y-2">
            {recentActions.map((action) => (
              <div key={action.id} className="flex items-center space-x-2">
                {getActionIcon(action.type, action.success)}
                <span className="text-xs truncate flex-1">{action.description}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {formatTimestamp(action.timestamp)}
                </span>
              </div>
            ))}
          </div>
          {actions.length > 3 && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              +{actions.length - 3} more activities
            </p>
          )}
        </div>
      )}
    </div>
  );
};