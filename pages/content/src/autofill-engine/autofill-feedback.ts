/**
 * Autofill feedback and control system
 * Provides visual feedback, progress indicators, and undo functionality
 */

import type { AutofillResult, FilledField, AutofillError } from '@extension/shared/lib/types';

export interface FeedbackOptions {
  showHighlights: boolean;
  highlightDuration: number; // ms, 0 for permanent
  showProgressIndicator: boolean;
  showErrorMessages: boolean;
  enableUndo: boolean;
  animationDuration: number; // ms
}

export interface HighlightStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderStyle: string;
  boxShadow: string;
  transition: string;
}

export interface ProgressState {
  isActive: boolean;
  totalFields: number;
  processedFields: number;
  currentField?: string;
  errors: number;
}

export interface UndoState {
  originalValues: Map<string, string | boolean | FileList | null>;
  filledFields: FilledField[];
  timestamp: number;
}

export class AutofillFeedback {
  private static readonly FEEDBACK_CONTAINER_ID = 'autofill-feedback-container';
  private static readonly PROGRESS_INDICATOR_ID = 'autofill-progress-indicator';
  private static readonly ERROR_DISPLAY_ID = 'autofill-error-display';
  private static readonly HIGHLIGHT_CLASS = 'autofill-highlighted';
  private static readonly UNDO_BUTTON_ID = 'autofill-undo-button';

  private options: FeedbackOptions;
  private highlightedElements: Set<Element> = new Set();
  private progressIndicator: HTMLElement | null = null;
  private errorDisplay: HTMLElement | null = null;
  private undoButton: HTMLElement | null = null;
  private undoState: UndoState | null = null;
  private styleSheet: CSSStyleSheet | null = null;

  constructor(options: Partial<FeedbackOptions> = {}) {
    this.options = {
      showHighlights: true,
      highlightDuration: 3000,
      showProgressIndicator: true,
      showErrorMessages: true,
      enableUndo: true,
      animationDuration: 300,
      ...options
    };

    this.initializeStyles();
    this.createFeedbackContainer();
  }

  /**
   * Initialize CSS styles for feedback elements
   */
  private initializeStyles(): void {
    const styleElement = document.createElement('style');
    styleElement.id = 'autofill-feedback-styles';
    
    const css = `
      .${AutofillFeedback.HIGHLIGHT_CLASS} {
        background-color: rgba(76, 175, 80, 0.1) !important;
        border: 2px solid #4CAF50 !important;
        box-shadow: 0 0 8px rgba(76, 175, 80, 0.3) !important;
        transition: all ${this.options.animationDuration}ms ease-in-out !important;
      }

      .${AutofillFeedback.HIGHLIGHT_CLASS}.error {
        background-color: rgba(244, 67, 54, 0.1) !important;
        border-color: #F44336 !important;
        box-shadow: 0 0 8px rgba(244, 67, 54, 0.3) !important;
      }

      #${AutofillFeedback.FEEDBACK_CONTAINER_ID} {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        pointer-events: none;
      }

      #${AutofillFeedback.PROGRESS_INDICATOR_ID} {
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        margin-bottom: 12px;
        min-width: 280px;
        pointer-events: auto;
        opacity: 0;
        transform: translateX(100%);
        transition: all ${this.options.animationDuration}ms ease-in-out;
      }

      #${AutofillFeedback.PROGRESS_INDICATOR_ID}.visible {
        opacity: 1;
        transform: translateX(0);
      }

      .progress-header {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }

      .progress-icon {
        width: 20px;
        height: 20px;
        margin-right: 8px;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      .progress-title {
        font-weight: 600;
        color: #333;
      }

      .progress-bar {
        width: 100%;
        height: 6px;
        background: #f0f0f0;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #4CAF50, #45a049);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      .progress-text {
        font-size: 12px;
        color: #666;
        display: flex;
        justify-content: space-between;
      }

      .current-field {
        font-size: 11px;
        color: #888;
        margin-top: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${AutofillFeedback.ERROR_DISPLAY_ID} {
        background: #fff5f5;
        border: 1px solid #fed7d7;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        pointer-events: auto;
        opacity: 0;
        transform: translateX(100%);
        transition: all ${this.options.animationDuration}ms ease-in-out;
      }

      #${AutofillFeedback.ERROR_DISPLAY_ID}.visible {
        opacity: 1;
        transform: translateX(0);
      }

      .error-header {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }

      .error-icon {
        width: 16px;
        height: 16px;
        margin-right: 6px;
        color: #e53e3e;
      }

      .error-title {
        font-weight: 600;
        color: #e53e3e;
        font-size: 13px;
      }

      .error-list {
        font-size: 12px;
        color: #666;
        max-height: 120px;
        overflow-y: auto;
      }

      .error-item {
        margin-bottom: 4px;
        padding: 2px 0;
      }

      #${AutofillFeedback.UNDO_BUTTON_ID} {
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        pointer-events: auto;
        transition: background-color 0.2s ease;
        width: 100%;
      }

      #${AutofillFeedback.UNDO_BUTTON_ID}:hover {
        background: #1976D2;
      }

      #${AutofillFeedback.UNDO_BUTTON_ID}:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .fade-out {
        opacity: 0 !important;
        transform: translateX(100%) !important;
      }
    `;

    styleElement.textContent = css;
    document.head.appendChild(styleElement);
  }

  /**
   * Create the main feedback container
   */
  private createFeedbackContainer(): void {
    if (document.getElementById(AutofillFeedback.FEEDBACK_CONTAINER_ID)) {
      return;
    }

    const container = document.createElement('div');
    container.id = AutofillFeedback.FEEDBACK_CONTAINER_ID;
    document.body.appendChild(container);
  }

  /**
   * Show progress indicator
   */
  showProgress(state: ProgressState): void {
    if (!this.options.showProgressIndicator) return;

    if (!this.progressIndicator) {
      this.createProgressIndicator();
    }

    if (this.progressIndicator) {
      this.updateProgressIndicator(state);
      this.progressIndicator.classList.add('visible');
    }
  }

  /**
   * Hide progress indicator
   */
  hideProgress(): void {
    if (this.progressIndicator) {
      this.progressIndicator.classList.remove('visible');
      setTimeout(() => {
        if (this.progressIndicator && !this.progressIndicator.classList.contains('visible')) {
          this.progressIndicator.remove();
          this.progressIndicator = null;
        }
      }, this.options.animationDuration);
    }
  }

  /**
   * Create progress indicator element
   */
  private createProgressIndicator(): void {
    const container = document.getElementById(AutofillFeedback.FEEDBACK_CONTAINER_ID);
    if (!container) return;

    this.progressIndicator = document.createElement('div');
    this.progressIndicator.id = AutofillFeedback.PROGRESS_INDICATOR_ID;
    this.progressIndicator.innerHTML = `
      <div class="progress-header">
        <svg class="progress-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z" />
        </svg>
        <span class="progress-title">Filling form...</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <div class="progress-text">
        <span class="progress-count">0 / 0</span>
        <span class="progress-percentage">0%</span>
      </div>
      <div class="current-field"></div>
    `;

    container.appendChild(this.progressIndicator);
  }

  /**
   * Update progress indicator content
   */
  private updateProgressIndicator(state: ProgressState): void {
    if (!this.progressIndicator) return;

    const percentage = state.totalFields > 0 ? Math.round((state.processedFields / state.totalFields) * 100) : 0;
    
    const progressFill = this.progressIndicator.querySelector('.progress-fill') as HTMLElement;
    const progressCount = this.progressIndicator.querySelector('.progress-count') as HTMLElement;
    const progressPercentage = this.progressIndicator.querySelector('.progress-percentage') as HTMLElement;
    const currentField = this.progressIndicator.querySelector('.current-field') as HTMLElement;

    if (progressFill) {
      progressFill.style.width = `${percentage}%`;
    }

    if (progressCount) {
      progressCount.textContent = `${state.processedFields} / ${state.totalFields}`;
    }

    if (progressPercentage) {
      progressPercentage.textContent = `${percentage}%`;
    }

    if (currentField && state.currentField) {
      currentField.textContent = `Current: ${state.currentField}`;
    }

    // Update title based on completion
    const title = this.progressIndicator.querySelector('.progress-title') as HTMLElement;
    if (title) {
      if (state.processedFields >= state.totalFields) {
        title.textContent = 'Form filled!';
        const icon = this.progressIndicator.querySelector('.progress-icon') as HTMLElement;
        if (icon) {
          icon.innerHTML = `<path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />`;
          icon.style.animation = 'none';
          icon.style.color = '#4CAF50';
        }
      }
    }
  }

  /**
   * Show error messages
   */
  showErrors(errors: AutofillError[]): void {
    if (!this.options.showErrorMessages || errors.length === 0) return;

    if (!this.errorDisplay) {
      this.createErrorDisplay();
    }

    if (this.errorDisplay) {
      this.updateErrorDisplay(errors);
      this.errorDisplay.classList.add('visible');

      // Auto-hide after 10 seconds
      setTimeout(() => {
        this.hideErrors();
      }, 10000);
    }
  }

  /**
   * Hide error display
   */
  hideErrors(): void {
    if (this.errorDisplay) {
      this.errorDisplay.classList.remove('visible');
    }
  }

  /**
   * Create error display element
   */
  private createErrorDisplay(): void {
    const container = document.getElementById(AutofillFeedback.FEEDBACK_CONTAINER_ID);
    if (!container) return;

    this.errorDisplay = document.createElement('div');
    this.errorDisplay.id = AutofillFeedback.ERROR_DISPLAY_ID;
    this.errorDisplay.innerHTML = `
      <div class="error-header">
        <svg class="error-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" />
        </svg>
        <span class="error-title">Some fields couldn't be filled</span>
      </div>
      <div class="error-list"></div>
    `;

    container.appendChild(this.errorDisplay);
  }

  /**
   * Update error display content
   */
  private updateErrorDisplay(errors: AutofillError[]): void {
    if (!this.errorDisplay) return;

    const errorList = this.errorDisplay.querySelector('.error-list') as HTMLElement;
    if (!errorList) return;

    errorList.innerHTML = errors.map(error => `
      <div class="error-item">
        <strong>${error.code}:</strong> ${error.message}
      </div>
    `).join('');
  }

  /**
   * Highlight filled fields
   */
  highlightFields(filledFields: FilledField[], errors: AutofillError[] = []): void {
    if (!this.options.showHighlights) return;

    // Clear existing highlights
    this.clearHighlights();

    // Highlight filled fields
    for (const field of filledFields) {
      const element = document.querySelector(field.selector);
      if (element) {
        element.classList.add(AutofillFeedback.HIGHLIGHT_CLASS);
        this.highlightedElements.add(element);
      }
    }

    // Highlight error fields
    for (const error of errors) {
      const element = document.querySelector(error.selector);
      if (element) {
        element.classList.add(AutofillFeedback.HIGHLIGHT_CLASS, 'error');
        this.highlightedElements.add(element);
      }
    }

    // Auto-remove highlights after duration
    if (this.options.highlightDuration > 0) {
      setTimeout(() => {
        this.clearHighlights();
      }, this.options.highlightDuration);
    }
  }

  /**
   * Clear all field highlights
   */
  clearHighlights(): void {
    for (const element of this.highlightedElements) {
      element.classList.remove(AutofillFeedback.HIGHLIGHT_CLASS, 'error');
    }
    this.highlightedElements.clear();
  }

  /**
   * Store undo state before autofill
   */
  storeUndoState(fields: FilledField[]): void {
    if (!this.options.enableUndo) return;

    const originalValues = new Map<string, string | boolean | FileList | null>();

    for (const field of fields) {
      const element = document.querySelector(field.selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (element) {
        if (element.type === 'file') {
          originalValues.set(field.selector, (element as HTMLInputElement).files);
        } else if (element.type === 'checkbox' || element.type === 'radio') {
          originalValues.set(field.selector, (element as HTMLInputElement).checked);
        } else {
          originalValues.set(field.selector, element.value);
        }
      }
    }

    this.undoState = {
      originalValues,
      filledFields: [...fields],
      timestamp: Date.now()
    };
  }

  /**
   * Show undo button
   */
  showUndoButton(result: AutofillResult): void {
    if (!this.options.enableUndo || result.filledFields.length === 0) return;

    if (!this.undoButton) {
      this.createUndoButton();
    }

    if (this.undoButton) {
      this.undoButton.style.display = 'block';
      
      // Auto-hide after 30 seconds
      setTimeout(() => {
        this.hideUndoButton();
      }, 30000);
    }
  }

  /**
   * Hide undo button
   */
  hideUndoButton(): void {
    if (this.undoButton) {
      this.undoButton.style.display = 'none';
    }
  }

  /**
   * Create undo button
   */
  private createUndoButton(): void {
    const container = document.getElementById(AutofillFeedback.FEEDBACK_CONTAINER_ID);
    if (!container) return;

    this.undoButton = document.createElement('button');
    this.undoButton.id = AutofillFeedback.UNDO_BUTTON_ID;
    this.undoButton.textContent = 'Undo Autofill';
    this.undoButton.style.display = 'none';

    this.undoButton.addEventListener('click', () => {
      this.performUndo();
    });

    container.appendChild(this.undoButton);
  }

  /**
   * Perform undo operation
   */
  performUndo(): void {
    if (!this.undoState) return;

    for (const [selector, originalValue] of this.undoState.originalValues) {
      const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      if (element) {
        if (element.type === 'file') {
          // Can't restore file inputs, just clear them
          (element as HTMLInputElement).value = '';
        } else if (element.type === 'checkbox' || element.type === 'radio') {
          (element as HTMLInputElement).checked = originalValue as boolean;
        } else {
          element.value = originalValue as string;
        }

        // Trigger change events
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    this.clearHighlights();
    this.hideUndoButton();
    this.undoState = null;

    // Show confirmation
    this.showUndoConfirmation();
  }

  /**
   * Show undo confirmation
   */
  private showUndoConfirmation(): void {
    const container = document.getElementById(AutofillFeedback.FEEDBACK_CONTAINER_ID);
    if (!container) return;

    const confirmation = document.createElement('div');
    confirmation.style.cssText = `
      background: #4CAF50;
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateX(100%);
      transition: all ${this.options.animationDuration}ms ease-in-out;
    `;
    confirmation.textContent = 'Autofill undone successfully';

    container.appendChild(confirmation);

    // Animate in
    setTimeout(() => {
      confirmation.style.opacity = '1';
      confirmation.style.transform = 'translateX(0)';
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
      confirmation.style.opacity = '0';
      confirmation.style.transform = 'translateX(100%)';
      setTimeout(() => {
        confirmation.remove();
      }, this.options.animationDuration);
    }, 3000);
  }

  /**
   * Show complete autofill result
   */
  showResult(result: AutofillResult): void {
    // Store undo state if there are filled fields
    if (result.filledFields.length > 0) {
      this.storeUndoState(result.filledFields);
    }

    // Show highlights
    this.highlightFields(result.filledFields, result.errors);

    // Show errors if any
    if (result.errors.length > 0) {
      this.showErrors(result.errors);
    }

    // Show undo button
    this.showUndoButton(result);

    // Hide progress indicator
    this.hideProgress();
  }

  /**
   * Clean up all feedback elements
   */
  cleanup(): void {
    this.clearHighlights();
    this.hideProgress();
    this.hideErrors();
    this.hideUndoButton();

    const container = document.getElementById(AutofillFeedback.FEEDBACK_CONTAINER_ID);
    if (container) {
      container.remove();
    }

    const styles = document.getElementById('autofill-feedback-styles');
    if (styles) {
      styles.remove();
    }
  }

  /**
   * Update options
   */
  updateOptions(newOptions: Partial<FeedbackOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current feedback options
   */
  getFeedbackOptions(): FeedbackOptions {
    return { ...this.options };
  }
}