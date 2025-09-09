/**
 * Test Multi-Strategy Interaction Pattern Implementation
 * 
 * This test verifies that the multi-strategy interaction pattern is working correctly
 * by testing the strategy chain: direct input → click events → keyboard simulation → DOM manipulation
 */

import { EnhancedAutofill } from './enhanced-autofill';

// Mock DOM elements for testing
function createMockInput(type: string = 'text'): HTMLInputElement {
  const input = document.createElement('input');
  input.type = type;
  input.id = 'test-input';
  input.name = 'test-field';
  return input;
}

function createMockTextarea(): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.id = 'test-textarea';
  textarea.name = 'test-textarea';
  return textarea;
}

function createMockSelect(): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = 'test-select';
  select.name = 'test-select';
  
  const option1 = document.createElement('option');
  option1.value = 'option1';
  option1.textContent = 'Option 1';
  
  const option2 = document.createElement('option');
  option2.value = 'option2';
  option2.textContent = 'Option 2';
  
  select.appendChild(option1);
  select.appendChild(option2);
  
  return select;
}

function createMockFormField(element: HTMLElement, type: string): any {
  return {
    id: 'test-field',
    type: type,
    label: 'Test Field',
    selector: `#${element.id}`,
    required: false,
    mappedProfileField: 'personalInfo.firstName'
  };
}

// Test the multi-strategy interaction pattern
async function testMultiStrategyInteraction() {
  console.log('🧪 Testing Multi-Strategy Interaction Pattern');
  
  // Create autofill instance
  const autofill = new (EnhancedAutofill as any)();
  
  // Test 1: Text Input Field
  console.log('\n📝 Test 1: Text Input Field');
  const textInput = createMockInput('text');
  document.body.appendChild(textInput);
  
  const textField = createMockFormField(textInput, 'text');
  
  try {
    // Access the private method for testing
    const result = await (autofill as any).fillFieldElement(textInput, textField, 'John Doe');
    console.log(`✅ Text input fill result: ${result}`);
    console.log(`📄 Input value: "${textInput.value}"`);
  } catch (error) {
    console.error('❌ Text input test failed:', error);
  }
  
  // Test 2: Textarea Field
  console.log('\n📝 Test 2: Textarea Field');
  const textarea = createMockTextarea();
  document.body.appendChild(textarea);
  
  const textareaField = createMockFormField(textarea, 'textarea');
  
  try {
    const result = await (autofill as any).fillFieldElement(textarea, textareaField, 'This is a test message for the textarea field.');
    console.log(`✅ Textarea fill result: ${result}`);
    console.log(`📄 Textarea value: "${textarea.value}"`);
  } catch (error) {
    console.error('❌ Textarea test failed:', error);
  }
  
  // Test 3: Select Field
  console.log('\n📝 Test 3: Select Field');
  const select = createMockSelect();
  document.body.appendChild(select);
  
  const selectField = createMockFormField(select, 'select');
  
  try {
    const result = await (autofill as any).fillFieldElement(select, selectField, 'Option 2');
    console.log(`✅ Select fill result: ${result}`);
    console.log(`📄 Selected value: "${select.value}"`);
  } catch (error) {
    console.error('❌ Select test failed:', error);
  }
  
  // Test 4: Checkbox Field
  console.log('\n📝 Test 4: Checkbox Field');
  const checkbox = createMockInput('checkbox');
  document.body.appendChild(checkbox);
  
  const checkboxField = createMockFormField(checkbox, 'checkbox');
  
  try {
    const result = await (autofill as any).fillFieldElement(checkbox, checkboxField, 'yes');
    console.log(`✅ Checkbox fill result: ${result}`);
    console.log(`📄 Checkbox checked: ${checkbox.checked}`);
  } catch (error) {
    console.error('❌ Checkbox test failed:', error);
  }
  
  // Test 5: Strategy Chain Verification
  console.log('\n📝 Test 5: Strategy Chain Verification');
  
  try {
    // Test that getInteractionStrategies returns the correct strategies
    const strategies = (autofill as any).getInteractionStrategies(textInput, textField, 'test');
    console.log(`✅ Strategy count: ${strategies.length}`);
    
    const expectedStrategies = [
      'Direct Input',
      'Click Events', 
      'Keyboard Simulation',
      'DOM Manipulation',
      'Standard HTML Fallback'
    ];
    
    strategies.forEach((strategy: any, index: number) => {
      const expectedName = expectedStrategies[index];
      if (strategy.name === expectedName) {
        console.log(`✅ Strategy ${index + 1}: ${strategy.name}`);
      } else {
        console.log(`❌ Strategy ${index + 1}: Expected "${expectedName}", got "${strategy.name}"`);
      }
    });
    
  } catch (error) {
    console.error('❌ Strategy chain test failed:', error);
  }
  
  // Clean up
  document.body.removeChild(textInput);
  document.body.removeChild(textarea);
  document.body.removeChild(select);
  document.body.removeChild(checkbox);
  
  console.log('\n🎉 Multi-Strategy Interaction Pattern tests completed!');
}

// Test helper methods
async function testHelperMethods() {
  console.log('\n🔧 Testing Helper Methods');
  
  const autofill = new (EnhancedAutofill as any)();
  
  // Test isComplexComponent
  const reactSelectDiv = document.createElement('div');
  reactSelectDiv.className = 'react-select__control';
  
  const isComplex = (autofill as any).isComplexComponent(reactSelectDiv);
  console.log(`✅ isComplexComponent test: ${isComplex}`);
  
  // Test isElementVisible
  const visibleDiv = document.createElement('div');
  visibleDiv.style.display = 'block';
  visibleDiv.style.width = '100px';
  visibleDiv.style.height = '50px';
  document.body.appendChild(visibleDiv);
  
  const isVisible = (autofill as any).isElementVisible(visibleDiv);
  console.log(`✅ isElementVisible test: ${isVisible}`);
  
  document.body.removeChild(visibleDiv);
}

// Run tests when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    testMultiStrategyInteraction();
    testHelperMethods();
  });
} else {
  testMultiStrategyInteraction();
  testHelperMethods();
}

export { testMultiStrategyInteraction, testHelperMethods };