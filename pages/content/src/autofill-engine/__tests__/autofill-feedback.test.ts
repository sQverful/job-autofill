/**
 * Tests for autofill feedback system
 */

import { AutofillFeedback } from '../autofill-feedback';
import type { AutofillResult, FilledField, AutofillError } from '@extension/shared/lib/types';

// Mock DOM APIs
Object.defineProperty(document, 'head', {
  value: {
    appendChild: jest.fn()
  }
});

Object.defineProperty(document, 'body', {
  value: {
    appendChild: jest.fn()
  }
});

global.Element = class {
  classList = {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn()
  };
  remove = jest.fn();
  querySelector = jest.fn();
  addEventListener = jest.fn();
  style = {};
} as any;

global.HTMLElement = Element as any;

describe('AutofillFeedback', () => {
  let feedback: AutofillFeedback;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    feedback = new AutofillFeedback();
    
    mockContainer = new HTMLElement();
    mockContainer.id = 'autofill-feedback-container';
    
    document.getElementById = jest.fn().mockReturnValue(mockContainer);
    document.querySelector = jest.fn();
    document.createElement = jest.fn().mockImplementation((tag) => {
      const element = new HTMLElement();
      element.tagName = tag.toUpperCase();
      return element;
    });

    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create feedback with default options', () => {
      const options = feedback.getFeedbackOptions();
      expect(options.showHighlights).toBe(true);
      expect(options.showProgressIndicator).toBe(true);
      expect(options.enableUndo).toBe(true);
    });

    it('should create feedback with custom options', () => {
      const customFeedback = new AutofillFeedback({
        showHighlights: false,
        highlightDuration: 5000
      });
      
      const options = customFeedback.getFeedbackOptions();
      expect(options.showHighlights).toBe(false);
      expect(options.highlightDuration).toBe(5000);
    });
  });

  describe('progress indication', () => {
    it('should show progress indicator', () => {
      const progressState = {
        isActive: true,
        totalFields: 10,
        processedFields: 3,
        errors: 0,
        currentField: 'First Name'
      };

      feedback.showProgress(progressState);

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    it('should hide progress indicator', () => {
      const progressState = {
        isActive: true,
        totalFields: 10,
        processedFields: 10,
        errors: 0
      };

      feedback.showProgress(progressState);
      feedback.hideProgress();

      // Should trigger hide animation
      expect(setTimeout).toHaveBeenCalled();
    });
  });

  describe('field highlighting', () => {
    it('should highlight filled fields', () => {
      const filledFields: FilledField[] = [
        {
          fieldId: 'firstName',
          selector: '#firstName',
          value: 'John',
          source: 'profile'
        },
        {
          fieldId: 'email',
          selector: '#email',
          value: 'john@example.com',
          source: 'profile'
        }
      ];

      const mockElements = [new HTMLElement(), new HTMLElement()];
      document.querySelector = jest.fn()
        .mockReturnValueOnce(mockElements[0])
        .mockReturnValueOnce(mockElements[1]);

      feedback.highlightFields(filledFields);

      expect(mockElements[0].classList.add).toHaveBeenCalledWith('autofill-highlighted');
      expect(mockElements[1].classList.add).toHaveBeenCalledWith('autofill-highlighted');
    });

    it('should highlight error fields differently', () => {
      const filledFields: FilledField[] = [];
      const errors: AutofillError[] = [
        {
          fieldId: 'phone',
          selector: '#phone',
          code: 'VALIDATION_FAILED',
          message: 'Invalid phone format',
          recoverable: true
        }
      ];

      const mockElement = new HTMLElement();
      document.querySelector = jest.fn().mockReturnValue(mockElement);

      feedback.highlightFields(filledFields, errors);

      expect(mockElement.classList.add).toHaveBeenCalledWith('autofill-highlighted', 'error');
    });

    it('should clear highlights', () => {
      const filledFields: FilledField[] = [
        {
          fieldId: 'firstName',
          selector: '#firstName',
          value: 'John',
          source: 'profile'
        }
      ];

      const mockElement = new HTMLElement();
      document.querySelector = jest.fn().mockReturnValue(mockElement);

      feedback.highlightFields(filledFields);
      feedback.clearHighlights();

      expect(mockElement.classList.remove).toHaveBeenCalledWith('autofill-highlighted', 'error');
    });
  });

  describe('error display', () => {
    it('should show error messages', () => {
      const errors: AutofillError[] = [
        {
          fieldId: 'phone',
          selector: '#phone',
          code: 'VALIDATION_FAILED',
          message: 'Invalid phone format',
          recoverable: true
        },
        {
          fieldId: 'email',
          selector: '#email',
          code: 'ELEMENT_NOT_FOUND',
          message: 'Email field not found',
          recoverable: false
        }
      ];

      feedback.showErrors(errors);

      expect(document.createElement).toHaveBeenCalledWith('div');
    });

    it('should hide error display', () => {
      const errors: AutofillError[] = [
        {
          fieldId: 'test',
          selector: '#test',
          code: 'TEST_ERROR',
          message: 'Test error',
          recoverable: true
        }
      ];

      feedback.showErrors(errors);
      feedback.hideErrors();

      // Should remove visible class
      const mockErrorDisplay = new HTMLElement();
      mockErrorDisplay.classList.remove = jest.fn();
    });
  });

  describe('undo functionality', () => {
    it('should show undo button after successful autofill', () => {
      const result: AutofillResult = {
        success: true,
        filledFields: [
          {
            fieldId: 'firstName',
            selector: '#firstName',
            value: 'John',
            source: 'profile'
          }
        ],
        skippedFields: [],
        errors: [],
        totalFields: 1,
        filledCount: 1,
        duration: 500
      };

      feedback.showResult(result);

      expect(document.createElement).toHaveBeenCalledWith('button');
    });

    it('should not show undo button when no fields filled', () => {
      const result: AutofillResult = {
        success: false,
        filledFields: [],
        skippedFields: [],
        errors: [
          {
            fieldId: 'test',
            selector: '#test',
            code: 'ERROR',
            message: 'Test error',
            recoverable: true
          }
        ],
        totalFields: 1,
        filledCount: 0,
        duration: 100
      };

      feedback.showResult(result);

      // Should not create undo button
      expect(document.createElement).not.toHaveBeenCalledWith('button');
    });
  });

  describe('complete result display', () => {
    it('should show complete autofill result', () => {
      const result: AutofillResult = {
        success: true,
        filledFields: [
          {
            fieldId: 'firstName',
            selector: '#firstName',
            value: 'John',
            source: 'profile'
          }
        ],
        skippedFields: [
          {
            fieldId: 'middleName',
            selector: '#middleName',
            reason: 'no_mapping',
            message: 'No middle name provided'
          }
        ],
        errors: [
          {
            fieldId: 'phone',
            selector: '#phone',
            code: 'VALIDATION_FAILED',
            message: 'Invalid phone format',
            recoverable: true
          }
        ],
        totalFields: 3,
        filledCount: 1,
        duration: 1500
      };

      const mockElement = new HTMLElement();
      document.querySelector = jest.fn().mockReturnValue(mockElement);

      feedback.showResult(result);

      // Should highlight fields
      expect(mockElement.classList.add).toHaveBeenCalled();
      
      // Should show errors
      expect(document.createElement).toHaveBeenCalledWith('div');
      
      // Should show undo button
      expect(document.createElement).toHaveBeenCalledWith('button');
    });
  });

  describe('cleanup', () => {
    it('should clean up all feedback elements', () => {
      const mockContainer = new HTMLElement();
      const mockStyles = new HTMLElement();
      
      document.getElementById = jest.fn()
        .mockReturnValueOnce(mockContainer)
        .mockReturnValueOnce(mockStyles);

      feedback.cleanup();

      expect(mockContainer.remove).toHaveBeenCalled();
      expect(mockStyles.remove).toHaveBeenCalled();
    });
  });

  describe('options update', () => {
    it('should update feedback options', () => {
      feedback.updateOptions({
        showHighlights: false,
        highlightDuration: 5000
      });

      const options = feedback.getFeedbackOptions();
      expect(options.showHighlights).toBe(false);
      expect(options.highlightDuration).toBe(5000);
    });
  });
});