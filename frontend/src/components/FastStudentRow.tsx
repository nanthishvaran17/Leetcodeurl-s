import React, { memo, useState } from 'react';
import { useStudentEntity } from '../stores/studentLiveStore';
import { Clock, AlertCircle, Award, TrendingUp, RefreshCw, Trash2, Edit3, Eye, ExternalLink, ChevronRight, ChevronDown, ChevronUp, MoreHorizontal, Check } from 'lucide-react';
import { formatStudentYearBadge, formatDepartmentCode, deriveDepartmentFromRegNo } from '../utils/filterUtils';
import { triggerHaptic } from '../utils/haptics';

function getRankBadge(rank?: number) {
  if (!rank || rank <= 0) return <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-[9.5px] font-bold bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-navy-700 shrink-0">Unranked</span>;
  if (rank === 1) return <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-white shadow-sm shadow-amber-500/30 border border-amber-300/60 shrink-0">#1</span>;
  if (rank === 2) return <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-[10px] font-black bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600 text-white shadow-sm shadow-slate-500/20 border border-slate-300/60 shrink-0">#2</span>;
  if (rank === 3) return <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-700 via-orange-600 to-orange-500 text-white shadow-sm shadow-amber-700/20 border border-amber-600/60 shrink-0">#3</span>;
  return <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700 shrink-0">#{rank}</span>;
}

function parseUtcTime(ts?: string): number {
  if (!ts) return Date.now();
  let str = ts.trim();
  if (!str.endsWith('Z') && !str.includes('+')) {
    str += 'Z';
  }
  const time = new Date(str).getTime();
  return isNaN(time) ? Date.now() : time;
}

function getSyncState(syncStatus?: string, lastVerifiedAt?: string) {
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

function getDeptCode(st: any): string {
  if (!st) return '—';
  const val = st.department || st.dept_code || st.department_code || st.dept || st.department_id;
  const formatted = formatDepartmentCode(val);
  if (formatted && formatted !== 'ALL' && formatted !== '—') return formatted;
  if (st.reg_no) {
    const derived = deriveDepartmentFromRegNo(st.reg_no);
    if (derived) return derived;
  }
  return '—';
}

export function getContestRatingDisplay(st: any): string {
  if (!st) return '—';
  const rawRating = st.stats?.contest_rating
    ?? st.contest_rating
    ?? st.public_contest_result?.contest_rating
    ?? st.lc_contest_standing?.contest_rating;
  if (rawRating == null || Number(rawRating) <= 0 || Number(rawRating) === 1500 || Math.round(Number(rawRating)) === 1500) return '—';
  return Math.round(Number(rawRating)).toLocaleString();
}

export interface StudentRankInfo {
  label: string;
  value: string;
  numericRank?: number;
}

export function getRankBadgeInfo(st: any): StudentRankInfo {
  if (!st) return { label: 'Contest Rank', value: '—' };

  // 1. Contest Global Ranking (official Sunday contest rank)
  const contestRank = st.stats?.contest_global_ranking
    ?? st.contest_global_ranking
    ?? st.stats?.contest_rank
    ?? st.contest_rank
    ?? st.public_contest_result?.contest_rank
    ?? st.lc_contest_standing?.contest_global_ranking;

  if (contestRank != null) {
    const num = Number(contestRank);
    if (!isNaN(num) && num > 0 && num !== 50000 && num !== 5000001) {
      return {
        label: 'Contest Rank',
        value: `#${num.toLocaleString()}`,
        numericRank: num
      };
    }
  }

  // 2. Global Profile Ranking (LeetCode Public Profile overall rank, e.g. #543,034)
  const globalProfileRank = st.stats?.public_profile_ranking
    ?? st.public_profile_ranking
    ?? st.stats?.profile_rank
    ?? st.profile_rank
    ?? st.global_rank
    ?? st.stats?.global_rank
    ?? st.global_ranking
    ?? st.lc_problem_stats?.profile_global_ranking
    ?? st.lc_profile?.ranking;

  if (globalProfileRank != null) {
    const num = Number(globalProfileRank);
    if (!isNaN(num) && num > 0 && num !== 50000 && num !== 5000001) {
      return {
        label: 'Global Rank',
        value: `#${num.toLocaleString()}`,
        numericRank: num
      };
    }
  }

  // 3. Fallback to College / Institutional Rank
  const collegeRank = st.college_rank ?? st.rank;
  if (collegeRank != null) {
    const num = Number(collegeRank);
    if (!isNaN(num) && num > 0) {
      return {
        label: 'College Rank',
        value: `#${num.toLocaleString()}`,
        numericRank: num
      };
    }
  }

  return { label: 'Contest Rank', value: '—' };
}

export function getContestRankDisplay(st: any): string {
  return getRankBadgeInfo(st).value;
}

export function getProfileRankDisplay(st: any): string {
  return getRankBadgeInfo(st).value;
}

export const LEADERBOARD_TABLE_GRID_STYLE: React.CSSProperties = {
  gridTemplateColumns: '44px 76px 124px minmax(180px, 1.8fr) minmax(115px, 1.1fr) minmax(140px, 1.3fr) minmax(72px, 0.8fr) minmax(110px, 1.1fr) minmax(72px, 0.8fr) minmax(96px, 1fr) minmax(110px, 1.1fr)',
  alignItems: 'center',
};

// million-ignore
export const FastStudentRow = memo(({
  studentId,
  initialStudent,
  index,
  style,
  isSelected,
  toggleStudent,
  onView,
  onEdit,
  onRefresh,
  onDelete,
  isRefreshing
}: any) => {
  const liveStudent = useStudentEntity(studentId);
  const student = liveStudent || initialStudent;

  const syncState = getSyncState(student?.stats?.sync_status, student?.stats?.last_verified_at);
  const isVerified = syncState === 'verified' || syncState === 'stale';
  const totalSolved = (student && isVerified) ? (student.stats?.total_solved ?? 0) : null;
  const isSolver = isVerified && (totalSolved ?? 0) > 0;

  const effectiveCollegeRank = isSolver ? index + 1 : undefined;
  const isSyncing = syncState === 'fetching' || Boolean(isRefreshing);

  const [flashSolved, setFlashSolved] = React.useState(false);
  const prevSolvedRef = React.useRef(totalSolved);

  React.useEffect(() => {
    if (totalSolved !== null && prevSolvedRef.current !== null && totalSolved !== prevSolvedRef.current) {
      setFlashSolved(true);
      const t = setTimeout(() => setFlashSolved(false), 1000);
      prevSolvedRef.current = totalSolved;
      return () => clearTimeout(t);
    }
    prevSolvedRef.current = totalSolved;
  }, [totalSolved]);

  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic('selection');
    setIsExpanded(prev => !prev);
  };

  const handleAvatarSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic('selection');
    toggleStudent(student.id);
  };

  const handleMobileProfileView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic('light');
    onView(student, e);
  };

  const handleMobileRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic('medium');
    onRefresh?.((student || initialStudent).id);
  };

  const handleMobileEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic('light');
    onEdit?.(student, e);
  };

  const handleMobileDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic('warning');
    onDelete?.(student, e);
  };

  if (!student) return null;

  const easySolved = student.easy_solved ?? student.stats?.easy_solved ?? 0;
  const mediumSolved = student.medium_solved ?? student.stats?.medium_solved ?? 0;
  const hardSolved = student.hard_solved ?? student.stats?.hard_solved ?? 0;

  return (
    <div
      style={style}
      className="w-full max-w-full min-w-0 md:min-w-[1100px] mb-2.5 md:mb-0"
    >
      {/* MOBILE LAYOUT (ULTRA-PREMIUM COMPACT ACCORDION CARD) */}
      <div 
        className={`!flex md:!hidden flex-col w-full max-w-full bg-white dark:bg-[#0c1424] rounded-2xl border transition-all duration-200 relative overflow-hidden shadow-xs hover:shadow-md touch-manipulation ${
          isSelected 
            ? 'border-brand-500 ring-2 ring-brand-500/30 bg-brand-500/[0.04] dark:bg-brand-950/20' 
            : 'border-slate-200/90 dark:border-white/10'
        }`}
      >
        {/* Compact Card Header - Tap to Expand/Collapse */}
        <div 
          onClick={handleToggleExpand}
          className="flex items-start gap-2.5 p-3 cursor-pointer select-none active:bg-slate-50 dark:active:bg-white/[0.03] transition-colors"
        >
          {/* Avatar with Tap-to-Select Micro Toggle */}
          <div 
            onClick={handleAvatarSelect}
            className="relative shrink-0 cursor-pointer group/avatar pt-0.5"
            title="Tap to select student"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-md transition-all ${
              isSelected 
                ? 'bg-brand-600 text-white ring-2 ring-brand-500 ring-offset-2' 
                : 'bg-gradient-to-br from-brand-600 via-indigo-600 to-purple-600 text-white shadow-brand-500/20'
            }`}>
              {isSelected ? (
                <Check size={16} strokeWidth={3} />
              ) : (
                (student.name || 'User')
                  .split(' ')
                  .map((n: string) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              )}
            </div>
          </div>

          {/* Student Identity & Stats */}
          <div className="flex flex-col min-w-0 flex-1 space-y-1">
            {/* Row 1: Student Name + Rank Badge + Expand Chevron */}
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                <span className="font-black text-sm text-slate-900 dark:text-white truncate uppercase tracking-tight">
                  {(student.name || '').toUpperCase()}
                </span>
                <div className="shrink-0">
                  {isSolver ? getRankBadge(effectiveCollegeRank) : <span className="inline-flex items-center justify-center h-5 px-2 rounded-full text-[9.5px] font-bold bg-slate-100 dark:bg-navy-800 text-slate-500 shrink-0">Unranked</span>}
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                {isExpanded ? (
                  <ChevronUp size={18} className="stroke-[2.5] text-brand-600 dark:text-brand-400" />
                ) : (
                  <ChevronDown size={18} className="stroke-[2.5]" />
                )}
              </div>
            </div>

            {/* Row 2: Reg No • Dept/Year Pill + Solved Count Pill */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono min-w-0 flex-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">{student.reg_no}</span>
                <span className="shrink-0 text-slate-300 dark:text-slate-600">•</span>
                <span className="px-1.5 py-0.5 rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-300 font-bold text-[10px] border border-brand-500/20 shrink-0 truncate max-w-[130px]">
                  {getDeptCode(student)} {formatStudentYearBadge(student)}
                </span>
              </div>

              {/* Solved Pill */}
              <div className={`shrink-0 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-300 ${flashSolved ? 'scale-110 transition-transform' : ''}`}>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">SOLVED</span>
                <span className="text-xs font-black font-mono">{totalSolved ?? '—'}</span>
              </div>
            </div>

            {/* Row 3: LeetCode Username */}
            {student.username && (
              <div className="flex items-center min-w-0">
                <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400 truncate">
                  @{student.username}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* EXPANDED ACCORDION DRAWER */}
        {isExpanded && (
          <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-100 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.01] space-y-3 animate-fade-in">
            {/* 1. Problem Difficulty Breakdown Pills */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
                <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Easy</span>
                <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">{easySolved}</span>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
                <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Medium</span>
                <span className="text-sm font-black font-mono text-amber-700 dark:text-amber-300">{mediumSolved}</span>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2 text-center">
                <span className="text-[9.5px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Hard</span>
                <span className="text-sm font-black font-mono text-rose-700 dark:text-rose-300">{hardSolved}</span>
              </div>
            </div>

            {/* 2. Contest Rating & Global Standing */}
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-[#070e1c] border border-slate-200/80 dark:border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <Award size={15} className="text-amber-500 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 font-bold">Contest Rating:</span>
                <span className="font-black text-amber-600 dark:text-amber-400">{getContestRatingDisplay(student)}</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 dark:text-slate-400">Rank:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black">{getContestRankDisplay(student)}</span>
              </div>
            </div>

            {/* 3. Action Buttons with Full 44px Touch Targets */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleMobileProfileView}
                className="flex-1 min-h-[44px] px-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 active:scale-95 text-white font-black text-xs shadow-md shadow-brand-500/20 transition-all touch-manipulation cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Eye size={14} className="stroke-[2.2]" />
                <span>Full Profile</span>
              </button>

              {onRefresh && (
                <button
                  type="button"
                  onClick={handleMobileRefresh}
                  disabled={isSyncing}
                  className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 bg-white dark:bg-navy-800 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-xs active:scale-90 touch-manipulation cursor-pointer shrink-0"
                  title="Refresh Stats"
                  aria-label="Refresh Stats"
                >
                  <RefreshCw size={15} className={`shrink-0 ${isSyncing ? 'animate-spin text-brand-500' : ''}`} />
                </button>
              )}

              {onEdit && (
                <button
                  type="button"
                  onClick={handleMobileEdit}
                  className="min-h-[44px] min-w-[44px] rounded-xl text-amber-700 dark:text-amber-300 hover:text-amber-800 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 shadow-xs active:scale-95 touch-manipulation cursor-pointer flex items-center justify-center shrink-0 font-bold"
                  title="Edit Student Details"
                  aria-label="Edit Student Details"
                >
                  <Edit3 size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={handleMobileDelete}
                  className="min-h-[44px] min-w-[44px] rounded-xl text-rose-600 hover:text-rose-700 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 shadow-xs active:scale-95 touch-manipulation cursor-pointer flex items-center justify-center shrink-0"
                  title="Deactivate Student"
                  aria-label="Deactivate Student"
                >
                  <Trash2 size={15} className="shrink-0 text-rose-500" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP LAYOUT (BALANCED GRID - ZERO AWKWARD GAPS) */}
      <div
        className="!hidden md:!grid w-full min-w-full md:min-w-[1100px] h-full items-center py-2.5 px-0 hover:bg-slate-50/80 dark:hover:bg-navy-900/50 transition-all duration-150 group font-medium text-xs md:border-b border-slate-200/80 dark:border-navy-800/60 cursor-pointer min-h-[68px]"
        style={LEADERBOARD_TABLE_GRID_STYLE}
      >
        {/* 1. Checkbox */}
        <div className="px-3 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleStudent(student.id)}
            className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
          />
        </div>

        {/* 2. Rank */}
        <div className="px-3 flex items-center justify-start font-bold" onClick={(e) => e.stopPropagation()}>
          {isSolver
            ? getRankBadge(effectiveCollegeRank)
            : syncState === 'pending'
              ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700"><Clock className="w-3 h-3" /><span>Pending</span></span>
              : syncState === 'failed'
                ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"><AlertCircle className="w-3 h-3" /><span>Failed</span></span>
                : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700">Unranked</span>
          }
        </div>

        {/* 3. Register No */}
        <div className="px-3 flex items-center justify-start">
          <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-md border border-slate-300 dark:border-navy-700">
            {student.reg_no}
          </span>
        </div>

        {/* 4. Student (Avatar + Name) */}
        <div className="px-3 flex items-center justify-start text-left min-w-0">
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(student, e); }} className="flex items-center space-x-3 w-full text-left min-w-0 group/btn">
            <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <p className="font-black text-sm text-slate-900 dark:text-white truncate uppercase group-hover/btn:text-brand-600 dark:group-hover/btn:text-brand-400 transition-colors">
                {(student.name || '').toUpperCase()}
              </p>
            </div>
          </button>
        </div>

        {/* 5. Dept / Year */}
        <div className="px-3 text-[11px] font-bold flex items-center justify-start gap-0.5 self-center my-auto overflow-hidden min-w-0">
          <span className="text-slate-900 dark:text-white truncate font-extrabold">{getDeptCode(student)}</span>
          <span className="text-slate-600 dark:text-slate-300 shrink-0 font-extrabold px-0.5">/</span>
          <span className="text-slate-800 dark:text-slate-200 shrink-0 font-extrabold">{formatStudentYearBadge(student)}</span>
        </div>

        {/* 6. LeetCode Handle */}
        <div className="px-3 flex flex-col justify-center self-center my-auto overflow-hidden min-w-0">
          {student.username ? (
            <a href={`https://leetcode.com/u/${student.username}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center leading-normal truncate" onClick={(e) => e.stopPropagation()}>
              @{student.username}
            </a>
          ) : <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium inline-flex items-center leading-normal truncate">Not Linked</span>}
          {(() => {
            const secUser = student.secondary_leetcode_id || student.secondary_accounts?.[0]?.username || student.leetcode_accounts?.[0]?.username;
            if (!secUser) return null;
            return (
              <a
                href={`https://leetcode.com/u/${secUser}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shrink-0 mt-0.5 w-fit truncate"
                onClick={(e) => e.stopPropagation()}
                title="Secondary LeetCode Account"
              >
                <span>Sec: @{secUser}</span>
              </a>
            );
          })()}
        </div>

        {/* 7. Solved */}
        <div className="px-3 flex items-center justify-center text-center">
          <div className={`px-2.5 py-0.5 rounded-lg inline-flex items-center justify-center transition-colors ${flashSolved ? 'bg-emerald-200 dark:bg-emerald-800/50 duration-75' : 'bg-transparent duration-1000'}`}>
            {totalSolved !== null ? (
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{totalSolved}</span>
            ) : <span className="text-slate-400 font-bold">—</span>}
          </div>
        </div>

        {/* 8. Contest */}
        <div className="px-3 flex items-center justify-center text-center">
          {(() => {
            const status = student.contest_status || 'NOT_ATTENDED';
            if (status === 'PUBLIC_ATTENDED' || status === 'PUBLIC' || status === 'ATTENDED') {
              return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[10px] tracking-wider uppercase">Public</span>;
            }
            if (status === 'VIRTUAL_ATTENDED' || status === 'VIRTUAL') {
              return <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-extrabold text-[10px] tracking-wider uppercase">Virtual</span>;
            }
            if (status === 'PENDING_USERNAME' || status === 'NO_HANDLE') {
              return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-extrabold text-[10px] tracking-wider uppercase">Pending</span>;
            }
            if (status === 'DATA_ERROR' || status === 'SOURCE_ERROR' || status === 'CONFLICT' || status === 'INVALID_USERNAME') {
              return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-[10px] tracking-wider uppercase">Data Error</span>;
            }
            return <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-extrabold text-[10px] tracking-wider uppercase">Not Attended</span>;
          })()}
        </div>

        {/* 9. Rating */}
        <div className="px-3 flex items-center justify-center text-center text-amber-600 dark:text-amber-400 font-extrabold">
          {getContestRatingDisplay(student)}
        </div>

        {/* 10. Contest Rank */}
        <div className="px-3 flex items-center justify-center text-center text-indigo-700 dark:text-indigo-300 font-extrabold">
          {getContestRankDisplay(student)}
        </div>

        {/* 11. Actions */}
        <div className="px-3 flex items-center justify-center text-center" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1 transition-opacity">
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(student, e); }} className="p-1.5 rounded-xl text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50" title="View"><Eye className="w-4 h-4" /></button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(student, e); }} className="p-1.5 rounded-xl text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50" title="Edit"><Edit3 className="w-4 h-4" /></button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRefresh?.((student || initialStudent).id); }} disabled={isSyncing} className={`p-1.5 rounded-xl ${isSyncing ? 'text-brand-500' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'}`} title="Refresh Stats"><RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /></button>
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(student, e); }} className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50" title="Delete"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
});
