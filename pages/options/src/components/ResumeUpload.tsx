import React, { useState } from 'react';
import { Button, cn } from '@extension/ui';
import type { UserProfile, ResumeDocument } from '@extension/shared';

interface ResumeUploadProps {
  profile: UserProfile;
  onChange: (updates: Partial<UserProfile['documents']>) => void;
  onParseResume?: (file: File) => Promise<Partial<UserProfile>>;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({
  profile,
  onChange,
  onParseResume,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please upload a PDF or DOCX file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Create resume document entry
      const resumeDoc: ResumeDocument = {
        id: `resume_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type.includes('pdf') ? 'pdf' : 'docx',
        uploadDate: new Date(),
        isDefault: profile.documents.resumes.length === 0, // First upload is default
      };

      // Add to documents
      const updatedResumes = [...profile.documents.resumes, resumeDoc];
      onChange({ resumes: updatedResumes });

      // Try to parse resume if parser is available
      if (onParseResume) {
        try {
          await onParseResume(file);
        } catch (parseError) {
          console.warn('Resume parsing failed:', parseError);
          // Don't show error to user, parsing is optional
        }
      }

    } catch (error) {
      setUploadError('Failed to upload resume. Please try again.');
      console.error('Resume upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  };

  const handleRemoveResume = (resumeId: string) => {
    const updatedResumes = profile.documents.resumes.filter(resume => resume.id !== resumeId);

    // If we removed the default resume, make the first remaining one default
    if (updatedResumes.length > 0 && !updatedResumes.some(r => r.isDefault)) {
      updatedResumes[0].isDefault = true;
    }

    onChange({ resumes: updatedResumes });
  };

  const handleSetDefault = (resumeId: string) => {
    const updatedResumes = profile.documents.resumes.map(resume => ({
      ...resume,
      isDefault: resume.id === resumeId,
    }));

    onChange({ resumes: updatedResumes });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Resume & Documents
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Upload your resume to automatically fill file upload fields and extract profile information.
        </p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        )}
      >
        <div className="space-y-4">
          <div className="text-gray-400 dark:text-gray-500">
            <svg className="mx-auto h-12 w-12" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <p className="text-gray-600 dark:text-gray-400">
              {isDragging ? 'Drop your resume here' : 'Drag and drop your resume here, or'}
            </p>
            <label className="cursor-pointer">
              <span className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
                browse to upload
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx"
                onChange={handleFileInputChange}
                disabled={isUploading}
              />
            </label>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            PDF or DOCX files up to 5MB
          </p>

          {isUploading && (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">Uploading...</span>
            </div>
          )}

          {uploadError && (
            <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
          )}
        </div>
      </div>

      {/* Uploaded Resumes */}
      {profile.documents.resumes.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
            Uploaded Resumes
          </h4>
          <div className="space-y-3">
            {profile.documents.resumes.map((resume) => (
              <div
                key={resume.id}
                className={cn(
                  'flex items-center justify-between p-4 border rounded-lg',
                  resume.isDefault
                    ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      resume.fileType === 'pdf'
                        ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                        : 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    )}>
                      {resume.fileType === 'pdf' ? 'PDF' : 'DOC'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {resume.name}
                      </p>
                      {resume.isDefault && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(resume.fileSize)} • Uploaded {
                        resume.uploadDate instanceof Date 
                          ? resume.uploadDate.toLocaleDateString()
                          : new Date(resume.uploadDate).toLocaleDateString()
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!resume.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetDefault(resume.id)}
                    >
                      Set Default
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveResume(resume.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cover Letters Placeholder */}
      <div>
        <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
          Cover Letter Templates
        </h4>
        <div className={cn(
          'border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center'
        )}>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Cover letter templates coming soon
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            AI-powered cover letter generation will be available in the next update
          </p>
        </div>
      </div>
    </div>
  );
};