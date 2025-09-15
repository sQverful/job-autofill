/**
 * AI Instruction Executor
 * Executes AI-generated form filling instructions with safety checks and error handling
 */

import type { FormInstruction, ExecutionResult } from '@extension/shared';
import { safeQuerySelector } from '../utils/safe-selector';

export interface InstructionExecutorOptions {
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  safetyChecks: boolean;
  logExecution: boolean;
}

export interface ElementInteractionResult {
  success: boolean;
  element: HTMLElement | null;
  error?: string;
  actualValue?: string;
  interactionType: string;
}

/**
 * Executes AI-generated form filling instructions
 */
export class InstructionExecutor {
  private readonly options: InstructionExecutorOptions;
  private executionLog: ExecutionResult[] = [];
  private dynamicContentObserver: MutationObserver | null = null;
  private formChangeDetected = false;

  constructor(options: Partial<InstructionExecutorOptions> = {}) {
    this.options = {
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      safetyChecks: true,
      logExecution: true,
      ...options
    };

    this.setupDynamicContentDetection();
  }

  /**
   * Setup detection for dynamic content changes
   */
  private setupDynamicContentDetection(): void {
    if (typeof MutationObserver !== 'undefined') {
      this.dynamicContentObserver = new MutationObserver((mutations) => {
        let hasFormChanges = false;

        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Check if any added nodes are form elements
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                if (element.tagName === 'FORM' ||
                  element.querySelector('form') ||
                  element.matches('input, select, textarea') ||
                  element.querySelector('input, select, textarea')) {
                  hasFormChanges = true;
                }
              }
            });
          }
        });

        if (hasFormChanges) {
          this.formChangeDetected = true;
          if (this.options.logExecution) {
            console.log('[InstructionExecutor] Dynamic form content detected');
          }
        }
      });

      // Start observing
      this.dynamicContentObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  /**
   * Wait for any pending dynamic content to load
   */
  private async waitForDynamicContent(timeout: number = 2000): Promise<void> {
    const startTime = Date.now();
    this.formChangeDetected = false;

    // Wait a bit to see if any dynamic content loads
    await this.delay(500);

    // If we detected changes, wait a bit more for them to settle
    while (this.formChangeDetected && (Date.now() - startTime) < timeout) {
      this.formChangeDetected = false;
      await this.delay(300);
    }
  }

  /**
   * Detect which job site we're on for site-specific optimizations
   */
  private detectJobSite(): 'linkedin' | 'indeed' | 'glassdoor' | 'greenhouse' | 'workday' | 'lever' | 'generic' {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    if (hostname.includes('linkedin')) return 'linkedin';
    if (hostname.includes('indeed')) return 'indeed';
    if (hostname.includes('glassdoor')) return 'glassdoor';
    if (hostname.includes('greenhouse') || hostname.includes('boards.greenhouse.io')) return 'greenhouse';
    if (hostname.includes('workday') || hostname.includes('wd1.myworkdaysite.com')) return 'workday';
    if (hostname.includes('lever') || hostname.includes('jobs.lever.co')) return 'lever';

    // Check for common ATS patterns in URL
    if (pathname.includes('/greenhouse/') || pathname.includes('/apply/')) return 'greenhouse';
    if (pathname.includes('/workday/') || pathname.includes('/job_apply/')) return 'workday';

    return 'generic';
  }

  /**
   * Get site-specific configuration for better reliability
   */
  private getSiteSpecificConfig(site: string): {
    waitTime: number;
    retryDelay: number;
    maxRetries: number;
    specialSelectors?: string[];
  } {
    switch (site) {
      case 'linkedin':
        return {
          waitTime: 1000, // LinkedIn forms load quickly
          retryDelay: 500,
          maxRetries: 2,
          specialSelectors: ['.jobs-easy-apply-form', '.artdeco-text-input']
        };

      case 'indeed':
        return {
          waitTime: 2000, // Indeed has slower form loading
          retryDelay: 1000,
          maxRetries: 3,
          specialSelectors: ['.ia-BasePage-content', '.indeed-apply-form']
        };

      case 'greenhouse':
        return {
          waitTime: 1500, // Greenhouse forms are usually fast
          retryDelay: 750,
          maxRetries: 3,
          specialSelectors: ['.application-form', '.field']
        };

      case 'workday':
        return {
          waitTime: 3000, // Workday is notoriously slow
          retryDelay: 2000,
          maxRetries: 4,
          specialSelectors: ['[data-automation-id]', '.WDJC']
        };

      default:
        return {
          waitTime: 1500,
          retryDelay: 1000,
          maxRetries: 3
        };
    }
  }

  /**
   * Execute a single form instruction
   */
  async executeInstruction(instruction: FormInstruction): Promise<ExecutionResult> {
    const startTime = performance.now();
    let retryCount = 0;
    let lastError: string | undefined;

    if (this.options.logExecution) {
      console.log(`[InstructionExecutor] Executing instruction:`, instruction);
    }

    // Validate instruction
    const validationError = this.validateInstruction(instruction);
    if (validationError) {
      return this.createExecutionResult(instruction, false, validationError, undefined, performance.now() - startTime, 0);
    }

    // Enhanced retry logic with error classification
    while (retryCount <= this.options.retryAttempts) {
      try {
        const result = await this.executeInstructionInternal(instruction);

        if (result.success) {
          const executionResult = this.createExecutionResult(
            instruction,
            true,
            undefined,
            result.actualValue,
            performance.now() - startTime,
            retryCount
          );

          this.executionLog.push(executionResult);
          return executionResult;
        } else {
          lastError = result.error;

          // Classify error to determine if we should retry
          const errorType = this.classifyError(result.error || '');

          if (errorType === 'permanent') {
            // Don't retry permanent errors (element not found, wrong selector, etc.)
            break;
          }

          if (errorType === 'validation') {
            // For validation errors, wait longer before retry
            await this.delay(this.options.retryDelay * 2);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown execution error';
      }

      retryCount++;
      if (retryCount <= this.options.retryAttempts) {
        // Smart retry delay based on error type
        const errorType = this.classifyError(lastError || '');
        const baseDelay = this.options.retryDelay;
        let retryDelay = baseDelay * retryCount; // Linear backoff by default

        if (errorType === 'temporary') {
          retryDelay = baseDelay * Math.pow(2, retryCount - 1); // Exponential backoff for temporary errors
        } else if (errorType === 'network') {
          retryDelay = baseDelay * 3; // Longer delay for network issues
        }

        await this.delay(Math.min(retryDelay, 10000)); // Cap at 10 seconds
      }
    }

    const executionResult = this.createExecutionResult(
      instruction,
      false,
      lastError || 'Execution failed after retries',
      undefined,
      performance.now() - startTime,
      retryCount - 1
    );

    this.executionLog.push(executionResult);
    return executionResult;
  }

  /**
   * Classify error type to determine retry strategy
   */
  private classifyError(error: string): 'temporary' | 'permanent' | 'validation' | 'network' {
    const errorLower = error.toLowerCase();

    // Permanent errors - don't retry
    if (errorLower.includes('not found') ||
      errorLower.includes('invalid selector') ||
      errorLower.includes('unsupported action') ||
      errorLower.includes('not a text input') ||
      errorLower.includes('not a select element') ||
      errorLower.includes('not clickable')) {
      return 'permanent';
    }

    // Validation errors - retry with longer delay
    if (errorLower.includes('validation') ||
      errorLower.includes('required') ||
      errorLower.includes('invalid value') ||
      errorLower.includes('option not found')) {
      return 'validation';
    }

    // Network/API errors - retry with longer delay
    if (errorLower.includes('network') ||
      errorLower.includes('timeout') ||
      errorLower.includes('connection') ||
      errorLower.includes('fetch')) {
      return 'network';
    }

    // Temporary errors - retry with exponential backoff
    // (not interactable, hidden, disabled, etc.)
    return 'temporary';
  }

  /**
   * Execute multiple instructions in sequence
   */
  async executeInstructions(instructions: FormInstruction[]): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const instruction of instructions) {
      const result = await this.executeInstruction(instruction);
      results.push(result);

      // Add small delay between instructions to prevent overwhelming the page
      await this.delay(100);
    }

    return results;
  }

  /**
   * Internal instruction execution logic with smart action detection
   */
  private async executeInstructionInternal(instruction: FormInstruction): Promise<ElementInteractionResult> {
    // First, try to find the element and determine the best action
    const smartAction = await this.determineSmartAction(instruction);

    // Wait for the element to become available and interactable
    const element = await this.waitForInteractableElement(smartAction.selector);

    if (!element) {
      return {
        success: false,
        element: null,
        error: `Element not found or not interactable after waiting: ${smartAction.selector}`,
        interactionType: 'wait-timeout'
      };
    }

    switch (smartAction.action) {
      case 'fill':
        return await this.fillTextInput(smartAction.selector, instruction.value || '');
      case 'select':
        return await this.selectOption(smartAction.selector, instruction.value || '');
      case 'click':
        return await this.clickElement(smartAction.selector, instruction.value);
      case 'upload':
        return await this.handleFileUpload(smartAction.selector, instruction.value || '');
      default:
        return {
          success: false,
          element: null,
          error: `Unsupported action: ${instruction.action}`,
          interactionType: 'unknown'
        };
    }
  }

  /**
   * Wait for an element to become available and interactable
   */
  private async waitForInteractableElement(selector: string, timeout: number = 5000): Promise<HTMLElement | null> {
    const startTime = Date.now();
    let lastError = '';

    while (Date.now() - startTime < timeout) {
      try {
        const element = safeQuerySelector<HTMLElement>(selector);

        if (element) {
          // Check if element is interactable
          if (this.isInteractableElement(element)) {
            return element;
          } else {
            lastError = 'Element found but not interactable';
          }
        } else {
          lastError = 'Element not found';
        }

        // Wait before trying again
        await this.delay(100);
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    if (this.options.logExecution) {
      console.warn(`[InstructionExecutor] Element wait timeout for ${selector}: ${lastError}`);
    }

    return null;
  }

  /**
   * Determine the best action and selector for an instruction
   */
  private async determineSmartAction(instruction: FormInstruction): Promise<{ action: string, selector: string }> {
    // Try the original selector first with smart waiting
    let element = await this.waitForElement(instruction.selector);

    if (!element) {
      // Try alternative selectors based on the original selector
      const alternativeSelectors = this.generateAlternativeSelectors(instruction.selector);

      for (const altSelector of alternativeSelectors) {
        element = await this.waitForElement(altSelector, 2000); // Shorter wait for alternatives
        if (element) {
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Using alternative selector: ${altSelector} instead of ${instruction.selector}`);
          }
          return { action: this.determineActionForElement(element, instruction), selector: altSelector };
        }
      }

      // If still no element found, return original
      return { action: instruction.action, selector: instruction.selector };
    }

    // Determine the best action for the found element
    const bestAction = this.determineActionForElement(element, instruction);
    return { action: bestAction, selector: instruction.selector };
  }

  /**
   * Wait for element to become available and interactable
   */
  private async waitForElement(selector: string, timeout: number = 5000): Promise<HTMLElement | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = safeQuerySelector<HTMLElement>(selector);

      if (element) {
        // Check if element is interactable
        if (this.isInteractableElement(element)) {
          return element;
        }

        // If element exists but not interactable, wait a bit more
        await this.delay(100);
      } else {
        // Element doesn't exist yet, wait before trying again
        await this.delay(200);
      }
    }

    // Final attempt without interactability check
    return safeQuerySelector<HTMLElement>(selector);
  }

  /**
   * Generate alternative selectors when the original fails
   */
  private generateAlternativeSelectors(originalSelector: string): string[] {
    const alternatives: string[] = [];

    // Clean the selector by removing [value='...'] parts that AI might add incorrectly
    let cleanSelector = originalSelector.replace(/\s*\[value=['"][^'"]*['"]\]/g, '');

    // If we cleaned something, add the clean version as first alternative
    if (cleanSelector !== originalSelector) {
      alternatives.push(cleanSelector);
      if (this.options.logExecution) {
        console.log(`[InstructionExecutor] Cleaned selector from "${originalSelector}" to "${cleanSelector}"`);
      }
    }

    // Extract ID and name patterns from the clean selector
    const idMatch = cleanSelector.match(/#([^.\s\[]+)/);
    const nameMatch = cleanSelector.match(/\[name=["']([^"']+)["']\]/);

    if (idMatch) {
      const id = idMatch[1];
      alternatives.push(`#${id}`);
      alternatives.push(`[id="${id}"]`);
      alternatives.push(`input#${id}`);
      alternatives.push(`textarea#${id}`);
      alternatives.push(`select#${id}`);
    }

    if (nameMatch) {
      const name = nameMatch[1];
      alternatives.push(`[name="${name}"]`);
      alternatives.push(`input[name="${name}"]`);
      alternatives.push(`textarea[name="${name}"]`);
      alternatives.push(`select[name="${name}"]`);
    }

    // Try partial matches for complex selectors
    if (cleanSelector.includes('_attributes_')) {
      const parts = cleanSelector.split('_attributes_');
      if (parts.length > 1) {
        const baseId = parts[0].replace('#', '');
        alternatives.push(`[id*="${baseId}"]`);
        alternatives.push(`[name*="${baseId}"]`);
      }
    }

    return alternatives;
  }

  /**
   * Determine the best action for a specific element
   */
  private determineActionForElement(element: HTMLElement, instruction: FormInstruction): string {
    const tagName = element.tagName.toLowerCase();

    if (element instanceof HTMLInputElement) {
      const inputType = element.type.toLowerCase();

      switch (inputType) {
        case 'text':
        case 'email':
        case 'password':
        case 'tel':
        case 'url':
        case 'search':
        case 'number':
          return 'fill';
        case 'checkbox':
        case 'radio':
          return 'click';
        case 'file':
          return 'upload';
        case 'submit':
        case 'button':
          return 'click';
        default:
          // For unknown input types, try to determine from the instruction
          if (instruction.action === 'select' && (inputType === 'checkbox' || inputType === 'radio')) {
            return 'click';
          }
          return instruction.action;
      }
    }

    if (tagName === 'textarea') {
      return 'fill';
    }

    if (tagName === 'select') {
      return 'select';
    }

    if (tagName === 'button' || element.getAttribute('role') === 'button') {
      return 'click';
    }

    // Special case: if the instruction action is 'click' but we found a select element,
    // change it to 'select' (this handles AI mistakes)
    if (instruction.action === 'click' && tagName === 'select') {
      return 'select';
    }

    // Default to original action
    return instruction.action;
  }

  /**
   * Fill text input fields
   */
  async fillTextInput(selector: string, value: string): Promise<ElementInteractionResult> {
    const element = safeQuerySelector<HTMLInputElement | HTMLTextAreaElement>(selector);

    if (!element) {
      return {
        success: false,
        element: null,
        error: `Element not found: ${selector}`,
        interactionType: 'fill'
      };
    }

    // Safety checks
    if (this.options.safetyChecks) {
      if (!this.isInteractableElement(element)) {
        return {
          success: false,
          element,
          error: 'Element is not interactable (disabled, hidden, or readonly)',
          interactionType: 'fill'
        };
      }

      if (!this.isTextInputElement(element)) {
        return {
          success: false,
          element,
          error: 'Element is not a text input or textarea',
          interactionType: 'fill'
        };
      }
    }

    try {
      // Focus the element first
      element.focus();

      // Clear existing value
      element.value = '';

      // Trigger input event to clear any existing content
      element.dispatchEvent(new Event('input', { bubbles: true }));

      // Set the new value
      element.value = value;

      // Trigger events to simulate user interaction
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));

      return {
        success: true,
        element,
        actualValue: element.value,
        interactionType: 'fill'
      };
    } catch (error) {
      return {
        success: false,
        element,
        error: error instanceof Error ? error.message : 'Failed to fill input',
        interactionType: 'fill'
      };
    }
  }

  /**
   * Select option from dropdown/select elements
   */
  async selectOption(selector: string, value: string): Promise<ElementInteractionResult> {
    const element = safeQuerySelector<HTMLSelectElement>(selector);

    if (!element) {
      return {
        success: false,
        element: null,
        error: `Element not found: ${selector}`,
        interactionType: 'select'
      };
    }

    // Safety checks
    if (this.options.safetyChecks) {
      if (!this.isInteractableElement(element)) {
        return {
          success: false,
          element,
          error: 'Element is not interactable (disabled or hidden)',
          interactionType: 'select'
        };
      }

      if (element.tagName.toLowerCase() !== 'select') {
        return {
          success: false,
          element,
          error: 'Element is not a select element',
          interactionType: 'select'
        };
      }
    }

    try {
      // Focus the element
      element.focus();

      // Special handling for boolean selects - try to convert text values to numeric
      let searchValue = value;
      if (selector.includes('boolean_value') || selector.includes('_boolean_')) {
        const lowerValue = value.toLowerCase().trim();
        if (lowerValue === 'yes' || lowerValue === 'true') {
          searchValue = '1';
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Converting "${value}" to "1" for boolean select`);
          }
        } else if (lowerValue === 'no' || lowerValue === 'false') {
          searchValue = '0';
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Converting "${value}" to "0" for boolean select`);
          }
        }
      }

      // Find the option to select
      const option = this.findSelectOption(element, searchValue);

      if (!option) {
        // Create a detailed error message with available options
        const availableOptions = Array.from(element.options)
          .map(opt => `"${opt.value}" (${opt.textContent?.trim()})`)
          .join(', ');

        return {
          success: false,
          element,
          error: `Option not found: "${value}" (searched as "${searchValue}"). Available options: ${availableOptions}`,
          interactionType: 'select'
        };
      }

      // Select the option
      element.value = option.value;
      option.selected = true;

      // Trigger events
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));

      if (this.options.logExecution) {
        console.log(`[InstructionExecutor] Successfully selected option: value="${option.value}", text="${option.textContent?.trim()}"`);
      }

      return {
        success: true,
        element,
        actualValue: element.value,
        interactionType: 'select'
      };
    } catch (error) {
      return {
        success: false,
        element,
        error: error instanceof Error ? error.message : 'Failed to select option',
        interactionType: 'select'
      };
    }
  }

  /**
   * Click elements (buttons, checkboxes, radio buttons)
   */
  async clickElement(selector: string, value?: string): Promise<ElementInteractionResult> {
    // First, try to find the element directly
    const element = safeQuerySelector<HTMLElement>(selector);

    if (!element) {
      // Try alternative selectors if the original fails
      const alternatives = this.generateAlternativeSelectors(selector);
      for (const altSelector of alternatives) {
        const altElement = safeQuerySelector<HTMLElement>(altSelector);
        if (altElement) {
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Using alternative selector: ${altSelector} instead of ${selector}`);
          }
          return await this.clickElementDirect(altElement, value);
        }
      }

      return {
        success: false,
        element: null,
        error: `Element not found: ${selector}`,
        interactionType: 'click'
      };
    }

    return await this.clickElementDirect(element, value);
  }

  /**
   * Click an element directly with proper handling
   */
  private async clickElementDirect(element: HTMLElement, value?: string): Promise<ElementInteractionResult> {
    // Safety checks
    if (this.options.safetyChecks) {
      if (!this.isInteractableElement(element)) {
        return {
          success: false,
          element,
          error: 'Element is not interactable (disabled or hidden)',
          interactionType: 'click'
        };
      }

      if (!this.isClickableElement(element)) {
        return {
          success: false,
          element,
          error: 'Element is not clickable',
          interactionType: 'click'
        };
      }
    }

    try {
      // Focus the element if it's focusable
      if (element.tabIndex >= 0 || this.isFocusableElement(element)) {
        element.focus();
      }

      // Handle different element types
      if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox') {
          // For checkboxes, determine if we should check or uncheck
          let shouldCheck = true;
          if (value !== undefined) {
            shouldCheck = value === 'true' || value === '1' || value === 'on' || value === '';
          } else {
            // If no value specified, toggle the current state
            shouldCheck = !element.checked;
          }

          element.checked = shouldCheck;
          element.dispatchEvent(new Event('change', { bubbles: true }));

          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] ${shouldCheck ? 'Checked' : 'Unchecked'} checkbox: ${element.id || element.name || 'unnamed'}`);
          }
        } else if (element.type === 'radio') {
          element.checked = true;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Handle custom checkboxes with role="checkbox"
      if (element.getAttribute('role') === 'checkbox') {
        const shouldCheck = value === undefined || value === 'true' || value === '1' || value === 'on';
        const currentlyChecked = element.getAttribute('aria-checked') === 'true';

        if (shouldCheck !== currentlyChecked) {
          element.setAttribute('aria-checked', shouldCheck.toString());

          // Find and update the hidden input if it exists
          const hiddenInput = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (hiddenInput) {
            hiddenInput.checked = shouldCheck;
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }

      // Perform the click
      element.click();

      // Get the actual value after click
      let actualValue: string | undefined;
      if (element instanceof HTMLInputElement) {
        if (element.type === 'checkbox' || element.type === 'radio') {
          actualValue = element.checked.toString();
        } else {
          actualValue = element.value;
        }
      } else if (element.getAttribute('role') === 'checkbox') {
        actualValue = element.getAttribute('aria-checked') || 'false';
      }

      return {
        success: true,
        element,
        actualValue,
        interactionType: 'click'
      };
    } catch (error) {
      return {
        success: false,
        element,
        error: error instanceof Error ? error.message : 'Failed to click element',
        interactionType: 'click'
      };
    }
  }




  /**
   * Select custom checkbox by value (for role="checkbox" elements)
   */
  private async selectCustomCheckboxByValue(baseSelector: string, value: string): Promise<ElementInteractionResult> {
    // Try to find the checkbox group container first
    const groupElement = safeQuerySelector<HTMLElement>(baseSelector);

    if (groupElement) {
      // Look for checkbox with matching data-value within the group
      const checkboxes = groupElement.querySelectorAll('[role="checkbox"][data-value]');

      for (let i = 0; i < checkboxes.length; i++) {
        const checkbox = checkboxes[i] as HTMLElement;
        const checkboxValue = checkbox.getAttribute('data-value');

        if (checkboxValue === value || checkboxValue?.trim() === value.trim()) {
          try {
            // Focus the checkbox
            if (checkbox.tabIndex >= 0) {
              checkbox.focus();
            }

            // Set aria-checked to true
            checkbox.setAttribute('aria-checked', 'true');

            // Find and update the hidden input
            const hiddenInput = checkbox.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (hiddenInput) {
              hiddenInput.checked = true;
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Click the checkbox
            checkbox.click();

            return {
              success: true,
              element: checkbox,
              actualValue: checkboxValue || value,
              interactionType: 'custom-checkbox-select'
            };
          } catch (error) {
            continue; // Try next checkbox
          }
        }
      }
    }

    // Fallback: try to find by data-testid or other attributes
    const selectors = [
      `[data-testid*="checkbox"][data-value="${value}"]`,
      `[role="checkbox"][data-value="${value}"]`,
      `[data-value="${value}"][role="checkbox"]`
    ];

    for (const selector of selectors) {
      const element = safeQuerySelector<HTMLElement>(selector);

      if (element) {
        try {
          // Focus the element
          if (element.tabIndex >= 0) {
            element.focus();
          }

          // Set aria-checked to true
          element.setAttribute('aria-checked', 'true');

          // Find and update the hidden input
          const hiddenInput = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (hiddenInput) {
            hiddenInput.checked = true;
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Click the element
          element.click();

          return {
            success: true,
            element,
            actualValue: value,
            interactionType: 'custom-checkbox-select'
          };
        } catch (error) {
          continue; // Try next selector
        }
      }
    }

    // Final fallback: search by text content
    const roleCheckboxes = document.querySelectorAll('[role="checkbox"]');
    for (let i = 0; i < roleCheckboxes.length; i++) {
      const checkbox = roleCheckboxes[i] as HTMLElement;
      const textContent = checkbox.textContent?.trim().toLowerCase();
      const dataValue = checkbox.getAttribute('data-value')?.toLowerCase();

      if (textContent?.includes(value.toLowerCase()) || dataValue?.includes(value.toLowerCase())) {
        try {
          // Focus the checkbox
          if (checkbox.tabIndex >= 0) {
            checkbox.focus();
          }

          // Set aria-checked to true
          checkbox.setAttribute('aria-checked', 'true');

          // Find and update the hidden input
          const hiddenInput = checkbox.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (hiddenInput) {
            hiddenInput.checked = true;
            hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Click the checkbox
          checkbox.click();

          return {
            success: true,
            element: checkbox,
            actualValue: checkbox.getAttribute('data-value') || value,
            interactionType: 'custom-checkbox-select'
          };
        } catch (error) {
          continue;
        }
      }
    }

    // Special handling for boolean values like "true" - try to find any checkbox to check
    if (value === 'true' || value === 'false') {
      const shouldCheck = value === 'true';

      // Try to find any checkbox in the area and check/uncheck it
      const nearbyCheckboxes = document.querySelectorAll(`${baseSelector} input[type="checkbox"], ${baseSelector} [role="checkbox"]`);

      if (nearbyCheckboxes.length > 0) {
        const checkbox = nearbyCheckboxes[0] as HTMLElement;

        try {
          if (checkbox instanceof HTMLInputElement && checkbox.type === 'checkbox') {
            checkbox.focus();
            checkbox.checked = shouldCheck;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            checkbox.click();

            if (this.options.logExecution) {
              console.log(`[InstructionExecutor] Found and ${shouldCheck ? 'checked' : 'unchecked'} nearby checkbox for boolean value "${value}"`);
            }

            return {
              success: true,
              element: checkbox,
              actualValue: checkbox.checked.toString(),
              interactionType: 'boolean-fallback-checkbox'
            };
          } else if (checkbox.getAttribute('role') === 'checkbox') {
            checkbox.focus();
            checkbox.setAttribute('aria-checked', shouldCheck.toString());

            const hiddenInput = checkbox.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (hiddenInput) {
              hiddenInput.checked = shouldCheck;
              hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            checkbox.click();

            if (this.options.logExecution) {
              console.log(`[InstructionExecutor] Found and ${shouldCheck ? 'checked' : 'unchecked'} nearby custom checkbox for boolean value "${value}"`);
            }

            return {
              success: true,
              element: checkbox,
              actualValue: shouldCheck.toString(),
              interactionType: 'boolean-fallback-custom-checkbox'
            };
          }
        } catch (error) {
          // Continue to error below
        }
      }
    }

    // Create detailed error message with available checkboxes
    const availableCheckboxes: string[] = [];
    const allCheckboxes = document.querySelectorAll('[role="checkbox"], input[type="checkbox"]');

    for (let i = 0; i < Math.min(allCheckboxes.length, 5); i++) { // Limit to first 5 for readability
      const cb = allCheckboxes[i] as HTMLElement;
      const dataValue = cb.getAttribute('data-value');
      const textContent = cb.textContent?.trim();
      const id = cb.id;

      if (dataValue || textContent || id) {
        availableCheckboxes.push(`${id ? `#${id}` : 'checkbox'}: ${dataValue || textContent || 'no value'}`);
      }
    }

    const errorDetails = availableCheckboxes.length > 0
      ? `. Available checkboxes: ${availableCheckboxes.join(', ')}`
      : '. No checkboxes found on page.';

    return {
      success: false,
      element: null,
      error: `Custom checkbox with value "${value}" not found for selector: ${baseSelector}${errorDetails}`,
      interactionType: 'custom-checkbox-select'
    };
  }

  /**
   * Select radio button with specific value
   */
  async selectRadioButton(baseSelector: string, value: string): Promise<ElementInteractionResult> {
    // Try different approaches to find the correct radio button
    const selectors = [
      `${baseSelector}[value="${value}"]`,
      `input[name="${this.extractNameFromSelector(baseSelector)}"][value="${value}"]`,
      `input[type="radio"][value="${value}"]`
    ];

    for (const selector of selectors) {
      const element = safeQuerySelector<HTMLInputElement>(selector);

      if (element && element.type === 'radio') {
        try {
          // Focus and select the radio button
          element.focus();
          element.checked = true;

          // Trigger events
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.dispatchEvent(new Event('click', { bubbles: true }));

          return {
            success: true,
            element,
            actualValue: element.value,
            interactionType: 'radio-select'
          };
        } catch (error) {
          continue; // Try next selector
        }
      }
    }

    // If no specific radio button found, try to find by label text
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    for (let i = 0; i < radioButtons.length; i++) {
      const radio = radioButtons[i] as HTMLInputElement;
      const label = this.findLabelForInput(radio);

      if (label && label.textContent?.toLowerCase().includes(value.toLowerCase())) {
        try {
          radio.focus();
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
          radio.dispatchEvent(new Event('click', { bubbles: true }));

          return {
            success: true,
            element: radio,
            actualValue: radio.value,
            interactionType: 'radio-select'
          };
        } catch (error) {
          continue;
        }
      }
    }

    return {
      success: false,
      element: null,
      error: `Radio button with value "${value}" not found for selector: ${baseSelector}`,
      interactionType: 'radio-select'
    };
  }

  /**
   * Extract name attribute from selector
   */
  private extractNameFromSelector(selector: string): string | null {
    const nameMatch = selector.match(/name=["']([^"']+)["']/);
    return nameMatch ? nameMatch[1] : null;
  }

  /**
   * Find label element for input
   */
  private findLabelForInput(input: HTMLInputElement): HTMLLabelElement | null {
    // Try to find label by 'for' attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`) as HTMLLabelElement;
      if (label) return label;
    }

    // Try to find parent label
    let parent = input.parentElement;
    while (parent) {
      if (parent.tagName.toLowerCase() === 'label') {
        return parent as HTMLLabelElement;
      }
      parent = parent.parentElement;
    }

    // Try to find adjacent label
    const nextSibling = input.nextElementSibling;
    if (nextSibling && nextSibling.tagName.toLowerCase() === 'label') {
      return nextSibling as HTMLLabelElement;
    }

    const prevSibling = input.previousElementSibling;
    if (prevSibling && prevSibling.tagName.toLowerCase() === 'label') {
      return prevSibling as HTMLLabelElement;
    }

    return null;
  }

  /**
   * Handle file upload fields with resume/cover letter support
   */
  async handleFileUpload(selector: string, filePath: string): Promise<ElementInteractionResult> {
    const element = safeQuerySelector<HTMLInputElement>(selector);

    if (!element) {
      return {
        success: false,
        element: null,
        error: `Element not found: ${selector}`,
        interactionType: 'upload'
      };
    }

    if (element.type !== 'file') {
      return {
        success: false,
        element,
        error: 'Element is not a file input',
        interactionType: 'upload'
      };
    }

    try {
      // Focus the file input
      element.focus();

      // Check if the file path indicates a document type
      const fileType = this.detectFileType(filePath);

      // For now, we'll simulate file selection by setting a custom attribute
      // In a real implementation, this would involve actual file handling
      element.setAttribute('data-ai-file-selected', filePath);
      element.setAttribute('data-ai-file-type', fileType);

      // Trigger change event to simulate file selection
      const changeEvent = new Event('change', { bubbles: true });
      element.dispatchEvent(changeEvent);

      // Check if there are any validation requirements
      const validationResult = this.validateFileUpload(element, filePath);
      if (!validationResult.isValid) {
        return {
          success: false,
          element,
          error: validationResult.error,
          interactionType: 'upload'
        };
      }

      return {
        success: true,
        element,
        actualValue: filePath,
        interactionType: 'upload'
      };
    } catch (error) {
      return {
        success: false,
        element,
        error: error instanceof Error ? error.message : 'Failed to handle file upload',
        interactionType: 'upload'
      };
    }
  }

  /**
   * Smart checkbox selection that handles various checkbox patterns
   */
  private async selectSmartCheckbox(selector: string, value?: string): Promise<ElementInteractionResult> {
    // First try the exact selector
    let element = safeQuerySelector<HTMLInputElement>(selector);

    if (element && element.type === 'checkbox' && this.isInteractableElement(element)) {
      return await this.clickCheckboxElement(element, value);
    }

    // If exact selector fails, try to find checkbox by intelligent matching
    if (selector.includes('question_option_id')) {
      // For question option checkboxes, try to find the best match
      const result = await this.findCheckboxByContext(selector, value);
      if (result.success) {
        return result;
      }
    }

    // Try alternative selectors
    const alternatives = this.generateAlternativeSelectors(selector);
    for (const altSelector of alternatives) {
      element = safeQuerySelector<HTMLInputElement>(altSelector);
      if (element && element.type === 'checkbox' && this.isInteractableElement(element)) {
        if (this.options.logExecution) {
          console.log(`[InstructionExecutor] Using alternative checkbox selector: ${altSelector}`);
        }
        return await this.clickCheckboxElement(element, value);
      }
    }

    return {
      success: false,
      element: null,
      error: `Checkbox not found or not interactable: ${selector}`,
      interactionType: 'smart-checkbox'
    };
  }

  /**
   * Click a checkbox element with proper handling
   */
  private async clickCheckboxElement(element: HTMLInputElement, value?: string): Promise<ElementInteractionResult> {
    try {
      // Focus the checkbox
      element.focus();

      // Determine if we should check or uncheck
      let shouldCheck = true;
      if (value !== undefined) {
        shouldCheck = value === 'true' || value === '1' || value === 'on' || value === '';
      }

      // Set the checkbox state
      element.checked = shouldCheck;

      // Trigger events
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.click(); // Also trigger click for any additional handlers

      if (this.options.logExecution) {
        console.log(`[InstructionExecutor] ${shouldCheck ? 'Checked' : 'Unchecked'} checkbox: ${element.id || element.name || 'unnamed'}`);
      }

      return {
        success: true,
        element,
        actualValue: element.checked.toString(),
        interactionType: 'checkbox-click'
      };
    } catch (error) {
      return {
        success: false,
        element,
        error: error instanceof Error ? error.message : 'Failed to click checkbox',
        interactionType: 'checkbox-click'
      };
    }
  }

  /**
   * Find checkbox by analyzing context and labels
   */
  private async findCheckboxByContext(selector: string, value?: string): Promise<ElementInteractionResult> {
    // Extract the question set ID from the selector
    const setMatch = selector.match(/answers_attributes\]\[(\d+)\]/);
    if (!setMatch) {
      return { success: false, element: null, error: 'Could not extract question set', interactionType: 'context-checkbox' };
    }

    const questionIndex = setMatch[1];

    // Look for checkboxes in this question set
    const checkboxes = document.querySelectorAll(`input[type="checkbox"][name*="answers_attributes][${questionIndex}]"]`);

    if (checkboxes.length === 0) {
      // Try broader search
      const questionCheckboxes = document.querySelectorAll(`input[type="checkbox"][name*="question_option_id"]`);

      // Find checkboxes that are likely related to this question
      for (let i = 0; i < questionCheckboxes.length; i++) {
        const checkbox = questionCheckboxes[i] as HTMLInputElement;
        const label = this.findLabelForCheckbox(checkbox);

        if (label && this.isRelevantCheckbox(label, value)) {
          return await this.clickCheckboxElement(checkbox, value);
        }
      }
    } else {
      // If we have specific checkboxes for this question, pick the most relevant one
      for (let i = 0; i < checkboxes.length; i++) {
        const checkbox = checkboxes[i] as HTMLInputElement;
        const label = this.findLabelForCheckbox(checkbox);

        if (label && this.isRelevantCheckbox(label, value)) {
          return await this.clickCheckboxElement(checkbox, value);
        }
      }

      // If no specific match, select the first available checkbox (common for "how did you hear about us" questions)
      const firstCheckbox = checkboxes[0] as HTMLInputElement;
      if (this.isInteractableElement(firstCheckbox)) {
        return await this.clickCheckboxElement(firstCheckbox, value);
      }
    }

    return {
      success: false,
      element: null,
      error: `No suitable checkbox found for context: ${selector}`,
      interactionType: 'context-checkbox'
    };
  }

  /**
   * Find label text for a checkbox
   */
  private findLabelForCheckbox(checkbox: HTMLInputElement): string | null {
    // Try to find associated label
    const id = checkbox.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return label.textContent?.trim() || null;
      }
    }

    // Try to find parent label
    const parentLabel = checkbox.closest('label');
    if (parentLabel) {
      return parentLabel.textContent?.trim() || null;
    }

    // Try to find next sibling text
    const nextSibling = checkbox.nextSibling;
    if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE) {
      return nextSibling.textContent?.trim() || null;
    }

    return null;
  }

  /**
   * Check if checkbox is relevant based on label and value
   */
  private isRelevantCheckbox(labelText: string, value?: string): boolean {
    if (!labelText) return false;

    const labelLower = labelText.toLowerCase();

    // Common patterns for "how did you hear about us" questions
    const commonSources = ['linkedin', 'indeed', 'glassdoor', 'referral', 'company website', 'job board'];

    // If no specific value provided, prefer LinkedIn (most common for professionals)
    if (!value || value === 'true') {
      return labelLower.includes('linkedin');
    }

    // Try to match the value with label text
    const valueLower = value.toLowerCase();
    return labelLower.includes(valueLower) || commonSources.some(source =>
      labelLower.includes(source) && valueLower.includes(source)
    );
  }



  /**
   * Find and select radio button by pattern matching
   */
  private async findAndSelectRadioByPattern(selector: string, value: string): Promise<ElementInteractionResult> {
    // Extract base pattern from selector
    const basePattern = selector.replace(/_attributes_\d+.*$/, '');

    // Try to find radio buttons with similar patterns
    const possibleSelectors = [
      `input[name*="${basePattern}"][value="${value}"]`,
      `input[name*="${basePattern}"][value*="${value}"]`,
      `input[type="radio"][value="${value}"]`,
      `input[type="radio"][value*="${value}"]`,
      `[name*="boolean_value"][value="${value}"]`,
      `[name*="boolean"][value="${value}"]`
    ];

    for (const testSelector of possibleSelectors) {
      const elements = document.querySelectorAll(testSelector);

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLInputElement;

        if (element && element.type === 'radio' && this.isInteractableElement(element)) {
          try {
            element.focus();
            element.checked = true;
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('click', { bubbles: true }));

            return {
              success: true,
              element,
              actualValue: element.value,
              interactionType: 'radio-pattern-match'
            };
          } catch (error) {
            continue;
          }
        }
      }
    }

    // Try to find by label text
    const labels = document.querySelectorAll('label');
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const labelText = label.textContent?.toLowerCase().trim();

      if (labelText?.includes(value.toLowerCase())) {
        const radioInput = label.querySelector('input[type="radio"]') as HTMLInputElement;
        if (radioInput && this.isInteractableElement(radioInput)) {
          try {
            radioInput.focus();
            radioInput.checked = true;
            radioInput.dispatchEvent(new Event('change', { bubbles: true }));
            radioInput.dispatchEvent(new Event('click', { bubbles: true }));

            return {
              success: true,
              element: radioInput,
              actualValue: radioInput.value,
              interactionType: 'radio-label-match'
            };
          } catch (error) {
            continue;
          }
        }
      }
    }

    return {
      success: false,
      element: null,
      error: `Radio button with value "${value}" not found for pattern: ${selector}`,
      interactionType: 'radio-pattern-match'
    };
  }



  /**
   * Validate instruction before execution
   */
  private validateInstruction(instruction: FormInstruction): string | undefined {
    if (!instruction.selector || typeof instruction.selector !== 'string') {
      return 'Invalid selector: must be a non-empty string';
    }

    if (!instruction.action) {
      return 'Invalid action: action is required';
    }

    if (!['fill', 'select', 'click', 'upload'].includes(instruction.action)) {
      return `Invalid action: ${instruction.action}`;
    }

    if ((instruction.action === 'fill' || instruction.action === 'select') && instruction.value === undefined) {
      return `Value is required for action: ${instruction.action}`;
    }

    return undefined;
  }

  /**
   * Check if element is interactable
   */
  private isInteractableElement(element: HTMLElement): boolean {
    // Check if element is disabled
    if ('disabled' in element && (element as any).disabled) {
      return false;
    }

    // Check if element is readonly (for input elements)
    if (element instanceof HTMLInputElement && element.readOnly) {
      return false;
    }

    // Check if element is hidden
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    // Check if element has zero dimensions (effectively hidden)
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return false;
    }

    // Check if element is covered by other elements (basic check)
    if (rect.width > 0 && rect.height > 0) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementAtPoint = document.elementFromPoint(centerX, centerY);

      // If the element at the center point is not this element or a child, it might be covered
      if (elementAtPoint && !element.contains(elementAtPoint) && elementAtPoint !== element) {
        // Additional check: if it's an input inside a label, it might still be clickable
        const parentLabel = element.closest('label');
        if (parentLabel && parentLabel.contains(elementAtPoint)) {
          return true;
        }
        // For now, we'll still consider it interactable to avoid false negatives
      }
    }

    return true;
  }

  /**
   * Check if element is a text input element
   */
  private isTextInputElement(element: HTMLElement): boolean {
    if (element instanceof HTMLTextAreaElement) {
      return true;
    }

    if (element instanceof HTMLInputElement) {
      const textInputTypes = ['text', 'email', 'password', 'search', 'tel', 'url', 'number'];
      return textInputTypes.includes(element.type);
    }

    return false;
  }

  /**
   * Check if element is clickable
   */
  private isClickableElement(element: HTMLElement): boolean {
    const clickableTags = ['button', 'a', 'input', 'label'];
    const tagName = element.tagName.toLowerCase();

    if (clickableTags.includes(tagName)) {
      return true;
    }

    // Check if element has click handlers or is focusable
    return element.tabIndex >= 0 || element.onclick !== null;
  }

  /**
   * Check if element is focusable
   */
  private isFocusableElement(element: HTMLElement): boolean {
    const focusableTags = ['input', 'textarea', 'select', 'button', 'a'];
    return focusableTags.includes(element.tagName.toLowerCase());
  }

  /**
   * Find option in select element by value or text
   */
  private findSelectOption(selectElement: HTMLSelectElement, value: string): HTMLOptionElement | null {
    if (this.options.logExecution) {
      console.log(`[InstructionExecutor] Looking for option with value: "${value}" in select with ${selectElement.options.length} options`);
      for (let i = 0; i < selectElement.options.length; i++) {
        const option = selectElement.options[i];
        console.log(`  Option ${i}: value="${option.value}", text="${option.textContent?.trim()}"`);
      }
    }

    // First try to find by exact value
    for (let i = 0; i < selectElement.options.length; i++) {
      const option = selectElement.options[i];
      if (option.value === value) {
        if (this.options.logExecution) {
          console.log(`[InstructionExecutor] Found exact value match: "${option.value}"`);
        }
        return option;
      }
    }

    // Try common value mappings for boolean selects
    if (value.toLowerCase() === 'yes' || value === '1' || value === 'true') {
      for (let i = 0; i < selectElement.options.length; i++) {
        const option = selectElement.options[i];
        if (option.value === '1' || option.textContent?.toLowerCase().trim() === 'yes') {
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Found boolean "Yes" match: value="${option.value}", text="${option.textContent?.trim()}"`);
          }
          return option;
        }
      }
    }

    if (value.toLowerCase() === 'no' || value === '0' || value === 'false') {
      for (let i = 0; i < selectElement.options.length; i++) {
        const option = selectElement.options[i];
        if (option.value === '0' || option.textContent?.toLowerCase().trim() === 'no') {
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Found boolean "No" match: value="${option.value}", text="${option.textContent?.trim()}"`);
          }
          return option;
        }
      }
    }

    // Then try to find by text content (case-insensitive, exact match first)
    const lowerValue = value.toLowerCase().trim();
    for (let i = 0; i < selectElement.options.length; i++) {
      const option = selectElement.options[i];
      const optionText = option.textContent?.toLowerCase().trim();
      if (optionText === lowerValue) {
        if (this.options.logExecution) {
          console.log(`[InstructionExecutor] Found exact text match: "${optionText}"`);
        }
        return option;
      }
    }

    // Try partial matches (for truncated values like "Acknowledg...")
    // First check if the search value is truncated (ends with "...")
    const isTruncated = value.endsWith('...');
    const searchValue = isTruncated ? value.slice(0, -3).toLowerCase().trim() : lowerValue;

    for (let i = 0; i < selectElement.options.length; i++) {
      const option = selectElement.options[i];
      const optionText = option.textContent?.toLowerCase().trim();

      if (optionText) {
        // If the search value is truncated, look for options that start with it
        if (isTruncated && optionText.startsWith(searchValue)) {
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Found truncated match: "${searchValue}" matches start of "${optionText}"`);
          }
          return option;
        }

        // For "Acknowledg..." specifically, match "Acknowledge"
        if (searchValue === 'acknowledg' && optionText === 'acknowledge') {
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Found acknowledge match: "${searchValue}" -> "${optionText}"`);
          }
          return option;
        }

        // Otherwise, try bidirectional partial matching
        if (optionText.includes(searchValue) || searchValue.includes(optionText)) {
          if (this.options.logExecution) {
            console.log(`[InstructionExecutor] Found partial match: "${searchValue}" <-> "${optionText}"`);
          }
          return option;
        }
      }
    }

    // Special handling for common patterns
    const commonPatterns = [
      { search: ['acknowledge', 'accept'], match: ['acknowledge', 'accept', 'agree', 'consent'] },
      { search: ['decline', 'reject'], match: ['decline', 'reject', 'disagree', 'refuse'] },
      { search: ['prefer not'], match: ['prefer not', 'rather not', 'decline to'] },
      { search: ['other'], match: ['other', 'different', 'alternative'] }
    ];

    for (const pattern of commonPatterns) {
      if (pattern.search.some(s => lowerValue.includes(s))) {
        for (let i = 0; i < selectElement.options.length; i++) {
          const option = selectElement.options[i];
          const optionText = option.textContent?.toLowerCase().trim();
          if (optionText && pattern.match.some(m => optionText.includes(m))) {
            if (this.options.logExecution) {
              console.log(`[InstructionExecutor] Found pattern match: "${lowerValue}" -> "${optionText}"`);
            }
            return option;
          }
        }
      }
    }

    if (this.options.logExecution) {
      console.log(`[InstructionExecutor] No option found for value: "${value}"`);
    }
    return null;
  }

  /**
   * Create execution result object
   */
  private createExecutionResult(
    instruction: FormInstruction,
    success: boolean,
    error: string | undefined,
    actualValue: string | undefined,
    executionTime: number,
    retryCount: number
  ): ExecutionResult {
    return {
      instruction,
      success,
      error,
      actualValue,
      executionTime,
      retryCount
    };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get execution log
   */
  getExecutionLog(): ExecutionResult[] {
    return [...this.executionLog];
  }

  /**
   * Clear execution log
   */
  clearExecutionLog(): void {
    this.executionLog = [];
  }

  /**
   * Dispose of resources and cleanup
   */
  dispose(): void {
    // Disconnect the mutation observer
    if (this.dynamicContentObserver) {
      this.dynamicContentObserver.disconnect();
      this.dynamicContentObserver = null;
    }

    // Clear execution log
    this.clearExecutionLog();

    // Reset state
    this.formChangeDetected = false;
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    averageExecutionTime: number;
  } {
    const total = this.executionLog.length;
    const successful = this.executionLog.filter(r => r.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    const averageExecutionTime = total > 0
      ? this.executionLog.reduce((sum, r) => sum + r.executionTime, 0) / total
      : 0;

    return {
      total,
      successful,
      failed,
      successRate,
      averageExecutionTime
    };
  }

  // Advanced form interaction capabilities

  /**
   * Handle multi-step form navigation
   */
  async navigateToNextStep(): Promise<ElementInteractionResult> {
    // Look for common next/continue button patterns
    const nextButtonSelectors = [
      'button[type="submit"]',
      'button:contains("Next")',
      'button:contains("Continue")',
      'input[type="submit"]',
      '.next-button',
      '.continue-button',
      '[data-testid*="next"]',
      '[data-testid*="continue"]'
    ];

    for (const selector of nextButtonSelectors) {
      const button = safeQuerySelector<HTMLElement>(selector);
      if (button && this.isInteractableElement(button)) {
        try {
          button.click();

          // Wait for potential navigation/loading
          await this.delay(1000);

          return {
            success: true,
            element: button,
            interactionType: 'navigate-next'
          };
        } catch (error) {
          continue; // Try next selector
        }
      }
    }

    return {
      success: false,
      element: null,
      error: 'No next/continue button found',
      interactionType: 'navigate-next'
    };
  }

  /**
   * Handle conditional field interactions based on form state
   */
  async handleConditionalField(selector: string, value: string, condition: string): Promise<ElementInteractionResult> {
    const element = safeQuerySelector<HTMLElement>(selector);

    if (!element) {
      return {
        success: false,
        element: null,
        error: `Conditional element not found: ${selector}`,
        interactionType: 'conditional'
      };
    }

    // Check if the condition is met
    const conditionMet = this.evaluateCondition(condition);

    if (!conditionMet) {
      return {
        success: true,
        element,
        actualValue: 'skipped-condition-not-met',
        interactionType: 'conditional'
      };
    }

    // Wait for element to become visible/interactable if needed
    await this.waitForElementReady(element);

    // Execute the appropriate action based on element type
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return await this.fillTextInput(selector, value);
    } else if (element instanceof HTMLSelectElement) {
      return await this.selectOption(selector, value);
    } else {
      return await this.clickElement(selector);
    }
  }

  /**
   * Handle form validation errors and retry logic
   */
  async handleValidationErrors(instruction: FormInstruction): Promise<ElementInteractionResult> {
    // First, try the normal execution
    let result = await this.executeInstructionInternal(instruction);

    if (result.success) {
      return result;
    }

    // Check for validation errors
    const validationErrors = this.detectValidationErrors();

    if (validationErrors.length === 0) {
      return result; // No validation errors, return original result
    }

    // Try to fix validation errors
    for (const error of validationErrors) {
      const fixResult = await this.attemptValidationFix(error, instruction);
      if (fixResult.success) {
        // Retry the original instruction
        result = await this.executeInstructionInternal(instruction);
        if (result.success) {
          return result;
        }
      }
    }

    return {
      success: false,
      element: result.element,
      error: `Validation errors could not be resolved: ${validationErrors.map(e => e.message).join(', ')}`,
      interactionType: 'validation-retry'
    };
  }

  /**
   * Wait for element to become ready for interaction
   */
  private async waitForElementReady(element: HTMLElement, maxWait: number = 5000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (this.isInteractableElement(element)) {
        return true;
      }
      await this.delay(100);
    }

    return false;
  }

  /**
   * Detect file type from file path
   */
  private detectFileType(filePath: string): string {
    const extension = filePath.toLowerCase().split('.').pop();

    switch (extension) {
      case 'pdf':
        return 'resume';
      case 'doc':
      case 'docx':
        return 'cover-letter';
      case 'txt':
        return 'text-document';
      default:
        return 'document';
    }
  }

  /**
   * Validate file upload requirements
   */
  private validateFileUpload(element: HTMLInputElement, filePath: string): { isValid: boolean; error?: string } {
    // Check file type restrictions
    const accept = element.getAttribute('accept');
    if (accept) {
      const extension = filePath.toLowerCase().split('.').pop();
      const acceptedTypes = accept.toLowerCase().split(',').map(t => t.trim());

      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return type === `.${extension}`;
        }
        if (type.includes('/')) {
          // MIME type check (simplified)
          return type.includes('pdf') && extension === 'pdf' ||
            type.includes('word') && ['doc', 'docx'].includes(extension || '') ||
            type.includes('text') && extension === 'txt';
        }
        return false;
      });

      if (!isAccepted) {
        return {
          isValid: false,
          error: `File type not accepted. Accepted types: ${accept}`
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Detect validation errors on the page
   */
  private detectValidationErrors(): Array<{ element: HTMLElement; message: string }> {
    const errors: Array<{ element: HTMLElement; message: string }> = [];

    // Look for common validation error patterns
    const errorSelectors = [
      '.error',
      '.validation-error',
      '.field-error',
      '[role="alert"]',
      '.invalid-feedback',
      '.help-block.error'
    ];

    for (const selector of errorSelectors) {
      const errorElements = document.querySelectorAll(selector);

      for (let i = 0; i < errorElements.length; i++) {
        const errorElement = errorElements[i] as HTMLElement;
        const message = errorElement.textContent?.trim();

        if (message && errorElement.offsetParent !== null) { // Visible error
          errors.push({ element: errorElement, message });
        }
      }
    }

    return errors;
  }

  /**
   * Attempt to fix a validation error
   */
  private async attemptValidationFix(error: { element: HTMLElement; message: string }, instruction: FormInstruction): Promise<ElementInteractionResult> {
    // This is a simplified implementation - in practice, you'd want more sophisticated error handling
    const message = error.message.toLowerCase();

    if (message.includes('required') || message.includes('mandatory')) {
      // Try to fill the field if it's empty
      const relatedInput = this.findRelatedInput(error.element);
      if (relatedInput && !relatedInput.value) {
        return await this.fillTextInput(`#${relatedInput.id}`, instruction.value || 'N/A');
      }
    }

    return {
      success: false,
      element: error.element,
      error: `Could not fix validation error: ${error.message}`,
      interactionType: 'validation-fix'
    };
  }

  /**
   * Find input element related to an error message
   */
  private findRelatedInput(errorElement: HTMLElement): HTMLInputElement | null {
    // Look for nearby input elements
    const parent = errorElement.parentElement;
    if (parent) {
      const input = parent.querySelector('input, textarea, select') as HTMLInputElement;
      if (input) {
        return input;
      }
    }

    // Look for input with matching ID pattern
    const errorId = errorElement.id;
    if (errorId) {
      const inputId = errorId.replace(/[-_]error$/, '');
      const input = document.getElementById(inputId) as HTMLInputElement;
      if (input) {
        return input;
      }
    }

    return null;
  }

  /**
   * Evaluate a condition string (simplified implementation)
   */
  private evaluateCondition(condition: string): boolean {
    try {
      // Simple condition evaluation - in a real implementation, this would be more sophisticated
      if (condition.includes('visible')) {
        const selector = condition.match(/visible\(([^)]+)\)/)?.[1];
        if (selector) {
          const element = safeQuerySelector(selector);
          return element !== null && this.isInteractableElement(element);
        }
      }

      if (condition.includes('checked')) {
        const selector = condition.match(/checked\(([^)]+)\)/)?.[1];
        if (selector) {
          const element = safeQuerySelector<HTMLInputElement>(selector);
          return element?.checked === true;
        }
      }

      if (condition.includes('value')) {
        const match = condition.match(/value\(([^)]+)\)\s*==\s*"([^"]+)"/);
        if (match) {
          const [, selector, expectedValue] = match;
          const element = safeQuerySelector<HTMLInputElement>(selector);
          return element?.value === expectedValue;
        }
      }

      // Default to true for unknown conditions
      return true;
    } catch (error) {
      console.warn('[InstructionExecutor] Error evaluating condition:', condition, error);
      return true; // Default to proceeding with the action
    }
  }

}