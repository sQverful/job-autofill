/**
 * Message types for communication between extension components
 */

import type { UserProfile } from '@extension/shared';
import type { SyncState } from '../api/sync-manager.js';

// Base message interface
export interface BaseMessage {
  id: string;
  type: string;
  timestamp: number;
  source: 'popup' | 'options' | 'content' | 'background' | 'side-panel';
  target?: 'popup' | 'options' | 'content' | 'background' | 'side-panel';
}

// Response message interface
export interface ResponseMessage<T = any> extends BaseMessage {
  type: 'response';
  requestId: string;
  success: boolean;
  data?: T;
  error?: string;
}

// Profile-related messages
export interface GetProfileMessage extends BaseMessage {
  type: 'profile:get';
}

export interface UpdateProfileMessage extends BaseMessage {
  type: 'profile:update';
  data: Partial<UserProfile>;
}

export interface ProfileUpdatedMessage extends BaseMessage {
  type: 'profile:updated';
  data: UserProfile;
}

// Authentication messages
export interface LoginMessage extends BaseMessage {
  type: 'auth:login';
  data: {
    email: string;
    password: string;
  };
}

export interface LogoutMessage extends BaseMessage {
  type: 'auth:logout';
}

export interface AuthStatusMessage extends BaseMessage {
  type: 'auth:status';
  data: {
    isAuthenticated: boolean;
    user?: {
      id: string;
      email: string;
    };
  };
}

// Sync-related messages
export interface SyncTriggerMessage extends BaseMessage {
  type: 'sync:trigger';
  data?: {
    force?: boolean;
  };
}

export interface SyncStatusMessage extends BaseMessage {
  type: 'sync:status';
  data: SyncState;
}

// Autofill-related messages
export interface AutofillTriggerMessage extends BaseMessage {
  type: 'autofill:trigger';
  data: {
    tabId: number;
    fields?: string[];
  };
}

export interface AutofillStatusMessage extends BaseMessage {
  type: 'autofill:status';
  data: {
    tabId: number;
    status: 'idle' | 'detecting' | 'filling' | 'complete' | 'error';
    progress?: number;
    error?: string;
  };
}

export interface FormDetectedMessage extends BaseMessage {
  type: 'form:detected';
  data: {
    tabId: number;
    platform: string;
    formId: string;
    fieldCount: number;
    confidence: number;
  };
}

// AI content messages
export interface AIContentRequestMessage extends BaseMessage {
  type: 'ai:generate';
  data: {
    type: 'cover_letter' | 'question_response' | 'summary';
    context: any;
    preferences: any;
  };
}

export interface AIContentResponseMessage extends BaseMessage {
  type: 'ai:generated';
  data: {
    content: string;
    confidence: number;
    requestId: string;
  };
}

// Document messages
export interface UploadDocumentMessage extends BaseMessage {
  type: 'document:upload';
  data: {
    file: File;
    type: 'resume' | 'cover_letter';
  };
}

export interface DocumentUploadedMessage extends BaseMessage {
  type: 'document:uploaded';
  data: {
    id: string;
    name: string;
    url: string;
    type: 'resume' | 'cover_letter';
  };
}

// Error messages
export interface ErrorMessage extends BaseMessage {
  type: 'error';
  data: {
    code: string;
    message: string;
    details?: any;
  };
}

// Settings messages
export interface GetSettingsMessage extends BaseMessage {
  type: 'settings:get';
}

export interface UpdateSettingsMessage extends BaseMessage {
  type: 'settings:update';
  data: Record<string, any>;
}

// Tab-related messages
export interface TabActivatedMessage extends BaseMessage {
  type: 'tab:activated';
  data: {
    tabId: number;
    url: string;
  };
}

export interface TabUpdatedMessage extends BaseMessage {
  type: 'tab:updated';
  data: {
    tabId: number;
    url: string;
    status: string;
  };
}

// Form check messages
export interface FormCheckMessage extends BaseMessage {
  type: 'form:check';
  data: {
    tabId: number;
  };
}

export interface FormCheckResponseMessage extends BaseMessage {
  type: 'form:check:response';
  data: {
    detected: boolean;
    platform?: string;
    fieldCount?: number;
    confidence?: number;
  };
}

// Activity messages
export interface ActivityRecentMessage extends BaseMessage {
  type: 'activity:recent';
}

export interface ActivityRecentResponseMessage extends BaseMessage {
  type: 'activity:recent:response';
  data: {
    actions: Array<{
      id: string;
      type: string;
      timestamp: Date;
      description: string;
      success: boolean;
      details?: string;
    }>;
  };
}

// Retry messages
export interface AutofillRetryMessage extends BaseMessage {
  type: 'autofill:retry';
}

// Union type of all possible messages
export type ExtensionMessage = 
  | GetProfileMessage
  | UpdateProfileMessage
  | ProfileUpdatedMessage
  | LoginMessage
  | LogoutMessage
  | AuthStatusMessage
  | SyncTriggerMessage
  | SyncStatusMessage
  | AutofillTriggerMessage
  | AutofillStatusMessage
  | FormDetectedMessage
  | AIContentRequestMessage
  | AIContentResponseMessage
  | UploadDocumentMessage
  | DocumentUploadedMessage
  | ErrorMessage
  | GetSettingsMessage
  | UpdateSettingsMessage
  | TabActivatedMessage
  | TabUpdatedMessage
  | FormCheckMessage
  | FormCheckResponseMessage
  | ActivityRecentMessage
  | ActivityRecentResponseMessage
  | AutofillRetryMessage
  | ResponseMessage;

// Message handler type
export type MessageHandler<T extends ExtensionMessage = ExtensionMessage> = (
  message: T,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) => boolean | void | Promise<any>;

// Event listener type
export type EventListener<T = any> = (data: T) => void;

// Message validation
export function isValidMessage(obj: any): obj is ExtensionMessage {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.source === 'string'
  );
}

// Message factory functions
export function createMessage<T extends Omit<ExtensionMessage, 'id' | 'timestamp'>>(
  message: T
): T & { id: string; timestamp: number } {
  return {
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };
}

export function createResponse<T = any>(
  requestMessage: ExtensionMessage,
  success: boolean,
  data?: T,
  error?: string
): ResponseMessage<T> {
  return createMessage({
    type: 'response' as const,
    source: 'background' as const,
    target: requestMessage.source,
    requestId: requestMessage.id,
    success,
    data,
    error,
  });
}