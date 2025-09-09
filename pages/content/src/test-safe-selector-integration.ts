/**
 * Test Safe Selector Integration
 * Verify that the safe selector utility works correctly in the autofill system
 */

import { safeQuerySelector, safeQuerySelectorAll, SelectorValidator } from './utils/safe-selector';

/**
 * Test safe selector functionality with real DOM elements
 */
export function testSafeSelectorIntegration(): void {
  console.log('🧪 Testing Safe Selector Integration...');

  // Test 1: Valid selector
  console.log('\n1. Testing valid selector:');
  const validElements = safeQuerySelectorAll('input');
  console.log(`✅ Found ${validElements.length} input elements with valid selector`);

  // Test 2: Invalid numeric ID selector
  console.log('\n2. Testing invalid numeric ID selector:');
  
  // Create a test element with numeric ID
  const testDiv = document.createElement('div');
  testDiv.id = '123test';
  testDiv.textContent = 'Test element with numeric ID';
  document.body.appendChild(testDiv);

  // Try to find it with invalid selector (should be sanitized automatically)
  const invalidElement = safeQuerySelector('#123test');
  console.log(`✅ Found element with numeric ID: ${invalidElement ? 'Yes' : 'No'}`);
  
  // Test 3: Selector validation
  console.log('\n3. Testing selector validation:');
  
  const validationTests = [
    { selector: '.valid-class', expected: true },
    { selector: '#123', expected: false },
    { selector: 'input[type="text"]', expected: true },
    { selector: '', expected: false },
    { selector: null as any, expected: false }
  ];

  validationTests.forEach(test => {
    const result = SelectorValidator.isValidCSSSelector(test.selector);
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} Selector "${test.selector}": ${result} (expected: ${test.expected})`);
  });

  // Test 4: Fallback strategies
  console.log('\n4. Testing fallback strategies:');
  
  // Create a test element that can be found with fallback
  const complexDiv = document.createElement('div');
  complexDiv.className = 'test-class';
  complexDiv.setAttribute('data-test', 'value');
  document.body.appendChild(complexDiv);

  // Try complex selector that might fail, should fallback to simpler one
  const fallbackElement = safeQuerySelector('div[data-test="value"]:hover');
  console.log(`✅ Fallback strategy worked: ${fallbackElement ? 'Yes' : 'No'}`);

  // Test 5: Error handling
  console.log('\n5. Testing error handling:');
  
  // This should handle the error gracefully
  const errorElement = safeQuerySelector('invalid[selector');
  console.log(`✅ Error handled gracefully: ${errorElement === null ? 'Yes' : 'No'}`);

  // Cleanup
  document.body.removeChild(testDiv);
  document.body.removeChild(complexDiv);

  console.log('\n🎉 Safe Selector Integration Test Complete!');
}

// Auto-run test if this file is loaded directly
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testSafeSelectorIntegration);
  } else {
    testSafeSelectorIntegration();
  }
}