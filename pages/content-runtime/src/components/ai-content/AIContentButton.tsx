/**
 * AI Content Button Component
 * 
 * Button that appears next to form fields to trigger AI content generation
 */

import React, { useState } from 'react';
import type { AIContentRequestType } from '@extension/content/src/ai-content';

interface AIContentButtonProps {
  fieldElement: HTMLElement;
  contentType: AIContentRequestType;
  fieldLabel: string;
  onGenerateClick: (contentType: AIContentRequestType, fieldLabel: string, existingContent?: string) => void;
  className?: string;
}

export const AIContentButton: React.FC<AIContentButtonProps> = ({
  fieldElement,
  contentType,
  fieldLabel,
  onGenerateClick,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get existing content from the field
    let existingContent = '';
    if (fieldElement instanceof HTMLInputElement || fieldElement instanceof HTMLTextAreaElement) {
      existingContent = fieldElement.value;
    }
    
    onGenerateClick(contentType, fieldLabel, existingContent);
  };

  const getButtonText = () => {
    switch (contentType) {
      case 'cover_letter':
        return '✨ Generate Cover Letter';
      case 'question_response':
        return '✨ AI Answer';
      case 'summary':
        return '✨ Generate Summary';
      case 'objective':
        return '✨ Generate Objective';
      case 'why_interested':
        return '✨ Why Interested?';
      case 'why_qualified':
        return '✨ Why Qualified?';
      default:
        return '✨ AI Assist';
    }
  };

  const getTooltipText = () => {
    switch (contentType) {
      case 'cover_letter':
        return 'Generate a personalized cover letter based on the job description';
      case 'question_response':
        return 'Get AI-powered suggestions for this question';
      case 'summary':
        return 'Create a professional summary highlighting your key qualifications';
      case 'objective':
        return 'Generate a career objective aligned with this role';
      case 'why_interested':
        return 'Explain your interest in this role and company';
      case 'why_qualified':
        return 'Highlight your relevant qualifications and experience';
      default:
        return 'Get AI assistance for this field';
    }
  };

  return (
    <div className="ai-content-button-container">
      <button
        className={`ai-content-button ${className}`}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title={getTooltipText()}
        type="button"
      >
        <span className="ai-content-button-text">{getButtonText()}</span>
      </button>
      
      {isHovered && (
        <div className="ai-content-tooltip">
          {getTooltipText()}
        </div>
      )}
    </div>
  );
};