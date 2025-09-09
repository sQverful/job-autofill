/**
 * Test file for intelligent detection system
 * This file demonstrates and tests the intelligent autofill capabilities
 */

import { IntelligentAutofillEngine } from './intelligent-autofill-engine';
import type { UserProfile } from '@extension/shared';

// Mock user profile for testing
const mockProfile: UserProfile = {
  id: 'test-user',
  personalInfo: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    address: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'United States'
    },
    linkedInUrl: 'https://linkedin.com/in/johndoe',
    portfolioUrl: 'https://johndoe.dev',
    githubUrl: 'https://github.com/johndoe'
  },
  professionalInfo: {
    summary: 'Experienced software engineer with 5+ years in full-stack development.',
    workExperience: [
      {
        id: '1',
        company: 'Tech Corp',
        position: 'Senior Software Engineer',
        startDate: '2020-01-01',
        endDate: null,
        description: 'Lead developer for web applications',
        isCurrentPosition: true
      }
    ],
    education: [
      {
        id: '1',
        institution: 'University of California',
        degree: 'Bachelor of Science',
        field: 'Computer Science',
        startDate: '2015-09-01',
        endDate: '2019-06-01',
        gpa: '3.8'
      }
    ],
    skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python'],
    certifications: []
  },
  preferences: {
    jobPreferences: {
      desiredSalaryMin: 120000,
      desiredSalaryMax: 150000,
      availableStartDate: '2024-01-15',
      workAuthorization: 'US Citizen',
      willingToRelocate: false,
      preferredLocations: ['San Francisco', 'Remote']
    },
    defaultAnswers: {
      'work_authorization': 'Yes, I am authorized to work in the US',
      'sponsorship_required': 'No',
      'willing_to_relocate': 'No, I prefer to work remotely',
      'salary_expectation': '$120,000 - $150,000',
      'start_date': 'January 15, 2024',
      'cover_letter': 'I am excited about this opportunity...',
      'gender_identity': 'Prefer not to say',
      'transgender': 'Prefer not to say',
      'sexual_orientation': 'Prefer not to say',
      'disability': 'Prefer not to say',
      'neurodivergent': 'Prefer not to say',
      'ethnicity': 'Prefer not to say',
      'veteran_status': 'Prefer not to say',
      'privacy_consent': 'Yes',
      'pronouns': 'he/him',
      'name_pronunciation': 'John Doe'
    },
    privacySettings: {
      shareProfile: true,
      allowAnalytics: true
    }
  },
  documents: {
    resumes: [
      {
        id: '1',
        name: 'John_Doe_Resume.pdf',
        url: '/documents/resume.pdf',
        uploadedAt: new Date(),
        isDefault: true
      }
    ],
    coverLetters: []
  },
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSyncAt: new Date()
  }
};

/**
 * Test the intelligent autofill system
 */
export class IntelligentAutofillTester {
  private engine: IntelligentAutofillEngine;

  constructor() {
    this.engine = new IntelligentAutofillEngine({
      enableLearning: true,
      enableFileUpload: true,
      enableDynamicMonitoring: true,
      maxRetries: 3,
      retryDelay: 500
    });

    this.setupProgressCallback();
  }

  /**
   * Setup progress callback to log autofill progress
   */
  private setupProgressCallback(): void {
    this.engine.setProgressCallback((progress) => {
      console.log('Autofill Progress:', {
        status: progress.status,
        filled: progress.filledFields,
        total: progress.totalFields,
        skipped: progress.skippedFields,
        errors: progress.errorFields,
        current: progress.currentField
      });
    });
  }

  /**
   * Test form detection on current page
   */
  async testFormDetection(): Promise<void> {
    console.log('=== Testing Intelligent Form Detection ===');
    
    try {
      const forms = await this.engine.detectForms();
      
      console.log(`Detected ${forms.length} forms:`);
      
      for (const form of forms) {
        console.log(`Form: ${form.formId}`);
        console.log(`  Platform: ${form.platform}`);
        console.log(`  Confidence: ${form.confidence}`);
        console.log(`  Fields: ${form.fields.length}`);
        console.log(`  Multi-step: ${form.isMultiStep}`);
        console.log(`  Supported features: ${form.supportedFeatures.join(', ')}`);
        
        // Log field details
        for (const field of form.fields) {
          console.log(`    Field: ${field.label} (${field.type})`);
          console.log(`      Selector: ${field.selector}`);
          console.log(`      Mapped to: ${field.mappedProfileField || 'unmapped'}`);
          console.log(`      Required: ${field.required}`);
        }
      }
    } catch (error) {
      console.error('Form detection test failed:', error);
    }
  }

  /**
   * Test component detection on specific elements
   */
  async testComponentDetection(): Promise<void> {
    console.log('=== Testing Component Detection ===');
    
    // Test on various input elements
    const testSelectors = [
      'input[type="text"]',
      'input[type="email"]',
      'select',
      'textarea',
      '.react-select__control',
      '.v-select',
      'mat-form-field'
    ];

    for (const selector of testSelectors) {
      const elements = document.querySelectorAll(selector);
      
      for (let i = 0; i < Math.min(elements.length, 3); i++) {
        const element = elements[i] as HTMLElement;
        
        try {
          const detection = await this.engine.testComponentDetection(element);
          
          if (detection) {
            console.log(`Component detected for ${selector}:`);
            console.log(`  Type: ${detection.type}`);
            console.log(`  Confidence: ${detection.confidence}`);
            console.log(`  Interaction method: ${detection.interactionMethod}`);
            console.log(`  Framework: ${detection.metadata.framework}`);
          } else {
            console.log(`No component detection for ${selector}`);
          }
        } catch (error) {
          console.warn(`Component detection failed for ${selector}:`, error);
        }
      }
    }
  }

  /**
   * Test full autofill process
   */
  async testAutofill(): Promise<void> {
    console.log('=== Testing Full Autofill Process ===');
    
    try {
      // First detect forms
      const forms = await this.engine.detectForms();
      
      if (forms.length === 0) {
        console.log('No forms detected for autofill test');
        return;
      }

      // Perform autofill
      const result = await this.engine.performAutofill(forms, mockProfile);
      
      console.log('Autofill Result:');
      console.log(`  Success: ${result.success}`);
      console.log(`  Filled: ${result.filledCount}/${result.totalFields} fields`);
      console.log(`  Duration: ${result.duration}ms`);
      console.log(`  Skipped: ${result.skippedFields.length} fields`);
      console.log(`  Errors: ${result.errors.length} fields`);

      // Log details
      if (result.filledFields && result.filledFields.length > 0) {
        console.log('Filled fields:');
        for (const field of result.filledFields) {
          console.log(`  - ${field.selector}: ${field.value} (${field.method})`);
        }
      }

      if (result.skippedFields.length > 0) {
        console.log('Skipped fields:');
        for (const field of result.skippedFields) {
          console.log(`  - ${field.selector}: ${field.reason}`);
        }
      }

      if (result.errors.length > 0) {
        console.log('Error fields:');
        for (const error of result.errors) {
          console.log(`  - ${error.selector}: ${error.error}`);
        }
      }
    } catch (error) {
      console.error('Autofill test failed:', error);
    }
  }

  /**
   * Test file upload detection and guidance
   */
  async testFileUpload(): Promise<void> {
    console.log('=== Testing File Upload Detection ===');
    
    const fileInputs = document.querySelectorAll('input[type="file"]');
    
    if (fileInputs.length === 0) {
      console.log('No file inputs found on page');
      return;
    }

    for (const input of fileInputs) {
      const fileInput = input as HTMLInputElement;
      
      // Create a test file
      const testFile = new File(['test content'], 'test-resume.pdf', { 
        type: 'application/pdf' 
      });

      try {
        const guidance = this.engine.getFileUploadGuidance(fileInput, testFile);
        
        console.log(`File input guidance for ${fileInput.name || 'unnamed'}:`);
        for (const step of guidance) {
          console.log(`  ${step}`);
        }
      } catch (error) {
        console.warn('File upload guidance failed:', error);
      }
    }
  }

  /**
   * Test dynamic form monitoring
   */
  testDynamicMonitoring(): void {
    console.log('=== Testing Dynamic Form Monitoring ===');
    
    const formStates = this.engine.getFormStates();
    
    console.log(`Currently monitoring ${formStates.size} forms:`);
    
    for (const [formId, state] of formStates) {
      console.log(`Form ${formId}:`);
      console.log(`  Step: ${state.step}/${state.totalSteps}`);
      console.log(`  Filled fields: ${state.filledFields.size}`);
      console.log(`  Pending fields: ${state.pendingFields.length}`);
      console.log(`  Last modified: ${state.lastModified}`);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Intelligent Autofill Tests');
    console.log('=====================================');
    
    await this.testFormDetection();
    console.log('');
    
    await this.testComponentDetection();
    console.log('');
    
    await this.testFileUpload();
    console.log('');
    
    this.testDynamicMonitoring();
    console.log('');
    
    await this.testAutofill();
    console.log('');
    
    console.log('✅ All tests completed');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.engine.cleanup();
  }
}

// Auto-run tests if this file is loaded directly
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const tester = new IntelligentAutofillTester();
      
      // Add global test function for manual testing
      (window as any).testIntelligentAutofill = () => tester.runAllTests();
      (window as any).intelligentAutofillTester = tester;
      
      console.log('Intelligent Autofill Tester loaded. Run testIntelligentAutofill() to start tests.');
    });
  } else {
    const tester = new IntelligentAutofillTester();
    
    // Add global test function for manual testing
    (window as any).testIntelligentAutofill = () => tester.runAllTests();
    (window as any).intelligentAutofillTester = tester;
    
    console.log('Intelligent Autofill Tester loaded. Run testIntelligentAutofill() to start tests.');
  }
}

export { IntelligentAutofillTester };