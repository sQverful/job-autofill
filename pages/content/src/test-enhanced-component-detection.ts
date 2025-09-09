/**
 * Test Enhanced Component Detection System
 * Tests the adaptive patterns and confidence scoring for component detection
 */

import { ComponentDetector, ComponentInfo, DetectionResult } from './detection/component-detector';

/**
 * Test the enhanced component detection system
 */
export function testEnhancedComponentDetection(): void {
  console.log('🧪 Testing Enhanced Component Detection System...');

  const detector = new ComponentDetector();

  // Test 1: React Select with class-based detection
  testReactSelectClassDetection(detector);

  // Test 2: React Select with role-based detection
  testReactSelectRoleDetection(detector);

  // Test 3: React Select with structure-based detection
  testReactSelectStructureDetection(detector);

  // Test 4: Vue Select detection
  testVueSelectDetection(detector);

  // Test 5: Angular Select detection
  testAngularSelectDetection(detector);

  // Test 6: Custom Select detection
  testCustomSelectDetection(detector);

  // Test 7: Standard HTML Select detection
  testStandardSelectDetection(detector);

  // Test 8: Multiple strategies with confidence scoring
  testMultipleStrategiesConfidenceScoring(detector);

  // Test 9: Edge cases and error handling
  testEdgeCasesAndErrorHandling(detector);

  console.log('✅ Enhanced Component Detection System tests completed');
}

function testReactSelectClassDetection(detector: ComponentDetector): void {
  console.log('Testing React Select class-based detection...');

  // Create mock React Select element with class names
  const mockElement = document.createElement('div');
  mockElement.className = 'react-select__control select__control';
  
  const mockInput = document.createElement('input');
  mockInput.setAttribute('role', 'combobox');
  mockInput.className = 'react-select__input';
  mockElement.appendChild(mockInput);

  const result = detector.detectComponent(mockElement);
  
  console.log('Class-based detection result:', result);
  
  if (result.detected && result.bestMatch?.type === 'react-select') {
    console.log('✅ React Select class detection: PASSED');
    console.log(`   Confidence: ${result.bestMatch.confidence}`);
    console.log(`   Method: ${result.bestMatch.detectionMethod}`);
  } else {
    console.log('❌ React Select class detection: FAILED');
  }

  // Test isReactSelect method
  const isReactSelect = detector.isReactSelect(mockElement);
  console.log(`   isReactSelect result: ${isReactSelect}`);

  // Cleanup
  mockElement.remove();
}

function testReactSelectRoleDetection(detector: ComponentDetector): void {
  console.log('Testing React Select role-based detection...');

  // Create mock element with role attributes
  const mockElement = document.createElement('div');
  mockElement.setAttribute('role', 'combobox');
  mockElement.setAttribute('aria-expanded', 'false');
  mockElement.setAttribute('aria-haspopup', 'listbox');
  
  const mockInput = document.createElement('input');
  mockInput.setAttribute('role', 'combobox');
  mockElement.appendChild(mockInput);

  const result = detector.detectComponent(mockElement);
  
  console.log('Role-based detection result:', result);
  
  if (result.detected && result.bestMatch?.type === 'react-select') {
    console.log('✅ React Select role detection: PASSED');
    console.log(`   Confidence: ${result.bestMatch.confidence}`);
    console.log(`   Method: ${result.bestMatch.detectionMethod}`);
  } else {
    console.log('❌ React Select role detection: FAILED');
  }

  // Cleanup
  mockElement.remove();
}

function testReactSelectStructureDetection(detector: ComponentDetector): void {
  console.log('Testing React Select structure-based detection...');

  // Create mock element with React Select structure
  const mockElement = document.createElement('div');
  mockElement.className = 'custom-select-container';
  
  const valueContainer = document.createElement('div');
  valueContainer.className = 'select__value-container';
  mockElement.appendChild(valueContainer);
  
  const input = document.createElement('input');
  input.className = 'select__input';
  valueContainer.appendChild(input);
  
  const indicators = document.createElement('div');
  indicators.className = 'select__indicators';
  mockElement.appendChild(indicators);

  const result = detector.detectComponent(mockElement);
  
  console.log('Structure-based detection result:', result);
  
  if (result.detected && result.bestMatch?.type === 'react-select') {
    console.log('✅ React Select structure detection: PASSED');
    console.log(`   Confidence: ${result.bestMatch.confidence}`);
    console.log(`   Method: ${result.bestMatch.detectionMethod}`);
  } else {
    console.log('❌ React Select structure detection: FAILED');
  }

  // Cleanup
  mockElement.remove();
}

function testVueSelectDetection(detector: ComponentDetector): void {
  console.log('Testing Vue Select detection...');

  // Create mock Vue Select element
  const mockElement = document.createElement('div');
  mockElement.className = 'v-select vue-select';
  mockElement.setAttribute('v-model', 'selectedValue');
  
  const mockInput = document.createElement('input');
  mockElement.appendChild(mockInput);

  const result = detector.detectComponent(mockElement);
  
  console.log('Vue Select detection result:', result);
  
  if (result.detected && result.bestMatch?.type === 'vue-select') {
    console.log('✅ Vue Select detection: PASSED');
    console.log(`   Confidence: ${result.bestMatch.confidence}`);
    console.log(`   Method: ${result.bestMatch.detectionMethod}`);
  } else {
    console.log('❌ Vue Select detection: FAILED');
  }

  // Cleanup
  mockElement.remove();
}

function testAngularSelectDetection(detector: ComponentDetector): void {
  console.log('Testing Angular Select detection...');

  // Create mock Angular Select element
  const mockElement = document.createElement('div');
  mockElement.className = 'mat-select mat-form-field';
  mockElement.setAttribute('ng-model', 'selectedValue');
  
  const mockInput = document.createElement('input');
  mockElement.appendChild(mockInput);

  const result = detector.detectComponent(mockElement);
  
  console.log('Angular Select detection result:', result);
  
  if (result.detected && result.bestMatch?.type === 'angular-select') {
    console.log('✅ Angular Select detection: PASSED');
    console.log(`   Confidence: ${result.bestMatch.confidence}`);
    console.log(`   Method: ${result.bestMatch.detectionMethod}`);
  } else {
    console.log('❌ Angular Select detection: FAILED');
  }

  // Cleanup
  mockElement.remove();
}

function testCustomSelectDetection(detector: ComponentDetector): void {
  console.log('Testing Custom Select detection...');

  // Create mock custom select element
  const mockElement = document.createElement('div');
  mockElement.className = 'custom-dropdown-select';
  
  const mockInput = document.createElement('input');
  mockElement.appendChild(mockInput);

  const result = detector.detectComponent(mockElement);
  
  console.log('Custom Select detection result:', result);
  
  if (result.detected && result.bestMatch?.type === 'custom-select') {
    console.log('✅ Custom Select detection: PASSED');
    console.log(`   Confidence: ${result.bestMatch.confidence}`);
    console.log(`   Method: ${result.bestMatch.detectionMethod}`);
  } else {
    console.log('❌ Custom Select detection: FAILED');
  }

  // Cleanup
  mockElement.remove();
}

function testStandardSelectDetection(detector: ComponentDetector): void {
  console.log('Testing Standard HTML Select detection...');

  // Create mock standard select element
  const mockElement = document.createElement('select');
  
  const option1 = document.createElement('option');
  option1.value = 'option1';
  option1.textContent = 'Option 1';
  mockElement.appendChild(option1);
  
  const option2 = document.createElement('option');
  option2.value = 'option2';
  option2.textContent = 'Option 2';
  mockElement.appendChild(option2);

  const result = detector.detectComponent(mockElement);
  
  console.log('Standard Select detection result:', result);
  
  if (result.detected && result.bestMatch?.type === 'standard-select') {
    console.log('✅ Standard Select detection: PASSED');
    console.log(`   Confidence: ${result.bestMatch.confidence}`);
    console.log(`   Method: ${result.bestMatch.detectionMethod}`);
  } else {
    console.log('❌ Standard Select detection: FAILED');
  }

  // Cleanup
  mockElement.remove();
}

function testMultipleStrategiesConfidenceScoring(detector: ComponentDetector): void {
  console.log('Testing multiple strategies with confidence scoring...');

  // Create element that matches multiple strategies
  const mockElement = document.createElement('div');
  mockElement.className = 'react-select__control custom-select';
  mockElement.setAttribute('role', 'combobox');
  mockElement.setAttribute('data-testid', 'select-dropdown');
  
  const mockInput = document.createElement('input');
  mockInput.setAttribute('role', 'combobox');
  mockInput.className = 'react-select__input';
  mockElement.appendChild(mockInput);
  
  const indicators = document.createElement('div');
  indicators.className = 'select__indicators';
  mockElement.appendChild(indicators);

  const result = detector.detectComponent(mockElement);
  
  console.log('Multiple strategies detection result:', result);
  console.log(`Total components detected: ${result.components.length}`);
  console.log(`Total confidence: ${result.totalConfidence}`);
  
  if (result.bestMatch) {
    console.log(`Best match: ${result.bestMatch.type} (${result.bestMatch.detectionMethod})`);
    console.log(`Best match confidence: ${result.bestMatch.confidence}`);
  }
  
  // Log all detected components
  result.components.forEach((component, index) => {
    console.log(`   Component ${index + 1}: ${component.type} (${component.detectionMethod}) - ${component.confidence}`);
  });

  if (result.detected && result.components.length > 1) {
    console.log('✅ Multiple strategies confidence scoring: PASSED');
  } else {
    console.log('❌ Multiple strategies confidence scoring: FAILED');
  }

  // Cleanup
  mockElement.remove();
}

function testEdgeCasesAndErrorHandling(detector: ComponentDetector): void {
  console.log('Testing edge cases and error handling...');

  // Test 1: Empty element
  const emptyElement = document.createElement('div');
  const emptyResult = detector.detectComponent(emptyElement);
  console.log(`Empty element detection: ${emptyResult.detected ? 'DETECTED' : 'NOT DETECTED'}`);

  // Test 2: Element with no relevant attributes
  const plainElement = document.createElement('div');
  plainElement.textContent = 'Just a plain div';
  const plainResult = detector.detectComponent(plainElement);
  console.log(`Plain element detection: ${plainResult.detected ? 'DETECTED' : 'NOT DETECTED'}`);

  // Test 3: Null element (should be handled gracefully)
  try {
    const nullResult = detector.detectComponent(null as any);
    console.log('❌ Null element should throw error');
  } catch (error) {
    console.log('✅ Null element properly handled with error');
  }

  // Test 4: Element with conflicting signals
  const conflictingElement = document.createElement('select');
  conflictingElement.className = 'react-select__control';
  const conflictingResult = detector.detectComponent(conflictingElement);
  console.log(`Conflicting element best match: ${conflictingResult.bestMatch?.type}`);

  if (conflictingResult.bestMatch?.type === 'standard-select') {
    console.log('✅ Conflicting signals properly prioritized: PASSED');
  } else {
    console.log('❌ Conflicting signals handling: FAILED');
  }

  // Cleanup
  emptyElement.remove();
  plainElement.remove();
  conflictingElement.remove();
}

// Auto-run tests if this file is loaded directly
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testEnhancedComponentDetection);
  } else {
    testEnhancedComponentDetection();
  }
}