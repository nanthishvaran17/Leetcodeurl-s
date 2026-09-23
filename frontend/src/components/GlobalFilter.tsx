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
  hideIcon?: boolean;
  className?: string;
  dropdownWidth?: string;
  placeholder?: string;
  align?: 'left' | 'right';
  showSearch?: boolean;
  searchPlaceholder?: string;
}

export interface DepartmentTheme {
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  hoverBg: string;
  selectedBg: string;
  selectedText: string;
  selectedCheck: string;
}

export const getDepartmentTheme = (opt: GlobalFilterOption | undefined, isSelected: boolean): DepartmentTheme => {
  if (!opt) {
    return {
      iconBg: 'bg-slate-100 dark:bg-navy-800',
      iconColor: 'text-slate-500 dark:text-slate-400',
      badgeBg: 'bg-slate-100 dark:bg-navy-800',
      badgeText: 'text-slate-700 dark:text-slate-300',
      badgeBorder: 'border-slate-200 dark:border-navy-700',
      hoverBg: 'hover:bg-slate-50 dark:hover:bg-navy-800',
      selectedBg: 'bg-brand-600 text-white font-extrabold shadow-md',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  const pill = (opt.pillText || '').toUpperCase().trim();
  const val = (opt.value || '').toUpperCase().trim();
  const label = (opt.label || '').toUpperCase().trim();
  const fullText = `${pill} ${val} ${label}`;

  const isAll = val === 'ALL' || val === '' || pill === 'ALL' || label.includes('ALL INSTITUTIONAL') || label.includes('ALL DEPARTMENTS') || label.includes('ALL SECTIONS') || label.includes('ALL ACADEMIC');

  if (isAll) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-brand-50 dark:bg-brand-950/80',
      iconColor: isSelected ? 'text-white' : 'text-brand-600 dark:text-brand-400',
      badgeBg: isSelected ? 'bg-white/20' : 'bg-brand-100 dark:bg-brand-900/80',
      badgeText: isSelected ? 'text-white font-black' : 'text-brand-800 dark:text-brand-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-brand-200 dark:border-brand-800',
      hoverBg: 'hover:bg-brand-50/70 dark:hover:bg-brand-950/40',
      selectedBg: 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-brand-500/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // Campus: NEC -> Blue / Indigo Theme
  if (pill === 'NEC' || val === 'NEC' || label.includes('NANDHA ENGINEERING COLLEGE') || label.includes('NEC CAMPUS')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-blue-100 dark:bg-blue-950/80',
      iconColor: isSelected ? 'text-white' : 'text-blue-600 dark:text-blue-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-blue-100 dark:bg-blue-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-blue-800 dark:text-blue-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-blue-300 dark:border-blue-800',
      hoverBg: 'hover:bg-blue-50/80 dark:hover:bg-blue-950/30',
      selectedBg: 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // Campus: NCT -> Cyan / Violet Theme
  if (pill === 'NCT' || val === 'NCT' || label.includes('NANDHA COLLEGE OF TECHNOLOGY') || label.includes('NCT CAMPUS')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-cyan-100 dark:bg-cyan-950/80',
      iconColor: isSelected ? 'text-white' : 'text-cyan-600 dark:text-cyan-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-cyan-100 dark:bg-cyan-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-cyan-800 dark:text-cyan-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-cyan-300 dark:border-cyan-800',
      hoverBg: 'hover:bg-cyan-50/80 dark:hover:bg-cyan-950/30',
      selectedBg: 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 1. CSE(IOT) → Orange (Check IOT first before general CSE or CS)
  if (pill.includes('IOT') || fullText.includes('IOT') || label.includes('INTERNET OF THINGS')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-orange-100 dark:bg-orange-950/80',
      iconColor: isSelected ? 'text-white' : 'text-orange-600 dark:text-orange-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-orange-100 dark:bg-orange-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-orange-800 dark:text-orange-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-orange-300 dark:border-orange-800',
      hoverBg: 'hover:bg-orange-50/80 dark:hover:bg-orange-950/30',
      selectedBg: 'bg-orange-600 text-white shadow-md shadow-orange-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 2. CSE(CS) / Cyber Security → Purple / Violet (Darker, more attractive)
  if (pill === 'CSE(CS)' || pill === 'CS' || label.includes('CYBER') || label.includes('SECURITY') || pill.includes('(CS)')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-purple-200 dark:bg-purple-900/60',
      iconColor: isSelected ? 'text-white' : 'text-purple-700 dark:text-purple-300',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-purple-200 dark:bg-purple-900/60',
      badgeText: isSelected ? 'text-white font-black' : 'text-purple-900 dark:text-purple-200',
      badgeBorder: isSelected ? 'border-white/30' : 'border-purple-400 dark:border-purple-700',
      hoverBg: 'hover:bg-purple-100/90 dark:hover:bg-purple-900/40',
      selectedBg: 'bg-purple-700 text-white shadow-md shadow-purple-700/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 3. ECE → Magenta / Pink
  if (pill.includes('ECE') || val.includes('ECE') || label.includes('ELECTRONICS AND COMMUNICATION') || label.includes('ECE')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-fuchsia-100 dark:bg-fuchsia-950/80',
      iconColor: isSelected ? 'text-white' : 'text-fuchsia-600 dark:text-fuchsia-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-fuchsia-100 dark:bg-fuchsia-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-fuchsia-800 dark:text-fuchsia-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-fuchsia-300 dark:border-fuchsia-800',
      hoverBg: 'hover:bg-fuchsia-50/80 dark:hover:bg-fuchsia-950/30',
      selectedBg: 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 4. EEE → Amber / Yellow
  if (pill.includes('EEE') || val.includes('EEE') || label.includes('ELECTRICAL') || label.includes('EEE')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-950/80',
      iconColor: isSelected ? 'text-slate-950' : 'text-amber-600 dark:text-amber-400',
      badgeBg: isSelected ? 'bg-white/20 text-slate-950 border-slate-950/30' : 'bg-amber-100 dark:bg-amber-950/90',
      badgeText: isSelected ? 'text-slate-950 font-black' : 'text-amber-900 dark:text-amber-300',
      badgeBorder: isSelected ? 'border-slate-950/30' : 'border-amber-300 dark:border-amber-800',
      hoverBg: 'hover:bg-amber-50/80 dark:hover:bg-amber-950/30',
      selectedBg: 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black',
      selectedText: 'text-slate-950 font-black',
      selectedCheck: 'text-slate-950'
    };
  }

  // 5. AIDS / AI → Teal / Cyan
  if (pill.includes('AIDS') || pill === 'AI' || label.includes('ARTIFICIAL') || label.includes('DATA SCIENCE') || label.includes('AIDS')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-teal-100 dark:bg-teal-950/80',
      iconColor: isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-teal-100 dark:bg-teal-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-teal-800 dark:text-teal-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-teal-300 dark:border-teal-800',
      hoverBg: 'hover:bg-teal-50/80 dark:hover:bg-teal-950/30',
      selectedBg: 'bg-teal-600 text-white shadow-md shadow-teal-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 6. IT / Information Technology → Green / Emerald
  if (pill === 'IT' || label.includes('INFORMATION TECHNOLOGY') || (label.includes('IT') && !label.includes('SECURITY') && !label.includes('SUITE'))) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-950/80',
      iconColor: isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-emerald-100 dark:bg-emerald-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-emerald-800 dark:text-emerald-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-emerald-300 dark:border-emerald-800',
      hoverBg: 'hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30',
      selectedBg: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 7. AGRI → Red / Coral
  if (pill.includes('AGRI') || pill.includes('AG') || label.includes('AGRICULTUR')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-rose-100 dark:bg-rose-950/80',
      iconColor: isSelected ? 'text-white' : 'text-rose-600 dark:text-rose-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-rose-100 dark:bg-rose-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-rose-800 dark:text-rose-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-rose-300 dark:border-rose-800',
      hoverBg: 'hover:bg-rose-50/80 dark:hover:bg-rose-950/30',
      selectedBg: 'bg-rose-600 text-white shadow-md shadow-rose-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 9. Academic Year 1ST -> Emerald
  if (pill === '1ST' || val === '1' || label.includes('I YEAR') || label.includes('1ST YEAR')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-950/80',
      iconColor: isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-emerald-100 dark:bg-emerald-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-emerald-800 dark:text-emerald-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-emerald-300 dark:border-emerald-800',
      hoverBg: 'hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30',
      selectedBg: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 10. Academic Year 2ND -> Amber / Gold
  if (pill === '2ND' || val === '2' || label.includes('II YEAR') || label.includes('2ND YEAR')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-amber-100 dark:bg-amber-950/80',
      iconColor: isSelected ? 'text-slate-950' : 'text-amber-600 dark:text-amber-400',
      badgeBg: isSelected ? 'bg-white/20 text-slate-950 border-slate-950/30' : 'bg-amber-100 dark:bg-amber-950/90',
      badgeText: isSelected ? 'text-slate-950 font-black' : 'text-amber-900 dark:text-amber-300',
      badgeBorder: isSelected ? 'border-slate-950/30' : 'border-amber-300 dark:border-amber-800',
      hoverBg: 'hover:bg-amber-50/80 dark:hover:bg-amber-950/30',
      selectedBg: 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black',
      selectedText: 'text-slate-950 font-black',
      selectedCheck: 'text-slate-950'
    };
  }

  // 11. Academic Year 3RD -> Purple / Violet
  if (pill === '3RD' || val === '3' || label.includes('III YEAR') || label.includes('3RD YEAR')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-purple-100 dark:bg-purple-950/80',
      iconColor: isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-purple-100 dark:bg-purple-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-purple-800 dark:text-purple-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-purple-300 dark:border-purple-800',
      hoverBg: 'hover:bg-purple-50/80 dark:hover:bg-purple-950/30',
      selectedBg: 'bg-purple-600 text-white shadow-md shadow-purple-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 12. Academic Year 4TH -> Indigo
  if (pill === '4TH' || val === '4' || label.includes('IV YEAR') || label.includes('4TH YEAR')) {
    return {
      iconBg: isSelected ? 'bg-white/20' : 'bg-indigo-100 dark:bg-indigo-950/80',
      iconColor: isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-indigo-100 dark:bg-indigo-950/90',
      badgeText: isSelected ? 'text-white font-black' : 'text-indigo-800 dark:text-indigo-300',
      badgeBorder: isSelected ? 'border-white/30' : 'border-indigo-300 dark:border-indigo-800',
      hoverBg: 'hover:bg-indigo-50/80 dark:hover:bg-indigo-950/30',
      selectedBg: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // Fallback (Indigo)
  return {
    iconBg: isSelected ? 'bg-white/20' : 'bg-indigo-100 dark:bg-indigo-950/80',
    iconColor: isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400',
    badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-indigo-100 dark:bg-indigo-950/90',
    badgeText: isSelected ? 'text-white font-black' : 'text-indigo-800 dark:text-indigo-300',
    badgeBorder: isSelected ? 'border-white/30' : 'border-indigo-300 dark:border-indigo-800',
    hoverBg: 'hover:bg-indigo-50/80 dark:hover:bg-indigo-950/30',
    selectedBg: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-black',
    selectedText: 'text-white font-black',
    selectedCheck: 'text-white'
  };
};

export const getPillText = (opt: GlobalFilterOption | undefined) => {
  if (!opt) return 'ALL';
  if (opt.pillText) return opt.pillText;
  if (opt.value === 'ALL' || opt.value === '' || opt.value === 'all') return 'ALL';
  if (opt.value.length <= 6) return opt.value.toUpperCase();
  return opt.value.substring(0, 3).toUpperCase();
};

export const GlobalFilter: React.FC<GlobalFilterProps> = ({
  label,
  options,
  value,
  onChange,
  icon,
  hideIcon = false,
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
    let baseWidth = 320;
    if (dropdownWidth) {
      const match = dropdownWidth.match(/(?:min-w-\[|w-\[)(\d+)px\]/);
      if (match && match[1]) {
        baseWidth = parseInt(match[1], 10);
      }
    }

    let computedWidth = Math.max(rect.width, baseWidth);
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

  const activeSearchPlaceholder = useMemo(() => {
    if (searchPlaceholder) return searchPlaceholder;
    if (label) return `Search ${label.toLowerCase()}...`;
    if (options.some(o => o.value === '1' || o.pillText === '1ST' || o.label.toUpperCase().includes('YEAR') || o.label.toUpperCase().includes('ACADEMIC'))) {
      return 'Search academic year...';
    }
    if (options.some(o => o.pillText === 'EXE' || o.pillText === 'FAC' || o.value === 'EXECUTIVE' || o.label.toUpperCase().includes('REPORT'))) {
      return 'Search report type...';
    };
  }, [isOpen]);

  const triggerTheme = getDepartmentTheme(selectedOption, false);

  return (
    <div className={twMerge('flex flex-col space-y-1.5 min-w-0 w-full', className)}>
      {/* Optional Top Label */}
      {label && (
        <label className="block text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider truncate flex items-center justify-between h-4 leading-4 m-0 p-0">
          <span>{label}</span>
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={twMerge(
            "relative w-full flex items-center justify-between px-3.5 py-2 h-11 min-h-[44px] bg-white dark:bg-navy-950",
            "border transition-all duration-200 outline-none select-none rounded-2xl cursor-pointer shadow-sm text-left group",
            isOpen 
              ? "border-brand-500 ring-2 ring-brand-500/20 shadow-md shadow-brand-500/10" 
              : "border-slate-300 dark:border-slate-700 hover:border-brand-500/60"
          )}
        >
          <div className="flex items-center space-x-2 overflow-hidden min-w-0 flex-1 pr-1.5">
            {!hideIcon && (selectedOption?.icon || icon) && (
              <div className={clsx(
                "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors border",
                triggerTheme.iconBg,
                isOpen ? "border-brand-300" : "border-slate-300 dark:border-navy-700"
              )}>
                <span className={isOpen ? "text-brand-600 dark:text-brand-400 font-bold" : triggerTheme.iconColor}>
                  {selectedOption?.icon || icon}
                </span>
              </div>
            )}
            
            {selectedOption?.hidePill !== true && (
              <div className={clsx(
                "shrink-0 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border",
                triggerTheme.badgeBg, triggerTheme.badgeText, triggerTheme.badgeBorder
              )}>
                {getPillText(selectedOption)}
              </div>
            )}
            
            <span className="text-xs font-black text-slate-900 dark:text-white truncate flex-1 text-left">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown 
            className={clsx(
              "w-4 h-4 shrink-0 transition-transform duration-200 ml-1",
              isOpen ? "rotate-180 text-brand-600 dark:text-brand-400" : "text-slate-700 dark:text-slate-300"
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
              className="bg-white dark:bg-navy-950 rounded-t-2xl border-t border-slate-200 dark:border-navy-700 p-3.5 space-y-2.5 max-h-[80vh] flex flex-col w-full shadow-2xl animate-slide-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 pb-2">
                <div className="flex items-center space-x-2">
                  {icon || <Filter className="w-4 h-4 text-brand-500" />}
                  <h3 className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                    {label || 'Select Option'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Search Bar */}
              {showSearch && options.length > 3 && (
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeSearchPlaceholder}
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              <div className="overflow-y-auto overscroll-contain space-y-1 py-1 flex-1 pr-1 custom-scrollbar">
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-xs font-bold text-slate-400">
                    No options match your search.
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    const theme = getDepartmentTheme(opt, isSelected);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onChange(opt.value);
                          setIsOpen(false);
                        }}
                        className={clsx(
                          "w-full flex items-center justify-between p-2 min-h-[36px] rounded-lg transition-all duration-150 text-left cursor-pointer border-b border-slate-100 dark:border-navy-900/60 last:border-0",
                          isSelected
                            ? theme.selectedBg
                            : `${theme.hoverBg} bg-white dark:bg-navy-950`
                        )}
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0 pr-2">
                          {!hideIcon && (opt.icon || icon) && (
                            <div className={clsx(
                              "w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors shadow-2xs",
                              theme.iconBg,
                              isSelected ? "border-transparent" : "border-slate-200/60 dark:border-navy-700/60"
                            )}>
                              <span className={isSelected ? "!text-white" : theme.iconColor}>
                                {React.isValidElement(opt.icon || icon)
                                  ? React.cloneElement((opt.icon || icon) as React.ReactElement<any>, {
                                      className: twMerge(
                                        ((opt.icon || icon) as React.ReactElement<any>).props?.className || '',
                                        isSelected ? '!text-white' : ''
                                      )
                                    })
                                  : (opt.icon || icon)}
                              </span>
                            </div>
                          )}
                          {opt.hidePill !== true && (
                            <span className={clsx(
                              "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md text-center shrink-0 border shadow-2xs whitespace-nowrap",
                              theme.badgeBg, theme.badgeText, theme.badgeBorder
                            )}>
                              {getPillText(opt)}
                            </span>
                          )}
                          <span className={clsx(
                            "text-xs font-bold flex-1 min-w-0 tracking-tight leading-snug truncate",
                            isSelected ? theme.selectedText : "text-slate-900 dark:text-white"
                          )}>
                            {opt.label}
                          </span>
                        </div>
                        {isSelected && <Check className={clsx("w-3.5 h-3.5 shrink-0 ml-1.5", theme.selectedCheck)} strokeWidth={3} />}
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
            <div className="bg-white dark:bg-navy-950 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700/90 overflow-hidden flex flex-col">
              
              {/* Desktop Search Header Bar */}
              {showSearch && options.length > 3 && (
                <div className="p-2 border-b border-slate-100 dark:border-navy-800 bg-slate-50/80 dark:bg-navy-900/80 sticky top-0 z-10 backdrop-blur-md">
                  <div className="relative flex items-center">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={activeSearchPlaceholder}
                      className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 text-xs font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500/30 focus:border-brand-500 transition-all shadow-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Options List */}
              <div 
                style={{ maxHeight: `${coords.maxHeight}px` }} 
                className="overflow-y-auto overscroll-contain py-1 custom-scrollbar"
              >
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-xs font-bold text-slate-400">
                    No options match your search.
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    const theme = getDepartmentTheme(opt, isSelected);
                    
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onChange(opt.value);
                          setIsOpen(false);
                        }}
                        className={clsx(
                          "w-full flex items-center justify-between px-3 py-1.5 min-h-[36px] transition-all duration-150 outline-none text-left cursor-pointer border-b border-slate-100 dark:border-navy-900/40 last:border-0",
                          isSelected 
                            ? theme.selectedBg 
                            : `${theme.hoverBg} bg-white dark:bg-navy-950`
                        )}
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0 pr-2">
                          {!hideIcon && (opt.icon || icon) && (
                            <div className={clsx(
                              "w-6 h-6 rounded-md flex items-center justify-center shrink-0 border transition-colors shadow-2xs",
                              theme.iconBg,
                              isSelected ? "border-transparent" : "border-slate-200/60 dark:border-navy-700/60"
                            )}>
                              <span className={isSelected ? "!text-white" : theme.iconColor}>
                                {React.isValidElement(opt.icon || icon)
                                  ? React.cloneElement((opt.icon || icon) as React.ReactElement<any>, {
                                      className: twMerge(
                                        ((opt.icon || icon) as React.ReactElement<any>).props?.className || '',
                                        isSelected ? '!text-white' : ''
                                      )
                                    })
                                  : (opt.icon || icon)}
                              </span>
                            </div>
                          )}
                          
                          {opt.hidePill !== true && (
                            <div className={clsx(
                              "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md text-center shrink-0 border shadow-2xs whitespace-nowrap",
                              theme.badgeBg, theme.badgeText, theme.badgeBorder
                            )}>
                              {getPillText(opt)}
                            </div>
                          )}
                          <span className={clsx(
                            "text-xs font-bold flex-1 min-w-0 tracking-tight leading-tight truncate",
                            isSelected ? theme.selectedText : "text-slate-900 dark:text-white"
                          )}>
                            {opt.label}
                          </span>
                        </div>

                        {isSelected && (
                          <Check className={clsx("w-3.5 h-3.5 shrink-0 ml-1.5", theme.selectedCheck)} strokeWidth={3} />
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
