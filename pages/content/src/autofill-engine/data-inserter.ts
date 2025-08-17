/**
 * Data insertion utilities for autofill engine
 * Handles populating different types of form fields
 */

import type { FormField, FilledField, AutofillError } from '@extension/shared/lib/types';

export interface InsertionResult {
  success: boolean;
  filledField?: FilledField;
  error?: InsertionError;
}

export interface InsertionError {
  code: string;
  message: string;
  recoverable: boolean;
}

export class DataInserter {
  private static readonly INSERTION_DELAY = 50; // ms between field insertions
  private static readonly RETRY_ATTEMPTS = 3;
  private static readonly RETRY_DELAY = 100; // ms

  /**
   * Insert data into a form field
   */
  async insertData(
    field: FormField, 
    value: any, 
    source: 'profile' | 'ai' | 'default_answer' = 'profile'
  ): Promise<InsertionResult> {
    try {
      const element = this.findElement(field.selector);
      if (!element) {
        return {
          success: false,
          error: {
            code: 'ELEMENT_NOT_FOUND',
            message: `Element not found for selector: ${field.selector}`,
            recoverable: true
          }
        };
      }

      // Wait for element to be ready
      await this.waitForElementReady(element);

      let insertionSuccess = false;
      let finalValue: string | boolean | File = value;

      switch (field.type) {
        case 'text':
        case 'email':
        case 'phone':
        case 'url':
        case 'number':
          insertionSuccess = await this.insertTextValue(element as HTMLInputElement, String(value));
          finalValue = String(value);
          break;

        case 'textarea':
          insertionSuccess = await this.insertTextareaValue(element as HTMLTextAreaElement, String(value));
          finalValue = String(value);
          break;

        case 'select':
          insertionSuccess = await this.selectDropdownOption(element as HTMLSelectElement, String(value));
          finalValue = String(value);
          break;

        case 'checkbox':
          insertionSuccess = await this.setCheckboxValue(element as HTMLInputElement, Boolean(value));
          finalValue = Boolean(value);
          break;

        case 'radio':
          insertionSuccess = await this.selectRadioOption(field.selector, String(value));
          finalValue = String(value);
          break;

        case 'date':
          insertionSuccess = await this.insertDateValue(element as HTMLInputElement, String(value));
          finalValue = String(value);
          break;

        case 'file':
          // File insertion should be handled by AutofillEngine using FileUploadHandler
          return {
            success: false,
            error: {
              code: 'UNSUPPORTED_OPERATION',
              message: 'File insertion should be handled by AutofillEngine using FileUploadHandler',
              recoverable: false
            }
          };

        default:
          return {
            success: false,
            error: {
              code: 'UNSUPPORTED_FIELD_TYPE',
              message: `Unsupported field type: ${field.type}`,
              recoverable: false
            }
          };
      }

      if (insertionSuccess) {
        // Trigger change events
        await this.triggerChangeEvents(element);

        return {
          success: true,
          filledField: {
            fieldId: field.id,
            selector: field.selector,
            value: finalValue,
            source
          }
        };
      } else {
        return {
          success: false,
          error: {
            code: 'INSERTION_FAILED',
            message: `Failed to insert value into ${field.type} field`,
            recoverable: true
          }
        };
      }

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          recoverable: true
        }
      };
    }
  }

  /**
   * Insert text value into input field
   */
  private async insertTextValue(element: HTMLInputElement, value: string): Promise<boolean> {
    return this.withRetry(async () => {
      // Clear existing value
      element.value = '';
      element.focus();

      // Set new value
      element.value = value;

      // Verify value was set
      return element.value === value;
    });
  }

  /**
   * Insert text value into textarea
   */
  private async insertTextareaValue(element: HTMLTextAreaElement, value: string): Promise<boolean> {
    return this.withRetry(async () => {
      element.value = '';
      element.focus();
      element.value = value;
      return element.value === value;
    });
  }

  /**
   * Select dropdown option
   */
  private async selectDropdownOption(element: HTMLSelectElement, value: string): Promise<boolean> {
    return this.withRetry(async () => {
      // Try exact match first
      for (let i = 0; i < element.options.length; i++) {
        const option = element.options[i];
        if (option.value === value || option.text === value) {
          element.selectedIndex = i;
          return true;
        }
      }

      // Try partial match (case-insensitive)
      const normalizedValue = value.toLowerCase();
      for (let i = 0; i < element.options.length; i++) {
        const option = element.options[i];
        const optionText = option.text.toLowerCase();
        const optionValue = option.value.toLowerCase();
        
        if (optionText.includes(normalizedValue) || optionValue.includes(normalizedValue)) {
          element.selectedIndex = i;
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Set checkbox value
   */
  private async setCheckboxValue(element: HTMLInputElement, checked: boolean): Promise<boolean> {
    return this.withRetry(async () => {
      element.checked = checked;
      return element.checked === checked;
    });
  }

  /**
   * Select radio option
   */
  private async selectRadioOption(selector: string, value: string): Promise<boolean> {
    return this.withRetry(async () => {
      // Find all radio buttons with the same name
      const radioButtons = document.querySelectorAll(`input[type="radio"]${selector}`) as NodeListOf<HTMLInputElement>;
      
      for (const radio of radioButtons) {
        if (radio.value === value || radio.nextElementSibling?.textContent?.trim() === value) {
          radio.checked = true;
          return true;
        }
      }

      // Try partial match
      const normalizedValue = value.toLowerCase();
      for (const radio of radioButtons) {
        const radioValue = radio.value.toLowerCase();
        const radioLabel = radio.nextElementSibling?.textContent?.trim().toLowerCase() || '';
        
        if (radioValue.includes(normalizedValue) || radioLabel.includes(normalizedValue)) {
          radio.checked = true;
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Insert date value
   */
  private async insertDateValue(element: HTMLInputElement, value: string): Promise<boolean> {
    return this.withRetry(async () => {
      // Try to parse and format date
      let formattedDate = value;
      
      if (value && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            formattedDate = date.toISOString().split('T')[0];
          }
        } catch (error) {
          console.warn('Date parsing failed:', error);
        }
      }

      element.value = formattedDate;
      return element.value === formattedDate;
    });
  }

  /**
   * Find element using selector with fallback strategies
   */
  private findElement(selector: string): Element | null {
    // Try direct selector first
    let element = document.querySelector(selector);
    if (element) return element;

    // Try with common attribute selectors
    const fallbackSelectors = [
      `[name="${selector}"]`,
      `[id="${selector}"]`,
      `[data-testid="${selector}"]`,
      `[aria-label*="${selector}"]`
    ];

    for (const fallbackSelector of fallbackSelectors) {
      element = document.querySelector(fallbackSelector);
      if (element) return element;
    }

    return null;
  }

  /**
   * Wait for element to be ready for interaction
   */
  private async waitForElementReady(element: Element): Promise<void> {
    return new Promise((resolve) => {
      if (this.isElementReady(element)) {
        resolve();
        return;
      }

      const observer = new MutationObserver(() => {
        if (this.isElementReady(element)) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(element, {
        attributes: true,
        attributeFilter: ['disabled', 'readonly', 'style']
      });

      // Timeout after 2 seconds
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 2000);
    });
  }

  /**
   * Check if element is ready for interaction
   */
  private isElementReady(element: Element): boolean {
    const input = element as HTMLInputElement;
    return !input.disabled && !input.readOnly && element.offsetParent !== null;
  }

  /**
   * Trigger change events on element
   */
  private async triggerChangeEvents(element: Element): Promise<void> {
    const events = ['input', 'change', 'blur'];
    
    for (const eventType of events) {
      const event = new Event(eventType, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      
      // Small delay between events
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= DataInserter.RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < DataInserter.RETRY_ATTEMPTS) {
          await new Promise(resolve => 
            setTimeout(resolve, DataInserter.RETRY_DELAY * Math.pow(2, attempt - 1))
          );
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Add delay between operations
   */
  static async delay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, DataInserter.INSERTION_DELAY));
  }
}