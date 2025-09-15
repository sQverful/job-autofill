import React, { useEffect, useState } from 'react';
import { Button, cn } from '@extension/ui';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { UserProfile } from '@extension/shared';
import { AIStatusIndicator } from './AIStatusIndicator';

interface SiteConfig {
  domain: string;
  fieldMappings: Record<string, string>;
  customSelectors: Record<string, string>;
  enabled: boolean;
}

type Success<T = unknown> = { success: true } & T;
type Failure = { success: false; error: string };
type ApiResponse<T = unknown> = Success<T> | Failure;

interface SettingsViewProps {
  onImport: (profile: UserProfile) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onImport }) => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [siteConfigs, setSiteConfigs] = useState<Record<string, SiteConfig>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showTextParser, setShowTextParser] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    void loadSiteConfigs();
  }, []);

  const loadSiteConfigs = async (): Promise<void> => {
    try {
      // Mock site configs for now - in real implementation this would come from storage
      const mockConfigs: Record<string, SiteConfig> = {
        'linkedin.com': {
          domain: 'linkedin.com',
          fieldMappings: {},
          customSelectors: {},
          enabled: true,
        },
        'indeed.com': {
          domain: 'indeed.com',
          fieldMappings: {},
          customSelectors: {},
          enabled: true,
        },
        'glassdoor.com': {
          domain: 'glassdoor.com',
          fieldMappings: {},
          customSelectors: {},
          enabled: true,
        },
        'monster.com': {
          domain: 'monster.com',
          fieldMappings: {},
          customSelectors: {},
          enabled: false,
        },
      };
      setSiteConfigs(mockConfigs);
    } catch (error) {
      console.error('Failed to load site configs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSiteConfig = async (domain: string, enabled: boolean): Promise<void> => {
    const config = siteConfigs[domain];
    if (!config) return;

    const updatedConfig: SiteConfig = { ...config, enabled };
    try {
      // In real implementation, this would save to storage
      setSiteConfigs(prev => ({ ...prev, [domain]: updatedConfig }));
    } catch (error) {
      console.error('Failed to update site config:', error);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const fileContent = (e.target?.result ?? '') as string;

        let profile: UserProfile | null = null;

        // Try JSON first
        try {
          const parsed = JSON.parse(fileContent);
          if (parsed && typeof parsed === 'object' && 'personalInfo' in parsed) {
            profile = parsed as UserProfile;
          }
        } catch {
          // Plain text fallback
          profile = parseTextFormat(fileContent);
        }

        if (profile) {
          await onImport(profile);
          event.target.value = ''; // Clear the file input
        } else {
          alert(
            'Invalid file format. Please use JSON files exported from this extension or plain text with the correct format.',
          );
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import profile. Please check the file format and try again.');
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      alert('Failed to read the file. Please try again.');
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const parseTextFormat = (content: string): UserProfile => {
    const lines = content.split('\n');
    const profile: Partial<UserProfile> = {
      id: `imported_${Date.now()}`,
      personalInfo: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: '',
        },
      },
      workInfo: {
        currentTitle: '',
        experience: '',
        skills: [],
        linkedinUrl: '',
        portfolioUrl: '',
        githubUrl: '',
      },
      preferences: {
        desiredSalary: '',
        availableStartDate: '',
        workAuthorization: '',
        willingToRelocate: false,
        defaultAnswers: {},
        jobPreferences: {
          workAuthorization: 'citizen',
          requiresSponsorship: false,
          willingToRelocate: false,
          availableStartDate: new Date(),
          preferredWorkType: 'remote',
        },
        privacySettings: {
          shareAnalytics: false,
          shareUsageData: false,
          allowAIContentGeneration: false,
          dataSyncEnabled: false,
        },
        aiPreferences: {
          preferredTone: 'professional',
          customInstructions: '',
          excludedFields: [],
          learningEnabled: true,
          fieldMappingPreferences: {},
          autoApproveInstructions: false,
          maxInstructionsPerForm: 5,
          confidenceThreshold: 0.8,
        },
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      },
    };

    lines.forEach(line => {
      const [rawKey, ...rest] = line.split(':');
      const key = rawKey?.trim();
      const value = rest.join(':').trim();
      if (!key || !value) return;

      switch (key.toLowerCase()) {
        case 'name': {
          const [firstName, lastName] = value.split(' ');
          profile.personalInfo!.firstName = firstName || '';
          profile.personalInfo!.lastName = lastName || '';
          break;
        }
        case 'email': {
          profile.personalInfo!.email = value;
          break;
        }
        case 'phone': {
          profile.personalInfo!.phone = value;
          break;
        }
        case 'address': {
          profile.personalInfo!.address.street = value;
          break;
        }
        case 'city': {
          profile.personalInfo!.address.city = value;
          break;
        }
        case 'state': {
          profile.personalInfo!.address.state = value;
          break;
        }
        case 'zip':
        case 'zipcode': {
          profile.personalInfo!.address.zipCode = value;
          break;
        }
        case 'country': {
          profile.personalInfo!.address.country = value;
          break;
        }
        case 'title':
        case 'job title': {
          profile.workInfo!.currentTitle = value;
          break;
        }
        case 'experience': {
          profile.workInfo!.experience = value;
          break;
        }
        case 'skills': {
          profile.workInfo!.skills = value.split(',').map(s => s.trim());
          break;
        }
        case 'linkedin': {
          profile.workInfo!.linkedinUrl = value;
          break;
        }
        case 'portfolio': {
          profile.workInfo!.portfolioUrl = value;
          break;
        }
        case 'github': {
          profile.workInfo!.githubUrl = value;
          break;
        }
        case 'salary': {
          profile.preferences!.desiredSalary = value;
          break;
        }
        case 'start date': {
          profile.preferences!.availableStartDate = value;
          break;
        }
        case 'work authorization': {
          profile.preferences!.workAuthorization = value;
          break;
        }
        case 'relocate': {
          const v = value.toLowerCase();
          profile.preferences!.willingToRelocate = v === 'yes' || v === 'true';
          break;
        }
        default:
          break;
      }
    });

    return profile as UserProfile;
  };

  const handleTextParse = async (): Promise<void> => {
    try {
      setIsImporting(true);
      const profile = parseTextFormat(textInput);
      await onImport(profile);
      setShowTextParser(false);
      setTextInput('');
    } catch (error) {
      alert('Failed to parse the text. Please check the format.');
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-sm text-gray-500">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Profile Management */}
      <div className={cn(
        'rounded-lg p-3 border',
        isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <h3 className={cn(
          'mb-2 text-sm font-medium flex items-center',
          isLight ? 'text-gray-700' : 'text-gray-200'
        )}>
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          Profile Management
        </h3>
        <div className="space-y-3">
          <label className="block">
            <span className={cn(
              'text-xs mb-1 block',
              isLight ? 'text-gray-600' : 'text-gray-400'
            )}>Import Profile:</span>
            <input
              type="file"
              accept=".json,.txt"
              onChange={handleFileImport}
              disabled={isImporting}
              className={cn(
                'block w-full text-xs file:mr-2 file:rounded file:border-0 file:px-2 file:py-1 file:text-xs file:transition-colors disabled:opacity-50',
                isLight 
                  ? 'text-gray-500 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
                  : 'text-gray-400 file:bg-blue-900/50 file:text-blue-300 hover:file:bg-blue-800/50'
              )}
            />
            <p className={cn(
              'mt-1 text-xs',
              isLight ? 'text-gray-500' : 'text-gray-400'
            )}>
              JSON files from this extension or text files like: Name: John Doe, Email: john@example.com, …
            </p>
          </label>

          <Button
            onClick={() => setShowTextParser(true)}
            disabled={isImporting}
            variant="outline"
            className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
          >
            {isImporting ? (
              <div className="flex items-center justify-center">
                <div className="inline-block w-4 h-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Importing...
              </div>
            ) : (
              'Paste from Document'
            )}
          </Button>

          {showTextParser && (
            <div className={cn(
              'rounded border p-3 shadow-sm',
              isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-600'
            )}>
              <div className="mb-2">
                <h4 className={cn(
                  'mb-1 text-xs font-medium',
                  isLight ? 'text-gray-700' : 'text-gray-200'
                )}>Paste your information here:</h4>
                <p className={cn(
                  'mb-2 text-xs',
                  isLight ? 'text-gray-500' : 'text-gray-400'
                )}>
                  Example: Name: John Doe, Email: john.doe@example.com, Phone: 123-456-7890, …
                </p>
              </div>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Name: John Doe&#10;Email: john.doe@example.com&#10;Phone: 123-456-7890&#10;Address: 123 Main St&#10;City: New York&#10;State: NY&#10;Zip: 10001&#10;Country: USA&#10;Title: Software Engineer&#10;Experience: 5 years&#10;Skills: JavaScript, React, Node.js&#10;LinkedIn: https://linkedin.com/in/johndoe&#10;Salary: $80,000&#10;Start Date: 2024-01-15&#10;Work Authorization: US Citizen&#10;Relocate: Yes"
                className={cn(
                  'h-32 w-full resize-none rounded border p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors',
                  isLight 
                    ? 'border-gray-300 bg-white text-gray-900 focus:border-blue-500'
                    : 'border-gray-600 bg-gray-700 text-gray-100 focus:border-blue-400'
                )}
                disabled={isImporting}
              />
              <div className="mt-3 flex space-x-2">
                <Button
                  onClick={handleTextParse}
                  disabled={isImporting || !textInput.trim()}
                  variant="primary"
                  className="flex-1 transition-all duration-200"
                >
                  Parse & Import
                </Button>
                <Button
                  onClick={() => {
                    setShowTextParser(false);
                    setTextInput('');
                  }}
                  disabled={isImporting}
                  variant="outline"
                  className="flex-1 transition-all duration-200"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Site Configurations */}
      <div className={cn(
        'rounded-lg p-3 border',
        isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <h3 className={cn(
          'mb-2 text-sm font-medium flex items-center',
          isLight ? 'text-gray-700' : 'text-gray-200'
        )}>
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          Supported Sites
        </h3>
        <div className="space-y-2">
          {Object.entries(siteConfigs).map(([domain, config]: [string, SiteConfig]) => (
            <div key={domain} className="flex items-center justify-between py-1">
              <span className={cn(
                'text-xs flex items-center',
                isLight ? 'text-gray-600' : 'text-gray-400'
              )}>
                <span className={`w-2 h-2 rounded-full mr-2 ${config.enabled ? 'bg-green-400' : (isLight ? 'bg-gray-300' : 'bg-gray-600')}`}></span>
                {domain}
              </span>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={!!config.enabled}
                  onChange={e => toggleSiteConfig(domain, e.target.checked)}
                  className="rounded transition-colors"
                />
                <span className={cn(
                  'ml-1 text-xs',
                  isLight ? 'text-gray-700' : 'text-gray-300'
                )}>Enabled</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* AI Settings */}
      <AIStatusIndicator onOpenSettings={() => chrome.runtime.openOptionsPage()} />

      {/* Quick Actions */}
      <div className={cn(
        'rounded-lg p-3 border',
        isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <h3 className={cn(
          'mb-2 text-sm font-medium flex items-center',
          isLight ? 'text-gray-700' : 'text-gray-200'
        )}>
          <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
          Quick Actions
        </h3>
        <div className="space-y-2">
          <Button
            onClick={() => chrome.runtime.openOptionsPage()}
            variant="outline"
            className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
          >
            Advanced Settings
          </Button>
          <Button
            onClick={() => chrome.tabs.create({ url: 'https://linkedin.com/jobs' })}
            variant="outline"
            className="w-full transition-all duration-200 hover:scale-105 active:scale-95"
          >
            Open LinkedIn Jobs
          </Button>
        </div>
      </div>

      {/* Help */}
      <div className={cn(
        'rounded-lg p-3 border',
        isLight 
          ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
          : 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-700'
      )}>
        <h3 className={cn(
          'mb-2 text-sm font-medium flex items-center',
          isLight ? 'text-blue-900' : 'text-blue-100'
        )}>
          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
          Help & Tips
        </h3>
        <div className={cn(
          'space-y-1 text-xs',
          isLight ? 'text-blue-700' : 'text-blue-300'
        )}>
          <p>• Fill out your profile completely for best results</p>
          <p>• The extension works on major job sites</p>
          <p>• Use field mapping for custom sites</p>
          <p>• Export your profile to back up your data</p>
          <p>• Use "Paste from Document" to import from Word/PDF files</p>
          <p>• Supported format: Name: John Doe, Email: john@example.com</p>
        </div>
      </div>
    </div>
  );
};