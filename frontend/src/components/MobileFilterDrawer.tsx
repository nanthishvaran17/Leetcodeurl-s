import React from 'react';
import { createPortal } from 'react-dom';
import { X, Filter, RotateCcw, Check, Search, Building2, GraduationCap, Calendar, ShieldCheck } from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { useDepartments } from '../context/DepartmentContext';
import { normalizeDepartment, normalizeAcademicYear } from '../utils/filterUtils';
import { SwipeHandle } from './SwipeHandle';
import { triggerHaptic } from '../utils/haptics';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useScrollLock } from '../hooks/useScrollLock';
import { useTypewriterPlaceholder } from '../hooks/useTypewriterPlaceholder';

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
  useScrollLock(isOpen);
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
    college,
    setCollege,
    searchQuery,
    setSearchQuery,
    resetFilters,
    isFilteringActive
  } = useFilters();

  // Local search state to prevent debounce stutter and parent re-render lag while typing
  const [localSearch, setLocalSearch] = React.useState(searchQuery || '');
  React.useEffect(() => {
    setLocalSearch(searchQuery || '');
  }, [searchQuery]);

  const animatedPlaceholder = useTypewriterPlaceholder(
    [
      'Search by name...',
      'Search by reg. no (e.g. 732224CC031)...',
      'Search by username...',
      'Search LeetCode handle...'
    ],
    isOpen,
    Boolean(localSearch.trim().length > 0)
  );

  const activeCount = React.useMemo(() => {
    let count = 0;
    if (college && college !== 'ALL') count++;
    if (department && department !== 'ALL') count++;
    if (academicYear && academicYear !== 'ALL') count++;
    if (attendanceStatus && attendanceStatus !== 'ALL') count++;
    if (localSearch && localSearch.trim()) count++;
    return count;
  }, [college, department, academicYear, attendanceStatus, localSearch]);

  if (!isOpen || typeof document === 'undefined') return null;

  const years = [
    { id: 'ALL', label: 'All Years' },
    { id: '1', label: '1st Year (I)' },
    { id: '2', label: '2nd Year (II)' },
    { id: '3', label: '3rd Year (III)' },
    { id: '4', label: '4th Year (IV)' }
  ];

  const syncStatuses = [
    { id: 'ALL', label: 'All Statuses', dot: 'bg-slate-400' },
    { id: 'verified', label: 'Verified Profiles', dot: 'bg-emerald-500' },
    { id: 'stale', label: 'Stale (Needs Sync)', dot: 'bg-amber-500' },
    { id: 'failed', label: 'Issues / Mismatch', dot: 'bg-rose-500' }
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
    setLocalSearch('');
    resetFilters();
  };

  const handleApply = () => {
    triggerHaptic('success');
    if (localSearch.trim() !== (searchQuery || '').trim()) {
      setSearchQuery(localSearch.trim());
    }
    onClose();
  };

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-[#091122] rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-slate-200/90 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-slide-up"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Mobile Swipe/Drag Pill */}
        <SwipeHandle
          onClose={handleClose}
          className="pt-2.5 pb-1"
          pillClassName="bg-slate-300 dark:bg-white/20 hover:bg-slate-400 w-12 h-1.5"
        />

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center border border-brand-500/20 shadow-xs">
              <Filter className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 dark:text-white text-base leading-tight">
                  Filters &amp; Search
                </span>
                {activeCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                    {activeCount} active
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Refine students by campus, dept, year &amp; status</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={handleReset}
                className="px-2.5 py-1.5 flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-bold rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors active:scale-95 touch-manipulation cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors active:scale-95 touch-manipulation cursor-pointer"
              aria-label="Close filters"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Quick Search Bar */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-brand-500" />
              <span>Search Student</span>
            </label>
            <div className="relative flex items-center rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 shadow-xs focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
              <Search className="w-4 h-4 absolute left-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (localSearch.trim() !== (searchQuery || '').trim()) {
                      setSearchQuery(localSearch.trim());
                    }
                    onClose();
                  }
                }}
                placeholder={animatedPlaceholder || "Search by name, reg. no, LeetCode username..."}
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-transparent text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none min-h-[44px]"
              />
              {localSearch && (
                <button 
                  type="button"
                  onClick={() => { 
                    triggerHaptic('light'); 
                    setLocalSearch(''); 
                    setSearchQuery(''); 
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 touch-manipulation cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* College Campus Filter */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>College Campus</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['ALL', 'NEC', 'NCT'] as const).map((col) => {
                const isSelected = (college || 'ALL') === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      triggerHaptic('selection');
                      setCollege(col);
                    }}
                    className={`min-h-[42px] px-2.5 py-2 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 touch-manipulation cursor-pointer border ${
                      isSelected
                        ? col === 'NCT'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md font-black ring-2 ring-teal-500/30'
                          : col === 'NEC'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-black ring-2 ring-indigo-500/30'
                          : 'bg-brand-600 text-white border-brand-600 shadow-md font-black ring-2 ring-brand-500/30'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-transparent dark:border-white/5'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>{col === 'ALL' ? 'All' : col}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Department Filter Chips */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-brand-500" />
              <span>Department</span>
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
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 touch-manipulation cursor-pointer border ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/25 ring-2 ring-brand-500/30'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-transparent dark:border-white/5'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>{dept.code}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Academic Year Filter — Responsive Balanced Flex Wrap */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <span>Academic Year</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {years.map((y) => {
                const isSelected = 
                  (y.id === 'ALL' && (academicYear === 'ALL' || !academicYear || academicYear === 'all')) ||
                  normalizeAcademicYear(academicYear) === normalizeAcademicYear(y.id);
                return (
                  <button
                    key={y.id}
                    type="button"
                    onClick={() => handleYearSelect(y.id)}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 touch-manipulation cursor-pointer border ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/25 ring-2 ring-brand-500/30'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 border-transparent dark:border-white/5'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                    <span>{y.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profile Status Filter */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Profile Verification Status</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {syncStatuses.map((s) => {
                const isSelected = (attendanceStatus || 'ALL') === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleStatusSelect(s.id)}
                    className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border touch-manipulation cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 ring-2 ring-brand-500/30 shadow-xs'
                        : 'border-slate-200/90 dark:border-white/10 bg-white dark:bg-white/[0.03] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      <span>{s.label}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5] text-brand-600 dark:text-brand-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Apply Footer - Balanced with Reset & Apply buttons */}
        <div className="p-4 pb-[max(1.5rem,env(safe-area-inset-bottom,1.5rem))] sm:pb-4 bg-slate-50/90 dark:bg-[#070d1a]/95 backdrop-blur-md border-t border-slate-100 dark:border-white/10 flex items-center gap-2.5">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="py-3 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all active:scale-95 touch-manipulation cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-sm transition-all shadow-lg shadow-brand-500/25 active:scale-[0.98] touch-manipulation cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Apply Filters {activeCount > 0 ? `(${activeCount})` : ''}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
