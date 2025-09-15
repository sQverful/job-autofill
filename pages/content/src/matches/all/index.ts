// Import autofill systems with button creation disabled
import { EnhancedAutofill } from '@src/enhanced-autofill';
import { OnDemandAutofill } from '@src/on-demand-autofill';
// DO NOT import aiAutofillUIManager - it creates duplicate buttons
// import { aiAutofillUIManager } from '@src/ai/ai-autofill-ui-manager';
import '@src/ai-autofill-integration';
import '@src/integration-verification';

// Import and initialize the unified button manager
import '@src/unified-autofill-button-manager';

// Import debug utilities
import '@src/debug-button-state';
import '@src/test-ai-token';

// Initialize autofill systems with button creation disabled
const enhancedAutofill = new EnhancedAutofill({ 
  enableButtonCreation: false,
  enableFormDetection: true 
});

const onDemandAutofill = new OnDemandAutofill({ 
  enableButtonCreation: false,
  enableFormDetection: false // Only enhanced autofill should detect forms
});

// Make autofill systems available globally for the unified manager
(window as any).enhancedAutofill = enhancedAutofill;
(window as any).onDemandAutofill = onDemandAutofill;

console.log('[Job Autofill] Enhanced autofill content script loaded - button creation disabled');
console.log('[Job Autofill] On-demand autofill loaded - button creation disabled');
console.log('[Job Autofill] AI autofill integration loaded - AI Mode available when enabled');
console.log('[Job Autofill] Unified button manager loaded - showing exactly 2 buttons when forms detected');
console.log('[Job Autofill] Integration verification loaded - checking compatibility...');
