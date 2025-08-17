import '@src/Options.css';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { ProfileManager } from './components/ProfileManager';
import { profileStorage } from '@extension/storage';
import type { UserProfile } from '@extension/shared';

const Options = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = isLight ? 'options/logo_horizontal.svg' : 'options/logo_horizontal_dark.svg';

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

  return (
    <div className={cn('min-h-screen', isLight ? 'bg-slate-50 text-gray-900' : 'bg-gray-800 text-gray-100')}>
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button onClick={goGithubSite}>
                <img src={chrome.runtime.getURL(logo)} className="h-8" alt="logo" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Job Application Autofill
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <ToggleButton onClick={exampleThemeStorage.toggle}>
                {t('toggleTheme')}
              </ToggleButton>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <ProfileManager onSave={handleSaveProfile} />
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
