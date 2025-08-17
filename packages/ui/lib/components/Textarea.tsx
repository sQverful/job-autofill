import React from 'react';
import { cn } from '../utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  warning?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({
  className,
  error,
  warning,
  ...props
}) => {
  return (
    <textarea
      className={cn(
        'w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
        'border-gray-300 dark:border-gray-600',
        'resize-vertical min-h-[100px]',
        error && 'border-red-500 focus:ring-red-500 focus:border-red-500',
        warning && !error && 'border-yellow-500 focus:ring-yellow-500 focus:border-yellow-500',
        className
      )}
      {...props}
    />
  );
};