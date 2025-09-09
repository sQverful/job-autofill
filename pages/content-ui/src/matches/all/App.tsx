import { useEffect, useState } from 'react';
import { AutofillButton } from '../../components/AutofillButton';
import type { UserProfile } from '@extension/shared';

export default function App() {
  const [isVisible, setIsVisible] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<'idle' | 'detecting' | 'filling' | 'success' | 'error'>('idle');
  const [lastResult, setLastResult] = useState<{ filledCount: number; totalFields: number } | null>(null);
  const [formDetectionStatus, setFormDetectionStatus] = useState<'idle' | 'detecting' | 'found' | 'none'>('idle');
  const [detectedFormsCount, setDetectedFormsCount] = useState(0);
  const [animationPreferences, setAnimationPreferences] = useState({ 
    enableAnimations: true, 
    respectReducedMotion: true 
  });

  useEffect(() => {
    console.log('[Job Autofill] Content UI loaded');
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAnimationPreferences(prev => ({ 
      ...prev, 
      enableAnimations: !prefersReducedMotion || !prev.respectReducedMotion 
    }));
    
    // Check if we're on a job site and show the autofill button
    checkForJobForms();
    
    // Load user profile
    loadUserProfile();
    
    // Listen for messages from popup or background
    const messageListener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === 'AUTOFILL_TRIGGER') {
        handleAutofill();
      }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const checkForJobForms = () => {
    setFormDetectionStatus('detecting');
    
    // Animate form detection process
    setTimeout(() => {
      // Check if current page has job application forms
      const jobSites = ['linkedin.com', 'indeed.com', 'glassdoor.com', 'monster.com', 'ziprecruiter.com'];
      const currentDomain = window.location.hostname;
      
      const isJobSite = jobSites.some(site => currentDomain.includes(site));
      const forms = document.querySelectorAll('form');
      const formsCount = forms.length;
      
      setDetectedFormsCount(formsCount);
      
      if (isJobSite && formsCount > 0) {
        setFormDetectionStatus('found');
        setIsVisible(true);
        
        // Add subtle animation to detected forms if animations are enabled
        if (animationPreferences.enableAnimations) {
          forms.forEach((form, index) => {
            setTimeout(() => {
              form.style.transition = 'box-shadow 0.3s ease';
              form.style.boxShadow = '0 0 0 1px rgba(59, 130, 246, 0.3)';
              setTimeout(() => {
                form.style.boxShadow = '';
              }, 1000);
            }, index * 200);
          });
        }
      } else {
        setFormDetectionStatus(formsCount > 0 ? 'found' : 'none');
        if (formsCount > 0) {
          setIsVisible(true);
        }
      }
    }, 500);
  };

  const loadUserProfile = async () => {
    try {
      // In a real implementation, this would load from storage
      // For now, we'll simulate loading
      setUserProfile({
        id: 'demo',
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '123-456-7890',
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zipCode: '10001',
            country: 'USA'
          }
        },
        workInfo: {
          currentTitle: 'Software Engineer',
          experience: '5 years',
          skills: ['JavaScript', 'React', 'Node.js']
        },
        preferences: {
          desiredSalary: '$80,000',
          workAuthorization: 'US Citizen',
          willingToRelocate: false
        }
      } as UserProfile);
    } catch (error) {
      console.error('[Job Autofill] Failed to load profile:', error);
    }
  };

  const handleAutofill = async () => {
    if (!userProfile) {
      setAutofillStatus('error');
      setTimeout(() => setAutofillStatus('idle'), 3000);
      return;
    }

    setIsLoading(true);
    setAutofillStatus('detecting');

    try {
      // Form detection phase
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const forms = document.querySelectorAll('form');
      if (forms.length === 0) {
        throw new Error('No forms found on this page');
      }

      setAutofillStatus('filling');

      let totalFields = 0;
      let filledCount = 0;
      let errorCount = 0;

      for (const form of forms) {
        const inputs = form.querySelectorAll('input, textarea, select');
        totalFields += inputs.length;

        for (const input of inputs) {
          const element = input as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          
          try {
            // Skip disabled or readonly fields
            if (element.hasAttribute('disabled') || element.hasAttribute('readonly')) {
              continue;
            }

            // Add highlight animation if animations are enabled
            if (animationPreferences.enableAnimations) {
              element.style.transition = 'all 0.3s ease';
              element.style.boxShadow = '0 0 0 2px #3b82f6';
              element.style.backgroundColor = '#dbeafe';
            }
            
            // Simulate filling delay for visual feedback
            await new Promise(resolve => setTimeout(resolve, animationPreferences.enableAnimations ? 100 : 10));
            
            // Fill field based on type/name/id
            const fieldName = (element.name || element.id || '').toLowerCase();
            const fieldType = element.type?.toLowerCase() || '';
            let filled = false;

            if (fieldType === 'email' || fieldName.includes('email')) {
              element.value = userProfile.personalInfo.email;
              filled = true;
            } else if (fieldName.includes('first') || fieldName.includes('fname') || fieldName.includes('given')) {
              element.value = userProfile.personalInfo.firstName;
              filled = true;
            } else if (fieldName.includes('last') || fieldName.includes('lname') || fieldName.includes('surname') || fieldName.includes('family')) {
              element.value = userProfile.personalInfo.lastName;
              filled = true;
            } else if (fieldType === 'tel' || fieldName.includes('phone') || fieldName.includes('mobile')) {
              element.value = userProfile.personalInfo.phone;
              filled = true;
            } else if (fieldName.includes('address') && !fieldName.includes('email')) {
              element.value = userProfile.personalInfo.address?.street || '';
              filled = true;
            } else if (fieldName.includes('city')) {
              element.value = userProfile.personalInfo.address?.city || '';
              filled = true;
            } else if (fieldName.includes('state') || fieldName.includes('province')) {
              element.value = userProfile.personalInfo.address?.state || '';
              filled = true;
            } else if (fieldName.includes('zip') || fieldName.includes('postal')) {
              element.value = userProfile.personalInfo.address?.zipCode || '';
              filled = true;
            } else if (fieldName.includes('country')) {
              element.value = userProfile.personalInfo.address?.country || '';
              filled = true;
            } else if (fieldName.includes('title') || fieldName.includes('position')) {
              element.value = userProfile.workInfo.currentTitle;
              filled = true;
            } else if (fieldName.includes('linkedin')) {
              element.value = userProfile.workInfo.linkedinUrl;
              filled = true;
            } else if (fieldName.includes('portfolio') || fieldName.includes('website')) {
              element.value = userProfile.workInfo.portfolioUrl;
              filled = true;
            } else if (fieldName.includes('github')) {
              element.value = userProfile.workInfo.githubUrl;
              filled = true;
            } else if (fieldName.includes('salary')) {
              element.value = userProfile.preferences.desiredSalary;
              filled = true;
            } else if (fieldName.includes('start') && fieldName.includes('date')) {
              element.value = userProfile.preferences.availableStartDate;
              filled = true;
            } else if (fieldName.includes('authorization') || fieldName.includes('visa')) {
              element.value = userProfile.preferences.workAuthorization;
              filled = true;
            } else if (fieldName.includes('relocate') && element.type === 'checkbox') {
              (element as HTMLInputElement).checked = userProfile.preferences.willingToRelocate;
              filled = true;
            }

            if (filled) {
              filledCount++;
              
              // Trigger change event for React/Vue forms
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              // Success animation
              if (animationPreferences.enableAnimations) {
                element.style.backgroundColor = '#dcfce7';
                element.style.borderColor = '#22c55e';
              }
            }
            
            // Remove highlight after filling
            if (animationPreferences.enableAnimations) {
              setTimeout(() => {
                element.style.boxShadow = '';
                element.style.backgroundColor = '';
                element.style.borderColor = '';
              }, 500);
            }
          } catch (fieldError) {
            console.warn('[Job Autofill] Failed to fill field:', fieldError);
            errorCount++;
            
            // Error animation
            if (animationPreferences.enableAnimations) {
              element.style.backgroundColor = '#fecaca';
              element.style.borderColor = '#ef4444';
              setTimeout(() => {
                element.style.backgroundColor = '';
                element.style.borderColor = '';
                element.style.boxShadow = '';
              }, 1000);
            }
          }
        }
      }

      setLastResult({ filledCount, totalFields });
      
      if (filledCount === 0) {
        throw new Error('No matching fields found to fill');
      } else if (errorCount > 0) {
        console.warn(`[Job Autofill] Completed with ${errorCount} errors`);
      }
      
      setAutofillStatus('success');
      
      // Reset status after 5 seconds for success
      setTimeout(() => {
        setAutofillStatus('idle');
        setLastResult(null);
      }, 5000);

    } catch (error) {
      console.error('[Job Autofill] Failed to fill form:', error);
      setAutofillStatus('error');
      
      // Reset status after 4 seconds for errors
      setTimeout(() => setAutofillStatus('idle'), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className="fixed top-4 right-4 z-[10000] bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm animate-in slide-in-from-right-5 duration-300"
      role="dialog"
      aria-labelledby="autofill-title"
      aria-describedby="autofill-description"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 id="autofill-title" className="text-sm font-semibold text-gray-800 flex items-center">
          <span 
            className={`w-2 h-2 bg-blue-500 rounded-full mr-2 ${animationPreferences.enableAnimations ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          ></span>
          Job Autofill
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none transition-colors hover:scale-110 transform"
          aria-label="Close autofill panel"
          type="button"
        >
          ×
        </button>
      </div>
      
      {/* Form Detection Status */}
      {formDetectionStatus !== 'idle' && (
        <div className={`mb-3 p-2 rounded text-xs text-center transition-all duration-300 ${
          formDetectionStatus === 'detecting' ? 'bg-blue-100 text-blue-800' :
          formDetectionStatus === 'found' ? 'bg-green-100 text-green-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {formDetectionStatus === 'detecting' && (
            <div className="flex items-center justify-center">
              <div className="inline-block w-3 h-3 mr-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Scanning for forms...
            </div>
          )}
          {formDetectionStatus === 'found' && 
            `Found ${detectedFormsCount} form${detectedFormsCount > 1 ? 's' : ''} on this page`}
          {formDetectionStatus === 'none' && 'No job application forms detected'}
        </div>
      )}

      {/* Autofill Status Display */}
      {autofillStatus !== 'idle' && (
        <div className={`mb-3 p-2 rounded text-xs text-center transition-all duration-300 ${
          autofillStatus === 'detecting' ? 'bg-blue-100 text-blue-800' :
          autofillStatus === 'filling' ? 'bg-yellow-100 text-yellow-800' :
          autofillStatus === 'success' ? 'bg-green-100 text-green-800' :
          'bg-red-100 text-red-800'
        }`}>
          {autofillStatus === 'detecting' && (
            <div className="flex items-center justify-center">
              <div className="inline-block w-3 h-3 mr-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Analyzing forms...
            </div>
          )}
          {autofillStatus === 'filling' && (
            <div className="flex items-center justify-center">
              <div className="inline-block w-3 h-3 mr-2 border border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
              Filling form fields...
            </div>
          )}
          {autofillStatus === 'success' && lastResult && (
            <div className="flex items-center justify-center">
              <div className="inline-block w-3 h-3 mr-2 text-green-600">✓</div>
              Successfully filled {lastResult.filledCount} of {lastResult.totalFields} fields
            </div>
          )}
          {autofillStatus === 'error' && (
            <div className="flex items-center justify-center">
              <div className="inline-block w-3 h-3 mr-2 text-red-600">✗</div>
              Failed to fill form - please try again
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <AutofillButton 
          onClick={handleAutofill}
          disabled={!userProfile}
          isLoading={isLoading}
        />
        
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className={`w-full px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-all duration-200 ${
            animationPreferences.enableAnimations ? 'hover:scale-105 active:scale-95' : ''
          }`}
          aria-label="Open profile management page"
          type="button"
        >
          Manage Profile
        </button>
      </div>

      {/* Profile Status Indicator */}
      <div className="mt-3 pt-2 border-t border-gray-200">
        <div className="flex items-center text-xs text-gray-600" id="autofill-description">
          <div 
            className={`w-2 h-2 rounded-full mr-2 ${userProfile ? 'bg-green-400' : 'bg-red-400'}`}
            aria-hidden="true"
          ></div>
          <span role="status" aria-live="polite">
            {userProfile ? 'Profile Ready' : 'Profile Incomplete'}
          </span>
        </div>
      </div>
    </div>
  );
}
