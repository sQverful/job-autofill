/**
 * useAIContent Hook
 * 
 * Custom hook for managing AI content generation in content scripts
 */

import { useState, useCallback, useEffect } from 'react';
import type { 
  AIContentRequestType,
  ContentGenerationPreferences,
  GenerationResult,
  AIContentManagerConfig,
  UserProfile,
  JobContext
} from '@extension/content/src/ai-content';

interface UseAIContentOptions {
  config: AIContentManagerConfig;
  userProfile: UserProfile;
  onJobContextChange?: (context: JobContext | null) => void;
}

interface UseAIContentReturn {
  generateContent: (
    type: AIContentRequestType,
    preferences: Partial<ContentGenerationPreferences>,
    existingContent?: string
  ) => Promise<GenerationResult>;
  isServiceAvailable: boolean;
  serviceHealth: {
    available: boolean;
    responseTime: number;
    errorRate: number;
  };
  jobContext: JobContext | null;
  refreshJobContext: () => Promise<void>;
}

export const useAIContent = ({
  config,
  userProfile,
  onJobContextChange
}: UseAIContentOptions): UseAIContentReturn => {
  const [isServiceAvailable, setIsServiceAvailable] = useState(true);
  const [serviceHealth, setServiceHealth] = useState({
    available: true,
    responseTime: 0,
    errorRate: 0
  });
  const [jobContext, setJobContext] = useState<JobContext | null>(null);

  // Initialize AI content manager
  const [aiManager] = useState(() => {
    // This would be imported from the content script
    // For now, we'll create a mock implementation
    return {
      generateContent: async (
        type: AIContentRequestType,
        preferences: Partial<ContentGenerationPreferences>,
        existingContent?: string
      ): Promise<GenerationResult> => {
        // Mock implementation - in real usage this would use the actual AI manager
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              content: `Generated ${type} content with ${preferences.tone} tone`,
              confidence: 0.85,
              suggestions: ['Consider adding more specific examples'],
              metadata: {
                requestId: 'mock-request',
                processingTime: 1500,
                fromCache: false,
                fromFallback: false
              }
            });
          }, 1500);
        });
      },
      getServiceHealth: () => serviceHealth,
      extractJobContext: async (): Promise<JobContext | null> => {
        // Mock job context extraction
        return {
          jobTitle: 'Software Engineer',
          companyName: 'Tech Company',
          jobDescription: 'We are looking for a skilled software engineer...',
          requirements: ['5+ years experience', 'JavaScript proficiency']
        };
      }
    };
  });

  // Extract job context on mount and when URL changes
  const refreshJobContext = useCallback(async () => {
    try {
      const context = await aiManager.extractJobContext();
      setJobContext(context);
      onJobContextChange?.(context);
    } catch (error) {
      console.error('Failed to extract job context:', error);
      setJobContext(null);
      onJobContextChange?.(null);
    }
  }, [aiManager, onJobContextChange]);

  useEffect(() => {
    refreshJobContext();
    
    // Listen for URL changes
    const handleUrlChange = () => {
      setTimeout(refreshJobContext, 1000); // Delay to allow page to load
    };

    // Listen for navigation events
    window.addEventListener('popstate', handleUrlChange);
    
    // Monitor for dynamic content changes
    const observer = new MutationObserver((mutations) => {
      const hasSignificantChanges = mutations.some(mutation => 
        mutation.type === 'childList' && 
        mutation.addedNodes.length > 0
      );
      
      if (hasSignificantChanges) {
        setTimeout(refreshJobContext, 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      observer.disconnect();
    };
  }, [refreshJobContext]);

  // Monitor service health
  useEffect(() => {
    const checkServiceHealth = async () => {
      try {
        const health = aiManager.getServiceHealth();
        setServiceHealth(health);
        setIsServiceAvailable(health.available);
      } catch (error) {
        setIsServiceAvailable(false);
        setServiceHealth({
          available: false,
          responseTime: 0,
          errorRate: 1
        });
      }
    };

    // Check health immediately and then periodically
    checkServiceHealth();
    const healthCheckInterval = setInterval(checkServiceHealth, 30000); // Every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [aiManager]);

  const generateContent = useCallback(async (
    type: AIContentRequestType,
    preferences: Partial<ContentGenerationPreferences>,
    existingContent?: string
  ): Promise<GenerationResult> => {
    try {
      const result = await aiManager.generateContent(type, preferences, existingContent);
      
      // Update service availability based on result
      if (!result.success && result.errors?.some(error => 
        error.includes('unavailable') || error.includes('timeout')
      )) {
        setIsServiceAvailable(false);
      } else if (result.success) {
        setIsServiceAvailable(true);
      }

      return result;
    } catch (error) {
      setIsServiceAvailable(false);
      throw error;
    }
  }, [aiManager]);

  return {
    generateContent,
    isServiceAvailable,
    serviceHealth,
    jobContext,
    refreshJobContext
  };
};