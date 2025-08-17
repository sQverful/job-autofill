/**
 * Content Script Coordinator
 * Coordinates content script functionality and communication with background
 */

import { formMonitor, changeDetector } from './form-monitoring/index.js';
import type { FormChangeEvent, MonitoredForm } from './form-monitoring/index.js';

export interface ContentScriptConfig {
  platform: 'linkedin' | 'indeed' | 'workday' | 'generic';
  enableFormMonitoring: boolean;
  enableChangeDetection: boolean;
  enableAutofill: boolean;
  enableAIContent: boolean;
  heartbeatInterval: number;
}

/**
 * Coordinates all content script functionality
 */
export class ContentScriptCoordinator {
  private config: ContentScriptConfig;
  private port: chrome.runtime.Port | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private initialized = false;
  private tabId: number;

  constructor(config: Partial<ContentScriptConfig> = {}) {
    this.tabId = this.getTabId();
    this.config = {
      platform: 'generic',
      enableFormMonitoring: true,
      enableChangeDetection: true,
      enableAutofill: true,
      enableAIContent: true,
      heartbeatInterval: 30000, // 30 seconds
      ...config,
    };

    this.setupMessageHandlers();
  }

  /**
   * Initialize the content script coordinator
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('Initializing content script coordinator...');

      // Detect platform
      this.config.platform = this.detectPlatform();
      console.log(`Detected platform: ${this.config.platform}`);

      // Setup communication with background
      await this.setupCommunication();

      // Initialize form monitoring if enabled
      if (this.config.enableFormMonitoring) {
        await this.initializeFormMonitoring();
      }

      // Setup change detection if enabled
      if (this.config.enableChangeDetection) {
        this.setupChangeDetection();
      }

      // Start heartbeat
      this.startHeartbeat();

      this.initialized = true;
      console.log('Content script coordinator initialized successfully');

      // Notify background that content script is ready
      this.sendMessage({
        type: 'content-script:ready',
        data: {
          platform: this.config.platform,
          url: window.location.href,
          config: this.config,
        },
      });

    } catch (error: any) {
      console.error('Failed to initialize content script coordinator:', error);
      throw error;
    }
  }

  /**
   * Setup communication with background service worker
   */
  private async setupCommunication(): Promise<void> {
    try {
      // Create persistent connection
      this.port = chrome.runtime.connect({ name: `content-script-${this.tabId}` });

      // Setup port message handler
      this.port.onMessage.addListener(this.handlePortMessage.bind(this));

      // Setup port disconnect handler
      this.port.onDisconnect.addListener(() => {
        console.log('Port disconnected from background');
        this.port = null;
        
        // Try to reconnect after a delay
        setTimeout(() => {
          if (!this.port) {
            this.setupCommunication().catch(console.error);
          }
        }, 1000);
      });

      console.log('Communication with background established');

    } catch (error: any) {
      console.error('Failed to setup communication:', error);
      
      // Fallback to runtime messages if port connection fails
      console.log('Falling back to runtime messages');
    }
  }

  /**
   * Initialize form monitoring
   */
  private async initializeFormMonitoring(): Promise<void> {
    try {
      // Start form monitoring
      formMonitor.startMonitoring();

      // Setup form event handlers
      formMonitor.addChangeListener(this.handleFormChange.bind(this));
      formMonitor.addValidationListener(this.handleValidationChange.bind(this));

      console.log('Form monitoring initialized');

    } catch (error: any) {
      console.error('Failed to initialize form monitoring:', error);
    }
  }

  /**
   * Setup change detection
   */
  private setupChangeDetection(): void {
    // Change detection is automatically setup when form monitoring is initialized
    // The form monitor will feed changes to the change detector
    console.log('Change detection setup complete');
  }

  /**
   * Handle form change events
   */
  private handleFormChange(event: FormChangeEvent): void {
    console.log('Form change detected:', event.type, event.formId);

    // Send form change notification to background
    this.sendMessage({
      type: 'form:change',
      data: {
        formId: event.formId,
        changeType: event.type,
        fieldId: event.fieldId,
        timestamp: event.timestamp,
      },
    });

    // Handle specific change types
    switch (event.type) {
      case 'form_added':
        this.handleFormAdded(event);
        break;
      case 'field_changed':
        this.handleFieldChanged(event);
        break;
      case 'validation_changed':
        this.handleValidationChanged(event);
        break;
    }
  }

  /**
   * Handle validation state changes
   */
  private handleValidationChange(validationState: any): void {
    console.log('Validation state changed for form:', validationState.formId);

    // Send validation update to background
    this.sendMessage({
      type: 'form:validation',
      data: validationState,
    });
  }

  /**
   * Handle form added event
   */
  private handleFormAdded(event: FormChangeEvent): void {
    if (!event.element) return;

    const formElement = event.element as HTMLFormElement;
    const formData = this.extractFormData(formElement);

    // Send form detected notification to background
    this.sendMessage({
      type: 'form:detected',
      data: {
        formId: event.formId,
        platform: this.config.platform,
        fieldCount: formData.fieldCount,
        confidence: formData.confidence,
        url: window.location.href,
        formData,
      },
    });
  }

  /**
   * Handle field changed event
   */
  private handleFieldChanged(event: FormChangeEvent): void {
    // Check if form is ready for autofill
    if (this.config.enableAutofill && event.formId) {
      const form = formMonitor.getForm(event.formId);
      if (form && changeDetector.isReadyForAutofill(event.formId, form)) {
        this.sendMessage({
          type: 'autofill:ready',
          data: {
            formId: event.formId,
            timing: changeDetector.getOptimalAutofillTiming(event.formId),
          },
        });
      }
    }
  }

  /**
   * Handle validation changed event
   */
  private handleValidationChanged(event: FormChangeEvent): void {
    // Send validation update
    this.sendMessage({
      type: 'form:validation-changed',
      data: {
        formId: event.formId,
        validationState: event.newValue,
      },
    });
  }

  /**
   * Handle port messages from background
   */
  private handlePortMessage(message: any): void {
    try {
      console.log('Received message from background:', message.type);

      switch (message.type) {
        case 'autofill:trigger':
          this.handleAutofillTrigger(message);
          break;
        case 'ai:generate':
          this.handleAIGenerate(message);
          break;
        case 'form:query':
          this.handleFormQuery(message);
          break;
        case 'content-script:cleanup':
          this.handleCleanup(message);
          break;
        case 'ping':
          this.handlePing(message);
          break;
        default:
          console.warn('Unknown message type:', message.type);
      }

    } catch (error: any) {
      console.error('Error handling port message:', error);
    }
  }

  /**
   * Handle autofill trigger
   */
  private async handleAutofillTrigger(message: any): Promise<void> {
    const { formId, fields } = message.data || {};
    
    console.log(`Autofill triggered for form ${formId}`);

    try {
      // Get form
      const form = formMonitor.getForm(formId);
      if (!form) {
        throw new Error(`Form ${formId} not found`);
      }

      // Check if form is ready
      if (!changeDetector.isReadyForAutofill(formId, form)) {
        const timing = changeDetector.getOptimalAutofillTiming(formId);
        console.log(`Form not ready, waiting ${timing.delay}ms: ${timing.reason}`);
        
        setTimeout(() => {
          this.handleAutofillTrigger(message);
        }, timing.delay);
        return;
      }

      // Perform autofill (placeholder - would integrate with autofill engine)
      console.log('Performing autofill...');
      
      // Send success response
      this.sendResponse(message, {
        success: true,
        formId,
        fieldsAutofilled: fields?.length || 0,
      });

    } catch (error: any) {
      console.error('Autofill failed:', error);
      
      this.sendResponse(message, {
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Handle AI content generation
   */
  private async handleAIGenerate(message: any): Promise<void> {
    const { type, context } = message.data || {};
    
    console.log(`AI content generation requested: ${type}`);

    try {
      // Extract job context from page (placeholder)
      const jobContext = this.extractJobContext();
      
      // Send AI request to background
      const response = await this.sendMessage({
        type: 'ai:generate',
        data: {
          type,
          context: { ...context, ...jobContext },
          url: window.location.href,
        },
      });

      this.sendResponse(message, response);

    } catch (error: any) {
      console.error('AI generation failed:', error);
      
      this.sendResponse(message, {
        success: false,
        error: error.message,
      });
    }
  }

  /**
   * Handle form query
   */
  private handleFormQuery(message: any): void {
    const { query } = message.data || {};
    
    console.log('Form query received:', query);

    const forms = formMonitor.getAllForms();
    const result = {
      totalForms: forms.length,
      forms: forms.map(form => ({
        id: form.id,
        fieldCount: form.fields.size,
        isValid: form.validationState.isValid,
        isMultiStep: form.isMultiStep,
        currentStep: form.currentStep,
        lastChanged: form.lastChanged,
      })),
      stats: formMonitor.getStats(),
      changeStats: changeDetector.getStats(),
    };

    this.sendResponse(message, result);
  }

  /**
   * Handle cleanup request
   */
  private handleCleanup(message: any): void {
    console.log('Cleanup requested');
    
    try {
      this.destroy();
      this.sendResponse(message, { success: true });
    } catch (error: any) {
      this.sendResponse(message, { success: false, error: error.message });
    }
  }

  /**
   * Handle ping
   */
  private handlePing(message: any): void {
    this.sendResponse(message, {
      pong: true,
      timestamp: Date.now(),
      tabId: this.tabId,
      url: window.location.href,
    });
  }

  /**
   * Setup message handlers for runtime messages
   */
  private setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle runtime messages as fallback
      this.handlePortMessage(message);
      return true; // Keep message channel open
    });
  }

  /**
   * Send message to background
   */
  private async sendMessage(message: any): Promise<any> {
    const fullMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      source: 'content',
      tabId: this.tabId,
      ...message,
    };

    try {
      // Try port first
      if (this.port) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Message timeout'));
          }, 5000);

          const responseHandler = (response: any) => {
            if (response.messageId === fullMessage.id) {
              clearTimeout(timeout);
              this.port?.onMessage.removeListener(responseHandler);
              resolve(response);
            }
          };

          this.port.onMessage.addListener(responseHandler);
          this.port.postMessage(fullMessage);
        });
      }

      // Fallback to runtime message
      return await chrome.runtime.sendMessage(fullMessage);

    } catch (error: any) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Send response to message
   */
  private sendResponse(originalMessage: any, response: any): void {
    const responseMessage = {
      messageId: originalMessage.id,
      success: true,
      timestamp: Date.now(),
      ...response,
    };

    if (this.port) {
      this.port.postMessage(responseMessage);
    }
  }

  /**
   * Start heartbeat to background
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendMessage({
        type: 'heartbeat',
        data: {
          timestamp: Date.now(),
          url: window.location.href,
          formsCount: formMonitor.getAllForms().length,
        },
      }).catch(error => {
        console.warn('Heartbeat failed:', error);
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Detect platform from URL and page content
   */
  private detectPlatform(): ContentScriptConfig['platform'] {
    const url = window.location.href.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes('linkedin.com')) {
      return 'linkedin';
    }
    
    if (hostname.includes('indeed.com')) {
      return 'indeed';
    }
    
    if (hostname.includes('workday') || hostname.includes('myworkdayjobs.com')) {
      return 'workday';
    }

    return 'generic';
  }

  /**
   * Get tab ID
   */
  private getTabId(): number {
    // Try to get tab ID from URL parameters or other methods
    // This is a placeholder - in practice, tab ID would be provided by background
    return Math.floor(Math.random() * 1000000);
  }

  /**
   * Extract form data for analysis
   */
  private extractFormData(formElement: HTMLFormElement): any {
    const fields = formElement.querySelectorAll('input, textarea, select');
    
    return {
      fieldCount: fields.length,
      confidence: 0.8, // Placeholder confidence score
      hasFileUpload: formElement.querySelector('input[type="file"]') !== null,
      hasRequiredFields: formElement.querySelector('[required]') !== null,
      isMultiStep: formElement.querySelectorAll('.step, [data-step]').length > 1,
    };
  }

  /**
   * Extract job context from page
   */
  private extractJobContext(): any {
    // Placeholder for job context extraction
    return {
      jobTitle: document.title,
      company: window.location.hostname,
      url: window.location.href,
      platform: this.config.platform,
    };
  }

  /**
   * Destroy the coordinator
   */
  destroy(): void {
    console.log('Destroying content script coordinator');

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Disconnect port
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }

    // Stop form monitoring
    formMonitor.stopMonitoring();

    this.initialized = false;
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    initialized: boolean;
    platform: string;
    config: ContentScriptConfig;
    communication: {
      hasPort: boolean;
      tabId: number;
    };
    monitoring: ReturnType<typeof formMonitor.getStats>;
    detection: ReturnType<typeof changeDetector.getStats>;
  } {
    return {
      initialized: this.initialized,
      platform: this.config.platform,
      config: this.config,
      communication: {
        hasPort: this.port !== null,
        tabId: this.tabId,
      },
      monitoring: formMonitor.getStats(),
      detection: changeDetector.getStats(),
    };
  }
}

// Create and initialize coordinator
const coordinator = new ContentScriptCoordinator();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    coordinator.initialize().catch(console.error);
  });
} else {
  coordinator.initialize().catch(console.error);
}

// Export for debugging
(globalThis as any).contentScriptCoordinator = coordinator;