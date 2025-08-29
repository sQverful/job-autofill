/**
 * Sample resume file generator for testing purposes
 * Creates downloadable sample resume content and file handling utilities
 */

import type { ResumeDocument } from '../types/profile.js';

/**
 * Generates sample resume content in text format
 */
export function generateSampleResumeContent(profileType: 'default' | 'frontend-developer' | 'backend-developer' = 'default'): string {
  const resumeTemplates = {
    default: `JOHN DOE
Software Engineer

Email: john.doe@email.com
Phone: +1 (555) 123-4567
Location: San Francisco, CA
LinkedIn: linkedin.com/in/johndoe
GitHub: github.com/johndoe
Portfolio: johndoe.dev

PROFESSIONAL SUMMARY
Experienced Software Engineer with 5+ years of expertise in full-stack development, cloud technologies, and team leadership. Passionate about building scalable applications and mentoring developers. Proven track record of delivering high-quality solutions that drive business growth and improve user experience.

TECHNICAL SKILLS
• Programming Languages: JavaScript, TypeScript, Python, Java, Go, SQL
• Frontend Technologies: React, Vue.js, Angular, HTML5, CSS3, Sass/SCSS, Tailwind CSS
• Backend Technologies: Node.js, Express.js, Django, Flask, Spring Boot, RESTful APIs, GraphQL
• Databases: PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch
• Cloud & DevOps: AWS, Google Cloud Platform, Docker, Kubernetes, Jenkins, GitLab CI/CD, Terraform
• Tools & Methodologies: Git, Agile/Scrum, Test-Driven Development, Microservices, System Design

PROFESSIONAL EXPERIENCE

Senior Software Engineer | TechCorp Solutions | March 2022 - Present
• Lead development of scalable web applications using React, Node.js, and AWS serving 100K+ users
• Collaborated with cross-functional teams to deliver high-quality software solutions
• Mentored junior developers and implemented best practices for code quality and testing
• Reduced application load time by 40% through performance optimization
• Implemented microservices architecture improving system reliability by 35%

Full Stack Developer | StartupXYZ | June 2020 - February 2022
• Developed and maintained full-stack applications using JavaScript, Python, and PostgreSQL
• Built RESTful APIs and integrated third-party services
• Participated in agile development processes and code reviews
• Contributed to a 25% increase in user engagement through feature development
• Worked in a fast-paced startup environment with rapid iteration cycles

Junior Software Developer | Digital Innovations Inc | January 2019 - June 2020
• Assisted in developing web applications and mobile apps
• Worked with senior developers to implement new features and fix bugs
• Gained experience in version control, testing, and deployment processes
• Contributed to improving code documentation and development workflows
• Participated in daily standups and sprint planning meetings

EDUCATION

Bachelor of Science in Computer Science | University of California, Berkeley | 2015 - 2019
• GPA: 3.7/4.0, Magna Cum Laude
• Relevant Coursework: Data Structures, Algorithms, Software Engineering, Database Systems
• Senior Project: Built a real-time collaborative code editor using WebSockets and React

Machine Learning Certificate | Stanford University | September 2021 - January 2022
• Completed comprehensive program covering supervised and unsupervised learning
• Implemented machine learning models using Python, TensorFlow, and scikit-learn
• Final Project: Developed a recommendation system for e-commerce applications

CERTIFICATIONS
• AWS Certified Solutions Architect (March 2023 - March 2026)
• Certified Kubernetes Administrator (November 2022 - November 2025)
• Google Cloud Professional Developer (January 2023 - January 2025)

PROJECTS

E-Commerce Platform | Personal Project | 2023
• Built a full-stack e-commerce application using React, Node.js, and PostgreSQL
• Implemented secure payment processing with Stripe integration
• Deployed on AWS with auto-scaling and load balancing
• Technologies: React, Node.js, PostgreSQL, AWS, Docker, Stripe API

Task Management System | Open Source Contribution | 2022
• Contributed to an open-source task management application
• Implemented real-time notifications using WebSockets
• Added user authentication and authorization features
• Technologies: Vue.js, Express.js, MongoDB, Socket.io

ACHIEVEMENTS
• Led a team of 5 developers in delivering a critical project 2 weeks ahead of schedule
• Reduced system downtime by 60% through improved monitoring and alerting
• Mentored 8 junior developers, with 6 receiving promotions within 18 months
• Speaker at Bay Area JavaScript Meetup (2023): "Building Scalable React Applications"`,

    'frontend-developer': `SARAH CHEN
Senior Frontend Developer

Email: sarah.chen@email.com
Phone: +1 (555) 987-6543
Location: New York, NY
LinkedIn: linkedin.com/in/sarahchen
GitHub: github.com/sarahchen
Portfolio: sarahchen.design

PROFESSIONAL SUMMARY
Creative and detail-oriented Senior Frontend Developer with 4+ years of experience building responsive, accessible web applications. Expertise in modern JavaScript frameworks, UI/UX design principles, and performance optimization. Passionate about creating exceptional user experiences and collaborating with design teams to bring ideas to life.

TECHNICAL SKILLS
• Frontend Frameworks: React, Vue.js, Angular, Next.js, Nuxt.js
• Languages: JavaScript, TypeScript, HTML5, CSS3
• Styling: Sass/SCSS, Tailwind CSS, Styled Components, CSS Modules
• Build Tools: Webpack, Vite, Parcel, Rollup
• Design Tools: Figma, Adobe XD, Sketch, Photoshop
• Testing: Jest, Cypress, Testing Library, Storybook
• Performance: Lighthouse, Web Vitals, Bundle Analysis
• Accessibility: WCAG 2.1, ARIA, Screen Reader Testing

PROFESSIONAL EXPERIENCE

Senior Frontend Developer | Design Studio Pro | August 2021 - Present
• Lead frontend development for client projects using React, Vue.js, and modern CSS frameworks
• Collaborate with UX designers to create pixel-perfect, responsive user interfaces
• Optimize web performance achieving 95+ Lighthouse scores across all metrics
• Implement accessibility standards ensuring WCAG 2.1 AA compliance
• Mentor junior developers and conduct code reviews
• Built and maintained design system used across 15+ projects

Frontend Developer | Creative Agency Inc | March 2020 - August 2021
• Developed responsive websites and web applications for diverse clients
• Worked closely with designers to implement interactive prototypes
• Improved page load speeds by 50% through code splitting and lazy loading
• Implemented A/B testing frameworks to optimize user conversion rates
• Collaborated with backend teams to integrate RESTful APIs

Junior Frontend Developer | WebTech Solutions | June 2019 - March 2020
• Built user interfaces using React and modern JavaScript
• Converted design mockups into responsive, interactive web pages
• Participated in daily standups and sprint planning meetings
• Learned best practices for version control and collaborative development
• Contributed to improving development workflows and documentation

EDUCATION

Bachelor of Arts in Digital Design | Parsons School of Design | 2015 - 2019
• GPA: 3.8/4.0, Dean's List
• Relevant Coursework: Web Design, User Experience Design, Interactive Media
• Senior Thesis: "The Impact of Micro-Interactions on User Engagement"

Frontend Development Bootcamp | General Assembly | 2019
• Intensive 12-week program covering modern web development
• Built 5 full-stack applications using React, Node.js, and MongoDB
• Graduated with honors and received job placement assistance

PROJECTS

Personal Portfolio Website | 2023
• Designed and developed responsive portfolio showcasing design and development work
• Implemented smooth animations and micro-interactions using Framer Motion
• Achieved 100% Lighthouse performance score
• Technologies: Next.js, TypeScript, Tailwind CSS, Framer Motion

E-Learning Platform UI | Client Project | 2022
• Led frontend development for online education platform serving 10K+ students
• Implemented complex data visualization components for student progress tracking
• Built responsive design system with 50+ reusable components
• Technologies: React, TypeScript, D3.js, Styled Components

ACHIEVEMENTS
• Improved client website conversion rates by 35% through UX optimization
• Led redesign project that increased user engagement by 60%
• Created design system adopted by 3 different development teams
• Speaker at React NYC Meetup (2023): "Building Accessible React Components"`,

    'backend-developer': `MICHAEL RODRIGUEZ
Senior Backend Engineer

Email: michael.rodriguez@email.com
Phone: +1 (555) 456-7890
Location: Seattle, WA
LinkedIn: linkedin.com/in/michaelrodriguez
GitHub: github.com/mrodriguez

PROFESSIONAL SUMMARY
Experienced Backend Engineer with 6+ years of expertise in designing and implementing scalable server-side systems. Strong background in microservices architecture, database optimization, and cloud infrastructure. Passionate about building robust, high-performance systems that can handle millions of requests while maintaining reliability and security.

TECHNICAL SKILLS
• Programming Languages: Python, Go, Java, JavaScript/Node.js, SQL
• Frameworks: Django, Flask, FastAPI, Express.js, Spring Boot
• Databases: PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, Cassandra
• Cloud Platforms: AWS, Google Cloud Platform, Azure
• DevOps: Docker, Kubernetes, Jenkins, GitLab CI/CD, Terraform, Ansible
• Message Queues: RabbitMQ, Apache Kafka, Amazon SQS
• Monitoring: Prometheus, Grafana, ELK Stack, New Relic
• API Design: RESTful APIs, GraphQL, gRPC, OpenAPI/Swagger

PROFESSIONAL EXPERIENCE

Senior Backend Engineer | CloudTech Systems | March 2020 - Present
• Design and implement scalable backend services using Python, Go, and microservices architecture
• Manage database systems and optimize query performance for applications serving 1M+ users
• Build and maintain CI/CD pipelines and cloud infrastructure on AWS and GCP
• Lead architecture decisions for distributed systems handling 10M+ requests daily
• Mentor junior engineers and conduct technical interviews
• Reduced system latency by 45% through database optimization and caching strategies

Backend Developer | DataFlow Inc | January 2018 - March 2020
• Developed RESTful APIs and microservices using Python Django and PostgreSQL
• Implemented real-time data processing pipelines using Apache Kafka
• Optimized database queries reducing response times by 60%
• Built automated testing and deployment pipelines using Jenkins and Docker
• Collaborated with frontend teams to design efficient API contracts

Software Engineer | StartupTech | June 2017 - January 2018
• Built backend services for mobile and web applications using Node.js and MongoDB
• Implemented user authentication and authorization systems
• Developed data analytics pipelines for business intelligence
• Participated in on-call rotation for production system maintenance
• Contributed to system architecture and technology stack decisions

EDUCATION

Bachelor of Science in Computer Science | University of Washington | 2013 - 2017
• GPA: 3.6/4.0
• Relevant Coursework: Database Systems, Distributed Systems, Computer Networks, Algorithms
• Senior Project: Built a distributed file storage system using Go and consensus algorithms

AWS Solutions Architecture Certification Program | 2021
• Comprehensive training in cloud architecture and AWS services
• Hands-on experience with EC2, RDS, Lambda, API Gateway, and more
• Capstone project: Designed and implemented a serverless web application

CERTIFICATIONS
• AWS Certified Solutions Architect - Professional (2022 - 2025)
• Google Cloud Professional Cloud Architect (2021 - 2024)
• Certified Kubernetes Administrator (CKA) (2020 - 2023)

PROJECTS

Distributed Task Queue System | Open Source | 2023
• Built a high-performance distributed task queue using Go and Redis
• Implemented horizontal scaling and fault tolerance mechanisms
• Achieved 99.9% uptime and 10K+ tasks per second throughput
• Technologies: Go, Redis, Docker, Kubernetes

Real-time Analytics Platform | Personal Project | 2022
• Developed a real-time data processing system using Apache Kafka and Python
• Implemented stream processing for handling 100K+ events per second
• Built REST APIs for data visualization and reporting
• Technologies: Python, Apache Kafka, PostgreSQL, Docker

ACHIEVEMENTS
• Designed architecture that reduced infrastructure costs by 40% while improving performance
• Led migration from monolithic to microservices architecture serving 5M+ users
• Implemented monitoring system that reduced mean time to recovery by 70%
• Mentored 6 junior engineers, with 4 receiving promotions within 2 years`
  };

  return resumeTemplates[profileType];
}

/**
 * Creates a sample resume file blob for download/upload testing
 */
export function createSampleResumeBlob(profileType: 'default' | 'frontend-developer' | 'backend-developer' = 'default'): Blob {
  const content = generateSampleResumeContent(profileType);
  return new Blob([content], { type: 'text/plain' });
}

/**
 * Generates sample resume document metadata
 */
export function generateSampleResumeDocuments(profileType: 'default' | 'frontend-developer' | 'backend-developer' = 'default'): ResumeDocument[] {
  const generateTestId = (prefix: string): string => {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const profileNames = {
    default: 'John Doe',
    'frontend-developer': 'Sarah Chen',
    'backend-developer': 'Michael Rodriguez',
  };

  const profileName = profileNames[profileType];
  const fileNameBase = profileName.toLowerCase().replace(' ', '_');

  return [
    {
      id: generateTestId('resume'),
      name: `${profileName} - Software Engineer Resume`,
      fileName: `${fileNameBase}_resume_2024.pdf`,
      fileSize: 245760, // ~240KB
      fileType: 'pdf',
      uploadDate: new Date('2024-01-15'),
      isDefault: true,
      cloudUrl: undefined, // Will be set when actual file is uploaded
      localPath: undefined,
    },
    {
      id: generateTestId('resume'),
      name: `${profileName} - Technical Resume`,
      fileName: `${fileNameBase}_technical_resume.pdf`,
      fileSize: 198432, // ~194KB
      fileType: 'pdf',
      uploadDate: new Date('2024-02-01'),
      isDefault: false,
      cloudUrl: undefined,
      localPath: undefined,
    },
  ];
}

/**
 * Creates a downloadable sample resume file
 */
export function downloadSampleResume(profileType: 'default' | 'frontend-developer' | 'backend-developer' = 'default'): void {
  const blob = createSampleResumeBlob(profileType);
  const url = URL.createObjectURL(blob);
  
  const profileNames = {
    default: 'john_doe',
    'frontend-developer': 'sarah_chen',
    'backend-developer': 'michael_rodriguez',
  };
  
  const fileName = `${profileNames[profileType]}_sample_resume.txt`;
  
  // Create download link
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Simulates file upload for testing purposes
 */
export function simulateResumeUpload(profileType: 'default' | 'frontend-developer' | 'backend-developer' = 'default'): File {
  const blob = createSampleResumeBlob(profileType);
  
  const profileNames = {
    default: 'john_doe',
    'frontend-developer': 'sarah_chen',
    'backend-developer': 'michael_rodriguez',
  };
  
  const fileName = `${profileNames[profileType]}_sample_resume.txt`;
  
  // Create a File object from the blob
  return new File([blob], fileName, { type: 'text/plain' });
}

/**
 * Validates sample resume file for testing
 */
export function validateSampleResumeFile(file: File): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check file size (should be reasonable for a resume)
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    errors.push('File size exceeds 5MB limit');
  }
  
  if (file.size < 1024) { // 1KB minimum
    errors.push('File size is too small to be a valid resume');
  }
  
  // Check file type
  const allowedTypes = ['text/plain', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowedTypes.includes(file.type)) {
    errors.push('File type not supported. Please use PDF, DOC, DOCX, or TXT files.');
  }
  
  // Check file name
  if (!file.name || file.name.length < 3) {
    errors.push('Invalid file name');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates sample cover letter content
 */
export function generateSampleCoverLetterContent(
  profileType: 'default' | 'frontend-developer' | 'backend-developer' = 'default',
  companyName: string = '[COMPANY_NAME]',
  position: string = '[POSITION_TITLE]'
): string {
  const coverLetterTemplates = {
    default: `Dear Hiring Manager,

I am writing to express my strong interest in the ${position} position at ${companyName}. With over 5 years of experience in full-stack development and a proven track record of delivering scalable solutions, I am excited about the opportunity to contribute to your team.

In my current role as Senior Software Engineer at TechCorp Solutions, I have led the development of high-performance web applications serving 100K+ users, implemented microservices architecture that improved system reliability by 35%, and mentored junior developers while establishing coding best practices.

My technical expertise includes JavaScript/TypeScript, React, Node.js, Python, and cloud technologies (AWS, Docker, Kubernetes). I am particularly drawn to ${companyName} because of your commitment to innovation and technical excellence, and I believe my experience in building scalable systems would be valuable to your team.

I would welcome the opportunity to discuss how my skills and passion for technology can contribute to ${companyName}'s continued success. Thank you for your consideration.

Best regards,
John Doe`,

    'frontend-developer': `Dear Hiring Team,

I am excited to apply for the ${position} position at ${companyName}. As a passionate frontend developer with expertise in modern web technologies and a strong eye for design, I am eager to contribute to creating exceptional user experiences for your customers.

In my role as Senior Frontend Developer at Design Studio Pro, I have built responsive, accessible web applications using React and Vue.js, collaborated closely with UX designers to implement pixel-perfect interfaces, and optimized application performance achieving 95+ Lighthouse scores across all metrics.

My technical skills include React, Vue.js, TypeScript, modern CSS frameworks, and performance optimization. I am particularly excited about ${companyName}'s focus on user experience and would love to contribute to creating products that users love.

I believe my combination of technical skills and design sensibility would be valuable to your frontend team. I would welcome the opportunity to discuss how I can help enhance your user interfaces and overall user experience.

Thank you for your consideration.

Best regards,
Sarah Chen`,

    'backend-developer': `Dear Hiring Manager,

I am writing to express my strong interest in the ${position} position at ${companyName}. With extensive experience in server-side development and distributed systems, I am eager to contribute to building robust, scalable backend infrastructure.

At CloudTech Systems, I have been responsible for designing and implementing microservices architecture serving millions of requests, optimizing database performance and implementing efficient caching strategies, and building secure APIs while ensuring system reliability and uptime.

My expertise includes Python, Go, PostgreSQL, Redis, Docker, Kubernetes, and cloud platforms (AWS, GCP). I am particularly drawn to ${companyName}'s technical challenges and the opportunity to work on systems at scale.

I am confident that my experience in building high-performance backend systems and my passion for clean, maintainable code would be valuable additions to your engineering team.

I look forward to discussing how I can contribute to ${companyName}'s backend infrastructure and technical goals.

Sincerely,
Michael Rodriguez`
  };

  return coverLetterTemplates[profileType];
}

/**
 * Creates a sample cover letter file blob
 */
export function createSampleCoverLetterBlob(
  profileType: 'default' | 'frontend-developer' | 'backend-developer' = 'default',
  companyName?: string,
  position?: string
): Blob {
  const content = generateSampleCoverLetterContent(profileType, companyName, position);
  return new Blob([content], { type: 'text/plain' });
}