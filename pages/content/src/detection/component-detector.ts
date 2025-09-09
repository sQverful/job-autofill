/**
 * Enhanced Component Detection System
 * Implements adaptive patterns with multiple detection strategies and confidence scoring
 */

export interface DetectionStrategy {
  name: string;
  detect(element: HTMLElement): ComponentInfo | null;
  priority: number;
  confidence: number;
}

export interface ComponentInfo {
  type: ComponentType;
  element: HTMLElement;
  input: HTMLInputElement | null;
  control: HTMLElement | null;
  detectionMethod: string;
  confidence: number;
  metadata: Record<string, any>;
}

export type ComponentType = 'react-select' | 'vue-select' | 'angular-select' | 'custom-select' | 'standard-select' | 'unknown';

export interface DetectionResult {
  detected: boolean;
  components: ComponentInfo[];
  bestMatch: ComponentInfo | null;
  totalConfidence: number;
}

/**
 * Enhanced component detector with adaptive patterns and confidence scoring
 */
export class ComponentDetector {
  private strategies: DetectionStrategy[] = [];

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Initialize detection strategies in priority order
   */
  private initializeStrategies(): void {
    this.strategies = [
      new ReactSelectClassStrategy(),
      new ReactSelectRoleStrategy(),
      new ReactSelectStructureStrategy(),
      new ReactSelectAttributeStrategy(),
      new ReactSelectBehaviorStrategy(),
      new VueSelectStrategy(),
      new AngularSelectStrategy(),
      new CustomSelectStrategy(),
      new StandardSelectStrategy()
    ];

    // Sort by priority (higher priority first)
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Detect component type with multiple strategies and confidence scoring
   */
  public detectComponent(element: HTMLElement): DetectionResult {
    const components: ComponentInfo[] = [];
    let totalConfidence = 0;

    // Try all strategies and collect results
    for (const strategy of this.strategies) {
      try {
        const result = strategy.detect(element);
        if (result && result.confidence > 0.1) { // Minimum confidence threshold
          components.push(result);
          totalConfidence += result.confidence;
        }
      } catch (error) {
        console.warn(`Detection strategy ${strategy.name} failed:`, error);
      }
    }

    // Find best match based on confidence and priority
    const bestMatch = this.selectBestMatch(components);

    return {
      detected: components.length > 0,
      components,
      bestMatch,
      totalConfidence: Math.min(totalConfidence, 1.0) // Cap at 1.0
    };
  }

  /**
   * Enhanced React Select detection with multiple strategies
   */
  public isReactSelect(element: HTMLElement): boolean {
    const result = this.detectComponent(element);
    return result.bestMatch?.type === 'react-select' && result.bestMatch.confidence > 0.5;
  }

  /**
   * Get React Select info with detailed detection data
   */
  public getReactSelectInfo(element: HTMLElement): ComponentInfo | null {
    const result = this.detectComponent(element);
    return result.bestMatch?.type === 'react-select' ? result.bestMatch : null;
  }

  /**
   * Select best match based on confidence and component type priority
   */
  private selectBestMatch(components: ComponentInfo[]): ComponentInfo | null {
    if (components.length === 0) return null;

    // Sort by confidence first, then by type priority
    const typePriority: Record<ComponentType, number> = {
      'standard-select': 10, // Standard HTML select has highest priority when detected
      'react-select': 9,
      'vue-select': 8,
      'angular-select': 7,
      'custom-select': 6,
      'unknown': 1
    };

    return components.sort((a, b) => {
      // For standard select, prioritize it if confidence is high
      if (a.type === 'standard-select' && a.confidence === 1.0) return -1;
      if (b.type === 'standard-select' && b.confidence === 1.0) return 1;
      
      // First sort by confidence (significant difference threshold)
      if (Math.abs(a.confidence - b.confidence) > 0.2) {
        return b.confidence - a.confidence;
      }
      // Then by type priority
      return typePriority[b.type] - typePriority[a.type];
    })[0];
  }

  /**
   * Add custom detection strategy
   */
  public addStrategy(strategy: DetectionStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all available strategies
   */
  public getStrategies(): DetectionStrategy[] {
    return [...this.strategies];
  }
}

/**
 * React Select class-based detection strategy
 */
class ReactSelectClassStrategy implements DetectionStrategy {
  name = 'react-select-class';
  priority = 100;
  confidence = 0.9;

  detect(element: HTMLElement): ComponentInfo | null {
    const classNames = element.className.toLowerCase();
    
    // High confidence patterns
    if (classNames.includes('react-select') || 
        classNames.includes('select__control') ||
        classNames.includes('css-') && classNames.includes('control')) {
      
      const input = this.findInput(element);
      const control = this.findControl(element);
      
      return {
        type: 'react-select',
        element,
        input,
        control: control || element,
        detectionMethod: this.name,
        confidence: this.confidence,
        metadata: {
          classNames: element.className,
          hasReactSelectClass: classNames.includes('react-select'),
          hasControlClass: classNames.includes('control')
        }
      };
    }

    return null;
  }

  private findInput(element: HTMLElement): HTMLInputElement | null {
    const selectors = [
      'input[role="combobox"]',
      '.select__input input',
      '.react-select__input input',
      'input[class*="input"]'
    ];

    for (const selector of selectors) {
      const input = element.querySelector(selector) as HTMLInputElement;
      if (input) return input;
    }

    return null;
  }

  private findControl(element: HTMLElement): HTMLElement | null {
    if (element.className.includes('control')) return element;
    
    const control = element.querySelector('[class*="control"]') as HTMLElement;
    return control || element;
  }
}

/**
 * React Select role-based detection strategy
 */
class ReactSelectRoleStrategy implements DetectionStrategy {
  name = 'react-select-role';
  priority = 90;
  confidence = 0.8;

  detect(element: HTMLElement): ComponentInfo | null {
    const role = element.getAttribute('role');
    const ariaExpanded = element.getAttribute('aria-expanded');
    const ariaHaspopup = element.getAttribute('aria-haspopup');

    if (role === 'combobox' || 
        (ariaHaspopup === 'listbox' && ariaExpanded !== null)) {
      
      const input = this.findComboboxInput(element);
      
      return {
        type: 'react-select',
        element,
        input,
        control: element,
        detectionMethod: this.name,
        confidence: this.confidence,
        metadata: {
          role,
          ariaExpanded,
          ariaHaspopup,
          hasComboboxRole: role === 'combobox'
        }
      };
    }

    return null;
  }

  private findComboboxInput(element: HTMLElement): HTMLInputElement | null {
    // Check if element itself is an input
    if (element.tagName.toLowerCase() === 'input') {
      return element as HTMLInputElement;
    }

    // Look for input within element
    const input = element.querySelector('input[role="combobox"], input') as HTMLInputElement;
    return input;
  }
}

/**
 * React Select structure-based detection strategy
 */
class ReactSelectStructureStrategy implements DetectionStrategy {
  name = 'react-select-structure';
  priority = 80;
  confidence = 0.7;

  detect(element: HTMLElement): ComponentInfo | null {
    // Look for typical React Select DOM structure
    const hasIndicators = element.querySelector('[class*="indicator"]');
    const hasValueContainer = element.querySelector('[class*="value"], [class*="placeholder"]');
    const hasInput = element.querySelector('input');

    if (hasIndicators && hasValueContainer && hasInput) {
      const confidence = this.calculateStructureConfidence(element);
      
      if (confidence > 0.5) {
        return {
          type: 'react-select',
          element,
          input: hasInput as HTMLInputElement,
          control: element,
          detectionMethod: this.name,
          confidence,
          metadata: {
            hasIndicators: !!hasIndicators,
            hasValueContainer: !!hasValueContainer,
            hasInput: !!hasInput,
            structureScore: confidence
          }
        };
      }
    }

    return null;
  }

  private calculateStructureConfidence(element: HTMLElement): number {
    let score = 0;
    const maxScore = 7; // Reduced max score for more realistic confidence

    // Check for common React Select elements
    if (element.querySelector('[class*="indicator"]')) score += 2;
    if (element.querySelector('[class*="value"], [class*="placeholder"]')) score += 2;
    if (element.querySelector('[class*="input"]')) score += 2;
    if (element.querySelector('[class*="menu"], [class*="option"], [class*="dropdown"]')) score += 1;

    return Math.min(score / maxScore, 1.0);
  }
}

/**
 * React Select attribute-based detection strategy
 */
class ReactSelectAttributeStrategy implements DetectionStrategy {
  name = 'react-select-attribute';
  priority = 70;
  confidence = 0.6;

  detect(element: HTMLElement): ComponentInfo | null {
    const attributes = this.getRelevantAttributes(element);
    const confidence = this.calculateAttributeConfidence(attributes);

    if (confidence > 0.4) {
      const input = element.querySelector('input') as HTMLInputElement;
      
      return {
        type: 'react-select',
        element,
        input,
        control: element,
        detectionMethod: this.name,
        confidence,
        metadata: {
          attributes,
          attributeScore: confidence
        }
      };
    }

    return null;
  }

  private getRelevantAttributes(element: HTMLElement): Record<string, string> {
    const attrs: Record<string, string> = {};
    const relevantAttrs = ['data-testid', 'data-cy', 'data-automation', 'class', 'id'];

    for (const attr of relevantAttrs) {
      const value = element.getAttribute(attr);
      if (value) attrs[attr] = value;
    }

    return attrs;
  }

  private calculateAttributeConfidence(attributes: Record<string, string>): number {
    let score = 0;
    const maxScore = 8;

    const allValues = Object.values(attributes).join(' ').toLowerCase();

    if (allValues.includes('select')) score += 2;
    if (allValues.includes('dropdown')) score += 2;
    if (allValues.includes('combobox')) score += 2;
    if (allValues.includes('react')) score += 1;
    if (allValues.includes('choice')) score += 1;

    return Math.min(score / maxScore, 1.0);
  }
}

/**
 * React Select behavior-based detection strategy
 */
class ReactSelectBehaviorStrategy implements DetectionStrategy {
  name = 'react-select-behavior';
  priority = 60;
  confidence = 0.5;

  detect(element: HTMLElement): ComponentInfo | null {
    // This strategy tests for React Select-like behavior
    // Note: This is more expensive as it may trigger events
    
    const input = element.querySelector('input') as HTMLInputElement;
    if (!input) return null;

    const behaviorScore = this.testBehavior(element, input);
    
    if (behaviorScore > 0.3) {
      return {
        type: 'react-select',
        element,
        input,
        control: element,
        detectionMethod: this.name,
        confidence: behaviorScore,
        metadata: {
          behaviorScore,
          testedBehavior: true
        }
      };
    }

    return null;
  }

  private testBehavior(element: HTMLElement, input: HTMLInputElement): number {
    let score = 0;
    const maxScore = 6;

    try {
      // Test if input is readonly (common in React Select)
      if (input.readOnly) score += 1;

      // Test if clicking element focuses input
      const originalFocus = document.activeElement;
      element.click();
      if (document.activeElement === input) score += 2;
      
      // Restore focus
      if (originalFocus && originalFocus !== input) {
        (originalFocus as HTMLElement).focus();
      }

      // Test for dropdown behavior on focus
      input.focus();
      setTimeout(() => {
        const dropdown = element.querySelector('[class*="menu"], [class*="dropdown"], [class*="option"]');
        if (dropdown) score += 2;
      }, 100);

      // Test for value container
      const valueContainer = element.querySelector('[class*="value"], [class*="placeholder"]');
      if (valueContainer) score += 1;

    } catch (error) {
      console.warn('Behavior test failed:', error);
    }

    return Math.min(score / maxScore, 1.0);
  }
}

/**
 * Vue Select detection strategy
 */
class VueSelectStrategy implements DetectionStrategy {
  name = 'vue-select';
  priority = 50;
  confidence = 0.8;

  detect(element: HTMLElement): ComponentInfo | null {
    const classNames = element.className.toLowerCase();
    
    if (classNames.includes('v-select') || 
        classNames.includes('vue-select') ||
        element.hasAttribute('v-model')) {
      
      const input = element.querySelector('input') as HTMLInputElement;
      
      return {
        type: 'vue-select',
        element,
        input,
        control: element,
        detectionMethod: this.name,
        confidence: this.confidence,
        metadata: {
          isVueSelect: true,
          hasVModel: element.hasAttribute('v-model')
        }
      };
    }

    return null;
  }
}

/**
 * Angular Select detection strategy
 */
class AngularSelectStrategy implements DetectionStrategy {
  name = 'angular-select';
  priority = 40;
  confidence = 0.8;

  detect(element: HTMLElement): ComponentInfo | null {
    const hasAngularAttrs = element.hasAttribute('ng-model') || 
                           element.hasAttribute('[ngModel]') ||
                           element.className.includes('mat-select');
    
    if (hasAngularAttrs) {
      const input = element.querySelector('input') as HTMLInputElement;
      
      return {
        type: 'angular-select',
        element,
        input,
        control: element,
        detectionMethod: this.name,
        confidence: this.confidence,
        metadata: {
          isAngularSelect: true,
          isMaterialSelect: element.className.includes('mat-select')
        }
      };
    }

    return null;
  }
}

/**
 * Custom Select detection strategy
 */
class CustomSelectStrategy implements DetectionStrategy {
  name = 'custom-select';
  priority = 30;
  confidence = 0.6;

  detect(element: HTMLElement): ComponentInfo | null {
    const classNames = element.className.toLowerCase();
    
    // Exclude React Select specific classes to avoid conflicts
    if (classNames.includes('react-select') || classNames.includes('select__control')) {
      return null;
    }
    
    const hasSelectKeywords = classNames.includes('select') || 
                             classNames.includes('dropdown') ||
                             classNames.includes('picker') ||
                             classNames.includes('chooser');

    if (hasSelectKeywords && element.querySelector('input')) {
      const input = element.querySelector('input') as HTMLInputElement;
      
      return {
        type: 'custom-select',
        element,
        input,
        control: element,
        detectionMethod: this.name,
        confidence: this.confidence,
        metadata: {
          isCustomSelect: true,
          selectKeywords: classNames
        }
      };
    }

    return null;
  }
}

/**
 * Standard HTML Select detection strategy
 */
class StandardSelectStrategy implements DetectionStrategy {
  name = 'standard-select';
  priority = 10;
  confidence = 1.0;

  detect(element: HTMLElement): ComponentInfo | null {
    if (element.tagName.toLowerCase() === 'select') {
      return {
        type: 'standard-select',
        element,
        input: null,
        control: element,
        detectionMethod: this.name,
        confidence: this.confidence,
        metadata: {
          isStandardSelect: true,
          optionCount: element.querySelectorAll('option').length
        }
      };
    }

    return null;
  }
}