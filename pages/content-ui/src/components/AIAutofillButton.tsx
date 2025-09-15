import React, { useState, useEffect } from 'react';
import type { AIAutofillProgress } from '@extension/shared';

interface AIAutofillButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  progress?: AIAutofillProgress | null;
  onCancel?: () => void;
  aiModeEnabled?: boolean;
}

export const AIAutofillButton: React.FC<AIAutofillButtonProps> = ({ 
  onClick, 
  disabled = false, 
  isLoading = false,
  progress = null,
  onCancel,
  aiModeEnabled = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [respectsReducedMotion, setRespectsReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setRespectsReducedMotion(prefersReducedMotion);
  }, []);

  const handleClick = () => {
    if (!disabled && !isLoading) {
      onClick();
    }
  };

  const handleCancel = () => {
    if (isLoading && onCancel) {
      onCancel();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isLoading && onCancel) {
        handleCancel();
      } else {
        handleClick();
      }
    }
  };

  const getButtonText = () => {
    if (!aiModeEnabled) return 'Enable AI Mode';
    if (isLoading && progress) {
      switch (progress.stage) {
        case 'analyzing':
          return 'AI Analyzing...';
        case 'executing':
          return 'AI Filling...';
        case 'completed':
          return 'Completed!';
        case 'error':
          return 'AI Failed';
        default:
          return 'Processing...';
      }
    }
    if (isLoading) return 'AI Processing...';
    if (disabled) return 'Set up AI first';
    return 'AI Autofill';
  };

  const getAriaLabel = () => {
    if (!aiModeEnabled) return 'Enable AI Mode in settings to use intelligent autofill';
    if (isLoading && progress) {
      return `AI autofill in progress: ${progress.message}. Press to cancel.`;
    }
    if (isLoading) return 'AI autofill in progress, press to cancel';
    if (disabled) return 'AI autofill disabled, configure OpenAI API token first';
    return 'Start AI-powered autofill process for detected forms';
  };

  const getProgressPercentage = () => {
    return progress?.progress || 0;
  };

  const getButtonColor = () => {
    if (!aiModeEnabled) return 'bg-purple-500 hover:bg-purple-600 active:bg-purple-700';
    if (disabled || isLoading) return 'bg-gray-400 cursor-not-allowed opacity-60';
    if (progress?.stage === 'error') return 'bg-red-500 hover:bg-red-600';
    if (progress?.stage === 'completed') return 'bg-green-500 hover:bg-green-600';
    return 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 active:from-blue-800 active:to-purple-800';
  };

  const showProgressBar = isLoading && progress && progress.progress > 0;

  return (
    <div className="relative">
      <button
        onClick={isLoading ? handleCancel : handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled && !isLoading}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        aria-label={getAriaLabel()}
        aria-describedby="ai-autofill-button-description"
        type="button"
        className={`
          w-full px-4 py-2 text-sm font-medium text-white rounded-md 
          transition-all duration-200 ease-out
          transform-gpu focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
          ${getButtonColor()}
          ${!respectsReducedMotion && isHovered && !disabled && !isLoading ? 'scale-105 shadow-lg' : 'scale-100 shadow-md'}
          ${!respectsReducedMotion && isPressed && !disabled ? 'scale-95' : ''}
          ${!disabled && !isLoading ? 'hover:shadow-purple-500/25' : ''}
          ${isLoading && !respectsReducedMotion ? 'animate-pulse' : ''}
          relative overflow-hidden
        `}
      >
        {/* Progress bar background */}
        {showProgressBar && (
          <div 
            className="absolute inset-0 bg-white/20 transition-all duration-300 ease-out"
            style={{ 
              width: `${getProgressPercentage()}%`,
              left: 0,
              top: 0,
              height: '100%'
            }}
            aria-hidden="true"
          />
        )}

        <div className="flex items-center justify-center relative z-10">
          {/* AI Icon */}
          <div className="mr-2 flex items-center">
            {isLoading ? (
              <div 
                className={`inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full ${
                  !respectsReducedMotion ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
            ) : (
              <svg 
                className="w-4 h-4" 
                fill="currentColor" 
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                <circle cx="16" cy="16" r="2" className="opacity-75"/>
                <circle cx="4" cy="16" r="2" className="opacity-75"/>
              </svg>
            )}
          </div>

          <span className={`transition-all duration-200 ${isLoading ? 'opacity-90' : 'opacity-100'}`}>
            {getButtonText()}
          </span>

          {/* Cancel icon when loading */}
          {isLoading && onCancel && (
            <div className="ml-2 opacity-75">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>

        <span id="ai-autofill-button-description" className="sr-only">
          {!aiModeEnabled 
            ? 'Enable AI Mode in extension settings to use OpenAI-powered intelligent form filling'
            : disabled 
              ? 'Configure your OpenAI API token in the extension settings to enable AI autofill functionality'
              : 'Automatically fills detected job application forms using AI analysis of your profile information'
          }
        </span>
      </button>

      {/* Progress details */}
      {showProgressBar && progress && (
        <div className="mt-2 text-xs text-gray-600">
          <div className="flex justify-between items-center">
            <span className="truncate">{progress.message}</span>
            <span className="ml-2 font-mono">{Math.round(progress.progress)}%</span>
          </div>
          {progress.estimatedTimeRemaining && progress.estimatedTimeRemaining > 0 && (
            <div className="text-gray-500 mt-1">
              ~{Math.ceil(progress.estimatedTimeRemaining / 1000)}s remaining
            </div>
          )}
        </div>
      )}

      {/* Current instruction details */}
      {progress?.currentInstruction && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
          <div className="font-medium text-gray-700">Current action:</div>
          <div className="text-gray-600 truncate">
            {progress.currentInstruction.action} - {progress.currentInstruction.selector}
          </div>
          {progress.currentInstruction.reasoning && (
            <div className="text-gray-500 mt-1 text-xs">
              {progress.currentInstruction.reasoning}
            </div>
          )}
        </div>
      )}
    </div>
  );
};