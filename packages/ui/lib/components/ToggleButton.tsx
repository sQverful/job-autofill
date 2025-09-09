import { cn } from '../utils';
import { useStorage } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import type { ComponentPropsWithoutRef } from 'react';

type ToggleButtonProps = ComponentPropsWithoutRef<'button'> & {
  showLabel?: boolean;
};

export const ToggleButton = ({ className, children, showLabel = true, ...props }: ToggleButtonProps) => {
  const { isLight } = useStorage(exampleThemeStorage);

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95',
        isLight 
          ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300' 
          : 'bg-gray-700 hover:bg-gray-600 text-gray-300 border border-gray-600',
        className,
      )}
      onClick={exampleThemeStorage.toggle}
      title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
      {...props}>
      <span className="mr-1">
        {isLight ? '🌙' : '☀️'}
      </span>
      {showLabel && (
        <span>{isLight ? 'Dark' : 'Light'}</span>
      )}
      {children}
    </button>
  );
};
