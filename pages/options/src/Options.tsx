import '@src/Options.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { ProfileManager } from './components/ProfileManager';
import { AIConfigurationManager } from './components/AIConfigurationManager';
import { profileStorage } from '@extension/storage';
import type { UserProfile, AISettings } from '@extension/shared';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = isLight ? 'options/icon-16.png' : 'options/icon-16.png';

  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  const handleSaveProfile = async (profile: UserProfile) => {
    try {
      // Save to profile storage
      await profileStorage.set(profile);
      console.log('Profile saved successfully');
    } catch (error) {
      console.error('Failed to save profile:', error);
      throw error;
    }
  };

  const handleAISettingsChange = (settings: AISettings) => {
    console.log('AI settings updated:', settings);
  };

  return (
    <div className={cn('min-h-screen', isLight ? 'bg-slate-50 text-gray-900' : 'bg-gray-900 text-gray-100')}>
      {/* Header */}
      <header
        className={cn('border-b shadow-sm', isLight ? 'border-gray-200 bg-white' : 'border-gray-700 bg-gray-800')}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={goGithubSite}>
                <img src={chrome.runtime.getURL(logo)} className="h-8" alt="logo" />
              </button>
              <h1 className={cn('text-xl font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>Apply Ninja</h1>
            </div>

            <div className="flex items-center space-x-4">
              <ToggleButton showLabel={true}>{t('toggleTheme')}</ToggleButton>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className="max-w-4xl mx-auto px-6 space-y-8">
          {/* AI Configuration Section */}
          <section>
            <AIConfigurationManager onSettingsChange={handleAISettingsChange} />
          </section>
          
          {/* Profile Management Section */}
          <section>
            <ProfileManager onSave={handleSaveProfile} />
          </section>
        </div>
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
