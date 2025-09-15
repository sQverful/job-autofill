/**
 * Debug script to check button state issues
 */

import { aiSettingsStorage } from '@extension/storage';

export async function debugButtonState() {
  console.log('[Debug] Checking button state...');
  
  try {
    // Check AI settings storage
    const settings = await aiSettingsStorage.get();
    const hasToken = await aiSettingsStorage.hasToken();
    
    console.log('[Debug] AI Settings:', {
      enabled: settings.enabled,
      hasApiToken: !!settings.apiToken,
      hasValidToken: hasToken,
      model: settings.model
    });

    // Check if unified button manager exists
    const manager = (window as any).unifiedAutofillButtonManager;
    if (manager) {
      console.log('[Debug] Unified Button Manager found');
      console.log('[Debug] Button Manager State:', {
        isAIModeEnabled: manager.isAIModeEnabled,
        hasValidToken: manager.hasValidToken,
        formsDetected: manager.formsDetected,
        buttonsVisible: manager.buttonsVisible
      });
    } else {
      console.log('[Debug] Unified Button Manager NOT found');
    }

    // Check for existing buttons
    const traditionalButtons = document.querySelectorAll('.unified-autofill-traditional-button');
    const aiButtons = document.querySelectorAll('.unified-autofill-ai-button');
    const otherButtons = document.querySelectorAll('[class*="autofill"], [class*="button"]');
    
    console.log('[Debug] Button Count:', {
      traditional: traditionalButtons.length,
      ai: aiButtons.length,
      other: otherButtons.length
    });

    // Check forms
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea');
    
    console.log('[Debug] Form Detection:', {
      forms: forms.length,
      inputs: inputs.length,
      url: window.location.href
    });

  } catch (error) {
    console.error('[Debug] Error checking button state:', error);
  }
}

// Make available globally for debugging
(window as any).debugButtonState = debugButtonState;