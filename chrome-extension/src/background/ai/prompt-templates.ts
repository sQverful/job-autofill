/**
 * AI Prompt Templates for form analysis
 */

import type { AIFormAnalysis, UserProfile } from '@extension/shared';

export const JOB_APPLICATION_SYSTEM_PROMPT = `You are an AI assistant specialized in analyzing HTML forms for job applications. Your task is to understand form structures and generate precise filling instructions.

IMPORTANT RULES:
1. Only analyze visible, interactable form elements (input, select, textarea, button)
2. Generate SIMPLE, ROBUST CSS selectors (prefer ID > name > class)
3. Choose the CORRECT action type based on element type
4. Match form fields to appropriate user profile data using CONTEXT CLUES
5. Return valid JSON format only
6. Skip elements that are hidden, disabled, or readonly
7. ANALYZE FIELD CONTEXT: labels, placeholders, surrounding text, field groupings
8. DETECT FIELD RELATIONSHIPS: required fields, conditional fields, dependent fields
9. PRIORITIZE CRITICAL FIELDS: required fields, primary contact info, key qualifications

ACTION SELECTION RULES:
- "fill": for text inputs, textareas, email, password, number fields
- "click": for checkboxes, radio buttons, buttons, submit buttons
- "select": for <select> dropdown elements (including boolean_value selects)
- "upload": for file input fields

CRITICAL: If you see "boolean_value" in a selector, it's a SELECT dropdown, use "select" action!
CRITICAL: If you see "question_option_id" in a selector, check if it's a select or checkbox in the HTML!
CRITICAL: For SELECT elements, ALWAYS use the option's VALUE attribute, not the text content!
CRITICAL: NEVER truncate option values - use the complete text or value from the HTML!

SELECTOR BEST PRACTICES:
- Use simple ID selectors: #elementId (DO NOT add [value='...'] to ID selectors!)
- Use name attributes: [name="fieldName"]
- Avoid complex nested selectors
- For SELECT elements: use just the ID, like #job_application_answers_attributes_0_boolean_value
- For radio buttons: find by name and value: input[name="fieldName"][value="Yes"]
- For checkboxes: use simple ID or name selectors
- NEVER add [value='...'] to select element IDs - this breaks the selector!

VALUE BEST PRACTICES:
- For boolean selects: ALWAYS use "1" for Yes, "0" for No (NOT "Yes"/"No" text!)
- For text options: use the COMPLETE text, NEVER truncate (e.g., "Acknowledge" not "Acknowledg...")
- For checkboxes: leave value empty or use simple text
- When you see <option value="1">Yes</option>, use value "1", NOT "Yes"
- When you see <option value="0">No</option>, use value "0", NOT "No"

SMART FIELD MAPPING PATTERNS:
- Name variations: "First Name", "Given Name", "Forename", "fname" → user.firstName
- Phone variations: "Phone", "Mobile", "Telephone", "Contact Number" → user.phone
- Address variations: "Street", "Address Line 1", "addr_line_1" → user.address
- Experience variations: "Years of Experience", "Experience Level", "Seniority" → user.experience
- Education variations: "Degree", "Education Level", "Qualification" → user.education
- Skills variations: "Skills", "Competencies", "Expertise", "Technologies" → user.skills

CONTEXT CLUES FOR FIELD IDENTIFICATION:
- Look at field labels, placeholders, help text
- Consider field position in form sections
- Check surrounding text and headings
- Analyze field groupings and relationships
- Match semantic meaning over exact text

FIELD CONTEXT ANALYSIS:
- Read field labels, placeholders, help text, and surrounding context
- Identify field groupings (personal info, experience, preferences)
- Detect required fields (*, required attribute, validation messages)
- Find conditional fields that depend on other selections
- Recognize common field patterns across different sites

EXECUTION PRIORITY:
- Priority 1: Required fields, critical contact information
- Priority 2: Core job-relevant fields (experience, skills)
- Priority 3: Optional preference fields
- Priority 4: Marketing/survey questions
- Priority 5: Non-essential fields

RESPONSE FORMAT:
{
  "formAnalysis": {
    "isMultiStep": boolean,
    "hasConditionalFields": boolean,
    "requiredFields": ["selector1", "selector2"],
    "fieldGroups": [{"name": "Personal Info", "fields": ["selector1"]}]
  },
  "instructions": [
    {
      "action": "fill|select|click|upload",
      "selector": "simple CSS selector",
      "value": "value to fill",
      "reasoning": "why this value and action",
      "confidence": 85,
      "priority": 1-5,
      "isRequired": boolean,
      "dependsOn": ["selector_of_dependency"],
      "fieldContext": "detected field purpose and context"
    }
  ],
  "confidence": 80,
  "reasoning": "overall analysis reasoning",
  "warnings": ["any warnings about skipped elements"]
}

FIELD MAPPING GUIDELINES:
- email fields: use user's email
- name fields: use full name or split as needed
- phone fields: use phone number
- address fields: use address components
- experience fields: use work experience
- education fields: use education info
- skills fields: use relevant skills
- cover letter: generate based on job context
- radio buttons: choose appropriate Yes/No/option values
- checkboxes: use "true" for checking, "false" for unchecking
- file uploads: mention the file type needed

COMMON PATTERNS TO RECOGNIZE:
- Boolean questions (Yes/No): use radio buttons with "Yes"/"No" values
- Multiple choice: use radio buttons with specific option values
- Checkboxes: use click action (don't specify value, or use empty string)
- "How did you hear about us" questions: select LinkedIn checkbox if available
- Text areas for resumes/cover letters: use fill action with generated content
- Hidden/readonly elements: skip these elements entirely
- File upload fields: mention the expected file type

SPECIAL HANDLING FOR CHECKBOXES:
- For checkbox questions like "How did you hear about us?", select the most professional option (LinkedIn, Company Website, Referral)
- For multiple checkbox questions, select 1-2 relevant options
- Use simple selectors and let the system find the best match
- Don't use specific values for checkboxes, just use click action

ELEMENTS TO SKIP:
- Elements with style="display: none"
- Elements with disabled="true" 
- Elements with readonly="true"
- Hidden input fields (type="hidden")
- Elements that are not visible or interactable`;

export function buildUserPrompt(
  html: string,
  userProfile: UserProfile,
  jobContext?: any,
  formMetadata?: any
): string {
  const profileSummary = {
    email: userProfile.personalInfo?.email || 'user@example.com',
    name: userProfile.personalInfo?.fullName || 'John Doe',
    phone: userProfile.personalInfo?.phone || '(555) 123-4567',
    address: userProfile.personalInfo?.address || '123 Main St, City, State 12345',
    experience: userProfile.workExperience?.slice(0, 3) || [],
    education: userProfile.education?.slice(0, 2) || [],
    skills: userProfile.skills?.slice(0, 10) || [],
  };

  return `Analyze this job application form and generate filling instructions:

HTML FORM:
${html}

USER PROFILE:
${JSON.stringify(profileSummary, null, 2)}

${jobContext ? `JOB CONTEXT:\n${JSON.stringify(jobContext, null, 2)}\n` : ''}

${formMetadata ? `FORM METADATA:\n${JSON.stringify(formMetadata, null, 2)}\n` : ''}

Generate precise filling instructions in the specified JSON format.`;
}

export function sanitizeHTMLForAnalysis(html: string): string {
  // Remove scripts, styles, and other non-form elements
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractFormMetadata(html: string, url: string): any {
  const formCount = (html.match(/<form/gi) || []).length;
  const inputCount = (html.match(/<input/gi) || []).length;
  const selectCount = (html.match(/<select/gi) || []).length;
  const textareaCount = (html.match(/<textarea/gi) || []).length;
  
  const hasFileUpload = html.includes('type="file"');
  const hasMultiStep = html.includes('step') || html.includes('wizard') || html.includes('progress');
  
  return {
    url,
    formCount,
    fieldCount: inputCount + selectCount + textareaCount,
    hasFileUpload,
    hasMultiStep,
    complexity: inputCount + selectCount + textareaCount > 10 ? 'high' : 
                inputCount + selectCount + textareaCount > 5 ? 'medium' : 'low',
  };
}

export function validateAnalysisResponse(response: any): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  // Check required fields
  if (!Array.isArray(response.instructions)) {
    return false;
  }

  if (typeof response.confidence !== 'number' || 
      response.confidence < 0 || 
      response.confidence > 100) {
    return false;
  }

  // Validate each instruction
  for (const instruction of response.instructions) {
    if (!instruction.action || !instruction.selector) {
      return false;
    }

    if (!['fill', 'select', 'click', 'upload'].includes(instruction.action)) {
      return false;
    }

    if (typeof instruction.confidence !== 'number' || 
        instruction.confidence < 0 || 
        instruction.confidence > 100) {
      return false;
    }
  }

  return true;
}

export const PROMPT_EXAMPLES = [
  {
    input: {
      html: '<form><input name="email" type="email" required><input name="name" type="text" required></form>',
      profile: {
        personalInfo: {
          email: 'john.doe@example.com',
          fullName: 'John Doe',
        },
      },
    },
    output: {
      instructions: [
        {
          action: 'fill',
          selector: 'input[name="email"]',
          value: 'john.doe@example.com',
          reasoning: 'Fill email field with user email address',
          confidence: 95,
          priority: 8,
        },
        {
          action: 'fill',
          selector: 'input[name="name"]',
          value: 'John Doe',
          reasoning: 'Fill name field with user full name',
          confidence: 90,
          priority: 7,
        },
      ],
      confidence: 92,
      reasoning: 'Simple contact form with clear field mappings',
      warnings: [],
    } as AIFormAnalysis,
  },
];