/**
 * AI Content Modal Component
 * 
 * Main modal for AI content generation, preview, and editing
 */

import React, { useState, useEffect } from 'react';
import type { 
  AIContentRequestType, 
  ContentGenerationPreferences,
  GenerationResult 
} from '@extension/content-script/src/ai-content';

interface AIContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: AIContentRequestType;
  fieldLabel: string;
  existingContent?: string;
  onContentApproved: (content: string) => void;
  onGenerateContent: (
    type: AIContentRequestType,
    preferences: Partial<ContentGenerationPreferences>,
    existingContent?: string
  ) => Promise<GenerationResult>;
}

export const AIContentModal: React.FC<AIContentModalProps> = ({
  isOpen,
  onClose,
  contentType,
  fieldLabel,
  existingContent,
  onContentApproved,
  onGenerateContent
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Partial<ContentGenerationPreferences>>({
    tone: 'professional',
    length: 'medium',
    focus: []
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | undefined>();

  useEffect(() => {
    if (isOpen && existingContent) {
      setEditedContent(existingContent);
    }
  }, [isOpen, existingContent]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const result = await onGenerateContent(contentType, preferences, existingContent);
      
      if (result.success && result.content) {
        setGeneratedContent(result.content);
        setEditedContent(result.content);
        setAlternatives(result.alternatives || []);
        setSuggestions(result.suggestions || []);
        setConfidence(result.confidence);
      } else {
        setError(result.error?.message || 'Failed to generate content');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = () => {
    if (editedContent.trim()) {
      onContentApproved(editedContent.trim());
      onClose();
    }
  };

  const handleAlternativeSelect = (alternative: string) => {
    setEditedContent(alternative);
  };

  const handlePreferenceChange = (key: keyof ContentGenerationPreferences, value: any) => {
    setPreferences((prev: Partial<ContentGenerationPreferences>) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="ai-content-modal-overlay" onClick={onClose}>
      <div className="ai-content-modal" onClick={e => e.stopPropagation()}>
        <div className="ai-content-modal-header">
          <h3>AI Content Assistant</h3>
          <button className="ai-content-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="ai-content-modal-body">
          <div className="ai-content-field-info">
            <label>Field: {fieldLabel}</label>
            <span className="ai-content-type-badge">{contentType.replace('_', ' ')}</span>
          </div>

          {/* Preferences Section */}
          <div className="ai-content-preferences">
            <h4>Content Preferences</h4>
            <div className="ai-content-preferences-grid">
              <div className="ai-content-preference-group">
                <label>Tone:</label>
                <select 
                  value={preferences.tone} 
                  onChange={e => handlePreferenceChange('tone', e.target.value)}
                >
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="enthusiastic">Enthusiastic</option>
                  <option value="confident">Confident</option>
                </select>
              </div>

              <div className="ai-content-preference-group">
                <label>Length:</label>
                <select 
                  value={preferences.length} 
                  onChange={e => handlePreferenceChange('length', e.target.value)}
                >
                  <option value="short">Short</option>
                  <option value="medium">Medium</option>
                  <option value="long">Long</option>
                </select>
              </div>
            </div>
          </div>

          {/* Generation Controls */}
          <div className="ai-content-controls">
            <button 
              className="ai-content-generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Content'}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="ai-content-error">
              <span className="ai-content-error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Content Preview and Editing */}
          {(generatedContent || existingContent) && (
            <div className="ai-content-preview">
              <div className="ai-content-preview-header">
                <h4>Generated Content</h4>
                {confidence && (
                  <div className="ai-content-confidence">
                    Confidence: {Math.round(confidence * 100)}%
                  </div>
                )}
              </div>

              <textarea
                className="ai-content-textarea"
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                placeholder="Generated content will appear here..."
                rows={8}
              />

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="ai-content-suggestions">
                  <h5>Suggestions for improvement:</h5>
                  <ul>
                    {suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Alternatives */}
              {alternatives.length > 0 && (
                <div className="ai-content-alternatives">
                  <h5>Alternative versions:</h5>
                  <div className="ai-content-alternatives-list">
                    {alternatives.map((alternative, index) => (
                      <div key={index} className="ai-content-alternative">
                        <div className="ai-content-alternative-text">
                          {alternative.substring(0, 100)}...
                        </div>
                        <button 
                          className="ai-content-alternative-select"
                          onClick={() => handleAlternativeSelect(alternative)}
                        >
                          Use This
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Service Unavailable Fallback */}
          {error && error.includes('unavailable') && (
            <div className="ai-content-fallback">
              <h4>AI Service Unavailable</h4>
              <p>The AI content generation service is currently unavailable. You can:</p>
              <ul>
                <li>Try again in a few minutes</li>
                <li>Use the manual editing area below</li>
                <li>Continue with your existing content</li>
              </ul>
              <textarea
                className="ai-content-textarea"
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                placeholder="Enter your content manually..."
                rows={6}
              />
            </div>
          )}
        </div>

        <div className="ai-content-modal-footer">
          <button className="ai-content-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="ai-content-btn-primary" 
            onClick={handleApprove}
            disabled={!editedContent.trim()}
          >
            Use Content
          </button>
        </div>
      </div>
    </div>
  );
};