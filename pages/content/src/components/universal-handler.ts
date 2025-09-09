/**
 * Universal Component Handler
 * Handles interaction with various UI framework components
 */

export interface ComponentHandler {
  name: string;
  canHandle(element: HTMLElement): boolean;
  fill(element: HTMLElement, value: string): Promise<boolean>;
  clear(element: HTMLElement): Promise<boolean>;
  getValue(element: HTMLElement): Promise<string | null>;
}

export interface ComponentDetectionResult {
  type: 'react-select' | 'vue-select' | 'angular-material' | 'custom' | 'standard';
  element: HTMLElement;
  confidence: number;
  interactionMethod: 'click' | 'type' | 'simulate' | 'api';
  metadata: {
    framework: string;
    version?: string;
    library?: string;
    customProps?: Record<string, any>;
  };
}

/**
 * Universal component handler that detects and interacts with various UI components
 */
export class UniversalComponentHandler {
  private handlers: ComponentHandler[] = [];

  constructor() {
    this.initializeHandlers();
  }

  /**
   * Initialize all component handlers
   */
  private initializeHandlers(): void {
    this.handlers = [
      new ReactSelectHandler(),
      new VueSelectHandler(),
      new AngularMaterialHandler(),
      new CustomDropdownHandler(),
      new StandardInputHandler()
    ];
  }

  /**
   * Detect component type and return appropriate handler
   */
  async detectComponent(element: HTMLElement): Promise<ComponentDetectionResult | null> {
    for (const handler of this.handlers) {
      if (handler.canHandle(element)) {
        return {
          type: this.getComponentType(handler),
          element,
          confidence: this.calculateConfidence(handler, element),
          interactionMethod: this.getInteractionMethod(handler),
          metadata: await this.getComponentMetadata(handler, element)
        };
      }
    }

    return null;
  }

  /**
   * Fill component with value using appropriate handler
   */
  async fillComponent(element: HTMLElement, value: string): Promise<boolean> {
    const detection = await this.detectComponent(element);
    if (!detection) return false;

    const handler = this.getHandlerByType(detection.type);
    if (!handler) return false;

    return await handler.fill(element, value);
  }

  /**
   * Clear component using appropriate handler
   */
  async clearComponent(element: HTMLElement): Promise<boolean> {
    const detection = await this.detectComponent(element);
    if (!detection) return false;

    const handler = this.getHandlerByType(detection.type);
    if (!handler) return false;

    return await handler.clear(element);
  }

  /**
   * Get component value using appropriate handler
   */
  async getComponentValue(element: HTMLElement): Promise<string | null> {
    const detection = await this.detectComponent(element);
    if (!detection) return null;

    const handler = this.getHandlerByType(detection.type);
    if (!handler) return null;

    return await handler.getValue(element);
  }

  private getComponentType(handler: ComponentHandler): ComponentDetectionResult['type'] {
    if (handler instanceof ReactSelectHandler) return 'react-select';
    if (handler instanceof VueSelectHandler) return 'vue-select';
    if (handler instanceof AngularMaterialHandler) return 'angular-material';
    if (handler instanceof CustomDropdownHandler) return 'custom';
    return 'standard';
  }

  private calculateConfidence(handler: ComponentHandler, element: HTMLElement): number {
    // Base confidence based on handler type
    let confidence = 0.5;

    if (handler instanceof ReactSelectHandler) {
      confidence = this.calculateReactSelectConfidence(element);
    } else if (handler instanceof VueSelectHandler) {
      confidence = this.calculateVueSelectConfidence(element);
    } else if (handler instanceof AngularMaterialHandler) {
      confidence = this.calculateAngularConfidence(element);
    } else if (handler instanceof CustomDropdownHandler) {
      confidence = this.calculateCustomDropdownConfidence(element);
    }

    return Math.min(confidence, 1.0);
  }

  private calculateReactSelectConfidence(element: HTMLElement): number {
    let score = 0;

    // Check for React Select specific classes
    const reactSelectClasses = [
      'react-select__control',
      'react-select__input',
      'react-select__value-container',
      'Select-control',
      'select__control'
    ];

    for (const className of reactSelectClasses) {
      if (element.classList.contains(className) || 
          element.querySelector(`.${className}`)) {
        score += 0.3;
      }
    }

    // Check for React fiber
    if ((element as any)._reactInternalFiber || (element as any).__reactInternalInstance) {
      score += 0.2;
    }

    // Check for typical React Select structure
    if (element.querySelector('input[role="combobox"]')) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private calculateVueSelectConfidence(element: HTMLElement): number {
    let score = 0;

    // Check for Vue Select classes
    const vueClasses = ['v-select', 'v-input', 'v-text-field', 'el-select', 'el-input'];
    for (const className of vueClasses) {
      if (element.classList.contains(className)) {
        score += 0.3;
      }
    }

    // Check for Vue instance
    if ((element as any).__vue__) {
      score += 0.4;
    }

    return Math.min(score, 1.0);
  }

  private calculateAngularConfidence(element: HTMLElement): number {
    let score = 0;

    // Check for Angular Material classes
    const angularClasses = ['mat-form-field', 'mat-select', 'mat-input-element'];
    for (const className of angularClasses) {
      if (element.classList.contains(className) || element.closest(`.${className}`)) {
        score += 0.3;
      }
    }

    // Check for Angular attributes
    if (element.hasAttribute('ng-reflect-') || element.hasAttribute('_ngcontent-')) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private calculateCustomDropdownConfidence(element: HTMLElement): number {
    let score = 0;

    // Check for custom dropdown patterns
    const customPatterns = ['dropdown', 'select', 'picker', 'chooser'];
    const className = element.className.toLowerCase();
    
    for (const pattern of customPatterns) {
      if (className.includes(pattern)) {
        score += 0.2;
      }
    }

    // Check for dropdown-like structure
    if (element.querySelector('[role="listbox"], [role="menu"], .options, .dropdown-menu')) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  private getInteractionMethod(handler: ComponentHandler): ComponentDetectionResult['interactionMethod'] {
    if (handler instanceof ReactSelectHandler) return 'simulate';
    if (handler instanceof VueSelectHandler) return 'simulate';
    if (handler instanceof AngularMaterialHandler) return 'simulate';
    if (handler instanceof CustomDropdownHandler) return 'click';
    return 'type';
  }

  private async getComponentMetadata(handler: ComponentHandler, element: HTMLElement): Promise<ComponentDetectionResult['metadata']> {
    const metadata: ComponentDetectionResult['metadata'] = {
      framework: 'unknown'
    };

    if (handler instanceof ReactSelectHandler) {
      metadata.framework = 'react';
      metadata.library = 'react-select';
      // Try to detect React Select version
      const reactSelectElement = element.closest('[class*="react-select"]');
      if (reactSelectElement) {
        metadata.version = this.detectReactSelectVersion(reactSelectElement as HTMLElement);
      }
    } else if (handler instanceof VueSelectHandler) {
      metadata.framework = 'vue';
      if (element.classList.contains('v-select')) {
        metadata.library = 'vuetify';
      } else if (element.classList.contains('el-select')) {
        metadata.library = 'element-ui';
      }
    } else if (handler instanceof AngularMaterialHandler) {
      metadata.framework = 'angular';
      metadata.library = 'angular-material';
    }

    return metadata;
  }

  private detectReactSelectVersion(element: HTMLElement): string | undefined {
    // Try to detect React Select version from class names or other indicators
    const classes = element.className;
    if (classes.includes('react-select__')) {
      return '3.x+'; // Modern React Select uses BEM naming
    } else if (classes.includes('Select-')) {
      return '1.x-2.x'; // Older versions used different naming
    }
    return undefined;
  }

  private getHandlerByType(type: ComponentDetectionResult['type']): ComponentHandler | null {
    return this.handlers.find(handler => {
      if (type === 'react-select' && handler instanceof ReactSelectHandler) return true;
      if (type === 'vue-select' && handler instanceof VueSelectHandler) return true;
      if (type === 'angular-material' && handler instanceof AngularMaterialHandler) return true;
      if (type === 'custom' && handler instanceof CustomDropdownHandler) return true;
      if (type === 'standard' && handler instanceof StandardInputHandler) return true;
      return false;
    }) || null;
  }
}

/**
 * React Select component handler
 */
export class ReactSelectHandler implements ComponentHandler {
  name = 'React Select Handler';

  canHandle(element: HTMLElement): boolean {
    // Check for React Select specific patterns
    const reactSelectPatterns = [
      '.react-select__control',
      '[class*="react-select"]',
      '[class*="Select-control"]',
      '.select__control',
      '.select-shell'
    ];

    for (const pattern of reactSelectPatterns) {
      if (element.matches(pattern) || element.querySelector(pattern)) {
        return true;
      }
    }

    // Check for React Select input with combobox role
    const input = element.querySelector('input[role="combobox"]');
    if (input && element.classList.toString().includes('select')) {
      return true;
    }

    return false;
  }

  async fill(element: HTMLElement, value: string): Promise<boolean> {
    try {
      // Multiple strategies for React Select interaction
      const strategies = [
        () => this.fillByDirectInput(element, value),
        () => this.fillByClickAndType(element, value),
        () => this.fillBySimulateEvents(element, value),
        () => this.fillByReactProps(element, value)
      ];

      for (const strategy of strategies) {
        try {
          if (await strategy()) {
            return true;
          }
        } catch (error) {
          console.warn('React Select fill strategy failed:', error);
        }
      }

      return false;
    } catch (error) {
      console.error('React Select fill failed:', error);
      return false;
    }
  }

  private async fillByDirectInput(element: HTMLElement, value: string): Promise<boolean> {
    const input = this.findReactSelectInput(element);
    if (!input) return false;

    // Focus and clear existing value
    input.focus();
    input.value = '';
    
    // Type the value
    input.value = value;
    
    // Trigger events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Wait for dropdown to appear
    await this.waitForDropdown(element);
    
    // Try to select matching option
    return await this.selectMatchingOption(element, value);
  }

  private async fillByClickAndType(element: HTMLElement, value: string): Promise<boolean> {
    // Click the control to open dropdown
    const control = element.querySelector('.react-select__control, .Select-control, .select__control') as HTMLElement;
    if (!control) return false;

    control.click();
    await this.waitForDropdown(element);

    // Find and focus input
    const input = this.findReactSelectInput(element);
    if (!input) return false;

    input.focus();
    
    // Clear and type value
    input.value = '';
    for (const char of value) {
      input.value += char;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await this.sleep(10); // Small delay between characters
    }

    await this.waitForOptions(element);
    return await this.selectMatchingOption(element, value);
  }

  private async fillBySimulateEvents(element: HTMLElement, value: string): Promise<boolean> {
    const input = this.findReactSelectInput(element);
    if (!input) return false;

    // Simulate user interaction
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    input.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    
    // Clear existing value
    input.value = '';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    
    // Type new value
    for (const char of value) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      input.value += char;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    input.dispatchEvent(new KeyboardEvent('keyup', { key: value[value.length - 1], bubbles: true }));
    
    await this.waitForOptions(element);
    return await this.selectMatchingOption(element, value);
  }

  private async fillByReactProps(element: HTMLElement, value: string): Promise<boolean> {
    // Try to access React props directly (advanced method)
    const reactFiber = (element as any)._reactInternalFiber || (element as any).__reactInternalInstance;
    if (!reactFiber) return false;

    try {
      // This is a more advanced technique that tries to call React Select methods directly
      // Note: This may not work with all React Select versions
      const selectInstance = this.findReactSelectInstance(reactFiber);
      if (selectInstance && selectInstance.selectOption) {
        // Try to find option by value
        const options = selectInstance.props?.options || [];
        const matchingOption = options.find((opt: any) => 
          opt.label?.toLowerCase().includes(value.toLowerCase()) ||
          opt.value?.toLowerCase().includes(value.toLowerCase())
        );
        
        if (matchingOption) {
          selectInstance.selectOption(matchingOption);
          return true;
        }
      }
    } catch (error) {
      console.warn('React props method failed:', error);
    }

    return false;
  }

  private findReactSelectInput(element: HTMLElement): HTMLInputElement | null {
    const selectors = [
      'input[role="combobox"]',
      '.react-select__input input',
      '.Select-input input',
      '.select__input input',
      'input[class*="input"]'
    ];

    for (const selector of selectors) {
      const input = element.querySelector(selector) as HTMLInputElement;
      if (input) return input;
    }

    return null;
  }

  private async waitForDropdown(element: HTMLElement, timeout = 1000): Promise<boolean> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const dropdown = document.querySelector([
        '.react-select__menu',
        '.Select-menu',
        '.select__menu',
        '[role="listbox"]'
      ].join(', '));
      
      if (dropdown) return true;
      await this.sleep(50);
    }
    
    return false;
  }

  private async waitForOptions(element: HTMLElement, timeout = 1000): Promise<boolean> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const options = document.querySelectorAll([
        '.react-select__option',
        '.Select-option',
        '.select__option',
        '[role="option"]'
      ].join(', '));
      
      if (options.length > 0) return true;
      await this.sleep(50);
    }
    
    return false;
  }

  private async selectMatchingOption(element: HTMLElement, value: string): Promise<boolean> {
    const optionSelectors = [
      '.react-select__option',
      '.Select-option',
      '.select__option',
      '[role="option"]'
    ];

    for (const selector of optionSelectors) {
      const options = document.querySelectorAll(selector);
      
      for (const option of options) {
        const optionText = option.textContent?.trim().toLowerCase() || '';
        const valueLower = value.toLowerCase();
        
        if (optionText.includes(valueLower) || 
            this.fuzzyMatch(optionText, valueLower)) {
          (option as HTMLElement).click();
          await this.sleep(100);
          return true;
        }
      }
    }

    // If no exact match, try the first option
    const firstOption = document.querySelector(optionSelectors.join(', ')) as HTMLElement;
    if (firstOption) {
      firstOption.click();
      return true;
    }

    return false;
  }

  private fuzzyMatch(text: string, value: string): boolean {
    // Simple fuzzy matching
    const textWords = text.split(/\s+/);
    const valueWords = value.split(/\s+/);
    
    return valueWords.every(valueWord => 
      textWords.some(textWord => 
        textWord.includes(valueWord) || valueWord.includes(textWord)
      )
    );
  }

  private findReactSelectInstance(fiber: any): any {
    // Traverse React fiber tree to find Select instance
    let current = fiber;
    while (current) {
      if (current.type && current.type.name === 'Select') {
        return current.stateNode;
      }
      current = current.child || current.sibling || current.return;
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clear(element: HTMLElement): Promise<boolean> {
    try {
      // Find clear button
      const clearButton = element.querySelector([
        '.react-select__clear-indicator',
        '.Select-clear',
        '.select__clear'
      ].join(', ')) as HTMLElement;

      if (clearButton) {
        clearButton.click();
        return true;
      }

      // Fallback: clear input directly
      const input = this.findReactSelectInput(element);
      if (input) {
        input.focus();
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }

      return false;
    } catch (error) {
      console.error('React Select clear failed:', error);
      return false;
    }
  }

  async getValue(element: HTMLElement): Promise<string | null> {
    try {
      // Try to get value from selected option display
      const valueContainer = element.querySelector([
        '.react-select__single-value',
        '.Select-value-label',
        '.select__single-value'
      ].join(', '));

      if (valueContainer?.textContent) {
        return valueContainer.textContent.trim();
      }

      // Fallback: get from input
      const input = this.findReactSelectInput(element);
      if (input?.value) {
        return input.value;
      }

      return null;
    } catch (error) {
      console.error('React Select getValue failed:', error);
      return null;
    }
  }
}

/**
 * Vue Select component handler
 */
export class VueSelectHandler implements ComponentHandler {
  name = 'Vue Select Handler';

  canHandle(element: HTMLElement): boolean {
    const vuePatterns = [
      '.v-select',
      '.v-input',
      '.v-text-field',
      '.el-select',
      '.el-input',
      '[class*="v-"]'
    ];

    return vuePatterns.some(pattern => 
      element.matches(pattern) || element.querySelector(pattern)
    );
  }

  async fill(element: HTMLElement, value: string): Promise<boolean> {
    try {
      // Vue component interaction strategies
      const strategies = [
        () => this.fillVuetifySelect(element, value),
        () => this.fillElementUISelect(element, value),
        () => this.fillGenericVueInput(element, value)
      ];

      for (const strategy of strategies) {
        try {
          if (await strategy()) {
            return true;
          }
        } catch (error) {
          console.warn('Vue select strategy failed:', error);
        }
      }

      return false;
    } catch (error) {
      console.error('Vue select fill failed:', error);
      return false;
    }
  }

  private async fillVuetifySelect(element: HTMLElement, value: string): Promise<boolean> {
    // Vuetify v-select handling
    if (!element.classList.contains('v-select') && !element.querySelector('.v-select')) {
      return false;
    }

    const input = element.querySelector('input') as HTMLInputElement;
    if (!input) return false;

    // Click to open dropdown
    const selectSlot = element.querySelector('.v-select__slot') as HTMLElement;
    if (selectSlot) {
      selectSlot.click();
    } else {
      input.click();
    }

    await this.sleep(200);

    // Type value to filter
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await this.sleep(300);

    // Select matching option
    const options = document.querySelectorAll('.v-list-item, .v-select-list .v-list__tile');
    for (const option of options) {
      const optionText = option.textContent?.trim().toLowerCase() || '';
      if (optionText.includes(value.toLowerCase())) {
        (option as HTMLElement).click();
        return true;
      }
    }

    return false;
  }

  private async fillElementUISelect(element: HTMLElement, value: string): Promise<boolean> {
    // Element UI el-select handling
    if (!element.classList.contains('el-select') && !element.querySelector('.el-select')) {
      return false;
    }

    const input = element.querySelector('.el-input__inner') as HTMLInputElement;
    if (!input) return false;

    // Click to open dropdown
    input.click();
    await this.sleep(200);

    // Type to filter if it's a filterable select
    if (element.classList.contains('is-filterable')) {
      input.focus();
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await this.sleep(300);
    }

    // Select matching option
    const options = document.querySelectorAll('.el-select-dropdown__item');
    for (const option of options) {
      const optionText = option.textContent?.trim().toLowerCase() || '';
      if (optionText.includes(value.toLowerCase())) {
        (option as HTMLElement).click();
        return true;
      }
    }

    return false;
  }

  private async fillGenericVueInput(element: HTMLElement, value: string): Promise<boolean> {
    const input = element.querySelector('input, textarea') as HTMLInputElement;
    if (!input) return false;

    input.focus();
    input.value = value;
    
    // Trigger Vue events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clear(element: HTMLElement): Promise<boolean> {
    const input = element.querySelector('input, textarea') as HTMLInputElement;
    if (!input) return false;

    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    return true;
  }

  async getValue(element: HTMLElement): Promise<string | null> {
    const input = element.querySelector('input, textarea') as HTMLInputElement;
    return input?.value || null;
  }
}

/**
 * Angular Material component handler
 */
export class AngularMaterialHandler implements ComponentHandler {
  name = 'Angular Material Handler';

  canHandle(element: HTMLElement): boolean {
    const angularPatterns = [
      'mat-form-field',
      'mat-select',
      'mat-input-container',
      '.mat-input-element',
      '.mat-select-trigger'
    ];

    return angularPatterns.some(pattern => 
      element.matches(pattern) || element.querySelector(pattern) || element.closest(pattern)
    );
  }

  async fill(element: HTMLElement, value: string): Promise<boolean> {
    try {
      // Angular Material interaction strategies
      if (await this.fillMatSelect(element, value)) return true;
      if (await this.fillMatInput(element, value)) return true;
      
      return false;
    } catch (error) {
      console.error('Angular Material fill failed:', error);
      return false;
    }
  }

  private async fillMatSelect(element: HTMLElement, value: string): Promise<boolean> {
    const matSelect = element.querySelector('mat-select') || element.closest('mat-select');
    if (!matSelect) return false;

    // Click to open select
    (matSelect as HTMLElement).click();
    await this.sleep(200);

    // Find and click matching option
    const options = document.querySelectorAll('mat-option');
    for (const option of options) {
      const optionText = option.textContent?.trim().toLowerCase() || '';
      if (optionText.includes(value.toLowerCase())) {
        (option as HTMLElement).click();
        return true;
      }
    }

    return false;
  }

  private async fillMatInput(element: HTMLElement, value: string): Promise<boolean> {
    const input = element.querySelector('.mat-input-element, input, textarea') as HTMLInputElement;
    if (!input) return false;

    input.focus();
    input.value = value;
    
    // Trigger Angular events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clear(element: HTMLElement): Promise<boolean> {
    const input = element.querySelector('.mat-input-element, input, textarea') as HTMLInputElement;
    if (!input) return false;

    input.focus();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    
    return true;
  }

  async getValue(element: HTMLElement): Promise<string | null> {
    const input = element.querySelector('.mat-input-element, input, textarea') as HTMLInputElement;
    return input?.value || null;
  }
}

/**
 * Custom dropdown component handler
 */
export class CustomDropdownHandler implements ComponentHandler {
  name = 'Custom Dropdown Handler';

  canHandle(element: HTMLElement): boolean {
    const customPatterns = [
      'dropdown',
      'select',
      'picker',
      'chooser',
      'combobox'
    ];

    const className = element.className.toLowerCase();
    return customPatterns.some(pattern => className.includes(pattern)) ||
           element.hasAttribute('role') && element.getAttribute('role') === 'combobox';
  }

  async fill(element: HTMLElement, value: string): Promise<boolean> {
    try {
      // Try different custom dropdown interaction methods
      if (await this.fillByClick(element, value)) return true;
      if (await this.fillByInput(element, value)) return true;
      
      return false;
    } catch (error) {
      console.error('Custom dropdown fill failed:', error);
      return false;
    }
  }

  private async fillByClick(element: HTMLElement, value: string): Promise<boolean> {
    // Click to open dropdown
    element.click();
    await this.sleep(200);

    // Look for options in various containers
    const optionContainers = [
      '.dropdown-menu',
      '.options',
      '.choices',
      '[role="listbox"]',
      '[role="menu"]'
    ];

    for (const containerSelector of optionContainers) {
      const container = document.querySelector(containerSelector);
      if (!container) continue;

      const options = container.querySelectorAll('li, div, span, [role="option"]');
      for (const option of options) {
        const optionText = option.textContent?.trim().toLowerCase() || '';
        if (optionText.includes(value.toLowerCase())) {
          (option as HTMLElement).click();
          return true;
        }
      }
    }

    return false;
  }

  private async fillByInput(element: HTMLElement, value: string): Promise<boolean> {
    const input = element.querySelector('input') as HTMLInputElement;
    if (!input) return false;

    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async clear(element: HTMLElement): Promise<boolean> {
    const input = element.querySelector('input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  async getValue(element: HTMLElement): Promise<string | null> {
    const input = element.querySelector('input') as HTMLInputElement;
    if (input) return input.value;

    const selectedOption = element.querySelector('.selected, .active, [aria-selected="true"]');
    return selectedOption?.textContent?.trim() || null;
  }
}

/**
 * Standard input handler (fallback)
 */
export class StandardInputHandler implements ComponentHandler {
  name = 'Standard Input Handler';

  canHandle(element: HTMLElement): boolean {
    return element.tagName === 'INPUT' || 
           element.tagName === 'TEXTAREA' || 
           element.tagName === 'SELECT';
  }

  async fill(element: HTMLElement, value: string): Promise<boolean> {
    try {
      if (element.tagName === 'SELECT') {
        return this.fillSelect(element as HTMLSelectElement, value);
      } else {
        return this.fillInput(element as HTMLInputElement, value);
      }
    } catch (error) {
      console.error('Standard input fill failed:', error);
      return false;
    }
  }

  private fillSelect(select: HTMLSelectElement, value: string): boolean {
    const options = Array.from(select.options);
    
    // Try exact match first
    let matchingOption = options.find(option => 
      option.value.toLowerCase() === value.toLowerCase() ||
      option.textContent?.toLowerCase() === value.toLowerCase()
    );

    // Try partial match
    if (!matchingOption) {
      matchingOption = options.find(option => 
        option.value.toLowerCase().includes(value.toLowerCase()) ||
        option.textContent?.toLowerCase().includes(value.toLowerCase())
      );
    }

    if (matchingOption) {
      select.value = matchingOption.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    return false;
  }

  private fillInput(input: HTMLInputElement, value: string): boolean {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async clear(element: HTMLElement): Promise<boolean> {
    try {
      const input = element as HTMLInputElement;
      input.focus();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (error) {
      console.error('Standard input clear failed:', error);
      return false;
    }
  }

  async getValue(element: HTMLElement): Promise<string | null> {
    const input = element as HTMLInputElement;
    return input.value || null;
  }
}