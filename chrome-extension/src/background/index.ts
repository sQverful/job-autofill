import 'webextension-polyfill';
import { aiSettingsStorage } from '@extension/storage';
import { aiServiceClient } from './ai/ai-service-client';

/**
 * Lightweight background service worker for job application autofill extension
 * Only handles essential functionality without heavy processing
 */
class LightweightBackground {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize lightweight background service worker
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[Job Autofill] Initializing lightweight background service worker...');

      // Setup basic extension event listeners
      this.setupExtensionListeners();

      // Setup simple message handlers
      this.setupMessageHandlers();

      this.initialized = true;
      console.log('[Job Autofill] Background service worker initialized successfully');
    } catch (error: any) {
      console.error('[Job Autofill] Failed to initialize background service worker:', error);
    }
  }

  /**
   * Setup basic Chrome extension event listeners
   */
  private setupExtensionListeners(): void {
    // Handle extension installation/update
    chrome.runtime.onInstalled.addListener(async details => {
      console.log('[Job Autofill] Extension installed/updated:', details.reason);

      if (details.reason === 'install') {
        // First time installation - open options page
        chrome.tabs.create({
          url: chrome.runtime.getURL('options/index.html'),
        });
      }
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('[Job Autofill] Extension startup');
    });
  }

  /**
   * Setup simple message handlers for popup communication
   */
  private setupMessageHandlers(): void {
    // Simple message handler that doesn't use complex routing
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle messages directly without complex routing
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    console.log('[Job Autofill] Message handlers setup complete');
  }

  /**
   * Handle incoming messages from popup and content scripts
   */
  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ): Promise<void> {
    try {
      console.log('[Job Autofill] Received message:', message.type);

      switch (message.type) {
        case 'auth:status':
          // Simple auth status - always return not authenticated for now
          sendResponse({
            success: true,
            data: {
              isAuthenticated: false,
              user: null,
            },
          });
          break;

        case 'form:check':
          // Simple form check - always return no forms detected
          sendResponse({
            success: true,
            data: {
              detected: false,
              platform: null,
              fieldCount: 0,
              confidence: 0,
            },
          });
          break;

        case 'activity:recent':
          // Simple activity - return empty list
          sendResponse({
            success: true,
            data: {
              actions: [],
            },
          });
          break;

        case 'autofill:trigger':
          // Autofill trigger - just log and acknowledge
          const { tabId } = message.data || {};
          console.log('[Job Autofill] Autofill triggered for tab:', tabId);

          sendResponse({
            success: true,
            data: {
              message: 'Autofill request acknowledged',
              tabId,
            },
          });
          break;

        case 'settings:update':
          // Settings update - just acknowledge
          console.log('[Job Autofill] Settings update:', message.data);

          sendResponse({
            success: true,
            data: {
              message: 'Settings updated',
            },
          });
          break;

        // AI-specific message handlers
        case 'ai-autofill:complete':
          // AI autofill completion notification
          console.log('[Job Autofill] AI autofill completed:', message.data);
          
          sendResponse({
            success: true,
            data: {
              message: 'AI autofill completion acknowledged',
            },
          });
          break;

        case 'ai-autofill:progress':
          // AI autofill progress update
          console.log('[Job Autofill] AI autofill progress:', message.data);
          
          // Forward progress to popup if it's open
          this.forwardToPopup(message);
          
          sendResponse({
            success: true,
            data: {
              message: 'Progress update acknowledged',
            },
          });
          break;

        case 'ai-mode:status':
          // AI Mode status check
          await this.handleAIModeStatus(sendResponse);
          break;

        case 'ai-settings:validate':
          // AI settings validation
          await this.handleAISettingsValidation(message.data, sendResponse);
          break;

        // AI Service message handlers
        case 'ai:analyze-form':
          await this.handleAIAnalyzeForm(message.data, sendResponse);
          break;

        case 'ai:validate-token':
          await this.handleAIValidateToken(message.data, sendResponse);
          break;

        case 'ai:get-cached-analysis':
          await this.handleAIGetCachedAnalysis(message.data, sendResponse);
          break;

        case 'ai:set-cached-analysis':
          await this.handleAISetCachedAnalysis(message.data, sendResponse);
          break;

        default:
          console.warn('[Job Autofill] Unknown message type:', message.type);
          sendResponse({
            success: false,
            error: 'Unknown message type',
          });
      }
    } catch (error: any) {
      console.error('[Job Autofill] Error handling message:', error);
      sendResponse({
        success: false,
        error: error.message || 'Unknown error',
      });
    }
  }

  /**
   * Handle AI Mode status check
   */
  private async handleAIModeStatus(sendResponse: (response: any) => void): Promise<void> {
    try {
      const settings = await aiSettingsStorage.get();
      
      sendResponse({
        success: true,
        data: {
          enabled: settings?.enabled || false,
          hasToken: !!(settings?.apiToken),
          model: settings?.model || 'gpt-4',
        },
      });
    } catch (error: any) {
      console.error('[Job Autofill] AI Mode status check failed:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to check AI Mode status',
      });
    }
  }

  /**
   * Handle AI settings validation
   */
  private async handleAISettingsValidation(
    data: any,
    sendResponse: (response: any) => void,
  ): Promise<void> {
    try {
      const isValid = await aiServiceClient.validateToken(data.apiToken);
      
      sendResponse({
        success: true,
        data: {
          valid: isValid,
          message: isValid ? 'Token is valid' : 'Token is invalid',
        },
      });
    } catch (error: any) {
      console.error('[Job Autofill] AI settings validation failed:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to validate AI settings',
      });
    }
  }

  /**
   * Handle AI form analysis request
   */
  private async handleAIAnalyzeForm(
    data: any,
    sendResponse: (response: any) => void,
  ): Promise<void> {
    let responseSet = false;
    
    // Set a timeout to ensure we always respond within message channel limits
    const timeoutId = setTimeout(() => {
      if (!responseSet) {
        console.warn('[Job Autofill] AI form analysis timed out, sending fallback response');
        responseSet = true;
        sendResponse({
          success: false,
          error: 'AI analysis timed out. Please try again or use traditional autofill.',
          timeout: true,
        });
      }
    }, 12000); // 12 second timeout (shorter than our API timeout)

    try {
      console.log('[Job Autofill] Starting AI form analysis...');
      
      const analysis = await aiServiceClient.analyzeForm(
        data.htmlContent,
        data.userProfile,
        data.jobContext
      );
      
      clearTimeout(timeoutId);
      if (!responseSet) {
        responseSet = true;
        console.log('[Job Autofill] AI form analysis completed successfully');
        sendResponse({
          success: true,
          data: analysis,
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('[Job Autofill] AI form analysis failed:', error);
      
      if (!responseSet) {
        responseSet = true;
        
        // Provide more specific error messages
        let errorMessage = 'AI form analysis failed';
        let shouldFallback = true;
        
        if (error.message?.includes('timeout')) {
          errorMessage = 'AI analysis timed out. The form may be too complex or the API is slow.';
        } else if (error.message?.includes('token')) {
          errorMessage = 'Invalid or expired OpenAI API token. Please check your settings.';
          shouldFallback = false;
        } else if (error.message?.includes('rate limit')) {
          errorMessage = 'OpenAI API rate limit exceeded. Please wait a moment and try again.';
        } else if (error.message?.includes('quota')) {
          errorMessage = 'OpenAI API quota exceeded. Please check your billing settings.';
          shouldFallback = false;
        } else if (error.message?.includes('network')) {
          errorMessage = 'Network error connecting to OpenAI. Please check your internet connection.';
        }
        
        sendResponse({
          success: false,
          error: errorMessage,
          originalError: error.message,
          canFallback: shouldFallback,
        });
      }
    }
  }

  /**
   * Handle AI token validation request
   */
  private async handleAIValidateToken(
    data: any,
    sendResponse: (response: any) => void,
  ): Promise<void> {
    let responseSet = false;
    
    // Set a timeout for token validation
    const timeoutId = setTimeout(() => {
      if (!responseSet) {
        console.warn('[Job Autofill] AI token validation timed out');
        responseSet = true;
        sendResponse({
          success: false,
          error: 'Token validation timed out. Please check your internet connection.',
        });
      }
    }, 10000); // 10 second timeout for token validation

    try {
      console.log('[Job Autofill] Validating AI token...');
      
      const result = await aiServiceClient.validateToken(data.token);
      
      clearTimeout(timeoutId);
      if (!responseSet) {
        responseSet = true;
        console.log('[Job Autofill] AI token validation completed:', result.isValid ? 'valid' : 'invalid');
        sendResponse({
          success: true,
          data: result,
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('[Job Autofill] AI token validation failed:', error);
      
      if (!responseSet) {
        responseSet = true;
        sendResponse({
          success: false,
          error: error.message || 'AI token validation failed',
        });
      }
    }
  }

  /**
   * Handle AI get cached analysis request
   */
  private async handleAIGetCachedAnalysis(
    data: any,
    sendResponse: (response: any) => void,
  ): Promise<void> {
    try {
      // For now, just return null since we need the full ExtractedHTML object
      // The cache manager requires ExtractedHTML, not just a hash
      sendResponse({
        success: true,
        data: null,
      });
    } catch (error: any) {
      console.warn('[Job Autofill] Failed to get cached analysis:', error);
      sendResponse({
        success: true,
        data: null, // Return null for cache miss
      });
    }
  }

  /**
   * Handle AI set cached analysis request
   */
  private async handleAISetCachedAnalysis(
    data: any,
    sendResponse: (response: any) => void,
  ): Promise<void> {
    try {
      // For now, just acknowledge the request since we need the full ExtractedHTML object
      // The cache manager requires ExtractedHTML, not just a hash
      sendResponse({
        success: true,
        data: { message: 'Caching acknowledged (simplified implementation)' },
      });
    } catch (error: any) {
      console.warn('[Job Autofill] Failed to set cached analysis:', error);
      sendResponse({
        success: true, // Don't fail the main operation if caching fails
        data: { message: 'Caching failed but operation continued' },
      });
    }
  }

  /**
   * Forward message to popup if it's open
   */
  private forwardToPopup(message: any): void {
    // Try to send to popup - will fail silently if popup is not open
    chrome.runtime.sendMessage({
      type: 'background:forward',
      originalMessage: message,
    }).catch(() => {
      // Ignore errors - popup might not be open
    });
  }

  /**
   * Get simple statistics
   */
  getStats(): {
    initialized: boolean;
    timestamp: number;
  } {
    return {
      initialized: this.initialized,
      timestamp: Date.now(),
    };
  }
}

// Initialize lightweight background
const lightweightBackground = new LightweightBackground();

// Export for debugging
(globalThis as any).lightweightBackground = lightweightBackground;

console.log('[Job Autofill] Lightweight background service worker loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
