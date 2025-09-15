/**
 * Consent Management UI Component
 * Handles user consent for AI features and privacy compliance
 */

import React, { useState, useEffect } from 'react';
import { 
  ConsentManager, 
  type ConsentData, 
  type ConsentConfiguration,
  AuditLogger 
} from '@extension/shared';

interface ConsentManagerProps {
  onConsentChange?: (consent: ConsentData) => void;
}

export const ConsentManagerComponent: React.FC<ConsentManagerProps> = ({ 
  onConsentChange 
}) => {
  const [consent, setConsent] = useState<ConsentData | null>(null);
  const [config, setConfig] = useState<ConsentConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  useEffect(() => {
    loadConsentData();
  }, []);

  const loadConsentData = async () => {
    try {
      setLoading(true);
      const [currentConsent, consentConfig] = await Promise.all([
        ConsentManager.getConsent(),
        Promise.resolve(ConsentManager.getConsentConfiguration()),
      ]);
      
      setConsent(currentConsent);
      setConfig(consentConfig);
    } catch (error) {
      console.error('Failed to load consent data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConsentChange = async (
    feature: keyof ConsentData,
    value: boolean
  ) => {
    if (feature === 'timestamp' || feature === 'version' || feature === 'ipAddress' || feature === 'userAgent') {
      return; // These are metadata fields
    }

    try {
      setSaving(true);
      
      const updatedConsent = {
        ...consent,
        [feature]: value,
      };

      await ConsentManager.setConsent(updatedConsent);
      
      // Reload consent data to get updated timestamps
      await loadConsentData();
      
      // Log user action
      await AuditLogger.logUserAction(
        'consent_changed',
        {
          feature,
          value,
          previousValue: consent?.[feature],
        }
      );

      onConsentChange?.(updatedConsent as ConsentData);
    } catch (error) {
      console.error('Failed to update consent:', error);
      alert('Failed to save consent preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Are you sure you want to revoke all consents? This will disable AI features.')) {
      return;
    }

    try {
      setSaving(true);
      await ConsentManager.revokeConsent();
      await loadConsentData();
      
      await AuditLogger.logUserAction(
        'all_consent_revoked',
        { revokedAt: new Date().toISOString() }
      );

      onConsentChange?.(null as any);
    } catch (error) {
      console.error('Failed to revoke consent:', error);
      alert('Failed to revoke consent. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const exportData = await ConsentManager.exportConsentData();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `consent-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await AuditLogger.logUserAction(
        'consent_data_exported',
        { exportedAt: new Date().toISOString() }
      );
    } catch (error) {
      console.error('Failed to export consent data:', error);
      alert('Failed to export consent data. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="consent-manager loading">
        <div className="loading-spinner">Loading consent preferences...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="consent-manager error">
        <p>Failed to load consent configuration. Please refresh the page.</p>
      </div>
    );
  }

  const isExpired = consent && ConsentManager.isConsentExpired(consent);

  return (
    <div className="consent-manager">
      <div className="consent-header">
        <h3>Privacy & Consent Settings</h3>
        <p className="consent-description">
          Manage your privacy preferences for AI features. Your consent is required 
          for AI processing and is stored securely on your device.
        </p>
      </div>

      {isExpired && (
        <div className="consent-warning expired">
          <strong>⚠️ Consent Expired</strong>
          <p>Your consent has expired and needs to be renewed to continue using AI features.</p>
        </div>
      )}

      <div className="consent-options">
        {Object.entries(config).map(([key, options]) => {
          const isChecked = consent?.[key as keyof ConsentData] === true;
          const isRequired = options.required;
          
          return (
            <div key={key} className={`consent-option ${isRequired ? 'required' : 'optional'}`}>
              <div className="consent-option-header">
                <label className="consent-checkbox">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={saving}
                    onChange={(e) => handleConsentChange(key as keyof ConsentData, e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <span className="consent-title">
                    {getConsentTitle(key)}
                    {isRequired && <span className="required-badge">Required</span>}
                  </span>
                </label>
                
                <button
                  type="button"
                  className="details-toggle"
                  onClick={() => setShowDetails(showDetails === key ? null : key)}
                >
                  {showDetails === key ? 'Hide Details' : 'Show Details'}
                </button>
              </div>

              <p className="consent-description">{options.description}</p>

              {showDetails === key && (
                <div className="consent-details">
                  <div className="detail-section">
                    <h4>Data Types Processed:</h4>
                    <ul>
                      {options.dataTypes.map((dataType: string, index: number) => (
                        <li key={index}>{dataType}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <h4>Data Retention:</h4>
                    <p>{options.retentionPeriod}</p>
                  </div>

                  {options.thirdParties && options.thirdParties.length > 0 && (
                    <div className="detail-section">
                      <h4>Third Parties:</h4>
                      <ul>
                        {options.thirdParties.map((party: string, index: number) => (
                          <li key={index}>{party}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {consent && (
        <div className="consent-status">
          <div className="status-info">
            <p><strong>Consent Given:</strong> {consent.timestamp.toLocaleDateString()}</p>
            <p><strong>Version:</strong> {consent.version}</p>
            <p><strong>Expires:</strong> {
              (() => {
                const expiryDate = new Date(consent.timestamp);
                expiryDate.setDate(expiryDate.getDate() + 365);
                return expiryDate.toLocaleDateString();
              })()
            }</p>
          </div>
        </div>
      )}

      <div className="consent-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleExportData}
          disabled={saving}
        >
          Export My Data
        </button>
        
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleRevokeAll}
          disabled={saving || !consent}
        >
          Revoke All Consent
        </button>
      </div>

      {saving && (
        <div className="saving-indicator">
          Saving preferences...
        </div>
      )}

      <style>{`
        .consent-manager {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .consent-header {
          margin-bottom: 30px;
        }

        .consent-header h3 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 24px;
        }

        .consent-description {
          color: #666;
          line-height: 1.5;
          margin: 0;
        }

        .consent-warning {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 20px;
        }

        .consent-warning.expired {
          background: #f8d7da;
          border-color: #f5c6cb;
        }

        .consent-options {
          space-y: 20px;
        }

        .consent-option {
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 15px;
          background: white;
        }

        .consent-option.required {
          border-color: #007cba;
          background: #f8f9ff;
        }

        .consent-option-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 10px;
        }

        .consent-checkbox {
          display: flex;
          align-items: flex-start;
          cursor: pointer;
          flex: 1;
        }

        .consent-checkbox input[type="checkbox"] {
          margin-right: 12px;
          margin-top: 2px;
        }

        .consent-title {
          font-weight: 600;
          color: #333;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .required-badge {
          background: #007cba;
          color: white;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: normal;
        }

        .details-toggle {
          background: none;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 12px;
          cursor: pointer;
          color: #666;
        }

        .details-toggle:hover {
          background: #f5f5f5;
        }

        .consent-details {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }

        .detail-section {
          margin-bottom: 15px;
        }

        .detail-section h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #333;
        }

        .detail-section ul {
          margin: 0;
          padding-left: 20px;
        }

        .detail-section li {
          margin-bottom: 4px;
          color: #666;
          font-size: 14px;
        }

        .consent-status {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
        }

        .status-info p {
          margin: 5px 0;
          font-size: 14px;
          color: #666;
        }

        .consent-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #5a6268;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #c82333;
        }

        .saving-indicator {
          text-align: center;
          color: #666;
          font-style: italic;
          margin-top: 10px;
        }

        .loading {
          text-align: center;
          padding: 40px;
        }

        .loading-spinner {
          color: #666;
        }

        .error {
          text-align: center;
          padding: 40px;
          color: #dc3545;
        }
      `}</style>
    </div>
  );

};

// Helper function to get user-friendly titles
const getConsentTitle = (key: string): string => {
  const titles: Record<string, string> = {
    aiProcessing: 'AI Processing',
    dataSharing: 'Anonymous Data Sharing',
    analytics: 'Usage Analytics',
  };
  return titles[key] || key;
};