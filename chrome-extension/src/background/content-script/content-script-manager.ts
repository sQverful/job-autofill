/**
 * Content Script Manager
 * Handles dynamic content script injection and lifecycle management
 */

import type { ExtensionMessage } from '../messaging/message-types.js';
import { messageRouter } from '../messaging/message-router.js';
import { stateManager } from '../messaging/state-manager.js';
import { errorHandler } from '../messaging/error-handler.js';

export interface ContentScriptConfig {
  id: string;
  platform: 'linkedin' | 'indeed' | 'workday' | 'generic';
  matches: string[];
  js: string[];
  css?: string[];
  runAt?: 'document_start' | 'document_end' | 'document_idle';
  allFrames?: boolean;
}

export interface InjectedScript {
  tabId: number;
  config: ContentScriptConfig;
  injectedAt: Date;
  status: 'injecting' | 'active' | 'error' | 'removed';
  error?: string;
}

/**
 * Manages content script injection and lifecycle
 */
export class ContentScriptManager {
  private injectedScripts = new Map<string, InjectedScript>();
  private platformConfigs = new Map<string, ContentScriptConfig>();
  private initialized = false;

  constructor() {
    this.setupPlatformConfigs();
    this.setupEventListeners();
  }

  /**
   * Initialize the content script manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing content script manager...');

      // Setup tab listeners
      this.setupTabListeners();

      // Setup message handlers
      this.setupMessageHandlers();

      // Check existing tabs and inject scripts if needed
      await this.checkExistingTabs();

      this.initialized = true;
      console.log('Content script manager initialized');

    } catch (error: any) {
      console.error('Failed to initialize content script manager:', error);
      
      await errorHandler.handleError(
        error,
        {
          component: 'content-script-manager',
          action: 'initialization',
          timestamp: new Date(),
          sessionId: 'startup',
        },
        'unknown',
        'high'
      );
    }
  }

  /**
   * Setup platform-specific configurations
   */
  private setupPlatformConfigs(): void {
    // LinkedIn configuration
    this.platformConfigs.set('linkedin', {
      id: 'linkedin-autofill',
      platform: 'linkedin',
      matches: [
        'https://www.linkedin.com/jobs/*',
        'https://www.linkedin.com/jobs/view/*',
        'https://linkedin.com/jobs/*',
        'https://linkedin.com/jobs/view/*'
      ],
      js: ['content-scripts/linkedin-autofill.js'],
      css: ['content-scripts/autofill-ui.css'],
      runAt: 'document_idle',
      allFrames: false,
    });

    // Indeed configuration
    this.platformConfigs.set('indeed', {
      id: 'indeed-autofill',
      platform: 'indeed',
      matches: [
        'https://www.indeed.com/viewjob*',
        'https://indeed.com/viewjob*',
        'https://*.indeed.com/viewjob*',
        'https://www.indeed.com/jobs/*',
        'https://indeed.com/jobs/*'
      ],
      js: ['content-scripts/indeed-autofill.js'],
      css: ['content-scripts/autofill-ui.css'],
      runAt: 'document_idle',
      allFrames: false,
    });

    // Workday configuration
    this.platformConfigs.set('workday', {
      id: 'workday-autofill',
      platform: 'workday',
      matches: [
        'https://*.myworkdayjobs.com/*',
        'https://*.workday.com/*'
      ],
      js: ['content-scripts/workday-autofill.js'],
      css: ['content-scripts/autofill-ui.css'],
      runAt: 'document_idle',
      allFrames: false,
    });

    // Generic configuration for other job sites
    this.platformConfigs.set('generic', {
      id: 'generic-autofill',
      platform: 'generic',
      matches: [
        'https://*/*'
      ],
      js: ['content-scripts/generic-autofill.js'],
      css: ['content-scripts/autofill-ui.css'],
      runAt: 'document_idle',
      allFrames: false,
    });
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for tab events from message router
    messageRouter.on('tab:activated', this.handleTabActivated.bind(this));
    messageRouter.on('tab:updated', this.handleTabUpdated.bind(this));
  }

  /**
   * Setup tab listeners
   */
  private setupTabListeners(): void {
    // Handle tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.cleanupTabScripts(tabId);
    });

    // Handle tab replacement (e.g., when navigating)
    chrome.tabs.onReplaced?.addListener((addedTabId, removedTabId) => {
      this.cleanupTabScripts(removedTabId);
    });
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    messageRouter.addHandler('content-script:inject', this.handleInjectRequest.bind(this));
    messageRouter.addHandler('content-script:remove', this.handleRemoveRequest.bind(this));
    messageRouter.addHandler('content-script:status', this.handleStatusRequest.bind(this));
  }

  /**
   * Handle tab activation
   */
  private async handleTabActivated(data: { tabId: number; url: string }): Promise<void> {
    try {
      await this.evaluateAndInjectScripts(data.tabId, data.url);
    } catch (error: any) {
      console.warn('Failed to handle tab activation:', error);
    }
  }

  /**
   * Handle tab updates
   */
  private async handleTabUpdated(data: { tabId: number; url: string; status: string }): Promise<void> {
    if (data.status === 'complete') {
      try {
        await this.evaluateAndInjectScripts(data.tabId, data.url);
      } catch (error: any) {
        console.warn('Failed to handle tab update:', error);
      }
    }
  }

  /**
   * Evaluate URL and inject appropriate scripts
   */
  private async evaluateAndInjectScripts(tabId: number, url: string): Promise<void> {
    const platform = this.detectPlatform(url);
    
    if (!platform) {
      console.log(`No platform detected for URL: ${url}`);
      return;
    }

    const config = this.platformConfigs.get(platform);
    if (!config) {
      console.warn(`No configuration found for platform: ${platform}`);
      return;
    }

    // Check if script is already injected
    const scriptKey = `${tabId}-${config.id}`;
    const existingScript = this.injectedScripts.get(scriptKey);
    
    if (existingScript && existingScript.status === 'active') {
      console.log(`Script already active for tab ${tabId}, platform ${platform}`);
      return;
    }

    await this.injectContentScript(tabId, config);
  }

  /**
   * Detect platform from URL
   */
  private detectPlatform(url: string): string | null {
    for (const [platform, config] of this.platformConfigs.entries()) {
      if (platform === 'generic') continue; // Skip generic for now
      
      for (const pattern of config.matches) {
        const regex = this.patternToRegex(pattern);
        if (regex.test(url)) {
          return platform;
        }
      }
    }
    
    // Return generic if no specific platform matches
    return 'generic';
  }

  /**
   * Convert match pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Inject content script into tab
   */
  private async injectContentScript(tabId: number, config: ContentScriptConfig): Promise<void> {
    const scriptKey = `${tabId}-${config.id}`;
    
    try {
      console.log(`Injecting content script for platform ${config.platform} into tab ${tabId}`);

      // Mark as injecting
      this.injectedScripts.set(scriptKey, {
        tabId,
        config,
        injectedAt: new Date(),
        status: 'injecting',
      });

      // Inject CSS first if specified
      if (config.css && config.css.length > 0) {
        await chrome.scripting.insertCSS({
          target: { tabId, allFrames: config.allFrames || false },
          files: config.css,
        });
      }

      // Inject JavaScript files
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: config.allFrames || false },
        files: config.js,
      });

      // Mark as active
      const injectedScript = this.injectedScripts.get(scriptKey);
      if (injectedScript) {
        injectedScript.status = 'active';
        this.injectedScripts.set(scriptKey, injectedScript);
      }

      console.log(`Content script injected successfully for platform ${config.platform}`);

      // Notify other components
      messageRouter.emit('content-script:injected', {
        tabId,
        platform: config.platform,
        scriptId: config.id,
      });

      // Update state
      stateManager.updateState({
        autofill: {
          ...stateManager.getStateSlice('autofill'),
          activeTabId: tabId,
          injectedScripts: Array.from(this.injectedScripts.values()),
        },
      });

    } catch (error: any) {
      console.error(`Failed to inject content script for platform ${config.platform}:`, error);

      // Mark as error
      const injectedScript = this.injectedScripts.get(scriptKey);
      if (injectedScript) {
        injectedScript.status = 'error';
        injectedScript.error = error.message;
        this.injectedScripts.set(scriptKey, injectedScript);
      }

      await errorHandler.handleError(
        error,
        {
          component: 'content-script-manager',
          action: 'script_injection',
          timestamp: new Date(),
          sessionId: `tab_${tabId}`,
          metadata: { platform: config.platform, tabId },
        },
        'content_script',
        'medium'
      );
    }
  }

  /**
   * Remove content script from tab
   */
  private async removeContentScript(tabId: number, scriptId: string): Promise<void> {
    const scriptKey = `${tabId}-${scriptId}`;
    const injectedScript = this.injectedScripts.get(scriptKey);

    if (!injectedScript) {
      console.warn(`No injected script found for tab ${tabId}, script ${scriptId}`);
      return;
    }

    try {
      // Send cleanup message to content script
      await chrome.tabs.sendMessage(tabId, {
        type: 'content-script:cleanup',
        scriptId,
      });

      // Mark as removed
      injectedScript.status = 'removed';
      this.injectedScripts.set(scriptKey, injectedScript);

      console.log(`Content script removed for tab ${tabId}, script ${scriptId}`);

    } catch (error: any) {
      console.warn(`Failed to remove content script cleanly:`, error);
      // Still mark as removed even if cleanup failed
      injectedScript.status = 'removed';
      this.injectedScripts.set(scriptKey, injectedScript);
    }
  }

  /**
   * Clean up scripts for a tab
   */
  private cleanupTabScripts(tabId: number): void {
    const scriptsToRemove: string[] = [];

    for (const [key, script] of this.injectedScripts.entries()) {
      if (script.tabId === tabId) {
        scriptsToRemove.push(key);
      }
    }

    for (const key of scriptsToRemove) {
      this.injectedScripts.delete(key);
    }

    console.log(`Cleaned up ${scriptsToRemove.length} scripts for tab ${tabId}`);
  }

  /**
   * Check existing tabs and inject scripts if needed
   */
  private async checkExistingTabs(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.id && tab.url && tab.status === 'complete') {
          await this.evaluateAndInjectScripts(tab.id, tab.url);
        }
      }

      console.log(`Checked ${tabs.length} existing tabs for script injection`);

    } catch (error: any) {
      console.error('Failed to check existing tabs:', error);
    }
  }

  /**
   * Handle inject request message
   */
  private async handleInjectRequest(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    const { tabId, platform } = (message as any).data;
    
    if (!tabId || !platform) {
      throw new Error('Missing tabId or platform in inject request');
    }

    const config = this.platformConfigs.get(platform);
    if (!config) {
      throw new Error(`No configuration found for platform: ${platform}`);
    }

    await this.injectContentScript(tabId, config);
    
    return { success: true, scriptId: config.id };
  }

  /**
   * Handle remove request message
   */
  private async handleRemoveRequest(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    const { tabId, scriptId } = (message as any).data;
    
    if (!tabId || !scriptId) {
      throw new Error('Missing tabId or scriptId in remove request');
    }

    await this.removeContentScript(tabId, scriptId);
    
    return { success: true };
  }

  /**
   * Handle status request message
   */
  private handleStatusRequest(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): any {
    const { tabId } = (message as any).data || {};
    
    if (tabId) {
      // Return status for specific tab
      const tabScripts = Array.from(this.injectedScripts.values())
        .filter(script => script.tabId === tabId);
      
      return {
        tabId,
        scripts: tabScripts,
        count: tabScripts.length,
      };
    } else {
      // Return overall status
      return {
        totalScripts: this.injectedScripts.size,
        activeScripts: Array.from(this.injectedScripts.values())
          .filter(script => script.status === 'active').length,
        platforms: Array.from(this.platformConfigs.keys()),
        scripts: Array.from(this.injectedScripts.values()),
      };
    }
  }

  /**
   * Get injected scripts for a tab
   */
  getTabScripts(tabId: number): InjectedScript[] {
    return Array.from(this.injectedScripts.values())
      .filter(script => script.tabId === tabId);
  }

  /**
   * Get all injected scripts
   */
  getAllScripts(): InjectedScript[] {
    return Array.from(this.injectedScripts.values());
  }

  /**
   * Get platform configurations
   */
  getPlatformConfigs(): ContentScriptConfig[] {
    return Array.from(this.platformConfigs.values());
  }

  /**
   * Add or update platform configuration
   */
  addPlatformConfig(config: ContentScriptConfig): void {
    this.platformConfigs.set(config.platform, config);
    console.log(`Added/updated platform configuration for ${config.platform}`);
  }

  /**
   * Remove platform configuration
   */
  removePlatformConfig(platform: string): boolean {
    const removed = this.platformConfigs.delete(platform);
    if (removed) {
      console.log(`Removed platform configuration for ${platform}`);
    }
    return removed;
  }

  /**
   * Destroy the content script manager
   */
  destroy(): void {
    console.log('Destroying content script manager');
    
    // Clean up all injected scripts
    for (const [key, script] of this.injectedScripts.entries()) {
      if (script.status === 'active') {
        this.removeContentScript(script.tabId, script.config.id).catch(console.warn);
      }
    }

    this.injectedScripts.clear();
    this.platformConfigs.clear();
    this.initialized = false;
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    initialized: boolean;
    totalScripts: number;
    activeScripts: number;
    platforms: number;
  } {
    return {
      initialized: this.initialized,
      totalScripts: this.injectedScripts.size,
      activeScripts: Array.from(this.injectedScripts.values())
        .filter(script => script.status === 'active').length,
      platforms: this.platformConfigs.size,
    };
  }
}

// Create singleton instance
export const contentScriptManager = new ContentScriptManager();