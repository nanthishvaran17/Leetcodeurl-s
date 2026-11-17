import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X, Loader2, Building2, Calendar, School, Check, Users, ShieldAlert, AlertCircle } from 'lucide-react';
import { useScrollLock } from '../hooks/useScrollLock';
import api from '../services/api';
import { useNotification } from '../context/NotificationContext';
import { Department } from '../context/DepartmentContext';
import { GlobalFilter, GlobalFilterOption } from './GlobalFilter';

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

export const BatchDeleteModal: React.FC<BatchDeleteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  departments,
  initialDepartment = 'ALL',
  initialAcademicYear = 'ALL',
  initialCollege = 'ALL'
}) => {
  const { notify } = useNotification();
  const [selectedDept, setSelectedDept] = useState<string>(initialDepartment || 'ALL');
  const [selectedYear, setSelectedYear] = useState<string>(initialAcademicYear || 'ALL');
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

  useScrollLock(isOpen);

  // Sync initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDept(initialDepartment || 'ALL');
      setSelectedYear(initialAcademicYear || 'ALL');
      setSelectedCollege((initialCollege as 'ALL' | 'NEC' | 'NCT') || 'ALL');
      setConfirmChecked(false);
      setErrorMsg(null);
    }
  }, [isOpen, initialDepartment, initialAcademicYear, initialCollege]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  // Dept Options for GlobalFilter
  const deptOptions = useMemo<GlobalFilterOption[]>(() => {
    const list: GlobalFilterOption[] = [
      { value: 'ALL', label: 'All Departments', pillText: 'ALL' }
    ];
    departments.forEach((d) => {
      list.push({
        value: d.code,
        label: `${d.code} - ${d.name}`,
        pillText: d.code
      });
    });
    return list;
  }, [departments]);

  // Academic Year Options
  const yearOptions = useMemo<GlobalFilterOption[]>(() => [
    { value: 'ALL', label: 'All Academic Years', pillText: 'ALL' },
    { value: '1st Year', label: '1st Year (I)', pillText: 'Y1' },
    { value: '2nd Year', label: '2nd Year (II)', pillText: 'Y2' },
    { value: '3rd Year', label: '3rd Year (III)', pillText: 'Y3' },
    { value: '4th Year', label: '4th Year (IV)', pillText: 'Y4' },
  ], []);

  const hasSpecificFilter = selectedDept !== 'ALL' || selectedYear !== 'ALL';

  // Fetch Preview whenever selections change
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

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-overlay-responsive animate-modal-backdrop select-none z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm fixed inset-0 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div className="w-full max-w-xl my-auto bg-white dark:bg-navy-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-navy-800 text-slate-900 dark:text-slate-100 flex flex-col relative overflow-hidden animate-modal-content">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-rose-950 via-slate-900 to-navy-950 text-white flex items-center justify-between border-b border-rose-900/40 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 shadow-inner">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-white tracking-tight truncate uppercase flex items-center gap-2">
                <span>Delete by Dept & Year</span>
                <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-mono border border-rose-500/30">
                  BATCH
                </span>
              </h3>
              <p className="text-xs text-rose-200/80 font-medium truncate">
                Target & delete student cohorts by Department and Academic Year
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-rose-600/80 active:scale-95 transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0 ml-2 disabled:opacity-30"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">

          {/* Criteria Selection Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-rose-200 dark:border-rose-500/20 w-fit">
                <Building2 className="w-3.5 h-3.5" />
                TARGET CRITERIA SELECTION
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Choose Department & Year
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Department Dropdown */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-brand-500" />
                  <span>Department</span>
                </label>
                <GlobalFilter
                  value={selectedDept}
                  onChange={(val) => setSelectedDept(val)}
                  options={deptOptions}
                  dropdownWidth="w-full"
                  placeholder="Select Department"
                />
              </div>

              {/* Academic Year Dropdown */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Academic Year</span>
                </label>
                <GlobalFilter
                  value={selectedYear}
                  onChange={(val) => setSelectedYear(val)}
                  options={yearOptions}
                  dropdownWidth="w-full"
                  placeholder="Select Academic Year"
                />
              </div>
            </div>

            {/* Campus / College Segmented Control */}
            <div>
              <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-teal-500" />
                <span>Campus / College (Optional)</span>
              </label>
              <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-navy-900 p-1 rounded-xl border border-slate-200 dark:border-navy-800">
                {(['ALL', 'NEC', 'NCT'] as const).map((campus) => (
                  <button
                    key={campus}
                    type="button"
                    onClick={() => setSelectedCollege(campus)}
                    className={`py-1.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      selectedCollege === campus
                        ? campus === 'NCT'
                          ? 'bg-teal-600 text-white shadow-xs'
                          : campus === 'NEC'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {campus === 'ALL' ? 'All Campuses' : campus}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode: Hard Delete vs Soft Deactivate */}
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                Deletion Mode:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsSoftDelete(false)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    !isSoftDelete
                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 shadow-xs'
                      : 'bg-white dark:bg-navy-950/40 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className={`mt-0.5 p-1 rounded-full ${!isSoftDelete ? 'bg-rose-600 text-white' : 'border border-slate-400 text-transparent'}`}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <div>
                    <p className="text-xs font-black">Permanent Delete</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Completely removes roster & records
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSoftDelete(true)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                    isSoftDelete
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 shadow-xs'
                      : 'bg-white dark:bg-navy-950/40 border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <div className={`mt-0.5 p-1 rounded-full ${isSoftDelete ? 'bg-amber-600 text-white' : 'border border-slate-400 text-transparent'}`}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <div>
                    <p className="text-xs font-black">Deactivate Only</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      Preserves data, marks inactive
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview Section */}
          <div className="space-y-3 pt-1 border-t border-slate-200 dark:border-navy-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-500/20 w-fit">
                <Users className="w-3.5 h-3.5" />
                LIVE COHORT PREVIEW
              </span>
              {isLoadingPreview && (
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Checking students...
                </span>
              )}
            </div>

            {!hasSpecificFilter ? (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">Specific Criteria Required</p>
                  <p className="text-amber-700 dark:text-amber-400 text-[11px] mt-0.5">
                    To prevent accidental mass deletion, select at least a specific <strong>Department</strong> (e.g. CSE) or <strong>Academic Year</strong> (e.g. 3rd Year).
                  </p>
                </div>
              </div>
            ) : isLoadingPreview ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-800">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Scanning student directory for matching records...
                </p>
              </div>
            ) : preview && preview.count > 0 ? (
              <div className="space-y-3">
                {/* Count summary banner */}
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                      Target Students Found
                    </span>
                    <p className="text-xl font-black text-rose-700 dark:text-rose-300">
                      {preview.count} <span className="text-xs font-bold font-sans">students</span>
                    </p>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                      Scope: <strong className="text-slate-900 dark:text-white">{preview.department_name}</strong> • <strong className="text-slate-900 dark:text-white">{preview.year_level}</strong> • Campus: <strong className="text-slate-900 dark:text-white">{preview.college}</strong>
                    </p>
                  </div>
                  {preview.protected_count > 0 && (
                    <span className="px-2 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                      {preview.protected_count} admin safe
                    </span>
                  )}
                </div>

                {/* Sample students list */}
                {preview.sample_students.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-navy-800 overflow-hidden text-xs">
                    <div className="bg-slate-100 dark:bg-navy-900 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 text-[11px] flex items-center justify-between">
                      <span>Sample Records ({preview.sample_students.length} of {preview.count})</span>
                      <span className="text-[10px] text-slate-500">Preview</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-navy-800 max-h-40 overflow-y-auto">
                      {preview.sample_students.map((st) => (
                        <div key={st.id} className="px-3 py-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-900/50">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {st.name}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {st.reg_no}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 border border-brand-200 dark:border-brand-800 mr-1.5">
                              {st.department}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300">
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
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-center text-slate-500 dark:text-slate-400 text-xs py-6">
                <Users className="w-8 h-8 opacity-40 mx-auto mb-2 text-slate-400" />
                <p className="font-bold text-slate-700 dark:text-slate-300">No Students Found</p>
                <p className="text-[11px] mt-0.5">
                  No student records match the selected Department ({selectedDept}) and Academic Year ({selectedYear}).
                </p>
              </div>
            )}
          </div>

          {/* Safety Confirmation Checkbox */}
          {preview && preview.count > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900/60 space-y-2.5">
              <div className="flex items-start gap-2 text-rose-800 dark:text-rose-200 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="font-bold leading-tight">
                  {isSoftDelete
                    ? `Are you sure you want to deactivate ${preview.count} students? They will no longer appear on active leaderboards.`
                    : `Permanent Warning: This will permanently delete ${preview.count} student records, their statistics, submissions, and contest logs. This cannot be undone.`}
                </p>
              </div>

              <label className="flex items-center gap-2.5 text-xs font-black text-slate-900 dark:text-white cursor-pointer select-none pt-1">
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
            <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950/80 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-navy-900 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl transition-all cursor-pointer min-h-[42px]"
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
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-40 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-rose-600/25 flex items-center justify-center gap-2 cursor-pointer min-h-[42px]"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{isSoftDelete ? 'Deactivating...' : 'Deleting...'}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>
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
    </div>,
    document.body
  );
};
