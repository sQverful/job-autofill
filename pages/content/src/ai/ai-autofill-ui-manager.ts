/**
 * AI Autofill UI Manager
 * Manages the visibility and integration of AI autofill button based on AI Mode and form detection
 */

import type { AIAutofillProgress, AISettings } from '@extension/shared';
import { aiAutofillController } from '../ai-autofill-controller';
import { aiSettingsStorage } from '@extension/storage';

export interface AIAutofillUIOptions {
  buttonSelector?: string;
  containerSelector?: string;
  insertionStrategy?: 'append' | 'prepend' | 'before' | 'after';
  hideTraditionalButton?: boolean;
  showProgressDetails?: boolean;
  enableButtonCreation?: boolean;
}

/**
 * Manages AI autofill button visibility and user interactions
 */
export class AIAutofillUIManager {
  private readonly options: Required<AIAutofillUIOptions>;
  private aiButton: HTMLElement | null = null;
  private isAIModeEnabled = false;
  private isFormDetected = false;
  private currentProgress: AIAutofillProgress | null = null;
  private progressUpdateInterval: number | null = null;
  private formDetectionObserver: MutationObserver | null = null;

  constructor(options: AIAutofillUIOptions = {}) {
    this.options = {
      buttonSelector: '.ai-autofill-button',
      containerSelector: 'body',
      insertionStrategy: 'append',
      hideTraditionalButton: false,
      showProgressDetails: true,
      enableButtonCreation: false, // Default to false to prevent conflicts with unified manager
      ...options
    };

    if (this.options.enableButtonCreation) {
      this.initialize();
    }
  }

  /**
   * Initialize the UI manager
   */
  private async initialize(): Promise<void> {
    try {
      // Check initial AI Mode status
      await this.checkAIModeStatus();
      
      // Set up form detection
      this.setupFormDetection();
      
      // Set up AI settings monitoring
      this.setupAISettingsMonitoring();
      
      // Set up progress tracking
      this.setupProgressTracking();
      
      // Initial button visibility check
      this.updateButtonVisibility();
      
      console.log('[AIAutofillUIManager] Initialized successfully');
    } catch (error) {
      console.error('[AIAutofillUIManager] Initialization failed:', error);
    }
  }

  /**
   * Check current AI Mode status
   */
  private async checkAIModeStatus(): Promise<void> {
    try {
      const settings = await aiSettingsStorage.get();
      const hasToken = await aiSettingsStorage.hasToken();
      this.isAIModeEnabled = settings.enabled && hasToken;
    } catch (error) {
      console.error('[AIAutofillUIManager] Failed to check AI Mode status:', error);
      this.isAIModeEnabled = false;
    }
  }

  /**
   * Set up form detection to show/hide button
   */
  private setupFormDetection(): void {
    // Initial form detection
    this.detectForms();

    // Set up mutation observer to detect dynamic form changes
    this.formDetectionObserver = new MutationObserver((mutations) => {
      let shouldRecheck = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.matches('form, input, select, textarea') || 
                  element.querySelector('form, input, select, textarea')) {
                shouldRecheck = true;
              }
            }
          });
        }
      });

      if (shouldRecheck) {
        // Debounce form detection
        setTimeout(() => this.detectForms(), 500);
      }
    });

    this.formDetectionObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Detect forms on the current page
   */
  private detectForms(): void {
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    
    // Consider page to have forms if there are form elements or standalone inputs
    const hasFormElements = forms.length > 0 || inputs.length >= 3;
    
    // Additional checks for job application indicators
    const url = window.location.href.toLowerCase();
    const hasJobKeywords = ['apply', 'application', 'job', 'career', 'position'].some(keyword => 
      url.includes(keyword)
    );
    
    const pageText = document.body.textContent?.toLowerCase() || '';
    const hasJobContent = ['apply now', 'submit application', 'job application'].some(phrase =>
      pageText.includes(phrase)
    );

    this.isFormDetected = hasFormElements && (hasJobKeywords || hasJobContent || forms.length > 0);
    
    console.log('[AIAutofillUIManager] Form detection results:', {
      forms: forms.length,
      inputs: inputs.length,
      hasFormElements,
      hasJobKeywords,
      hasJobContent,
      url: url.substring(0, 100),
      isFormDetected: this.isFormDetected
    });
    
    this.updateButtonVisibility();
  }

  /**
   * Set up AI settings monitoring
   */
  private setupAISettingsMonitoring(): void {
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.aiSettings) {
        const newSettings = changes.aiSettings.newValue as AISettings;
        const wasEnabled = this.isAIModeEnabled;
        this.isAIModeEnabled = newSettings?.enabled && !!newSettings?.apiToken;
        
        if (wasEnabled !== this.isAIModeEnabled) {
          this.updateButtonVisibility();
        }
      }
    });

    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'ai-mode-changed') {
        this.isAIModeEnabled = message.enabled;
        this.updateButtonVisibility();
      }
      return false;
    });
  }

  /**
   * Set up progress tracking
   */
  private setupProgressTracking(): void {
    aiAutofillController.onProgress((progress) => {
      this.currentProgress = progress;
      this.updateButtonProgress();
    });
  }

  /**
   * Update button visibility based on AI Mode and form detection
   */
  private updateButtonVisibility(): void {
    const shouldShowButton = this.shouldShowAIButton();
    
    if (shouldShowButton && !this.aiButton) {
      this.showAIButton();
    } else if (!shouldShowButton && this.aiButton) {
      this.hideAIButton();
    }

    // Update traditional button visibility if configured
    if (this.options.hideTraditionalButton && this.aiButton) {
      this.updateTraditionalButtonVisibility(!shouldShowButton);
    }
  }

  /**
   * Determine if AI button should be shown
   */
  private shouldShowAIButton(): boolean {
    // Always show button if forms are detected (even if AI Mode is disabled, to allow enabling)
    console.log('[AIAutofillUIManager] shouldShowAIButton check:', {
      isFormDetected: this.isFormDetected,
      isAIModeEnabled: this.isAIModeEnabled,
      shouldShow: this.isFormDetected
    });
    return this.isFormDetected;
  }

  /**
   * Show the AI autofill button
   */
  private showAIButton(): void {
    if (this.aiButton) {
      console.log('[AIAutofillUIManager] AI button already exists, skipping creation');
      return; // Button already exists
    }

    console.log('[AIAutofillUIManager] Creating AI autofill button...');

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'ai-autofill-button-container';
    buttonContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 16px;
      max-width: 280px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: move;
      user-select: none;
    `;

    // Make button draggable
    this.makeDraggable(buttonContainer);

    // Create button element
    const button = document.createElement('button');
    button.className = 'ai-autofill-button';
    button.innerHTML = this.getButtonHTML();
    button.addEventListener('click', this.handleButtonClick.bind(this));

    buttonContainer.appendChild(button);

    // Add progress container if enabled
    if (this.options.showProgressDetails) {
      const progressContainer = document.createElement('div');
      progressContainer.className = 'ai-autofill-progress';
      progressContainer.style.display = 'none';
      buttonContainer.appendChild(progressContainer);
    }

    // Insert button into page
    this.insertButton(buttonContainer);
    this.aiButton = buttonContainer;

    console.log('[AIAutofillUIManager] AI button shown');
  }

  /**
   * Hide the AI autofill button
   */
  private hideAIButton(): void {
    if (this.aiButton) {
      this.aiButton.remove();
      this.aiButton = null;
      console.log('[AIAutofillUIManager] AI button hidden');
    }
  }

  /**
   * Insert button into the page based on insertion strategy
   */
  private insertButton(buttonElement: HTMLElement): void {
    const container = document.querySelector(this.options.containerSelector);
    if (!container) {
      document.body.appendChild(buttonElement);
      return;
    }

    switch (this.options.insertionStrategy) {
      case 'prepend':
        container.insertBefore(buttonElement, container.firstChild);
        break;
      case 'before':
        container.parentNode?.insertBefore(buttonElement, container);
        break;
      case 'after':
        container.parentNode?.insertBefore(buttonElement, container.nextSibling);
        break;
      case 'append':
      default:
        container.appendChild(buttonElement);
        break;
    }
  }

  /**
   * Get button HTML content
   */
  private getButtonHTML(): string {
    const isProcessing = aiAutofillController.isProcessingAutofill();
    const buttonText = this.getButtonText();
    const buttonClass = this.getButtonClass();
    const iconHTML = this.getButtonIcon();

    return `
      <div class="${buttonClass}">
        <div style="display: flex; align-items: center; justify-content: center;">
          ${iconHTML}
          <span style="margin-left: 8px;">${buttonText}</span>
        </div>
      </div>
    `;
  }

  /**
   * Get button text based on current state
   */
  private getButtonText(): string {
    if (!this.isAIModeEnabled) {
      return 'Enable AI Mode';
    }

    if (aiAutofillController.isProcessingAutofill()) {
      if (this.currentProgress) {
        switch (this.currentProgress.stage) {
          case 'analyzing':
            return 'AI Analyzing...';
          case 'executing':
            return 'AI Filling...';
          case 'completed':
            return 'Completed!';
          case 'error':
            return 'AI Failed';
          default:
            return 'Processing...';
        }
      }
      return 'AI Processing...';
    }

    return 'AI Autofill';
  }

  /**
   * Get button CSS class based on current state
   */
  private getButtonClass(): string {
    const baseClass = `
      width: 100%;
      padding: 12px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      color: white;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    if (!this.isAIModeEnabled) {
      return `${baseClass} background: linear-gradient(135deg, #8B5CF6, #A855F7); hover:background: linear-gradient(135deg, #7C3AED, #9333EA);`;
    }

    if (aiAutofillController.isProcessingAutofill()) {
      return `${baseClass} background: #6B7280; cursor: not-allowed;`;
    }

    return `${baseClass} background: linear-gradient(135deg, #3B82F6, #8B5CF6); hover:background: linear-gradient(135deg, #2563EB, #7C3AED);`;
  }

  /**
   * Get button icon HTML
   */
  private getButtonIcon(): string {
    if (aiAutofillController.isProcessingAutofill()) {
      return `
        <div style="
          width: 16px;
          height: 16px;
          border: 2px solid white;
          border-top: 2px solid transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        "></div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }

    return `
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
        <circle cx="16" cy="16" r="2" opacity="0.75"/>
        <circle cx="4" cy="16" r="2" opacity="0.75"/>
      </svg>
    `;
  }

  /**
   * Handle button click
   */
  private async handleButtonClick(): Promise<void> {
    try {
      if (!this.isAIModeEnabled) {
        // Redirect to settings to enable AI Mode
        this.openAISettings();
        return;
      }

      if (aiAutofillController.isProcessingAutofill()) {
        // Cancel ongoing operation
        aiAutofillController.cancel();
        return;
      }

      // Start AI autofill
      console.log('[AIAutofillUIManager] Starting AI autofill...');
      const result = await aiAutofillController.performAIAutofill();
      
      // Show success feedback
      this.showFeedback(
        result.success ? 'success' : 'error',
        result.success 
          ? `AI filled ${result.successfulInstructions}/${result.totalInstructions} fields`
          : `AI autofill failed: ${result.errors.join(', ')}`
      );

    } catch (error: any) {
      console.error('[AIAutofillUIManager] AI autofill failed:', error);
      this.showFeedback('error', `AI autofill failed: ${error.message}`);
    }
  }

  /**
   * Update button progress display
   */
  private updateButtonProgress(): void {
    if (!this.aiButton) {
      return;
    }

    const button = this.aiButton.querySelector('.ai-autofill-button');
    if (button) {
      button.innerHTML = this.getButtonHTML();
    }

    // Update progress details if enabled
    if (this.options.showProgressDetails && this.currentProgress) {
      this.updateProgressDetails();
    }
  }

  /**
   * Update progress details display
   */
  private updateProgressDetails(): void {
    if (!this.aiButton || !this.currentProgress) {
      return;
    }

    const progressContainer = this.aiButton.querySelector('.ai-autofill-progress') as HTMLElement;
    if (!progressContainer) {
      return;
    }

    const isVisible = this.currentProgress.stage !== 'completed' && this.currentProgress.progress > 0;
    progressContainer.style.display = isVisible ? 'block' : 'none';

    if (isVisible) {
      progressContainer.innerHTML = `
        <div style="margin-top: 12px; font-size: 12px; color: #6B7280;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${this.currentProgress.message}
            </span>
            <span style="margin-left: 8px; font-family: monospace;">
              ${Math.round(this.currentProgress.progress)}%
            </span>
          </div>
          <div style="width: 100%; height: 4px; background: #E5E7EB; border-radius: 2px; overflow: hidden;">
            <div style="
              height: 100%;
              background: linear-gradient(90deg, #3B82F6, #8B5CF6);
              width: ${this.currentProgress.progress}%;
              transition: width 0.3s ease;
            "></div>
          </div>
          ${this.currentProgress.estimatedTimeRemaining ? `
            <div style="margin-top: 4px; color: #9CA3AF; font-size: 11px;">
              ~${Math.ceil(this.currentProgress.estimatedTimeRemaining / 1000)}s remaining
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  /**
   * Show feedback message
   */
  private showFeedback(type: 'success' | 'error' | 'info', message: string): void {
    if (!this.aiButton) {
      return;
    }

    const feedbackElement = document.createElement('div');
    feedbackElement.className = 'ai-autofill-feedback';
    feedbackElement.style.cssText = `
      margin-top: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      ${type === 'success' ? 'background: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0;' : ''}
      ${type === 'error' ? 'background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA;' : ''}
      ${type === 'info' ? 'background: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE;' : ''}
    `;
    feedbackElement.textContent = message;

    this.aiButton.appendChild(feedbackElement);

    // Remove feedback after 5 seconds
    setTimeout(() => {
      if (feedbackElement.parentNode) {
        feedbackElement.remove();
      }
    }, 5000);
  }

  /**
   * Open AI settings (redirect to extension options)
   */
  private openAISettings(): void {
    try {
      // Try multiple approaches to open settings
      chrome.runtime.sendMessage({
        type: 'open-options',
        section: 'ai-settings'
      });

      // Also try opening the extension options page directly
      chrome.runtime.sendMessage({
        type: 'open-extension-options'
      });

      // Fallback: show instructions to user
      this.showFeedback('info', 'Please open extension settings to enable AI Mode');
    } catch (error) {
      console.error('[AIAutofillUIManager] Failed to open settings:', error);
      this.showFeedback('error', 'Please manually open extension settings to enable AI Mode');
    }
  }

  /**
   * Update traditional button visibility
   */
  private updateTraditionalButtonVisibility(show: boolean): void {
    const traditionalButtons = document.querySelectorAll('.autofill-button, [data-autofill-button]');
    traditionalButtons.forEach(button => {
      const element = button as HTMLElement;
      element.style.display = show ? '' : 'none';
    });
  }

  /**
   * Make element draggable
   */
  private makeDraggable(element: HTMLElement): void {
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    const dragStart = (e: MouseEvent | TouchEvent) => {
      // Don't drag if clicking on the button itself
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return;
      }

      if (e.type === "touchstart") {
        const touch = (e as TouchEvent).touches[0];
        initialX = touch.clientX - xOffset;
        initialY = touch.clientY - yOffset;
      } else {
        initialX = (e as MouseEvent).clientX - xOffset;
        initialY = (e as MouseEvent).clientY - yOffset;
      }

      if (e.target === element) {
        isDragging = true;
        element.style.cursor = 'grabbing';
      }
    };

    const dragEnd = () => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      element.style.cursor = 'move';

      // Save position to localStorage
      localStorage.setItem('ai-autofill-button-position', JSON.stringify({
        x: currentX,
        y: currentY
      }));
    };

    const drag = (e: MouseEvent | TouchEvent) => {
      if (isDragging) {
        e.preventDefault();
        
        if (e.type === "touchmove") {
          const touch = (e as TouchEvent).touches[0];
          currentX = touch.clientX - initialX;
          currentY = touch.clientY - initialY;
        } else {
          currentX = (e as MouseEvent).clientX - initialX;
          currentY = (e as MouseEvent).clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        // Constrain to viewport
        const rect = element.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width;
        const maxY = window.innerHeight - rect.height;
        
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));

        element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
    };

    // Load saved position
    try {
      const savedPosition = localStorage.getItem('ai-autofill-button-position');
      if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        currentX = x;
        currentY = y;
        xOffset = x;
        yOffset = y;
        element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }
    } catch (error) {
      console.warn('[AIAutofillUIManager] Failed to load saved position:', error);
    }

    // Add event listeners
    element.addEventListener('mousedown', dragStart);
    element.addEventListener('touchstart', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.formDetectionObserver) {
      this.formDetectionObserver.disconnect();
      this.formDetectionObserver = null;
    }

    if (this.progressUpdateInterval) {
      clearInterval(this.progressUpdateInterval);
      this.progressUpdateInterval = null;
    }

    this.hideAIButton();
    
    console.log('[AIAutofillUIManager] Disposed');
  }
}

// Export singleton instance
export const aiAutofillUIManager = new AIAutofillUIManager();

// Add debugging functions to window for manual testing
(window as any).debugAI = {
  checkAIStatus: async () => {
    try {
      const settings = await aiSettingsStorage.get();
      console.log('AI Settings:', settings);
      return settings;
    } catch (error) {
      console.error('Failed to check AI settings:', error);
      return null;
    }
  },
  
  forceShowButton: () => {
    console.log('Forcing AI button to show...');
    aiAutofillUIManager['isFormDetected'] = true;
    aiAutofillUIManager['updateButtonVisibility']();
  },
  
  checkFormDetection: () => {
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    console.log('Form detection:', {
      forms: forms.length,
      inputs: inputs.length,
      url: window.location.href
    });
    return { forms: forms.length, inputs: inputs.length };
  },
  
  triggerAI: async () => {
    try {
      return await aiAutofillController.performAIAutofill();
    } catch (error) {
      console.error('AI autofill failed:', error);
      throw error;
    }
  }
};