import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface GlobalFilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  pillText?: string;
  pillColorClass?: string;
  hidePill?: boolean;
}

export interface GlobalFilterProps {
  label?: string;
  options: GlobalFilterOption[];
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
  dropdownWidth?: string;
  placeholder?: string;
}

export const GlobalFilter: React.FC<GlobalFilterProps> = ({
  label,
  options,
  value,
  onChange,
  icon,
  className = '',
  dropdownWidth = 'w-72',
  placeholder = 'Select an option'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPillText = (opt: GlobalFilterOption | undefined) => {
    if (!opt) return 'ALL';
    if (opt.pillText) return opt.pillText;
    if (opt.value === 'ALL' || opt.value === '' || opt.value === 'all') return 'ALL';
    if (opt.value.length <= 6) return opt.value.toUpperCase();
    return opt.value.substring(0, 3).toUpperCase();
  };

  const getPillColor = (opt: GlobalFilterOption | undefined, isSelected: boolean) => {
    if (isSelected) return 'bg-white/20 text-white border border-white/30';
    if (!opt) return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    if (opt.pillColorClass) return opt.pillColorClass;
    if (opt.value === 'ALL' || opt.value === '' || opt.value === 'all') return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    
    // Hash string to pick a dynamic color class if none provided
    const colors = [
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
      'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300'
    ];
    let hash = 0;
    for (let i = 0; i < opt.value.length; i++) hash = opt.value.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={twMerge('flex flex-col space-y-1.5', className)} ref={containerRef}>
      {/* Optional Top Label */}
      {label && (
        <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase ml-1">
          {label}
        </span>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={twMerge(
            "relative w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-navy-900",
            "border transition-all duration-200 outline-none select-none rounded-[1.25rem]",
            isOpen 
              ? "border-blue-500 ring-4 ring-blue-500/10 shadow-sm" 
              : "border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 hover:shadow-sm"
          )}
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className={clsx(
              "shrink-0 transition-colors duration-200",
              isOpen ? "text-blue-500" : "text-slate-400 dark:text-slate-500"
            )}>
              {selectedOption?.icon || icon || <Filter className="w-5 h-5" />}
            </div>
            
            {selectedOption?.hidePill !== true && (
              <div className={clsx(
                "shrink-0 text-[10px] font-extrabold px-2 py-1 rounded-lg tracking-wide",
                isOpen ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" : getPillColor(selectedOption, false)
              )}>
                {getPillText(selectedOption)}
              </div>
            )}
            
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown 
            className={clsx(
              "w-4 h-4 shrink-0 transition-transform duration-200 ml-3",
              isOpen ? "rotate-180 text-blue-500" : "text-slate-400 dark:text-slate-500"
            )} 
          />
        </button>

        {/* Dropdown Panel */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={clsx(
                "absolute z-[9999] mt-2 top-full left-0 bg-white dark:bg-navy-900",
                "rounded-[1.25rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-navy-800/60 overflow-hidden",
                dropdownWidth
              )}
            >
              <div className="max-h-[320px] overflow-y-auto overscroll-contain py-2 stylish-scrollbar">
                {options.map((opt) => {
                  const isSelected = opt.value === value;
                  
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                      }}
                      className={clsx(
                        "w-full flex items-center justify-between px-3 py-2.5 mx-2 w-[calc(100%-16px)] rounded-xl transition-all duration-150 outline-none text-left",
                        isSelected 
                          ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
                          : "hover:bg-slate-50 dark:hover:bg-navy-800"
                      )}
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <div className={clsx(
                          "shrink-0",
                          isSelected ? "text-white/90" : "text-slate-400 dark:text-slate-500"
                        )}>
                          {opt.icon || icon || <Filter className="w-5 h-5" />}
                        </div>
                        
                        {opt.hidePill !== true && (
                          <div className={clsx(
                            "text-[10px] font-extrabold px-2 py-0.5 rounded-lg tracking-wide shadow-sm",
                            getPillColor(opt, isSelected)
                          )}>
                            {getPillText(opt)}
                          </div>
                        )}
                        <span className={clsx(
                          "text-sm font-semibold truncate",
                          isSelected ? "text-white" : "text-slate-700 dark:text-slate-200"
                        )}>
                          {opt.label}
                        </span>
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-white shrink-0 ml-3" strokeWidth={3} />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
