import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Filter,
  RotateCcw,
  Check,
  Search,
  Building2,
  GraduationCap,
  Award,
  ArrowUpDown,
  SortAsc,
  SortDesc,
  Activity,
  Star,
  ChevronRight,
  SlidersHorizontal
} from 'lucide-react';
import { useScrollLock } from '../../hooks/useScrollLock';
import { DropdownOption } from '../CustomDropdown';

export interface MobileStudentShowcaseFiltersProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'all' | 'department' | 'year' | 'performance' | 'sort';
  selectedDept: string;
  onSelectDept: (val: string) => void;
  yearLevel: string;
  onSelectYear: (val: string) => void;
  solvedFilter: string;
  onSelectSolvedFilter: (val: string) => void;
  sortBy: string;
  onSelectSortBy: (val: string) => void;
  departments: any[];
  yearOptions: DropdownOption[];
  performanceOptions: DropdownOption[];
  sortOptions: DropdownOption[];
  performanceCounts: {
    total: number;
    above500: number;
    between251And500: number;
    between101And250: number;
    between1And100: number;
    notStarted: number;
  };
  totalResults: number;
  onReset: () => void;
  isFacultyRole?: boolean;
}

export const MobileStudentShowcaseFilters: React.FC<MobileStudentShowcaseFiltersProps> = ({
  isOpen,
  onClose,
  initialTab = 'all',
  selectedDept,
  onSelectDept,
  yearLevel,
  onSelectYear,
  solvedFilter,
  onSelectSolvedFilter,
  sortBy,
  onSelectSortBy,
  departments,
  yearOptions,
  performanceOptions,
  sortOptions,
  performanceCounts,
  totalResults,
  onReset,
  isFacultyRole = false
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'department' | 'year' | 'performance' | 'sort'>('all');
  const [deptSearchQuery, setDeptSearchQuery] = useState('');

  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    } else {
      setDeptSearchQuery('');
    }
  }, [isOpen, initialTab]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedDept !== 'all') count++;
    if (yearLevel !== 'all') count++;
    if (solvedFilter !== 'all') count++;
    if (sortBy !== 'top_solved') count++;
    return count;
  }, [selectedDept, yearLevel, solvedFilter, sortBy]);

  // Normalized department options
  const deptList = useMemo(() => {
    const list: Array<{ value: string; label: string; code: string; campus?: string }> = [];

    if (isFacultyRole) {
      list.push({ value: 'all', label: 'My Allocated Mentees', code: 'ALL' });
    } else {
      list.push({ value: 'all', label: 'All Departments', code: 'ALL' });
    }

    departments.forEach((d: any) => {
      const code = d.code || d.name || '';
      const name = d.name || d.code || '';
      const campus = d.campus || (name.toLowerCase().includes('nct') ? 'NCT' : 'NEC');
      list.push({
        value: code,
        label: name,
        code: code,
        campus
      });
    });

    if (!deptSearchQuery.trim()) return list;
    const q = deptSearchQuery.toLowerCase().trim();
    return list.filter(d => d.label.toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
  }, [departments, isFacultyRole, deptSearchQuery]);

  if (!isOpen && typeof document === 'undefined') return null;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-md"
          />

          {/* Bottom Sheet Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 w-full max-h-[88vh] bg-white dark:bg-navy-950 rounded-t-[32px] border-t border-slate-200 dark:border-white/[0.1] shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white"
          >
            {/* Grab Handle */}
            <div className="pt-3 pb-1 flex justify-center cursor-pointer" onClick={onClose}>
              <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 transition-colors" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight font-display">
                    Filters & Sorting
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {totalResults} students match your criteria
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {activeFiltersCount > 0 && (
                  <button
                    onClick={onReset}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Section Quick Tabs */}
            <div className="flex items-center space-x-1 px-4 py-2 bg-slate-50/80 dark:bg-navy-900/60 border-b border-slate-100 dark:border-white/[0.06] overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  activeTab === 'all'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.05]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('department')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  activeTab === 'department'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : selectedDept !== 'all'
                    ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.05]'
                }`}
              >
                <Building2 className="w-3 h-3" />
                <span>Department</span>
                {selectedDept !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </button>
              <button
                onClick={() => setActiveTab('year')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  activeTab === 'year'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : yearLevel !== 'all'
                    ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.05]'
                }`}
              >
                <GraduationCap className="w-3 h-3" />
                <span>Year</span>
                {yearLevel !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  activeTab === 'performance'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : solvedFilter !== 'all'
                    ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.05]'
                }`}
              >
                <Award className="w-3 h-3" />
                <span>Range</span>
                {solvedFilter !== 'all' && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </button>
              <button
                onClick={() => setActiveTab('sort')}
                className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 ${
                  activeTab === 'sort'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : sortBy !== 'top_solved'
                    ? 'bg-brand-500/15 text-brand-600 dark:text-brand-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.05]'
                }`}
              >
                <ArrowUpDown className="w-3 h-3" />
                <span>Sort</span>
                {sortBy !== 'top_solved' && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {/* 1. DEPARTMENT FILTER */}
              {(activeTab === 'all' || activeTab === 'department') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-brand-500" />
                      <span>Department Filter</span>
                    </label>
                    {selectedDept !== 'all' && (
                      <button
                        onClick={() => onSelectDept('all')}
                        className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        Reset Dept
                      </button>
                    )}
                  </div>

                  {deptList.length > 6 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={deptSearchQuery}
                        onChange={(e) => setDeptSearchQuery(e.target.value)}
                        placeholder="Search departments..."
                        className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-white/[0.08] focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {deptList.map((dept) => {
                      const isSelected = selectedDept.toLowerCase() === dept.value.toLowerCase() ||
                        (selectedDept === 'all' && dept.value === 'all');
                      return (
                        <button
                          key={dept.value}
                          onClick={() => onSelectDept(dept.value)}
                          className={`p-2.5 rounded-2xl text-left border transition-all active:scale-95 cursor-pointer flex items-center justify-between space-x-2 ${
                            isSelected
                              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white border-transparent shadow-md shadow-brand-500/20'
                              : 'bg-slate-50 dark:bg-navy-900/80 border-slate-200/90 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-brand-500/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-brand-500/10 text-brand-600 dark:text-brand-400'
                              }`}>
                                {dept.code}
                              </span>
                            </div>
                            <p className={`text-[11px] font-bold truncate mt-1 ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                              {dept.label}
                            </p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 shrink-0 text-white stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. ACADEMIC YEAR FILTER */}
              {(activeTab === 'all' || activeTab === 'year') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Academic Year</span>
                    </label>
                    {yearLevel !== 'all' && (
                      <button
                        onClick={() => onSelectYear('all')}
                        className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        Reset Year
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {yearOptions.map((opt) => {
                      const isSelected = yearLevel === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSelectYear(opt.value)}
                          className={`p-2.5 rounded-2xl text-left border transition-all active:scale-95 cursor-pointer flex items-center justify-between space-x-2 ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-md shadow-indigo-500/20'
                              : 'bg-slate-50 dark:bg-navy-900/80 border-slate-200/90 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-indigo-500/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                            }`}>
                              {opt.badge || opt.value}
                            </span>
                            <p className={`text-[11px] font-bold truncate mt-1 ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                              {opt.label}
                            </p>
                          </div>
                          {isSelected && <Check className="w-4 h-4 shrink-0 text-white stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. PERFORMANCE RANGE FILTER */}
              {(activeTab === 'all' || activeTab === 'performance') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      <span>Performance Range (Problems Solved)</span>
                    </label>
                    {solvedFilter !== 'all' && (
                      <button
                        onClick={() => onSelectSolvedFilter('all')}
                        className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        Reset Range
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {performanceOptions.map((opt) => {
                      const isSelected = solvedFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSelectSolvedFilter(opt.value)}
                          className={`w-full p-3 rounded-2xl text-left border transition-all active:scale-98 cursor-pointer flex items-center justify-between space-x-3 ${
                            isSelected
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/20'
                              : 'bg-slate-50 dark:bg-navy-900/80 border-slate-200/90 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border ${
                              isSelected
                                ? 'bg-white/20 text-white border-white/30'
                                : (opt.badgeColor || 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20')
                            }`}>
                              {opt.badge}
                            </span>
                            <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                              {opt.label}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {opt.count !== undefined && (
                              <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-md ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/70 dark:bg-navy-800 text-slate-700 dark:text-slate-300'
                              }`}>
                                {opt.count}
                              </span>
                            )}
                            {isSelected && <Check className="w-4 h-4 text-white stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. SORT RANKING */}
              {(activeTab === 'all' || activeTab === 'sort') && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                      <ArrowUpDown className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Sort Ranking</span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    {sortOptions.map((opt) => {
                      const isSelected = sortBy === opt.value;
                      const Icon = opt.icon || ArrowUpDown;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => onSelectSortBy(opt.value)}
                          className={`w-full p-3 rounded-2xl text-left border transition-all active:scale-98 cursor-pointer flex items-center justify-between space-x-3 ${
                            isSelected
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-md shadow-emerald-500/20'
                              : 'bg-slate-50 dark:bg-navy-900/80 border-slate-200/90 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-emerald-500/40'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-navy-800 text-slate-600 dark:text-slate-400'}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                              {opt.label}
                            </span>
                          </div>

                          {isSelected && <Check className="w-4 h-4 text-white stroke-[3] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="p-4 bg-slate-50/95 dark:bg-navy-950/95 border-t border-slate-200/80 dark:border-white/[0.08] backdrop-blur-md">
              <button
                onClick={onClose}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-brand-500/25 active:scale-98 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Apply Filters • Show {totalResults} Students</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
};
