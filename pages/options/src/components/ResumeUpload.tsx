import React, { useState } from 'react';
import { FileUpload, Button, FormField } from '@extension/ui';
import type { UserProfile, ResumeDocument } from '@extension/shared';

interface ResumeUploadProps {
  profile: UserProfile;
  onChange: (updates: Partial<UserProfile['documents']>) => void;
  onParseResume: (file: File) => Promise<Partial<UserProfile>>;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({
  profile,
  onChange,
  onParseResume,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccess, setParseSuccess] = useState<string | null>(null);

  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    setParseError(null);
    setParseSuccess(null);

    try {
      // Create resume document entry
      const resumeDoc: ResumeDocument = {
        id: `resume_${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        content: '', // In a real app, you'd store the file content or URL
        isPrimary: profile.documents.resumes.length === 0, // First resume is primary
      };

      // Add to documents
      const updatedResumes = [...profile.documents.resumes, resumeDoc];
      onChange({ resumes: updatedResumes });

      // Try to parse the resume
      setIsParsing(true);
      try {
        await onParseResume(file);
        setParseSuccess(`Successfully parsed and applied data from ${file.name}`);
      } catch (parseErr) {
        setParseError(`Failed to parse resume: ${parseErr instanceof Error ? parseErr.message : 'Unknown error'}`);
        // Keep the uploaded file even if parsing fails
      }
    } catch (error) {
      setParseError(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      setIsParsing(false);
    }
  };

  const handleRemoveResume = (resumeId: string) => {
    const updatedResumes = profile.documents.resumes.filter(resume => resume.id !== resumeId);
    
    // If we removed the primary resume, make the first remaining one primary
    if (updatedResumes.length > 0 && !updatedResumes.some(r => r.isPrimary)) {
      updatedResumes[0].isPrimary = true;
    }
    
    onChange({ resumes: updatedResumes });
  };

  const handleSetPrimary = (resumeId: string) => {
    const updatedResumes = profile.documents.resumes.map(resume => ({
      ...resume,
      isPrimary: resume.id === resumeId,
    }));
    onChange({ resumes: updatedResumes });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          Documents & Resume
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Upload your resume to automatically extract and populate your profile information.
          Supported formats: PDF, DOC, DOCX
        </p>
      </div>

      {/* File Upload */}
      <div>
        <FormField
          label="Upload Resume"
          description="We'll automatically extract information from your resume to populate your profile"
        >
          <FileUpload
            onFilesSelected={handleFileUpload}
            accept=".pdf,.doc,.docx"
            maxFiles={1}
            disabled={isUploading || isParsing}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          >
            <div className="space-y-2">
              <div className="text-gray-600 dark:text-gray-400">
                {isUploading ? (
                  <span>Uploading...</span>
                ) : isParsing ? (
                  <span>Parsing resume...</span>
                ) : (
                  <>
                    <span>Drop your resume here or </span>
                    <span className="text-blue-600 dark:text-blue-400 underline">browse files</span>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                PDF, DOC, DOCX up to 10MB
              </div>
            </div>
          </FileUpload>
        </FormField>
      </div>

      {/* Status Messages */}
      {parseError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="text-sm text-red-800 dark:text-red-200">
            {parseError}
          </div>
        </div>
      )}

      {parseSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
          <div className="text-sm text-green-800 dark:text-green-200">
            {parseSuccess}
          </div>
        </div>
      )}

      {/* Uploaded Resumes */}
      {profile.documents.resumes.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
            Uploaded Resumes
          </h4>
          <div className="space-y-3">
            {profile.documents.resumes.map((resume) => (
              <div
                key={resume.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {resume.name}
                      </p>
                      {resume.isPrimary && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{formatFileSize(resume.size)}</span>
                      <span>•</span>
                      <span>Uploaded {resume.uploadedAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!resume.isPrimary && (
                    <Button
                      onClick={() => handleSetPrimary(resume.id)}
                      variant="outline"
                      size="sm"
                    >
                      Set Primary
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => handleRemoveResume(resume.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resume Parsing Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          About Resume Parsing
        </h4>
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p>• We automatically extract personal information, work experience, education, and skills</p>
          <p>• Parsed data is merged with your existing profile information</p>
          <p>• You can review and edit all extracted information before saving</p>
          <p>• Your resume files are processed locally and securely</p>
        </div>
      </div>
    </div>
  );
};