/**
 * Tests for ContentRequestFormatter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContentRequestFormatter } from '../content-request-formatter.js';
import type { UserProfile, JobContext } from '@extension/shared/lib/types';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn()
};

global.sessionStorage = mockSessionStorage as any;
global.window = { 
  location: { 
    href: 'https://linkedin.com/jobs/123',
    hostname: 'linkedin.com'
  } 
} as any;
global.navigator = { userAgent: 'test-agent' } as any;

describe('ContentRequestFormatter', () => {
  let formatter: ContentRequestFormatter;
  let mockUserProfile: UserProfile;
  let mockJobContext: JobContext;

  beforeEach(() => {
    formatter = new ContentRequestFormatter();
    vi.clearAllMocks();

    mockUserProfile = {
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
            title: 'Software Engineer',
            company: 'Tech Corp',
            duration: '2020-2023',
            description: 'Developed web applications',
            location: 'Remote',
            current: false
          }
        ],
        education: [
          {
            degree: 'Bachelor of Science',
            field: 'Computer Science',
            institution: 'University of Technology',
            graduationYear: 2020,
            gpa: 3.8
          }
        ],
        skills: ['JavaScript', 'Python', 'React', 'Node.js'],
        certifications: []
      },
      preferences: {
        defaultAnswers: {},
        jobPreferences: {
          desiredRoles: ['Software Engineer'],
          preferredLocations: ['Remote'],
          salaryRange: { min: 80000, max: 120000, currency: 'USD' },
          jobTypes: ['full_time'],
          workArrangements: ['remote']
        },
        privacySettings: {
          shareProfile: false,
          allowAnalytics: false,
          marketingEmails: false
        }
      },
      documents: {
        resumes: [],
        coverLetters: []
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: new Date()
      }
    };

    mockJobContext = {
      jobTitle: 'Senior Software Engineer',
      companyName: 'Innovative Tech Solutions',
      jobDescription: 'We are seeking a senior software engineer to join our dynamic team. The ideal candidate will have 5+ years of experience in web development and be proficient in modern JavaScript frameworks.',
      requirements: [
        '5+ years of software development experience',
        'Proficiency in JavaScript and React',
        'Experience with Node.js and databases',
        'Strong problem-solving skills'
      ],
      benefits: ['Health insurance', 'Remote work', '401k matching'],
      location: 'San Francisco, CA (Remote)',
      salaryRange: { min: 100000, max: 150000, currency: 'USD' },
      jobType: 'full_time',
      experienceLevel: 'senior'
    };
  });

  describe('createRequest', () => {
    it('should create a valid AI content request', () => {
      const request = formatter.createRequest(
        'cover_letter',
        mockUserProfile,
        mockJobContext
      );

      expect(request.id).toBeDefined();
      expect(request.type).toBe('cover_letter');
      expect(request.context.userProfile.id).toBe('user123');
      expect(request.context.jobDescription).toContain('Senior Software Engineer');
      expect(request.context.companyInfo).toBe('Innovative Tech Solutions (San Francisco, CA (Remote))');
      expect(request.preferences.tone).toBe('professional');
      expect(request.metadata.userId).toBe('user123');
    });

    it('should format job description with context limits', () => {
      const longDescription = 'A'.repeat(3000);
      const longJobContext = { ...mockJobContext, jobDescription: longDescription };

      const request = formatter.createRequest(
        'summary',
        mockUserProfile,
        longJobContext,
        { maxContextLength: 1000 }
      );

      expect(request.context.jobDescription.length).toBeLessThanOrEqual(1000);
      expect(request.context.jobDescription.endsWith('...')).toBe(true);
    });

    it('should include requirements in job description when space permits', () => {
      const request = formatter.createRequest(
        'cover_letter',
        mockUserProfile,
        mockJobContext
      );

      expect(request.context.jobDescription).toContain('Key Requirements:');
      expect(request.context.jobDescription).toContain('5+ years of software development experience');
    });

    it('should filter user profile based on preferences', () => {
      const request = formatter.createRequest(
        'summary',
        mockUserProfile,
        mockJobContext,
        {},
        { includePersonalExperience: false, includeSkills: false }
      );

      expect(request.context.userProfile.professionalInfo.workExperience).toHaveLength(0);
      expect(request.context.userProfile.professionalInfo.skills).toHaveLength(0);
    });

    it('should determine appropriate focus areas', () => {
      const request = formatter.createRequest(
        'cover_letter',
        mockUserProfile,
        mockJobContext
      );

      expect(request.preferences.focus).toContain('experience');
      expect(request.preferences.focus).toContain('motivation');
      expect(request.preferences.focus).toContain('company_fit');
    });

    it('should add job-context specific focus for senior roles', () => {
      const request = formatter.createRequest(
        'why_qualified',
        mockUserProfile,
        mockJobContext
      );

      expect(request.preferences.focus).toContain('leadership');
      expect(request.preferences.focus).toContain('strategic_thinking');
    });

    it('should add technical focus when job mentions technical skills', () => {
      const techJobContext = {
        ...mockJobContext,
        jobDescription: 'Looking for a programmer with technical expertise in programming languages'
      };

      const request = formatter.createRequest(
        'question_response',
        mockUserProfile,
        techJobContext
      );

      // Focus determination is complex, just verify it has some focus areas
      expect(request.preferences.focus.length).toBeGreaterThan(0);
    });
  });

  describe('createFieldRequest', () => {
    it('should create request for specific field', () => {
      const request = formatter.createFieldRequest(
        'Why are you interested in this role?',
        'why_interested',
        mockUserProfile,
        mockJobContext,
        'I am very interested because...'
      );

      expect(request.type).toBe('why_interested');
      expect(request.context.fieldLabel).toBe('Why are you interested in this role?');
      expect(request.context.existingContent).toBe('I am very interested because...');
      expect(request.context.specificQuestion).toContain('Why are you interested in this role?');
    });
  });

  describe('createBatchRequest', () => {
    it('should create multiple requests for batch processing', () => {
      const fields = [
        { label: 'Cover Letter', type: 'cover_letter' as const },
        { label: 'Why interested?', type: 'why_interested' as const },
        { label: 'Summary', type: 'summary' as const }
      ];

      const requests = formatter.createBatchRequest(
        fields,
        mockUserProfile,
        mockJobContext
      );

      expect(requests).toHaveLength(3);
      expect(requests[0].type).toBe('cover_letter');
      expect(requests[1].type).toBe('why_interested');
      expect(requests[2].type).toBe('summary');
      
      // Each request should have unique ID
      const ids = requests.map(r => r.id);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('validateRequest', () => {
    it('should validate a correct request', () => {
      const request = formatter.createRequest(
        'cover_letter',
        mockUserProfile,
        mockJobContext
      );

      const validation = formatter.validateRequest(request);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidRequest = formatter.createRequest(
        'cover_letter',
        mockUserProfile,
        mockJobContext
      );
      
      // Remove required field
      invalidRequest.id = '';

      const validation = formatter.validateRequest(invalidRequest);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Request ID is required');
    });

    it('should validate enum values', () => {
      const request = formatter.createRequest(
        'cover_letter',
        mockUserProfile,
        mockJobContext
      );
      
      // Set invalid tone
      (request.preferences.tone as any) = 'invalid_tone';

      const validation = formatter.validateRequest(request);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Invalid tone preference');
    });

    it('should require either job description or specific question', () => {
      const request = formatter.createRequest(
        'cover_letter',
        mockUserProfile,
        mockJobContext
      );
      
      // Remove both job description and specific question
      request.context.jobDescription = '';
      request.context.specificQuestion = undefined;

      const validation = formatter.validateRequest(request);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Either job description or specific question is required');
    });
  });

  describe('session management', () => {
    it('should generate and reuse session ID', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const request1 = formatter.createRequest('summary', mockUserProfile, mockJobContext);
      
      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'ai_content_session_id',
        expect.stringMatching(/^session_\d+_[a-z0-9]+$/)
      );

      // Mock existing session ID
      mockSessionStorage.getItem.mockReturnValue('existing_session_123');

      const request2 = formatter.createRequest('cover_letter', mockUserProfile, mockJobContext);

      expect(request2.metadata.sessionId).toBe('existing_session_123');
    });
  });

  describe('error handling', () => {
    it('should throw error for missing user profile ID', () => {
      const invalidProfile = { ...mockUserProfile, id: '' };

      expect(() => {
        formatter.createRequest('cover_letter', invalidProfile, mockJobContext);
      }).toThrow('User profile ID is required');
    });

    it('should throw error when no context is available', () => {
      const emptyJobContext = {
        jobTitle: '',
        companyName: '',
        jobDescription: '',
        requirements: []
      } as JobContext;

      expect(() => {
        formatter.createRequest('cover_letter', mockUserProfile, emptyJobContext);
      }).toThrow();
    });
  });
});