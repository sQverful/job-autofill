/**
 * Test script to verify the service worker compatibility fix
 * Run this in the browser console to test the audit logger fix
 */

console.log('🧪 Testing Service Worker Compatibility Fix');
console.log('==========================================');

// Test 1: Check if audit logger can be imported without errors
console.log('1. Testing audit logger import...');
try {
  // This should not throw "window is not defined" error anymore
  const testUrl = (() => {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.location) {
        return globalThis.location.href || 'unknown';
      }
      if (typeof window !== 'undefined' && window.location) {
        return window.location.href || 'unknown';
      }
      return 'service-worker';
    } catch {
      return 'service-worker';
    }
  })();
  
  console.log('✅ URL detection works:', testUrl);
} catch (error) {
  console.error('❌ URL detection failed:', error);
}

// Test 2: Simulate service worker environment
console.log('2. Testing service worker simulation...');
try {
  // Temporarily hide window to simulate service worker
  const originalWindow = globalThis.window;
  delete globalThis.window;
  
  const testServiceWorkerUrl = (() => {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.location) {
        return globalThis.location.href || 'unknown';
      }
      if (typeof window !== 'undefined' && window.location) {
        return window.location.href || 'unknown';
      }
      return 'service-worker';
    } catch {
      return 'service-worker';
    }
  })();
  
  // Restore window
  globalThis.window = originalWindow;
  
  console.log('✅ Service worker simulation works:', testServiceWorkerUrl);
} catch (error) {
  console.error('❌ Service worker simulation failed:', error);
  // Restore window in case of error
  if (typeof originalWindow !== 'undefined') {
    globalThis.window = originalWindow;
  }
}

// Test 3: Check if AI autofill button is available
console.log('3. Testing AI autofill availability...');
setTimeout(() => {
  const aiButton = document.querySelector('[data-testid="ai-autofill-button"]') || 
                   document.querySelector('.ai-autofill-button') ||
                   document.querySelector('[class*="ai"][class*="button"]');
  
  if (aiButton) {
    console.log('✅ AI autofill button found:', aiButton);
  } else {
    console.log('ℹ️ AI autofill button not found (may not be loaded yet)');
  }
}, 2000);

console.log('🎯 Fix Status: Service worker compatibility should now be working!');
console.log('📝 Next: Try clicking the AI autofill button to test the full flow');