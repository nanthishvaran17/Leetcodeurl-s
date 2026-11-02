import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, X, LucideIcon } from 'lucide-react';
import { SwipeHandle } from './SwipeHandle';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface CustomMultiSelectDropdownProps {
  label?: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  icon?: LucideIcon;
  placeholder?: string;
  colorTheme?: 'indigo' | 'emerald' | 'brand' | 'amber' | 'rose' | 'slate';
  triggerClassName?: string;
  className?: string;
}

export const CustomMultiSelectDropdown: React.FC<CustomMultiSelectDropdownProps> = ({
  label,
  options,
  selectedValues = [],
  onChange,
  icon: Icon,
  placeholder = 'Select options...',
  colorTheme = 'indigo',
  triggerClassName,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const themeColors = {
    indigo: {
      activeBg: 'bg-indigo-50 dark:bg-indigo-900/30',
      activeText: 'text-indigo-700 dark:text-indigo-300',
      activeBadge: 'bg-indigo-500 border-indigo-600',
      pill: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800'
    },
    emerald: {
      activeBg: 'bg-emerald-50 dark:bg-emerald-900/30',
      activeText: 'text-emerald-700 dark:text-emerald-300',
      activeBadge: 'bg-emerald-500 border-emerald-600',
      pill: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
    },
    brand: {
      activeBg: 'bg-brand-50 dark:bg-brand-900/30',
      activeText: 'text-brand-700 dark:text-brand-300',
      activeBadge: 'bg-brand-500 border-brand-600',
      pill: 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200 border-brand-200 dark:border-brand-800'
    },
    amber: {
      activeBg: 'bg-amber-50 dark:bg-amber-900/30',
      activeText: 'text-amber-700 dark:text-amber-300',
      activeBadge: 'bg-amber-500 border-amber-600',
      pill: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
    },
    rose: {
      activeBg: 'bg-rose-50 dark:bg-rose-900/30',
      activeText: 'text-rose-700 dark:text-rose-300',
      activeBadge: 'bg-rose-500 border-rose-600',
      pill: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800'
    },
    slate: {
      activeBg: 'bg-slate-100 dark:bg-navy-800',
      activeText: 'text-slate-800 dark:text-slate-200',
      activeBadge: 'bg-slate-700 border-slate-800',
      pill: 'bg-slate-200 dark:bg-navy-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-navy-600'
    }
  };

  const theme = themeColors[colorTheme] || themeColors.indigo;

  const updateMenuPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setMenuPos({
      top: placeAbove ? rect.top - dropdownHeight - 6 : rect.bottom + 6,
      left: Math.max(8, rect.left),
      width: Math.min(rect.width, window.innerWidth - 16)
    });
  };

  useEffect(() => {
    if (isOpen) {
      updateMenuPosition();
      const handleScroll = () => updateMenuPosition();
      const handleResize = () => updateMenuPosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectedLabels = options
    .filter(opt => selectedValues.includes(opt.value))
    .map(opt => opt.label);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
          {label}
        </label>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName || `flex items-center justify-between w-full h-11 min-h-[44px] py-2 px-3.5 rounded-2xl border bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 text-slate-800 dark:text-white font-black cursor-pointer shadow-2xs transition-all`}
      >
        <div className="flex items-center space-x-2 truncate flex-1 pr-2">
          {Icon && <Icon className="w-4 h-4 shrink-0 opacity-70" />}
          {selectedValues.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-slate-500 font-bold truncate">
              {placeholder}
            </span>
          ) : (
            <span className="text-xs font-black truncate">
              {selectedLabels.length <= 2
                ? selectedLabels.join(', ')
                : `${selectedLabels.length} selected`}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          {selectedValues.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black border ${theme.pill}`}>
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                zIndex: 99999
              }}
              className="bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden flex flex-col max-h-[260px]"
            >
              <SwipeHandle onClose={() => setIsOpen(false)} />
              <div className="p-1.5 overflow-y-auto no-scrollbar space-y-1">
                {options.map((opt) => {
                  const isSel = selectedValues.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleOption(opt.value)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                        isSel ? theme.activeBg : 'hover:bg-slate-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      <div className="flex flex-col flex-1 pr-2">
                        <span
                          className={`text-[11px] leading-snug font-black whitespace-normal break-words ${
                            isSel ? theme.activeText : 'text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </span>
                        {opt.sublabel && (
                          <span className="text-[10px] text-slate-400 dark:text-navy-400">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                      <div
                        className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
                          isSel
                            ? `${theme.activeBadge} text-white`
                            : 'border-slate-300 dark:border-navy-600'
                        }`}
                      >
                        {isSel && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
