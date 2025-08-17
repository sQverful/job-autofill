/**
 * Content Script System
 * Main entry point for content script injection and management
 */

export { ContentScriptManager, contentScriptManager } from './content-script-manager.js';
export { CommunicationBridge, communicationBridge } from './communication-bridge.js';

export type {
  ContentScriptConfig,
  InjectedScript,
} from './content-script-manager.js';

export type {
  ContentScriptMessage,
  BackgroundToContentMessage,
} from './communication-bridge.js';

/**
 * Initialize the content script system
 */
export async function initializeContentScriptSystem(): Promise<void> {
  console.log('Initializing content script system...');

  try {
    // Initialize communication bridge first
    await communicationBridge.initialize();

    // Initialize content script manager
    await contentScriptManager.initialize();

    console.log('Content script system initialized successfully');

  } catch (error: any) {
    console.error('Failed to initialize content script system:', error);
    throw error;
  }
}

/**
 * Destroy the content script system
 */
export function destroyContentScriptSystem(): void {
  console.log('Destroying content script system...');

  try {
    contentScriptManager.destroy();
    communicationBridge.destroy();

    console.log('Content script system destroyed');

  } catch (error: any) {
    console.error('Error destroying content script system:', error);
  }
}

/**
 * Get content script system statistics
 */
export function getContentScriptSystemStats(): {
  manager: ReturnType<typeof contentScriptManager.getStats>;
  bridge: ReturnType<typeof communicationBridge.getStats>;
} {
  return {
    manager: contentScriptManager.getStats(),
    bridge: communicationBridge.getStats(),
  };
}