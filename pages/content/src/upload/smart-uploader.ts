/**
 * Smart File Uploader
 * Advanced file upload automation with multiple strategies
 */

export interface FileUploadStrategy {
  name: string;
  priority: number;
  canHandle: (field: HTMLInputElement) => boolean;
  upload: (field: HTMLInputElement, file: File) => Promise<boolean>;
  fallback?: FileUploadStrategy;
}

export interface UploadResult {
  success: boolean;
  method: string;
  error?: string;
  requiresManualIntervention?: boolean;
  guidanceSteps?: string[];
}

export interface FileFormatInfo {
  type: string;
  extensions: string[];
  mimeTypes: string[];
  maxSize?: number;
  description: string;
}

/**
 * Smart file uploader with multiple attachment strategies
 */
export class SmartFileUploader {
  private strategies: FileUploadStrategy[] = [];
  private supportedFormats: FileFormatInfo[] = [];

  constructor() {
    this.initializeStrategies();
    this.initializeSupportedFormats();
  }

  /**
   * Initialize upload strategies in priority order
   */
  private initializeStrategies(): void {
    this.strategies = [
      new DirectFileAPIStrategy(1),
      new DragDropSimulationStrategy(2),
      new ClipboardIntegrationStrategy(3),
      new BrowserSpecificStrategy(4),
      new UserGuidedStrategy(5)
    ];

    // Sort by priority (lower number = higher priority)
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Initialize supported file formats
   */
  private initializeSupportedFormats(): void {
    this.supportedFormats = [
      {
        type: 'resume',
        extensions: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
        mimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'application/rtf'
        ],
        maxSize: 10 * 1024 * 1024, // 10MB
        description: 'Resume/CV document'
      },
      {
        type: 'cover_letter',
        extensions: ['.pdf', '.doc', '.docx', '.txt'],
        mimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ],
        maxSize: 5 * 1024 * 1024, // 5MB
        description: 'Cover letter document'
      },
      {
        type: 'portfolio',
        extensions: ['.pdf', '.zip', '.rar'],
        mimeTypes: [
          'application/pdf',
          'application/zip',
          'application/x-rar-compressed'
        ],
        maxSize: 50 * 1024 * 1024, // 50MB
        description: 'Portfolio or work samples'
      }
    ];
  }

  /**
   * Upload file using the best available strategy
   */
  async uploadFile(field: HTMLInputElement, file: File): Promise<UploadResult> {
    // Validate file format and size
    const validation = this.validateFile(field, file);
    if (!validation.valid) {
      return {
        success: false,
        method: 'validation',
        error: validation.error
      };
    }

    // Try each strategy in priority order
    for (const strategy of this.strategies) {
      if (!strategy.canHandle(field)) {
        continue;
      }

      try {
        console.log(`Trying upload strategy: ${strategy.name}`);
        const success = await strategy.upload(field, file);
        
        if (success) {
          return {
            success: true,
            method: strategy.name
          };
        }
      } catch (error) {
        console.warn(`Upload strategy ${strategy.name} failed:`, error);
        
        // If this is the last strategy, return guidance
        if (strategy === this.strategies[this.strategies.length - 1]) {
          return {
            success: false,
            method: strategy.name,
            error: error instanceof Error ? error.message : 'Upload failed',
            requiresManualIntervention: true,
            guidanceSteps: this.generateGuidanceSteps(field, file)
          };
        }
      }
    }

    return {
      success: false,
      method: 'all_strategies_failed',
      error: 'All upload strategies failed',
      requiresManualIntervention: true,
      guidanceSteps: this.generateGuidanceSteps(field, file)
    };
  }

  /**
   * Validate file against field requirements
   */
  private validateFile(field: HTMLInputElement, file: File): { valid: boolean; error?: string } {
    // Check file size
    const maxSize = this.getMaxFileSize(field);
    if (maxSize && file.size > maxSize) {
      return {
        valid: false,
        error: `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(maxSize)})`
      };
    }

    // Check file type
    const acceptedTypes = this.getAcceptedFileTypes(field);
    if (acceptedTypes.length > 0) {
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        } else {
          return file.type === type || file.type.startsWith(type.split('/')[0] + '/');
        }
      });

      if (!isAccepted) {
        return {
          valid: false,
          error: `File type not accepted. Accepted types: ${acceptedTypes.join(', ')}`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Get maximum file size from field attributes
   */
  private getMaxFileSize(field: HTMLInputElement): number | null {
    // Check data attributes
    const maxSizeAttr = field.getAttribute('data-max-size') || 
                       field.getAttribute('data-maxsize') ||
                       field.getAttribute('max-size');
    
    if (maxSizeAttr) {
      return parseInt(maxSizeAttr);
    }

    // Check nearby text for size limits
    const nearbyText = this.getNearbyText(field);
    const sizeMatch = nearbyText.match(/(\d+)\s*(mb|kb|gb)/i);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1]);
      const unit = sizeMatch[2].toLowerCase();
      
      switch (unit) {
        case 'kb': return size * 1024;
        case 'mb': return size * 1024 * 1024;
        case 'gb': return size * 1024 * 1024 * 1024;
      }
    }

    return null;
  }

  /**
   * Get accepted file types from field attributes
   */
  private getAcceptedFileTypes(field: HTMLInputElement): string[] {
    const accept = field.getAttribute('accept');
    if (accept) {
      return accept.split(',').map(type => type.trim());
    }

    // Try to infer from field context
    const fieldContext = this.getFieldContext(field);
    if (fieldContext.includes('resume') || fieldContext.includes('cv')) {
      return this.supportedFormats.find(f => f.type === 'resume')?.extensions || [];
    }
    if (fieldContext.includes('cover') && fieldContext.includes('letter')) {
      return this.supportedFormats.find(f => f.type === 'cover_letter')?.extensions || [];
    }

    return [];
  }

  /**
   * Get field context from labels and nearby text
   */
  private getFieldContext(field: HTMLInputElement): string {
    const contexts: string[] = [];

    // Field attributes
    contexts.push(field.name || '');
    contexts.push(field.id || '');
    contexts.push(field.getAttribute('placeholder') || '');

    // Associated label
    if (field.id) {
      const label = document.querySelector(`label[for="${field.id}"]`);
      if (label) contexts.push(label.textContent || '');
    }

    // Parent label
    const parentLabel = field.closest('label');
    if (parentLabel) contexts.push(parentLabel.textContent || '');

    // Nearby text
    contexts.push(this.getNearbyText(field));

    return contexts.join(' ').toLowerCase();
  }

  /**
   * Get text near the field element
   */
  private getNearbyText(field: HTMLInputElement): string {
    const texts: string[] = [];
    
    // Sibling elements
    if (field.previousElementSibling) {
      texts.push(field.previousElementSibling.textContent || '');
    }
    if (field.nextElementSibling) {
      texts.push(field.nextElementSibling.textContent || '');
    }

    // Parent container text
    const parent = field.parentElement;
    if (parent) {
      const clone = parent.cloneNode(true) as HTMLElement;
      // Remove the input itself to get surrounding text
      const inputs = clone.querySelectorAll('input, textarea, select');
      inputs.forEach(input => input.remove());
      texts.push(clone.textContent || '');
    }

    return texts.join(' ').trim();
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate step-by-step guidance for manual upload
   */
  private generateGuidanceSteps(field: HTMLInputElement, file: File): string[] {
    const steps: string[] = [];
    
    steps.push('Automatic file upload failed. Please follow these steps to upload manually:');
    steps.push(`1. Click on the file upload field${field.id ? ` (${field.id})` : ''}`);
    steps.push('2. In the file dialog that opens, navigate to your file');
    steps.push(`3. Select the file: ${file.name}`);
    steps.push('4. Click "Open" or "Select" to upload the file');
    
    const acceptedTypes = this.getAcceptedFileTypes(field);
    if (acceptedTypes.length > 0) {
      steps.push(`Note: Make sure your file is in one of these formats: ${acceptedTypes.join(', ')}`);
    }

    const maxSize = this.getMaxFileSize(field);
    if (maxSize) {
      steps.push(`Note: File size must be under ${this.formatFileSize(maxSize)}`);
    }

    return steps;
  }

  /**
   * Get optimal file format for field
   */
  getOptimalFormat(field: HTMLInputElement, availableFiles: File[]): File | null {
    const acceptedTypes = this.getAcceptedFileTypes(field);
    const fieldContext = this.getFieldContext(field);

    // If no specific types accepted, use context to determine best file
    if (acceptedTypes.length === 0) {
      if (fieldContext.includes('resume') || fieldContext.includes('cv')) {
        return availableFiles.find(f => f.name.toLowerCase().includes('resume') || 
                                       f.name.toLowerCase().includes('cv')) || 
               availableFiles.find(f => f.type === 'application/pdf') ||
               availableFiles[0];
      }
      
      if (fieldContext.includes('cover') && fieldContext.includes('letter')) {
        return availableFiles.find(f => f.name.toLowerCase().includes('cover')) ||
               availableFiles.find(f => f.type === 'application/pdf') ||
               availableFiles[0];
      }
    }

    // Find file matching accepted types
    for (const file of availableFiles) {
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        } else {
          return file.type === type;
        }
      });
      
      if (isAccepted) {
        return file;
      }
    }

    return availableFiles[0] || null;
  }
}

/**
 * Direct File API strategy
 */
class DirectFileAPIStrategy implements FileUploadStrategy {
  name = 'Direct File API';
  priority = 1;

  canHandle(field: HTMLInputElement): boolean {
    return field.type === 'file' && !field.disabled && !field.readOnly;
  }

  async upload(field: HTMLInputElement, file: File): Promise<boolean> {
    try {
      // Create DataTransfer object with the file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // Set files property
      field.files = dataTransfer.files;
      
      // Trigger events
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Verify file was set
      return field.files && field.files.length > 0 && field.files[0].name === file.name;
    } catch (error) {
      console.error('Direct File API upload failed:', error);
      return false;
    }
  }
}

/**
 * Drag and drop simulation strategy
 */
class DragDropSimulationStrategy implements FileUploadStrategy {
  name = 'Drag Drop Simulation';
  priority = 2;

  canHandle(field: HTMLInputElement): boolean {
    return field.type === 'file' || this.isDragDropZone(field);
  }

  private isDragDropZone(element: HTMLElement): boolean {
    const dragDropIndicators = [
      'drag',
      'drop',
      'upload-zone',
      'file-drop',
      'dropzone'
    ];

    const className = element.className.toLowerCase();
    const dataAttrs = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => attr.value.toLowerCase())
      .join(' ');

    return dragDropIndicators.some(indicator => 
      className.includes(indicator) || dataAttrs.includes(indicator)
    );
  }

  async upload(field: HTMLInputElement, file: File): Promise<boolean> {
    try {
      // Find the target element (could be the field or a drop zone)
      const target = this.findDropTarget(field);
      
      // Create drag and drop events
      const dragEnterEvent = new DragEvent('dragenter', {
        bubbles: true,
        dataTransfer: this.createDataTransfer(file)
      });
      
      const dragOverEvent = new DragEvent('dragover', {
        bubbles: true,
        dataTransfer: this.createDataTransfer(file)
      });
      
      const dropEvent = new DragEvent('drop', {
        bubbles: true,
        dataTransfer: this.createDataTransfer(file)
      });

      // Simulate drag and drop sequence
      target.dispatchEvent(dragEnterEvent);
      await this.sleep(50);
      
      target.dispatchEvent(dragOverEvent);
      await this.sleep(50);
      
      target.dispatchEvent(dropEvent);
      await this.sleep(100);

      // Check if file was accepted
      return this.verifyUpload(field, file);
    } catch (error) {
      console.error('Drag drop simulation failed:', error);
      return false;
    }
  }

  private findDropTarget(field: HTMLInputElement): HTMLElement {
    // Look for drop zone containers
    const dropZoneSelectors = [
      '.dropzone',
      '.upload-zone',
      '.file-drop',
      '[data-drop]',
      '[data-dropzone]'
    ];

    for (const selector of dropZoneSelectors) {
      const dropZone = field.closest(selector) || 
                      field.parentElement?.querySelector(selector);
      if (dropZone) {
        return dropZone as HTMLElement;
      }
    }

    return field;
  }

  private createDataTransfer(file: File): DataTransfer {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    return dataTransfer;
  }

  private async verifyUpload(field: HTMLInputElement, file: File): Promise<boolean> {
    // Wait a bit for the upload to process
    await this.sleep(500);
    
    // Check if field has the file
    if (field.files && field.files.length > 0) {
      return field.files[0].name === file.name;
    }

    // Check for visual indicators of successful upload
    const parent = field.closest('.upload-container, .file-input, .form-group');
    if (parent) {
      const successIndicators = parent.querySelectorAll('.success, .uploaded, .file-name');
      for (const indicator of successIndicators) {
        if (indicator.textContent?.includes(file.name)) {
          return true;
        }
      }
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Clipboard integration strategy
 */
class ClipboardIntegrationStrategy implements FileUploadStrategy {
  name = 'Clipboard Integration';
  priority = 3;

  canHandle(field: HTMLInputElement): boolean {
    // Only works for certain file types and if clipboard API is available
    return field.type === 'file' && 
           'clipboard' in navigator && 
           'write' in navigator.clipboard;
  }

  async upload(field: HTMLInputElement, file: File): Promise<boolean> {
    try {
      // Convert file to clipboard item
      const clipboardItem = new ClipboardItem({
        [file.type]: file
      });

      // Write to clipboard
      await navigator.clipboard.write([clipboardItem]);

      // Focus field and simulate paste
      field.focus();
      
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        clipboardData: this.createClipboardData(file)
      });

      field.dispatchEvent(pasteEvent);

      // Wait and verify
      await this.sleep(200);
      return field.files && field.files.length > 0;
    } catch (error) {
      console.error('Clipboard integration failed:', error);
      return false;
    }
  }

  private createClipboardData(file: File): DataTransfer {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    return dataTransfer;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Browser-specific strategy
 */
class BrowserSpecificStrategy implements FileUploadStrategy {
  name = 'Browser Specific';
  priority = 4;

  canHandle(field: HTMLInputElement): boolean {
    return field.type === 'file';
  }

  async upload(field: HTMLInputElement, file: File): Promise<boolean> {
    const browser = this.detectBrowser();
    
    switch (browser) {
      case 'chrome':
        return this.chromeSpecificUpload(field, file);
      case 'firefox':
        return this.firefoxSpecificUpload(field, file);
      case 'safari':
        return this.safariSpecificUpload(field, file);
      case 'edge':
        return this.edgeSpecificUpload(field, file);
      default:
        return this.genericUpload(field, file);
    }
  }

  private detectBrowser(): string {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome') && !userAgent.includes('edge')) {
      return 'chrome';
    } else if (userAgent.includes('firefox')) {
      return 'firefox';
    } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
      return 'safari';
    } else if (userAgent.includes('edge')) {
      return 'edge';
    }
    
    return 'unknown';
  }

  private async chromeSpecificUpload(field: HTMLInputElement, file: File): Promise<boolean> {
    try {
      // Chrome-specific file upload method
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // Use Chrome's specific file handling
      Object.defineProperty(field, 'files', {
        value: dataTransfer.files,
        writable: false
      });

      // Trigger Chrome-specific events
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      return true;
    } catch (error) {
      console.error('Chrome-specific upload failed:', error);
      return false;
    }
  }

  private async firefoxSpecificUpload(field: HTMLInputElement, file: File): Promise<boolean> {
    try {
      // Firefox-specific approach
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      field.files = dataTransfer.files;
      
      // Firefox requires specific event sequence
      field.dispatchEvent(new FocusEvent('focus'));
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new FocusEvent('blur'));
      
      return true;
    } catch (error) {
      console.error('Firefox-specific upload failed:', error);
      return false;
    }
  }

  private async safariSpecificUpload(field: HTMLInputElement, file: File): Promise<boolean> {
    try {
      // Safari has more restrictions, try basic approach
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      field.files = dataTransfer.files;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      return true;
    } catch (error) {
      console.error('Safari-specific upload failed:', error);
      return false;
    }
  }

  private async edgeSpecificUpload(field: HTMLInputElement, file: File): Promise<boolean> {
    try {
      // Edge-specific approach (similar to Chrome but with differences)
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      field.files = dataTransfer.files;
      
      // Edge-specific event handling
      field.dispatchEvent(new Event('change', { bubbles: true }));
      field.dispatchEvent(new Event('input', { bubbles: true }));
      
      return true;
    } catch (error) {
      console.error('Edge-specific upload failed:', error);
      return false;
    }
  }

  private async genericUpload(field: HTMLInputElement, file: File): Promise<boolean> {
    try {
      // Generic approach for unknown browsers
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      field.files = dataTransfer.files;
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      return true;
    } catch (error) {
      console.error('Generic upload failed:', error);
      return false;
    }
  }
}

/**
 * User-guided strategy (fallback)
 */
class UserGuidedStrategy implements FileUploadStrategy {
  name = 'User Guided';
  priority = 5;

  canHandle(field: HTMLInputElement): boolean {
    return field.type === 'file';
  }

  async upload(field: HTMLInputElement, file: File): Promise<boolean> {
    // This strategy doesn't actually upload, but prepares for user guidance
    // It always "fails" to trigger the manual guidance flow
    
    // Highlight the field to draw user attention
    this.highlightField(field);
    
    // Pre-populate file dialog if possible (browser security permitting)
    try {
      field.click();
    } catch (error) {
      console.warn('Could not trigger file dialog:', error);
    }
    
    // Always return false to trigger guidance
    return false;
  }

  private highlightField(field: HTMLInputElement): void {
    // Add visual highlight to the field
    const originalStyle = field.style.cssText;
    
    field.style.border = '3px solid #ff6b6b';
    field.style.boxShadow = '0 0 10px rgba(255, 107, 107, 0.5)';
    field.style.backgroundColor = '#fff5f5';
    
    // Remove highlight after a few seconds
    setTimeout(() => {
      field.style.cssText = originalStyle;
    }, 5000);
  }
}