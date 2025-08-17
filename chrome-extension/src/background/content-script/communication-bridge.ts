/**
 * Communication Bridge
 * Handles message passing between content scripts and background service worker
 */

import type { ExtensionMessage, BaseMessage } from '../messaging/message-types.js';
import { messageRouter } from '../messaging/message-router.js';
import { stateManager } from '../messaging/state-manager.js';
import { errorHandler } from '../messaging/error-handler.js';

export interface ContentScriptMessage extends BaseMessage {
  source: 'content';
  tabId: number;
  frameId?: number;
  url?: string;
}

export interface BackgroundToContentMessage extends BaseMessage {
  source: 'background';
  target: 'content';
  tabId: number;
  frameId?: number;
}

/**
 * Manages communication between content scripts and background
 */
export class CommunicationBridge {
  private activeConnections = new Map<number, chrome.runtime.Port>();
  private messageQueue = new Map<number, any[]>();
  private initialized = false;

  constructor() {
    this.setupMessageHandlers();
    this.setupPortHandlers();
  }

  /**
   * Initialize the communication bridge
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing communication bridge...');

      // Setup runtime message listener
      chrome.runtime.onMessage.addListener(this.handleRuntimeMessage.bind(this));

      // Setup connection listener
      chrome.runtime.onConnect.addListener(this.handleConnection.bind(this));

      this.initialized = true;
      console.log('Communication bridge initialized');

    } catch (error: any) {
      console.error('Failed to initialize communication bridge:', error);
      
      await errorHandler.handleError(
        error,
        {
          component: 'communication-bridge',
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
   * Setup message handlers for internal routing
   */
  private setupMessageHandlers(): void {
    // Handle messages that need to be sent to content scripts
    messageRouter.addHandler('content:send', this.handleSendToContent.bind(this));
    messageRouter.addHandler('content:broadcast', this.handleBroadcastToContent.bind(this));
    messageRouter.addHandler('content:query', this.handleQueryContent.bind(this));
  }

  /**
   * Setup port handlers for persistent connections
   */
  private setupPortHandlers(): void {
    // Listen for port disconnections
    messageRouter.on('port:disconnected', this.handlePortDisconnected.bind(this));
  }

  /**
   * Handle runtime messages from content scripts
   */
  private handleRuntimeMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): boolean {
    // Only handle messages from content scripts
    if (!sender.tab?.id || sender.origin === chrome.runtime.getURL('')) {
      return false;
    }

    try {
      // Validate message format
      if (!this.isValidContentMessage(message)) {
        console.warn('Invalid message format from content script:', message);
        sendResponse({ success: false, error: 'Invalid message format' });
        return true;
      }

      // Add sender information
      const contentMessage: ContentScriptMessage = {
        ...message,
        source: 'content',
        tabId: sender.tab.id,
        frameId: sender.frameId,
        url: sender.tab.url,
      };

      // Route message through message router
      this.routeContentMessage(contentMessage, sendResponse);

      return true; // Keep message channel open for async response

    } catch (error: any) {
      console.error('Error handling runtime message:', error);
      sendResponse({ success: false, error: error.message });
      return true;
    }
  }

  /**
   * Handle persistent connections from content scripts
   */
  private handleConnection(port: chrome.runtime.Port): void {
    if (!port.name.startsWith('content-script-')) {
      return; // Not a content script connection
    }

    const tabId = this.extractTabIdFromPortName(port.name);
    if (!tabId) {
      console.warn('Invalid port name format:', port.name);
      port.disconnect();
      return;
    }

    console.log(`Content script connected from tab ${tabId}`);

    // Store connection
    this.activeConnections.set(tabId, port);

    // Setup port message handler
    port.onMessage.addListener((message) => {
      this.handlePortMessage(message, tabId);
    });

    // Setup port disconnect handler
    port.onDisconnect.addListener(() => {
      this.handlePortDisconnected({ tabId });
    });

    // Send any queued messages
    this.sendQueuedMessages(tabId);

    // Notify other components
    messageRouter.emit('content-script:connected', { tabId, port: port.name });
  }

  /**
   * Route content script message to appropriate handler
   */
  private async routeContentMessage(
    message: ContentScriptMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      // Update last activity for the tab
      stateManager.updateState({
        autofill: {
          ...stateManager.getStateSlice('autofill'),
          lastActiveTabId: message.tabId,
          lastActivity: new Date(),
        },
      });

      // Route based on message type
      switch (message.type) {
        case 'form:detected':
          await this.handleFormDetected(message, sendResponse);
          break;

        case 'autofill:request':
          await this.handleAutofillRequest(message, sendResponse);
          break;

        case 'ai:generate':
          await this.handleAIRequest(message, sendResponse);
          break;

        case 'profile:get':
          await this.handleProfileRequest(message, sendResponse);
          break;

        case 'settings:get':
          await this.handleSettingsRequest(message, sendResponse);
          break;

        case 'error':
          await this.handleContentError(message, sendResponse);
          break;

        case 'heartbeat':
          await this.handleHeartbeat(message, sendResponse);
          break;

        default:
          // Forward to message router for other handlers
          const response = await messageRouter.handleMessage(message);
          sendResponse(response);
      }

    } catch (error: any) {
      console.error('Error routing content message:', error);
      
      await errorHandler.handleError(
        error,
        {
          component: 'communication-bridge',
          action: 'message_routing',
          timestamp: new Date(),
          sessionId: `tab_${message.tabId}`,
          metadata: { messageType: message.type, tabId: message.tabId },
        },
        'content_script',
        'medium'
      );

      sendResponse({ success: false, error: error.message });
    }
  }

  /**
   * Handle form detected message
   */
  private async handleFormDetected(
    message: ContentScriptMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { data } = message as any;
    
    console.log(`Form detected in tab ${message.tabId}:`, data);

    // Update state with detected form
    const currentState = stateManager.getState();
    const detectedForms = [...currentState.autofill.detectedForms];
    
    // Remove any existing forms for this tab
    const filteredForms = detectedForms.filter(form => form.tabId !== message.tabId);
    
    // Add new form
    filteredForms.push({
      tabId: message.tabId,
      platform: data.platform,
      formId: data.formId,
      fieldCount: data.fieldCount,
      confidence: data.confidence,
      detectedAt: new Date(),
      url: message.url,
    });

    stateManager.updateState({
      autofill: {
        ...currentState.autofill,
        detectedForms: filteredForms,
      },
    });

    // Notify other components
    messageRouter.emit('form:detected', {
      tabId: message.tabId,
      ...data,
    });

    sendResponse({ success: true, acknowledged: true });
  }

  /**
   * Handle autofill request
   */
  private async handleAutofillRequest(
    message: ContentScriptMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { data } = message as any;
    
    console.log(`Autofill requested for tab ${message.tabId}:`, data);

    // Forward to autofill handler
    const response = await messageRouter.handleMessage({
      ...message,
      type: 'autofill:trigger',
    });

    sendResponse(response);
  }

  /**
   * Handle AI content request
   */
  private async handleAIRequest(
    message: ContentScriptMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { data } = message as any;
    
    console.log(`AI content requested for tab ${message.tabId}:`, data.type);

    // Forward to AI handler
    const response = await messageRouter.handleMessage({
      ...message,
      type: 'ai:generate',
    });

    sendResponse(response);
  }

  /**
   * Handle profile request
   */
  private async handleProfileRequest(
    message: ContentScriptMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    console.log(`Profile requested for tab ${message.tabId}`);

    // Forward to profile handler
    const response = await messageRouter.handleMessage({
      ...message,
      type: 'profile:get',
    });

    sendResponse(response);
  }

  /**
   * Handle settings request
   */
  private async handleSettingsRequest(
    message: ContentScriptMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    console.log(`Settings requested for tab ${message.tabId}`);

    // Forward to settings handler
    const response = await messageRouter.handleMessage({
      ...message,
      type: 'settings:get',
    });

    sendResponse(response);
  }

  /**
   * Handle content script error
   */
  private async handleContentError(
    message: ContentScriptMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    const { data } = message as any;
    
    console.error(`Content script error in tab ${message.tabId}:`, data);

    // Log error through error handler
    await errorHandler.handleError(
      new Error(data.message || 'Content script error'),
      {
        component: 'content-script',
        action: data.action || 'unknown',
        timestamp: new Date(),
        sessionId: `tab_${message.tabId}`,
        metadata: { 
          tabId: message.tabId, 
          url: message.url,
          ...data.details 
        },
      },
      data.category || 'content_script',
      data.severity || 'medium'
    );

    sendResponse({ success: true, logged: true });
  }

  /**
   * Handle heartbeat message
   */
  private async handleHeartbeat(
    message: ContentScriptMessage,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    // Update last seen time for the tab
    stateManager.updateState({
      autofill: {
        ...stateManager.getStateSlice('autofill'),
        lastActiveTabId: message.tabId,
        lastActivity: new Date(),
      },
    });

    sendResponse({ 
      success: true, 
      timestamp: Date.now(),
      backgroundReady: true,
    });
  }

  /**
   * Handle port message
   */
  private handlePortMessage(message: any, tabId: number): void {
    try {
      // Add tab information and route
      const contentMessage: ContentScriptMessage = {
        ...message,
        source: 'content',
        tabId,
      };

      // Route through normal message handling
      this.routeContentMessage(contentMessage, (response) => {
        const port = this.activeConnections.get(tabId);
        if (port) {
          port.postMessage(response);
        }
      });

    } catch (error: any) {
      console.error('Error handling port message:', error);
    }
  }

  /**
   * Handle port disconnection
   */
  private handlePortDisconnected(data: { tabId: number }): void {
    const { tabId } = data;
    
    console.log(`Content script disconnected from tab ${tabId}`);

    // Remove connection
    this.activeConnections.delete(tabId);

    // Clear message queue
    this.messageQueue.delete(tabId);

    // Notify other components
    messageRouter.emit('content-script:disconnected', { tabId });

    // Update state
    const currentState = stateManager.getState();
    if (currentState.autofill.activeTabId === tabId) {
      stateManager.updateState({
        autofill: {
          ...currentState.autofill,
          activeTabId: null,
        },
      });
    }
  }

  /**
   * Send message to content script
   */
  private async handleSendToContent(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    const { tabId, data } = (message as any).data;
    
    if (!tabId) {
      throw new Error('Missing tabId in send to content request');
    }

    return await this.sendToContentScript(tabId, data);
  }

  /**
   * Broadcast message to all content scripts
   */
  private async handleBroadcastToContent(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    const { data } = (message as any).data;
    
    const results = [];
    for (const tabId of this.activeConnections.keys()) {
      try {
        const result = await this.sendToContentScript(tabId, data);
        results.push({ tabId, success: true, result });
      } catch (error: any) {
        results.push({ tabId, success: false, error: error.message });
      }
    }

    return { results, totalTabs: results.length };
  }

  /**
   * Query content scripts
   */
  private async handleQueryContent(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    const { query } = (message as any).data;
    
    const results = [];
    for (const tabId of this.activeConnections.keys()) {
      try {
        const result = await this.sendToContentScript(tabId, {
          type: 'query',
          query,
        });
        results.push({ tabId, success: true, result });
      } catch (error: any) {
        results.push({ tabId, success: false, error: error.message });
      }
    }

    return { results, totalTabs: results.length };
  }

  /**
   * Send message to specific content script
   */
  async sendToContentScript(tabId: number, data: any): Promise<any> {
    // Try port connection first
    const port = this.activeConnections.get(tabId);
    if (port) {
      return new Promise((resolve, reject) => {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const timeout = setTimeout(() => {
          reject(new Error('Message timeout'));
        }, 5000);

        const responseHandler = (response: any) => {
          if (response.messageId === messageId) {
            clearTimeout(timeout);
            port.onMessage.removeListener(responseHandler);
            resolve(response);
          }
        };

        port.onMessage.addListener(responseHandler);
        port.postMessage({ ...data, messageId });
      });
    }

    // Fallback to runtime.sendMessage
    try {
      return await chrome.tabs.sendMessage(tabId, data);
    } catch (error: any) {
      // Queue message if tab is not ready
      if (error.message.includes('Could not establish connection')) {
        this.queueMessage(tabId, data);
        throw new Error('Content script not ready, message queued');
      }
      throw error;
    }
  }

  /**
   * Queue message for later delivery
   */
  private queueMessage(tabId: number, data: any): void {
    if (!this.messageQueue.has(tabId)) {
      this.messageQueue.set(tabId, []);
    }
    
    const queue = this.messageQueue.get(tabId)!;
    queue.push({ data, timestamp: Date.now() });

    // Limit queue size
    if (queue.length > 10) {
      queue.shift();
    }

    console.log(`Queued message for tab ${tabId}, queue size: ${queue.length}`);
  }

  /**
   * Send queued messages
   */
  private async sendQueuedMessages(tabId: number): Promise<void> {
    const queue = this.messageQueue.get(tabId);
    if (!queue || queue.length === 0) {
      return;
    }

    console.log(`Sending ${queue.length} queued messages to tab ${tabId}`);

    for (const queuedMessage of queue) {
      try {
        await this.sendToContentScript(tabId, queuedMessage.data);
      } catch (error: any) {
        console.warn('Failed to send queued message:', error);
      }
    }

    // Clear queue
    this.messageQueue.delete(tabId);
  }

  /**
   * Extract tab ID from port name
   */
  private extractTabIdFromPortName(portName: string): number | null {
    const match = portName.match(/content-script-(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Validate content script message format
   */
  private isValidContentMessage(message: any): boolean {
    return (
      message &&
      typeof message === 'object' &&
      typeof message.type === 'string' &&
      typeof message.id === 'string' &&
      typeof message.timestamp === 'number'
    );
  }

  /**
   * Get active connections
   */
  getActiveConnections(): number[] {
    return Array.from(this.activeConnections.keys());
  }

  /**
   * Get connection status for tab
   */
  isTabConnected(tabId: number): boolean {
    return this.activeConnections.has(tabId);
  }

  /**
   * Get queued message count for tab
   */
  getQueuedMessageCount(tabId: number): number {
    const queue = this.messageQueue.get(tabId);
    return queue ? queue.length : 0;
  }

  /**
   * Destroy the communication bridge
   */
  destroy(): void {
    console.log('Destroying communication bridge');

    // Disconnect all ports
    for (const port of this.activeConnections.values()) {
      try {
        port.disconnect();
      } catch (error) {
        console.warn('Error disconnecting port:', error);
      }
    }

    this.activeConnections.clear();
    this.messageQueue.clear();
    this.initialized = false;
  }

  /**
   * Get bridge statistics
   */
  getStats(): {
    initialized: boolean;
    activeConnections: number;
    queuedMessages: number;
    totalTabs: number;
  } {
    let totalQueuedMessages = 0;
    for (const queue of this.messageQueue.values()) {
      totalQueuedMessages += queue.length;
    }

    return {
      initialized: this.initialized,
      activeConnections: this.activeConnections.size,
      queuedMessages: totalQueuedMessages,
      totalTabs: this.activeConnections.size,
    };
  }
}

// Create singleton instance
export const communicationBridge = new CommunicationBridge();