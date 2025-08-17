import React, { useRef, useState } from 'react';
import { cn } from '../utils';

interface FileUploadProps {
  accept?: string;
  maxSize?: number; // in bytes
  multiple?: boolean;
  onFileSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept = '*/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  multiple = false,
  onFileSelect,
  onError,
  className,
  children,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFiles = (files: FileList): File[] => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      // Check file size
      if (file.size > maxSize) {
        errors.push(`${file.name} is too large. Maximum size is ${formatFileSize(maxSize)}.`);
        return;
      }

      // Check file type if accept is specified and not wildcard
      if (accept !== '*/*') {
        const acceptedTypes = accept.split(',').map(type => type.trim());
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        const mimeType = file.type;

        const isAccepted = acceptedTypes.some(acceptedType => {
          if (acceptedType.startsWith('.')) {
            return acceptedType.toLowerCase() === fileExtension;
          }
          return mimeType.match(new RegExp(acceptedType.replace('*', '.*')));
        });

        if (!isAccepted) {
          errors.push(`${file.name} is not an accepted file type. Accepted types: ${accept}`);
          return;
        }
      }

      validFiles.push(file);
    });

    if (errors.length > 0 && onError) {
      onError(errors.join(' '));
    }

    return validFiles;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const validFiles = validateFiles(files);
    if (validFiles.length > 0) {
      onFileSelect(validFiles);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer',
        'hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20',
        isDragOver && 'border-blue-500 bg-blue-50 dark:bg-blue-900/20',
        disabled && 'opacity-50 cursor-not-allowed hover:border-gray-300 hover:bg-transparent',
        'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800',
        className
      )}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />
      
      {children || (
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-blue-600 dark:text-blue-400">
                Click to upload
              </span>{' '}
              or drag and drop
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {accept !== '*/*' && `Accepted formats: ${accept}`}
              {maxSize && ` • Max size: ${formatFileSize(maxSize)}`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};