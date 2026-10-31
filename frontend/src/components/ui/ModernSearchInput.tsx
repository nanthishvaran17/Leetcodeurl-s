import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

export interface ModernSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ModernSearchInput: React.FC<ModernSearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
  inputClassName = '',
  id,
  autoFocus = false,
  disabled = false,
  size = 'md'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    if (onClear) onClear();
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const heightClass =
    size === 'sm' ? 'h-9 min-h-[36px]' : size === 'lg' ? 'h-12 min-h-[48px]' : 'h-11 min-h-[44px]';

  return (
    <div
      className={`group relative flex items-center w-full ${heightClass} rounded-2xl bg-white dark:bg-[#0b0f19] border border-purple-200/90 hover:border-purple-400/90 dark:border-purple-500/30 dark:hover:border-purple-400/50 shadow-[0_2px_12px_rgba(168,85,247,0.06)] dark:shadow-[0_2px_14px_rgba(168,85,247,0.12)] focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all ${className}`}
    >
      {/* Left Search Icon */}
      <div className="pointer-events-none pl-3.5 pr-2.5 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
        <Search className="w-4 h-4 stroke-[2.5]" />
      </div>

      {/* Input Field */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`flex-1 w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none pr-9 py-2 truncate text-left ${inputClassName}`}
      />

      {/* Clear X Button */}
      {value && !disabled && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};
