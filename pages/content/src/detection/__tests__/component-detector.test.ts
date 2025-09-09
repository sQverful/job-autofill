/**
 * Unit tests for ComponentDetector
 */

import { ComponentDetector } from '../component-detector';

describe('ComponentDetector', () => {
  let detector: ComponentDetector;

  beforeEach(() => {
    detector = new ComponentDetector();
  });

  describe('React Select Detection', () => {
    test('should detect React Select by class names', () => {
      // Create mock element
      const element = document.createElement('div');
      element.className = 'react-select__control select__control';
      
      const input = document.createElement('input');
      input.setAttribute('role', 'combobox');
      element.appendChild(input);

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      expect(result.bestMatch?.type).toBe('react-select');
      expect(result.bestMatch?.confidence).toBeGreaterThan(0.8);
      expect(result.bestMatch?.detectionMethod).toBe('react-select-class');
    });

    test('should detect React Select by role attributes', () => {
      const element = document.createElement('div');
      element.setAttribute('role', 'combobox');
      element.setAttribute('aria-expanded', 'false');
      
      const input = document.createElement('input');
      input.setAttribute('role', 'combobox');
      element.appendChild(input);

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      expect(result.bestMatch?.type).toBe('react-select');
      expect(result.bestMatch?.detectionMethod).toBe('react-select-role');
    });

    test('should detect React Select by structure', () => {
      const element = document.createElement('div');
      
      const valueContainer = document.createElement('div');
      valueContainer.className = 'select__value-container';
      element.appendChild(valueContainer);
      
      const input = document.createElement('input');
      valueContainer.appendChild(input);
      
      const indicators = document.createElement('div');
      indicators.className = 'select__indicators';
      element.appendChild(indicators);

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      expect(result.bestMatch?.type).toBe('react-select');
      expect(result.bestMatch?.detectionMethod).toBe('react-select-structure');
    });

    test('isReactSelect should return true for React Select components', () => {
      const element = document.createElement('div');
      element.className = 'react-select__control';
      
      const input = document.createElement('input');
      input.setAttribute('role', 'combobox');
      element.appendChild(input);

      const isReactSelect = detector.isReactSelect(element);

      expect(isReactSelect).toBe(true);
    });

    test('isReactSelect should return false for non-React Select components', () => {
      const element = document.createElement('div');
      element.className = 'regular-div';

      const isReactSelect = detector.isReactSelect(element);

      expect(isReactSelect).toBe(false);
    });
  });

  describe('Vue Select Detection', () => {
    test('should detect Vue Select components', () => {
      const element = document.createElement('div');
      element.className = 'v-select vue-select';
      element.setAttribute('v-model', 'selectedValue');
      
      const input = document.createElement('input');
      element.appendChild(input);

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      expect(result.bestMatch?.type).toBe('vue-select');
      expect(result.bestMatch?.detectionMethod).toBe('vue-select');
    });
  });

  describe('Angular Select Detection', () => {
    test('should detect Angular Material Select components', () => {
      const element = document.createElement('div');
      element.className = 'mat-select mat-form-field';
      element.setAttribute('ng-model', 'selectedValue');
      
      const input = document.createElement('input');
      element.appendChild(input);

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      expect(result.bestMatch?.type).toBe('angular-select');
      expect(result.bestMatch?.detectionMethod).toBe('angular-select');
    });
  });

  describe('Standard HTML Select Detection', () => {
    test('should detect standard HTML select elements', () => {
      const element = document.createElement('select');
      
      const option1 = document.createElement('option');
      option1.value = 'option1';
      element.appendChild(option1);

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      expect(result.bestMatch?.type).toBe('standard-select');
      expect(result.bestMatch?.confidence).toBe(1.0);
      expect(result.bestMatch?.detectionMethod).toBe('standard-select');
    });
  });

  describe('Custom Select Detection', () => {
    test('should detect custom select components', () => {
      const element = document.createElement('div');
      element.className = 'custom-dropdown-picker'; // Changed to avoid React Select conflict
      
      const input = document.createElement('input');
      element.appendChild(input);

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      expect(result.bestMatch?.type).toBe('custom-select');
      expect(result.bestMatch?.detectionMethod).toBe('custom-select');
    });
  });

  describe('Multiple Strategies and Confidence Scoring', () => {
    test('should handle multiple detection strategies', () => {
      const element = document.createElement('div');
      element.className = 'react-select__control custom-select';
      element.setAttribute('role', 'combobox');
      
      const input = document.createElement('input');
      input.setAttribute('role', 'combobox');
      element.appendChild(input);

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      expect(result.components.length).toBeGreaterThan(1);
      expect(result.bestMatch?.type).toBe('react-select'); // Should prioritize React Select
      expect(result.totalConfidence).toBeGreaterThan(0);
    });

    test('should prioritize higher confidence detections', () => {
      const element = document.createElement('select');
      element.className = 'react-select__control'; // Conflicting signals
      
      const result = detector.detectComponent(element);

      expect(result.detected).toBe(true);
      // Standard select should win due to higher confidence (1.0)
      expect(result.bestMatch?.type).toBe('standard-select');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty elements gracefully', () => {
      const element = document.createElement('div');

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(false);
      expect(result.bestMatch).toBeNull();
      expect(result.components).toHaveLength(0);
    });

    test('should handle elements with no relevant attributes', () => {
      const element = document.createElement('div');
      element.textContent = 'Just a plain div';

      const result = detector.detectComponent(element);

      expect(result.detected).toBe(false);
      expect(result.bestMatch).toBeNull();
    });
  });

  describe('Strategy Management', () => {
    test('should return all available strategies', () => {
      const strategies = detector.getStrategies();

      expect(strategies.length).toBeGreaterThan(0);
      expect(strategies.every(s => s.name && s.detect && typeof s.priority === 'number')).toBe(true);
    });

    test('should allow adding custom strategies', () => {
      const customStrategy = {
        name: 'custom-test',
        priority: 999,
        confidence: 0.5,
        detect: () => null
      };

      detector.addStrategy(customStrategy);
      const strategies = detector.getStrategies();

      expect(strategies).toContain(customStrategy);
      expect(strategies[0]).toBe(customStrategy); // Should be first due to high priority
    });
  });
});