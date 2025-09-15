/**
 * Unified Autofill Button Manager
 * Manages exactly 2 autofill buttons: "Autofill Available" and "AI Powered Autofill"
 * Coordinates between traditional autofill systems and AI autofill
 */

import type { AIAutofillProgress, AISettings, DetectedForm } from '@extension/shared';
import { aiAutofillController } from './ai-autofill-controller';
import { aiSettingsStorage } from '@extension/storage';

export interface UnifiedButtonManagerOptions {
  enableTraditionalButton?: boolean;
  enableAIButton?: boolean;
  buttonsCloseable?: boolean;
  buttonsDraggable?: boolean;
  autoDetectForms?: boolean;
}

/**
 * Unified manager for all autofill buttons - shows exactly 2 buttons when needed
 */
export class UnifiedAutofillButtonManager {
  private readonly options: Required<UnifiedButtonManagerOptions>;
  private traditionalButton: HTMLElement | null = null;
  private aiButton: HTMLElement | null = null;
  private isAIModeEnabled = false;
  private hasValidToken = false;
  private formsDetected = false;
  private buttonsVisible = true;
  private formDetectionObserver: MutationObserver | null = null;
  private enhancedAutofill: any = null;
  private onDemandAutofill: any = null;

  constructor(options: UnifiedButtonManagerOptions = {}) {
    this.options = {
      enableTraditionalButton: true,
      enableAIButton: true,
      buttonsCloseable: true,
      buttonsDraggable: true,
      autoDetectForms: true,
      ...options
    };

    this.initialize();
  }

  /**
   * Initialize the unified button manager
   */
  private async initialize(): Promise<void> {
    try {
      console.log('[UnifiedAutofillButtonManager] Initializing...');

      // Get references to existing autofill systems
      await this.initializeAutofillSystems();

      // Check AI Mode status
      await this.checkAIModeStatus();

      // Set up form detection
      if (this.options.autoDetectForms) {
        this.setupFormDetection();
      }

      // Set up AI settings monitoring
      this.setupAISettingsMonitoring();

      // Load button visibility preference
      this.loadButtonVisibilityPreference();

      // Initial button visibility check
      this.updateButtonVisibility();

      console.log('[UnifiedAutofillButtonManager] Initialized successfully');
    } catch (error) {
      console.error('[UnifiedAutofillButtonManager] Initialization failed:', error);
    }
  }

  /**
   * Initialize references to existing autofill systems
   */
  private async initializeAutofillSystems(): Promise<void> {
    try {
      // Wait for autofill systems to be available
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait

      while (attempts < maxAttempts) {
        this.enhancedAutofill = (window as any).enhancedAutofill;
        this.onDemandAutofill = (window as any).onDemandAutofill;

        if (this.enhancedAutofill || this.onDemandAutofill) {
          console.log('[UnifiedAutofillButtonManager] Found autofill systems:', {
            enhanced: !!this.enhancedAutofill,
            onDemand: !!this.onDemandAutofill
          });
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!this.enhancedAutofill && !this.onDemandAutofill) {
        console.warn('[UnifiedAutofillButtonManager] No traditional autofill systems found');
      }
    } catch (error) {
      console.error('[UnifiedAutofillButtonManager] Failed to initialize autofill systems:', error);
    }
  }

  /**
   * Check current AI Mode status
   */
  private async checkAIModeStatus(): Promise<void> {
    try {
      const settings = await aiSettingsStorage.get();
      this.hasValidToken = await aiSettingsStorage.hasToken();
      this.isAIModeEnabled = settings.enabled && this.hasValidToken;
      
      console.log('[UnifiedAutofillButtonManager] AI Mode status:', {
        settingsEnabled: settings.enabled,
        hasValidToken: this.hasValidToken,
        isAIModeEnabled: this.isAIModeEnabled
      });
    } catch (error) {
      console.error('[UnifiedAutofillButtonManager] Failed to check AI Mode status:', error);
      this.isAIModeEnabled = false;
      this.hasValidToken = false;
    }
  }

  /**
   * Set up form detection
   */
  private setupFormDetection(): void {
    // Initial form detection
    this.detectForms();

    // Set up mutation observer for dynamic form changes
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

    this.formsDetected = hasFormElements && (hasJobKeywords || hasJobContent || forms.length > 0);
    
    console.log('[UnifiedAutofillButtonManager] Form detection results:', {
      forms: forms.length,
      inputs: inputs.length,
      hasFormElements,
      hasJobKeywords,
      hasJobContent,
      formsDetected: this.formsDetected
    });
    
    this.updateButtonVisibility();
  }

  /**
   * Set up AI settings monitoring
   */
  private setupAISettingsMonitoring(): void {
    // Listen for storage changes
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      if (areaName === 'local' && (changes.aiSettings || changes['ai-encrypted-token'])) {
        const wasEnabled = this.isAIModeEnabled;
        const hadToken = this.hasValidToken;
        await this.checkAIModeStatus();
        
        // Update button visibility if AI mode changed, or update button appearance if token status changed
        if (wasEnabled !== this.isAIModeEnabled) {
          this.updateButtonVisibility();
        } else if (hadToken !== this.hasValidToken && this.aiButton) {
          // Update AI button appearance when token status changes
          this.updateAIButtonAppearance();
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
   * Update button visibility based on current state
   */
  private updateButtonVisibility(): void {
    const shouldShowButtons = this.shouldShowButtons();
    
    console.log('[UnifiedAutofillButtonManager] Updating button visibility:', {
      shouldShowButtons,
      formsDetected: this.formsDetected,
      buttonsVisible: this.buttonsVisible,
      isAIModeEnabled: this.isAIModeEnabled
    });

    if (shouldShowButtons && this.buttonsVisible) {
      this.showButtons();
    } else {
      this.hideButtons();
    }
  }

  /**
   * Determine if buttons should be shown
   */
  private shouldShowButtons(): boolean {
    return this.formsDetected;
  }

  /**
   * Show both autofill buttons
   */
  private showButtons(): void {
    if (this.options.enableTraditionalButton) {
      this.showTraditionalButton();
    }
    
    if (this.options.enableAIButton) {
      this.showAIButton();
    }
  }

  /**
   * Hide both autofill buttons
   */
  private hideButtons(): void {
    this.hideTraditionalButton();
    this.hideAIButton();
  }

  /**
   * Show the traditional "Autofill Available" button
   */
  private showTraditionalButton(): void {
    if (this.traditionalButton) {
      return; // Button already exists
    }

    console.log('[UnifiedAutofillButtonManager] Creating traditional autofill button...');

    const button = document.createElement('div');
    button.className = 'unified-autofill-traditional-button';
    
    // Load saved position or use default
    const savedPosition = this.getSavedButtonPosition('traditional');
    
    button.style.cssText = `
      position: fixed;
      top: ${savedPosition.top}px;
      left: ${savedPosition.left}px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 25px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 9999;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      cursor: grab;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    `;

    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; animation: pulse 2s infinite;"></div>
        <div>
          <div style="font-weight: 600;">Autofill Available</div>
          <div style="font-size: 11px; opacity: 0.9;">Traditional autofill</div>
        </div>
        ${this.options.buttonsCloseable ? `
          <div class="close-button" style="margin-left: 8px; opacity: 0.7; cursor: pointer; font-size: 16px; line-height: 1;" title="Close">×</div>
        ` : ''}
        ${this.options.buttonsDraggable ? `
          <div class="drag-handle" style="margin-left: 4px; opacity: 0.7; font-size: 12px; cursor: grab;" title="Drag to move">⋮⋮</div>
        ` : ''}
      </div>
    `;

    // Add pulse animation
    this.addPulseAnimation();

    // Add event listeners with proper event delegation
    button.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      // Check if close button was clicked
      if (target.classList.contains('close-button') || target.closest('.close-button')) {
        e.stopPropagation();
        e.preventDefault();
        this.closeButtons();
        return;
      }
      
      // Check if drag handle was clicked (don't trigger autofill)
      if (target.classList.contains('drag-handle') || target.closest('.drag-handle')) {
        e.stopPropagation();
        return;
      }
      
      // Otherwise, handle the main button click
      this.handleTraditionalButtonClick();
    });

    // Add hover effects
    this.addButtonHoverEffects(button);

    // Make draggable if enabled
    if (this.options.buttonsDraggable) {
      this.makeDraggable(button, 'traditional');
    }

    document.body.appendChild(button);
    this.traditionalButton = button;

    console.log('[UnifiedAutofillButtonManager] Traditional button shown');
  }

  /**
   * Show the AI "AI Powered Autofill" button
   */
  private showAIButton(): void {
    if (this.aiButton) {
      return; // Button already exists
    }

    console.log('[UnifiedAutofillButtonManager] Creating AI autofill button...');

    const button = document.createElement('div');
    button.className = 'unified-autofill-ai-button';
    
    // Load saved position or use default (offset from traditional button)
    const savedPosition = this.getSavedButtonPosition('ai');
    
    button.style.cssText = `
      position: fixed;
      top: ${savedPosition.top}px;
      left: ${savedPosition.left}px;
      background: ${this.getAIButtonBackground()};
      color: white;
      padding: 12px 16px;
      border-radius: 25px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      z-index: 9998;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      cursor: grab;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
      ${!this.isAIModeEnabled || !this.hasValidToken ? 'opacity: 0.7;' : ''}
    `;

    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${this.getAIButtonIcon()}
        <div>
          <div style="font-weight: 600;">${this.getAIButtonText()}</div>
          <div style="font-size: 11px; opacity: 0.9;">${this.getAIButtonSubtext()}</div>
        </div>
        ${this.options.buttonsCloseable ? `
          <div class="close-button" style="margin-left: 8px; opacity: 0.7; cursor: pointer; font-size: 16px; line-height: 1;" title="Close">×</div>
        ` : ''}
        ${this.options.buttonsDraggable ? `
          <div class="drag-handle" style="margin-left: 4px; opacity: 0.7; font-size: 12px; cursor: grab;" title="Drag to move">⋮⋮</div>
        ` : ''}
      </div>
    `;

    // Add event listeners with proper event delegation
    button.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      // Check if close button was clicked
      if (target.classList.contains('close-button') || target.closest('.close-button')) {
        e.stopPropagation();
        e.preventDefault();
        this.closeButtons();
        return;
      }
      
      // Check if drag handle was clicked (don't trigger autofill)
      if (target.classList.contains('drag-handle') || target.closest('.drag-handle')) {
        e.stopPropagation();
        return;
      }
      
      // Otherwise, handle the main button click
      this.handleAIButtonClick();
    });

    // Add hover effects
    this.addButtonHoverEffects(button);

    // Make draggable if enabled
    if (this.options.buttonsDraggable) {
      this.makeDraggable(button, 'ai');
    }

    document.body.appendChild(button);
    this.aiButton = button;

    console.log('[UnifiedAutofillButtonManager] AI button shown');
  }

  /**
   * Hide the traditional autofill button
   */
  private hideTraditionalButton(): void {
    if (this.traditionalButton) {
      this.traditionalButton.remove();
      this.traditionalButton = null;
      console.log('[UnifiedAutofillButtonManager] Traditional button hidden');
    }
  }

  /**
   * Hide the AI autofill button
   */
  private hideAIButton(): void {
    if (this.aiButton) {
      this.aiButton.remove();
      this.aiButton = null;
      console.log('[UnifiedAutofillButtonManager] AI button hidden');
    }
  }

  /**
   * Handle traditional autofill button click
   */
  private async handleTraditionalButtonClick(): Promise<void> {
    if (!this.traditionalButton) return;

    const originalContent = this.traditionalButton.innerHTML;
    
    try {
      // Set loading state
      this.traditionalButton.style.opacity = '0.7';
      this.traditionalButton.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 12px; height: 12px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div>Filling form...</div>
        </div>
      `;

      this.addSpinAnimation();

      // Try enhanced autofill first, then on-demand autofill
      let result;
      if (this.enhancedAutofill && typeof this.enhancedAutofill.handleAutofillTrigger === 'function') {
        result = await this.enhancedAutofill.handleAutofillTrigger({
          type: 'autofill:trigger',
          source: 'unified-button',
          data: { tabId: 0 }
        });
      } else if (this.onDemandAutofill && typeof this.onDemandAutofill.handleAutofillTrigger === 'function') {
        result = await this.onDemandAutofill.handleAutofillTrigger({
          type: 'autofill:trigger',
          source: 'unified-button',
          data: { tabId: 0 }
        });
      } else {
        throw new Error('No traditional autofill system available');
      }

      // Show success state
      this.traditionalButton.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="color: #4CAF50;">✅</div>
          <div>Filled ${result.filledCount || 0} fields!</div>
        </div>
      `;

      // Reset after 3 seconds
      setTimeout(() => {
        if (this.traditionalButton) {
          this.traditionalButton.innerHTML = originalContent;
          this.traditionalButton.style.opacity = '1';
        }
      }, 3000);

    } catch (error: any) {
      console.error('[UnifiedAutofillButtonManager] Traditional autofill failed:', error);

      // Show error state
      this.traditionalButton.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="color: #f44336;">❌</div>
          <div>Autofill failed</div>
        </div>
      `;

      // Reset after 3 seconds
      setTimeout(() => {
        if (this.traditionalButton) {
          this.traditionalButton.innerHTML = originalContent;
          this.traditionalButton.style.opacity = '1';
        }
      }, 3000);
    }
  }

  /**
   * Handle AI autofill button click
   */
  private async handleAIButtonClick(): Promise<void> {
    if (!this.aiButton) return;

    console.log('[UnifiedAutofillButtonManager] AI button clicked:', {
      isAIModeEnabled: this.isAIModeEnabled,
      hasValidToken: this.hasValidToken,
      willOpenSettings: !this.isAIModeEnabled || !this.hasValidToken
    });

    if (!this.isAIModeEnabled || !this.hasValidToken) {
      // Open settings to configure AI Mode
      this.openAISettings();
      return;
    }

    const originalContent = this.aiButton.innerHTML;
    
    try {
      // Set loading state
      this.aiButton.style.opacity = '0.7';
      
      // Set up progress tracking
      const progressHandler = (progress: AIAutofillProgress) => {
        this.updateAIButtonProgress(progress);
      };
      
      aiAutofillController.onProgress(progressHandler);

      try {
        // Perform AI autofill
        const result = await aiAutofillController.performAIAutofill();
        
        // Show success state
        this.aiButton.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="color: #4CAF50;">✅</div>
            <div>AI filled ${result.successfulInstructions}/${result.totalInstructions} fields!</div>
          </div>
        `;

        // Reset after 3 seconds
        setTimeout(() => {
          if (this.aiButton) {
            this.aiButton.innerHTML = originalContent;
            this.aiButton.style.opacity = '1';
          }
        }, 3000);

      } finally {
        aiAutofillController.offProgress(progressHandler);
      }

    } catch (error: any) {
      console.error('[UnifiedAutofillButtonManager] AI autofill failed:', error);

      // Show error state
      this.aiButton.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="color: #f44336;">❌</div>
          <div>AI failed: ${error.message}</div>
        </div>
      `;

      // Reset after 5 seconds
      setTimeout(() => {
        if (this.aiButton) {
          this.aiButton.innerHTML = originalContent;
          this.aiButton.style.opacity = '1';
        }
      }, 5000);
    }
  }

  /**
   * Update AI button appearance based on current state
   */
  private updateAIButtonAppearance(): void {
    if (!this.aiButton) return;

    // Update button background
    this.aiButton.style.background = this.getAIButtonBackground();
    
    // Update button content
    this.aiButton.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        ${this.getAIButtonIcon()}
        <div>
          <div style="font-weight: 600;">${this.getAIButtonText()}</div>
          <div style="font-size: 11px; opacity: 0.9;">${this.getAIButtonSubtext()}</div>
        </div>
        ${this.options.buttonsCloseable ? `
          <div class="close-button" style="margin-left: 8px; opacity: 0.7; cursor: pointer; font-size: 16px; line-height: 1;" title="Close">×</div>
        ` : ''}
        ${this.options.buttonsDraggable ? `
          <div class="drag-handle" style="margin-left: 4px; opacity: 0.7; font-size: 12px; cursor: grab;" title="Drag to move">⋮⋮</div>
        ` : ''}
      </div>
    `;

    // Update opacity based on state
    this.aiButton.style.opacity = (!this.isAIModeEnabled || !this.hasValidToken) ? '0.7' : '1';
    
    console.log('[UnifiedAutofillButtonManager] AI button appearance updated:', {
      isAIModeEnabled: this.isAIModeEnabled,
      hasValidToken: this.hasValidToken,
      buttonText: this.getAIButtonText(),
      buttonSubtext: this.getAIButtonSubtext()
    });
  }

  /**
   * Update AI button with progress information
   */
  private updateAIButtonProgress(progress: AIAutofillProgress): void {
    if (!this.aiButton) return;

    const progressText = this.getProgressText(progress);
    const progressPercentage = Math.round(progress.progress);

    this.aiButton.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 12px; height: 12px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <div>
          <div style="font-weight: 600;">${progressText}</div>
          <div style="font-size: 11px; opacity: 0.9;">${progressPercentage}% complete</div>
        </div>
      </div>
    `;
  }

  /**
   * Get progress text based on AI progress stage
   */
  private getProgressText(progress: AIAutofillProgress): string {
    switch (progress.stage) {
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

  /**
   * Get AI button background based on current state
   */
  private getAIButtonBackground(): string {
    if (!this.isAIModeEnabled) {
      return 'linear-gradient(135deg, #6B7280, #9CA3AF)';
    }
    if (!this.hasValidToken) {
      return 'linear-gradient(135deg, #F59E0B, #D97706)';
    }
    return 'linear-gradient(135deg, #3B82F6, #8B5CF6)';
  }

  /**
   * Get AI button text based on current state
   */
  private getAIButtonText(): string {
    if (!this.isAIModeEnabled) {
      return 'AI Powered Autofill';
    }
    if (!this.hasValidToken) {
      return 'AI Powered Autofill';
    }
    return 'AI Powered Autofill';
  }

  /**
   * Get AI button subtext based on current state
   */
  private getAIButtonSubtext(): string {
    if (!this.isAIModeEnabled) {
      return 'Click to enable';
    }
    if (!this.hasValidToken) {
      return 'Setup required';
    }
    return 'Ready to use';
  }

  /**
   * Get AI button icon based on current state
   */
  private getAIButtonIcon(): string {
    if (!this.isAIModeEnabled) {
      return `
        <div style="width: 8px; height: 8px; background: #9CA3AF; border-radius: 50%; animation: pulse 2s infinite;"></div>
      `;
    }
    if (!this.hasValidToken) {
      return `
        <div style="width: 8px; height: 8px; background: #FFA500; border-radius: 50%; animation: pulse 2s infinite;"></div>
      `;
    }
    
    return `
      <div style="width: 8px; height: 8px; background: #4CAF50; border-radius: 50%; animation: pulse 2s infinite;"></div>
    `;
  }

  /**
   * Open AI settings
   */
  private openAISettings(): void {
    try {
      chrome.runtime.sendMessage({
        type: 'open-options',
        section: 'ai-settings'
      });
    } catch (error) {
      console.error('[UnifiedAutofillButtonManager] Failed to open settings:', error);
    }
  }

  /**
   * Close buttons (hide them)
   */
  private closeButtons(): void {
    this.buttonsVisible = false;
    this.hideButtons();
    this.saveButtonVisibilityPreference();
    
    // Show a small notification that buttons can be restored
    this.showRestoreNotification();
  }

  /**
   * Show restore notification
   */
  private showRestoreNotification(): void {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      z-index: 10001;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    
    notification.innerHTML = `
      <div>Autofill buttons hidden</div>
      <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">Click to restore</div>
    `;

    notification.addEventListener('click', () => {
      this.buttonsVisible = true;
      this.saveButtonVisibilityPreference();
      this.updateButtonVisibility();
      notification.remove();
    });

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
  }

  /**
   * Add pulse animation styles
   */
  private addPulseAnimation(): void {
    if (document.getElementById('unified-pulse-animation')) return;

    const style = document.createElement('style');
    style.id = 'unified-pulse-animation';
    style.textContent = `
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add spin animation styles
   */
  private addSpinAnimation(): void {
    if (document.getElementById('unified-spin-animation')) return;

    const style = document.createElement('style');
    style.id = 'unified-spin-animation';
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add hover effects to button
   */
  private addButtonHoverEffects(button: HTMLElement): void {
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
      
      // Show drag handle
      const dragHandle = button.querySelector('.drag-handle') as HTMLElement;
      if (dragHandle) {
        dragHandle.style.opacity = '1';
      }
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
      
      // Hide drag handle
      const dragHandle = button.querySelector('.drag-handle') as HTMLElement;
      if (dragHandle) {
        dragHandle.style.opacity = '0.7';
      }
    });
  }

  /**
   * Make element draggable
   */
  private makeDraggable(element: HTMLElement, buttonType: 'traditional' | 'ai'): void {
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    const dragStart = (e: MouseEvent | TouchEvent) => {
      // Don't drag if clicking on close button
      const target = e.target as HTMLElement;
      if (target.classList.contains('close-button')) {
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

      if (e.target === element || (e.target as HTMLElement).classList.contains('drag-handle')) {
        isDragging = true;
        element.style.cursor = 'grabbing';
      }
    };

    const dragEnd = () => {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
      element.style.cursor = 'grab';

      // Save position
      this.saveButtonPosition(buttonType, currentX, currentY);
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
    const savedPosition = this.getSavedButtonPosition(buttonType);
    currentX = savedPosition.left;
    currentY = savedPosition.top;
    xOffset = savedPosition.left;
    yOffset = savedPosition.top;

    // Add event listeners
    element.addEventListener('mousedown', dragStart);
    element.addEventListener('touchstart', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag);
    document.addEventListener('mouseup', dragEnd);
    document.addEventListener('touchend', dragEnd);
  }

  /**
   * Get saved button position
   */
  private getSavedButtonPosition(buttonType: 'traditional' | 'ai'): { top: number; left: number } {
    try {
      const saved = localStorage.getItem(`unified-autofill-${buttonType}-button-position`);
      if (saved) {
        const position = JSON.parse(saved);
        return {
          top: Math.max(0, Math.min(position.top, window.innerHeight - 100)),
          left: Math.max(0, Math.min(position.left, window.innerWidth - 200))
        };
      }
    } catch (error) {
      console.warn(`Failed to load saved ${buttonType} button position:`, error);
    }

    // Default positions
    return buttonType === 'traditional' 
      ? { top: 20, left: 20 }
      : { top: 80, left: 20 }; // AI button below traditional button
  }

  /**
   * Save button position
   */
  private saveButtonPosition(buttonType: 'traditional' | 'ai', left: number, top: number): void {
    try {
      localStorage.setItem(`unified-autofill-${buttonType}-button-position`, JSON.stringify({ top, left }));
    } catch (error) {
      console.warn(`Failed to save ${buttonType} button position:`, error);
    }
  }

  /**
   * Load button visibility preference
   */
  private loadButtonVisibilityPreference(): void {
    try {
      const saved = localStorage.getItem('unified-autofill-buttons-visible');
      if (saved !== null) {
        this.buttonsVisible = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load button visibility preference:', error);
    }
  }

  /**
   * Save button visibility preference
   */
  private saveButtonVisibilityPreference(): void {
    try {
      localStorage.setItem('unified-autofill-buttons-visible', JSON.stringify(this.buttonsVisible));
    } catch (error) {
      console.warn('Failed to save button visibility preference:', error);
    }
  }

  /**
   * Manually show buttons (for external use)
   */
  showButtonsManually(): void {
    this.buttonsVisible = true;
    this.saveButtonVisibilityPreference();
    this.updateButtonVisibility();
  }

  /**
   * Manually hide buttons (for external use)
   */
  hideButtonsManually(): void {
    this.closeButtons();
  }

  /**
   * Check if buttons are currently visible
   */
  areButtonsVisible(): boolean {
    return !!(this.traditionalButton || this.aiButton);
  }

  /**
   * Get current AI mode status
   */
  getAIModeStatus(): { enabled: boolean; hasToken: boolean } {
    return {
      enabled: this.isAIModeEnabled,
      hasToken: this.hasValidToken
    };
  }

  /**
   * Force form detection (for testing)
   */
  forceFormDetection(): void {
    this.formsDetected = true;
    this.updateButtonVisibility();
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    if (this.formDetectionObserver) {
      this.formDetectionObserver.disconnect();
      this.formDetectionObserver = null;
    }

    this.hideButtons();
    
    console.log('[UnifiedAutofillButtonManager] Disposed');
  }
}

// Singleton instance will be exported at the end of the file

// Debug functions
(window as any).debugUnifiedButtons = {
  showButtons: () => unifiedAutofillButtonManager.showButtonsManually(),
  hideButtons: () => unifiedAutofillButtonManager.hideButtonsManually(),
  forceFormDetection: () => unifiedAutofillButtonManager.forceFormDetection(),
  getStatus: () => ({
    buttonsVisible: unifiedAutofillButtonManager.areButtonsVisible(),
    aiMode: unifiedAutofillButtonManager.getAIModeStatus()
  })
};

// Additional debugging and testing functions
(window as any).testAI = {
  /**
   * Test AI autofill functionality manually
   */
  testAIAutofill: async () => {
    try {
      console.log('[TestAI] Starting AI autofill test...');
      const result = await aiAutofillController.performAIAutofill();
      console.log('[TestAI] AI autofill test completed:', result);
      return result;
    } catch (error) {
      console.error('[TestAI] AI autofill test failed:', error);
      throw error;
    }
  },

  /**
   * Check AI integration status
   */
  checkAIStatus: async () => {
    try {
      const settings = await aiSettingsStorage.get();
      const status = {
        aiModeEnabled: settings.enabled,
        hasApiToken: await aiSettingsStorage.hasToken(),
        model: settings.model,
        isProcessing: aiAutofillController.isProcessingAutofill(),
        buttonsVisible: unifiedAutofillButtonManager.areButtonsVisible()
      };
      console.log('[TestAI] AI Status:', status);
      return status;
    } catch (error) {
      console.error('[TestAI] Failed to check AI status:', error);
      return null;
    }
  },

  /**
   * Force show buttons for testing
   */
  forceShowButtons: () => {
    unifiedAutofillButtonManager.forceFormDetection();
    console.log('[TestAI] Forced buttons to show');
  },

  /**
   * Test traditional autofill
   */
  testTraditionalAutofill: async () => {
    try {
      console.log('[TestAI] Starting traditional autofill test...');
      const enhancedAutofill = (window as any).enhancedAutofill;
      if (enhancedAutofill && typeof enhancedAutofill.handleAutofillTrigger === 'function') {
        const result = await enhancedAutofill.handleAutofillTrigger({
          type: 'autofill:trigger',
          source: 'test',
          data: { tabId: 0 }
        });
        console.log('[TestAI] Traditional autofill test completed:', result);
        return result;
      } else {
        throw new Error('Enhanced autofill not available');
      }
    } catch (error) {
      console.error('[TestAI] Traditional autofill test failed:', error);
      throw error;
    }
  }
};

console.log('[UnifiedAutofillButtonManager] Debug functions available: window.debugUnifiedButtons, window.testAI');

// Create and export singleton instance
export const unifiedAutofillButtonManager = new UnifiedAutofillButtonManager({
  enableTraditionalButton: true,
  enableAIButton: true,
  buttonsCloseable: true,
  buttonsDraggable: true,
  autoDetectForms: true
});

// Make available globally for debugging
(window as any).unifiedAutofillButtonManager = unifiedAutofillButtonManager;