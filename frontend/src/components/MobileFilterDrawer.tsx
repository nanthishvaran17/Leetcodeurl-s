import React from 'react';
import { X, Filter, RotateCcw, Check, Sparkles, Search } from 'lucide-react';
import { useFilters } from '../context/FilterContext';

interface MobileFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  departments?: Array<{ code: string; name: string }>;
}

export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  isOpen,
  onClose,
  departments = [
    { code: 'ALL', name: 'All Departments' },
    { code: 'CSE', name: 'Computer Science' },
    { code: 'ECE', name: 'Electronics & Comm.' },
    { code: 'EEE', name: 'Electrical & Electronics' },
    { code: 'MECH', name: 'Mechanical Engg.' },
    { code: 'CIVIL', name: 'Civil Engg.' },
    { code: 'IT', name: 'Information Tech.' },
    { code: 'AIDS', name: 'AI & Data Science' },
    { code: 'AIML', name: 'AI & Machine Learning' },
    { code: 'CYBER', name: 'Cyber Security' }
  ]
}) => {
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
    { id: '1st Year', label: '1st Year (I)' },
    { id: '2nd Year', label: '2nd Year (II)' },
    { id: '3rd Year', label: '3rd Year (III)' },
    { id: '4th Year', label: '4th Year (IV)' }
  ];

  const syncStatuses = [
    { id: 'ALL', label: 'All Statuses' },
    { id: 'verified', label: 'Verified Profiles' },
    { id: 'stale', label: 'Stale (Needs Sync)' },
    { id: 'failed', label: 'Issues / Mismatch' }
  ];

  return (
    <div className="fixed inset-[#000000] z-50 flex items-end sm:items-center justify-center bg-slate-900/70 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md bg-white dark:bg-navy-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-navy-800 overflow-hidden flex flex-col max-h-[85vh] transition-transform duration-300"
        role="dialog"
        aria-modal="true"
      >
        {/* Handle pill for swipe down indication */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-navy-700" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-slate-900 dark:text-white text-base">
              Filters & Search
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isFilteringActive && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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
                const isSelected = department === dept.code;
                return (
                  <button
                    key={dept.code}
                    onClick={() => setDepartment(dept.code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                        : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
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
                const isSelected = academicYear === y.id;
                return (
                  <button
                    key={y.id}
                    onClick={() => setAcademicYear(y.id)}
                    className={`p-2.5 rounded-xl text-xs text-left font-medium transition-all active:scale-95 border ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {y.label}
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
                    onClick={() => setAttendanceStatus(s.id)}
                    className={`p-2.5 rounded-xl text-xs text-left font-medium transition-all active:scale-95 border ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Apply Footer */}
        <div className="p-4 bg-slate-50 dark:bg-navy-950 border-t border-slate-100 dark:border-navy-800">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};
