import 'webextension-polyfill';

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
