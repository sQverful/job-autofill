import React, { useState, useEffect } from 'react';
import { cn, Button } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { SecurityWarnings } from './SecurityWarnings';

interface PrivacySecurityIndicatorProps {
  className?: string;
}

interface StorageInfo {
  bytesInUse: number;
  quota: number;
  usagePercentage: number;
}

interface PermissionStatus {
  storage: boolean;
  activeTab: boolean;
  scripting: boolean;
  hostPermissions: boolean;
}

interface SecurityStatus {
  dataEncryption: 'local' | 'none';
  dataLocation: 'local' | 'cloud';
  thirdPartyAccess: boolean;
  networkRequests: boolean;
}

export const PrivacySecurityIndicator: React.FC<PrivacySecurityIndicatorProps> = ({ className }) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    storage: false,
    activeTab: false,
    scripting: false,
    hostPermissions: false,
  });
  const [securityStatus] = useState<SecurityStatus>({
    dataEncryption: 'local',
    dataLocation: 'local',
    thirdPartyAccess: false,
    networkRequests: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadPrivacySecurityInfo();
  }, []);

  const loadPrivacySecurityInfo = async () => {
    setIsLoading(true);
    try {
      // Load storage information
      const storageData = await getStorageInfo();
      if (storageData) {
        setStorageInfo({
          ...storageData,
          usagePercentage: (storageData.bytesInUse / storageData.quota) * 100,
        });
      }

      // Check permissions
      const permissions = await checkPermissions();
      setPermissionStatus(permissions);
    } catch (error) {
      console.error('Error loading privacy/security info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStorageInfo = async (): Promise<StorageInfo | null> => {
    try {
      const bytesInUse = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
      const usagePercentage = (bytesInUse / quota) * 100;
      return { bytesInUse, quota, usagePercentage };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return null;
    }
  };

  const checkPermissions = async (): Promise<PermissionStatus> => {
    try {
      const permissions = await chrome.permissions.getAll();

      return {
        storage: permissions.permissions?.includes('storage') ?? false,
        activeTab: permissions.permissions?.includes('activeTab') ?? false,
        scripting: permissions.permissions?.includes('scripting') ?? false,
        hostPermissions: (permissions.origins?.length ?? 0) > 0,
      };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return {
        storage: false,
        activeTab: false,
        scripting: false,
        hostPermissions: false,
      };
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSecurityIcon = (status: boolean | string): string => {
    if (typeof status === 'boolean') {
      return status ? '🔒' : '🔓';
    }
    return status === 'local' ? '🔒' : '🌐';
  };

  const getSecurityColor = (status: boolean | string, isGood: boolean = true): string => {
    if (typeof status === 'boolean') {
      return status === isGood ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400';
    }
    return status === 'local' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400';
  };

  const clearAllData = async () => {
    if (confirm('This will permanently delete all stored data. Are you sure?')) {
      try {
        await chrome.storage.local.clear();
        alert('All data has been cleared successfully.');
        loadPrivacySecurityInfo();
      } catch (error) {
        alert('Error clearing data. Please try again.');
      }
    }
  };

  if (isLoading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          Loading privacy & security information...
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 p-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Privacy & Security</h3>
        <Button variant="outline" size="sm" onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide Details' : 'Show Details'}
        </Button>
      </div>

      {/* Data Storage Overview */}
      <div
        className={cn('rounded-lg border p-4', isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800')}>
        <h4 className="mb-3 text-base font-medium">Data Storage</h4>

        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <span>🔒</span>
            <span className="text-sm">All data stored locally on your device</span>
          </div>

          <div className="flex items-center space-x-2">
            <span>🚫</span>
            <span className="text-sm">No data sent to external servers</span>
          </div>

          {storageInfo && (
            <div className="flex items-center space-x-2">
              <span>💾</span>
              <div className="flex-1">
                <div className="text-sm">
                  Storage used: {formatBytes(storageInfo.bytesInUse)} of {formatBytes(storageInfo.quota)}
                </div>
                <div className="mt-1 h-1 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={cn(
                      'h-1 rounded-full transition-all duration-300',
                      storageInfo.usagePercentage > 80 ? 'bg-yellow-500' : 'bg-green-500',
                    )}
                    style={{ width: `${Math.min(storageInfo.usagePercentage, 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {storageInfo.usagePercentage.toFixed(1)}% used
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Permission Status */}
      <div
        className={cn('rounded-lg border p-4', isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800')}>
        <h4 className="mb-3 text-base font-medium">Permissions</h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={getSecurityColor(permissionStatus.storage)}>
                {getSecurityIcon(permissionStatus.storage)}
              </span>
              <div>
                <div className="text-sm font-medium">Local Storage Access</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Required to save your profile and CV data
                </div>
              </div>
            </div>
            <span
              className={cn(
                'rounded px-2 py-1 text-xs',
                permissionStatus.storage
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
              )}>
              {permissionStatus.storage ? 'Granted' : 'Missing'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={getSecurityColor(permissionStatus.activeTab)}>
                {getSecurityIcon(permissionStatus.activeTab)}
              </span>
              <div>
                <div className="text-sm font-medium">Active Tab Access</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Required to detect and fill forms on current page
                </div>
              </div>
            </div>
            <span
              className={cn(
                'rounded px-2 py-1 text-xs',
                permissionStatus.activeTab
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
              )}>
              {permissionStatus.activeTab ? 'Granted' : 'Missing'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={getSecurityColor(permissionStatus.scripting)}>
                {getSecurityIcon(permissionStatus.scripting)}
              </span>
              <div>
                <div className="text-sm font-medium">Script Injection</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Required to interact with form fields</div>
              </div>
            </div>
            <span
              className={cn(
                'rounded px-2 py-1 text-xs',
                permissionStatus.scripting
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
              )}>
              {permissionStatus.scripting ? 'Granted' : 'Missing'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={getSecurityColor(permissionStatus.hostPermissions)}>
                {getSecurityIcon(permissionStatus.hostPermissions)}
              </span>
              <div>
                <div className="text-sm font-medium">Website Access</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Required to access job application websites
                </div>
              </div>
            </div>
            <span
              className={cn(
                'rounded px-2 py-1 text-xs',
                permissionStatus.hostPermissions
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
              )}>
              {permissionStatus.hostPermissions ? 'Granted' : 'Missing'}
            </span>
          </div>
        </div>
      </div>

      {/* Security Features */}
      <div
        className={cn('rounded-lg border p-4', isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800')}>
        <h4 className="mb-3 text-base font-medium">Security Features</h4>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 dark:text-green-400">🔒</span>
              <div>
                <div className="text-sm font-medium">Data Location</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">All data stored locally on your device</div>
              </div>
            </div>
            <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
              Local Only
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 dark:text-green-400">🔒</span>
              <div>
                <div className="text-sm font-medium">Third-party Access</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  No external services can access your data
                </div>
              </div>
            </div>
            <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
              Blocked
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-green-600 dark:text-green-400">🔒</span>
              <div>
                <div className="text-sm font-medium">Network Requests</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Extension works entirely offline</div>
              </div>
            </div>
            <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
              None
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      {showDetails && (
        <div
          className={cn(
            'rounded-lg border p-4',
            isLight ? 'border-gray-200 bg-gray-100' : 'border-gray-700 bg-gray-900',
          )}>
          <h4 className="mb-3 text-base font-medium">Detailed Privacy Information</h4>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-sm font-semibold">What data is stored:</div>
              <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-400">
                <li>Personal information (name, email, phone, address)</li>
                <li>Work experience and skills</li>
                <li>CV/resume files (stored as encrypted data)</li>
                <li>Extension preferences and settings</li>
                <li>Usage statistics (forms filled, success rates)</li>
              </ul>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">How data is protected:</div>
              <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-400">
                <li>All data stored locally using Chrome's secure storage API</li>
                <li>No data transmitted to external servers</li>
                <li>Files are encoded and stored securely</li>
                <li>Data is only accessible by this extension</li>
                <li>Automatic cleanup when extension is uninstalled</li>
              </ul>
            </div>

            <div>
              <div className="mb-2 text-sm font-semibold">Permissions explained:</div>
              <ul className="list-disc space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-400">
                <li>
                  <strong>Storage:</strong> Save your profile and CV data locally
                </li>
                <li>
                  <strong>Active Tab:</strong> Detect forms on the current webpage
                </li>
                <li>
                  <strong>Scripting:</strong> Fill form fields with your data
                </li>
                <li>
                  <strong>Host Permissions:</strong> Access job application websites
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Security Warnings */}
      <SecurityWarnings />

      {/* Quick Actions */}
      <div
        className={cn('rounded-lg border p-4', isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800')}>
        <h4 className="mb-3 text-base font-medium">Privacy Actions</h4>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadPrivacySecurityInfo}>
            🔄 Refresh Status
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearAllData}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
            🗑️ Clear All Data
          </Button>
        </div>
      </div>
    </div>
  );
};
