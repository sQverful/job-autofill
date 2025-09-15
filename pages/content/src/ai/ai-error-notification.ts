/**
 * AI Error Notification System
 * Provides user-friendly error messages and recovery suggestions
 */

import type { AIErrorResolution } from '@extension/shared';

// Define EnhancedAIError locally to avoid cross-package imports
interface EnhancedAIError extends Error {
  type: string;
  context: {
    operation: string;
    timestamp: Date;
    retryCount: number;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  userActionRequired: boolean;
  fallbackAvailable: boolean;
}

// Notification types
export type NotificationType = 'error' | 'warning' | 'info' | 'success';

// Notification configuration
export interface NotificationConfig {
  type: NotificationType;
  title: string;
  message: string;
  duration: number;
  actions?: NotificationAction[];
  dismissible: boolean;
  persistent: boolean;
}

// Notification action
export interface NotificationAction {
  label: string;
  action: () => void | Promise<void>;
  style: 'primary' | 'secondary' | 'danger';
}

/**
 * AI Error Notification Manager
 */
export class AIErrorNotificationManager {
  private static instance: AIErrorNotificationManager;
  private notifications: Map<string, HTMLElement> = new Map();
  private notificationContainer: HTMLElement | null = null;

  private constructor() {
    this.initializeContainer();
  }

  static getInstance(): AIErrorNotificationManager {
    if (!AIErrorNotificationManager.instance) {
      AIErrorNotificationManager.instance = new AIErrorNotificationManager();
    }
    return AIErrorNotificationManager.instance;
  }

  /**
   * Initialize notification container
   */
  private initializeContainer(): void {
    // Create notification container if it doesn't exist
    this.notificationContainer = document.getElementById('ai-error-notifications');
    
    if (!this.notificationContainer) {
      this.notificationContainer = document.createElement('div');
      this.notificationContainer.id = 'ai-error-notifications';
      this.notificationContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      `;
      document.body.appendChild(this.notificationContainer);
    }
  }

  /**
   * Show error notification with recovery options
   */
  async showErrorNotification(
    error: EnhancedAIError,
    resolution: AIErrorResolution,
    context: {
      operation: string;
      canRetry?: boolean;
      canUseFallback?: boolean;
      onRetry?: () => Promise<void>;
      onUseFallback?: () => Promise<void>;
      onOpenSettings?: () => void;
    }
  ): Promise<void> {
    // Create user-friendly message locally
    const userFriendlyMessage = this.createUserFriendlyMessage(error);

    const actions: NotificationAction[] = [];

    // Add retry action if applicable
    if (context.canRetry && context.onRetry) {
      actions.push({
        label: 'Retry',
        action: context.onRetry,
        style: 'primary'
      });
    }

    // Add fallback action if applicable
    if (context.canUseFallback && context.onUseFallback) {
      actions.push({
        label: 'Use Traditional Autofill',
        action: context.onUseFallback,
        style: 'secondary'
      });
    }

    // Add settings action for token-related errors
    if (error.type === 'INVALID_TOKEN' && context.onOpenSettings) {
      actions.push({
        label: 'Open Settings',
        action: context.onOpenSettings,
        style: 'primary'
      });
    }

    // Add help action
    actions.push({
      label: 'Help',
      action: () => this.showHelpDialog(error, userFriendlyMessage),
      style: 'secondary'
    });

    const config: NotificationConfig = {
      type: this.getNotificationType(error.severity),
      title: userFriendlyMessage.title,
      message: userFriendlyMessage.message,
      duration: error.severity === 'critical' ? 0 : 8000, // Persistent for critical errors
      actions,
      dismissible: true,
      persistent: error.severity === 'critical'
    };

    this.showNotification(`error_${error.type}_${Date.now()}`, config);
  }

  /**
   * Show success notification for fallback
   */
  showFallbackSuccessNotification(strategyName: string, filledCount: number): void {
    const config: NotificationConfig = {
      type: 'success',
      title: 'Fallback Successful',
      message: `AI autofill failed, but ${strategyName} successfully filled ${filledCount} fields.`,
      duration: 5000,
      dismissible: true,
      persistent: false
    };

    this.showNotification(`fallback_success_${Date.now()}`, config);
  }

  /**
   * Show warning notification for partial success
   */
  showPartialSuccessNotification(successCount: number, totalCount: number): void {
    const config: NotificationConfig = {
      type: 'warning',
      title: 'Partial Success',
      message: `AI autofill completed ${successCount} of ${totalCount} fields. Some fields may need manual attention.`,
      duration: 6000,
      dismissible: true,
      persistent: false
    };

    this.showNotification(`partial_success_${Date.now()}`, config);
  }

  /**
   * Show general notification
   */
  showNotification(id: string, config: NotificationConfig): void {
    // Remove existing notification with same ID
    this.removeNotification(id);

    const notification = this.createNotificationElement(id, config);
    this.notifications.set(id, notification);
    
    if (this.notificationContainer) {
      this.notificationContainer.appendChild(notification);
    }

    // Auto-dismiss if duration is set
    if (config.duration > 0) {
      setTimeout(() => {
        this.removeNotification(id);
      }, config.duration);
    }

    // Animate in
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
      notification.style.opacity = '1';
    });
  }

  /**
   * Create notification DOM element
   */
  private createNotificationElement(id: string, config: NotificationConfig): HTMLElement {
    const notification = document.createElement('div');
    notification.className = `ai-notification ai-notification-${config.type}`;
    notification.style.cssText = `
      background: ${this.getBackgroundColor(config.type)};
      border: 1px solid ${this.getBorderColor(config.type)};
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease;
      pointer-events: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;

    // Create header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      font-weight: 600;
      color: ${this.getTextColor(config.type)};
      display: flex;
      align-items: center;
    `;
    title.innerHTML = `${this.getIcon(config.type)} ${config.title}`;

    header.appendChild(title);

    // Add dismiss button if dismissible
    if (config.dismissible) {
      const dismissButton = document.createElement('button');
      dismissButton.innerHTML = '×';
      dismissButton.style.cssText = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: ${this.getTextColor(config.type)};
        opacity: 0.7;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      dismissButton.onclick = () => this.removeNotification(id);
      header.appendChild(dismissButton);
    }

    notification.appendChild(header);

    // Create message
    const message = document.createElement('div');
    message.style.cssText = `
      color: ${this.getTextColor(config.type)};
      margin-bottom: ${config.actions && config.actions.length > 0 ? '12px' : '0'};
    `;
    message.textContent = config.message;
    notification.appendChild(message);

    // Create actions
    if (config.actions && config.actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.style.cssText = `
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      `;

      config.actions.forEach(actionConfig => {
        const button = document.createElement('button');
        button.textContent = actionConfig.label;
        button.style.cssText = `
          background: ${this.getActionButtonColor(actionConfig.style)};
          color: ${this.getActionButtonTextColor(actionConfig.style)};
          border: 1px solid ${this.getActionButtonBorderColor(actionConfig.style)};
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        `;

        button.onmouseover = () => {
          button.style.opacity = '0.8';
        };
        button.onmouseout = () => {
          button.style.opacity = '1';
        };

        button.onclick = async () => {
          try {
            await actionConfig.action();
            // Auto-dismiss after action unless persistent
            if (!config.persistent) {
              this.removeNotification(id);
            }
          } catch (error) {
            console.error('[AIErrorNotificationManager] Action failed:', error);
          }
        };

        actionsContainer.appendChild(button);
      });

      notification.appendChild(actionsContainer);
    }

    return notification;
  }

  /**
   * Remove notification
   */
  removeNotification(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      // Animate out
      notification.style.transform = 'translateX(100%)';
      notification.style.opacity = '0';
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.notifications.delete(id);
      }, 300);
    }
  }

  /**
   * Show help dialog with detailed guidance
   */
  private showHelpDialog(error: EnhancedAIError, userFriendlyMessage: any): void {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 8px;
      padding: 24px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    content.innerHTML = `
      <h3 style="margin: 0 0 16px 0; color: #333;">${userFriendlyMessage.title}</h3>
      <p style="margin: 0 0 16px 0; color: #666;">${userFriendlyMessage.message}</p>
      
      ${userFriendlyMessage.guidance.length > 0 ? `
        <h4 style="margin: 16px 0 8px 0; color: #333;">What you can do:</h4>
        <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #666;">
          ${userFriendlyMessage.guidance.map((item: string) => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
        </ul>
      ` : ''}
      
      ${userFriendlyMessage.preventionTips.length > 0 ? `
        <h4 style="margin: 16px 0 8px 0; color: #333;">Prevention tips:</h4>
        <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #666;">
          ${userFriendlyMessage.preventionTips.map((item: string) => `<li style="margin-bottom: 4px;">${item}</li>`).join('')}
        </ul>
      ` : ''}
      
      <div style="text-align: right; margin-top: 20px;">
        <button id="close-help-dialog" style="
          background: #007cba;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
        ">Close</button>
      </div>
    `;

    dialog.appendChild(content);
    document.body.appendChild(dialog);

    // Close dialog handlers
    const closeButton = content.querySelector('#close-help-dialog') as HTMLButtonElement;
    const closeDialog = () => {
      document.body.removeChild(dialog);
    };

    closeButton.onclick = closeDialog;
    dialog.onclick = (e) => {
      if (e.target === dialog) {
        closeDialog();
      }
    };
  }

  /**
   * Get notification type based on error severity
   */
  private getNotificationType(severity: EnhancedAIError['severity']): NotificationType {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'error';
    }
  }

  /**
   * Get background color for notification type
   */
  private getBackgroundColor(type: NotificationType): string {
    switch (type) {
      case 'error': return '#fef2f2';
      case 'warning': return '#fffbeb';
      case 'info': return '#eff6ff';
      case 'success': return '#f0fdf4';
      default: return '#f9fafb';
    }
  }

  /**
   * Get border color for notification type
   */
  private getBorderColor(type: NotificationType): string {
    switch (type) {
      case 'error': return '#fecaca';
      case 'warning': return '#fed7aa';
      case 'info': return '#bfdbfe';
      case 'success': return '#bbf7d0';
      default: return '#e5e7eb';
    }
  }

  /**
   * Get text color for notification type
   */
  private getTextColor(type: NotificationType): string {
    switch (type) {
      case 'error': return '#991b1b';
      case 'warning': return '#92400e';
      case 'info': return '#1e40af';
      case 'success': return '#166534';
      default: return '#374151';
    }
  }

  /**
   * Get icon for notification type
   */
  private getIcon(type: NotificationType): string {
    switch (type) {
      case 'error': return '⚠️';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  }

  /**
   * Get action button color
   */
  private getActionButtonColor(style: NotificationAction['style']): string {
    switch (style) {
      case 'primary': return '#007cba';
      case 'secondary': return '#6b7280';
      case 'danger': return '#dc2626';
      default: return '#6b7280';
    }
  }

  /**
   * Get action button text color
   */
  private getActionButtonTextColor(style: NotificationAction['style']): string {
    return 'white';
  }

  /**
   * Get action button border color
   */
  private getActionButtonBorderColor(style: NotificationAction['style']): string {
    return this.getActionButtonColor(style);
  }

  /**
   * Create user-friendly message from error
   */
  private createUserFriendlyMessage(error: EnhancedAIError): {
    title: string;
    message: string;
    guidance: string[];
    preventionTips: string[];
    canRetry: boolean;
    canUseFallback: boolean;
  } {
    const errorTitles: Record<string, string> = {
      INVALID_TOKEN: 'Invalid API Token',
      API_RATE_LIMIT: 'Rate Limit Exceeded',
      API_QUOTA_EXCEEDED: 'API Quota Exceeded',
      NETWORK_ERROR: 'Network Connection Error',
      INVALID_RESPONSE: 'Invalid AI Response',
      PARSING_ERROR: 'Response Parsing Error',
      EXECUTION_FAILED: 'Execution Failed',
      CACHE_ERROR: 'Cache Error',
      ENCRYPTION_ERROR: 'Token Security Error'
    };

    const errorMessages: Record<string, string> = {
      INVALID_TOKEN: 'Your OpenAI API token is invalid or expired',
      API_RATE_LIMIT: 'OpenAI API rate limit exceeded. Retrying with backoff...',
      API_QUOTA_EXCEEDED: 'OpenAI API quota exceeded. Please check your billing settings',
      NETWORK_ERROR: 'Network connection error. Retrying...',
      INVALID_RESPONSE: 'AI returned an invalid response. Using traditional autofill',
      PARSING_ERROR: 'Failed to parse AI response. Using traditional autofill',
      EXECUTION_FAILED: 'AI instruction execution failed. Trying traditional autofill',
      CACHE_ERROR: 'Cache error occurred. Retrying without cache...',
      ENCRYPTION_ERROR: 'Token encryption/decryption failed. Please re-enter your API token'
    };

    const errorGuidance: Record<string, string[]> = {
      INVALID_TOKEN: [
        'Check that your token starts with "sk-"',
        'Verify the token is correctly copied from OpenAI dashboard',
        'Ensure your OpenAI account has sufficient credits',
        'Try generating a new API token'
      ],
      API_RATE_LIMIT: [
        'Rate limits are temporary and will reset automatically',
        'Consider upgrading your OpenAI plan for higher limits',
        'Use traditional autofill while waiting'
      ],
      API_QUOTA_EXCEEDED: [
        'Add payment method to your OpenAI account',
        'Increase your usage limits in OpenAI dashboard',
        'Check your current usage and billing status',
        'Consider upgrading your OpenAI plan'
      ],
      NETWORK_ERROR: [
        'Check your internet connection',
        'Try refreshing the page',
        'Use traditional autofill if network issues persist'
      ],
      INVALID_RESPONSE: [
        'This is usually a temporary issue with the AI service',
        'Traditional autofill will be used instead',
        'Try AI autofill again in a few minutes'
      ],
      PARSING_ERROR: [
        'AI response format was unexpected',
        'Traditional autofill will work normally',
        'This issue has been logged for improvement'
      ],
      EXECUTION_FAILED: [
        'The form structure may have changed',
        'Traditional autofill will attempt to fill the form',
        'You can manually complete any remaining fields'
      ],
      CACHE_ERROR: [
        'Cache will be cleared and rebuilt',
        'This may slightly slow down the next request'
      ],
      ENCRYPTION_ERROR: [
        'Your stored API token may be corrupted',
        'Please re-enter your OpenAI API token in settings',
        'This will resolve the encryption issue'
      ]
    };

    return {
      title: errorTitles[error.type] || 'AI Error',
      message: errorMessages[error.type] || error.message,
      guidance: errorGuidance[error.type] || [],
      preventionTips: [],
      canRetry: error.recoverable,
      canUseFallback: error.fallbackAvailable
    };
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    for (const id of this.notifications.keys()) {
      this.removeNotification(id);
    }
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): {
    activeNotifications: number;
    notificationTypes: Record<string, number>;
  } {
    const stats = {
      activeNotifications: this.notifications.size,
      notificationTypes: {} as Record<string, number>
    };

    // Count by type (would need to track types in notifications)
    return stats;
  }
}

// Export singleton instance
export const aiErrorNotificationManager = AIErrorNotificationManager.getInstance();