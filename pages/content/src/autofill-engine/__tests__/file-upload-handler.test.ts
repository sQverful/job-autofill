/**
 * Tests for file upload handler functionality
 */

import { FileUploadHandler } from '../file-upload-handler';
import type { FormField, ResumeDocument } from '@extension/shared/lib/types';

// Mock DOM APIs
global.DataTransfer = class {
  items = {
    add: jest.fn()
  };
} as any;

global.Event = class {
  constructor(public type: string, public options?: any) {}
} as any;

describe('FileUploadHandler', () => {
  let fileUploadHandler: FileUploadHandler;
  let mockDocuments: ResumeDocument[];

  beforeEach(() => {
    fileUploadHandler = new FileUploadHandler();
    mockDocuments = [
      {
        id: 'doc1',
        name: 'Resume PDF',
        fileName: 'john_doe_resume.pdf',
        fileSize: 1024 * 1024, // 1MB
        fileType: 'pdf',
        uploadDate: new Date('2024-01-01'),
        isDefault: true,
        cloudUrl: 'https://example.com/resume.pdf'
      },
      {
        id: 'doc2',
        name: 'Resume DOCX',
        fileName: 'john_doe_resume.docx',
        fileSize: 2 * 1024 * 1024, // 2MB
        fileType: 'docx',
        uploadDate: new Date('2024-01-02'),
        isDefault: false,
        cloudUrl: 'https://example.com/resume.docx'
      }
    ];

    // Mock fetch for file downloads
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });

    // Mock DOM methods
    document.querySelector = jest.fn();
    document.querySelectorAll = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isResumeField', () => {
    it('should identify resume upload fields', () => {
      const resumeField: FormField = {
        id: 'resume-upload',
        type: 'file',
        label: 'Upload Resume',
        selector: '#resume',
        required: true
      };

      expect(FileUploadHandler.isResumeField(resumeField)).toBe(true);
    });

    it('should identify CV upload fields', () => {
      const cvField: FormField = {
        id: 'cv-upload',
        type: 'file',
        label: 'Upload CV',
        selector: '#cv',
        required: true
      };

      expect(FileUploadHandler.isResumeField(cvField)).toBe(true);
    });

    it('should not identify non-file fields', () => {
      const textField: FormField = {
        id: 'name',
        type: 'text',
        label: 'Full Name',
        selector: '#name',
        required: true
      };

      expect(FileUploadHandler.isResumeField(textField)).toBe(false);
    });

    it('should not identify unrelated file fields', () => {
      const imageField: FormField = {
        id: 'photo',
        type: 'file',
        label: 'Upload Photo',
        selector: '#photo',
        required: false
      };

      expect(FileUploadHandler.isResumeField(imageField)).toBe(false);
    });
  });

  describe('getAcceptedFileTypes', () => {
    it('should return default types when no accept attribute', () => {
      const mockInput = { type: 'file', accept: '' } as HTMLInputElement;
      (document.querySelector as jest.Mock).mockReturnValue(mockInput);

      const field: FormField = {
        id: 'resume',
        type: 'file',
        label: 'Resume',
        selector: '#resume',
        required: true
      };

      const types = FileUploadHandler.getAcceptedFileTypes(field);
      expect(types).toEqual(['pdf', 'docx', 'doc']);
    });

    it('should parse accept attribute correctly', () => {
      const mockInput = { 
        type: 'file', 
        accept: '.pdf,.docx,application/pdf' 
      } as HTMLInputElement;
      (document.querySelector as jest.Mock).mockReturnValue(mockInput);

      const field: FormField = {
        id: 'resume',
        type: 'file',
        label: 'Resume',
        selector: '#resume',
        required: true
      };

      const types = FileUploadHandler.getAcceptedFileTypes(field);
      expect(types).toContain('pdf');
      expect(types).toContain('docx');
    });
  });

  describe('uploadFile', () => {
    it('should return error when no documents available', async () => {
      const field: FormField = {
        id: 'resume',
        type: 'file',
        label: 'Resume',
        selector: '#resume',
        required: true
      };

      const result = await fileUploadHandler.uploadFile(field, []);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_DOCUMENT_AVAILABLE');
    });

    it('should return error when file input not found', async () => {
      (document.querySelector as jest.Mock).mockReturnValue(null);

      const field: FormField = {
        id: 'resume',
        type: 'file',
        label: 'Resume',
        selector: '#resume',
        required: true
      };

      const result = await fileUploadHandler.uploadFile(field, mockDocuments);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_INPUT_NOT_FOUND');
    });

    it('should select default document when available', async () => {
      const mockInput = {
        type: 'file',
        files: null,
        dispatchEvent: jest.fn()
      } as any;
      (document.querySelector as jest.Mock).mockReturnValue(mockInput);

      const field: FormField = {
        id: 'resume',
        type: 'file',
        label: 'Resume',
        selector: '#resume',
        required: true
      };

      // Mock successful file creation and upload
      Object.defineProperty(mockInput, 'files', {
        get: () => ({ length: 1, 0: { name: 'john_doe_resume.pdf' } }),
        set: jest.fn()
      });

      const result = await fileUploadHandler.uploadFile(field, mockDocuments);
      
      // Should attempt to use the default PDF document
      expect(fetch).toHaveBeenCalledWith('https://example.com/resume.pdf');
    });

    it('should validate file size', async () => {
      const largeDocument: ResumeDocument = {
        id: 'large-doc',
        name: 'Large Resume',
        fileName: 'large_resume.pdf',
        fileSize: 20 * 1024 * 1024, // 20MB (exceeds default 10MB limit)
        fileType: 'pdf',
        uploadDate: new Date(),
        isDefault: true,
        cloudUrl: 'https://example.com/large_resume.pdf'
      };

      const field: FormField = {
        id: 'resume',
        type: 'file',
        label: 'Resume',
        selector: '#resume',
        required: true
      };

      const result = await fileUploadHandler.uploadFile(field, [largeDocument]);
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DOCUMENT_VALIDATION_FAILED');
      expect(result.error?.message).toContain('exceeds maximum allowed size');
    });
  });

  describe('document selection', () => {
    it('should prefer default PDF document', () => {
      const handler = new FileUploadHandler({ preferredFileType: 'pdf' });
      const selectedDoc = (handler as any).selectBestDocument(mockDocuments, {
        preferredFileType: 'pdf',
        maxFileSize: 10 * 1024 * 1024,
        validateFileType: true,
        retryAttempts: 3
      });

      expect(selectedDoc).toBe(mockDocuments[0]); // Default PDF
    });

    it('should fall back to any default document', () => {
      const handler = new FileUploadHandler({ preferredFileType: 'docx' });
      const selectedDoc = (handler as any).selectBestDocument(mockDocuments, {
        preferredFileType: 'docx',
        maxFileSize: 10 * 1024 * 1024,
        validateFileType: true,
        retryAttempts: 3
      });

      // Should still select the default PDF since it's the default document
      expect(selectedDoc).toBe(mockDocuments[0]);
    });

    it('should select first document when no default', () => {
      const nonDefaultDocs = mockDocuments.map(doc => ({ ...doc, isDefault: false }));
      const handler = new FileUploadHandler();
      const selectedDoc = (handler as any).selectBestDocument(nonDefaultDocs, {
        preferredFileType: 'pdf',
        maxFileSize: 10 * 1024 * 1024,
        validateFileType: true,
        retryAttempts: 3
      });

      expect(selectedDoc).toBe(nonDefaultDocs[0]);
    });
  });
});