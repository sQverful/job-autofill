/**
 * File upload automation for autofill engine
 * Handles resume and document uploads to job application forms
 */

import type { FormField, ResumeDocument } from '@extension/shared/lib/types';

export interface FileUploadResult {
  success: boolean;
  fieldId: string;
  fileName?: string;
  fileSize?: number;
  error?: FileUploadError;
}

export interface FileUploadError {
  code: string;
  message: string;
  recoverable: boolean;
}

export interface FileUploadOptions {
  preferredFileType?: 'pdf' | 'docx';
  maxFileSize?: number; // in bytes
  validateFileType?: boolean;
  retryAttempts?: number;
}

export class FileUploadHandler {
  private static readonly DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly SUPPORTED_TYPES = ['pdf', 'docx', 'doc'];
  private static readonly RETRY_DELAY = 500; // ms

  private options: Required<FileUploadOptions>;

  constructor(options: FileUploadOptions = {}) {
    this.options = {
      preferredFileType: 'pdf',
      maxFileSize: FileUploadHandler.DEFAULT_MAX_FILE_SIZE,
      validateFileType: true,
      retryAttempts: 3,
      ...options
    };
  }

  /**
   * Upload file to a form field
   */
  async uploadFile(
    field: FormField,
    documents: ResumeDocument[],
    options: Partial<FileUploadOptions> = {}
  ): Promise<FileUploadResult> {
    const uploadOptions = { ...this.options, ...options };

    try {
      // Find the best document to upload
      const document = this.selectBestDocument(documents, uploadOptions);
      if (!document) {
        return {
          success: false,
          fieldId: field.id,
          error: {
            code: 'NO_DOCUMENT_AVAILABLE',
            message: 'No suitable document found for upload',
            recoverable: false
          }
        };
      }

      // Validate file
      const validationResult = this.validateDocument(document, uploadOptions);
      if (!validationResult.valid) {
        return {
          success: false,
          fieldId: field.id,
          error: {
            code: 'DOCUMENT_VALIDATION_FAILED',
            message: validationResult.error || 'Document validation failed',
            recoverable: false
          }
        };
      }

      // Find file input element
      const fileInput = this.findFileInput(field.selector);
      if (!fileInput) {
        return {
          success: false,
          fieldId: field.id,
          error: {
            code: 'FILE_INPUT_NOT_FOUND',
            message: `File input not found for selector: ${field.selector}`,
            recoverable: true
          }
        };
      }

      // Create File object from document
      const file = await this.createFileFromDocument(document);
      if (!file) {
        return {
          success: false,
          fieldId: field.id,
          error: {
            code: 'FILE_CREATION_FAILED',
            message: 'Failed to create File object from document',
            recoverable: true
          }
        };
      }

      // Upload file with retry logic
      const uploadSuccess = await this.uploadWithRetry(fileInput, file, uploadOptions.retryAttempts);
      
      if (uploadSuccess) {
        return {
          success: true,
          fieldId: field.id,
          fileName: document.fileName,
          fileSize: document.fileSize
        };
      } else {
        return {
          success: false,
          fieldId: field.id,
          error: {
            code: 'UPLOAD_FAILED',
            message: 'File upload failed after retries',
            recoverable: true
          }
        };
      }

    } catch (error) {
      return {
        success: false,
        fieldId: field.id,
        error: {
          code: 'UNEXPECTED_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          recoverable: true
        }
      };
    }
  }

  /**
   * Select the best document for upload based on preferences
   */
  private selectBestDocument(
    documents: ResumeDocument[], 
    options: Required<FileUploadOptions>
  ): ResumeDocument | null {
    if (!documents || documents.length === 0) {
      return null;
    }

    // First, try to find default document of preferred type
    const defaultPreferred = documents.find(doc => 
      doc.isDefault && doc.fileType === options.preferredFileType
    );
    if (defaultPreferred) return defaultPreferred;

    // Then, try to find any default document
    const defaultDoc = documents.find(doc => doc.isDefault);
    if (defaultDoc) return defaultDoc;

    // Then, try to find document of preferred type
    const preferredType = documents.find(doc => doc.fileType === options.preferredFileType);
    if (preferredType) return preferredType;

    // Finally, return the first available document
    return documents[0];
  }

  /**
   * Validate document for upload
   */
  private validateDocument(
    document: ResumeDocument, 
    options: Required<FileUploadOptions>
  ): { valid: boolean; error?: string } {
    // Check file size
    if (document.fileSize > options.maxFileSize) {
      return {
        valid: false,
        error: `File size (${this.formatFileSize(document.fileSize)}) exceeds maximum allowed size (${this.formatFileSize(options.maxFileSize)})`
      };
    }

    // Check file type
    if (options.validateFileType && !FileUploadHandler.SUPPORTED_TYPES.includes(document.fileType)) {
      return {
        valid: false,
        error: `Unsupported file type: ${document.fileType}. Supported types: ${FileUploadHandler.SUPPORTED_TYPES.join(', ')}`
      };
    }

    // Check if file exists (for local files)
    if (document.localPath && !document.cloudUrl) {
      // Note: In browser environment, we can't directly check file existence
      // This would need to be handled by the extension's file management system
    }

    return { valid: true };
  }

  /**
   * Find file input element
   */
  private findFileInput(selector: string): HTMLInputElement | null {
    // Try direct selector first
    let element = document.querySelector(selector) as HTMLInputElement;
    if (element && element.type === 'file') return element;

    // Try common file input selectors
    const fallbackSelectors = [
      `input[type="file"]${selector}`,
      `${selector} input[type="file"]`,
      `[name="${selector}"]`,
      `[id="${selector}"]`,
      `input[type="file"][name*="${selector}"]`,
      `input[type="file"][id*="${selector}"]`
    ];

    for (const fallbackSelector of fallbackSelectors) {
      element = document.querySelector(fallbackSelector) as HTMLInputElement;
      if (element && element.type === 'file') return element;
    }

    // Look for file inputs with similar labels
    const fileInputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
    const normalizedSelector = this.normalizeText(selector);

    for (const input of fileInputs) {
      const label = this.findInputLabel(input);
      if (label && this.normalizeText(label).includes(normalizedSelector)) {
        return input;
      }
    }

    return null;
  }

  /**
   * Find label text for an input element
   */
  private findInputLabel(input: HTMLInputElement): string | null {
    // Check for associated label element
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent?.trim() || null;
    }

    // Check for parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || null;

    // Check for nearby text
    const parent = input.parentElement;
    if (parent) {
      const text = parent.textContent?.trim();
      if (text && text.length < 100) return text;
    }

    return null;
  }

  /**
   * Create File object from document
   */
  private async createFileFromDocument(document: ResumeDocument): Promise<File | null> {
    try {
      let fileData: ArrayBuffer;

      if (document.cloudUrl) {
        // Fetch file from cloud URL
        const response = await fetch(document.cloudUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        fileData = await response.arrayBuffer();
      } else if (document.localPath) {
        // For local files, we would need to use the extension's file system API
        // This is a placeholder - actual implementation would depend on how files are stored
        throw new Error('Local file access not implemented');
      } else {
        throw new Error('No file source available');
      }

      // Determine MIME type
      const mimeType = this.getMimeType(document.fileType);
      
      // Create File object
      const file = new File([fileData], document.fileName, {
        type: mimeType,
        lastModified: document.uploadDate.getTime()
      });

      return file;

    } catch (error) {
      console.error('Failed to create file from document:', error);
      return null;
    }
  }

  /**
   * Upload file with retry logic
   */
  private async uploadWithRetry(
    fileInput: HTMLInputElement, 
    file: File, 
    retryAttempts: number
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const success = await this.performUpload(fileInput, file);
        if (success) return true;

        if (attempt < retryAttempts) {
          await new Promise(resolve => 
            setTimeout(resolve, FileUploadHandler.RETRY_DELAY * attempt)
          );
        }
      } catch (error) {
        console.warn(`Upload attempt ${attempt} failed:`, error);
        
        if (attempt < retryAttempts) {
          await new Promise(resolve => 
            setTimeout(resolve, FileUploadHandler.RETRY_DELAY * attempt)
          );
        }
      }
    }

    return false;
  }

  /**
   * Perform the actual file upload
   */
  private async performUpload(fileInput: HTMLInputElement, file: File): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Create DataTransfer object to simulate file selection
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        // Set files on input
        fileInput.files = dataTransfer.files;

        // Trigger change events
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        fileInput.dispatchEvent(changeEvent);

        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        fileInput.dispatchEvent(inputEvent);

        // Verify upload
        setTimeout(() => {
          const success = fileInput.files && fileInput.files.length > 0 && fileInput.files[0].name === file.name;
          resolve(success);
        }, 100);

      } catch (error) {
        console.error('Upload performance failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Get MIME type for file extension
   */
  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword'
    };

    return mimeTypes[fileType.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Check if field is likely a resume upload field
   */
  static isResumeField(field: FormField): boolean {
    if (field.type !== 'file') return false;

    const resumeKeywords = [
      'resume', 'cv', 'curriculum', 'vitae', 'document', 'upload',
      'attach', 'file', 'portfolio', 'experience'
    ];

    const fieldText = `${field.label} ${field.id} ${field.placeholder || ''}`.toLowerCase();
    
    return resumeKeywords.some(keyword => fieldText.includes(keyword));
  }

  /**
   * Check if field accepts specific file types
   */
  static getAcceptedFileTypes(field: FormField): string[] {
    const fileInput = document.querySelector(field.selector) as HTMLInputElement;
    if (!fileInput || fileInput.type !== 'file') return [];

    const accept = fileInput.accept;
    if (!accept) return FileUploadHandler.SUPPORTED_TYPES;

    // Parse accept attribute
    const types = accept.split(',').map(type => type.trim());
    const extensions: string[] = [];

    for (const type of types) {
      if (type.startsWith('.')) {
        extensions.push(type.substring(1));
      } else if (type === 'application/pdf') {
        extensions.push('pdf');
      } else if (type.includes('word') || type.includes('document')) {
        extensions.push('docx', 'doc');
      }
    }

    return extensions.length > 0 ? extensions : FileUploadHandler.SUPPORTED_TYPES;
  }
}