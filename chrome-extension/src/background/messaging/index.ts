/**
 * Message passing system exports
 */

export { MessageRouter, messageRouter } from './message-router.js';
export { StateManager, stateManager } from './state-manager.js';
export { ErrorHandler, errorHandler } from './error-handler.js';

export * from './message-types.js';

export type { AppState, StateChangeListener } from './state-manager.js';
export type { 
  ErrorType, 
  ErrorSeverity, 
  ErrorContext, 
  ExtensionError, 
  RecoveryStrategy 
} from './error-handler.js';

// Convenience error handlers
export {
  handleNetworkError,
  handleAuthError,
  handleValidationError,
  handleStorageError,
  handleSyncError,
  handleAutofillError,
  handleAIServiceError,
} from './error-handler.js';