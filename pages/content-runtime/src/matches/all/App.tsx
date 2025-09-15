import { useEffect, useState } from 'react';
import { AIContentManager } from '../../components/ai-content/AIContentManager';
import { useAIContent } from '../../hooks/useAIContent';
import { detectAICompatibleFields, createFieldMonitor, type DetectedField } from '../../utils/fieldDetection';
import type { AIContentManagerConfig, UserProfile } from '@extension/content-script/src/ai-content';
import '../../components/ai-content/ai-content.css';

// Mock user profile - in real implementation this would come from storage
const mockUserProfile: UserProfile = {
  id: 'user123',
  personalInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-0123',
    address: {
      street: '123 Main St',
      city: 'Anytown',
      state: 'ST',
      zipCode: '12345',
      country: 'US'
    }
  },
  professionalInfo: {
    workExperience: [
      {
        id: '1',
        position: 'Software Engineer',
        company: 'Tech Corp',
        startDate: new Date('2020-01-01'),
        endDate: new Date('2023-12-31'),
        isCurrent: false,
        description: 'Developed web applications',
        location: 'Remote'
      }
    ],
    education: [
      {
        id: '1',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
        institution: 'University of Technology',
        startDate: new Date('2016-09-01'),
        endDate: new Date('2020-05-31'),
        gpa: 3.8
      }
    ],
    skills: ['JavaScript', 'Python', 'React', 'Node.js'],
    certifications: []
  },
  preferences: {
    defaultAnswers: {},
    jobPreferences: {
      workAuthorization: 'citizen' as const,
      requiresSponsorship: false,
      willingToRelocate: true,
      availableStartDate: new Date(),
      preferredWorkType: 'remote' as const
    },
    privacySettings: {
      shareAnalytics: false,
      shareUsageData: false,
      allowAIContentGeneration: true,
      dataSyncEnabled: false
    },
    aiPreferences: {
      preferredTone: 'professional',
      excludedFields: [],
      learningEnabled: true,
      fieldMappingPreferences: {},
      autoApproveInstructions: false,
      maxInstructionsPerForm: 5,
      confidenceThreshold: 0.8
    }
  },
  documents: {
    resumes: [],
    coverLetters: []
  },
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncAt: new Date(),
    version: 1
  }
};

// Mock AI config - in real implementation this would come from settings
const mockAIConfig: AIContentManagerConfig = {
  aiClient: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 1000,
    temperature: 0.7,
    timeout: 30000,
    retryAttempts: 3
  },
  contentSettings: {
    enableCache: true,
    cacheExpiration: 3600000, // 1 hour in milliseconds
    maxCacheSize: 100,
    enableFallback: true,
    fallbackTemplates: true
  },
  uiSettings: {
    showIndicators: true,
    enablePreview: true,
    autoDetectFields: true,
    showAlternatives: true
  },
  permissions: {
    allowDataCollection: false,
    allowAnalytics: false,
    allowImprovement: true
  }
};

export default function App() {
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [isAIEnabled, setIsAIEnabled] = useState(false);

  const {
    generateContent,
    isServiceAvailable,
    serviceHealth,
    jobContext,
    refreshJobContext
  } = useAIContent({
    config: mockAIConfig,
    userProfile: mockUserProfile,
    onJobContextChange: (context) => {
      console.log('[AI Content] Job context updated:', context);
    }
  });

  useEffect(() => {
    console.log('[CEB] All runtime content view loaded');
    
    // Detect if we're on a job application page
    const isJobApplicationPage = 
      window.location.href.includes('jobs') ||
      window.location.href.includes('apply') ||
      window.location.href.includes('career') ||
      document.querySelector('form[class*="job"], form[class*="apply"], form[class*="application"]');

    if (isJobApplicationPage) {
      setIsAIEnabled(true);
      
      // Set up field monitoring
      const cleanup = createFieldMonitor((fields) => {
        console.log('[AI Content] Detected fields:', fields);
        setDetectedFields(fields);
      });

      return cleanup;
    }
    
    // Return undefined for non-job application pages
    return undefined;
  }, []);

  // Show AI content manager only if enabled and fields are detected
  if (!isAIEnabled || detectedFields.length === 0) {
    return (
      <div className="ceb-all-runtime-content-view-text">
        {isAIEnabled ? 'Scanning for form fields...' : 'All runtime content view'}
      </div>
    );
  }

  return (
    <div className="ai-content-app">
      <AIContentManager
        config={mockAIConfig}
        onGenerateContent={generateContent}
        detectedFields={detectedFields}
      />
      
      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.8)', 
          color: 'white', 
          padding: '10px', 
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 99999
        }}>
          <div>AI Service: {isServiceAvailable ? '✅' : '❌'}</div>
          <div>Fields: {detectedFields.length}</div>
          <div>Job Context: {jobContext ? '✅' : '❌'}</div>
          <div>Response Time: {serviceHealth.responseTime}ms</div>
        </div>
      )}
    </div>
  );
}
