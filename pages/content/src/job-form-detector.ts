/**
 * Job Form Detector - Detects job application forms and injects UI
 */

export class JobFormDetector {
  private observer: MutationObserver | null = null;
  private detectedForms: Set<HTMLFormElement> = new Set();
  private injectedElements: Set<HTMLElement> = new Set();
  private scanTimeoutId: number | null = null;

  constructor() {
    this.observer = new MutationObserver(this.handleMutations.bind(this));
  }

  /**
   * Start monitoring the page for job application forms
   */
  startMonitoring(): void {
    console.log('[Job Autofill] Starting form detection...');

    // Initial scan
    this.scanForForms();

    // Start observing DOM changes
    this.observer?.observe(document.body, {
      childList: true,
      subtree: true,
      // Watching attribute changes for every node is expensive and unnecessary here
      // since the detector only reacts to added/removed elements.
    });

    // Also scan when page is fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => this.scanForForms(), 1000);
      });
    }
  }

  /**
   * Handle DOM mutations
   */
  private handleMutations(mutations: MutationRecord[]): void {
    let shouldScan = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check if any added nodes contain forms
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.tagName === 'FORM' || element.querySelector('form')) {
              shouldScan = true;
              break;
            }
          }
        }
      }
    }

    if (shouldScan) {
      // Debounce scanning to avoid repeated heavy scans on rapid DOM changes
      if (this.scanTimeoutId !== null) {
        clearTimeout(this.scanTimeoutId);
      }
      this.scanTimeoutId = window.setTimeout(() => {
        this.scanForForms();
        this.scanTimeoutId = null;
      }, 500);
    }
  }

  /**
   * Scan the page for job application forms
   */
  private scanForForms(): void {
    const forms = document.querySelectorAll('form');

    forms.forEach(form => {
      if (!this.detectedForms.has(form) && this.isJobApplicationForm(form)) {
        console.log('[Job Autofill] Job application form detected:', form);
        this.detectedForms.add(form);
        this.injectFormUI(form);
      }
    });

    // Also check for textarea fields that might be part of job applications
    this.scanForJobQuestionFields();
  }

  /**
   * Check if a form is likely a job application form
   */
  private isJobApplicationForm(form: HTMLFormElement): boolean {
    const formText = (form.textContent || '').toLowerCase().slice(0, 2000);
    const formAction = form.action.toLowerCase();
    const formClasses = form.className.toLowerCase();

    // Check for job application indicators
    const jobKeywords = [
      'job_application',
      'application',
      'apply',
      'career',
      'resume',
      'cover_letter',
      'position',
      'employment',
      'candidate',
    ];

    const questionKeywords = [
      'why are you interested',
      'tell us about',
      'describe your experience',
      'what makes you',
      'why do you want',
      'interesting project',
    ];

    // Check form action URL
    if (jobKeywords.some(keyword => formAction.includes(keyword))) {
      return true;
    }

    // Check form classes
    if (jobKeywords.some(keyword => formClasses.includes(keyword))) {
      return true;
    }

    // Check textual content of the form for job-related keywords
    if (jobKeywords.some(keyword => formText.includes(keyword))) {
      return true;
    }

    // Check for common job application question patterns
    if (questionKeywords.some(keyword => formText.includes(keyword))) {
      return true;
    }

    // Check for file upload fields (resume uploads)
    const fileInputs = form.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) {
      return true;
    }

    // Check for textarea fields with job-related labels
    const textareas = form.querySelectorAll('textarea');
    for (const textarea of textareas) {
      const label = this.getFieldLabel(textarea);
      if (label && questionKeywords.some(keyword => label.toLowerCase().includes(keyword))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Scan for individual job question fields (not necessarily in forms)
   */
  private scanForJobQuestionFields(): void {
    const textareas = document.querySelectorAll('textarea');

    textareas.forEach(textarea => {
      if (this.isJobQuestionField(textarea)) {
        this.injectFieldUI(textarea);
      }
    });
  }

  /**
   * Check if a textarea is a job application question field
   */
  private isJobQuestionField(textarea: HTMLTextAreaElement): boolean {
    const label = this.getFieldLabel(textarea);
    if (!label) return false;

    const questionKeywords = [
      'why are you interested',
      'tell us about',
      'describe your experience',
      'what makes you',
      'why do you want',
      'interesting project',
      'most challenging',
      'greatest achievement',
      'cover letter',
    ];

    return questionKeywords.some(keyword => label.toLowerCase().includes(keyword));
  }

  /**
   * Get the label text for a form field
   */
  private getFieldLabel(field: HTMLElement): string {
    // Try to find associated label
    const fieldId = field.id;
    if (fieldId) {
      const label = document.querySelector(`label[for="${fieldId}"]`);
      if (label) {
        return label.textContent || '';
      }
    }

    // Try to find parent label
    const parentLabel = field.closest('label');
    if (parentLabel) {
      return parentLabel.textContent || '';
    }

    // Try to find nearby label or text
    const parent = field.parentElement;
    if (parent) {
      const label = parent.querySelector('label');
      if (label) {
        return label.textContent || '';
      }

      // Look for text content in parent
      const textContent = parent.textContent || '';
      return textContent.slice(0, 200); // Limit length
    }

    return '';
  }

  /**
   * Inject UI for detected form
   */
  private injectFormUI(form: HTMLFormElement): void {
    // Create form-level autofill button
    const button = this.createAutofillButton('Fill Application');
    button.style.position = 'absolute';
    button.style.top = '10px';
    button.style.right = '10px';
    button.style.zIndex = '10000';

    // Position relative to form
    const formRect = form.getBoundingClientRect();
    button.style.left = `${formRect.right - 150}px`;
    button.style.top = `${formRect.top + window.scrollY - 40}px`;

    document.body.appendChild(button);
    this.injectedElements.add(button);

    // Add click handler
    button.addEventListener('click', () => {
      this.handleAutofillClick(form);
    });
  }

  /**
   * Inject UI for individual field
   */
  private injectFieldUI(field: HTMLTextAreaElement): void {
    // Check if we already injected UI for this field
    if (field.dataset.jobAutofillInjected) return;
    field.dataset.jobAutofillInjected = 'true';

    // Create AI assist button
    const button = this.createAIAssistButton();

    // Position next to the field
    const fieldRect = field.getBoundingClientRect();
    button.style.position = 'absolute';
    button.style.left = `${fieldRect.right + window.scrollX + 10}px`;
    button.style.top = `${fieldRect.top + window.scrollY}px`;
    button.style.zIndex = '10000';

    document.body.appendChild(button);
    this.injectedElements.add(button);

    // Add click handler
    button.addEventListener('click', () => {
      this.handleAIAssistClick(field);
    });

    // Update position on scroll/resize
    const updatePosition = () => {
      const newRect = field.getBoundingClientRect();
      button.style.left = `${newRect.right + window.scrollX + 10}px`;
      button.style.top = `${newRect.top + window.scrollY}px`;
    };

    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
  }

  /**
   * Create autofill button
   */
  private createAutofillButton(text: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#1d4ed8';
      button.style.transform = 'translateY(-1px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#2563eb';
      button.style.transform = 'translateY(0)';
    });

    return button;
  }

  /**
   * Create AI assist button
   */
  private createAIAssistButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.innerHTML = '✨ AI';
    button.title = 'Get AI assistance for this question';
    button.style.cssText = `
      background: #7c3aed;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.2s;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.background = '#6d28d9';
      button.style.transform = 'translateY(-1px)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#7c3aed';
      button.style.transform = 'translateY(0)';
    });

    return button;
  }

  /**
   * Handle autofill button click
   */
  private handleAutofillClick(form: HTMLFormElement): void {
    console.log('[Job Autofill] Autofill clicked for form:', form);

    // Show notification
    this.showNotification('Autofill feature coming soon!', 'info');

    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'form:detected',
      source: 'content',
      data: {
        formId: this.generateFormId(form),
        platform: this.detectPlatform(),
        fieldCount: form.querySelectorAll('input, textarea, select').length,
        confidence: 0.8,
        url: window.location.href,
      },
      id: `content_${Date.now()}`,
      timestamp: Date.now(),
    });
  }

  /**
   * Handle AI assist button click
   */
  private handleAIAssistClick(field: HTMLTextAreaElement): void {
    console.log('[Job Autofill] AI assist clicked for field:', field);

    const label = this.getFieldLabel(field);
    this.showNotification(`AI assistance for: "${label.slice(0, 50)}..." - Coming soon!`, 'info');
  }

  /**
   * Show notification to user
   */
  private showNotification(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb'};
      color: white;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 300px;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Generate unique form ID
   */
  private generateFormId(form: HTMLFormElement): string {
    return `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): string {
    const hostname = window.location.hostname.toLowerCase();

    if (hostname.includes('linkedin.com')) return 'linkedin';
    if (hostname.includes('indeed.com')) return 'indeed';
    if (hostname.includes('workday.com')) return 'workday';

    return 'custom';
  }

  /**
   * Stop monitoring and cleanup
   */
  stopMonitoring(): void {
    this.observer?.disconnect();

    if (this.scanTimeoutId !== null) {
      clearTimeout(this.scanTimeoutId);
      this.scanTimeoutId = null;
    }

    // Remove injected elements
    this.injectedElements.forEach(element => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });

    this.injectedElements.clear();
    this.detectedForms.clear();
  }
}
