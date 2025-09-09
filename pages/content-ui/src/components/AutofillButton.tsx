import React, { useState } from 'react';

interface AutofillButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const AutofillButton: React.FC<AutofillButtonProps> = ({ 
  onClick, 
  disabled = false, 
  isLoading = false 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [respectsReducedMotion, setRespectsReducedMotion] = useState(false);

  // Check for reduced motion preference
  React.useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setRespectsReducedMotion(prefersReducedMotion);
  }, []);

  const handleClick = () => {
    if (!disabled && !isLoading) {
      onClick();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  const getAriaLabel = () => {
    if (isLoading) return 'Autofill in progress, please wait';
    if (disabled) return 'Autofill disabled, complete your profile first';
    return 'Start autofill process for detected forms';
  };

  return (
    <button
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      aria-label={getAriaLabel()}
      aria-describedby="autofill-button-description"
      type="button"
      className={`
        w-full px-4 py-2 text-sm font-medium text-white rounded-md 
        transition-all duration-200 ease-out
        transform-gpu focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${disabled || isLoading
          ? 'bg-gray-400 cursor-not-allowed opacity-60' 
          : `bg-blue-600 hover:bg-blue-700 active:bg-blue-800 
             ${!respectsReducedMotion && isHovered ? 'scale-105 shadow-lg' : 'scale-100 shadow-md'}
             ${!respectsReducedMotion && isPressed ? 'scale-95' : ''}
             hover:shadow-blue-500/25`
        }
        ${isLoading && !respectsReducedMotion ? 'animate-pulse' : ''}
      `}
    >
      <div className="flex items-center justify-center">
        {isLoading && (
          <div 
            className={`inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full ${
              !respectsReducedMotion ? 'animate-spin' : ''
            }`}
            aria-hidden="true"
          ></div>
        )}
        <span className={`transition-all duration-200 ${isLoading ? 'opacity-75' : 'opacity-100'}`}>
          {isLoading 
            ? 'Filling...' 
            : disabled 
              ? 'Set up profile first' 
              : 'Autofill Form'
          }
        </span>
      </div>
      <span id="autofill-button-description" className="sr-only">
        {disabled 
          ? 'Complete your profile in the extension popup to enable autofill functionality'
          : 'Automatically fills detected job application forms with your profile information'
        }
      </span>
    </button>
  );
};