import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight?: number; transformOrigin?: string } | null>(null);

  // Find selected option
  const selectedOption = options.find((opt) => opt.value === value && !opt.label.toLowerCase().startsWith('select'));
  
  // Filter out redundant placeholder options (e.g. value: '' with label 'Select ...') from selectable popover list
  const selectableOptions = options.filter((opt) => {
    if (opt.value === '' && (opt.label.toLowerCase().startsWith('select') || opt.label === placeholder)) {
      return false;
    }
    return true;
  });

  const updateCoords = useCallback(() => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      const spaceBelow = viewportHeight - rect.bottom - 80; // 80px safe area for bottom buttons/notches
      const spaceAbove = rect.top - 60; // 60px safe area for top headers
      
      // Calculate how much space the options would actually take (approx 44px per option)
      const estimatedHeight = Math.min(selectableOptions.length * 44 + 16, 256); // max 256px
      
      let top = rect.bottom + 4;
      let maxHeight = Math.max(100, spaceBelow); // default down
      let transformOrigin = 'top';

      // If space below is not enough for the full estimated height, and space above is greater
      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        // Open upwards
        maxHeight = Math.max(100, spaceAbove);
        top = rect.top - Math.min(estimatedHeight, maxHeight) - 4;
        transformOrigin = 'bottom';
      }

      setCoords({
        top: Math.max(8, top),
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(maxHeight, 256),
        transformOrigin
      });
    }
  }, [selectableOptions.length]);

  // Close dropdown on outside click or scroll
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && dropdownRef.current.contains(event.target as Node)) {
        return;
      }
      const popoverEl = document.getElementById(`dropdown-popover-${id || label}`);
      if (popoverEl && popoverEl.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      updateCoords();
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen, updateCoords, id, label]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  const menuPopover = isOpen && coords && typeof document !== 'undefined' ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          id={`dropdown-popover-${id || label}`}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            maxHeight: coords.maxHeight ? `${coords.maxHeight}px` : '256px',
            transformOrigin: coords.transformOrigin || 'top',
            zIndex: 99999999
          }}
          className="overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] p-1.5 space-y-1 focus:outline-none scrollbar-thin"
        >
          {selectableOptions.map((opt) => {
            const isSelected = opt.value === value;
            const OptIcon = opt.icon;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs font-bold transition-all cursor-pointer group ${
                  isSelected
                    ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-600/30'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2 min-w-0 pr-2 w-full">
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
                  <div className="flex flex-col min-w-0 w-full">
                    <span className="truncate text-xs font-bold text-left">{opt.label}</span>
                    {opt.sublabel && (
                      <span className={`text-[10px] font-medium truncate text-left ${
                        isSelected ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 ml-1">
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
      </AnimatePresence>,
      document.body
    )
  ) : null;

  return (
    <div className={`flex flex-col space-y-1.5 w-full max-w-full min-w-0 box-border relative ${className}`} ref={dropdownRef} id={id}>
      {label ? (
        <label className={labelClassName || "block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate flex items-center justify-between h-4 leading-4 m-0 p-0"}>
          <span>{label}</span>
          {selectedOption?.count !== undefined && selectedOption.count > 0 && (
            <span className="text-[9px] font-mono font-bold text-brand-600 dark:text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded-full border border-brand-500/20">
              {selectedOption.count}
            </span>
          )}
        </label>
      ) : null}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) {
            // Scroll to view logic if near bottom or top
            const rect = dropdownRef.current?.getBoundingClientRect();
            if (rect) {
              const isNearBottom = window.innerHeight - rect.bottom < 150;
              const isNearTop = rect.top < 100;
              if (isNearBottom || isNearTop) {
                dropdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
            updateCoords();
          }
          setIsOpen(!isOpen);
        }}
        className={triggerClassName || `w-full h-11 min-h-[44px] py-2 flex items-center justify-between px-3.5 rounded-2xl border transition-all duration-200 text-left cursor-pointer group shadow-sm box-border ${
          isOpen
            ? 'bg-white dark:bg-slate-800 border-brand-500 ring-2 ring-brand-500/20 shadow-md shadow-brand-500/10'
            : 'bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 hover:border-brand-500/40'
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden pr-2">
          {HeaderIcon && (
            <HeaderIcon className={`w-4 h-4 shrink-0 transition-colors ${
              isOpen ? 'text-brand-500' : 'text-slate-400 group-hover:text-brand-500'
            }`} />
          )}
          <div className="flex items-center space-x-2 min-w-0 flex-1 overflow-hidden">
            {selectedOption?.badge && !selectedOption.hidePill && (
              <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                selectedOption.badgeColor || 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border border-brand-500/30'
              }`}>
                {selectedOption.badge}
              </span>
            )}
            <span className={`text-xs font-bold truncate block min-w-0 flex-1 ${
              selectedOption ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
            }`}>
              {selectedOption ? selectedOption.label : (placeholder || label || 'Select...')}
            </span>
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${
          isOpen ? 'rotate-180 text-brand-500' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300'
        }`} />
      </button>

      {menuPopover}
    </div>
  );
};
