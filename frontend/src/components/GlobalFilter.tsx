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
  variant?: 'default' | 'dark' | 'glass';
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

export const getDepartmentTheme = (
  opt: GlobalFilterOption | undefined, 
  isSelected: boolean,
  isDarkVariant: boolean = false
): DepartmentTheme => {
  if (!opt) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/30',
      iconColor: isSelected ? 'text-white' : 'text-brand-600 dark:text-brand-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-brand-700 dark:text-brand-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-brand-500/30',
      hoverBg: 'hover:bg-brand-50/80 dark:hover:bg-navy-900/90',
      selectedBg: 'bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white font-black shadow-lg shadow-brand-500/30',
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
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/30',
      iconColor: isSelected ? 'text-white' : 'text-brand-600 dark:text-brand-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-brand-700 dark:text-brand-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-brand-500/30',
      hoverBg: 'hover:bg-brand-50/80 dark:hover:bg-navy-900/90',
      selectedBg: 'bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white font-black shadow-lg shadow-brand-500/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // Campus: NEC -> Blue / Indigo Theme
  if (pill === 'NEC' || val === 'NEC' || label.includes('NANDHA ENGINEERING COLLEGE') || label.includes('NEC CAMPUS')) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      iconColor: isSelected ? 'text-white' : 'text-blue-600 dark:text-blue-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-blue-700 dark:text-blue-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-blue-500/30',
      hoverBg: 'hover:bg-blue-50/80 dark:hover:bg-blue-950/40',
      selectedBg: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white font-black shadow-lg shadow-blue-600/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // Campus: NCT -> Cyan / Violet Theme
  if (pill === 'NCT' || val === 'NCT' || label.includes('NANDHA COLLEGE OF TECHNOLOGY') || label.includes('NCT CAMPUS')) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      iconColor: isSelected ? 'text-white' : 'text-cyan-600 dark:text-cyan-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-cyan-700 dark:text-cyan-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-cyan-500/30',
      hoverBg: 'hover:bg-cyan-50/80 dark:hover:bg-cyan-950/40',
      selectedBg: 'bg-gradient-to-r from-cyan-600 via-teal-600 to-cyan-700 text-white font-black shadow-lg shadow-cyan-600/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 1. CSE(IOT) → Amber / Gold Theme
  if (pill.includes('IOT') || fullText.includes('IOT') || label.includes('INTERNET OF THINGS')) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      iconColor: isSelected ? 'text-white' : 'text-amber-600 dark:text-amber-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-amber-700 dark:text-amber-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-amber-500/30',
      hoverBg: 'hover:bg-amber-50/80 dark:hover:bg-amber-950/40',
      selectedBg: 'bg-gradient-to-r from-amber-500 via-orange-600 to-amber-600 text-white font-black shadow-lg shadow-amber-500/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 2. CSE(CS) / Cyber Security → Vibrant Purple / Violet
  if (pill === 'CSE(CS)' || pill === 'CS' || label.includes('CYBER') || label.includes('SECURITY') || pill.includes('(CS)')) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      iconColor: isSelected ? 'text-white' : 'text-purple-600 dark:text-purple-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-purple-700 dark:text-purple-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-purple-500/30',
      hoverBg: 'hover:bg-purple-50/80 dark:hover:bg-purple-950/40',
      selectedBg: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-black shadow-lg shadow-purple-600/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 3. ECE → Fuchsia / Pink
  if (pill.includes('ECE') || val.includes('ECE') || label.includes('ELECTRONICS AND COMMUNICATION') || label.includes('ECE')) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/30',
      iconColor: isSelected ? 'text-white' : 'text-fuchsia-600 dark:text-fuchsia-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-fuchsia-700 dark:text-fuchsia-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-fuchsia-500/30',
      hoverBg: 'hover:bg-fuchsia-50/80 dark:hover:bg-fuchsia-950/40',
      selectedBg: 'bg-gradient-to-r from-fuchsia-600 via-pink-600 to-fuchsia-700 text-white font-black shadow-lg shadow-fuchsia-600/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 4. EEE → Orange / Amber
  if (pill.includes('EEE') || val.includes('EEE') || label.includes('ELECTRICAL') || label.includes('EEE')) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30',
      iconColor: isSelected ? 'text-white' : 'text-orange-600 dark:text-orange-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-orange-700 dark:text-orange-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-orange-500/30',
      hoverBg: 'hover:bg-orange-50/80 dark:hover:bg-orange-950/40',
      selectedBg: 'bg-gradient-to-r from-orange-500 via-amber-600 to-orange-600 text-white font-black shadow-lg shadow-orange-500/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 5. AIDS / AI → Teal / Cyan
  if (pill.includes('AIDS') || pill === 'AI' || label.includes('ARTIFICIAL') || label.includes('DATA SCIENCE') || label.includes('AIDS')) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30',
      iconColor: isSelected ? 'text-white' : 'text-teal-600 dark:text-teal-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-teal-700 dark:text-teal-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-teal-500/30',
      hoverBg: 'hover:bg-teal-50/80 dark:hover:bg-teal-950/40',
      selectedBg: 'bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white font-black shadow-lg shadow-teal-600/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 6. IT / Information Technology → Emerald / Green
  if (pill === 'IT' || label.includes('INFORMATION TECHNOLOGY') || (label.includes('IT') && !label.includes('SECURITY') && !label.includes('SUITE'))) {
    return {
      iconBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      iconColor: isSelected ? 'text-white' : 'text-emerald-600 dark:text-emerald-400',
      badgeBg: isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-emerald-700 dark:text-emerald-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-emerald-500/30',
      hoverBg: 'hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40',
      selectedBg: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-black shadow-lg shadow-emerald-600/30',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }

  // 7. AGRI → Red / Coral
  if (pill.includes('AGRI') || pill.includes('AG') || label.includes('AGRICULTUR')) {
    if (isDarkVariant) {
      return {
        iconBg: isSelected ? 'bg-rose-500/30 border border-rose-400/40' : 'bg-rose-500/20 border border-rose-400/30',
        iconColor: 'text-rose-300',
        badgeBg: isSelected ? 'bg-rose-500/40 text-white border border-white/30' : 'bg-rose-500/20 text-rose-300 border border-rose-400/30',
        badgeText: isSelected ? 'text-white font-black' : 'text-rose-300 font-extrabold',
        badgeBorder: isSelected ? 'border-white/30' : 'border-rose-400/30',
        hoverBg: 'hover:bg-rose-950/50',
        selectedBg: 'bg-rose-600 text-white shadow-md shadow-rose-600/20 font-black',
        selectedText: 'text-white font-black',
        selectedCheck: 'text-white'
      };
    }
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

  // 9. Academic Year 1ST / I -> Emerald
  if (pill === '1ST' || val === '1' || label.includes('I YEAR') || label.includes('1ST YEAR')) {
    if (isDarkVariant) {
      return {
        iconBg: isSelected ? 'bg-emerald-500/30 border border-emerald-400/40' : 'bg-emerald-500/20 border border-emerald-400/30',
        iconColor: 'text-emerald-300',
        badgeBg: isSelected ? 'bg-emerald-500/40 text-white border border-white/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30',
        badgeText: isSelected ? 'text-white font-black' : 'text-emerald-300 font-extrabold',
        badgeBorder: isSelected ? 'border-white/30' : 'border-emerald-400/30',
        hoverBg: 'hover:bg-emerald-950/50',
        selectedBg: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-black',
        selectedText: 'text-white font-black',
        selectedCheck: 'text-white'
      };
    }
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

  // 10. Academic Year 2ND / II -> Amber
  if (pill === '2ND' || val === '2' || label.includes('II YEAR') || label.includes('2ND YEAR')) {
    if (isDarkVariant) {
      return {
        iconBg: isSelected ? 'bg-amber-500/30 border border-amber-400/40' : 'bg-amber-500/20 border border-amber-400/30',
        iconColor: 'text-amber-300',
        badgeBg: isSelected ? 'bg-amber-500/40 text-slate-950 border border-white/30' : 'bg-amber-500/20 text-amber-300 border border-amber-400/30',
        badgeText: isSelected ? 'text-slate-950 font-black' : 'text-amber-300 font-extrabold',
        badgeBorder: isSelected ? 'border-white/30' : 'border-amber-400/30',
        hoverBg: 'hover:bg-amber-950/50',
        selectedBg: 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black',
        selectedText: 'text-slate-950 font-black',
        selectedCheck: 'text-slate-950'
      };
    }
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

  // 11. Academic Year 3RD / III -> Purple
  if (pill === '3RD' || val === '3' || label.includes('III YEAR') || label.includes('3RD YEAR')) {
    if (isDarkVariant) {
      return {
        iconBg: isSelected ? 'bg-purple-500/30 border border-purple-400/40' : 'bg-purple-500/20 border border-purple-400/30',
        iconColor: 'text-purple-300',
        badgeBg: isSelected ? 'bg-purple-500/40 text-white border border-white/30' : 'bg-purple-500/20 text-purple-300 border border-purple-400/30',
        badgeText: isSelected ? 'text-white font-black' : 'text-purple-300 font-extrabold',
        badgeBorder: isSelected ? 'border-white/30' : 'border-purple-400/30',
        hoverBg: 'hover:bg-purple-950/50',
        selectedBg: 'bg-purple-600 text-white shadow-md shadow-purple-600/20 font-black',
        selectedText: 'text-white font-black',
        selectedCheck: 'text-white'
      };
    }
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

  // 12. Academic Year 4TH / IV -> Indigo
  if (pill === '4TH' || val === '4' || label.includes('IV YEAR') || label.includes('4TH YEAR')) {
    if (isDarkVariant) {
      return {
        iconBg: isSelected ? 'bg-indigo-500/30 border border-indigo-400/40' : 'bg-indigo-500/20 border border-indigo-400/30',
        iconColor: 'text-indigo-300',
        badgeBg: isSelected ? 'bg-indigo-500/40 text-white border border-white/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30',
        badgeText: isSelected ? 'text-white font-black' : 'text-indigo-300 font-extrabold',
        badgeBorder: isSelected ? 'border-white/30' : 'border-indigo-400/30',
        hoverBg: 'hover:bg-indigo-950/50',
        selectedBg: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-black',
        selectedText: 'text-white font-black',
        selectedCheck: 'text-white'
      };
    }
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
  if (isDarkVariant) {
    return {
      iconBg: isSelected ? 'bg-indigo-500/30 border border-indigo-400/40' : 'bg-indigo-500/20 border border-indigo-400/30',
      iconColor: 'text-indigo-300',
      badgeBg: isSelected ? 'bg-indigo-500/40 text-white border border-white/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30',
      badgeText: isSelected ? 'text-white font-black' : 'text-indigo-300 font-extrabold',
      badgeBorder: isSelected ? 'border-white/30' : 'border-indigo-400/30',
      hoverBg: 'hover:bg-indigo-950/50',
      selectedBg: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-black',
      selectedText: 'text-white font-black',
      selectedCheck: 'text-white'
    };
  }
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
  searchPlaceholder,
  variant = 'default'
}) => {

  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastCoordsRef = useRef<string | null>(null);

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

    const newCoords = {
      top,
      left,
      width: computedWidth,
      positionUp: shouldFlipUp,
      maxHeight
    };

    const newCoordsStr = JSON.stringify(newCoords);
    if (lastCoordsRef.current !== newCoordsStr) {
      lastCoordsRef.current = newCoordsStr;
      setCoords(newCoords);
    }
  }, [filteredOptions.length, options.length, align, dropdownWidth, showSearch]);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    let rafId: number;
    const handleScrollOrResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateCoords);
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      if (rafId) cancelAnimationFrame(rafId);
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

  const triggerTheme = getDepartmentTheme(selectedOption, false, variant === 'dark' || variant === 'glass');

  return (
    <div className={twMerge('flex flex-col space-y-1.5 min-w-0 w-full', className)}>
      {/* Optional Top Label */}
      {label && (
        <label className={clsx(
          "block text-[11px] font-black uppercase tracking-wider truncate flex items-center justify-between h-4 leading-4 m-0 p-0",
          (variant === 'dark' || variant === 'glass') ? "text-slate-200" : "text-slate-800 dark:text-slate-100"
        )}>
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
            "relative w-full flex items-center justify-between px-3.5 py-2 h-11 min-h-[44px]",
            "border transition-all duration-200 outline-none select-none rounded-2xl cursor-pointer shadow-sm text-left group",
            variant === 'dark'
              ? "bg-navy-900/90 text-white border-slate-700/80 hover:border-brand-500/60 shadow-inner backdrop-blur-md"
              : variant === 'glass'
              ? "bg-white/10 dark:bg-navy-900/40 text-white border-white/20 hover:border-white/40 shadow-lg backdrop-blur-lg"
              : "bg-white dark:bg-navy-950 border-slate-300 dark:border-slate-700 hover:border-brand-500/60 text-slate-900 dark:text-white",
            isOpen 
              ? "border-brand-500 ring-2 ring-brand-500/30 shadow-md shadow-brand-500/20" 
              : ""
          )}
        >
          <div className="flex items-center space-x-2 overflow-hidden min-w-0 flex-1 pr-1.5">
            {!hideIcon && (selectedOption?.icon || icon) && (
              <div className={clsx(
                "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors border",
                triggerTheme.iconBg,
                isOpen ? "border-brand-400" : (variant === 'dark' || variant === 'glass' ? "border-slate-700/60" : "border-slate-300 dark:border-navy-700")
              )}>
                <span className={isOpen ? "text-brand-400 font-bold" : triggerTheme.iconColor}>
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
            
            <span className={clsx(
              "text-xs font-black truncate flex-1 text-left",
              (variant === 'dark' || variant === 'glass') ? "text-white" : "text-slate-900 dark:text-white"
            )}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>

          <ChevronDown 
            className={clsx(
              "w-4 h-4 shrink-0 transition-transform duration-200 ml-1",
              isOpen 
                ? "rotate-180 text-brand-400" 
                : (variant === 'dark' || variant === 'glass') ? "text-slate-300 group-hover:text-white" : "text-slate-700 dark:text-slate-300"
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
                  <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">No options match your search.</span>
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-4 decoration-indigo-300 dark:decoration-indigo-500/50 hover:decoration-indigo-600 dark:hover:decoration-indigo-400 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Search className="w-3 h-3" />
                      <span>Clear search & view all options</span>
                    </button>
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
                  <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">No options match your search.</span>
                    <button 
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[11px] font-black text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 underline underline-offset-4 decoration-brand-300 dark:decoration-brand-500/50 hover:decoration-brand-600 dark:hover:decoration-brand-400 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Search className="w-3 h-3" />
                      <span>Clear search & view all options</span>
                    </button>
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
                          "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 outline-none text-left cursor-pointer border mb-1 last:mb-0 group active:scale-[0.98]",
                          isSelected 
                            ? `${theme.selectedBg} border-brand-400/40 shadow-md shadow-brand-500/25 font-black` 
                            : `${theme.hoverBg} bg-white dark:bg-navy-950/90 border-slate-100 dark:border-navy-900 hover:border-brand-500/30 hover:shadow-xs`
                        )}
                      >
                        <div className="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                          {!hideIcon && (opt.icon || icon) && (
                            <div className={clsx(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-200 shadow-2xs group-hover:scale-105",
                              isSelected ? "bg-white/20 border-white/30 text-white" : theme.iconBg
                            )}>
                              <span className={isSelected ? "!text-white font-bold" : theme.iconColor}>
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
                              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-center shrink-0 border shadow-2xs whitespace-nowrap transition-all",
                              isSelected ? "bg-white/20 text-white border-white/30" : `${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`
                            )}>
                              {getPillText(opt)}
                            </div>
                          )}
                          <span className={clsx(
                            "text-xs font-extrabold flex-1 min-w-0 tracking-tight leading-snug truncate transition-colors",
                            isSelected ? "text-white font-black" : "text-slate-800 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400"
                          )}>
                            {opt.label}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="p-1 rounded-full bg-white/20 border border-white/40 shadow-xs shrink-0 ml-1.5">
                            <Check className="w-3.5 h-3.5 text-white stroke-[3.5]" />
                          </div>
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
