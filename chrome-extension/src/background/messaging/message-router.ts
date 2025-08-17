/**
 * Message router for handling communication between extension components
 */

import type { 
  ExtensionMessage, 
  MessageHandler, 
  EventListener,
  ResponseMessage 
} from './message-types.js';
import { isValidMessage, createResponse } from './message-types.js';

// Router configuration
interface RouterConfig {
  enableLogging: boolean;
  responseTimeout: number;
}

const DEFAULT_CONFIG: RouterConfig = {
  enableLogging: process.env.NODE_ENV === 'development',
  responseTimeout: 30000, // 30 seconds
};

/**
 * Message router for handling extension-wide communication
 */
export class MessageRouter {
  private config: RouterConfig;
  private handlers = new Map<string, MessageHandler[]>();
  private eventListeners = new Map<string, EventListener[]>();
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: number;
  }>();

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupMessageListener();
  }

  /**
   * Setup Chrome runtime message listener
   */
  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
  }

  /**
   * Register message handler
   */
  on<T extends ExtensionMessage>(
    messageType: T['type'], 
    handler: MessageHandler<T>
  ): () => void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, []);
    }
    
    this.handlers.get(messageType)!.push(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(messageType);
      if (handlers) {
        const index = handlers.indexOf(handler as MessageHandler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Register event listener
   */
  addEventListener<T = any>(
    eventType: string, 
    listener: EventListener<T>
  ): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    this.eventListeners.get(eventType)!.push(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Emit event to listeners
   */
  emit<T = any>(eventType: string, data: T): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    // Validate message format
    if (!isValidMessage(message)) {
      this.log('Invalid message received:', message);
      sendResponse(createResponse(
        { ...message, id: 'unknown', timestamp: Date.now() },
        false,
        null,
        'Invalid message format'
      ));
      return;
    }

    this.log('Received message:', message.type, message);

    // Handle response messages
    if (message.type === 'response') {
      this.handleResponse(message as ResponseMessage);
      return;
    }

    // Get handlers for message type
    const handlers = this.handlers.get(message.type);
    if (!handlers || handlers.length === 0) {
      this.log('No handlers for message type:', message.type);
      sendResponse(createResponse(
        message,
        false,
        null,
        `No handlers registered for message type: ${message.type}`
      ));
      return;
    }

    // Execute handlers
    let responseHandled = false;
    
    for (const handler of handlers) {
      try {
        const result = handler(message, sender, (response) => {
          if (!responseHandled) {
            responseHandled = true;
            sendResponse(response);
          }
        });

        // Handle async handlers
        if (result instanceof Promise) {
          try {
            const asyncResult = await result;
            if (!responseHandled) {
              responseHandled = true;
              sendResponse(createResponse(message, true, asyncResult));
            }
          } catch (error: any) {
            if (!responseHandled) {
              responseHandled = true;
              sendResponse(createResponse(
                message,
                false,
                null,
                error.message || 'Handler error'
              ));
            }
          }
        }
      } catch (error: any) {
        console.error(`Error in message handler for ${message.type}:`, error);
        if (!responseHandled) {
          responseHandled = true;
          sendResponse(createResponse(
            message,
            false,
            null,
            error.message || 'Handler error'
          ));
        }
      }
    }

    // If no handler sent a response, send default success
    if (!responseHandled) {
      sendResponse(createResponse(message, true));
    }
  }

  /**
   * Handle response messages
   */
  private handleResponse(response: ResponseMessage): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.requestId);
      
      if (response.success) {
        pending.resolve(response.data);
      } else {
        pending.reject(new Error(response.error || 'Request failed'));
      }
    }
  }

  /**
   * Send message to specific target
   */
  async sendMessage<T = any>(
    message: ExtensionMessage,
    tabId?: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error('Message timeout'));
      }, this.config.responseTimeout);

      this.pendingRequests.set(message.id, {
        resolve,
        reject,
        timeout,
      });

      this.log('Sending message:', message.type, message);

      if (tabId) {
        // Send to specific tab
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingRequests.delete(message.id);
              reject(new Error(chrome.runtime.lastError.message));
            }
          }
        });
      } else {
        // Send to runtime (background/popup/options)
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingRequests.delete(message.id);
              reject(new Error(chrome.runtime.lastError.message));
            }
          }
        });
      }
    });
  }

  /**
   * Broadcast message to all tabs
   */
  async broadcastToTabs(message: ExtensionMessage): Promise<void> {
    const tabs = await chrome.tabs.query({});
    
    const promises = tabs.map(tab => {
      if (tab.id) {
        return new Promise<void>((resolve) => {
          chrome.tabs.sendMessage(tab.id!, message, () => {
            // Ignore errors for tabs that don't have content scripts
            resolve();
          });
        });
      }
      return Promise.resolve();
    });

    await Promise.all(promises);
  }

  /**
   * Broadcast message to all extension contexts
   */
  async broadcastToExtension(message: ExtensionMessage): Promise<void> {
    // Send to all extension contexts (popup, options, etc.)
    chrome.runtime.sendMessage(message);
    
    // Also broadcast to all tabs
    await this.broadcastToTabs(message);
  }

  /**
   * Get active tab
   */
  async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  /**
   * Send message to active tab
   */
  async sendToActiveTab<T = any>(message: ExtensionMessage): Promise<T> {
    const activeTab = await this.getActiveTab();
    if (!activeTab?.id) {
      throw new Error('No active tab found');
    }
    
    return this.sendMessage<T>(message, activeTab.id);
  }

  /**
   * Log message (if logging enabled)
   */
  private log(...args: any[]): void {
    if (this.config.enableLogging) {
      console.log('[MessageRouter]', ...args);
    }
  }

  /**
   * Get router statistics
   */
  getStats(): {
    handlersCount: number;
    listenersCount: number;
    pendingRequestsCount: number;
  } {
    return {
      handlersCount: Array.from(this.handlers.values()).reduce((sum, handlers) => sum + handlers.length, 0),
      listenersCount: Array.from(this.eventListeners.values()).reduce((sum, listeners) => sum + listeners.length, 0),
      pendingRequestsCount: this.pendingRequests.size,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear all pending requests
    this.pendingRequests.forEach(({ timeout, reject }) => {
      clearTimeout(timeout);
      reject(new Error('Router destroyed'));
    });
    this.pendingRequests.clear();

    // Clear handlers and listeners
    this.handlers.clear();
    this.eventListeners.clear();
  }
}

// Export singleton instance
export const messageRouter = new MessageRouter();