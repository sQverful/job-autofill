/**
 * AI Content Manager Component
 * 
 * Main component that manages AI content generation for form fields
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AIContentModal } from './AIContentModal';
import { AIContentButton } from './AIContentButton';
import { AIContentIndicator } from './AIContentIndicator';
import type { 
  AIContentRequestType, 
  ContentGenerationPreferences,
  GenerationResult,
  AIContentManagerConfig
} from '@extension/content-script/src/ai-content';

interface DetectedField {
  element: HTMLElement;
  type: AIContentRequestType;
  label: string;
  id: string;
}

interface AIContentManagerProps {
  config: AIContentManagerConfig;
  onGenerateContent: (
    type: AIContentRequestType,
    preferences: Partial<ContentGenerationPreferences>,
    existingContent?: string
  ) => Promise<GenerationResult>;
  detectedFields: DetectedField[];
}

interface FieldState {
  status: 'idle' | 'generating' | 'success' | 'error' | 'unavailable';
  message?: string;
}

export const AIContentManager: React.FC<AIContentManagerProps> = ({
  config,
  onGenerateContent,
  detectedFields
}) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    contentType: AIContentRequestType;
    fieldLabel: string;
    fieldElement?: HTMLElement;
    existingContent?: string;
  }>({
    isOpen: false,
    contentType: 'question_response',
    fieldLabel: ''
  });

  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});
  const renderedButtons = useRef<Map<string, HTMLElement>>(new Map());

  // Initialize field states
  useEffect(() => {
    const initialStates: Record<string, FieldState> = {};
    detectedFields.forEach(field => {
      initialStates[field.id] = { status: 'idle' };
    });
    setFieldStates(initialStates);
  }, [detectedFields]);

  const handleGenerateClick = useCallback((
    contentType: AIContentRequestType,
    fieldLabel: string,
    existingContent?: string
  ) => {
    const field = detectedFields.find(f => f.label === fieldLabel);

    setModalState({
      isOpen: true,
      contentType,
      fieldLabel,
      fieldElement: field?.element,
      existingContent
    });
  }, [detectedFields]);

  const renderAIButton = useCallback(
    (field: DetectedField): HTMLElement => {
      // Create button container
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'ai-content-button-wrapper';
      buttonContainer.setAttribute('data-ai-button-for', field.id);

      // Position the button relative to the field
      const fieldRect = field.element.getBoundingClientRect();
      buttonContainer.style.position = 'absolute';
      buttonContainer.style.top = `${fieldRect.top + window.scrollY}px`;
      buttonContainer.style.left = `${fieldRect.right + window.scrollX + 10}px`;
      buttonContainer.style.zIndex = '10000';

      // Add to DOM
      document.body.appendChild(buttonContainer);

      // Render React component
      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(buttonContainer);
        root.render(
          <AIContentButton
            fieldElement={field.element}
            contentType={field.type}
            fieldLabel={field.label}
            onGenerateClick={handleGenerateClick}
          />
        );
      });

      return buttonContainer;
    },
    [handleGenerateClick]
  );

  // Render AI buttons next to detected fields and clean up removed ones
  useEffect(() => {
    // Add buttons for new fields
    detectedFields.forEach(field => {
      if (!renderedButtons.current.has(field.id)) {
        const container = renderAIButton(field);
        renderedButtons.current.set(field.id, container);
      }
    });

    // Remove buttons for fields no longer present
    renderedButtons.current.forEach((container, id) => {
      if (!detectedFields.some(f => f.id === id)) {
        container.remove();
        renderedButtons.current.delete(id);
      }
    });
  }, [detectedFields, renderAIButton]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      renderedButtons.current.forEach(container => container.remove());
      renderedButtons.current.clear();
    };
  }, []);

  const handleModalClose = useCallback(() => {
    setModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleContentApproved = useCallback((content: string) => {
    if (modalState.fieldElement) {
      // Insert content into the field
      if (modalState.fieldElement instanceof HTMLInputElement || 
          modalState.fieldElement instanceof HTMLTextAreaElement) {
        modalState.fieldElement.value = content;
        
        // Trigger change events
        modalState.fieldElement.dispatchEvent(new Event('input', { bubbles: true }));
        modalState.fieldElement.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Update field state
      const field = detectedFields.find(f => f.element === modalState.fieldElement);
      if (field) {
        setFieldStates(prev => ({
          ...prev,
          [field.id]: { status: 'success', message: 'Content inserted successfully' }
        }));
      }
    }
  }, [modalState.fieldElement, detectedFields]);

  const handleGenerateContent = useCallback(async (
    type: AIContentRequestType,
    preferences: Partial<ContentGenerationPreferences>,
    existingContent?: string
  ): Promise<GenerationResult> => {
    const field = detectedFields.find(f => f.label === modalState.fieldLabel);
    
    if (field) {
      setFieldStates(prev => ({
        ...prev,
        [field.id]: { status: 'generating' }
      }));
    }

    try {
      const result = await onGenerateContent(type, preferences, existingContent);
      
      if (field) {
        setFieldStates(prev => ({
          ...prev,
          [field.id]: { 
            status: result.success ? 'success' : 'error',
            message: result.success ? undefined : result.error?.message
          }
        }));
      }

      return result;
    } catch (error) {
      if (field) {
        setFieldStates(prev => ({
          ...prev,
          [field.id]: { 
            status: 'error',
            message: error instanceof Error ? error.message : 'Generation failed'
          }
        }));
      }
      throw error;
    }
  }, [detectedFields, modalState.fieldLabel, onGenerateContent]);

  const handleRetry = useCallback((fieldId: string) => {
    const field = detectedFields.find(f => f.id === fieldId);
    if (field) {
      let existingContent = '';
      if (field.element instanceof HTMLInputElement || field.element instanceof HTMLTextAreaElement) {
        existingContent = field.element.value;
      }
      
      handleGenerateClick(field.type, field.label, existingContent);
    }
  }, [detectedFields, handleGenerateClick]);

  const handleDismissIndicator = useCallback((fieldId: string) => {
    setFieldStates(prev => ({
      ...prev,
      [fieldId]: { status: 'idle' }
    }));
  }, []);

  // Render indicators for fields with status
  const renderIndicators = () => {
    return detectedFields.map(field => {
      const state = fieldStates[field.id];
      if (!state || state.status === 'idle') return null;

      return (
        <AIContentIndicator
          key={field.id}
          status={state.status}
          message={state.message}
          onRetry={() => handleRetry(field.id)}
          onDismiss={() => handleDismissIndicator(field.id)}
        />
      );
    });
  };

  return (
    <>
      {/* Modal for content generation */}
      <AIContentModal
        isOpen={modalState.isOpen}
        onClose={handleModalClose}
        contentType={modalState.contentType}
        fieldLabel={modalState.fieldLabel}
        existingContent={modalState.existingContent}
        onContentApproved={handleContentApproved}
        onGenerateContent={handleGenerateContent}
      />

      {/* Status indicators */}
      <div className="ai-content-indicators">
        {renderIndicators()}
      </div>
    </>
  );
};