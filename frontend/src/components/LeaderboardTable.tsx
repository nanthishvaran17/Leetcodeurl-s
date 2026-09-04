import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';

import { studentLiveStore } from '../stores/studentLiveStore';
import { FastStudentRow } from './FastStudentRow';
import { useFilteredStudents, useFilters } from '../context/FilterContext';

import { ExternalLink, Trophy, RefreshCw, Wifi, Trash2, AlertCircle, Eye, Edit3, ShieldAlert, X, Clock, Flame, Award, CheckCircle2, TrendingUp, Sparkles, BookOpen, Star } from 'lucide-react';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import api from '../services/api';
import { StudentEditOverlay } from './StudentEditOverlay';

function parseUtcTime(ts?: string): number {
  if (!ts) return Date.now();
  let str = ts.trim();
  if (!str.endsWith('Z') && !str.includes('+')) {
    str += 'Z';
  }
  const time = new Date(str).getTime();
  return isNaN(time) ? Date.now() : time;
}

function getSyncState(syncStatus?: string, lastVerifiedAt?: string): 'pending' | 'syncing' | 'fetching' | 'verified' | 'failed' | 'mismatch' | 'stale' | 'invalid_profile' | 'pending_username' | 'url_invalid' | 'profile_not_found' | 'username_mismatch' {
  if (!syncStatus) return 'pending';
  const s = syncStatus.toLowerCase();
  if (s === 'fetching' || s === 'syncing') return 'fetching';
  if (s === 'url_invalid' || s === 'invalid link' || s === 'missing link') return 'url_invalid';
  if (s === 'username_mismatch' || s === 'identity_mismatch') return 'username_mismatch';
  if (s === 'profile_not_found' || s === 'invalid_profile' || s === 'invalid_username' || s === '404_not_found') return 'profile_not_found';
  if (s === 'pending_username') return 'pending_username';
  if (s === 'success' || s === 'ok' || s === 'verified' || s === 'stale') {
    if (lastVerifiedAt) {
      const age = Date.now() - parseUtcTime(lastVerifiedAt);
      if (age > 24 * 60 * 60 * 1000) return 'stale';
    }
    return 'verified';
  }
  if (s === 'pending' || s === 'not_started') return 'pending';
  if (s === 'mismatch' || s === 'data_mismatch') return 'mismatch';
  return 'failed';
}

export interface StudentData {
  id: string | number;
  reg_no: string;
  name: string;
  version?: number;
  email?: string;
  institutional_email?: string;
  email_status?: string;
  batch?: string;
  total_solved?: number | null;
  easy_solved?: number | null;
  medium_solved?: number | null;
  hard_solved?: number | null;
  department_id?: number;
  department?: { id?: number; name: string; code: string };
  year_level: string;
  section?: { name: string };
  leetcode_url?: string;
  username?: string;
  canonical_username?: string;
  profile_url?: string;
  real_name?: string;
  avatar_url?: string;
  sync_state?: string;
  stats?: {
    total_solved: number | null;
    easy_solved?: number | null;
    medium_solved?: number | null;
    hard_solved?: number | null;
    contest_rating?: number | null;
    contest_global_ranking?: number | null;
    public_profile_ranking?: number | null;
    recent_contest_name?: string;
    recent_contest_score?: string;
    status?: string;
    sync_status?: string;
    source?: string | null;
    last_verified_at?: string | null;
  };
  college_rank?: number;
  dept_rank?: number;
  year_rank?: number;
  section_rank?: number;
  weekly_progress?: number;
  streak_count?: number;
  longest_streak?: number;
  total_active_days?: number;
  consistency_score?: number;
  contest_status?: string;
  contest_name?: string;
  contest_number?: number;
  badge_list?: string[];
  public_contest_result?: {
    contest_name?: string;
    contest_number?: number;
    contest_date?: string;
    questions_solved?: number;
    questions_total?: number;
    score_display?: string;
    contest_rank?: number | null;
    contest_rating?: number | null;
    top_percentage?: number | null;
    status?: string;
    fetched_at?: string | null;
  };
  virtual_contest_result?: {
    contest_name?: string;
    contest_number?: number;
    contest_date?: string;
    questions_solved?: number;
    questions_total?: number;
    score_display?: string;
    contest_rank?: number | null;
    contest_rating?: number | null;
    top_percentage?: number | null;
    status?: string;
    fetched_at?: string | null;
  };
  overall_participation_mode?: string;
}

interface LeaderboardTableProps {
  students: StudentData[];
  loading?: boolean;
  onSelectStudent?: (student: StudentData) => void;
  onRefreshStudent?: (studentId?: number) => void;
  onDeleteStudent?: (student: StudentData) => void;
  onBulkDeleteStudents?: (studentIds: number[]) => void;
  onUpdateStudent?: (updated: StudentData) => void;
  serverTotalCount?: number;
  serverPage?: number;
  serverPageSize?: number;
  onServerPageChange?: (page: number, size: number) => void;
}

import { useNotification } from '../context/NotificationContext';

const LeaderboardTableComponent: React.FC<LeaderboardTableProps> = ({
  students,
  loading = false,
  onSelectStudent,
  onRefreshStudent,
  onDeleteStudent,
  onBulkDeleteStudents,
  onUpdateStudent,
  serverTotalCount,
  serverPage,
  serverPageSize,
  onServerPageChange
}) => {
  // Use the WebSocket hook (which now manages the external store)
  const { isConnected } = useLiveLeaderboard();
  const globalFilteredStudents = useFilteredStudents();
  const { isFilteringActive } = useFilters();

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'solved', direction: 'desc' });

  // Use explicit `students` prop if provided by parent component (e.g. DepartmentDashboard), otherwise fallback to global FilterContext
  const effectiveStudents = useMemo(() => {
    return (students && Array.isArray(students)) ? students : globalFilteredStudents;
  }, [students, globalFilteredStudents]);

  // Apply Sort on top of effective Student List
  const sortedStudents = useMemo(() => {
    const list = [...effectiveStudents];
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      
      if (sortConfig.key === 'solved') {
        valA = a.stats?.total_solved || 0;
        valB = b.stats?.total_solved || 0;
      } else if (sortConfig.key === 'recent_contest') {
        valA = a.public_contest_result?.questions_solved || a.virtual_contest_result?.questions_solved || 0;
        valB = b.public_contest_result?.questions_solved || b.virtual_contest_result?.questions_solved || 0;
      } else if (sortConfig.key === 'contest_rating') {
        valA = a.stats?.contest_rating || 0;
        valB = b.stats?.contest_rating || 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [effectiveStudents, sortConfig]);

  const { notify, confirmAction } = useNotification();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [viewingStudent, setViewingStudent] = useState<StudentData | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<StudentData | null>(null);
  const [editName, setEditName] = useState('');
  const [editDeptId, setEditDeptId] = useState<number>(1);
  const [editYearLevel, setEditYearLevel] = useState('III');
  const [editLeetCodeUrl, setEditLeetCodeUrl] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalTopY, setModalTopY] = useState<number | null>(null);

  const isServerPaginated = serverTotalCount !== undefined && !isFilteringActive;
  
  // Ultra-Fast Paginated Table Viewport Rendering
  const [currentPage, setCurrentPage] = useState(serverPage || 1);
  const [pageSize, setPageSize] = useState<'25' | '50' | '100' | 'All'>(serverPageSize ? String(serverPageSize) as any : '50');

  useEffect(() => {
    if (isServerPaginated) {
      if (serverPage) setCurrentPage(serverPage);
      if (serverPageSize) setPageSize(String(serverPageSize) as any);
    } else {
      // If filtering is active or data is local, ensure we're on a valid page
      setCurrentPage(1);
    }
  }, [isServerPaginated, serverPage, serverPageSize, isFilteringActive]);

  const totalPages = useMemo(() => {
    if (isServerPaginated) {
      if (pageSize === 'All') return 1;
      return Math.ceil((serverTotalCount || 0) / Number(pageSize)) || 1;
    }
    if (pageSize === 'All') return 1;
    return Math.ceil(sortedStudents.length / Number(pageSize)) || 1;
  }, [sortedStudents.length, pageSize, isServerPaginated, serverTotalCount]);

  // Ensure current page is valid when total pages change
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedStudents = useMemo(() => {
    if (isServerPaginated) return effectiveStudents; // The server already paginated them!
    
    if (pageSize === 'All') return sortedStudents;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return sortedStudents.slice(start, start + size);
  }, [sortedStudents, effectiveStudents, currentPage, pageSize, isServerPaginated]);

  const handlePageChange = (newPage: number) => {
    if (isServerPaginated && onServerPageChange) {
      onServerPageChange(newPage, Number(pageSize));
    } else {
      setCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newSize: '25' | '50' | '100' | 'All') => {
    setPageSize(newSize);
    if (isServerPaginated && onServerPageChange) {
      onServerPageChange(1, newSize === 'All' ? 4500 : Number(newSize));
    } else {
      setCurrentPage(1);
    }
  };

  const calculateTargetTopY = (e?: React.MouseEvent) => {
    if (!e) return null;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const modalEstHeight = 500;
    let targetTop = rect.top - 20;
    if (targetTop + modalEstHeight > vh - 20) {
      targetTop = Math.max(70, vh - modalEstHeight - 20);
    }
    if (targetTop < 70) targetTop = 70;
    return targetTop;
  };

  const handleOpenProfile = (student: StudentData, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (onSelectStudent) {
      onSelectStudent(student);
    } else {
      setModalTopY(calculateTargetTopY(e));
      setViewingStudent(student);
    }
  };

  const handleOpenEdit = (st: StudentData, e?: React.MouseEvent) => {
    setModalTopY(calculateTargetTopY(e));
    setEditingStudent(st);
    setEditName(st.name);
    setEditDeptId(st.department_id || 1);
    setEditYearLevel(st.year_level || 'III');
    setEditLeetCodeUrl(st.leetcode_url || '');
    setEditUsername(st.username || '');
  };

  const handleOpenDelete = (st: StudentData, e?: React.MouseEvent) => {
    setModalTopY(calculateTargetTopY(e));
    setDeletingStudent(st);
  };

  // Body scroll lock & layout shift prevention when any modal is open
  // Body scroll lock & layout shift prevention when any modal is open
  useEffect(() => {
    const isAnyModalOpen = Boolean(viewingStudent || editingStudent || deletingStudent);
    if (isAnyModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setViewingStudent(null);
          setEditingStudent(null);
          setDeletingStudent(null);
        }
      };
      window.addEventListener('keydown', onKey);

      return () => {
        document.body.style.overflow = prevOverflow || '';
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [viewingStudent, editingStudent, deletingStudent]);

  const toggleStudent = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === sortedStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sortedStudents.map(s => Number(s.id)));
    }
  };

  const getRankBadge = (rank?: number) => {
    if (!rank) return null;
    if (rank === 1) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">#1</span>;
    if (rank === 2) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300">#2</span>;
    if (rank === 3) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-800/20 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-600/30">#3</span>;
    return <span className="text-xs font-semibold text-slate-500">#{rank}</span>;
  };

  const handleTriggerBulkDelete = async () => {
    if (onBulkDeleteStudents) {
      onBulkDeleteStudents(selectedIds);
      setSelectedIds([]);
    } else {
      const confirmed = await confirmAction({
        title: 'Permanently Delete Selected Students?',
        message: `Are you sure you want to permanently delete ${selectedIds.length} selected student records? This action cannot be undone.`,
        confirmLabel: `Delete ${selectedIds.length} Records`,
        category: 'LEADERBOARD',
        variant: 'danger',
      });
      if (!confirmed) return;

      try {
        await api.post('/students/bulk-delete', { student_ids: selectedIds, soft_delete: false });
        notify.success('Students Deleted', `Successfully deleted ${selectedIds.length} student records.`, { category: 'LEADERBOARD' });
        setSelectedIds([]);
        if (onRefreshStudent) onRefreshStudent(0);
      } catch (err: any) {
        notify.error('Bulk Delete Failed', err.response?.data?.detail || "Failed to bulk delete student records.", { category: 'LEADERBOARD' });
      }
    }
  };

  const handleTriggerBulkDeactivate = async () => {
    const confirmed = await confirmAction({
      title: 'Deactivate Selected Students?',
      message: `Are you sure you want to deactivate ${selectedIds.length} selected student records? They can be re-activated later from Student Master.`,
      confirmLabel: `Deactivate ${selectedIds.length} Students`,
      category: 'LEADERBOARD',
      variant: 'warning',
    });
    if (!confirmed) return;

    try {
      await api.post('/students/bulk-delete', { student_ids: selectedIds, soft_delete: true });
      notify.success('Students Deactivated', `Successfully deactivated ${selectedIds.length} student records.`, { category: 'LEADERBOARD' });
      setSelectedIds([]);
      if (onRefreshStudent) onRefreshStudent(0);
    } catch (err: any) {
      notify.error('Bulk Deactivate Failed', err.response?.data?.detail || "Failed to bulk deactivate student records.", { category: 'LEADERBOARD' });
    }
  };




  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    setIsSaving(true);
    try {
      const res = await api.patch(`/students/${editingStudent.id}`, {
        name: editName.trim(),
        department_id: editDeptId,
        year_level: editYearLevel,
        leetcode_url: editLeetCodeUrl.trim() || undefined,
        username: editUsername.trim() || undefined,
        version: editingStudent.version
      });
      notify.success('Profile Updated', `Student record for ${editName} updated successfully.`, { category: 'STUDENT EDIT' });
      if (onUpdateStudent) onUpdateStudent(res.data);
      if (onRefreshStudent) onRefreshStudent(Number(editingStudent.id));
      setEditingStudent(null);
    } catch (err: any) {
      notify.error('Update Failed', err?.response?.data?.detail || err.message || 'Failed to save student profile.', { category: 'STUDENT EDIT' });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (editingStudent || deletingStudent) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (!isSaving && !isDeleting) {
            setEditingStudent(null);
            setDeletingStudent(null);
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow || 'unset';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [editingStudent, deletingStudent, isSaving, isDeleting]);

  const handleConfirmSoftDelete = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    try {
      await api.delete(`/students/${deletingStudent.id}?soft_delete=true`);
      notify.success('Student Deactivated', `Student record for ${deletingStudent.name} deactivated.`, { category: 'STUDENT DEACTIVATION' });
      if (onDeleteStudent) onDeleteStudent(deletingStudent);
      setDeletingStudent(null);
      if (onRefreshStudent) onRefreshStudent(Number(deletingStudent.id));
    } catch (err: any) {
      notify.error('Deactivation Failed', err?.response?.data?.detail || err.message || 'Failed to deactivate student.', { category: 'STUDENT DEACTIVATION' });
    } finally {
      setIsDeleting(false);
    }
  };





  return (
    <div className="w-full space-y-2">
      {/* Bulk Delete & Deactivate Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl mb-3 text-rose-600 dark:text-rose-300">
          <div className="flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-rose-500 animate-bounce" />
            <span className="font-black text-xs md:text-sm">
              {selectedIds.length} Student{selectedIds.length > 1 ? 's' : ''} Selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={handleTriggerBulkDeactivate}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center space-x-1.5 shadow-md transition-transform transform hover:scale-105"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Deactivate Selected ({selectedIds.length})</span>
            </button>
            <button
              onClick={handleTriggerBulkDelete}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center space-x-1.5 shadow-lg transition-transform transform hover:scale-105"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Permanently ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}


      <div className="responsive-table-container w-full min-w-0max-w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm bg-white dark:bg-navy-950 flex flex-col">
        {/* Table Header Wrapper (Sticky) */}
        <div className="flex bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-navy-800 uppercase tracking-widest text-[10px] w-[1450px] min-w-full items-center">
          <div className="flex-none w-10 py-3 px-3 text-center">
             <input type="checkbox" checked={sortedStudents.length > 0 && selectedIds.length === sortedStudents.length} onChange={toggleAll} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer" />
          </div>
          <div className="flex-none w-24 py-3 px-3 text-left">Rank</div>
          <div className="flex-none w-32 py-3 px-3 text-left">Register No</div>
          <div className="flex-none w-72 py-3 px-3 text-left">Student</div>
          <div className="flex-none w-28 py-3 px-3 text-left">Dept / Year</div>
          <div className="flex-none w-40 py-3 px-3 text-left">LeetCode Handle</div>
          <div className="flex-none w-24 py-3 px-3 text-center">Solved</div>
          <div className="flex-none w-32 py-3 px-3 text-center">Contest</div>
          <div className="flex-none w-24 py-3 px-3 text-center">Rating</div>
          <div className="flex-none w-28 py-3 px-3 text-center">Contest Rank</div>
          <div className="flex-none w-28 py-3 px-3 text-center">Profile Rank</div>
          <div className="flex-none w-32 py-3 px-3 text-center">Actions</div>
        </div>
        
        {/* Virtualized Body */}
        <div className="flex-1 w-[1450px] min-w-full" style={{ height: '600px' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-2 h-full py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">Loading real institutional student records...</span>
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center space-y-2 h-full py-12">
              <AlertCircle className="w-6 h-6 text-amber-500" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">No students match the selected filters.</span>
            </div>
          ) : (
            <div className="flex flex-col space-y-1 overflow-y-auto" style={{ height: '600px' }}>
              {paginatedStudents.map((student, idx) => (
                <FastStudentRow
                  key={student.id}
                  studentId={student.id.toString()}
                  index={idx + (pageSize !== 'All' ? (currentPage - 1) * Number(pageSize) : 0)}
                  style={{}}
                  isSelected={selectedIds.includes(Number(student.id))}
                  toggleStudent={(id: number) => toggleStudent(id)}
                  onView={(s: any) => setViewingStudent(s)}
                  onEdit={(s: any) => setEditingStudent(s)}
                  onRefresh={(id: number) => onRefreshStudent?.(id)}
                  onDelete={(s: any, e: any) => handleOpenDelete(s, e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sleek Ultra-Fast Pagination Bar */}
      {effectiveStudents.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 mt-3 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
          <div className="flex items-center space-x-2">
            <span>Showing <strong className="text-slate-900 dark:text-white font-extrabold">{pageSize === 'All' ? 1 : (currentPage - 1) * Number(pageSize) + 1}</strong> to <strong className="text-slate-900 dark:text-white font-extrabold">{pageSize === 'All' ? effectiveStudents.length : Math.min(currentPage * Number(pageSize), effectiveStudents.length)}</strong> of <strong className="text-brand-600 dark:text-brand-400 font-extrabold">{effectiveStudents.length}</strong> solvers</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Rows Per Page Selector */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-400">Per Page:</span>
              {(['25', '50', '100', 'All'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    pageSize === size
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            {/* Pagination Controls */}
            {pageSize !== 'All' && totalPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-40 font-bold"
                  title="First Page"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-40 font-bold"
                >
                  ‹ Prev
                </button>
                <span className="px-2 font-mono font-bold text-slate-900 dark:text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-40 font-bold"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-40 font-bold"
                  title="Last Page"
                >
                  »
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Viewport-Centered Sticky Floating Student Edit Overlay */}
      <StudentEditOverlay
        isOpen={Boolean(editingStudent)}
        student={editingStudent}
        onClose={() => setEditingStudent(null)}
        onSaveSuccess={(updated) => {
          // Instead of forcing a full LeetCode profile sync (onRefreshStudent) which takes 2-3s,
          // the backend automatically queues a background sync. We just update the local cache immediately.
          queryClient.setQueriesData({ queryKey: ['students'] }, (oldData: any) => {
            if (!oldData || !oldData.items) return oldData;
            return {
              ...oldData,
              items: oldData.items.map((s: any) => s.id === updated.id ? { ...s, ...updated } : s)
            };
          });
          
          if (onUpdateStudent) {
            onUpdateStudent(updated);
          }
          setEditingStudent(null);
        }}
      />

      {/* Viewport-Centered Student Delete Confirmation Modal */}
      {deletingStudent && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Deactivate student record for ${deletingStudent.name}`}
          className="modal-overlay-responsive animate-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) setDeletingStudent(null);
          }}
        >
          <div
            className="modal-container-responsive max-w-md bg-white dark:bg-navy-950 rounded-3xl shadow-lg border border-rose-200 dark:border-rose-900/50 p-6 space-y-4 animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Deactivate Student?</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Are you sure you want to deactivate <strong className="text-slate-900 dark:text-white">{deletingStudent.name}</strong> ({deletingStudent.reg_no})?
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-900/40">
                Soft Delete: Record will be hidden from public leaderboard but preserved in audit logs.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSoftDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deactivating...' : 'Confirm Deactivate'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ================================================================
          STUDENT PROFILE MODAL — Portal-Mounted Viewport-Safe Dialog
          ================================================================ */}
      {viewingStudent && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Student profile for ${viewingStudent.name}`}
          className="modal-overlay-responsive animate-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingStudent(null); }}
        >
          {/* Modal panel — centered with safe margins from top & bottom */}
          <div
            className="modal-container-responsive bg-white dark:bg-navy-950 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── A. STICKY HEADER ─────────────────────────────────────── */}
            <div className="shrink-0 p-5 sm:p-6 bg-gradient-to-r from-brand-900 via-indigo-900 to-navy-950 text-white flex items-start justify-between relative overflow-hidden">

              {/* Identity */}
              <div className="flex items-center space-x-3 sm:space-x-4 z-10 min-w-0 flex-1 pr-3">
                {/* Avatar */}
                <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-lg border border-white/20">
                  {viewingStudent.name ? viewingStudent.name.charAt(0).toUpperCase() : 'S'}
                </div>

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-base sm:text-xl font-black text-white leading-tight truncate">
                      {viewingStudent.name}
                    </h2>
                    {viewingStudent.college_rank && (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-amber-950 shadow-sm">
                        Rank #{viewingStudent.college_rank}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-brand-200 font-mono font-bold truncate">
                    {viewingStudent.reg_no}
                    {' • '}
                    <span className="text-white font-bold">
                      {viewingStudent.department?.name || viewingStudent.department?.code}
                    </span>
                    {' • '}
                    {viewingStudent.year_level} Year
                  </p>
                </div>
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setViewingStudent(null)}
                aria-label="Close student profile"
                className="shrink-0 z-10 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500 text-white transition-all font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <X className="w-4 h-4" />
                <span>Close</span>
              </button>
            </div>

            {/* ── B. SCROLLABLE CONTENT ─────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">

              {/* LeetCode Handle */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-brand-50/60 dark:bg-brand-950/30 border border-brand-200/60 dark:border-brand-800/40">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="shrink-0 p-2 rounded-xl bg-amber-500 text-white font-black text-xs">LC</div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">LeetCode Username</span>
                    <p className="font-mono font-bold text-sm text-brand-600 dark:text-brand-400 truncate">
                      {viewingStudent.username || viewingStudent.canonical_username || 'Not Linked'}
                    </p>
                  </div>
                </div>
                {viewingStudent.leetcode_url && (
                  <a
                    href={viewingStudent.leetcode_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    <span>View on LeetCode</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Problem Stats: Total + Easy + Medium + Hard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-center flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total Solved</span>
                  <span className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                    {viewingStudent.stats?.total_solved ?? (viewingStudent.total_solved ?? '—')}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-center">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Easy</span>
                  <span className="text-2xl font-black text-emerald-700 dark:text-emerald-300 block mt-1">
                    {viewingStudent.stats?.easy_solved ?? (viewingStudent.easy_solved ?? '—')}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-center">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Medium</span>
                  <span className="text-2xl font-black text-amber-700 dark:text-amber-300 block mt-1">
                    {viewingStudent.stats?.medium_solved ?? (viewingStudent.medium_solved ?? '—')}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-center">
                  <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Hard</span>
                  <span className="text-2xl font-black text-rose-700 dark:text-rose-300 block mt-1">
                    {viewingStudent.stats?.hard_solved ?? (viewingStudent.hard_solved ?? '—')}
                  </span>
                </div>
              </div>

              {/* Contest Performance */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-brand-50/60 dark:from-navy-950 dark:via-indigo-950/30 dark:to-navy-950 border border-indigo-200/60 dark:border-indigo-800/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {viewingStudent.contest_name || viewingStudent.public_contest_result?.contest_name || viewingStudent.stats?.recent_contest_name || 'Weekly Contest'}
                    </h4>
                  </div>
                  <span className="shrink-0 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400/30">
                    {viewingStudent.public_contest_result?.status === 'PUBLIC_ATTENDED' || viewingStudent.public_contest_result?.status === 'ATTENDED'
                      ? 'Public Attended'
                      : viewingStudent.public_contest_result?.status === 'VIRTUAL_ATTENDED'
                        ? 'Virtual Attended'
                        : viewingStudent.public_contest_result?.score_display && !viewingStudent.public_contest_result.score_display.includes('Not Attended')
                          ? 'Public Attended'
                          : 'Not Attended'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">Contest Score</span>
                    <p className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {viewingStudent.public_contest_result?.score_display || viewingStudent.stats?.recent_contest_score || '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">Contest Rating</span>
                    <p className="text-sm sm:text-base font-black text-amber-500 mt-0.5">
                      {viewingStudent.public_contest_result?.contest_rating
                        ? viewingStudent.public_contest_result.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1 })
                        : viewingStudent.stats?.contest_rating
                          ? viewingStudent.stats.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1 })
                          : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">Contest Rank</span>
                    <p className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {viewingStudent.public_contest_result?.contest_rank
                        ? `#${viewingStudent.public_contest_result.contest_rank.toLocaleString('en-US')}`
                        : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-navy-950/80 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-500 block">Profile Global Rank</span>
                    <p className="text-sm sm:text-base font-black text-slate-700 dark:text-slate-300 mt-0.5">
                      {viewingStudent.stats?.public_profile_ranking
                        ? `#${viewingStudent.stats.public_profile_ranking.toLocaleString('en-US')}`
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Activity & Consistency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="flex items-center justify-center space-x-1 text-orange-500">
                    <Flame className="w-4 h-4" />
                    <span className="text-xs font-black">{viewingStudent.streak_count || 0} Days</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1 block">Active Streak</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="flex items-center justify-center space-x-1 text-purple-500">
                    <Award className="w-4 h-4" />
                    <span className="text-xs font-black">{viewingStudent.longest_streak || 0} Days</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1 block">Longest Streak</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-slate-800 text-center">
                  <div className="flex items-center justify-center space-x-1 text-emerald-500">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-black">
                      {viewingStudent.consistency_score !== undefined && viewingStudent.consistency_score !== null
                        ? `${Math.min(100, Math.round(viewingStudent.consistency_score > 1 ? viewingStudent.consistency_score : viewingStudent.consistency_score * 100))}%`
                        : '—'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 mt-1 block">Consistency</span>
                </div>
              </div>

            </div>
            {/* ── END SCROLLABLE CONTENT ───────────────────────────────── */}


            {/* ── C. STICKY FOOTER ─────────────────────────────────────── */}
            <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 dark:bg-navy-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 font-bold hidden sm:block">
                Nandha Engineering College • LeetCode Tracker
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3 ml-auto">
                {onSelectStudent && (
                  <button
                    type="button"
                    onClick={() => {
                      const s = viewingStudent;
                      setViewingStudent(null);
                      onSelectStudent(s);
                    }}
                    className="px-4 sm:px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                  >
                    View Full Analytics
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingStudent(null)}
                  className="px-4 sm:px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
            {/* ── END FOOTER ───────────────────────────────────────────── */}

          </div>
        </div>,
        document.body
      )}


    </div>
  );
};


export const LeaderboardTable = React.memo(LeaderboardTableComponent);
