import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Filter, X } from 'lucide-react';
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
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
            "relative w-full flex items-center justify-between px-4 py-2.5 min-h-[44px] bg-white dark:bg-navy-950",
            "border transition-all duration-200 outline-none select-none rounded-[1.25rem] cursor-pointer",
            isOpen 
              ? "border-brand-500 ring-4 ring-brand-500/10 shadow-sm" 
              : "border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 hover:shadow-sm"
          )}
        >
          <div className="flex items-center space-x-3 overflow-hidden min-w-0 flex-1">
            <div className={clsx(
              "shrink-0 transition-colors duration-200",
              isOpen ? "text-brand-500" : "text-slate-400 dark:text-slate-500"
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
            
            <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate flex-1 text-left">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown 
            className={clsx(
              "w-4 h-4 shrink-0 transition-transform duration-200 ml-2",
              isOpen ? "rotate-180 text-brand-500" : "text-slate-400 dark:text-slate-500"
            )} 
          />
        </button>

        {/* MOBILE BOTTOM SHEET PORTAL (< 640px) */}
        {isOpen && isMobile && createPortal(
          <div 
            className="fixed inset-0 z-[99999] flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm p-0 animate-fade-in"
            onClick={() => setIsOpen(false)}
          >
            <div 
              className="bg-white dark:bg-navy-950 rounded-t-3xl border-t border-slate-200 dark:border-navy-700 p-5 space-y-4 max-h-[75vh] flex flex-col w-full shadow-2xl animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-3">
                <div className="flex items-center space-x-2">
                  {icon || <Filter className="w-5 h-5 text-brand-500" />}
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                    {label || 'Select Option'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto overscroll-contain space-y-2 py-1 flex-1 pr-1 custom-scrollbar">
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
                        "w-full flex items-center justify-between p-3.5 min-h-[48px] rounded-2xl transition-all text-left cursor-pointer",
                        isSelected
                          ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                          : "bg-slate-50 dark:bg-navy-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
                      )}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {opt.hidePill !== true && (
                          <span className={clsx(
                            "text-[10px] font-extrabold px-2.5 py-1 rounded-lg tracking-wide shrink-0",
                            getPillColor(opt, isSelected)
                          )}>
                            {getPillText(opt)}
                          </span>
                        )}
                        <span className={clsx(
                          "text-xs sm:text-sm font-bold break-words whitespace-normal leading-snug flex-1",
                          isSelected ? "text-white" : "text-slate-900 dark:text-white"
                        )}>
                          {opt.label}
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-2" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* DESKTOP DROPDOWN PANEL (>= 640px) */}
        <AnimatePresence>
          {isOpen && !isMobile && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={clsx(
                "absolute z-[9999] mt-2 top-full left-0 bg-white dark:bg-navy-950",
                "rounded-[1.25rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-navy-800/60 overflow-hidden max-w-[calc(100vw-2rem)]",
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
                        "w-full flex items-center justify-between px-3 py-2.5 min-h-[44px] mx-2 w-[calc(100%-16px)] rounded-xl transition-all duration-150 outline-none text-left cursor-pointer",
                        isSelected 
                          ? "bg-brand-600 text-white shadow-md shadow-brand-500/20" 
                          : "hover:bg-slate-50 dark:hover:bg-navy-800"
                      )}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className={clsx(
                          "shrink-0",
                          isSelected ? "text-white/90" : "text-slate-400 dark:text-slate-500"
                        )}>
                          {opt.icon || icon || <Filter className="w-5 h-5" />}
                        </div>
                        
                        {opt.hidePill !== true && (
                          <div className={clsx(
                            "text-[10px] font-extrabold px-2 py-0.5 rounded-lg tracking-wide shadow-sm shrink-0",
                            getPillColor(opt, isSelected)
                          )}>
                            {getPillText(opt)}
                          </div>
                        )}
                        <span className={clsx(
                          "text-xs sm:text-sm font-semibold break-words whitespace-normal text-left flex-1 min-w-0",
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
