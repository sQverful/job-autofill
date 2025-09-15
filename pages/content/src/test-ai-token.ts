/**
 * Test script to check AI token functionality
 */

import { aiSettingsStorage } from '@extension/storage';

export async function testAIToken() {
  console.log('[Test] Testing AI token functionality...');
  
  try {
    
    // Test 1: Check initial state
    console.log('[Test] Initial state:');
    const initialSettings = await aiSettingsStorage.get();
    const initialHasToken = await aiSettingsStorage.hasToken();
    console.log('Settings:', initialSettings);
    console.log('Has token:', initialHasToken);
    
    // Test 2: Set a test token
    console.log('[Test] Setting test token...');
    await aiSettingsStorage.setToken('sk-test-token-123456789');
    
    // Test 3: Check after setting token
    console.log('[Test] After setting token:');
    const afterSettings = await aiSettingsStorage.get();
    const afterHasToken = await aiSettingsStorage.hasToken();
    const retrievedToken = await aiSettingsStorage.getToken();
    console.log('Settings:', afterSettings);
    console.log('Has token:', afterHasToken);
    console.log('Retrieved token:', retrievedToken ? 'sk-***' + retrievedToken.slice(-6) : 'null');
    
    // Test 4: Enable AI mode
    console.log('[Test] Enabling AI mode...');
    await aiSettingsStorage.enableAI();
    
    // Test 5: Check final state
    console.log('[Test] Final state:');
    const finalSettings = await aiSettingsStorage.get();
    const finalEnabled = await aiSettingsStorage.isEnabled();
    console.log('Settings:', finalSettings);
    console.log('Is enabled:', finalEnabled);
    
    return {
      success: true,
      hasToken: afterHasToken,
      isEnabled: finalEnabled
    };
    
  } catch (error) {
    console.error('[Test] Error testing AI token:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Make available globally for debugging
(window as any).testAIToken = testAIToken;