import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, CheckCircle2, User, Trash2, ShieldCheck, Clock, AlertCircle, Loader, Crown, Award, RotateCcw, ChevronRight } from 'lucide-react';
import { StudentData } from './LeaderboardTable';
import { useStudentEntity } from '../stores/studentLiveStore';
import { formatStudentYearBadge, formatDepartmentCode, deriveDepartmentFromRegNo } from '../utils/filterUtils';
import { getContestRatingDisplay, getContestRankDisplay } from './FastStudentRow';

interface StudentFlipCardProps {
  student: StudentData;
  onSelectStudent?: (student: StudentData) => void;
  onDeleteStudent?: (student: StudentData) => void;
}

type SyncState = 'pending' | 'syncing' | 'verified' | 'failed' | 'stale' | 'mismatch' | 'invalid_profile' | 'pending_username';

function parseUtcTime(ts?: string): number {
  if (!ts) return Date.now();
  let str = ts.trim();
  if (!str.endsWith('Z') && !str.includes('+')) {
    str += 'Z';
  }
  const time = new Date(str).getTime();
  return isNaN(time) ? Date.now() : time;
}

function getSyncState(syncStatus?: string, lastVerifiedAt?: string, totalSolved?: number | null, username?: string): SyncState {
  if (!username || !username.trim() || syncStatus === 'pending_username' || syncStatus === 'PENDING_USERNAME' || syncStatus === 'MISSING LINK') {
    return 'pending_username';
  }
  if (syncStatus === 'invalid_profile' || syncStatus === 'invalid_username' || syncStatus === 'INVALID_USERNAME' || syncStatus === 'INVALID_LINK') {
    return 'invalid_profile';
  }
  if (syncStatus === 'syncing') return 'syncing';
  if (syncStatus === 'success' || syncStatus === 'OK' || syncStatus === 'verified' || syncStatus === 'stale') {
    if (lastVerifiedAt) {
      const age = Date.now() - parseUtcTime(lastVerifiedAt);
      if (age > 24 * 60 * 60 * 1000) return 'stale';
    }
    return 'verified';
  }
  if (!syncStatus || syncStatus === 'pending' || syncStatus === 'not_started') return 'pending';
  if (syncStatus === 'mismatch' || syncStatus === 'data_mismatch') return 'mismatch';
  return 'failed';
}

function formatVerifiedAgo(lastVerifiedAt?: string): string {
  if (!lastVerifiedAt) return 'just now';
  const diffMs = Date.now() - parseUtcTime(lastVerifiedAt);
  if (diffMs <= 0) return 'just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// million-ignore
const StudentFlipCardComponent: React.FC<StudentFlipCardProps> = ({ student: initialStudent, onSelectStudent, onDeleteStudent }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const liveStudent = (useStudentEntity(initialStudent.id) as any) || initialStudent;
  const student = liveStudent;

  // Sync State
  const rawTotal = student.stats?.total_solved ?? student.total_solved;
  const syncStatus = student.stats?.sync_status;
  const lastVerifiedAt = student.stats?.last_verified_at;
  let state = getSyncState(syncStatus, lastVerifiedAt, rawTotal, student.username);
  if (state === 'mismatch' && (rawTotal ?? 0) > 0) {
    state = 'verified';
  }
  const isVerified = state === 'verified' || state === 'stale' || ((rawTotal ?? 0) > 0 && state !== 'invalid_profile' && state !== 'pending_username');

  // Display verified stats
  const totalSolved = isVerified ? (rawTotal ?? 0) : null;
  let easy = isVerified ? (student.stats?.easy_solved ?? student.easy_solved ?? student.lc_problem_stats?.easy_solved ?? 0) : null;
  let medium = isVerified ? (student.stats?.medium_solved ?? student.medium_solved ?? student.lc_problem_stats?.medium_solved ?? 0) : null;
  let hard = isVerified ? (student.stats?.hard_solved ?? student.hard_solved ?? student.lc_problem_stats?.hard_solved ?? 0) : null;

  // Self-heal from alternative accurate records if stats breakdown has a sum mismatch
  if (isVerified && totalSolved && ((easy ?? 0) + (medium ?? 0) + (hard ?? 0) !== totalSolved)) {
    if (student.lc_problem_stats && ((student.lc_problem_stats.easy_solved ?? 0) + (student.lc_problem_stats.medium_solved ?? 0) + (student.lc_problem_stats.hard_solved ?? 0) === totalSolved)) {
      easy = student.lc_problem_stats.easy_solved ?? 0;
      medium = student.lc_problem_stats.medium_solved ?? 0;
      hard = student.lc_problem_stats.hard_solved ?? 0;
    } else if (student.easy_solved !== undefined && ((student.easy_solved ?? 0) + (student.medium_solved ?? 0) + (student.hard_solved ?? 0) === totalSolved)) {
      easy = student.easy_solved ?? 0;
      medium = student.medium_solved ?? 0;
      hard = student.hard_solved ?? 0;
    }
  }

  const isSolver = (totalSolved ?? 0) > 0;

  const rank = student.college_rank;
  const effectiveRank = isSolver ? rank : undefined;
  const verifiedAgo = formatVerifiedAgo(lastVerifiedAt);

  const getRankBadgeStyle = (r?: number) => {
    if (!isSolver || !r) return 'bg-slate-100 dark:bg-navy-900 text-slate-800 dark:text-slate-200 font-extrabold border border-slate-200 dark:border-navy-700';
    if (r === 1) return 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 font-black shadow-sm border border-amber-300';
    if (r === 2) return 'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-300 dark:from-navy-700 dark:to-navy-600 text-slate-900 dark:text-white font-black shadow-sm border border-slate-300 dark:border-navy-600';
    if (r === 3) return 'bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black shadow-sm border border-amber-500';
    if (r <= 10) return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-black border border-emerald-300 dark:border-emerald-700/50';
    return 'bg-slate-100 dark:bg-navy-900 text-slate-800 dark:text-slate-200 font-black border border-slate-200 dark:border-navy-700';
  };

  // Sync Status Badge (bottom of front card)
  const SyncBadge = () => {
    if (state === 'pending_username') return (
      <span className="flex items-center space-x-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
        <span>Pending username</span>
      </span>
    );
    if (state === 'invalid_profile') return (
      <span className="flex items-center space-x-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <span>Profile unavailable</span>
      </span>
    );
    if (state === 'syncing') return (
      <span className="flex items-center space-x-1 text-[11px] font-bold text-brand-600 dark:text-brand-400">
        <Loader className="w-3.5 h-3.5 animate-spin" />
        <span>Syncing...</span>
      </span>
    );
    if (state === 'pending') return (
      <span className="flex items-center space-x-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
        <Clock className="w-3.5 h-3.5" />
        <span>Awaiting sync</span>
      </span>
    );
    if (state === 'failed') return (
      <span className="flex items-center space-x-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Sync failed</span>
      </span>
    );
    if (state === 'mismatch') return (
      <span className="flex items-center space-x-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
        <AlertCircle className="w-3.5 h-3.5" />
        <span>Data mismatch</span>
      </span>
    );
    if (state === 'stale') return (
      <span className="flex items-center space-x-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-400">
        <Clock className="w-3.5 h-3.5" />
        <span>{verifiedAgo}</span>
      </span>
    );
    // verified
    return (
      <span className="flex items-center space-x-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>{verifiedAgo}</span>
      </span>
    );
  };

  const auraClass = effectiveRank === 1 ? 'gold-aura' :
    effectiveRank === 2 ? 'silver-aura' :
      effectiveRank === 3 ? 'bronze-aura' : '';

  return (
    <div
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 260px' }}
      className={`w-full min-h-[260px] flex flex-col perspective-1000 cursor-pointer group min-w-0 rounded-2xl select-none touch-pan-y ${auraClass}`}
      onClick={() => setIsFlipped(f => !f)}
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative w-full h-full min-h-[260px] flex flex-col"
      >
        {/* FRONT SIDE — Sleek Compact Holographic Glass Student Card */}
        <div 
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className={`absolute inset-0 w-full h-full min-h-[260px] p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.08] shadow-xs hover:shadow-md flex flex-col justify-between bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl transition-opacity duration-200 overflow-hidden ${
            isFlipped ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100 z-10'
          }`}
        >

          {/* Card Top: Rank & Department Pill */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider flex items-center space-x-1 whitespace-nowrap shadow-xs font-bold ${getRankBadgeStyle(effectiveRank)}`}>
              {effectiveRank === 1 ? (
                <>
                  <Crown className="w-3 h-3 fill-amber-400 stroke-amber-900" />
                  <span>Rank #1</span>
                </>
              ) : effectiveRank === 2 ? (
                <>
                  <Award className="w-3 h-3 text-slate-800 dark:text-slate-200" />
                  <span>Rank #2</span>
                </>
              ) : effectiveRank === 3 ? (
                <>
                  <Award className="w-3 h-3 text-amber-100" />
                  <span>Rank #3</span>
                </>
              ) : effectiveRank ? (
                <span>Rank #{effectiveRank}</span>
              ) : (
                <span>Unranked</span>
              )}
            </span>
            <span className="font-bold text-[10px] tracking-wider uppercase text-slate-700 dark:text-slate-200 bg-slate-100/90 dark:bg-white/[0.05] px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-white/10 shadow-2xs font-mono">
              {formatDepartmentCode(student.department) || deriveDepartmentFromRegNo(student.reg_no) || (typeof student.department === 'string' ? student.department : student.department?.code) || 'DEPT'}
            </span>
          </div>

          {/* Card Center: Avatar & Student Details */}
          <div className="text-center space-y-1 py-0.5 flex-1 flex flex-col justify-center min-w-0">
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 mx-auto shrink-0 aspect-square flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-400/20 to-indigo-500/20 blur-sm pointer-events-none" />
              <div className="relative w-11 h-11 sm:w-12 sm:h-12 aspect-square rounded-full bg-gradient-to-br from-brand-500 via-indigo-600 to-navy-900 text-white font-extrabold text-sm sm:text-base flex items-center justify-center shadow-xs border border-white dark:border-navy-800 shrink-0 select-none overflow-hidden">
                <span className="leading-none tracking-normal font-black text-center flex items-center justify-center">
                  {student.name ? student.name.trim().split(/\s+/).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : <User className="w-5 h-5 sm:w-6 sm:h-6" />}
                </span>
              </div>
            </div>

            <div className="min-w-0 px-1">
              <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-full tracking-tight font-display" title={student.name}>
                {student.name}
              </h3>
              <div className="flex items-center justify-center space-x-1.5 mt-0.5">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-wider truncate">
                  {student.reg_no}
                </p>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate">
                  {formatStudentYearBadge(student)}{student.section ? ` • ${student.section?.name || student.section}` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Card Bottom: Quick Stats & Sync Badge */}
          <div className="pt-1 flex flex-col items-center justify-center gap-0.5 mt-auto border-t border-slate-100 dark:border-white/[0.04] shrink-0">
            {isVerified ? (
              <div className="flex flex-col items-center">
                <span className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-400 leading-none font-display">
                  {totalSolved}
                </span>
                <span className="text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mt-0.5">
                  Problems Solved
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[28px]">
                <span className="text-[10px] font-semibold text-slate-400">Stats Unavailable</span>
              </div>
            )}

            <div className="mt-0.5 flex items-center justify-center">
              <SyncBadge />
            </div>

            {/* Mobile-Friendly Quick Actions — Perfect 50/50 Symmetrical Grid */}
            <div className="grid grid-cols-2 gap-2 w-full mt-1.5 pt-1.5 border-t border-slate-100 dark:border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onMouseEnter={() => { import('../pages/StudentProfilePage'); }}
                onClick={() => onSelectStudent && onSelectStudent(student)}
                className="w-full py-1.5 min-h-[32px] rounded-xl bg-brand-500/10 hover:bg-brand-600 text-brand-600 dark:text-brand-300 hover:text-white font-bold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer border border-brand-500/20"
                title="View full student profile"
              >
                <span>Profile</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="w-full py-1.5 min-h-[32px] rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer border border-slate-200/80 dark:border-white/10"
                title="Flip to view detailed problem breakdown"
              >
                <RotateCcw className="w-3 h-3 text-indigo-500" />
                <span>Stats</span>
              </button>
            </div>
          </div>

        </div>

        {/* BACK SIDE */}
        <div 
          style={{ 
            backfaceVisibility: 'hidden', 
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            WebkitTransform: 'rotateY(180deg)'
          }}
          className={`absolute inset-0 w-full h-full min-h-[260px] p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 dark:border-navy-800 shadow-xs flex flex-col bg-white dark:bg-navy-950/95 backdrop-blur-2xl transition-opacity duration-200 overflow-hidden ${
            isFlipped ? 'pointer-events-auto opacity-100 z-20' : 'pointer-events-none opacity-0 z-0'
          }`}
        >

          {/* Top Header */}
          <div className="flex items-center justify-between pb-1.5 shrink-0">
            <div className="flex items-center space-x-1.5 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate tracking-tight" title={student.name}>{student.name}</span>
            </div>
            <a
              href={student.username ? `https://leetcode.com/u/${student.username}/` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-slate-400 hover:text-brand-500 transition-colors shrink-0 p-0.5"
              title={student.username ? `View ${student.username} on LeetCode` : 'No LeetCode ID'}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Clean Line Divider */}
          <div className="h-px w-full bg-slate-100 dark:bg-white/[0.06] shrink-0" />

          {/* Stats Breakdown Container - Clean Typography */}
          <div className="flex-1 flex flex-col justify-center py-1 min-w-0">

            {!isVerified ? (
              <div className="text-center space-y-1">
                <AlertCircle className="w-5 h-5 mx-auto text-slate-300 dark:text-navy-600 mb-0.5" />
                <p className="font-extrabold text-[11px] text-slate-700 dark:text-slate-300">
                  {state === 'pending_username' ? 'Pending LeetCode Username' :
                    state === 'invalid_profile' ? 'Invalid LeetCode Profile' :
                      state === 'pending' ? 'Awaiting Scheduled Sync' :
                        state === 'mismatch' ? 'Data Mismatch Detected' : 'Stats Unavailable'}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  {state === 'pending_username' && 'Awaiting valid LeetCode profile assignment'}
                  {state === 'invalid_profile' && 'Profile not found or URL is incorrect'}
                  {state === 'pending' && 'Scheduled for background sync'}
                  {state === 'failed' && (lastVerifiedAt ? `Last verified: ${verifiedAgo}` : 'Never successfully synced')}
                  {state === 'mismatch' && 'Easy + Medium + Hard ≠ Total'}
                </p>
                <p className="text-[10px] font-black text-brand-500 mt-0.5 truncate">
                  {student.username || '—'}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">

                {/* Total & Difficulty */}
                <div className="text-center">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {totalSolved}
                  </span>
                  <div className="text-[9px] font-black uppercase text-slate-700 dark:text-slate-200 tracking-wider mt-0.5 mb-1">
                    Total Solved
                  </div>

                  <div className="flex justify-center items-center gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{easy}</span>
                      <span className="text-[8px] font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">Easy</span>
                    </div>
                    <div className="w-px h-4 bg-slate-300 dark:bg-navy-800" />
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">{medium}</span>
                      <span className="text-[8px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider">Med</span>
                    </div>
                    <div className="w-px h-4 bg-slate-300 dark:bg-navy-800" />
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400">{hard}</span>
                      <span className="text-[8px] font-black uppercase text-rose-800 dark:text-rose-300 tracking-wider">Hard</span>
                    </div>
                  </div>
                </div>

                {/* Clean Line Divider */}
                <div className="h-px w-2/3 mx-auto bg-slate-100 dark:bg-navy-800" />

                {/* Additional Stats */}
                <div className="grid grid-cols-2 gap-1.5 text-center px-0.5">
                  <div className="flex flex-col items-center bg-slate-50 dark:bg-navy-900/50 p-1 rounded-lg border border-slate-200/80 dark:border-navy-800">
                    <span className="text-[8px] font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Rating</span>
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 truncate max-w-full">
                      {getContestRatingDisplay(student)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center bg-slate-50 dark:bg-navy-900/50 p-1 rounded-lg border border-slate-200/80 dark:border-navy-800">
                    <span className="text-[8px] font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">Contest Rank</span>
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 truncate max-w-full">
                      {getContestRankDisplay(student)}
                    </span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Action Footer: Symmetrical Buttons */}
          <div className="flex items-center gap-1.5 pt-1.5 mt-auto border-t border-slate-100 dark:border-white/[0.06] shrink-0">
            <button
              type="button"
              onMouseEnter={() => { import('../pages/StudentProfilePage'); }}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectStudent) onSelectStudent(student);
              }}
              className="flex-1 py-1.5 min-h-[32px] rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-[11px] shadow-xs transition-all flex items-center justify-center space-x-1 cursor-pointer active:scale-95"
            >
              <span>Profile</span>
              <ChevronRight className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsFlipped(false);
              }}
              className="flex-1 py-1.5 min-h-[32px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 font-bold text-[11px] border border-slate-200/80 dark:border-white/10 transition-colors cursor-pointer active:scale-95"
              title="Flip to Front"
            >
              <RotateCcw className="w-3 h-3 mr-1 text-indigo-500" />
              <span>Back</span>
            </button>

            {onDeleteStudent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteStudent(student);
                }}
                className="w-8 min-h-[32px] flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer active:scale-95 shrink-0"
                title="Delete Student Record"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
};

export const StudentFlipCard = React.memo(StudentFlipCardComponent);
