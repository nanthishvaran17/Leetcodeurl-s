import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Loader2 } from 'lucide-react';
import {
  formatDepartmentCode,
  deriveDepartmentFromRegNo,
  formatStudentYearBadge
} from '../../utils/filterUtils';
import { getCachedStudents } from '../../utils/rosterCache';
import api from '../../services/api';
import { useTypewriterPlaceholder } from '../../hooks/useTypewriterPlaceholder';

export interface ModernSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  students?: any[];
  onSelectStudent?: (student: any) => void;
  enableAutocomplete?: boolean;
  placeholder?: string;
  placeholders?: string[];
  enableTypewriter?: boolean;
  className?: string;
  inputClassName?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name?: string): string {
  if (!name) return 'ST';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Highlights matching query terms in yellow
 */
const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!text) return null;
  const qClean = query.trim();
  if (!qClean) return <>{text}</>;

  const terms = qClean.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return <>{text}</>;

  const escapedTerms = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) =>
        terms.some(t => t.toLowerCase() === part.toLowerCase()) ? (
          <mark
            key={i}
            className="bg-yellow-300 dark:bg-yellow-400/40 text-amber-950 dark:text-yellow-100 font-extrabold rounded-[2px] px-0.5 not-italic inline-block"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export const ModernSearchInput: React.FC<ModernSearchInputProps> = ({
  value,
  onChange,
  onClear,
  students,
  onSelectStudent,
  enableAutocomplete = true,
  placeholder = 'Search...',
  placeholders,
  enableTypewriter = true,
  className = '',
  inputClassName = '',
  id,
  autoFocus = false,
  disabled = false,
  size = 'md'
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Typewriter animated placeholder cycling hints letter-by-letter
  const activePlaceholders = useMemo(() => {
    if (placeholders && placeholders.length > 0) return placeholders;
    if (placeholder && placeholder !== 'Search...' && placeholder !== 'Search') {
      return [
        placeholder,
        'Search student name...',
        'Search reg no (e.g. 7376...)',
        'Search username...',
        'Search LeetCode handle...',
      ];
    }
    return [
      'Search student name...',
      'Search reg no (e.g. 7376...)',
      'Search username...',
      'Search LeetCode handle...',
      'Search department (Cyber Security, IoT, IT)...',
    ];
  }, [placeholder, placeholders]);

  const animatedPlaceholder = useTypewriterPlaceholder(
    activePlaceholders,
    enableTypewriter,
    Boolean(disabled || inputValue.trim().length > 0)
  );

  // Sync external value changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
      if (!value) {
        setSuggestions([]);
        setIsOpen(false);
      }
    }
  }, [value]);

  // Click outside to dismiss suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter or search students based on current query
  const performSearch = useCallback(async (query: string) => {
    if (!enableAutocomplete) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const qClean = q.replace(/[^a-z0-9]/g, '');

    // Check passed students or global cached students
    const pool = (students && students.length > 0) ? students : getCachedStudents();

    if (pool && pool.length > 0) {
      const matched = pool.filter((st: any) => {
        const name = (st.name || '').toLowerCase();
        const reg = (st.reg_no || '').toLowerCase();
        const username = (st.username || st.leetcode_username || st.canonical_username || st.handle || '').toLowerCase();
        const nameClean = name.replace(/[^a-z0-9]/g, '');
        const regClean = reg.replace(/[^a-z0-9]/g, '');
        const usernameClean = username.replace(/[^a-z0-9]/g, '');

        return (
          name.includes(q) ||
          reg.includes(q) ||
          username.includes(q) ||
          (qClean && (nameClean.includes(qClean) || regClean.includes(qClean) || usernameClean.includes(qClean)))
        );
      });

      // Score relevance: exact prefix match first, then substring match, then top solved
      matched.sort((a: any, b: any) => {
        const aReg = (a.reg_no || '').toLowerCase();
        const bReg = (b.reg_no || '').toLowerCase();
        const aName = (a.name || '').toLowerCase();
        const bName = (b.name || '').toLowerCase();
        const aUser = (a.username || a.leetcode_username || a.handle || '').toLowerCase();
        const bUser = (b.username || b.leetcode_username || b.handle || '').toLowerCase();

        const aExactPrefix = aReg.startsWith(q) || aName.startsWith(q) || aUser.startsWith(q);
        const bExactPrefix = bReg.startsWith(q) || bName.startsWith(q) || bUser.startsWith(q);

        if (aExactPrefix && !bExactPrefix) return -1;
        if (!aExactPrefix && bExactPrefix) return 1;

        const aSolved = a.stats?.total_solved ?? a.total_solved ?? 0;
        const bSolved = b.stats?.total_solved ?? b.total_solved ?? 0;
        return bSolved - aSolved;
      });

      setSuggestions(matched.slice(0, 10));
      setIsLoading(false);
      setIsOpen(true);
      return;
    }

    // Fallback to API search if in-memory pool is not populated
    try {
      const res = await api.get('/students', {
        params: { search: query.trim(), limit: 10 }
      });
      const data = res.data;
      const items = Array.isArray(data) ? data : (data?.items || []);
      setSuggestions(items);
      setIsOpen(true);
    } catch (err) {
      console.warn('Student autocomplete API search error:', err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [students, enableAutocomplete]);

  // Debounced input change handler
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setSelectedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      onChange('');
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    if (enableAutocomplete) {
      setIsLoading(true);
    }

    debounceTimerRef.current = setTimeout(() => {
      onChange(val);
      if (enableAutocomplete) {
        performSearch(val);
      }
    }, 180);
  };

  // Clear search input
  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setInputValue('');
    onChange('');
    if (onClear) onClear();
    setSuggestions([]);
    setIsOpen(false);
    setIsLoading(false);
    setSelectedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Select student suggestion
  const handleSelectStudent = (student: any) => {
    setInputValue(student.name);
    onChange(student.name);
    setIsOpen(false);
    setSelectedIndex(-1);
    if (onSelectStudent) {
      onSelectStudent(student);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelectStudent(suggestions[selectedIndex]);
      } else if (suggestions.length > 0) {
        handleSelectStudent(suggestions[0]);
      }
    }
  };

  const heightClass =
    size === 'sm' ? 'h-9 min-h-[36px]' : size === 'lg' ? 'h-12 min-h-[48px]' : 'h-11 min-h-[44px]';

  const hasRightAction = Boolean((inputValue && !disabled) || isLoading);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Modern Rounded Search Container with subtle purple border & soft glow */}
      <div
        className={`group relative flex items-center w-full ${heightClass} rounded-2xl bg-white dark:bg-[#0b0f19] border transition-all duration-200 ${
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-[0_4px_20px_rgba(168,85,247,0.14)] dark:shadow-[0_4px_20px_rgba(168,85,247,0.22)]'
            : 'border-purple-200/90 hover:border-purple-400/90 dark:border-purple-500/30 dark:hover:border-purple-400/50 shadow-[0_2px_12px_rgba(168,85,247,0.06)] dark:shadow-[0_2px_14px_rgba(168,85,247,0.12)]'
        }`}
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
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            if (enableAutocomplete && inputValue.trim().length >= 1) {
              performSearch(inputValue);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={animatedPlaceholder || placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`flex-1 w-full min-w-0 bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none py-2 text-left ${
            hasRightAction ? 'pr-9' : 'pr-3.5'
          } ${inputClassName}`}
        />

        {/* Right Action Icons: Loading Spinner + Clear X Button */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 space-x-1.5 pointer-events-auto">
          {isLoading && (
            <Loader2 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-spin shrink-0" />
          )}
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Real-time Autocomplete Suggestions Dropdown */}
      <AnimatePresence>
        {enableAutocomplete && isOpen && inputValue.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl border border-purple-200 dark:border-purple-800/80 bg-white dark:bg-[#0b0f19] shadow-[0_20px_50px_rgba(0,0,0,0.25),0_0_0_1px_rgba(147,51,234,0.15)] dark:shadow-[0_25px_65px_rgba(0,0,0,0.85),0_0_0_1px_rgba(147,51,234,0.3)] overflow-hidden max-h-80 sm:max-h-96 flex flex-col"
          >
            {/* Header info bar */}
            <div className="px-3.5 py-2.5 border-b border-purple-100 dark:border-slate-800/80 flex items-center justify-between bg-purple-50/90 dark:bg-[#111827]">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center space-x-1.5">
                <span>Matching Students</span>
                <span className="px-1.5 py-0.5 rounded-full bg-purple-200/80 dark:bg-purple-900/60 text-purple-900 dark:text-purple-100 text-[9px] font-mono font-bold">
                  {suggestions.length}
                </span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                Click to select • ↑↓ to navigate
              </span>
            </div>

            {/* Suggestions list or Empty-State */}
            {isLoading && suggestions.length === 0 ? (
              <div className="py-6 px-4 text-center space-y-2 bg-white dark:bg-[#0b0f19]">
                <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Searching students...
                </p>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="py-6 px-4 text-center space-y-1.5 bg-white dark:bg-[#0b0f19]">
                <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                  <Search className="w-4 h-4 stroke-[2.5]" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  No students found matching &quot;{inputValue}&quot;
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Try searching with student name or register number (e.g. 732224CC031)
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1.5 space-y-0.5 bg-white dark:bg-[#0b0f19]">
                {suggestions.map((student, idx) => {
                  const isSelected = idx === selectedIndex;
                  const regNo = student.reg_no || '';
                  const name = student.name || '';
                  const college = student.college || (regNo.startsWith('7321') ? 'NCT' : 'NEC');
                  const dept =
                    formatDepartmentCode(student.department) ||
                    deriveDepartmentFromRegNo(regNo) ||
                    (typeof student.department === 'string'
                      ? student.department
                      : student.department?.code) ||
                    'DEPT';
                  const academicYear =
                    student.academic_year || student.batch || formatStudentYearBadge(student);
                  const solved = student.stats?.total_solved ?? student.total_solved;

                  return (
                    <div
                      key={student.id || regNo || idx}
                      onClick={() => handleSelectStudent(student)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-purple-100/70 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-700/80 shadow-xs'
                          : 'hover:bg-purple-50/80 dark:hover:bg-slate-800/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        {/* Student Initials Avatar */}
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs font-display">
                          {getInitials(name)}
                        </div>

                        {/* Student Details */}
                        <div className="min-w-0 flex-1">
                          {/* Student Name with Yellow Highlight */}
                          <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white truncate font-display leading-tight">
                            <HighlightMatch text={name} query={inputValue} />
                          </div>

                          {/* Register Number + LeetCode Username + Academic Year */}
                          <div className="flex items-center flex-wrap gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                              <HighlightMatch text={regNo} query={inputValue} />
                            </span>
                            {(student.username || student.leetcode_username) && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                                  @<HighlightMatch text={student.username || student.leetcode_username} query={inputValue} />
                                </span>
                              </>
                            )}
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span className="font-semibold text-slate-600 dark:text-slate-400">
                              {academicYear}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Required Badges: College + Department + Solved Count */}
                      <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                        {solved != null && solved > 0 && (
                          <span className="hidden sm:inline-flex items-center text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-mono">
                            {solved} Solved
                          </span>
                        )}
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-mono">
                          {college}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-mono">
                          {dept}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
