import React from 'react';
import { X, Filter, RotateCcw, Check, Search } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { useDepartments } from '../context/DepartmentContext';
import { normalizeDepartment, normalizeAcademicYear } from '../utils/filterUtils';
import { SwipeHandle } from './SwipeHandle';
import { triggerHaptic } from '../utils/haptics';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  departments?: Array<{ code: string; name: string }>;
}

export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  departments: propDepartments
}) => {
  useEscapeKey(onClose, isOpen);
  const { departments: ctxDepartments = [] } = useDepartments();
  const rawDepartments = (propDepartments && propDepartments.length > 0) ? propDepartments : ctxDepartments;

  const departments = React.useMemo(() => {
    const list: Array<{ code: string; name: string }> = [{ code: 'ALL', name: 'All Departments' }];
    const seen = new Set<string>(['ALL']);

    if (rawDepartments && rawDepartments.length > 0) {
      rawDepartments.forEach((d: any) => {
        const c = (d.code || d.department_code || '').trim();
        const n = (d.name || d.department_name || c).trim();
        if (!c || seen.has(c.toUpperCase())) return;
        seen.add(c.toUpperCase());
        list.push({ code: c, name: n });
      });
    }

    const core = [
      { code: 'CSE(CS)', name: 'Computer Science & Engineering (Cyber Security)' },
      { code: 'CSE(IOT)', name: 'Computer Science & Engineering (IoT)' },
      { code: 'IT', name: 'Information Technology' }
    ];
    for (const c of core) {
      if (!seen.has(c.code.toUpperCase())) {
        seen.add(c.code.toUpperCase());
        list.push(c);
      }
    }
    return list;
  }, [rawDepartments]);
  const {
    department,
    setDepartment,
    academicYear,
    setAcademicYear,
    attendanceStatus,
    setAttendanceStatus,
    searchQuery,
    setSearchQuery,
    resetFilters,
    isFilteringActive
  } = useFilters();

  if (!isOpen) return null;

  const years = [
    { id: 'ALL', label: 'All Years' },
    { id: '1', label: '1st Year (I)' },
    { id: '2', label: '2nd Year (II)' },
    { id: '3', label: '3rd Year (III)' },
    { id: '4', label: '4th Year (IV)' }
  ];

  const syncStatuses = [
    { id: 'ALL', label: 'All Statuses' },
    { id: 'verified', label: 'Verified Profiles' },
    { id: 'stale', label: 'Stale (Needs Sync)' },
    { id: 'failed', label: 'Issues / Mismatch' }
  ];

  const handleDepartmentSelect = (code: string) => {
    triggerHaptic('selection');
    setDepartment(code);
  };

  const handleYearSelect = (yearId: string) => {
    triggerHaptic('selection');
    setAcademicYear(yearId);
  };

  const handleStatusSelect = (statusId: string) => {
    triggerHaptic('selection');
    setAttendanceStatus(statusId);
  };

  const handleReset = () => {
    triggerHaptic('warning');
    resetFilters();
  };

  const handleApply = () => {
    triggerHaptic('success');
    onClose();
  };

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-md bg-white dark:bg-[#091122] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden flex flex-col max-h-[88vh] transition-transform duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Handle pill for swipe down or tap to close */}
        <SwipeHandle
          onClose={handleClose}
          className="pt-2 pb-1"
          pillClassName="bg-slate-300 dark:bg-white/20 hover:bg-slate-400"
        />

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <span className="font-bold text-slate-900 dark:text-white text-base">
              Filters & Search
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isFilteringActive && (
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[42px] px-3 py-1.5 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-bold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors active:scale-95 touch-manipulation cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors active:scale-95 touch-manipulation cursor-pointer"
              aria-label="Close filters"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Quick Search Bar */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Search Student
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, reg. no, username..."
                className="w-full pl-9 pr-10 py-3 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/[0.04] text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none min-h-[44px]"
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => { triggerHaptic('light'); setSearchQuery(''); }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 touch-manipulation cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Department Filter Chips */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
              Department
            </label>
            <div className="flex flex-wrap gap-2">
              {departments.map((dept) => {
                const isSelected = 
                  (dept.code === 'ALL' && (department === 'ALL' || !department || department === 'all')) ||
                  normalizeDepartment(department) === normalizeDepartment(dept.code);
                return (
                  <button
                    key={dept.code}
                    type="button"
                    onClick={() => handleDepartmentSelect(dept.code)}
                    className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 touch-manipulation cursor-pointer ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-md shadow-brand-500/25 font-bold ring-2 ring-brand-500/30'
                        : 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 border border-transparent dark:border-white/5'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    {dept.code}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Academic Year Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
              Academic Year
            </label>
            <div className="grid grid-cols-2 gap-2">
              {years.map((y) => {
                const isSelected = 
                  (y.id === 'ALL' && (academicYear === 'ALL' || !academicYear || academicYear === 'all')) ||
                  normalizeAcademicYear(academicYear) === normalizeAcademicYear(y.id);
                return (
                  <button
                    key={y.id}
                    type="button"
                    onClick={() => handleYearSelect(y.id)}
                    className={`min-h-[44px] p-3 rounded-xl text-xs text-left font-semibold transition-all active:scale-95 border touch-manipulation cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-bold'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{y.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Status Filter */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block">
              Profile Verification Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {syncStatuses.map((s) => {
                const isSelected = attendanceStatus === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleStatusSelect(s.id)}
                    className={`min-h-[44px] p-3 rounded-xl text-xs text-left font-semibold transition-all active:scale-95 border touch-manipulation cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-bold'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{s.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Apply Footer - Safe bottom padding on mobile so button is not blocked by floating bottom nav or home bar */}
        <div className="p-4 pb-28 sm:pb-4 bg-slate-50 dark:bg-[#070d1a] border-t border-slate-100 dark:border-white/10">
          <button
            type="button"
            onClick={handleApply}
            className="w-full min-h-[46px] py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-sm transition-all shadow-lg shadow-brand-500/25 active:scale-95 touch-manipulation cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};
