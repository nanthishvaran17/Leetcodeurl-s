import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Trash2, AlertTriangle, X, Loader2, Building2, Calendar, School, 
  Check, Users, ShieldAlert, AlertCircle, ShieldCheck, CheckCircle2 
} from 'lucide-react';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { Department } from '../context/DepartmentContext';
import { CustomDropdown, DropdownOption } from './CustomDropdown';
import { GlobalModalBackdrop } from './GlobalModalBackdrop';

export interface BatchDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[] | Array<{ id?: number; name: string; code: string; [key: string]: any }>;
  initialDepartment?: string;
  initialAcademicYear?: string;
  initialCollege?: string;
}

interface PreviewStudent {
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
  sample_students: PreviewStudent[];
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

function normalizeInputDept(dept?: string, depts?: Array<{ id?: number; code: string; name: string; [key: string]: any }>): string {
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
      label: '1st Year (I Year)',
      sublabel: 'Academic Batch 2026-2030',
      badge: 'I Year',
      badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
      icon: Calendar
    },
    {
      value: '2nd Year',
      label: '2nd Year (II Year)',
      sublabel: 'Academic Batch 2025-2029',
      badge: 'II Year',
      badgeColor: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25',
      icon: Calendar
    },
    {
      value: '3rd Year',
      label: '3rd Year (III Year)',
      sublabel: 'Academic Batch 2024-2028',
      badge: 'III Year',
      badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/25',
      icon: Calendar
    },
    {
      value: '4th Year',
      label: '4th Year (Final Year / IV)',
      sublabel: 'Academic Batch 2023-2027',
      badge: 'IV Year',
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
        sample_students: [],
        message: 'Please choose at least a specific Department or an Academic Year to target students.'
      });
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
        setPreview(res.data);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setErrorMsg(err.response?.data?.detail || 'Failed to load preview for selected Department and Year.');
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

  // Execute Batch Delete
  const handleExecuteDelete = async () => {
    if (!hasSpecificFilter) {
      setErrorMsg('Please select at least a Department or Academic Year.');
      return;
    }

    if (!preview || preview.count <= 0) {
      setErrorMsg('No students match the selected criteria to delete.');
      return;
    }

    if (!confirmChecked) {
      setErrorMsg('Please tick the confirmation checkbox to proceed.');
      return;
    }

    setIsDeleting(true);
    setErrorMsg(null);

    try {
      const payload: any = {
        department: selectedDept !== 'ALL' ? selectedDept : undefined,
        year_level: selectedYear !== 'ALL' ? selectedYear : undefined,
        college: selectedCollege !== 'ALL' ? selectedCollege : undefined,
        soft_delete: isSoftDelete
      };

      const res = await api.post('/students/delete-by-dept-year', payload);
      const actionWord = isSoftDelete ? 'deactivated' : 'deleted';
      notify.success(
        isSoftDelete ? 'Batch Deactivation Successful' : 'Batch Deletion Successful',
        res.data?.message || `Successfully ${actionWord} ${res.data?.count ?? preview.count} students.`,
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

  return (
    <GlobalModalBackdrop
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      zIndex={100000}
      className="flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 dark:bg-navy-950/85 backdrop-blur-md overflow-hidden"
    >
      <div 
        className="bg-white dark:bg-navy-950 rounded-t-[2.25rem] sm:rounded-3xl w-full max-w-xl shadow-2xl flex flex-col h-auto max-h-[92dvh] sm:max-h-[88vh] overflow-hidden border-t sm:border border-slate-200 dark:border-navy-800 border-t-4 border-t-rose-500 animate-fade-in-up select-text"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-delete-modal-title"
      >
        {/* Mobile Pull Handle */}
        <div 
          className="sm:hidden pt-2.5 pb-1 flex justify-center bg-slate-900 cursor-pointer shrink-0" 
          onClick={() => { if (!isDeleting) onClose(); }}
        >
          <div className="w-12 h-1 rounded-full bg-slate-600/70 hover:bg-slate-500 transition-colors" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-950 via-rose-950/30 to-slate-950 text-white flex items-center justify-between border-b border-rose-500/20 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-inner shadow-rose-500/20">
              <Trash2 className="w-5 h-5 text-rose-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="batch-delete-modal-title" className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
                  Delete by Department & Year
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-black tracking-widest uppercase border border-rose-500/30">
                  DESTRUCTIVE ACTION
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium truncate mt-0.5">
                Target, preview & remove student records by Department & Academic Year
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 disabled:opacity-30"
            title="Close dialog (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 pb-3 sm:pb-4">

          {/* Section 1: Target Criteria */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800/80 pb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 border border-rose-200 dark:border-rose-500/20">
                <Building2 className="w-3.5 h-3.5 text-rose-500" />
                Target Criteria
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Select Department & Academic Year
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
              {/* Department Dropdown */}
              <div>
                <CustomDropdown
                  id="batch-delete-department"
                  label="Department"
                  icon={Building2}
                  value={selectedDept}
                  onChange={(val) => setSelectedDept(val)}
                  options={deptOptions}
                  placeholder="Select Department"
                />
              </div>

              {/* Academic Year Dropdown */}
              <div>
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
            </div>

            {/* Campus / College Selection */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-teal-500" />
                <span>Campus / Institution Scope</span>
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-navy-900 p-1 rounded-xl border border-slate-200 dark:border-navy-800">
                {(['ALL', 'NEC', 'NCT'] as const).map((campus) => (
                  <button
                    key={campus}
                    type="button"
                    onClick={() => setSelectedCollege(campus)}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      selectedCollege === campus
                        ? campus === 'NCT'
                          ? 'bg-teal-600 text-white shadow-sm'
                          : campus === 'NEC'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-brand-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{campus === 'ALL' ? 'All Campuses' : campus}</span>
                    {selectedCollege === campus && <Check className="w-3 h-3 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Deletion Mode: Permanent Delete vs Deactivate */}
            <div className="space-y-1.5">
              <span className="block text-xs font-black text-slate-800 dark:text-slate-200">
                Deletion Execution Mode
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsSoftDelete(false)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    !isSoftDelete
                      ? 'bg-rose-500/10 border-rose-500 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/20 shadow-xs'
                      : 'bg-slate-50 dark:bg-navy-900/60 border-slate-200 dark:border-navy-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-navy-700'
                  }`}
                >
                  <div className={`mt-0.5 p-1 rounded-full shrink-0 ${!isSoftDelete ? 'bg-rose-600 text-white' : 'border border-slate-400 text-transparent'}`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-black text-slate-900 dark:text-white">Permanent Delete</p>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400">
                        Irreversible
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Completely purges student roster, statistics, submissions & contest logs.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSoftDelete(true)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    isSoftDelete
                      ? 'bg-amber-500/10 border-amber-500 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/20 shadow-xs'
                      : 'bg-slate-50 dark:bg-navy-900/60 border-slate-200 dark:border-navy-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-navy-700'
                  }`}
                >
                  <div className={`mt-0.5 p-1 rounded-full shrink-0 ${isSoftDelete ? 'bg-amber-600 text-white' : 'border border-slate-400 text-transparent'}`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-black text-slate-900 dark:text-white">Deactivate Only</p>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Reversible
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      Hides records from active leaderboards while preserving all database data.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Section 2: Live Cohort Audit & Preview */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-navy-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-500/20 w-fit">
                <Users className="w-3.5 h-3.5" />
                Live Cohort Preview
              </span>
              {isLoadingPreview && (
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Auditing records...
                </span>
              )}
            </div>

            {!hasSpecificFilter ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">Select Criteria to Target Records</p>
                  <p className="text-amber-700 dark:text-amber-400 text-[11px] mt-0.5">
                    To prevent accidental bulk deletion, select at least a specific <strong>Department</strong> (e.g. CSE(CS)) or <strong>Academic Year</strong> (e.g. 2nd Year) above.
                  </p>
                </div>
              </div>
            ) : isLoadingPreview ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800">
                <Loader2 className="w-6 h-6 animate-spin text-rose-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Scanning student database for matching cohort records...
                </p>
              </div>
            ) : preview && preview.count > 0 ? (
              <div className="space-y-3">
                {/* Count summary banner */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-rose-50/50 to-orange-50 dark:from-rose-950/40 dark:via-rose-950/20 dark:to-navy-900 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest block">
                      Target Students Found
                    </span>
                    <p className="text-2xl font-black text-rose-700 dark:text-rose-300 leading-tight">
                      {preview.count} <span className="text-xs font-bold font-sans text-rose-600/80 dark:text-rose-400/80">students targeted</span>
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-200 text-[10px] font-black border border-slate-200 dark:border-navy-700">
                        {preview.department_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-200 text-[10px] font-black border border-slate-200 dark:border-navy-700">
                        {preview.year_level}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-navy-950 text-slate-800 dark:text-slate-200 text-[10px] font-black border border-slate-200 dark:border-navy-700">
                        {preview.college === 'ALL' ? 'All Campuses' : preview.college}
                      </span>
                    </div>
                  </div>
                  {preview.protected_count > 0 && (
                    <div className="text-right shrink-0">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{preview.protected_count} admin safe</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Sample students list */}
                {preview.sample_students.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-navy-800 overflow-hidden text-xs bg-white dark:bg-navy-900 shadow-xs">
                    <div className="bg-slate-100/80 dark:bg-navy-950 px-3.5 py-2 font-bold text-slate-700 dark:text-slate-300 text-[11px] flex items-center justify-between border-b border-slate-200/80 dark:border-navy-800">
                      <span>Roster Sample Preview ({preview.sample_students.length} of {preview.count} records)</span>
                      <span className="text-[10px] font-mono text-slate-500">Live DB</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-navy-800/80 max-h-44 overflow-y-auto custom-scrollbar">
                      {preview.sample_students.map((st) => (
                        <div key={st.id} className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-slate-900 dark:text-white truncate text-xs">
                              {st.name}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                              {st.reg_no}
                            </p>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {st.department}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300">
                              Yr {st.year_level}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-center text-slate-500 dark:text-slate-400 text-xs py-3.5 sm:py-4">
                <Users className="w-7 h-7 opacity-40 mx-auto mb-1 text-slate-400" />
                <p className="font-bold text-slate-700 dark:text-slate-300">No Matching Students Found</p>
                <p className="text-[11px] mt-0.5 max-w-sm mx-auto leading-relaxed">
                  No records match Department ({selectedDept}) and Academic Year ({selectedYear}).
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Safety Confirmation Checkbox */}
          {preview && preview.count > 0 && (
            <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900/60 space-y-3">
              <div className="flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="font-bold leading-tight">
                  {isSoftDelete
                    ? `Are you sure you want to deactivate ${preview.count} students? They will no longer appear on active leaderboards.`
                    : `Permanent Warning: This will permanently delete ${preview.count} student records, their statistics, submissions, and contest logs. This action cannot be undone.`}
                </p>
              </div>

              <label className="flex items-center gap-3 text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 border-rose-300 focus:ring-rose-500 cursor-pointer"
                />
                <span>
                  I confirm and authorize {isSoftDelete ? 'deactivating' : 'permanently deleting'} these {preview.count} student records.
                </span>
              </label>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 sm:py-4 border-t border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/90 backdrop-blur-md flex items-center justify-end gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="flex-1 sm:flex-initial px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl transition-all cursor-pointer min-h-[42px] text-center"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              isDeleting ||
              isLoadingPreview ||
              !hasSpecificFilter ||
              !preview ||
              preview.count <= 0 ||
              !confirmChecked
            }
            onClick={handleExecuteDelete}
            className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-rose-600 via-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:from-rose-700 active:to-red-700 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-navy-800 dark:disabled:to-navy-800 disabled:text-slate-500 dark:disabled:text-slate-500 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-600/25 disabled:shadow-none flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{isSoftDelete ? 'Deactivating...' : 'Deleting...'}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {preview && preview.count > 0
                    ? isSoftDelete
                      ? `Deactivate ${preview.count} Students`
                      : `Permanently Delete ${preview.count} Students`
                    : 'Delete Students'}
                </span>
              </>
            )}
          </button>
        </div>

      </div>
    </GlobalModalBackdrop>
  );
};