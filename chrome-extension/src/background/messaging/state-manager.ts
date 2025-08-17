/**
 * State management for extension-wide data and events
 */

import type { UserProfile } from '@extension/shared';
import type { SyncState } from '../api/sync-manager.js';
import { messageRouter } from './message-router.js';
import { createMessage } from './message-types.js';

// Application state interface
export interface AppState {
  // Authentication state
  auth: {
    isAuthenticated: boolean;
    user: {
      id: string;
      email: string;
    } | null;
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    } | null;
  };

  // Profile state
  profile: {
    data: UserProfile | null;
    isLoading: boolean;
    lastUpdated: Date | null;
    hasUnsavedChanges: boolean;
  };

  // Sync state
  sync: SyncState;

  // Autofill state
  autofill: {
    activeTabId: number | null;
    status: 'idle' | 'detecting' | 'filling' | 'complete' | 'error';
    progress: number;
    lastError: string | null;
    detectedForms: Array<{
      tabId: number;
      platform: string;
      formId: string;
      fieldCount: number;
      confidence: number;
    }>;
  };

  // UI state
  ui: {
    activeView: 'popup' | 'options' | 'side-panel' | null;
    notifications: Array<{
      id: string;
      type: 'info' | 'success' | 'warning' | 'error';
      message: string;
      timestamp: Date;
      dismissed: boolean;
    }>;
    settings: {
      theme: 'light' | 'dark' | 'auto';
      notifications: boolean;
      autoSync: boolean;
      debugMode: boolean;
    };
  };

  // Extension metadata
  meta: {
    version: string;
    installDate: Date;
    lastActiveDate: Date;
    usageStats: {
      autofillCount: number;
      profileUpdates: number;
      syncCount: number;
    };
  };
}

// State change listener type
export type StateChangeListener<T = AppState> = (newState: T, previousState: T) => void;

// Default state
const DEFAULT_STATE: AppState = {
  auth: {
    isAuthenticated: false,
    user: null,
    tokens: null,
  },
  profile: {
    data: null,
    isLoading: false,
    lastUpdated: null,
    hasUnsavedChanges: false,
  },
  sync: {
    status: 'idle',
    lastSyncTime: null,
    lastError: null,
    pendingChanges: false,
  },
  autofill: {
    activeTabId: null,
    status: 'idle',
    progress: 0,
    lastError: null,
    detectedForms: [],
  },
  ui: {
    activeView: null,
    notifications: [],
    settings: {
      theme: 'auto',
      notifications: true,
      autoSync: true,
      debugMode: false,
    },
  },
  meta: {
    version: chrome.runtime.getManifest().version,
    installDate: new Date(),
    lastActiveDate: new Date(),
    usageStats: {
      autofillCount: 0,
      profileUpdates: 0,
      syncCount: 0,
    },
  },
};

/**
 * State manager for extension-wide state management
 */
export class StateManager {
  private state: AppState;
  private listeners: StateChangeListener[] = [];
  private selectorListeners = new Map<string, Array<{
    selector: (state: AppState) => any;
    listener: (value: any, previousValue: any) => void;
    lastValue: any;
  }>>();

  constructor(initialState?: Partial<AppState>) {
    this.state = { ...DEFAULT_STATE, ...initialState };
    this.setupMessageHandlers();
  }

  /**
   * Setup message handlers for state updates
   */
  private setupMessageHandlers(): void {
    // Handle authentication state changes
    messageRouter.on('auth:status', (message) => {
      this.updateState({
        auth: {
          ...this.state.auth,
          ...message.data,
        },
      });
    });

    // Handle profile updates
    messageRouter.on('profile:updated', (message) => {
      this.updateState({
        profile: {
          ...this.state.profile,
          data: message.data,
          lastUpdated: new Date(),
          hasUnsavedChanges: false,
        },
        meta: {
          ...this.state.meta,
          usageStats: {
            ...this.state.meta.usageStats,
            profileUpdates: this.state.meta.usageStats.profileUpdates + 1,
          },
        },
      });
    });

    // Handle sync status updates
    messageRouter.on('sync:status', (message) => {
      this.updateState({
        sync: message.data,
        meta: {
          ...this.state.meta,
          usageStats: {
            ...this.state.meta.usageStats,
            syncCount: message.data.status === 'idle' && message.data.lastSyncTime
              ? this.state.meta.usageStats.syncCount + 1
              : this.state.meta.usageStats.syncCount,
          },
        },
      });
    });

    // Handle autofill status updates
    messageRouter.on('autofill:status', (message) => {
      this.updateState({
        autofill: {
          ...this.state.autofill,
          activeTabId: message.data.tabId,
          status: message.data.status,
          progress: message.data.progress || 0,
          lastError: message.data.error || null,
        },
        meta: {
          ...this.state.meta,
          usageStats: {
            ...this.state.meta.usageStats,
            autofillCount: message.data.status === 'complete'
              ? this.state.meta.usageStats.autofillCount + 1
              : this.state.meta.usageStats.autofillCount,
          },
        },
      });
    });

    // Handle form detection
    messageRouter.on('form:detected', (message) => {
      const existingFormIndex = this.state.autofill.detectedForms.findIndex(
        form => form.tabId === message.data.tabId && form.formId === message.data.formId
      );

      const updatedForms = [...this.state.autofill.detectedForms];
      if (existingFormIndex >= 0) {
        updatedForms[existingFormIndex] = message.data;
      } else {
        updatedForms.push(message.data);
      }

      this.updateState({
        autofill: {
          ...this.state.autofill,
          detectedForms: updatedForms,
        },
      });
    });

    // Handle tab changes
    messageRouter.on('tab:activated', (message) => {
      // Clean up forms for inactive tabs
      const activeForms = this.state.autofill.detectedForms.filter(
        form => form.tabId === message.data.tabId
      );

      this.updateState({
        autofill: {
          ...this.state.autofill,
          activeTabId: message.data.tabId,
          detectedForms: activeForms,
        },
      });
    });
  }

  /**
   * Get current state
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * Get specific state slice
   */
  getStateSlice<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key];
  }

  /**
   * Update state with partial updates
   */
  updateState(updates: Partial<AppState>): void {
    const previousState = { ...this.state };
    this.state = this.mergeState(this.state, updates);

    // Update last active date
    this.state.meta.lastActiveDate = new Date();

    // Notify listeners
    this.notifyListeners(this.state, previousState);
    this.notifySelectorListeners(this.state, previousState);

    // Broadcast state changes to extension components
    this.broadcastStateChange(updates);
  }

  /**
   * Deep merge state updates
   */
  private mergeState(current: AppState, updates: Partial<AppState>): AppState {
    const merged = { ...current };

    Object.keys(updates).forEach(key => {
      const updateKey = key as keyof AppState;
      const updateValue = updates[updateKey];
      
      if (updateValue && typeof updateValue === 'object' && !Array.isArray(updateValue)) {
        merged[updateKey] = { ...current[updateKey], ...updateValue } as any;
      } else {
        merged[updateKey] = updateValue as any;
      }
    });

    return merged;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to specific state selector
   */
  subscribeToSelector<T>(
    selector: (state: AppState) => T,
    listener: (value: T, previousValue: T) => void
  ): () => void {
    const selectorId = `selector_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const currentValue = selector(this.state);

    if (!this.selectorListeners.has(selectorId)) {
      this.selectorListeners.set(selectorId, []);
    }

    this.selectorListeners.get(selectorId)!.push({
      selector,
      listener,
      lastValue: currentValue,
    });

    // Return unsubscribe function
    return () => {
      this.selectorListeners.delete(selectorId);
    };
  }

  /**
   * Notify state change listeners
   */
  private notifyListeners(newState: AppState, previousState: AppState): void {
    this.listeners.forEach(listener => {
      try {
        listener(newState, previousState);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Notify selector listeners
   */
  private notifySelectorListeners(newState: AppState, previousState: AppState): void {
    this.selectorListeners.forEach(selectorGroup => {
      selectorGroup.forEach(({ selector, listener, lastValue }, index) => {
        try {
          const currentValue = selector(newState);
          if (currentValue !== lastValue) {
            listener(currentValue, lastValue);
            selectorGroup[index].lastValue = currentValue;
          }
        } catch (error) {
          console.error('Error in selector listener:', error);
        }
      });
    });
  }

  /**
   * Broadcast state changes to extension components
   */
  private broadcastStateChange(updates: Partial<AppState>): void {
    // Send state updates to all extension contexts
    Object.keys(updates).forEach(key => {
      const stateKey = key as keyof AppState;
      const message = createMessage({
        type: `state:${stateKey}` as any,
        source: 'background' as const,
        data: updates[stateKey],
      });

      messageRouter.broadcastToExtension(message);
    });
  }

  /**
   * Add notification
   */
  addNotification(
    type: 'info' | 'success' | 'warning' | 'error',
    message: string,
    autoRemove = true
  ): string {
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      timestamp: new Date(),
      dismissed: false,
    };

    this.updateState({
      ui: {
        ...this.state.ui,
        notifications: [...this.state.ui.notifications, notification],
      },
    });

    // Auto-remove after 5 seconds for non-error notifications
    if (autoRemove && type !== 'error') {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, 5000);
    }

    return notification.id;
  }

  /**
   * Dismiss notification
   */
  dismissNotification(notificationId: string): void {
    this.updateState({
      ui: {
        ...this.state.ui,
        notifications: this.state.ui.notifications.map(notif =>
          notif.id === notificationId ? { ...notif, dismissed: true } : notif
        ),
      },
    });

    // Remove dismissed notifications after a delay
    setTimeout(() => {
      this.updateState({
        ui: {
          ...this.state.ui,
          notifications: this.state.ui.notifications.filter(
            notif => notif.id !== notificationId
          ),
        },
      });
    }, 1000);
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<AppState['ui']['settings']>): void {
    this.updateState({
      ui: {
        ...this.state.ui,
        settings: {
          ...this.state.ui.settings,
          ...settings,
        },
      },
    });
  }

  /**
   * Reset state to defaults
   */
  reset(): void {
    const resetState = {
      ...DEFAULT_STATE,
      meta: {
        ...DEFAULT_STATE.meta,
        installDate: this.state.meta.installDate,
      },
    };
    
    this.state = resetState;
    this.notifyListeners(this.state, DEFAULT_STATE);
  }

  /**
   * Get state statistics
   */
  getStats(): {
    listenersCount: number;
    selectorListenersCount: number;
    notificationsCount: number;
    stateSize: number;
  } {
    return {
      listenersCount: this.listeners.length,
      selectorListenersCount: Array.from(this.selectorListeners.values())
        .reduce((sum, group) => sum + group.length, 0),
      notificationsCount: this.state.ui.notifications.length,
      stateSize: JSON.stringify(this.state).length,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.listeners.length = 0;
    this.selectorListeners.clear();
  }
}

// Export singleton instance
export const stateManager = new StateManager();