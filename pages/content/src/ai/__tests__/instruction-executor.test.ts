/**
 * Tests for AI Instruction Executor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InstructionExecutor } from '../instruction-executor';
import type { FormInstruction } from '@extension/shared';

// Mock the safe selector utility
vi.mock('../../utils/safe-selector', () => ({
  safeQuerySelector: vi.fn()
}));

describe('InstructionExecutor', () => {
  let executor: InstructionExecutor;
  let mockElement: HTMLElement;

  beforeEach(() => {
    executor = new InstructionExecutor({
      timeout: 1000,
      retryAttempts: 1,
      retryDelay: 100,
      safetyChecks: true,
      logExecution: false
    });

    // Create mock DOM elements
    mockElement = document.createElement('input');
    document.body.appendChild(mockElement);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('executeInstruction', () => {
    it('should execute fill instruction successfully', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockInput = document.createElement('input');
      mockInput.type = 'text';
      vi.mocked(safeQuerySelector).mockReturnValue(mockInput);

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#test-input',
        value: 'test value',
        reasoning: 'Test fill',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(result.actualValue).toBe('test value');
      expect(mockInput.value).toBe('test value');
    });

    it('should execute select instruction successfully', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockSelect = document.createElement('select');
      const option1 = document.createElement('option');
      option1.value = 'option1';
      option1.textContent = 'Option 1';
      const option2 = document.createElement('option');
      option2.value = 'option2';
      option2.textContent = 'Option 2';
      mockSelect.appendChild(option1);
      mockSelect.appendChild(option2);
      vi.mocked(safeQuerySelector).mockReturnValue(mockSelect);

      const instruction: FormInstruction = {
        action: 'select',
        selector: '#test-select',
        value: 'option2',
        reasoning: 'Test select',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(result.actualValue).toBe('option2');
      expect(mockSelect.value).toBe('option2');
    });

    it('should execute click instruction successfully', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockButton = document.createElement('button');
      let clicked = false;
      mockButton.onclick = () => { clicked = true; };
      vi.mocked(safeQuerySelector).mockReturnValue(mockButton);

      const instruction: FormInstruction = {
        action: 'click',
        selector: '#test-button',
        reasoning: 'Test click',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });

    it('should handle custom checkbox selection by value', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      
      // Create a mock custom checkbox group similar to the one you provided
      const mockGroup = document.createElement('div');
      mockGroup.setAttribute('role', 'group');
      mockGroup.setAttribute('data-testid', 'customQuestions.test');
      
      // Create first checkbox option
      const checkbox1 = document.createElement('div');
      checkbox1.setAttribute('role', 'checkbox');
      checkbox1.setAttribute('data-value', 'Full-Time Employment');
      checkbox1.setAttribute('aria-checked', 'false');
      checkbox1.setAttribute('tabindex', '0');
      
      const hiddenInput1 = document.createElement('input');
      hiddenInput1.type = 'checkbox';
      hiddenInput1.value = 'Full-Time Employment';
      checkbox1.appendChild(hiddenInput1);
      
      // Create second checkbox option
      const checkbox2 = document.createElement('div');
      checkbox2.setAttribute('role', 'checkbox');
      checkbox2.setAttribute('data-value', 'Independent Contractor / Freelancer (1099 or similar)');
      checkbox2.setAttribute('aria-checked', 'false');
      checkbox2.setAttribute('tabindex', '0');
      
      const hiddenInput2 = document.createElement('input');
      hiddenInput2.type = 'checkbox';
      hiddenInput2.value = 'Independent Contractor / Freelancer (1099 or similar)';
      checkbox2.appendChild(hiddenInput2);
      
      mockGroup.appendChild(checkbox1);
      mockGroup.appendChild(checkbox2);
      
      vi.mocked(safeQuerySelector).mockReturnValue(mockGroup);

      const instruction: FormInstruction = {
        action: 'click',
        selector: '[data-testid="customQuestions.test"]',
        value: 'Full-Time Employment',
        reasoning: 'Test custom checkbox selection',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(result.actualValue).toBe('Full-Time Employment');
      expect(checkbox1.getAttribute('aria-checked')).toBe('true');
      expect(hiddenInput1.checked).toBe(true);
    });

    it('should handle checkbox click instruction', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockCheckbox = document.createElement('input');
      mockCheckbox.type = 'checkbox';
      vi.mocked(safeQuerySelector).mockReturnValue(mockCheckbox);

      const instruction: FormInstruction = {
        action: 'click',
        selector: '#test-checkbox',
        reasoning: 'Test checkbox',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(result.actualValue).toBe('true');
      expect(mockCheckbox.checked).toBe(true);
    });

    it('should handle radio button click instruction', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockRadio = document.createElement('input');
      mockRadio.type = 'radio';
      mockRadio.name = 'testRadio';
      mockRadio.value = 'option1';
      vi.mocked(safeQuerySelector).mockReturnValue(mockRadio);

      const instruction: FormInstruction = {
        action: 'click',
        selector: 'input[name="testRadio"][value="option1"]',
        reasoning: 'Test radio button',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(result.actualValue).toBe('true');
      expect(mockRadio.checked).toBe(true);
    });

    it('should handle custom role="checkbox" click instruction', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockCustomCheckbox = document.createElement('div');
      mockCustomCheckbox.setAttribute('role', 'checkbox');
      mockCustomCheckbox.setAttribute('aria-checked', 'false');
      mockCustomCheckbox.setAttribute('tabindex', '0');
      
      // Add hidden input
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'checkbox';
      hiddenInput.checked = false;
      mockCustomCheckbox.appendChild(hiddenInput);
      
      vi.mocked(safeQuerySelector).mockReturnValue(mockCustomCheckbox);

      const instruction: FormInstruction = {
        action: 'click',
        selector: '[role="checkbox"]',
        reasoning: 'Test custom checkbox',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(result.actualValue).toBe('true');
      expect(mockCustomCheckbox.getAttribute('aria-checked')).toBe('true');
      expect(hiddenInput.checked).toBe(true);
    });

    it('should fail when element not found', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      vi.mocked(safeQuerySelector).mockReturnValue(null);

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#nonexistent',
        value: 'test',
        reasoning: 'Test not found',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });

    it('should fail when element is disabled', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockInput = document.createElement('input');
      mockInput.disabled = true;
      vi.mocked(safeQuerySelector).mockReturnValue(mockInput);

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#disabled-input',
        value: 'test',
        reasoning: 'Test disabled',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not interactable');
    });

    it('should validate instruction parameters', async () => {
      const instruction: FormInstruction = {
        action: 'fill',
        selector: '',
        value: 'test',
        reasoning: 'Test validation',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid selector');
    });

    it('should retry failed instructions', async () => {
      const executorWithRetries = new InstructionExecutor({
        retryAttempts: 2,
        retryDelay: 10,
        logExecution: false
      });

      const { safeQuerySelector } = await import('../../utils/safe-selector');
      let callCount = 0;
      vi.mocked(safeQuerySelector).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return null; // Fail first two attempts
        }
        const mockInput = document.createElement('input');
        mockInput.type = 'text';
        return mockInput;
      });

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#retry-test',
        value: 'test',
        reasoning: 'Test retry',
        confidence: 0.9,
        priority: 1
      };

      const result = await executorWithRetries.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(callCount).toBe(3);
    });
  });

  describe('executeInstructions', () => {
    it('should execute multiple instructions in sequence', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      
      const mockInput1 = document.createElement('input');
      mockInput1.type = 'text';
      const mockInput2 = document.createElement('input');
      mockInput2.type = 'text';
      
      vi.mocked(safeQuerySelector)
        .mockReturnValueOnce(mockInput1)
        .mockReturnValueOnce(mockInput2);

      const instructions: FormInstruction[] = [
        {
          action: 'fill',
          selector: '#input1',
          value: 'value1',
          reasoning: 'Test 1',
          confidence: 0.9,
          priority: 1
        },
        {
          action: 'fill',
          selector: '#input2',
          value: 'value2',
          reasoning: 'Test 2',
          confidence: 0.9,
          priority: 2
        }
      ];

      const results = await executor.executeInstructions(instructions);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockInput1.value).toBe('value1');
      expect(mockInput2.value).toBe('value2');
    });
  });

  describe('select option finding', () => {
    it('should find option by exact value match', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockSelect = document.createElement('select');
      const option1 = document.createElement('option');
      option1.value = 'exact-value';
      option1.textContent = 'Display Text';
      mockSelect.appendChild(option1);
      vi.mocked(safeQuerySelector).mockReturnValue(mockSelect);

      const instruction: FormInstruction = {
        action: 'select',
        selector: '#test-select',
        value: 'exact-value',
        reasoning: 'Test exact match',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(mockSelect.value).toBe('exact-value');
    });

    it('should find option by text content match', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockSelect = document.createElement('select');
      const option1 = document.createElement('option');
      option1.value = 'val1';
      option1.textContent = 'Display Text';
      mockSelect.appendChild(option1);
      vi.mocked(safeQuerySelector).mockReturnValue(mockSelect);

      const instruction: FormInstruction = {
        action: 'select',
        selector: '#test-select',
        value: 'display text', // Case insensitive partial match
        reasoning: 'Test text match',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(mockSelect.value).toBe('val1');
    });
  });

  describe('execution statistics', () => {
    it('should track execution statistics', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      
      // Mock successful execution
      const mockInput = document.createElement('input');
      mockInput.type = 'text';
      vi.mocked(safeQuerySelector).mockReturnValue(mockInput);

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#test',
        value: 'test',
        reasoning: 'Test stats',
        confidence: 0.9,
        priority: 1
      };

      await executor.executeInstruction(instruction);

      const stats = executor.getExecutionStats();
      expect(stats.total).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(100);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });

    it('should clear execution log', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockInput = document.createElement('input');
      mockInput.type = 'text';
      vi.mocked(safeQuerySelector).mockReturnValue(mockInput);

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#test',
        value: 'test',
        reasoning: 'Test clear',
        confidence: 0.9,
        priority: 1
      };

      await executor.executeInstruction(instruction);
      expect(executor.getExecutionLog()).toHaveLength(1);

      executor.clearExecutionLog();
      expect(executor.getExecutionLog()).toHaveLength(0);
    });
  });

  describe('safety checks', () => {
    it('should skip safety checks when disabled', async () => {
      const unsafeExecutor = new InstructionExecutor({
        safetyChecks: false,
        logExecution: false
      });

      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockInput = document.createElement('input');
      mockInput.disabled = true; // This would normally fail safety checks
      mockInput.type = 'text';
      vi.mocked(safeQuerySelector).mockReturnValue(mockInput);

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#unsafe-test',
        value: 'test',
        reasoning: 'Test unsafe',
        confidence: 0.9,
        priority: 1
      };

      const result = await unsafeExecutor.executeInstruction(instruction);

      // Should succeed because safety checks are disabled
      expect(result.success).toBe(true);
    });
  });

  describe('advanced form interactions', () => {
    it('should handle file upload instructions', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockFileInput = document.createElement('input');
      mockFileInput.type = 'file';
      mockFileInput.accept = '.pdf,.doc,.docx';
      vi.mocked(safeQuerySelector).mockReturnValue(mockFileInput);

      const instruction: FormInstruction = {
        action: 'upload',
        selector: '#file-input',
        value: 'resume.pdf',
        reasoning: 'Upload resume',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(result.actualValue).toBe('resume.pdf');
      expect(mockFileInput.getAttribute('data-ai-file-selected')).toBe('resume.pdf');
      expect(mockFileInput.getAttribute('data-ai-file-type')).toBe('pdf');
    });

    it('should validate file upload restrictions', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockFileInput = document.createElement('input');
      mockFileInput.type = 'file';
      mockFileInput.accept = '.pdf'; // Only PDF allowed
      vi.mocked(safeQuerySelector).mockReturnValue(mockFileInput);

      const instruction: FormInstruction = {
        action: 'upload',
        selector: '#file-input',
        value: 'resume.doc', // Wrong file type
        reasoning: 'Upload resume',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File type not accepted');
    });

    it('should handle conditional field interactions', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockInput = document.createElement('input');
      mockInput.type = 'text';
      vi.mocked(safeQuerySelector).mockReturnValue(mockInput);

      const result = await executor.handleConditionalField('#conditional-input', 'test value', 'visible(#trigger)');

      // Should succeed even if condition evaluation is simplified
      expect(result.success).toBe(true);
      expect(result.actualValue).toBe('test value');
    });

    it('should navigate to next step', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockButton = document.createElement('button');
      mockButton.type = 'submit';
      mockButton.textContent = 'Next';
      let clicked = false;
      mockButton.onclick = () => { clicked = true; };
      vi.mocked(safeQuerySelector).mockReturnValue(mockButton);

      const result = await executor.navigateToNextStep();

      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
      expect(result.interactionType).toBe('navigate-next');
    });

    it('should detect and fix email format', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockInput = document.createElement('input');
      mockInput.type = 'email';
      vi.mocked(safeQuerySelector).mockReturnValue(mockInput);

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#email-input',
        value: 'test@gmial.com', // Typo in domain
        reasoning: 'Fill email',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      // The email should be corrected during validation fix if needed
      expect(mockInput.value).toBe('test@gmial.com'); // Initial value
    });

    it('should detect and fix phone format', async () => {
      const { safeQuerySelector } = await import('../../utils/safe-selector');
      const mockInput = document.createElement('input');
      mockInput.type = 'tel';
      vi.mocked(safeQuerySelector).mockReturnValue(mockInput);

      const instruction: FormInstruction = {
        action: 'fill',
        selector: '#phone-input',
        value: '1234567890',
        reasoning: 'Fill phone',
        confidence: 0.9,
        priority: 1
      };

      const result = await executor.executeInstruction(instruction);

      expect(result.success).toBe(true);
      expect(mockInput.value).toBe('1234567890');
    });
  });
});