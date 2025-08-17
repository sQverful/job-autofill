/**
 * AI Content Indicator Component
 * 
 * Shows the status of AI content generation and provides quick actions
 */

import React from 'react';

interface AIContentIndicatorProps {
  status: 'idle' | 'generating' | 'success' | 'error' | 'unavailable';
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const AIContentIndicator: React.FC<AIContentIndicatorProps> = ({
  status,
  message,
  onRetry,
  onDismiss
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'generating':
        return '⏳';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'unavailable':
        return '⚠️';
      default:
        return '💡';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'generating':
        return 'Generating AI content...';
      case 'success':
        return 'Content generated successfully';
      case 'error':
        return message || 'Failed to generate content';
      case 'unavailable':
        return 'AI service unavailable';
      default:
        return 'AI assistance available';
    }
  };

  const getStatusClass = () => {
    return `ai-content-indicator ai-content-indicator--${status}`;
  };

  if (status === 'idle') return null;

  return (
    <div className={getStatusClass()}>
      <div className="ai-content-indicator-content">
        <span className="ai-content-indicator-icon">{getStatusIcon()}</span>
        <span className="ai-content-indicator-text">{getStatusText()}</span>
      </div>
      
      <div className="ai-content-indicator-actions">
        {status === 'error' && onRetry && (
          <button 
            className="ai-content-indicator-action ai-content-indicator-retry"
            onClick={onRetry}
            title="Retry generation"
          >
            🔄
          </button>
        )}
        
        {onDismiss && (
          <button 
            className="ai-content-indicator-action ai-content-indicator-dismiss"
            onClick={onDismiss}
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};