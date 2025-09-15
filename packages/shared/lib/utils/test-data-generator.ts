/**
 * Test data generator for job application autofill functionality
 * Provides comprehensive sample profile data for testing and demonstration
 */

import type {
  UserProfile,
  Address,
  WorkExperience,
  Education,
  Certification,
  JobPreferences,
  PrivacySettings,
  ResumeDocument,
  CoverLetterTemplate,
} from '../types/profile.js';
import { generateSampleResumeDocuments } from './sample-resume-generator.js';

/**
 * Generates a unique ID for test data
 */
function generateTestId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generates sample address data
 */
export function generateSampleAddress(): Address {
  return {
    street: '123 Tech Street, Apt 4B',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94105',
    country: 'United States',
  };
}

/**
 * Generates sample work experience entries (compact version)
 */
export function generateSampleWorkExperience(): WorkExperience[] {
  return [
    {
      id: generateTestId('work'),
      company: 'TechCorp Solutions',
      position: 'Senior Software Engineer',
      startDate: new Date('2022-03-01'),
      endDate: undefined,
      isCurrent: true,
      description: 'Lead development of scalable web applications using React, Node.js, and AWS. Mentored junior developers and reduced application load time by 40%.',
      location: 'San Francisco, CA',
    },
    {
      id: generateTestId('work'),
      company: 'StartupXYZ',
      position: 'Full Stack Developer',
      startDate: new Date('2020-06-15'),
      endDate: new Date('2022-02-28'),
      isCurrent: false,
      description: 'Developed full-stack applications using JavaScript, Python, and PostgreSQL. Built RESTful APIs and contributed to 25% increase in user engagement.',
      location: 'Remote',
    },
  ];
}

/**
 * Generates sample education entries (compact version)
 */
export function generateSampleEducation(): Education[] {
  return [
    {
      id: generateTestId('edu'),
      institution: 'University of California, Berkeley',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science',
      startDate: new Date('2015-08-20'),
      endDate: new Date('2019-05-15'),
      gpa: 3.7,
      honors: undefined,
    },
  ];
}

/**
 * Generates sample certifications (compact version)
 */
export function generateSampleCertifications(): Certification[] {
  return [
    {
      id: generateTestId('cert'),
      name: 'AWS Certified Solutions Architect',
      issuer: 'Amazon Web Services',
      issueDate: new Date('2023-03-15'),
      expirationDate: new Date('2026-03-15'),
      credentialId: 'AWS-CSA-2023-001234',
      credentialUrl: undefined,
    },
  ];
}

/**
 * Generates sample skills list (compact version)
 */
export function generateSampleSkills(): string[] {
  return [
    'JavaScript',
    'TypeScript',
    'Python',
    'React',
    'Node.js',
    'AWS',
    'PostgreSQL',
    'Docker',
    'Git',
    'Agile/Scrum',
    'RESTful APIs',
    'System Design',
    'Team Leadership',
    'Problem Solving',
  ];
}

/**
 * Generates sample job preferences
 */
export function generateSampleJobPreferences(): JobPreferences {
  return {
    desiredSalaryMin: 120000,
    desiredSalaryMax: 180000,
    workAuthorization: 'citizen',
    requiresSponsorship: false,
    willingToRelocate: true,
    availableStartDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    preferredWorkType: 'hybrid',
    noticePeriod: '2 weeks',
  };
}

/**
 * Generates sample privacy settings
 */
export function generateSamplePrivacySettings(): PrivacySettings {
  return {
    shareAnalytics: true,
    shareUsageData: true,
    allowAIContentGeneration: true,
    dataSyncEnabled: true,
  };
}

/**
 * Generates sample default answers for common questions (compact version)
 */
export function generateSampleDefaultAnswers(): Record<string, string> {
  return {
    // Essential answers only to reduce storage size
    'work_authorization': 'I am authorized to work in the United States without sponsorship.',
    'visa_sponsorship': 'No, I do not require visa sponsorship.',
    'start_date': 'I am available to start within 2-4 weeks notice.',
    'salary_expectations': 'My salary expectations are competitive and negotiable.',
    'relocation': 'Yes, I am open to relocating for the right opportunity.',
    'remote_work': 'I am comfortable with remote, hybrid, or on-site work arrangements.',
    'years_experience': 'I have 5+ years of professional software development experience.',
    'relevant_experience': 'My experience aligns with the requirements through full-stack development and cloud technologies.',
    'why_interested': 'I am excited about this opportunity because it aligns with my career goals.',
    'learning_new_technologies': 'Yes, I am passionate about learning new technologies and staying current with industry trends.',
    'team_collaboration': 'I thrive in collaborative environments and have experience working with diverse teams.',
    'references': 'Yes, I can provide professional references from current and former colleagues.',
  };
}





/**
 * Generates a complete sample user profile with all test data
 */
export function generateSampleUserProfile(): UserProfile {
  const profileId = generateTestId('profile');
  const now = new Date();
  
  return {
    id: profileId,
    personalInfo: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@email.com',
      phone: '+1 (555) 123-4567',
      address: generateSampleAddress(),
      linkedInUrl: 'https://linkedin.com/in/johndoe',
      portfolioUrl: 'https://johndoe.dev',
      githubUrl: 'https://github.com/johndoe',
    },
    professionalInfo: {
      workExperience: generateSampleWorkExperience(),
      education: generateSampleEducation(),
      skills: generateSampleSkills(),
      certifications: generateSampleCertifications(),
      summary: 'Experienced Software Engineer with 5+ years in full-stack development and cloud technologies. Passionate about building scalable applications.',
    },
    preferences: {
      defaultAnswers: generateSampleDefaultAnswers(),
      jobPreferences: generateSampleJobPreferences(),
      privacySettings: generateSamplePrivacySettings(),
      aiPreferences: {
        preferredTone: 'professional',
        excludedFields: ['ssn', 'social_security'],
        learningEnabled: true,
        fieldMappingPreferences: {},
        autoApproveInstructions: false,
        maxInstructionsPerForm: 50,
        confidenceThreshold: 70,
      },
    },
    documents: {
      resumes: [], // Keep empty to reduce storage size
      coverLetters: [],
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      lastSyncAt: undefined,
      version: 1,
    },
  };
}

/**
 * Alternative sample profiles for different personas
 */
export function generateAlternativeSampleProfiles(): { [key: string]: UserProfile } {
  return {
    'frontend-developer': {
      ...generateSampleUserProfile(),
      personalInfo: {
        ...generateSampleUserProfile().personalInfo,
        firstName: 'Sarah',
        lastName: 'Chen',
        email: 'sarah.chen@email.com',
      },
      professionalInfo: {
        ...generateSampleUserProfile().professionalInfo,
        workExperience: [
          {
            id: generateTestId('work'),
            company: 'Design Studio Pro',
            position: 'Senior Frontend Developer',
            startDate: new Date('2021-08-01'),
            endDate: undefined,
            isCurrent: true,
            description: 'Lead frontend development using React, Vue.js, and modern CSS frameworks. Create responsive user interfaces.',
            location: 'New York, NY',
          },
        ],
        skills: ['React', 'Vue.js', 'JavaScript', 'TypeScript', 'HTML5', 'CSS3', 'Tailwind CSS', 'Figma'],
      },
      documents: {
        resumes: [],
        coverLetters: [],
      },
    },
    
    'backend-developer': {
      ...generateSampleUserProfile(),
      personalInfo: {
        ...generateSampleUserProfile().personalInfo,
        firstName: 'Michael',
        lastName: 'Rodriguez',
        email: 'michael.rodriguez@email.com',
      },
      professionalInfo: {
        ...generateSampleUserProfile().professionalInfo,
        workExperience: [
          {
            id: generateTestId('work'),
            company: 'CloudTech Systems',
            position: 'Senior Backend Engineer',
            startDate: new Date('2020-03-01'),
            endDate: undefined,
            isCurrent: true,
            description: 'Design scalable backend services using Python, Go, and microservices architecture. Manage database systems.',
            location: 'Seattle, WA',
          },
        ],
        skills: ['Python', 'Go', 'PostgreSQL', 'MongoDB', 'Docker', 'Kubernetes', 'AWS', 'RESTful APIs'],
      },
      documents: {
        resumes: [],
        coverLetters: [],
      },
    },
  };
}

/**
 * Validates that generated test data meets profile requirements
 */
export function validateTestData(profile: UserProfile): boolean {
  try {
    // Basic validation checks
    const hasRequiredPersonalInfo = !!(
      profile.personalInfo.firstName &&
      profile.personalInfo.lastName &&
      profile.personalInfo.email &&
      profile.personalInfo.phone &&
      profile.personalInfo.address.street &&
      profile.personalInfo.address.city &&
      profile.personalInfo.address.state &&
      profile.personalInfo.address.zipCode &&
      profile.personalInfo.address.country
    );

    const hasProfessionalInfo = !!(
      profile.professionalInfo.workExperience.length > 0 &&
      profile.professionalInfo.education.length > 0 &&
      profile.professionalInfo.skills.length > 0
    );

    const hasPreferences = !!(
      profile.preferences.defaultAnswers &&
      Object.keys(profile.preferences.defaultAnswers).length > 0 &&
      profile.preferences.jobPreferences
    );

    return hasRequiredPersonalInfo && hasProfessionalInfo && hasPreferences;
  } catch (error) {
    console.error('Test data validation failed:', error);
    return false;
  }
}

/**
 * Generates role-specific default answers for different job types
 */
export function generateRoleSpecificDefaultAnswers(role: 'frontend' | 'backend' | 'fullstack' | 'devops' | 'mobile' | 'data'): Record<string, string> {
  const baseAnswers = generateSampleDefaultAnswers();
  
  const roleSpecificAnswers: Record<string, Record<string, string>> = {
    frontend: {
      'technical_skills': 'I have strong expertise in React, Vue.js, TypeScript, and modern CSS frameworks, with a focus on user experience and performance optimization.',
      'relevant_experience': 'My experience includes building responsive web applications, implementing design systems, and optimizing frontend performance for large-scale applications.',
      'why_interested': 'I am passionate about creating exceptional user experiences and am excited about the opportunity to work on user-facing features that directly impact customer satisfaction.',
      'learning_new_technologies': 'I stay current with frontend trends including new JavaScript frameworks, CSS methodologies, and web performance optimization techniques.',
    },
    backend: {
      'technical_skills': 'I have extensive experience with server-side technologies including Python, Node.js, database design, and cloud infrastructure management.',
      'relevant_experience': 'My background includes designing scalable APIs, implementing microservices architectures, and optimizing database performance for high-traffic applications.',
      'why_interested': 'I am drawn to the technical challenges of building robust, scalable systems that power great user experiences.',
      'learning_new_technologies': 'I continuously learn about new backend technologies, cloud services, and system architecture patterns to build more efficient and scalable solutions.',
    },
    fullstack: {
      'technical_skills': 'I have comprehensive experience across the full technology stack, from frontend frameworks to backend services and database design.',
      'relevant_experience': 'I have built end-to-end applications, managed the complete development lifecycle, and collaborated effectively with both frontend and backend specialists.',
      'why_interested': 'I enjoy the variety and challenge of full-stack development, being able to contribute across all layers of an application.',
      'learning_new_technologies': 'I stay current with both frontend and backend technologies, focusing on how they integrate to create seamless user experiences.',
    },
    devops: {
      'technical_skills': 'I have strong expertise in cloud platforms (AWS, GCP), containerization (Docker, Kubernetes), CI/CD pipelines, and infrastructure as code.',
      'relevant_experience': 'My experience includes implementing automated deployment pipelines, managing cloud infrastructure, and improving system reliability and performance.',
      'why_interested': 'I am passionate about enabling development teams to deliver software faster and more reliably through improved tooling and processes.',
      'learning_new_technologies': 'I continuously learn about new cloud services, automation tools, and monitoring solutions to improve development and deployment workflows.',
    },
    mobile: {
      'technical_skills': 'I have experience developing mobile applications for iOS and Android using native technologies and cross-platform frameworks like React Native.',
      'relevant_experience': 'I have built and published mobile apps, implemented mobile-specific features like push notifications and offline functionality, and optimized for mobile performance.',
      'why_interested': 'I am excited about mobile development because of the direct impact on user daily lives and the unique challenges of mobile platforms.',
      'learning_new_technologies': 'I stay current with mobile development trends, new platform features, and emerging technologies like AR/VR integration.',
    },
    data: {
      'technical_skills': 'I have strong expertise in data analysis, machine learning, Python, SQL, and data visualization tools like Tableau and D3.js.',
      'relevant_experience': 'My experience includes building data pipelines, implementing machine learning models, and creating insights that drive business decisions.',
      'why_interested': 'I am passionate about extracting meaningful insights from data and using analytics to solve complex business problems.',
      'learning_new_technologies': 'I continuously learn about new data science tools, machine learning techniques, and big data technologies to improve analysis capabilities.',
    },
  };

  return {
    ...baseAnswers,
    ...roleSpecificAnswers[role],
  };
}

/**
 * Generates industry-specific default answers
 */
export function generateIndustrySpecificDefaultAnswers(industry: 'fintech' | 'healthcare' | 'ecommerce' | 'gaming' | 'enterprise' | 'startup'): Record<string, string> {
  const baseAnswers = generateSampleDefaultAnswers();
  
  const industrySpecificAnswers: Record<string, Record<string, string>> = {
    fintech: {
      'why_interested': 'I am excited about the intersection of technology and finance, and the opportunity to build solutions that improve financial accessibility and security.',
      'relevant_experience': 'I have experience with secure payment processing, financial data handling, and regulatory compliance requirements in financial technology.',
      'security_clearance': 'I understand the importance of security in financial services and am willing to obtain any required clearances.',
      'compliance_experience': 'I have experience working with financial regulations and understand the importance of compliance in fintech applications.',
    },
    healthcare: {
      'why_interested': 'I am passionate about using technology to improve healthcare outcomes and make medical services more accessible and efficient.',
      'relevant_experience': 'I have experience with healthcare data standards (HIPAA, HL7), electronic health records, and building secure, compliant healthcare applications.',
      'background_check': 'Yes, I am willing to undergo comprehensive background checks required for healthcare technology roles.',
      'patient_data': 'I understand the critical importance of patient privacy and have experience implementing HIPAA-compliant systems.',
    },
    ecommerce: {
      'why_interested': 'I am excited about building technology that directly impacts customer experience and drives business growth in the digital marketplace.',
      'relevant_experience': 'I have experience with e-commerce platforms, payment processing, inventory management systems, and customer analytics.',
      'scale_experience': 'I have worked on high-traffic applications and understand the challenges of scaling e-commerce systems during peak periods.',
      'customer_focus': 'I am passionate about creating seamless customer experiences that drive engagement and conversion.',
    },
    gaming: {
      'why_interested': 'I am passionate about gaming and excited about the opportunity to create engaging experiences that bring joy to millions of players.',
      'relevant_experience': 'I have experience with game development frameworks, real-time systems, and the unique technical challenges of interactive entertainment.',
      'creativity': 'I enjoy the creative aspects of game development and collaborating with designers and artists to bring ideas to life.',
      'player_experience': 'I am committed to creating games that are fun, engaging, and accessible to diverse audiences.',
    },
    enterprise: {
      'why_interested': 'I am excited about building robust, scalable solutions that help large organizations operate more efficiently and effectively.',
      'relevant_experience': 'I have experience with enterprise software development, integration with legacy systems, and meeting the complex requirements of large organizations.',
      'scale_complexity': 'I understand the challenges of enterprise software including security, compliance, scalability, and integration requirements.',
      'stakeholder_management': 'I have experience working with multiple stakeholders and translating business requirements into technical solutions.',
    },
    startup: {
      'why_interested': 'I am excited about the fast-paced startup environment and the opportunity to have significant impact on product development and company growth.',
      'relevant_experience': 'I have experience working in agile environments, wearing multiple hats, and adapting quickly to changing requirements and priorities.',
      'equity_interest': 'Yes, I am very interested in equity participation and being part of the company\'s growth story.',
      'flexibility': 'I thrive in dynamic environments and am comfortable with ambiguity and rapid change typical of startup environments.',
    },
  };

  return {
    ...baseAnswers,
    ...industrySpecificAnswers[industry],
  };
}

/**
 * Generates cover letter templates for different job types
 */
export function generateSampleCoverLetterTemplates(): CoverLetterTemplate[] {
  return [
    {
      id: generateTestId('cover'),
      name: 'Software Engineer Cover Letter',
      content: `Dear Hiring Manager,

I am writing to express my strong interest in the Software Engineer position at [COMPANY_NAME]. With over 5 years of experience in full-stack development and a proven track record of delivering scalable solutions, I am excited about the opportunity to contribute to your team.

In my current role as Senior Software Engineer at TechCorp Solutions, I have:
• Led the development of high-performance web applications serving 100K+ users
• Implemented microservices architecture that improved system reliability by 35%
• Mentored junior developers and established coding best practices
• Collaborated with product teams to deliver features that increased user engagement by 25%

My technical expertise includes JavaScript/TypeScript, React, Node.js, Python, and cloud technologies (AWS, Docker, Kubernetes). I am particularly drawn to [COMPANY_NAME] because of [SPECIFIC_REASON] and believe my experience in [RELEVANT_SKILL] would be valuable to your team.

I would welcome the opportunity to discuss how my skills and passion for technology can contribute to [COMPANY_NAME]'s continued success. Thank you for your consideration.

Best regards,
John Doe`,
      isDefault: true,
      createdDate: new Date('2024-01-10'),
      lastModified: new Date('2024-02-15'),
    },
    {
      id: generateTestId('cover'),
      name: 'Senior Developer Cover Letter',
      content: `Dear [HIRING_MANAGER_NAME],

I am excited to apply for the Senior Developer position at [COMPANY_NAME]. Your commitment to innovation and technical excellence aligns perfectly with my career aspirations and values.

Throughout my career, I have consistently delivered high-quality software solutions while leading technical initiatives. At StartupXYZ, I architected and implemented a distributed system that processed millions of transactions daily, resulting in a 40% improvement in performance and 99.9% uptime.

Key highlights of my experience include:
• 5+ years of full-stack development with modern technologies
• Experience scaling applications from startup to enterprise level
• Strong background in system design and architecture
• Proven ability to lead technical teams and mentor developers

I am particularly interested in [COMPANY_NAME] because of your work in [SPECIFIC_AREA] and would love to contribute to your mission of [COMPANY_MISSION].

I look forward to the opportunity to discuss how I can help drive technical excellence at [COMPANY_NAME].

Sincerely,
John Doe`,
      isDefault: false,
      createdDate: new Date('2024-01-20'),
      lastModified: new Date('2024-01-25'),
    },
    {
      id: generateTestId('cover'),
      name: 'Frontend Developer Cover Letter',
      content: `Dear Hiring Team,

I am writing to apply for the Frontend Developer position at [COMPANY_NAME]. As a passionate frontend developer with expertise in modern web technologies, I am excited about the opportunity to create exceptional user experiences for your customers.

In my role as Senior Frontend Developer at Design Studio Pro, I have:
• Built responsive, accessible web applications using React and Vue.js
• Collaborated closely with UX designers to implement pixel-perfect interfaces
• Optimized application performance, reducing load times by 50%
• Led the implementation of a design system used across multiple products

My technical skills include React, Vue.js, TypeScript, modern CSS frameworks, and performance optimization. I am particularly excited about [COMPANY_NAME]'s focus on user experience and would love to contribute to creating products that users love.

I believe my combination of technical skills and design sensibility would be valuable to your frontend team. I would welcome the opportunity to discuss how I can help enhance your user interfaces and overall user experience.

Thank you for your consideration.

Best regards,
Sarah Chen`,
      isDefault: false,
      createdDate: new Date('2024-02-01'),
      lastModified: new Date('2024-02-05'),
    },
    {
      id: generateTestId('cover'),
      name: 'Backend Developer Cover Letter',
      content: `Dear [HIRING_MANAGER_NAME],

I am excited to apply for the Backend Developer position at [COMPANY_NAME]. With extensive experience in server-side development and distributed systems, I am eager to contribute to building robust, scalable backend infrastructure.

At CloudTech Systems, I have been responsible for:
• Designing and implementing microservices architecture serving millions of requests
• Optimizing database performance and implementing efficient caching strategies
• Building secure APIs and ensuring system reliability and uptime
• Mentoring team members on backend best practices and system design

My expertise includes Python, Go, PostgreSQL, Redis, Docker, Kubernetes, and cloud platforms (AWS, GCP). I am particularly drawn to [COMPANY_NAME]'s technical challenges and the opportunity to work on systems at scale.

I am confident that my experience in building high-performance backend systems and my passion for clean, maintainable code would be valuable additions to your engineering team.

I look forward to discussing how I can contribute to [COMPANY_NAME]'s backend infrastructure and technical goals.

Sincerely,
Michael Rodriguez`,
      isDefault: false,
      createdDate: new Date('2024-02-10'),
      lastModified: new Date('2024-02-12'),
    },
  ];
}