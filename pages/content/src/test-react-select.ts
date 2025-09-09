/**
 * Test React Select Filling
 * Simple test function to verify React Select interaction works
 */

/**
 * Test React Select filling on the current page
 */
async function testReactSelectFilling() {
  console.log('🧪 Testing React Select filling...');
  
  // Find all React Select components on the page
  const reactSelects = document.querySelectorAll('.select__control, .react-select__control');
  console.log(`Found ${reactSelects.length} React Select components`);
  
  if (reactSelects.length === 0) {
    console.log('❌ No React Select components found');
    return;
  }
  
  // Test filling the first React Select with "Prefer not to say"
  const firstSelect = reactSelects[0] as HTMLElement;
  console.log('🎯 Testing first React Select component');
  
  try {
    // Click to open dropdown
    console.log('👆 Clicking React Select control...');
    firstSelect.click();
    
    // Wait for dropdown
    await delay(500);
    
    // Look for options
    const optionSelectors = [
      '.select__option',
      '.react-select__option',
      '[role="option"]'
    ];
    
    let optionsFound = false;
    
    for (const selector of optionSelectors) {
      const options = document.querySelectorAll(selector);
      console.log(`📋 Found ${options.length} options with selector: ${selector}`);
      
      if (options.length > 0) {
        optionsFound = true;
        
        // List all available options
        console.log('Available options:');
        options.forEach((option, index) => {
          console.log(`  ${index + 1}. "${option.textContent?.trim()}"`);
        });
        
        // Try to find "Prefer not to say" option
        for (const option of options) {
          const optionText = option.textContent?.toLowerCase().trim() || '';
          
          if (optionText.includes('prefer not to say') || 
              optionText.includes('prefer not') ||
              optionText.includes('not to say')) {
            console.log(`✅ Found "Prefer not to say" option: "${optionText}"`);
            console.log('👆 Clicking option...');
            (option as HTMLElement).click();
            await delay(200);
            console.log('✅ Successfully clicked option!');
            return;
          }
        }
        
        // If no "prefer not to say", click first option as test
        console.log('⚠️ No "Prefer not to say" found, clicking first option as test');
        (options[0] as HTMLElement).click();
        await delay(200);
        console.log('✅ Successfully clicked first option!');
        return;
      }
    }
    
    if (!optionsFound) {
      console.log('❌ No dropdown options appeared after clicking');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

/**
 * Test all React Select components on the page
 */
async function testAllReactSelects() {
  console.log('🧪 Testing all React Select components...');
  
  const reactSelects = document.querySelectorAll('.select__control, .react-select__control');
  console.log(`Found ${reactSelects.length} React Select components`);
  
  for (let i = 0; i < reactSelects.length; i++) {
    const select = reactSelects[i] as HTMLElement;
    console.log(`\n🎯 Testing React Select ${i + 1}/${reactSelects.length}`);
    
    // Find the label for this select
    const container = select.closest('.select, .react-select');
    const label = container?.querySelector('label')?.textContent?.trim() || `Select ${i + 1}`;
    console.log(`📝 Label: "${label}"`);
    
    try {
      // Click to open
      select.click();
      await delay(300);
      
      // Look for options
      const options = document.querySelectorAll('.select__option, .react-select__option, [role="option"]');
      
      if (options.length > 0) {
        console.log(`📋 Found ${options.length} options`);
        
        // Find "Prefer not to say" or similar
        let optionClicked = false;
        
        for (const option of options) {
          const optionText = option.textContent?.toLowerCase().trim() || '';
          
          if (optionText.includes('prefer not to say') || 
              optionText.includes('prefer not') ||
              optionText.includes('not to say')) {
            console.log(`✅ Clicking: "${optionText}"`);
            (option as HTMLElement).click();
            optionClicked = true;
            break;
          }
        }
        
        if (!optionClicked) {
          console.log('⚠️ No "Prefer not to say" found, skipping');
          // Click somewhere else to close dropdown
          document.body.click();
        }
        
        await delay(200);
        
      } else {
        console.log('❌ No options found');
        // Click somewhere else to close dropdown
        document.body.click();
        await delay(200);
      }
      
    } catch (error) {
      console.error(`❌ Error testing select ${i + 1}:`, error);
    }
  }
  
  console.log('🎉 Finished testing all React Select components');
}

/**
 * Delay utility
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test Enhanced Component Detection
 */
async function testEnhancedComponentDetection() {
  console.log('🧪 Testing Enhanced Component Detection...');
  
  try {
    // Import the ComponentDetector
    const { ComponentDetector } = await import('./detection/component-detector');
    const detector = new ComponentDetector();
    
    // Find all potential select components on the page
    const allSelects = document.querySelectorAll('select, [class*="select"], [role="combobox"], [class*="dropdown"]');
    console.log(`Found ${allSelects.length} potential select components`);
    
    for (let i = 0; i < allSelects.length; i++) {
      const element = allSelects[i] as HTMLElement;
      console.log(`\n🔍 Analyzing element ${i + 1}/${allSelects.length}`);
      console.log(`   Tag: ${element.tagName}`);
      console.log(`   Classes: ${element.className}`);
      
      const result = detector.detectComponent(element);
      
      if (result.detected && result.bestMatch) {
        console.log(`✅ Detected: ${result.bestMatch.type}`);
        console.log(`   Method: ${result.bestMatch.detectionMethod}`);
        console.log(`   Confidence: ${result.bestMatch.confidence}`);
        console.log(`   Total strategies: ${result.components.length}`);
        
        // Test isReactSelect method
        const isReactSelect = detector.isReactSelect(element);
        console.log(`   isReactSelect: ${isReactSelect}`);
        
      } else {
        console.log(`❌ No component detected`);
      }
    }
    
    console.log('\n🎉 Enhanced Component Detection test completed!');
    
  } catch (error) {
    console.error('❌ Component Detection test failed:', error);
  }
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testReactSelectFilling = testReactSelectFilling;
  (window as any).testAllReactSelects = testAllReactSelects;
  (window as any).testEnhancedComponentDetection = testEnhancedComponentDetection;
  
  console.log('🧪 React Select test functions loaded!');
  console.log('Run testReactSelectFilling() to test one select');
  console.log('Run testAllReactSelects() to test all selects');
  console.log('Run testEnhancedComponentDetection() to test component detection');
}

export { testReactSelectFilling, testAllReactSelects, testEnhancedComponentDetection };