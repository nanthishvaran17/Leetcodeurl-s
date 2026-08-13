import React, { useState } from 'react';
import { ExternalLink, Trophy, Flame, Star, Award, CheckCircle2, RotateCw, User, Trash2, ShieldCheck, Clock, AlertCircle, Loader } from 'lucide-react';
import { StudentData } from './LeaderboardTable';

interface StudentFlipCardProps {
  student: StudentData;
  onSelectStudent?: (student: StudentData) => void;
  onDeleteStudent?: (student: StudentData) => void;
}

// ─── Sync State Machine ───────────────────────────────────────────────────────
// Derives a clean status from the raw syncStatus field.
// CRITICAL: null/undefined NEVER means "0 solved". It means "not yet fetched".
type SyncState = 'pending' | 'syncing' | 'verified' | 'failed' | 'stale' | 'mismatch' | 'invalid_profile';

function parseUtcTime(ts?: string): number {
  if (!ts) return Date.now();
  let str = ts.trim();
  if (!str.endsWith('Z') && !str.includes('+')) {
    str += 'Z';
  }
  const time = new Date(str).getTime();
  return isNaN(time) ? Date.now() : time;
}

function getSyncState(syncStatus?: string, lastVerifiedAt?: string): SyncState {
  if (syncStatus === 'invalid_profile' || syncStatus === 'INVALID_LINK' || syncStatus === 'MISSING_LINK') return 'invalid_profile';
  if (syncStatus === 'syncing') return 'syncing';
  if (!syncStatus || syncStatus === 'pending' || syncStatus === 'not_started') return 'pending';
  if (syncStatus === 'success' || syncStatus === 'OK' || syncStatus === 'verified' || syncStatus === 'stale') {
    // "Stale" = verified more than 24 hours ago
    if (lastVerifiedAt) {
      const age = Date.now() - parseUtcTime(lastVerifiedAt);
      if (age > 24 * 60 * 60 * 1000) return 'stale';
    }
    return 'verified';
  }
  if (syncStatus === 'mismatch' || syncStatus === 'data_mismatch') return 'mismatch';
  return 'failed'; // covers "failed", "timeout", "error"
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

export const StudentFlipCard: React.FC<StudentFlipCardProps> = ({ student, onSelectStudent, onDeleteStudent }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // ── Sync State ──────────────────────────────────────────────────────────────
  const syncStatus = student.stats?.sync_status;
  const lastVerifiedAt = student.stats?.last_verified_at;
  const state = getSyncState(syncStatus, lastVerifiedAt);
  const isVerified = state === 'verified' || state === 'stale';

  // RULE: Never display stats as 0 unless they were actually verified.
  const totalSolved = isVerified ? (student.stats?.total_solved ?? 0) : null;
  const easy        = isVerified ? (student.stats?.easy_solved   ?? 0) : null;
  const medium      = isVerified ? (student.stats?.medium_solved ?? 0) : null;
  const hard        = isVerified ? (student.stats?.hard_solved   ?? 0) : null;
  const isSolver    = isVerified && (totalSolved ?? 0) > 0;

  const rank          = student.college_rank;
  const effectiveRank = isSolver ? rank : undefined;
  const verifiedAgo   = formatVerifiedAgo(lastVerifiedAt);

  const getRankBadgeStyle = (r?: number) => {
    if (!isSolver || !r) return 'bg-gray-100 dark:bg-navy-950 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800';
    if (r === 1) return 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30 border-amber-300';
    if (r === 2) return 'bg-gradient-to-r from-slate-200 via-gray-100 to-slate-400 text-slate-900 font-extrabold shadow-sm shadow-slate-400/20 border-slate-300';
    if (r === 3) return 'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 text-amber-100 font-extrabold shadow-sm shadow-amber-700/20 border-amber-600';
    if (r <= 10)  return 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold shadow-sm shadow-emerald-500/20 border-emerald-400';
    return 'bg-gray-100 dark:bg-navy-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800';
  };

  // ── Sync Status Badge (bottom of front card) ────────────────────────────────
  const SyncBadge = () => {
    if (state === 'invalid_profile') return (
      <span className="flex items-center space-x-1 text-[10px] font-bold text-gray-400 dark:text-gray-500">
        <span>⚪ Profile unavailable</span>
      </span>
    );
    if (state === 'syncing') return (
      <span className="flex items-center space-x-1 text-[10px] font-bold text-blue-500 dark:text-blue-400">
        <Loader className="w-3 h-3 animate-spin" />
        <span>🔄 Syncing...</span>
      </span>
    );
    if (state === 'pending') return (
      <span className="flex items-center space-x-1 text-[10px] font-bold text-gray-400 dark:text-gray-500">
        <Clock className="w-3 h-3" />
        <span>⏳ Not synced yet</span>
      </span>
    );
    if (state === 'failed') return (
      <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-500 dark:text-rose-400">
        <AlertCircle className="w-3 h-3" />
        <span>🔴 Sync failed{lastVerifiedAt ? ` • ${verifiedAgo}` : ''}</span>
      </span>
    );
    if (state === 'mismatch') return (
      <span className="flex items-center space-x-1 text-[10px] font-bold text-amber-500">
        <AlertCircle className="w-3 h-3" />
        <span>🟡 Data mismatch</span>
      </span>
    );
    if (state === 'stale') return (
      <span className="flex items-center space-x-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
        <Clock className="w-3 h-3" />
        <span>🟡 Stale • {verifiedAgo}</span>
      </span>
    );
    // verified
    return (
      <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3 h-3" />
        <span>🟢 Verified {verifiedAgo}</span>
      </span>
    );
  };

  // ── Front card bottom stats display ────────────────────────────────────────
  const FrontStatsPill = () => {
    if (state === 'invalid_profile') return (
      <div className="flex items-center space-x-1.5 font-bold text-gray-400 bg-gray-50 dark:bg-gray-900 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-800">
        <span className="text-xs">⚪ Profile unavailable</span>
      </div>
    );
    if (state === 'syncing') return (
      <div className="flex items-center space-x-1.5 font-bold text-blue-500 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-xl border border-blue-200 dark:border-blue-800/60">
        <Loader className="w-3.5 h-3.5 animate-spin" />
        <span className="text-xs">🔄 Syncing...</span>
      </div>
    );
    if (state === 'pending') return (
      <div className="flex items-center space-x-1.5 font-bold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900 px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-800">
        <Loader className="w-3.5 h-3.5 animate-spin" />
        <span className="text-xs">Awaiting sync</span>
      </div>
    );
    if (state === 'failed') return (
      <div className="flex items-center space-x-1.5 font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-800/60">
        <AlertCircle className="w-3.5 h-3.5" />
        <span className="text-xs">Stats unavailable</span>
      </div>
    );
    // stale shows previous verified number with amber indicator
    if (state === 'stale') return (
      <div className="flex items-center space-x-1.5 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-800/60">
        <Trophy className="w-3.5 h-3.5" />
        <span className="text-xs">{totalSolved} Solved 🟡</span>
      </div>
    );
    return (
      <div className="flex items-center space-x-1.5 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
        <Trophy className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs">{totalSolved} Solved</span>
      </div>
    );
  };

  return (
    <div
      className="w-full h-[340px] perspective-1000 cursor-pointer group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 w-full h-full glass-card p-6 rounded-3xl border border-gray-200/90 dark:border-gray-800 shadow-xl hover:shadow-2xl dark:hover:border-brand-500/40 backface-hidden flex flex-col justify-between transition-all duration-300 bg-white/95 dark:bg-navy-900/90">
          
          {/* Card Top: Rank & Department Pill */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs border uppercase tracking-wider flex items-center space-x-1 ${getRankBadgeStyle(effectiveRank)}`}>
              {!isSolver || !effectiveRank ? (
                <span>Unranked</span>
              ) : effectiveRank === 1 ? (
                <><span>🥇</span><span>#1 Rank</span></>
              ) : effectiveRank === 2 ? (
                <><span>🥈</span><span>#2 Rank</span></>
              ) : effectiveRank === 3 ? (
                <><span>🥉</span><span>#3 Rank</span></>
              ) : effectiveRank <= 10 ? (
                <><span>🏅</span><span>#{effectiveRank} Rank</span></>
              ) : (
                <span>#{effectiveRank}</span>
              )}
            </span>
            <span className="px-3 py-1 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 font-extrabold text-[11px] font-mono">
              {student.department?.code || 'CSE'}
            </span>
          </div>

          {/* Card Center: Avatar & Student Details */}
          <div className="text-center space-y-2.5 py-1">
            <div className="relative w-16 h-16 mx-auto group-hover:scale-105 transition-transform duration-300">
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-navy-800 text-white font-black text-xl flex items-center justify-center shadow-md">
                {student.name ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2) : <User className="w-8 h-8" />}
              </div>
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white truncate max-w-[210px] mx-auto tracking-tight">
                {student.name}
              </h3>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-mono font-bold mt-0.5 tracking-wider">
                {student.reg_no}
              </p>
              <p className="text-[11px] text-gray-500 font-medium mt-1">
                {student.department?.name} • <span className="font-bold text-gray-700 dark:text-gray-300">{student.year_level} Year</span>
              </p>
            </div>
          </div>

          {/* Card Bottom: Quick Stats & Sync Badge */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
            <FrontStatsPill />
            <SyncBadge />
          </div>

        </div>

        {/* BACK SIDE */}
        <div className="absolute inset-0 w-full h-full p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-950 text-gray-900 dark:text-white shadow-2xl backface-hidden rotate-y-180 flex flex-col justify-between">
          
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span className="font-extrabold text-sm text-gray-900 dark:text-white truncate max-w-[140px] tracking-tight">{student.name}</span>
            </div>
            <span className="text-[11px] text-brand-700 dark:text-brand-300 font-mono font-bold bg-brand-50 dark:bg-brand-950 px-2.5 py-1 rounded-xl border border-brand-200 dark:border-brand-800">
              {student.reg_no}
            </span>
          </div>

          {/* Stats Breakdown or Status Placeholder */}
          <div className="space-y-3.5 flex-1 flex flex-col justify-center">
            
            {!isVerified ? (
              /* ── PENDING / FAILED state placeholder ── */
              <div className={`p-4 rounded-2xl text-center space-y-2 ${
                state === 'pending' ? 'bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800' :
                state === 'mismatch' ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800' :
                'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800'
              }`}>
                <div className="text-2xl">
                  {state === 'pending' ? '⏳' : state === 'mismatch' ? '🟡' : '🔴'}
                </div>
                <p className="font-extrabold text-sm text-gray-700 dark:text-gray-300">
                  {state === 'pending' ? 'Stats Not Fetched Yet' : state === 'mismatch' ? 'Data Mismatch Detected' : 'Stats Unavailable'}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {state === 'pending' && 'Waiting for background sync'}
                  {state === 'failed' && (lastVerifiedAt ? `Last verified: ${verifiedAgo}` : 'Never successfully synced')}
                  {state === 'mismatch' && 'Easy + Medium + Hard ≠ Total'}
                </p>
                <p className="text-[11px] font-mono text-brand-600 dark:text-brand-400">
                  {student.username || '—'}
                </p>
              </div>
            ) : (
              /* ── VERIFIED / STALE state with real stats ── */
              <>
                {/* Total Solved Banner */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-500/10 to-indigo-500/10 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-between">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">Total Problems Solved</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {totalSolved}
                  </span>
                </div>

                {/* Difficulty Breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Easy</span>
                    <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">{easy}</span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider">Med</span>
                    <span className="text-base font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{medium}</span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex flex-col items-center">
                    <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 tracking-wider">Hard</span>
                    <span className="text-base font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">{hard}</span>
                  </div>
                </div>

                {/* Recent Contest Performance Badge */}
                {student.stats?.recent_contest_name && (
                  <div className="p-2.5 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{student.stats.recent_contest_name}</span>
                    <span className="text-xs font-black text-brand-600 dark:text-brand-400 font-mono">{student.stats.recent_contest_score || '3 / 4'}</span>
                  </div>
                )}

                {/* Contest Rating / Contest Rank / Profile Rank */}
                <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                    <span className="text-gray-400 font-bold block uppercase">Rating</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-xs">
                      {isSolver && student.stats?.contest_rating ? student.stats.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1 }) : 'Unrated'}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
                    <span className="text-gray-400 font-bold block uppercase">Contest Rank</span>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">
                      {isSolver && student.stats?.contest_global_ranking ? `#${student.stats.contest_global_ranking.toLocaleString('en-US')}` : 'Unranked'}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                    <span className="text-gray-400 font-bold block uppercase">Profile Rank</span>
                    <span className="font-mono font-black text-gray-700 dark:text-gray-300 text-xs">
                      {isSolver && student.stats?.public_profile_ranking ? `#${student.stats.public_profile_ranking.toLocaleString('en-US')}` : 'Unranked'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Verification Footer — only shown for verified/stale */}
            {isVerified && (
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                <span className="flex items-center space-x-1">
                  <span className={`w-2 h-2 rounded-full ${state === 'stale' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span>Source: LeetCode Public Profile</span>
                </span>
                <span className="text-[10px] text-gray-400">
                  {state === 'stale' ? `🟡 Stale • ${verifiedAgo}` : lastVerifiedAt ? `🟢 Verified ${verifiedAgo}` : '—'}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectStudent) onSelectStudent(student);
              }}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-md shadow-brand-600/30 transition-all flex items-center justify-center space-x-1.5"
            >
              <span>View Full Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {onDeleteStudent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteStudent(student);
                }}
                className="p-2.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-gray-200 dark:border-gray-800 transition-colors"
                title="Delete Student Record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
