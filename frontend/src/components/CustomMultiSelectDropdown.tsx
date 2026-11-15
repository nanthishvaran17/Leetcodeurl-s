import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, X, Search, LucideIcon } from 'lucide-react';
import { SwipeHandle } from './SwipeHandle';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: string;
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
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  // Mobile detection
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640 || window.matchMedia('(max-width: 639px)').matches;
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640 || window.matchMedia('(max-width: 639px)').matches);
    };
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const themeColors = {
    indigo: {
      activeBg: 'bg-indigo-50 dark:bg-indigo-900/30',
      activeText: 'text-indigo-700 dark:text-indigo-300',
      activeBadge: 'bg-indigo-500 border-indigo-600',
      pill: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
      btn: 'bg-indigo-600 hover:bg-indigo-700'
    },
    emerald: {
      activeBg: 'bg-emerald-50 dark:bg-emerald-900/30',
      activeText: 'text-emerald-700 dark:text-emerald-300',
      activeBadge: 'bg-emerald-500 border-emerald-600',
      pill: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
      btn: 'bg-emerald-600 hover:bg-emerald-700'
    },
    brand: {
      activeBg: 'bg-brand-50 dark:bg-brand-900/30',
      activeText: 'text-brand-700 dark:text-brand-300',
      activeBadge: 'bg-brand-500 border-brand-600',
      pill: 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200 border-brand-200 dark:border-brand-800',
      btn: 'bg-brand-600 hover:bg-brand-700'
    },
    amber: {
      activeBg: 'bg-amber-50 dark:bg-amber-900/30',
      activeText: 'text-amber-700 dark:text-amber-300',
      activeBadge: 'bg-amber-500 border-amber-600',
      pill: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800',
      btn: 'bg-amber-600 hover:bg-amber-700'
    },
    rose: {
      activeBg: 'bg-rose-50 dark:bg-rose-900/30',
      activeText: 'text-rose-700 dark:text-rose-300',
      activeBadge: 'bg-rose-500 border-rose-600',
      pill: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800',
      btn: 'bg-rose-600 hover:bg-rose-700'
    },
    slate: {
      activeBg: 'bg-slate-100 dark:bg-navy-800',
      activeText: 'text-slate-800 dark:text-slate-200',
      activeBadge: 'bg-slate-700 border-slate-800',
      pill: 'bg-slate-200 dark:bg-navy-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-navy-600',
      btn: 'bg-slate-800 hover:bg-slate-900'
    }
  };

  const theme = themeColors[colorTheme] || themeColors.indigo;

  const updateMenuPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 280;
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
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isMobile) return;
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isMobile]);

  const isAllOption = (val: string) => val === '0' || val.toUpperCase() === 'ALL';

  const isAllSelected = selectedValues.some(v => isAllOption(v));

  const isOptionSelected = (val: string) => {
    if (isAllOption(val)) {
      return isAllSelected;
    }
    return isAllSelected || selectedValues.includes(val);
  };

  const toggleOption = (val: string) => {
    const isAll = isAllOption(val);

    if (isAll) {
      if (isAllSelected) {
        onChange([]);
      } else {
        onChange(options.map(o => o.value));
      }
      return;
    }

    if (isAllSelected) {
      // User was in "ALL" state, now unchecking this single option
      const next = options
        .filter(o => !isAllOption(o.value) && o.value !== val)
        .map(o => o.value);
      onChange(next);
      return;
    }

    const currentlySelected = selectedValues.filter(v => !isAllOption(v));
    let next: string[];
    if (currentlySelected.includes(val)) {
      next = currentlySelected.filter(v => v !== val);
    } else {
      next = [...currentlySelected, val];
    }

    // Check if all non-ALL options are now selected
    const nonAllOpts = options.filter(o => !isAllOption(o.value));
    if (nonAllOpts.length > 0 && next.length === nonAllOpts.length) {
      const allOpt = options.find(o => isAllOption(o.value));
      if (allOpt) next.push(allOpt.value);
    }

    onChange(next);
  };

  const selectAll = () => {
    onChange(options.map(o => o.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Labels for the trigger button
  const allSelectedOption = options.find(opt => isAllOption(opt.value));
  const activeCount = isAllSelected 
    ? options.filter(o => !isAllOption(o.value)).length 
    : selectedValues.filter(v => !isAllOption(v)).length;

  const triggerText = useMemo(() => {
    if (isAllSelected && allSelectedOption) {
      return allSelectedOption.label;
    }
    const nonAllSelected = options.filter(opt => !isAllOption(opt.value) && selectedValues.includes(opt.value));
    if (nonAllSelected.length === 0) {
      return placeholder;
    }
    if (nonAllSelected.length <= 2) {
      return nonAllSelected.map(o => o.label).join(', ');
    }
    return `${nonAllSelected.length} Selected`;
  }, [isAllSelected, allSelectedOption, options, selectedValues, placeholder]);

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-black text-slate-900 dark:text-slate-100 mb-1">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={triggerClassName || `flex items-center justify-between w-full h-11 min-h-[44px] py-2 px-3.5 rounded-2xl border bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 text-slate-800 dark:text-white font-black cursor-pointer shadow-2xs transition-all`}
      >
        <div className="flex items-center space-x-2 truncate flex-1 pr-2">
          {Icon && <Icon className="w-4 h-4 shrink-0 opacity-70" />}
          <span className={`text-xs truncate ${activeCount === 0 && !isAllSelected ? 'text-slate-400 dark:text-slate-500 font-bold' : 'font-black'}`}>
            {triggerText}
          </span>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0">
          {(isAllSelected || activeCount > 0) && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black border ${theme.pill}`}>
              {isAllSelected ? 'ALL' : activeCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Options Popup / Drawer */}
      {isOpen && typeof document !== 'undefined' && (
        isMobile ? (
          // Mobile Bottom Sheet Drawer
          createPortal(
            <AnimatePresence>
              <div className="fixed inset-0 z-[99999999] flex flex-col justify-end">
                {/* Backdrop Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
                  onClick={() => setIsOpen(false)}
                />

                {/* Bottom Sheet Modal */}
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="relative z-10 w-full max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-t-[28px] border-t border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden pb-6"
                >
                  <SwipeHandle onClose={() => setIsOpen(false)} className="pt-2.5 pb-1 shrink-0" />

                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {Icon && (
                        <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <span className="text-sm font-black text-slate-900 dark:text-white tracking-wide truncate">
                        {label || placeholder || 'Select Options'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${theme.pill}`}>
                        {isAllSelected ? 'ALL Selected' : `${activeCount} Selected`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Search Bar & Quick Toggles */}
                  <div className="px-4 pt-3 pb-2 space-y-2 shrink-0 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50">
                    {options.length > 5 && (
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-bold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <button
                        type="button"
                        onClick={selectAll}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        Select All ({options.filter(o => !isAllOption(o.value)).length})
                      </button>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Options List */}
                  <div className="p-3.5 overflow-y-auto space-y-2 max-h-[calc(75vh-160px)]">
                    {filteredOptions.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 font-bold">
                        No matching options found
                      </div>
                    ) : (
                      filteredOptions.map((opt) => {
                        const isSel = isOptionSelected(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleOption(opt.value)}
                            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-left transition-all active:scale-[0.98] cursor-pointer ${
                              isSel
                                ? `${theme.activeBg} border-2 border-indigo-500/80 ${theme.activeText} shadow-2xs`
                                : 'bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                              {opt.badge && (
                                <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  isSel ? `${theme.activeBadge} text-white` : opt.badgeColor || 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                                }`}>
                                  {opt.badge}
                                </span>
                              )}
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-black truncate">{opt.label}</span>
                                {opt.sublabel && (
                                  <span className="text-[10px] opacity-70 truncate">{opt.sublabel}</span>
                                )}
                              </div>
                            </div>
                            <div className={`w-5 h-5 shrink-0 rounded-lg flex items-center justify-center border transition-colors ${
                              isSel ? `${theme.activeBadge} text-white` : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                            }`}>
                              {isSel && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Done / Apply Button */}
                  <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className={`w-full py-3 rounded-2xl ${theme.btn} text-white font-black text-xs tracking-wider shadow-md active:scale-[0.99] transition-all cursor-pointer`}
                    >
                      Done ({isAllSelected ? 'All Selected' : `${activeCount} Selected`})
                    </button>
                  </div>
                </motion.div>
              </div>
            </AnimatePresence>,
            document.body
          )
        ) : (
          // Desktop Floating Popover
          createPortal(
            <AnimatePresence>
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  left: menuPos.left,
                  width: menuPos.width,
                  zIndex: 99999999
                }}
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[320px]"
              >
                {/* Search / Toggles Header */}
                <div className="p-2 space-y-1.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
                  {options.length > 5 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="w-full pl-7 pr-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between px-1 text-[10px] font-black">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-slate-500 dark:text-slate-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Options List */}
                <div className="p-1.5 overflow-y-auto no-scrollbar space-y-1 flex-1">
                  {filteredOptions.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400 font-bold">
                      No matching options
                    </div>
                  ) : (
                    filteredOptions.map((opt) => {
                      const isSel = isOptionSelected(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleOption(opt.value)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                            isSel ? theme.activeBg : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                            {opt.badge && (
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                isSel ? `${theme.activeBadge} text-white` : opt.badgeColor || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {opt.badge}
                              </span>
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                              <span
                                className={`text-[11px] leading-snug font-black truncate ${
                                  isSel ? theme.activeText : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {opt.label}
                              </span>
                              {opt.sublabel && (
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                                  {opt.sublabel}
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className={`w-4 h-4 shrink-0 rounded flex items-center justify-center border transition-colors ${
                              isSel
                                ? `${theme.activeBadge} text-white`
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {isSel && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body
          )
        )
      )}
    </div>
  );
};
