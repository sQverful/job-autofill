import React from 'react';
import { cn } from '../utils';

interface FormFieldProps {
  label: string;
  error?: string;
  warning?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  warning,
  required = false,
  children,
  className,
}) => {
  return (
    <div className={cn('mb-4', className)}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {warning && !error && (
        <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">{warning}</p>
      )}
    </div>
  );
};