import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Filter, X, Search } from 'lucide-react';
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
  align?: 'left' | 'right';
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export const GlobalFilter: React.FC<GlobalFilterProps> = ({
  label,
  options,
  value,
  onChange,
  icon,
  className = '',
  dropdownWidth = 'min-w-[580px]',
  placeholder = 'Select an option',
  align = 'left',
  showSearch = true,
  searchPlaceholder
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    positionUp: boolean;
    maxHeight: number;
  }>({
    top: 0,
    left: 0,
    width: 480,
    positionUp: false,
    maxHeight: 380
  });

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  // Reset search on close
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      (opt.pillText && opt.pillText.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const padding = 8;
    const spaceBelow = window.innerHeight - rect.bottom - padding;
    const spaceAbove = rect.top - padding;

    // Estimate total dropdown height needed based on option count + search bar
    const searchHeaderHeight = (showSearch && options.length > 3) ? 54 : 0;
    const estimatedHeight = Math.min(380, filteredOptions.length * 44 + searchHeaderHeight + 16);
    const shouldFlipUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const availableHeight = shouldFlipUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(160, Math.min(380, availableHeight));

    // Dynamic width calculation:
    // Determine target width from dropdownWidth prop or default min-w-[580px]
    let baseWidth = 580;
    if (dropdownWidth) {
      const match = dropdownWidth.match(/(?:min-w-\[|w-\[)(\d+)px\]/);
      if (match && match[1]) {
        baseWidth = parseInt(match[1], 10);
      }
    }


    let computedWidth = Math.max(rect.width, baseWidth);
    // Clamp to screen width minus safe margins
    computedWidth = Math.min(computedWidth, Math.max(280, window.innerWidth - 24));

    let top = 0;
    const actualMenuHeight = Math.min(estimatedHeight, maxHeight);
    if (shouldFlipUp) {
      top = Math.max(12, rect.top - actualMenuHeight - 6);
    } else {
      top = rect.bottom + 6;
    }

    let left = rect.left;
    if (align === 'right' || left + computedWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.right - computedWidth);
    }
    if (left + computedWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - computedWidth - 12);
    }

    setCoords({
      top,
      left,
      width: computedWidth,
      positionUp: shouldFlipUp,
      maxHeight
    });
  }, [filteredOptions.length, options.length, align, dropdownWidth, showSearch]);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updateCoords]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
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
  }, [isOpen]);

  const getPillText = (opt: GlobalFilterOption | undefined) => {
    if (!opt) return 'ALL';
    if (opt.pillText) return opt.pillText;
    if (opt.value === 'ALL' || opt.value === '' || opt.value === 'all') return 'ALL';
    if (opt.value.length <= 6) return opt.value.toUpperCase();
    return opt.value.substring(0, 3).toUpperCase();
  };

  const getPillColor = (opt: GlobalFilterOption | undefined, isSelected: boolean) => {
    if (isSelected) return 'bg-white/20 text-white border border-white/30';
    if (!opt) return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    if (opt.pillColorClass) return opt.pillColorClass;
    if (opt.value === 'ALL' || opt.value === '' || opt.value === 'all') return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    
    const colors = [
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800'
    ];
    let hash = 0;
    for (let i = 0; i < opt.value.length; i++) hash = opt.value.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const activeSearchPlaceholder = searchPlaceholder || (label ? `Search ${label.toLowerCase()}...` : 'Search department...');

  return (
    <div className={twMerge('flex flex-col space-y-1.5 min-w-0 w-full', className)}>
      {/* Optional Top Label */}
      {label && (
        <span className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate h-4 leading-4 m-0 p-0">
          {label}
        </span>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={twMerge(
            "relative w-full flex items-center justify-between px-3.5 py-2 h-11 min-h-[44px] bg-white dark:bg-slate-800",
            "border transition-all duration-200 outline-none select-none rounded-2xl cursor-pointer shadow-sm",
            isOpen 
              ? "border-brand-500 ring-2 ring-brand-500/20 shadow-md shadow-brand-500/10" 
              : "border-slate-200 dark:border-slate-700/80 hover:border-brand-500/40 hover:shadow-sm"
          )}
        >
          <div className="flex items-center space-x-2 overflow-hidden min-w-0 flex-1 pr-2">
            <div className={clsx(
              "shrink-0 transition-colors duration-200",
              isOpen ? "text-brand-500" : "text-slate-400 dark:text-slate-500"
            )}>
              {selectedOption?.icon || icon || <Filter className="w-4 h-4" />}
            </div>
            
            {selectedOption?.hidePill !== true && (
              <div className={clsx(
                "shrink-0 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                isOpen ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300" : getPillColor(selectedOption, false)
              )}>
                {getPillText(selectedOption)}
              </div>
            )}
            
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex-1 text-left">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown 
            className={clsx(
              "w-4 h-4 shrink-0 transition-transform duration-200 ml-1",
              isOpen ? "rotate-180 text-brand-500" : "text-slate-400 dark:text-slate-500"
            )} 
          />
        </button>

        {/* MOBILE BOTTOM SHEET PORTAL (< 640px) */}
        {isOpen && isMobile && createPortal(
          <div 
            className="fixed inset-0 z-[999999] flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm p-0 animate-fade-in"
            onClick={() => setIsOpen(false)}
          >
            <div 
              className="bg-white dark:bg-navy-950 rounded-t-3xl border-t border-slate-200 dark:border-navy-700 p-4 space-y-3 max-h-[85vh] flex flex-col w-full shadow-2xl animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-2.5">
                <div className="flex items-center space-x-2">
                  {icon || <Filter className="w-5 h-5 text-brand-500" />}
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                    {label || 'Select Option'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Search Bar */}
              {showSearch && options.length > 3 && (
                <div className="relative flex items-center">
                  <Search className="w-4 h-4 absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeSearchPlaceholder}
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <div className="overflow-y-auto overscroll-contain space-y-1.5 py-1 flex-1 pr-1 custom-scrollbar">
                {filteredOptions.length === 0 ? (
                  <div className="py-8 text-center text-xs font-bold text-slate-400">
                    No departments match your search.
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
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
                          "w-full flex items-center justify-between p-3 min-h-[44px] rounded-xl transition-all text-left cursor-pointer",
                          isSelected
                            ? "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                            : "bg-slate-50 dark:bg-navy-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800"
                        )}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0 pr-2">
                          <div className={clsx("shrink-0", isSelected ? "text-white" : "text-slate-400 dark:text-slate-500")}>
                            {opt.icon || icon || <Filter className="w-4 h-4" />}
                          </div>
                          {opt.hidePill !== true && (
                            <span className={clsx(
                              "w-16 min-w-[4rem] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border",
                              getPillColor(opt, isSelected)
                            )}>
                              {getPillText(opt)}
                            </span>
                          )}
                          <span className={clsx(
                            "text-xs font-bold flex-1 min-w-0 tracking-tight leading-snug break-words hyphens-none",
                            isSelected ? "text-white font-extrabold" : "text-slate-800 dark:text-slate-200 font-semibold"
                          )}>
                            {opt.label}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-white shrink-0 ml-2" strokeWidth={3} />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* DESKTOP FLOATING PORTAL (>= 640px) */}
        {isOpen && !isMobile && createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxWidth: 'calc(100vw - 24px)',
              zIndex: 999999,
            }}
            className="animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="bg-white dark:bg-navy-950 rounded-[1.25rem] shadow-[0_16px_48px_rgba(0,0,0,0.25)] border border-slate-200 dark:border-navy-700/90 overflow-hidden flex flex-col">
              
              {/* Desktop Search Header Bar */}
              {showSearch && options.length > 3 && (
                <div className="p-2.5 border-b border-slate-100 dark:border-navy-800 bg-slate-50/70 dark:bg-navy-900/70 sticky top-0 z-10 backdrop-blur-md">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={activeSearchPlaceholder}
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Options List */}
              <div 
                style={{ maxHeight: `${coords.maxHeight}px` }} 
                className="overflow-y-auto overscroll-contain py-1.5 custom-scrollbar"
              >
                {filteredOptions.length === 0 ? (
                  <div className="py-8 text-center text-xs font-bold text-slate-400">
                    No departments match your search.
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
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
                          "w-full flex items-center justify-between px-3.5 py-2.5 min-h-[42px] transition-all duration-150 outline-none text-left cursor-pointer border-b border-slate-50 dark:border-navy-900/50 last:border-0",
                          isSelected 
                            ? "bg-brand-600 text-white font-black shadow-md shadow-brand-500/20" 
                            : "hover:bg-slate-100 dark:hover:bg-navy-800/90 text-slate-700 dark:text-slate-200 font-semibold"
                        )}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0 pr-3">
                          <div className={clsx(
                            "shrink-0 transition-colors",
                            isSelected ? "text-white/90" : "text-slate-400 dark:text-slate-500"
                          )}>
                            {opt.icon || icon || <Filter className="w-4 h-4" />}
                          </div>
                          
                          {opt.hidePill !== true && (
                            <div className={clsx(
                              "w-16 min-w-[4rem] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border",
                              getPillColor(opt, isSelected)
                            )}>
                              {getPillText(opt)}
                            </div>
                          )}
                          <span className={clsx(
                            "text-xs sm:text-sm font-bold flex-1 min-w-0 tracking-tight leading-snug",
                            "sm:whitespace-nowrap whitespace-normal break-words hyphens-none",
                            isSelected ? "text-white font-extrabold" : "text-slate-800 dark:text-slate-200 font-semibold"
                          )}>
                            {opt.label}
                          </span>
                        </div>

                        {isSelected && (
                          <Check className="w-4 h-4 text-white shrink-0 ml-2" strokeWidth={3} />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};
