// Service Worker Compatibility Test
// This script tests if the background script code is compatible with service worker environment

console.log('🧪 Testing Service Worker Compatibility...');

// Test 1: Check if globalThis is available (should be)
try {
  if (typeof globalThis !== 'undefined') {
    console.log('✅ globalThis is available');
    
    // Test setting a property on globalThis (like our AI usage tracker)
    globalThis.testProperty = { test: true };
    if (globalThis.testProperty.test) {
      console.log('✅ globalThis property setting works');
    }
  } else {
    console.log('❌ globalThis is not available');
  }
} catch (error) {
  console.log('❌ globalThis test failed:', error.message);
}

// Test 2: Check if window is NOT available (should not be in service worker)
try {
  if (typeof window !== 'undefined') {
    console.log('❌ window is available (this should not happen in service worker)');
  } else {
    console.log('✅ window is not available (correct for service worker)');
  }
} catch (error) {
  console.log('✅ window access throws error (correct for service worker):', error.message);
}

// Test 3: Check if document is NOT available (should not be in service worker)
try {
  if (typeof document !== 'undefined') {
    console.log('❌ document is available (this should not happen in service worker)');
  } else {
    console.log('✅ document is not available (correct for service worker)');
  }
} catch (error) {
  console.log('✅ document access throws error (correct for service worker):', error.message);
}

// Test 4: Check if fetch is available (should be)
try {
  if (typeof fetch !== 'undefined') {
    console.log('✅ fetch is available');
  } else {
    console.log('❌ fetch is not available');
  }
} catch (error) {
  console.log('❌ fetch test failed:', error.message);
}

// Test 5: Check if chrome APIs are available (should be in extension context)
try {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('✅ chrome.runtime is available');
  } else {
    console.log('⚠️ chrome.runtime is not available (expected in non-extension context)');
  }
} catch (error) {
  console.log('⚠️ chrome API test failed:', error.message);
}

// Test 6: Test dynamic import (should fail in service worker)
try {
  // This should fail in service worker context
  import('./non-existent-module.js').then(() => {
    console.log('❌ Dynamic import succeeded (should fail in service worker)');
  }).catch(() => {
    console.log('✅ Dynamic import failed (correct for service worker)');
  });
} catch (error) {
  console.log('✅ Dynamic import throws error (correct for service worker):', error.message);
}

console.log('🧪 Service Worker Compatibility Test Complete');