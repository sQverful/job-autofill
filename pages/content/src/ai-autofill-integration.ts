/**
 * AI Autofill Integration
 * Integrates AI autofill functionality with the existing content script infrastructure
 */

import { aiAutofillController } from './ai-autofill-controller';
import { aiAutofillUIManager } from './ai/ai-autofill-ui-manager';
import type { AIAutofillResult } from '@extension/shared';
import { aiSettingsStorage } from '@extension/storage';

export interface AIAutofillIntegrationOptions {
  enableUIManager?: boolean;
  enableMessageHandlers?: boolean;
  enableProgressTracking?: boolean;
  fallbackToTraditional?: boolean;
}

/**
 * Main integration class that connects AI autofill with existing infrastructure
 */
export class AIAutofillIntegration {
  private readonly options: Required<AIAutofillIntegrationOptions>;
  private isInitialized = false;
  private messageHandlers: Array<() => void> = [];

  constructor(options: AIAutofillIntegrationOptions = {}) {
    this.options = {
      enableUIManager: true,
      enableMessageHandlers: true,
      enableProgressTracking: true,
      fallbackToTraditional: true,
      ...options
    };
  }

  /**
   * Initialize AI autofill integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[AIAutofillIntegration] Initializing AI autofill integration...');

      // Check if AI Mode is available
      const aiAvailable = await this.checkAIAvailability();
      if (!aiAvailable) {
        console.log('[AIAutofillIntegration] AI Mode not available, skipping initialization');
        return;
      }

      // Set up message handlers
      if (this.options.enableMessageHandlers) {
        this.setupMessageHandlers();
      }

      // Initialize UI manager
      if (this.options.enableUIManager) {
        // UI manager initializes itself
        console.log('[AIAutofillIntegration] AI UI manager initialized');
      }

      // Set up progress tracking
      if (this.options.enableProgressTracking) {
        this.setupProgressTracking();
      }

      // Set up page change detection
      this.setupPageChangeDetection();

      this.isInitialized = true;
      console.log('[AIAutofillIntegration] AI autofill integration initialized successfully');

    } catch (error) {
      console.error('[AIAutofillIntegration] Failed to initialize:', error);
    }
  }

  /**
   * Check if AI functionality is available
   */
  private async checkAIAvailability(): Promise<boolean> {
    try {
      const settings = await aiSettingsStorage.get();
      return settings !== null; // AI settings storage is available
    } catch (error) {
      console.error('[AIAutofillIntegration] AI availability check failed:', error);
      return false;
    }
  }

  /**
   * Set up message handlers for AI autofill
   */
  private setupMessageHandlers(): void {
    const handleMessage = async (message: any, sender: any, sendResponse: any) => {
      try {
        switch (message.type) {
          case 'ai-autofill:trigger':
            await this.handleAIAutofillTrigger(message, sendResponse);
            return true; // Keep message channel open

          case 'ai-autofill:cancel':
            this.handleAIAutofillCancel(sendResponse);
            return false;

          case 'ai-autofill:status':
            this.handleAIAutofillStatus(sendResponse);
            return false;

          case 'ai-mode:check':
            await this.handleAIModeCheck(sendResponse);
            return false;

          case 'ai:execute-fallback':
            await this.handleAIFallbackExecution(message, sendResponse);
            return true; // Keep message channel open

          default:
            return false; // Not handled by AI integration
        }
      } catch (error) {
        console.error('[AIAutofillIntegration] Message handler error:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return false;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    this.messageHandlers.push(() => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    });
  }

  /**
   * Handle AI autofill trigger message
   */
  private async handleAIAutofillTrigger(message: any, sendResponse: any): Promise<void> {
    try {
      console.log('[AIAutofillIntegration] AI autofill triggered from:', message.source);

      // Check if traditional autofill is already running
      if (this.isTraditionalAutofillRunning()) {
        throw new Error('Traditional autofill is already running. Please wait for it to complete.');
      }

      const result = await aiAutofillController.performAIAutofill(message.container);
      
      sendResponse({
        success: true,
        result: {
          success: result.success,
          filledCount: result.successfulInstructions,
          totalFields: result.totalInstructions,
          executionTime: result.totalExecutionTime,
          fallbackUsed: result.fallbackUsed,
          errors: result.errors,
          platform: 'ai-powered'
        }
      });

      // Send notification to background script
      chrome.runtime.sendMessage({
        type: 'ai-autofill:complete',
        data: {
          success: result.success,
          filledCount: result.successfulInstructions,
          totalFields: result.totalInstructions,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          aiAnalysis: {
            confidence: result.aiAnalysis.confidence,
            instructionCount: result.aiAnalysis.instructions.length,
            warnings: result.aiAnalysis.warnings
          }
        }
      });

    } catch (error: any) {
      console.error('[AIAutofillIntegration] AI autofill failed:', error);
      
      // Try fallback if enabled and appropriate
      if (this.options.fallbackToTraditional && this.shouldUseFallback(error)) {
        try {
          console.log('[AIAutofillIntegration] Attempting fallback to traditional autofill...');
          
          const fallbackResult = await this.performTraditionalAutofillFallback(message);
          
          sendResponse({
            success: true,
            result: {
              ...fallbackResult,
              fallbackUsed: true,
              platform: 'traditional-fallback'
            }
          });

          return;

        } catch (fallbackError) {
          console.error('[AIAutofillIntegration] Fallback also failed:', fallbackError);
        }
      }

      sendResponse({
        success: false,
        error: error.message,
        fallbackUsed: false
      });
    }
  }

  /**
   * Handle AI autofill cancel message
   */
  private handleAIAutofillCancel(sendResponse: any): void {
    try {
      aiAutofillController.cancel();
      sendResponse({ success: true, message: 'AI autofill cancelled' });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle AI autofill status request
   */
  private handleAIAutofillStatus(sendResponse: any): void {
    try {
      const isProcessing = aiAutofillController.isProcessingAutofill();
      const currentProgress = aiAutofillController.getCurrentProgress();
      const stats = aiAutofillController.getExecutionStats();

      sendResponse({
        success: true,
        status: {
          isProcessing,
          currentProgress,
          stats
        }
      });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle AI fallback execution request from background script
   */
  private async handleAIFallbackExecution(message: any, sendResponse: any): Promise<void> {
    try {
      const { strategy } = message.data;
      console.log('[AIAutofillIntegration] Executing fallback strategy:', strategy);

      let result;
      
      switch (strategy) {
        case 'enhanced_autofill':
          result = await this.executeEnhancedAutofillFallback();
          break;
        case 'on_demand_autofill':
          result = await this.executeOnDemandAutofillFallback();
          break;
        case 'basic_form_fill':
          result = await this.executeBasicFormFillFallback();
          break;
        default:
          throw new Error(`Unknown fallback strategy: ${strategy}`);
      }

      sendResponse({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('[AIAutofillIntegration] Fallback execution failed:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Execute Enhanced Autofill fallback
   */
  private async executeEnhancedAutofillFallback(): Promise<any> {
    try {
      const { EnhancedAutofill } = await import('./enhanced-autofill');
      const enhancedAutofill = new EnhancedAutofill({ 
        enableButtonCreation: false,
        enableFormDetection: false 
      });
      
      return await enhancedAutofill.handleAutofillTrigger({
        type: 'autofill:trigger',
        source: 'ai_fallback',
        data: { tabId: 0 }
      });
    } catch (error: any) {
      throw new Error(`Enhanced Autofill fallback failed: ${error.message}`);
    }
  }

  /**
   * Execute On-Demand Autofill fallback
   */
  private async executeOnDemandAutofillFallback(): Promise<any> {
    try {
      const { OnDemandAutofill } = await import('./on-demand-autofill');
      const onDemandAutofill = new OnDemandAutofill({ 
        enableButtonCreation: false,
        enableFormDetection: false 
      });
      
      return await onDemandAutofill.handleAutofillTrigger({
        type: 'autofill:trigger',
        source: 'ai_fallback',
        data: { tabId: 0 }
      });
    } catch (error: any) {
      throw new Error(`On-Demand Autofill fallback failed: ${error.message}`);
    }
  }

  /**
   * Execute Basic Form Fill fallback
   */
  private async executeBasicFormFillFallback(): Promise<any> {
    try {
      const { profileStorage } = await import('@extension/storage');
      const profile = await profileStorage.get();
      
      if (!profile) {
        throw new Error('No user profile available for basic form fill');
      }

      // Simple form filling logic
      const forms = document.querySelectorAll('form');
      let filledCount = 0;

      for (const form of forms) {
        const inputs = form.querySelectorAll('input, select, textarea');
        
        for (const input of inputs) {
          const element = input as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
          const filled = this.fillBasicField(element, profile);
          if (filled) filledCount++;
        }
      }

      return {
        success: filledCount > 0,
        filledCount,
        totalFields: document.querySelectorAll('input, select, textarea').length,
        strategy: 'basic_form_fill'
      };
    } catch (error: any) {
      throw new Error(`Basic Form Fill fallback failed: ${error.message}`);
    }
  }

  /**
   * Fill a basic field with profile data
   */
  private fillBasicField(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, profile: any): boolean {
    try {
      const name = element.name?.toLowerCase() || '';
      const id = element.id?.toLowerCase() || '';
      const placeholder = (element as HTMLInputElement).placeholder?.toLowerCase() || '';
      const label = this.findFieldLabel(element)?.toLowerCase() || '';
      
      const fieldIdentifier = `${name} ${id} ${placeholder} ${label}`.toLowerCase();

      // Basic field mapping
      if (fieldIdentifier.includes('first') && fieldIdentifier.includes('name')) {
        element.value = profile.personalInfo?.firstName || '';
        return true;
      }
      if (fieldIdentifier.includes('last') && fieldIdentifier.includes('name')) {
        element.value = profile.personalInfo?.lastName || '';
        return true;
      }
      if (fieldIdentifier.includes('email')) {
        element.value = profile.personalInfo?.email || '';
        return true;
      }
      if (fieldIdentifier.includes('phone')) {
        element.value = profile.personalInfo?.phone || '';
        return true;
      }

      return false;
    } catch (error) {
      console.warn('[AIAutofillIntegration] Failed to fill basic field:', error);
      return false;
    }
  }

  /**
   * Find label for a field
   */
  private findFieldLabel(element: HTMLElement): string | null {
    // Try to find associated label
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return label.textContent;
    }

    // Try to find parent label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent;

    // Try to find preceding label
    const prevElement = element.previousElementSibling;
    if (prevElement?.tagName === 'LABEL') {
      return prevElement.textContent;
    }

    return null;
  }

  /**
   * Handle AI Mode check request
   */
  private async handleAIModeCheck(sendResponse: any): Promise<void> {
    try {
      const settings = await aiSettingsStorage.get();
      
      sendResponse({
        success: true,
        aiMode: {
          enabled: settings.enabled,
          hasToken: !!settings.apiToken,
          model: settings.model
        }
      });
    } catch (error: any) {
      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Set up progress tracking
   */
  private setupProgressTracking(): void {
    aiAutofillController.onProgress((progress) => {
      // Send progress updates to popup/background
      chrome.runtime.sendMessage({
        type: 'ai-autofill:progress',
        data: progress
      }).catch(() => {
        // Ignore errors if no listeners
      });

      // Send progress to other content scripts/UI components
      window.postMessage({
        type: 'ai-autofill-progress',
        progress
      }, '*');
    });
  }

  /**
   * Set up page change detection
   */
  private setupPageChangeDetection(): void {
    let currentUrl = window.location.href;

    // Check for URL changes (SPA navigation)
    const checkUrlChange = () => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        this.handlePageChange();
      }
    };

    // Monitor for navigation changes
    setInterval(checkUrlChange, 1000);

    // Listen for popstate events
    window.addEventListener('popstate', () => {
      setTimeout(() => this.handlePageChange(), 100);
    });

    // Listen for pushstate/replacestate (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(() => checkUrlChange(), 100);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(() => checkUrlChange(), 100);
    };
  }

  /**
   * Handle page change events
   */
  private handlePageChange(): void {
    console.log('[AIAutofillIntegration] Page changed, re-evaluating AI autofill availability');
    
    // Cancel any ongoing AI autofill
    if (aiAutofillController.isProcessingAutofill()) {
      aiAutofillController.cancel();
    }

    // Clear execution logs
    aiAutofillController.clearExecutionLogs();

    // Notify UI manager about page change
    chrome.runtime.sendMessage({
      type: 'page-changed',
      url: window.location.href
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  /**
   * Check if traditional autofill is currently running
   */
  private isTraditionalAutofillRunning(): boolean {
    // Check if any traditional autofill instances are processing
    const enhancedAutofill = (window as any).enhancedAutofill;
    const onDemandAutofill = (window as any).onDemandAutofill;

    return (enhancedAutofill?.isProcessingAutofill) || (onDemandAutofill?.isProcessingAutofill);
  }

  /**
   * Perform traditional autofill as fallback
   */
  private async performTraditionalAutofillFallback(message: any): Promise<any> {
    // Try to use the existing traditional autofill systems
    // First try OnDemandAutofill, then EnhancedAutofill
    
    const onDemandAutofill = (window as any).onDemandAutofill;
    if (onDemandAutofill && typeof onDemandAutofill.handleAutofillTrigger === 'function') {
      try {
        return await onDemandAutofill.handleAutofillTrigger({
          type: 'autofill:trigger',
          source: 'ai-fallback',
          data: { tabId: message.data?.tabId || 0 }
        });
      } catch (error) {
        console.warn('[AIAutofillIntegration] OnDemandAutofill fallback failed:', error);
      }
    }

    const enhancedAutofill = (window as any).enhancedAutofill;
    if (enhancedAutofill && typeof enhancedAutofill.handleAutofillTrigger === 'function') {
      return await enhancedAutofill.handleAutofillTrigger({
        type: 'autofill:trigger',
        source: 'ai-fallback',
        data: { tabId: message.data?.tabId || 0 }
      });
    }

    throw new Error('No traditional autofill handlers available for fallback');
  }

  /**
   * Determine if fallback should be used
   */
  private shouldUseFallback(error: any): boolean {
    const errorType = (error as any).type;
    const message = error.message?.toLowerCase() || '';

    // Use fallback for certain error types
    const fallbackErrors = [
      'API_RATE_LIMIT',
      'API_QUOTA_EXCEEDED',
      'NETWORK_ERROR',
      'INVALID_RESPONSE',
      'PARSING_ERROR'
    ];

    return fallbackErrors.includes(errorType) || 
           message.includes('network') ||
           message.includes('timeout') ||
           message.includes('rate limit') ||
           message.includes('quota') ||
           message.includes('ai mode is not enabled') ||
           message.includes('no openai api token');
  }

  /**
   * Manually trigger AI autofill (for external use)
   */
  async triggerAIAutofill(container?: HTMLElement): Promise<AIAutofillResult> {
    if (!this.isInitialized) {
      throw new Error('AI autofill integration not initialized');
    }

    return await aiAutofillController.performAIAutofill(container);
  }

  /**
   * Check if AI autofill is currently processing
   */
  isProcessing(): boolean {
    return aiAutofillController.isProcessingAutofill();
  }

  /**
   * Get current AI autofill progress
   */
  getCurrentProgress() {
    return aiAutofillController.getCurrentProgress();
  }

  /**
   * Cancel ongoing AI autofill
   */
  cancel(): void {
    aiAutofillController.cancel();
  }

  /**
   * Dispose of the integration
   */
  dispose(): void {
    // Remove message handlers
    this.messageHandlers.forEach(cleanup => cleanup());
    this.messageHandlers = [];

    // Dispose of controllers
    aiAutofillController.dispose();
    aiAutofillUIManager.dispose();

    this.isInitialized = false;
    console.log('[AIAutofillIntegration] AI autofill integration disposed');
  }
}

// Export singleton instance
export const aiAutofillIntegration = new AIAutofillIntegration();

// Make available globally for verification and debugging
(window as any).aiAutofillIntegration = aiAutofillIntegration;

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
  console.log('[AIAutofillIntegration] Auto-initialization starting...');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    console.log('[AIAutofillIntegration] Waiting for DOM to load...');
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[AIAutofillIntegration] DOM loaded, initializing...');
      aiAutofillIntegration.initialize();
    });
  } else {
    // DOM is already ready
    console.log('[AIAutofillIntegration] DOM already ready, initializing immediately...');
    aiAutofillIntegration.initialize();
  }
}