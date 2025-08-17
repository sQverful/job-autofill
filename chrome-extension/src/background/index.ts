import 'webextension-polyfill';

// Import background service worker components
import { messageRouter } from './messaging/message-router.js';
import { stateManager } from './messaging/state-manager.js';
import { errorHandler } from './messaging/error-handler.js';
import { authManager } from './auth/auth-manager.js';
import { syncManager } from './api/sync-manager.js';
import { privacyManager } from './auth/privacy-manager.js';
import { initializeContentScriptSystem, destroyContentScriptSystem } from './content-script/index.js';

/**
 * Background service worker coordinator for job application autofill extension
 */
class BackgroundCoordinator {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize background service worker
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing background service worker...');

      // Setup Chrome extension event listeners
      this.setupExtensionListeners();

      // Setup tab management
      this.setupTabManagement();

      // Setup network monitoring
      this.setupNetworkMonitoring();

      // Setup message handlers
      this.setupMessageHandlers();

      // Initialize authentication state
      await this.initializeAuthState();

      // Start sync manager
      this.initializeSyncManager();

      // Initialize content script system
      await this.initializeContentScriptSystem();

      this.initialized = true;
      console.log('Background service worker initialized successfully');

      // Notify extension components that background is ready
      messageRouter.broadcastToExtension({
        id: `msg_${Date.now()}`,
        type: 'background:ready' as any,
        source: 'background' as const,
        timestamp: Date.now(),
      });

    } catch (error: any) {
      console.error('Failed to initialize background service worker:', error);
      
      await errorHandler.handleError(
        error,
        {
          component: 'background',
          action: 'initialization',
          timestamp: new Date(),
          sessionId: 'startup',
        },
        'unknown',
        'critical'
      );
    }
  }

  /**
   * Setup Chrome extension event listeners
   */
  private setupExtensionListeners(): void {
    // Handle extension installation/update
    chrome.runtime.onInstalled.addListener(async (details) => {
      console.log('Extension installed/updated:', details.reason);
      
      if (details.reason === 'install') {
        // First time installation
        await this.handleFirstInstall();
      } else if (details.reason === 'update') {
        // Extension update
        await this.handleExtensionUpdate(details.previousVersion);
      }
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('Extension startup');
      stateManager.updateState({
        meta: {
          ...stateManager.getStateSlice('meta'),
          lastActiveDate: new Date(),
        },
      });
    });

    // Handle extension suspend
    chrome.runtime.onSuspend.addListener(() => {
      console.log('Extension suspending');
      this.cleanup();
    });
  }

  /**
   * Setup tab management
   */
  private setupTabManagement(): void {
    // Handle tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
          messageRouter.emit('tab:activated', {
            tabId: activeInfo.tabId,
            url: tab.url,
          });
        }
      } catch (error) {
        console.warn('Failed to get tab info:', error);
      }
    });

    // Handle tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        messageRouter.emit('tab:updated', {
          tabId,
          url: tab.url,
          status: changeInfo.status,
        });
      }
    });

    // Handle tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      // Clean up any tab-specific state
      const currentState = stateManager.getState();
      if (currentState.autofill.activeTabId === tabId) {
        stateManager.updateState({
          autofill: {
            ...currentState.autofill,
            activeTabId: null,
            detectedForms: currentState.autofill.detectedForms.filter(
              form => form.tabId !== tabId
            ),
          },
        });
      }
    });
  }

  /**
   * Setup network monitoring
   */
  private setupNetworkMonitoring(): void {
    // Monitor online/offline status using chrome.runtime
    // Note: Service workers don't have window object, so we use chrome APIs
    console.log('Network monitoring setup (service worker mode)');
    
    // We can check network status through chrome.runtime or other APIs
    // For now, we'll assume online and handle offline scenarios through API failures
    try {
      // Service workers can detect network changes through failed requests
      // We'll implement this through the sync manager's error handling
      console.log('Network monitoring configured for service worker');
    } catch (error) {
      console.warn('Network monitoring setup failed:', error);
    }
  }

  /**
   * Setup message handlers for popup and other extension components
   */
  private setupMessageHandlers(): void {
    // Auth status handler
    messageRouter.on('auth:status', async (message, sender, sendResponse) => {
      try {
        const authState = await authManager.getAuthState();
        sendResponse({
          success: true,
          data: {
            isAuthenticated: authState.isAuthenticated,
            user: authState.user,
          },
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    });

    // Form check handler
    messageRouter.on('form:check', async (message, sender, sendResponse) => {
      try {
        const { tabId } = (message as any).data;
        // For now, return mock data since form detection isn't fully implemented
        sendResponse({
          success: true,
          data: {
            detected: false,
            platform: null,
            fieldCount: 0,
            confidence: 0,
          },
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    });

    // Activity recent handler
    messageRouter.on('activity:recent', async (message, sender, sendResponse) => {
      try {
        // For now, return empty activity list
        sendResponse({
          success: true,
          data: {
            actions: [],
          },
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    });

    // Autofill trigger handler
    messageRouter.on('autofill:trigger', async (message, sender, sendResponse) => {
      try {
        const { tabId } = (message as any).data;
        console.log('Autofill triggered for tab:', tabId);
        
        // For now, just acknowledge the request
        sendResponse({
          success: true,
          data: {
            message: 'Autofill request received',
            tabId,
          },
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    });

    // Autofill retry handler
    messageRouter.on('autofill:retry', async (message, sender, sendResponse) => {
      try {
        console.log('Autofill retry requested');
        
        sendResponse({
          success: true,
          data: {
            message: 'Retry request received',
          },
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    });

    // Settings update handler
    messageRouter.on('settings:update', async (message, sender, sendResponse) => {
      try {
        const { data } = message as any;
        console.log('Settings update:', data);
        
        // Store settings (implement actual storage later)
        sendResponse({
          success: true,
          data: {
            message: 'Settings updated',
          },
        });
      } catch (error: any) {
        sendResponse({
          success: false,
          error: error.message,
        });
      }
    });

    console.log('Message handlers setup complete');
  }

  /**
   * Initialize authentication state
   */
  private async initializeAuthState(): Promise<void> {
    try {
      const authState = await authManager.getAuthState();
      
      stateManager.updateState({
        auth: {
          isAuthenticated: authState.isAuthenticated,
          user: authState.user,
          tokens: authState.tokens,
        },
      });

      console.log('Authentication state initialized:', authState.isAuthenticated);
    } catch (error: any) {
      console.error('Failed to initialize auth state:', error);
      
      await errorHandler.handleError(
        error,
        {
          component: 'background',
          action: 'auth_initialization',
          timestamp: new Date(),
          sessionId: 'startup',
        },
        'authentication',
        'medium'
      );
    }
  }

  /**
   * Initialize sync manager
   */
  private initializeSyncManager(): void {
    // Listen for sync state changes
    syncManager.addSyncListener((syncState) => {
      stateManager.updateState({ sync: syncState });
    });

    // Start initial sync if authenticated
    const authState = stateManager.getStateSlice('auth');
    if (authState.isAuthenticated) {
      syncManager.syncIfNeeded().catch(error => {
        console.warn('Initial sync failed:', error);
      });
    }
  }

  /**
   * Handle first time installation
   */
  private async handleFirstInstall(): Promise<void> {
    console.log('Handling first time installation');
    
    // Set installation date
    stateManager.updateState({
      meta: {
        ...stateManager.getStateSlice('meta'),
        installDate: new Date(),
      },
    });

    // Show welcome notification
    stateManager.addNotification(
      'info',
      'Welcome to Job Application Autofill! Click the extension icon to get started.',
      false
    );

    // Open options page for initial setup
    chrome.tabs.create({
      url: chrome.runtime.getURL('pages/options/index.html'),
    });
  }

  /**
   * Handle extension update
   */
  private async handleExtensionUpdate(previousVersion?: string): Promise<void> {
    console.log('Handling extension update from version:', previousVersion);
    
    const currentVersion = chrome.runtime.getManifest().version;
    
    // Show update notification
    stateManager.addNotification(
      'success',
      `Extension updated to version ${currentVersion}`,
      true
    );

    // Perform any necessary migration logic here
    // await this.migrateData(previousVersion, currentVersion);
  }

  /**
   * Initialize content script system
   */
  private async initializeContentScriptSystem(): Promise<void> {
    try {
      await initializeContentScriptSystem();
      console.log('Content script system initialized');
    } catch (error: any) {
      console.error('Failed to initialize content script system:', error);
      
      await errorHandler.handleError(
        error,
        {
          component: 'background',
          action: 'content_script_initialization',
          timestamp: new Date(),
          sessionId: 'startup',
        },
        'content_script',
        'high'
      );
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    console.log('Cleaning up background service worker');
    
    // Cleanup content script system
    destroyContentScriptSystem();
    
    // Cleanup managers
    syncManager.destroy();
    stateManager.destroy();
    errorHandler.destroy();
    authManager.destroy();
    messageRouter.destroy();
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    initialized: boolean;
    messageRouter: any;
    stateManager: any;
    errorHandler: any;
  } {
    return {
      initialized: this.initialized,
      messageRouter: messageRouter.getStats(),
      stateManager: stateManager.getStats(),
      errorHandler: errorHandler.getErrorStats(),
    };
  }
}

// Initialize background coordinator
const backgroundCoordinator = new BackgroundCoordinator();

// Export for debugging
(globalThis as any).backgroundCoordinator = backgroundCoordinator;

console.log('Background service worker loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");
