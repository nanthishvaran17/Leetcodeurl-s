import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trash2, AlertTriangle, X, Loader2, Building2, Calendar, School,
  Check, Users, ShieldAlert, AlertCircle, ShieldCheck, Search, CheckSquare, Square, MinusSquare,
  ChevronLeft, ChevronRight, ChevronDown
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { Department } from '../context/DepartmentContext';
import { CustomDropdown, DropdownOption } from './CustomDropdown';
import { GlobalModalBackdrop } from './GlobalModalBackdrop';
import { SwipeHandle } from './SwipeHandle';

export interface BatchDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[] | Array<{ id?: number; name: string; code: string;[key: string]: any }>;
  initialDepartment?: string;
  initialAcademicYear?: string;
  initialCollege?: string;
}

interface StudentItem {
  id: number;
  reg_no: string;
  name: string;
  department: string;
  year_level: string;
  college: string;
  is_active: boolean;
}

interface PreviewResponse {
  count: number;
  total_matched: number;
  protected_count: number;
  department_name: string;
  year_level: string;
  college: string;
  students?: StudentItem[];
  sample_students?: StudentItem[];
  message?: string;
}

function normalizeInputYear(yr?: string): string {
  if (!yr) return 'ALL';
  const u = yr.trim().toUpperCase();
  if (u === 'ALL' || u === 'ALL YEARS' || u === 'ALL_YEARS' || u === 'ALL ACADEMIC YEARS') return 'ALL';
  if (u === '1' || u === '1ST YEAR' || u === 'I' || u === 'I YEAR' || u.includes('2026') || u.includes('2030')) return '1st Year';
  if (u === '2' || u === '2ND YEAR' || u === 'II' || u === 'II YEAR' || u.includes('2025') || u.includes('2029')) return '2nd Year';
  if (u === '3' || u === '3RD YEAR' || u === 'III' || u === 'III YEAR' || u.includes('2024') || u.includes('2028')) return '3rd Year';
  if (u === '4' || u === '4TH YEAR' || u === 'IV' || u === 'IV YEAR' || u.includes('FINAL') || u.includes('2023') || u.includes('2027')) return '4th Year';
  return yr;
}

function normalizeInputDept(dept?: string, depts?: Array<{ id?: number; code: string; name: string;[key: string]: any }>): string {
  if (!dept) return 'ALL';
  const u = dept.trim().toUpperCase();
  if (u === 'ALL' || u === 'ALL DEPARTMENTS' || u === 'ALL_DEPARTMENTS') return 'ALL';
  if (depts && depts.length > 0) {
    const foundById = depts.find(d => String(d.id) === dept);
    if (foundById && foundById.code) return foundById.code;
    const foundByCode = depts.find(d => (d.code || '').toUpperCase() === u);
    if (foundByCode && foundByCode.code) return foundByCode.code;
  }
  return dept;
}

export const BatchDeleteModal: React.FC<BatchDeleteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  departments = [],
  initialDepartment = 'ALL',
  initialAcademicYear = 'ALL',
  initialCollege = 'ALL'
}) => {
  const { notify } = useNotification();

  const [selectedDept, setSelectedDept] = useState<string>(() => normalizeInputDept(initialDepartment, departments as any));
  const [selectedYear, setSelectedYear] = useState<string>(() => normalizeInputYear(initialAcademicYear));
  const [selectedCollege, setSelectedCollege] = useState<'ALL' | 'NEC' | 'NCT'>(
    (initialCollege as 'ALL' | 'NEC' | 'NCT') || 'ALL'
  );
  const [isSoftDelete, setIsSoftDelete] = useState<boolean>(false);
  const [confirmChecked, setConfirmChecked] = useState<boolean>(false);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Individual student selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [searchFilter, setSearchFilter] = useState<string>('');

  const previewAbortController = useRef<AbortController | null>(null);

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('hide-mobile-bottom-nav');
      setSelectedDept(normalizeInputDept(initialDepartment, departments as any));
      setSelectedYear(normalizeInputYear(initialAcademicYear));
      setSelectedCollege((initialCollege as 'ALL' | 'NEC' | 'NCT') || 'ALL');
      setConfirmChecked(false);
      setErrorMsg(null);
      setSelectedStudentIds(new Set());
      setSearchFilter('');

      return () => {
        document.body.classList.remove('hide-mobile-bottom-nav');
      };
    }
  }, [isOpen, initialDepartment, initialAcademicYear, initialCollege, departments]);

  // Dept Options for CustomDropdown
  const deptOptions = useMemo<DropdownOption[]>(() => {
    const list: DropdownOption[] = [
      {
        value: 'ALL',
        label: 'All Departments',
        sublabel: 'Apply across entire institution',
        badge: 'ALL',
        badgeColor: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20',
        icon: Building2
      }
    ];

    departments.forEach((d) => {
      const code = d.code || 'DEP';
      const name = d.name || d.code || 'Department';
      list.push({
        value: code,
        label: `${code} — ${name}`,
        sublabel: name,
        badge: code,
        badgeColor: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
        icon: Building2
      });
    });

    return list;
  }, [departments]);

  // Academic Year Options for CustomDropdown
  const yearOptions = useMemo<DropdownOption[]>(() => [
    {
      value: 'ALL',
      label: 'All Academic Years',
      sublabel: 'Target all student years/batches',
      badge: 'ALL',
      badgeColor: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/20',
      icon: Calendar
    },
    {
      value: '1st Year',
      label: '1st Year',
      sublabel: 'Academic Batch 2026-2030',
      badge: '1st Year',
      badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
      icon: Calendar
    },
    {
      value: '2nd Year',
      label: '2nd Year',
      sublabel: 'Academic Batch 2025-2029',
      badge: '2nd Year',
      badgeColor: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25',
      icon: Calendar
    },
    {
      value: '3rd Year',
      label: '3rd Year',
      sublabel: 'Academic Batch 2024-2028',
      badge: '3rd Year',
      badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25',
      icon: Calendar
    },
    {
      value: '4th Year',
      label: '4th Year',
      sublabel: 'Academic Batch 2023-2027',
      badge: '4th Year',
      badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
      icon: Calendar
    },
  ], []);

  const hasSpecificFilter = selectedDept !== 'ALL' || selectedYear !== 'ALL';

  // Fetch Preview whenever criteria changes
  useEffect(() => {
    if (!isOpen) return;

    if (previewAbortController.current) {
      previewAbortController.current.abort();
    }
    const controller = new AbortController();
    previewAbortController.current = controller;

    setConfirmChecked(false);
    setErrorMsg(null);

    if (!hasSpecificFilter) {
      setPreview({
        count: 0,
        total_matched: 0,
        protected_count: 0,
        department_name: 'All Departments',
        year_level: 'All Years',
        college: selectedCollege,
        students: [],
        sample_students: [],
        message: 'Please choose at least a specific Department or an Academic Year to target students.'
      });
      setSelectedStudentIds(new Set());
      setIsLoadingPreview(false);
      return;
    }

    setIsLoadingPreview(true);

    const timer = setTimeout(async () => {
      try {
        const payload: any = {
          college: selectedCollege !== 'ALL' ? selectedCollege : undefined
        };
        if (selectedDept !== 'ALL') {
          payload.department = selectedDept;
        }
        if (selectedYear !== 'ALL') {
          payload.year_level = selectedYear;
        }

        const res = await api.post('/students/preview-batch-delete', payload, {
          signal: controller.signal
        });
        const data: PreviewResponse = res.data;
        setPreview(data);

        // By default, select all retrieved students for quick bulk action
        const allList: StudentItem[] = data.students || data.sample_students || [];
        const allIds = new Set(allList.map(s => s.id));
        setSelectedStudentIds(allIds);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setErrorMsg(err.response?.data?.detail || 'Failed to load preview for selected criteria.');
        }
      } finally {
        setIsLoadingPreview(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, selectedDept, selectedYear, selectedCollege, hasSpecificFilter]);

  // All student items currently loaded
  const studentList: StudentItem[] = useMemo(() => {
    if (!preview) return [];
    return preview.students || preview.sample_students || [];
  }, [preview]);

  // Filtered by search text (name / reg_no)
  const filteredStudents = useMemo(() => {
    if (!searchFilter.trim()) return studentList;
    const q = searchFilter.trim().toLowerCase();
    return studentList.filter(s =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.reg_no && s.reg_no.toLowerCase().includes(q))
    );
  }, [studentList, searchFilter]);

  // 2. Pagination State & Slice Logic
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [isPageSizeOpen, setIsPageSizeOpen] = useState<boolean>(false);
  const pageSizeDropdownRef = useRef<HTMLDivElement>(null);

  // Close pageSize dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (pageSizeDropdownRef.current && !pageSizeDropdownRef.current.contains(e.target as Node)) {
        setIsPageSizeOpen(false);
      }
    };
    if (isPageSizeOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isPageSizeOpen]);

  // Reset page when search or criteria filters change
  useEffect(() => {
    setPage(1);
  }, [searchFilter, selectedDept, selectedYear, selectedCollege, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safePage = Math.min(page, totalPages);

  // Paginated records to render:
  const paginatedStudents = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, safePage, pageSize]);

  // Select / Deselect individual student
  const handleToggleStudent = (studentId: number) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  // Select All / Deselect All
  const isAllSelected = studentList.length > 0 && selectedStudentIds.size === studentList.length;
  const isPartiallySelected = selectedStudentIds.size > 0 && selectedStudentIds.size < studentList.length;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(studentList.map(s => s.id)));
    }
  };

  // Execute Batch Delete for selected IDs
  const handleExecuteDelete = async () => {
    if (!hasSpecificFilter) {
      setErrorMsg('Please select at least a Department or Academic Year.');
      return;
    }

    if (selectedStudentIds.size === 0) {
      setErrorMsg('Please select at least one student from the list to proceed.');
      return;
    }

    if (!confirmChecked) {
      setErrorMsg('Please tick the confirmation checkbox to authorize this operation.');
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        department: selectedDept !== 'ALL' ? selectedDept : undefined,
        year_level: selectedYear !== 'ALL' ? selectedYear : undefined,
        college: selectedCollege !== 'ALL' ? selectedCollege : undefined,
        soft_delete: isSoftDelete,
        student_ids: Array.from(selectedStudentIds)
      };

      const res = await api.post('/students/delete-by-dept-year', payload);
      const actionWord = isSoftDelete ? 'deactivated' : 'deleted';
      notify.success(
        isSoftDelete ? 'Batch Deactivation Successful' : 'Batch Deletion Successful',
        res.data?.message || `Successfully ${actionWord} ${res.data?.count ?? selectedStudentIds.size} students.`,
        { category: 'STUDENT REPOSITORY' }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to delete students. Please check your permissions and try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  // Determine button state and label
  const getButtonState = () => {
    if (isDeleting) {
      return {
        disabled: true,
        text: isSoftDelete ? 'Deactivating...' : 'Deleting...',
        mobileText: isSoftDelete ? 'Deactivating...' : 'Deleting...'
      };
    }
    if (!hasSpecificFilter) {
      return {
        disabled: true,
        text: 'Select Department or Year',
        mobileText: 'Select Filter'
      };
    }
    if (isLoadingPreview) {
      return {
        disabled: true,
        text: 'Scanning Roster...',
        mobileText: 'Scanning...'
      };
    }
    if (studentList.length === 0) {
      return {
        disabled: true,
        text: 'No Students Found',
        mobileText: 'No Students'
      };
    }
    if (selectedStudentIds.size === 0) {
      return {
        disabled: true,
        text: 'Select Students to Proceed',
        mobileText: 'Select Students'
      };
    }
    if (!confirmChecked) {
      return {
        disabled: true,
        text: `Check Confirmation Below (${selectedStudentIds.size})`,
        mobileText: `Confirm Below (${selectedStudentIds.size})`
      };
    }
    return {
      disabled: false,
      text: isSoftDelete
        ? `Deactivate ${selectedStudentIds.size} Selected Students`
        : `Permanently Delete ${selectedStudentIds.size} Selected Students`,
      mobileText: isSoftDelete
        ? `Deactivate (${selectedStudentIds.size})`
        : `Delete (${selectedStudentIds.size})`
    };
  };

  const buttonState = getButtonState();

  return (
    <GlobalModalBackdrop
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      zIndex={100000}
      className="flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 dark:bg-black/80 backdrop-blur-md overflow-hidden"
    >
      <div
        className="bg-white dark:bg-[#0c1424] rounded-t-[32px] sm:rounded-3xl w-full max-w-full sm:max-w-2xl shadow-2xl flex flex-col h-auto max-h-[88dvh] sm:max-h-[88vh] overflow-hidden border-t sm:border border-slate-200 dark:border-white/10 animate-fade-in-up select-text m-0 sm:my-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-delete-modal-title"
      >
        {/* Header - Fixed at top so Grabber, Title & Close button are always visible */}
        <div className="px-5 pt-3 pb-3.5 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent dark:from-rose-500/15 dark:via-rose-950/20 dark:to-transparent border-b border-rose-100 dark:border-rose-950/50 shrink-0">
          {/* Grabber Handle */}
          <SwipeHandle
            onClose={() => { if (!isDeleting) onClose(); }}
            className="mb-1 py-1"
            pillClassName="bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
          />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center shrink-0 shadow-xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 id="batch-delete-modal-title" className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight uppercase">
                    Delete Cohort by Department & Year
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 text-[9px] font-black tracking-wider uppercase border border-rose-500/25">
                    {isSoftDelete ? 'DEACTIVATE' : 'PURGE'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Filter by department & year, select all or choose individual students.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isDeleting}
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 disabled:opacity-30"
              title="Close dialog (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 [touch-action:pan-y] [-webkit-overflow-scrolling:touch] custom-scrollbar p-4 sm:p-5 space-y-4">

            {/* Section 1: Compact Filter Bar (Department, Year, Campus, Mode) */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200/80 dark:border-navy-800 space-y-3">

              {/* Top row: Dept & Year Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <CustomDropdown
                  id="batch-delete-department"
                  label="Department"
                  icon={Building2}
                  value={selectedDept}
                  onChange={(val) => setSelectedDept(val)}
                  options={deptOptions}
                  placeholder="Select Department"
                />
                <CustomDropdown
                  id="batch-delete-year"
                  label="Academic Year"
                  icon={Calendar}
                  value={selectedYear}
                  onChange={(val) => setSelectedYear(val)}
                  options={yearOptions}
                  placeholder="Select Academic Year"
                />
              </div>

              {/* Bottom row: Campus Scope & Execution Mode */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1 border-t border-slate-200/60 dark:border-navy-800/80">

                {/* Campus Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                    Campus:
                  </span>
                  <div className="inline-flex rounded-lg bg-white dark:bg-navy-950 p-0.5 border border-slate-200 dark:border-navy-800 text-xs">
                    {(['ALL', 'NEC', 'NCT'] as const).map((campus) => {
                      const isSel = selectedCollege === campus;
                      return (
                        <button
                          key={campus}
                          type="button"
                          onClick={() => setSelectedCollege(campus)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${isSel
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                          {campus === 'ALL' ? 'All' : campus}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                    Mode:
                  </span>
                  <div className="inline-flex rounded-lg bg-white dark:bg-navy-950 p-0.5 border border-slate-200 dark:border-navy-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setIsSoftDelete(false)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${!isSoftDelete
                          ? 'bg-rose-600 text-white font-extrabold shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      Permanent Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSoftDelete(true)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${isSoftDelete
                          ? 'bg-amber-600 text-white font-extrabold shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                      Deactivate Only
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* Section 2: When NO specific filter is chosen -> Quick Select Prompt */}
            {!hasSpecificFilter && (
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-navy-900/50 border border-slate-200 dark:border-navy-800 text-center space-y-3">
                <Users className="w-8 h-8 text-rose-500/60 mx-auto" />
                <div>
                  <p className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                    Choose a Department or Academic Year
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-0.5">
                    Select a specific branch or academic batch above to audit and select students.
                  </p>
                </div>

                {/* Quick Select Chips */}
                <div className="pt-2 flex flex-wrap items-center justify-center gap-1.5">
                  {departments.slice(0, 4).map(d => (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => setSelectedDept(d.code)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-navy-800 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 transition-all cursor-pointer shadow-2xs"
                    >
                      {d.code}
                    </button>
                  ))}
                  {(['1st Year', '2nd Year', '3rd Year', '4th Year'] as const).map(yr => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setSelectedYear(yr)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700 hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Interactive Student Selection Ledger (Select All / Row Select) */}
            {hasSpecificFilter && (
              <div className="space-y-3">

                {/* Header Info & Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">

                  {/* Left: Select All Checkbox + Count Pill */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      disabled={isLoadingPreview || studentList.length === 0}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-800 transition-all cursor-pointer disabled:opacity-40"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-rose-600" />
                      ) : isPartiallySelected ? (
                        <MinusSquare className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                      <span>Select All ({studentList.length})</span>
                    </button>

                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider border ${selectedStudentIds.size > 0
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                        : 'bg-slate-100 dark:bg-navy-900 text-slate-500 border-slate-200 dark:border-navy-800'
                      }`}>
                      {selectedStudentIds.size} of {studentList.length} Selected
                    </span>
                  </div>

                  {/* Right: Quick Search Filter */}
                  {studentList.length > 5 && (
                    <div className="relative w-full sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Filter by name / roll..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                    </div>
                  )}

                </div>

                {/* Student Rows Container */}
                {isLoadingPreview ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-navy-900/60 rounded-2xl border border-slate-200 dark:border-navy-800 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      Scanning student records for matching cohort...
                    </p>
                  </div>
                ) : studentList.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-center space-y-1">
                    <Users className="w-7 h-7 opacity-30 mx-auto text-slate-400" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Matching Students Found</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      No active student records match Department ({selectedDept}) and Year ({selectedYear}).
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 dark:border-navy-800 overflow-hidden bg-white dark:bg-navy-950 shadow-xs">

                    {/* Cohort Summary Bar */}
                    <div className="px-3.5 py-2 bg-slate-100/90 dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between text-xs">
                      <span className="font-extrabold text-slate-700 dark:text-slate-300 text-[11px]">
                        Student Roster ({filteredStudents.length} {filteredStudents.length !== studentList.length ? `matching "${searchFilter}"` : 'records'})
                      </span>
                      {preview?.protected_count ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{preview.protected_count} Admin Protected</span>
                        </span>
                      ) : null}
                    </div>

                    {/* Scrollable Rows */}
                    <div className="max-h-64 sm:max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-navy-800/80 custom-scrollbar overscroll-contain">
                      {paginatedStudents.map((st) => {
                        const isSelected = selectedStudentIds.has(st.id);
                        return (
                          <div
                            key={st.id}
                            onClick={() => handleToggleStudent(st.id)}
                            className={`px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors select-none ${isSelected
                                ? 'bg-rose-50/70 dark:bg-rose-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-navy-900/50'
                              }`}
                          >
                            {/* Checkbox + Name & RegNo */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStudent(st.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 rounded text-rose-600 border-slate-300 dark:border-navy-700 focus:ring-rose-500 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0">
                                <p className={`font-bold text-xs truncate ${isSelected ? 'text-rose-900 dark:text-rose-200' : 'text-slate-900 dark:text-white'}`}>
                                  {st.name}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                  {st.reg_no}
                                </p>
                              </div>
                            </div>

                            {/* Dept / Year / Campus Badges */}
                            <div className="text-right shrink-0 flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                {st.department}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300">
                                Yr {st.year_level}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200/60 text-slate-600 dark:bg-navy-800/80 dark:text-slate-400">
                                {st.college || 'NEC'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 3. Pagination Controls Bar */}
                    {filteredStudents.length > 0 && (
                      <div className="px-3 py-1.5 bg-slate-50/90 dark:bg-navy-900/90 border-t border-slate-200 dark:border-navy-800 flex flex-wrap items-center justify-between gap-1.5 text-xs select-none">
                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] sm:text-[11px] font-medium">
                          <span>
                            Showing <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min((safePage - 1) * pageSize + 1, filteredStudents.length)}</span> - <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(safePage * pageSize, filteredStudents.length)}</span> of <span className="font-bold text-slate-700 dark:text-slate-200">{filteredStudents.length}</span>
                          </span>
                          <span className="text-slate-300 dark:text-navy-700">|</span>

                          {/* Custom Animated Per Page Dropdown */}
                          <div className="relative flex items-center gap-1" ref={pageSizeDropdownRef}>
                            <span className="text-slate-500 dark:text-slate-400">Per page:</span>
                            <button
                              type="button"
                              onClick={() => setIsPageSizeOpen(!isPageSizeOpen)}
                              className="inline-flex items-center gap-1 h-6 px-2 py-0.5 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700/80 text-[11px] font-bold text-slate-800 dark:text-slate-200 shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all cursor-pointer focus:outline-none active:scale-95"
                            >
                              <span>{pageSize}</span>
                              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isPageSizeOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                            </button>

                            {/* Floating Custom Menu (Opens upwards to never overflow bottom frame) */}
                            {isPageSizeOpen && (
                              <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[84px] py-0.5 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-navy-800">
                                  Page Size
                                </div>
                                {[10, 20, 50, 100].map((size) => {
                                  const isSelected = pageSize === size;
                                  return (
                                    <button
                                      key={size}
                                      type="button"
                                      onClick={() => {
                                        setPageSize(size);
                                        setPage(1);
                                        setIsPageSizeOpen(false);
                                      }}
                                      className={`w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${isSelected
                                          ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400'
                                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                                        }`}
                                    >
                                      <span>{size}</span>
                                      {isSelected && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="inline-flex items-center gap-0.5 h-6 px-2 py-0.5 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-navy-800 hover:border-slate-300 dark:hover:border-navy-700 transition shadow-2xs cursor-pointer active:scale-95"
                          >
                            <ChevronLeft className="w-3 h-3" />
                            <span>Prev</span>
                          </button>

                          <span className="inline-flex items-center justify-center h-6 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-navy-950/80 border border-slate-200/60 dark:border-navy-800 text-[10px] sm:text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                            {safePage} / {totalPages}
                          </span>

                          <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="inline-flex items-center gap-0.5 h-6 px-2 py-0.5 rounded-lg bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-navy-800 hover:border-slate-300 dark:hover:border-navy-700 transition shadow-2xs cursor-pointer active:scale-95"
                          >
                            <span>Next</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Safety Confirmation Checkbox (Visible when at least 1 student is selected) */}
                {selectedStudentIds.size > 0 && (
                  <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900/60 space-y-2">
                    <div className="flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <p className="font-bold leading-tight">
                        {isSoftDelete
                          ? `You are targeting ${selectedStudentIds.size} student(s) for deactivation. They will be hidden from active leaderboards.`
                          : `Permanent Purge: This will permanently delete ${selectedStudentIds.size} student record(s), contest history, and logs. This action cannot be reversed.`}
                      </p>
                    </div>

                    <label className="flex items-center gap-2.5 text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none pt-0.5">
                      <input
                        type="checkbox"
                        checked={confirmChecked}
                        onChange={(e) => setConfirmChecked(e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 border-rose-300 focus:ring-rose-500 cursor-pointer shrink-0"
                      />
                      <span>
                        I confirm and authorize {isSoftDelete ? 'deactivating' : 'permanently deleting'} these {selectedStudentIds.size} students.
                      </span>
                    </label>
                  </div>
                )}

              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

          </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-t border-slate-200 dark:border-navy-800 bg-slate-50/90 dark:bg-navy-950/95 backdrop-blur-md flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-3.5">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="shrink-0 px-4 sm:px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl transition-all cursor-pointer min-h-[42px] text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={buttonState.disabled}
            onClick={handleExecuteDelete}
            className={`flex-1 sm:flex-initial min-w-0 px-3.5 sm:px-6 py-2.5 text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer min-h-[42px] ${buttonState.disabled
                ? 'bg-slate-200 dark:bg-navy-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-navy-700 shadow-none cursor-not-allowed'
                : 'bg-gradient-to-r from-rose-600 via-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:from-rose-700 text-white shadow-rose-600/25 active:scale-95'
              }`}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span className="truncate">{buttonState.text}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className="truncate hidden sm:inline">{buttonState.text}</span>
                <span className="truncate sm:hidden">{buttonState.mobileText}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </GlobalModalBackdrop>
  );
};
