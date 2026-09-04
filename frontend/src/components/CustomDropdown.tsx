import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, LucideIcon } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: LucideIcon;
  count?: number;
  hidePill?: boolean;
}

interface CustomDropdownProps {
  id?: string;
  label: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: LucideIcon;
  placeholder?: string;
  align?: 'left' | 'right' | 'auto';
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
  menuWidthClass?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  id,
  label,
  options,
  value,
  onChange,
  icon: HeaderIcon,
  placeholder = 'Select option...',
  align = 'auto',
  className = '',
  labelClassName,
  triggerClassName,
  menuWidthClass
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find selected option (ignore empty placeholder options)
  const selectedOption = options.find((opt) => opt.value === value && opt.value !== '' && !opt.label.toLowerCase().startsWith('select'));
  
  // Filter out redundant placeholder options (e.g. value: '' with label 'Select ...') from selectable popover list
  const selectableOptions = options.filter((opt) => {
    if (opt.value === '' && (opt.label.toLowerCase().startsWith('select') || opt.label === placeholder)) {
      return false;
    }
    return true;
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const alignClass = align === 'right' 
    ? 'right-0 left-auto' 
    : align === 'left' 
      ? 'left-0 right-auto' 
      : 'left-0 sm:left-0';

  const popoverWidth = menuWidthClass || 'w-full min-w-full';

  return (
    <div className={`space-y-1 min-w-0 relative ${isOpen ? 'z-[100]' : 'z-10'} ${className}`} ref={dropdownRef} id={id}>
      <label className={labelClassName || "block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex items-center justify-between"}>
        <span>{label}</span>
        {selectedOption?.count !== undefined && selectedOption.count > 0 && (
          <span className="text-[9px] font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded-full border border-brand-500/20">
            {selectedOption.count}
          </span>
        )}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName || `w-full h-11 flex items-center justify-between px-4 rounded-2xl border transition-all duration-200 text-left cursor-pointer group shadow-sm ${
          isOpen
            ? 'bg-white dark:bg-slate-800 border-brand-500 ring-2 ring-brand-500/20 shadow-md shadow-brand-500/10'
            : 'bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-brand-500/40'
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
          {HeaderIcon && (
            <HeaderIcon className={`w-4 h-4 shrink-0 transition-colors ${
              isOpen ? 'text-brand-500' : 'text-slate-400 group-hover:text-brand-500'
            }`} />
          )}
          <div className="flex items-center space-x-2 min-w-0">
            {selectedOption?.badge && !selectedOption.hidePill && (
              <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                selectedOption.badgeColor || 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30'
              }`}>
                {selectedOption.badge}
              </span>
            )}
            <span className={`text-sm truncate ${
              selectedOption ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-semibold text-slate-400 dark:text-slate-500'
            }`}>
              {selectedOption ? selectedOption.label : (placeholder || label || 'Select...')}
            </span>
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
          isOpen ? 'rotate-180 text-brand-500' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300'
        }`} />
      </button>

      {/* Animated Dropdown Menu Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`absolute ${alignClass} z-[9999] mt-1.5 ${popoverWidth} max-h-80 overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-1.5 space-y-1 focus:outline-none ring-1 ring-black/10 dark:ring-white/10`}
            style={{
              backgroundColor: 'var(--dropdown-bg, #ffffff)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.08)'
            }}
          >
            {selectableOptions.map((opt) => {
              const isSelected = opt.value === value;
              const OptIcon = opt.icon;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left text-sm font-bold transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/30'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    {OptIcon && (
                      <OptIcon className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-white' : 'text-slate-400 group-hover:text-brand-500'
                      }`} />
                    )}
                    {opt.badge && !opt.hidePill && (
                      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        isSelected
                          ? 'bg-white/20 text-white border border-white/30'
                          : opt.badgeColor || 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20'
                      }`}>
                        {opt.badge}
                      </span>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className={`text-[10px] font-medium truncate ${
                          isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {opt.count !== undefined && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}>
                        {opt.count}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
