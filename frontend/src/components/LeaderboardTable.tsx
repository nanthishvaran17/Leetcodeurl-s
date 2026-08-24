import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Trophy, RefreshCw, Wifi, Trash2, AlertCircle, Eye, Edit3, ShieldAlert, X, Clock, Flame, Award, CheckCircle2, TrendingUp, Sparkles, BookOpen, Star } from 'lucide-react';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import api from '../services/api';

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
  id: number;
  reg_no: string;
  name: string;
  email?: string;
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
    status: string;
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
}

import { useNotification } from '../context/NotificationContext';

const LeaderboardTableComponent: React.FC<LeaderboardTableProps> = ({
  students,
  loading = false,
  onSelectStudent,
  onRefreshStudent,
  onDeleteStudent,
  onBulkDeleteStudents,
  onUpdateStudent
}) => {
  const { notify, confirmAction } = useNotification();
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

  // Ultra-Fast Paginated Table Viewport Rendering (Default: 50 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<'25' | '50' | '100' | 'All'>('50');

  useEffect(() => {
    setCurrentPage(1);
  }, [students.length, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'All') return 1;
    return Math.ceil(students.length / Number(pageSize)) || 1;
  }, [students.length, pageSize]);

  const paginatedStudents = useMemo(() => {
    if (pageSize === 'All') return students;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return students.slice(start, start + size);
  }, [students, currentPage, pageSize]);

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
    setModalTopY(calculateTargetTopY(e));
    setViewingStudent(student);
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
  useEffect(() => {
    const isAnyModalOpen = Boolean(viewingStudent || editingStudent || deletingStudent);
    if (isAnyModalOpen) {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const prevOverflow = document.body.style.overflow;
      const prevPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      if (window.scrollY === 0 && currentScrollY > 0) {
        window.scrollTo(0, currentScrollY);
      }
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
        document.body.style.paddingRight = prevPaddingRight || '';
        if (currentScrollY > 0) {
          window.scrollTo(0, currentScrollY);
        }
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [viewingStudent, editingStudent, deletingStudent]);

  const toggleStudent = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === students.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(students.map(s => s.id));
    }
  };

  const getRankBadge = (rank?: number) => {
    if (!rank) return null;
    if (rank === 1) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">🥇 #1</span>;
    if (rank === 2) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300">🥈 #2</span>;
    if (rank === 3) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-800/20 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-600/30">🥉 #3</span>;
    return <span className="text-xs font-semibold text-gray-500">#{rank}</span>;
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
        username: editUsername.trim() || undefined
      });
      notify.success('Profile Updated', `Student record for ${editName} updated successfully.`, { category: 'STUDENT EDIT' });
      if (onUpdateStudent) onUpdateStudent(res.data);
      if (onRefreshStudent) onRefreshStudent(editingStudent.id);
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
      if (onRefreshStudent) onRefreshStudent(deletingStudent.id);
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
              className="px-3 py-1.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
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


      <div className="responsive-table-container w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-800 shadow-sm bg-white dark:bg-navy-900">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-950 text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-navy-800 uppercase tracking-widest text-[10px]">
              <th className="py-3 px-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={students.length > 0 && selectedIds.length === students.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="py-3 px-3 text-left whitespace-nowrap">Rank</th>
              <th className="py-3 px-3 text-left whitespace-nowrap">Register No</th>
              <th className="py-3 px-3 text-left whitespace-nowrap">Student</th>
              <th className="py-3 px-3 text-left whitespace-nowrap">Dept / Year</th>
              <th className="py-3 px-3 text-left whitespace-nowrap">LeetCode Handle</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">Solved</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">Contest</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">Rating</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">Contest Rank</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">Profile Rank</th>
              <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-brand-600 dark:text-brand-400 font-bold">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
                    <span className="text-xs">Loading real institutional student records...</span>

                  </div>
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">No students match the selected filters.</span>
                    <span className="text-xs text-gray-400">Try changing or resetting the filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedStudents.map((student, idx) => {
                const actualRank = pageSize === 'All' ? idx + 1 : (currentPage - 1) * Number(pageSize) + idx + 1;

                const syncState = getSyncState(student.stats?.sync_status, student.stats?.last_verified_at);
                const isVerified = syncState === 'verified' || syncState === 'stale';

                // RULE: Never show 0 for unverified students
                const totalSolved = isVerified ? (student.stats?.total_solved ?? 0) : null;
                const isSolver = isVerified && (totalSolved ?? 0) > 0;

                const publicScore = student.public_contest_result?.score_display || student.stats?.recent_contest_score || (isVerified ? 'Not Attended' : '—');
                const recentContestName = student.contest_name || student.public_contest_result?.contest_name || student.stats?.recent_contest_name || 'Weekly Contest';

                const contestRating = (isVerified && student.public_contest_result?.contest_rating)
                  ? student.public_contest_result.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                  : (isVerified && student.stats?.contest_rating)
                    ? student.stats.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    : (isVerified ? 'Unrated' : '—');

                const isPublicAttended = student.contest_status === 'PUBLIC_ATTENDED' || student.public_contest_result?.status === 'PUBLIC_ATTENDED' || student.public_contest_result?.status === 'ATTENDED' || (student.public_contest_result?.score_display && !student.public_contest_result.score_display.includes('Not Attended'));
                const isVirtualAttended = student.contest_status === 'VIRTUAL_ATTENDED' || student.virtual_contest_result?.status === 'VIRTUAL_ATTENDED' || student.virtual_contest_result?.status === 'ATTENDED';
                const isDataError = student.contest_status === 'DATA_ERROR' || student.public_contest_result?.status === 'DATA_ERROR' || student.virtual_contest_result?.status === 'DATA_ERROR';

                // Status Badge Config per Specification
                const contestStatusBadge = isPublicAttended
                  ? { cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-400/30', label: '🟢 Public Attended' }
                  : isVirtualAttended
                    ? { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-400/30', label: '🔵 Virtual Attended' }
                    : isDataError
                      ? { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-400/30', label: '⚠️ Data Error' }
                      : { cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-400/30', label: '🔴 Not Attended' };

                const rawContestRank = student.public_contest_result?.contest_rank;

                const contestRank = isPublicAttended && rawContestRank
                  ? `#${rawContestRank.toLocaleString('en-US')}`
                  : '—';

                const profileRank = isVerified && student.stats?.public_profile_ranking
                  ? `#${student.stats.public_profile_ranking.toLocaleString('en-US')}`
                  : '—';

                const effectiveCollegeRank = student.college_rank || (isSolver ? idx + 1 : undefined);
                const hasCanonicalUrl = isVerified && Boolean(student.leetcode_url && student.leetcode_url.includes('/u/'));
                const verifiedUsername = student.username || (student.leetcode_url ? student.leetcode_url.split('/u/')[1]?.replace('/', '') : null);

                // Determine Participation Mode Badge per specification
                // Determine Participation Mode Badge per specification
                const ovMode = student.overall_participation_mode || 'NONE';
                let modeBadge = (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
                    <span>⚪ NOT ATTENDED</span>
                  </span>
                );

                if (ovMode === 'PUBLIC_ONLY' || ovMode === 'PUBLIC') {
                  modeBadge = (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400/30">
                      <span>🟢 PUBLIC CONTEST</span>
                    </span>
                  );
                } else if (ovMode === 'VIRTUAL_ONLY' || ovMode === 'VIRTUAL') {
                  modeBadge = (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-400/30">
                      <span>🔵 VIRTUAL CONTEST</span>
                    </span>
                  );
                } else if (ovMode === 'BOTH') {
                  modeBadge = (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-400/30">
                      <span>🟢 PUBLIC CONTEST</span>
                    </span>
                  );
                } else if (ovMode === 'FETCH_ERROR') {
                  modeBadge = (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-400/30">
                      <span>⚠️ DATA ERROR</span>
                    </span>
                  );
                }

                const isSyncing = syncState === 'syncing';

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10 transition-colors duration-150 group font-medium text-xs border-b border-slate-100 dark:border-navy-800/60 cursor-pointer"
                  >

                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(student.id)}
                        onChange={() => toggleStudent(student.id)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-bold">
                      {isSolver
                        ? getRankBadge(effectiveCollegeRank)
                        : syncState === 'pending'
                          ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 border border-gray-300 dark:border-gray-700"><Clock className="w-3 h-3" /><span>Pending</span></span>
                          : syncState === 'failed'
                            ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 border border-rose-300"><AlertCircle className="w-3 h-3" /><span>Failed</span></span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-300 dark:border-gray-700">Unranked</span>
                      }
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-mono text-gray-500 font-bold">
                      {student.reg_no}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <p
                        onClick={(e) => handleOpenProfile(student, e)}
                        className="font-bold text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer flex items-center gap-1.5"
                        title="Click to view student profile"
                      >
                        <span>{student.name}</span>
                      </p>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-gray-600 dark:text-gray-300 font-medium">
                      <span className="font-bold text-gray-900 dark:text-white">{student.department?.code}</span> • {student.year_level}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-brand-600 dark:text-brand-400">
                      {hasCanonicalUrl && verifiedUsername ? (
                        <a
                          href={student.leetcode_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1 text-brand-600 dark:text-brand-400 font-bold"
                          title={`Open ${verifiedUsername}'s verified LeetCode profile`}
                        >
                          {verifiedUsername}
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      ) : syncState === 'pending_username' ? (
                        <span className="inline-flex items-center space-x-1 text-amber-600 dark:text-amber-400 font-sans font-medium text-[11px]">
                          <span>⏳ Pending Username</span>
                        </span>
                      ) : syncState === 'invalid_profile' ? (
                        <span className="inline-flex items-center space-x-1 text-rose-500 font-sans font-medium text-[11px]">
                          <span>⚠ Invalid Profile</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 font-sans text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-center font-bold text-gray-900 dark:text-white text-sm">
                      {!isVerified
                        ? <span className="text-gray-400 dark:text-gray-600 text-xs">{syncState === 'pending' ? '⏳ Pending' : syncState === 'failed' ? '🔴 Failed' : '—'}</span>
                        : totalSolved
                      }
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-center bg-brand-50/40 dark:bg-brand-950/20">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <span className="text-[11px] font-extrabold text-gray-700 dark:text-gray-200">
                          {student.public_contest_result?.contest_name || recentContestName}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${contestStatusBadge.cls}`}>
                          {contestStatusBadge.label}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-center font-mono font-bold text-amber-500">
                      {contestRating}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-center font-mono font-bold text-indigo-500">
                      {contestRank}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap text-center font-mono text-gray-500 font-bold">
                      {profileRank}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleOpenProfile(student, e)}
                          className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/40 transition-colors font-bold text-xs flex items-center gap-1 cursor-pointer"
                          title="👁 View Full Profile"
                        >
                          <Eye className="w-4 h-4 text-brand-500" />
                          <span className="hidden md:inline">Profile</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(student, e)}
                          className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors font-bold text-xs flex items-center gap-1"
                          title="✏️ Edit Student Profile"
                        >
                          <Edit3 className="w-4 h-4 text-amber-500" />
                          <span className="hidden md:inline">Edit</span>
                        </button>

                        {onRefreshStudent && (
                          <button
                            type="button"
                            onClick={() => onRefreshStudent(student.id)}
                            disabled={isSyncing}
                            className={`p-1.5 rounded-xl transition-colors ${isSyncing ? 'text-blue-500 animate-spin' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'}`}
                            title="Sync LeetCode Profile"
                            aria-label="Sync LeetCode Profile"
                          >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleOpenDelete(student, e)}
                          className="p-1.5 rounded-xl text-gray-600 dark:text-gray-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors font-bold text-xs flex items-center gap-1"
                          title="🗑 Deactivate Student Roster Entry"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                          <span className="hidden md:inline">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Sleek Ultra-Fast Pagination Bar */}
      {students.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 mt-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-2xl text-xs font-semibold text-gray-600 dark:text-gray-300 shadow-sm">
          <div className="flex items-center space-x-2">
            <span>Showing <strong className="text-gray-900 dark:text-white font-extrabold">{pageSize === 'All' ? 1 : (currentPage - 1) * Number(pageSize) + 1}</strong> to <strong className="text-gray-900 dark:text-white font-extrabold">{pageSize === 'All' ? students.length : Math.min(currentPage * Number(pageSize), students.length)}</strong> of <strong className="text-brand-600 dark:text-brand-400 font-extrabold">{students.length}</strong> solvers</span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Rows Per Page Selector */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-gray-400">Per Page:</span>
              {(['25', '50', '100', 'All'] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setPageSize(size)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    pageSize === size
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-navy-700'
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
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-700 disabled:opacity-40 font-bold"
                  title="First Page"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-700 disabled:opacity-40 font-bold"
                >
                  ‹ Prev
                </button>
                <span className="px-2 font-mono font-bold text-gray-900 dark:text-white">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-700 disabled:opacity-40 font-bold"
                >
                  Next ›
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-700 disabled:opacity-40 font-bold"
                  title="Last Page"
                >
                  »
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Viewport-Centered Student Edit Modal */}
      {editingStudent && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Edit profile for ${editingStudent.name}`}
          className="modal-overlay-responsive animate-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) setEditingStudent(null);
          }}
        >
          <div
            className="modal-container-responsive max-w-lg bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-black">Edit Student Profile</h3>
                  <p className="text-xs text-gray-300 font-mono font-bold mt-0.5">{editingStudent.reg_no}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                title="Close"
                aria-label="Close"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500 text-white hover:text-white transition-all font-black text-xs flex items-center space-x-1 cursor-pointer"
              >
                <span className="text-sm">✕</span>
                <span>Close</span>
              </button>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-4 flex-1 min-h-0 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Student Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Department</label>
                  <select
                    value={editDeptId}
                    onChange={(e) => setEditDeptId(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-bold cursor-pointer"
                  >
                    <option value={1}>CSE(CS)</option>
                    <option value={2}>CSE(IOT)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Academic Year</label>
                  <select
                    value={editYearLevel}
                    onChange={(e) => setEditYearLevel(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500 font-bold cursor-pointer"
                  >
                    <option value="II">II Year</option>
                    <option value="III">III Year</option>
                    <option value="IV">IV Year</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">LeetCode Username Handle</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="e.g. AADHISH_S_B"
                  className="w-full px-3.5 py-2 text-xs font-mono bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">LeetCode Profile URL</label>
                <input
                  type="text"
                  value={editLeetCodeUrl}
                  onChange={(e) => setEditLeetCodeUrl(e.target.value)}
                  placeholder="https://leetcode.com/u/..."
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-navy-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

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
            className="modal-container-responsive max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900/50 p-6 space-y-4 animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Deactivate Student?</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Are you sure you want to deactivate <strong className="text-gray-900 dark:text-white">{deletingStudent.name}</strong> ({deletingStudent.reg_no})?
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-900/40">
                ⚠️ Soft Delete: Record will be hidden from public leaderboard but preserved in audit logs.
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800 transition-colors"
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
            className="modal-container-responsive bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── A. STICKY HEADER ─────────────────────────────────────── */}
            <div className="shrink-0 p-5 sm:p-6 bg-gradient-to-r from-brand-900 via-indigo-900 to-navy-950 text-white flex items-start justify-between relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

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
                    <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 block">LeetCode Username</span>
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
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 text-center flex flex-col justify-center">
                  <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400">Total Solved</span>
                  <span className="text-3xl font-black text-gray-900 dark:text-white mt-1">
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
                    <h4 className="text-sm font-black text-gray-900 dark:text-white truncate">
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
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-navy-900/80 border border-gray-200/80 dark:border-gray-800 text-center">
                    <span className="text-[10px] font-bold text-gray-500 block">Contest Score</span>
                    <p className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {viewingStudent.public_contest_result?.score_display || viewingStudent.stats?.recent_contest_score || '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-navy-900/80 border border-gray-200/80 dark:border-gray-800 text-center">
                    <span className="text-[10px] font-bold text-gray-500 block">Contest Rating</span>
                    <p className="text-sm sm:text-base font-black text-amber-500 mt-0.5">
                      {viewingStudent.public_contest_result?.contest_rating
                        ? viewingStudent.public_contest_result.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1 })
                        : viewingStudent.stats?.contest_rating
                          ? viewingStudent.stats.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1 })
                          : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-navy-900/80 border border-gray-200/80 dark:border-gray-800 text-center">
                    <span className="text-[10px] font-bold text-gray-500 block">Contest Rank</span>
                    <p className="text-sm sm:text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {viewingStudent.public_contest_result?.contest_rank
                        ? `#${viewingStudent.public_contest_result.contest_rank.toLocaleString('en-US')}`
                        : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 dark:bg-navy-900/80 border border-gray-200/80 dark:border-gray-800 text-center">
                    <span className="text-[10px] font-bold text-gray-500 block">Profile Global Rank</span>
                    <p className="text-sm sm:text-base font-black text-gray-700 dark:text-gray-300 mt-0.5">
                      {viewingStudent.stats?.public_profile_ranking
                        ? `#${viewingStudent.stats.public_profile_ranking.toLocaleString('en-US')}`
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Activity & Consistency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 text-center">
                  <div className="flex items-center justify-center space-x-1 text-orange-500">
                    <Flame className="w-4 h-4" />
                    <span className="text-xs font-black">{viewingStudent.streak_count || 0} Days</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 mt-1 block">Active Streak</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 text-center">
                  <div className="flex items-center justify-center space-x-1 text-purple-500">
                    <Award className="w-4 h-4" />
                    <span className="text-xs font-black">{viewingStudent.longest_streak || 0} Days</span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 mt-1 block">Longest Streak</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-gray-800 text-center">
                  <div className="flex items-center justify-center space-x-1 text-emerald-500">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-black">
                      {viewingStudent.consistency_score !== undefined && viewingStudent.consistency_score !== null
                        ? `${Math.min(100, Math.round(viewingStudent.consistency_score > 1 ? viewingStudent.consistency_score : viewingStudent.consistency_score * 100))}%`
                        : '—'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 mt-1 block">Consistency</span>
                </div>
              </div>

            </div>
            {/* ── END SCROLLABLE CONTENT ───────────────────────────────── */}


            {/* ── C. STICKY FOOTER ─────────────────────────────────────── */}
            <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-gray-400 font-bold hidden sm:block">
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
                  className="px-4 sm:px-5 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer"
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
