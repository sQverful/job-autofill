import React, { useState, useEffect } from 'react';
import { cn, Button } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';

interface SecurityWarning {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact: string;
  resolution: {
    steps: string[];
    autoFixAvailable?: boolean;
    onAutoFix?: () => Promise<void>;
  };
  dismissed?: boolean;
  timestamp: number;
}

interface SecurityWarningsProps {
  className?: string;
}

export const SecurityWarnings: React.FC<SecurityWarningsProps> = ({ className }) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [warnings, setWarnings] = useState<SecurityWarning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedWarning, setExpandedWarning] = useState<string | null>(null);

  useEffect(() => {
    checkSecurityStatus();
  }, []);

  const checkSecurityStatus = async () => {
    setIsLoading(true);
    const detectedWarnings: SecurityWarning[] = [];

    try {
      // Check permissions
      const permissions = await chrome.permissions.getAll();

      if (!permissions.permissions?.includes('storage')) {
        detectedWarnings.push({
          id: 'missing-storage-permission',
          type: 'critical',
          title: 'Storage Permission Missing',
          description: 'The extension cannot save your profile data without storage permission.',
          impact: 'Profile data and CV uploads will not be saved between sessions.',
          resolution: {
            steps: [
              'Click on the extension icon in the toolbar',
              'Select "Manage extensions"',
              'Find "Apply Ninja" and click "Details"',
              'Ensure "Allow access to file URLs" is enabled if needed',
            ],
            autoFixAvailable: true,
            onAutoFix: async () => {
              try {
                await chrome.permissions.request({ permissions: ['storage'] });
                await checkSecurityStatus();
              } catch (error) {
                console.error('Failed to request storage permission:', error);
              }
            },
          },
          timestamp: Date.now(),
        });
      }

      if (!permissions.permissions?.includes('activeTab')) {
        detectedWarnings.push({
          id: 'missing-activetab-permission',
          type: 'warning',
          title: 'Active Tab Permission Missing',
          description: 'The extension cannot detect forms on the current page.',
          impact: 'Autofill functionality will not work on job application websites.',
          resolution: {
            steps: [
              'Reload the extension by disabling and re-enabling it',
              'Accept all permission requests when prompted',
              'If issues persist, reinstall the extension',
            ],
          },
          timestamp: Date.now(),
        });
      }

      // Check storage quota
      try {
        const storageInfo = await chrome.storage.local.getBytesInUse();
        const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
        const usagePercentage = (storageInfo / quota) * 100;

        if (usagePercentage > 90) {
          detectedWarnings.push({
            id: 'storage-quota-warning',
            type: 'warning',
            title: 'Storage Almost Full',
            description: `Extension storage is ${usagePercentage.toFixed(1)}% full.`,
            impact: 'New data may not be saved if storage becomes full.',
            resolution: {
              steps: [
                'Remove old CV files if you have multiple versions',
                'Clear unused profile data',
                'Consider removing the extension and reinstalling if needed',
              ],
              autoFixAvailable: true,
              onAutoFix: async () => {
                if (confirm('This will clear all stored data. Are you sure?')) {
                  await chrome.storage.local.clear();
                  await checkSecurityStatus();
                }
              },
            },
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('Error checking storage quota:', error);
      }

      // Check for insecure contexts
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        if (currentTab?.url?.startsWith('http://')) {
          detectedWarnings.push({
            id: 'insecure-context',
            type: 'warning',
            title: 'Insecure Website Detected',
            description: 'The current website uses HTTP instead of HTTPS.',
            impact: 'Data transmission may not be secure. Consider using HTTPS versions of job sites.',
            resolution: {
              steps: [
                'Look for HTTPS version of the current website',
                'Check if the website URL starts with "https://"',
                'Avoid entering sensitive information on HTTP sites',
                'Use reputable job boards that support HTTPS',
              ],
            },
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        // Ignore tab query errors
      }

      // Check extension context
      if (!chrome.runtime?.id) {
        detectedWarnings.push({
          id: 'extension-context-invalid',
          type: 'critical',
          title: 'Extension Context Invalid',
          description: 'The extension context has been invalidated.',
          impact: 'Extension functionality is completely disabled.',
          resolution: {
            steps: [
              'Reload the extension page',
              'Disable and re-enable the extension',
              'Restart Chrome browser',
              'Reinstall the extension if problems persist',
            ],
          },
          timestamp: Date.now(),
        });
      }

      // Load dismissed warnings from storage
      try {
        const result = await chrome.storage.local.get('dismissedWarnings');
        const dismissedIds = result.dismissedWarnings || [];

        // Filter out dismissed warnings
        const activeWarnings = detectedWarnings.filter(warning => !dismissedIds.includes(warning.id));

        setWarnings(activeWarnings);
      } catch (error) {
        setWarnings(detectedWarnings);
      }
    } catch (error) {
      console.error('Error checking security status:', error);

      // Add a generic error warning
      detectedWarnings.push({
        id: 'security-check-failed',
        type: 'warning',
        title: 'Security Check Failed',
        description: 'Unable to perform complete security assessment.',
        impact: 'Some security issues may not be detected.',
        resolution: {
          steps: [
            'Try refreshing the extension',
            'Check browser console for errors',
            'Restart the browser if issues persist',
          ],
        },
        timestamp: Date.now(),
      });

      setWarnings(detectedWarnings);
    } finally {
      setIsLoading(false);
    }
  };

  const dismissWarning = async (warningId: string) => {
    try {
      const result = await chrome.storage.local.get('dismissedWarnings');
      const dismissedIds = result.dismissedWarnings || [];

      if (!dismissedIds.includes(warningId)) {
        dismissedIds.push(warningId);
        await chrome.storage.local.set({ dismissedWarnings: dismissedIds });
      }

      setWarnings(prev => prev.filter(w => w.id !== warningId));
    } catch (error) {
      console.error('Error dismissing warning:', error);
    }
  };

  const getWarningIcon = (type: string): string => {
    switch (type) {
      case 'critical':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '⚠️';
    }
  };

  const getWarningStyles = (type: string) => {
    switch (type) {
      case 'critical':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-300 dark:border-red-700',
          text: 'text-red-800 dark:text-red-200',
          badge: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-300 dark:border-yellow-700',
          text: 'text-yellow-800 dark:text-yellow-200',
          badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        };
      case 'info':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-300 dark:border-blue-700',
          text: 'text-blue-800 dark:text-blue-200',
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        };
      default:
        return {
          bg: 'bg-yellow-50 dark:bg-yellow-900/20',
          border: 'border-yellow-300 dark:border-yellow-700',
          text: 'text-yellow-800 dark:text-yellow-200',
          badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        };
    }
  };

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">Checking security status...</div>
      </div>
    );
  }

  if (warnings.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <div
          className={cn(
            'rounded-lg border p-4 text-center',
            'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20',
          )}>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-green-600 dark:text-green-400">✅</span>
            <div>
              <div className="text-sm font-medium text-green-800 dark:text-green-200">No Security Issues Detected</div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Your extension is properly configured and secure
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Security Warnings ({warnings.length})</h3>
        <Button variant="outline" size="sm" onClick={checkSecurityStatus}>
          🔄 Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {warnings.map(warning => {
          const styles = getWarningStyles(warning.type);

          return (
            <div key={warning.id} className={cn('rounded-lg border p-4', styles.bg, styles.border)}>
              {/* Warning Header */}
              <div className="flex items-start justify-between">
                <div className="flex flex-1 items-start space-x-2">
                  <span className={styles.text}>{getWarningIcon(warning.type)}</span>
                  <div className="flex-1">
                    <div className={cn('mb-1 text-sm font-semibold', styles.text)}>{warning.title}</div>
                    <div className={cn('text-xs', styles.text)}>{warning.description}</div>
                  </div>
                </div>

                <div className="ml-2 flex items-center space-x-1">
                  <button
                    onClick={() => setExpandedWarning(expandedWarning === warning.id ? null : warning.id)}
                    className={cn('rounded p-1 text-xs hover:bg-black/5 dark:hover:bg-white/5', styles.text)}>
                    {expandedWarning === warning.id ? '▼' : '▶'}
                  </button>

                  <button
                    onClick={() => dismissWarning(warning.id)}
                    className={cn('rounded p-1 text-xs hover:bg-black/5 dark:hover:bg-white/5', styles.text)}
                    title="Dismiss warning">
                    ✕
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedWarning === warning.id && (
                <div className="mt-3 space-y-3">
                  {/* Impact */}
                  <div>
                    <div className={cn('mb-1 text-xs font-semibold', styles.text)}>Impact:</div>
                    <div className={cn('text-xs', styles.text)}>{warning.impact}</div>
                  </div>

                  {/* Resolution Steps */}
                  <div>
                    <div className={cn('mb-2 text-xs font-semibold', styles.text)}>Resolution Steps:</div>
                    <ol className={cn('list-decimal space-y-1 pl-4 text-xs', styles.text)}>
                      {warning.resolution.steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  {/* Auto-fix Button */}
                  {warning.resolution.autoFixAvailable && warning.resolution.onAutoFix && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={warning.resolution.onAutoFix}
                      className={cn('text-xs', styles.text)}>
                      🔧 Auto-fix Issue
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
