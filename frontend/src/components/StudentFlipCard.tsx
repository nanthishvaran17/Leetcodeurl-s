import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Trophy, CheckCircle2, User, Trash2, ShieldCheck, Clock, AlertCircle, Loader, Crown, Award } from 'lucide-react';
import { StudentData } from './LeaderboardTable';
import { useStudentEntity } from '../stores/studentLiveStore';

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
  const easy        = isVerified ? (student.stats?.easy_solved   ?? 0) : null;
  const medium      = isVerified ? (student.stats?.medium_solved ?? 0) : null;
  const hard        = isVerified ? (student.stats?.hard_solved   ?? 0) : null;
  const isSolver    = (totalSolved ?? 0) > 0;

  const rank          = student.college_rank;
  const effectiveRank = isSolver ? rank : undefined;
  const verifiedAgo   = formatVerifiedAgo(lastVerifiedAt);

  const getRankBadgeStyle = (r?: number) => {
    if (!isSolver || !r) return 'bg-slate-50 dark:bg-navy-900/50 text-slate-600 dark:text-slate-400 font-bold';
    if (r === 1) return 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-extrabold shadow-sm';
    if (r === 2) return 'bg-gradient-to-r from-slate-200 to-slate-300 dark:from-navy-700 dark:to-navy-600 text-slate-900 dark:text-white font-extrabold shadow-sm';
    if (r === 3) return 'bg-gradient-to-r from-amber-600/80 to-amber-700/80 text-white font-extrabold shadow-sm';
    if (r <= 10) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold';
    return 'bg-slate-50 dark:bg-navy-900/50 text-slate-700 dark:text-slate-300 font-extrabold';
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
      <span className="flex items-center space-x-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
        <Clock className="w-3.5 h-3.5" />
        <span>{verifiedAgo}</span>
      </span>
    );
    // verified
    return (
      <span className="flex items-center space-x-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        <span>{verifiedAgo}</span>
      </span>
    );
  };

  const auraClass = effectiveRank === 1 ? 'gold-aura ring-2 ring-amber-400/50' :
                    effectiveRank === 2 ? 'silver-aura ring-2 ring-slate-300/50' :
                    effectiveRank === 3 ? 'bronze-aura ring-2 ring-amber-600/50' : '';

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`w-full min-h-[360px] flex flex-col perspective-1000 cursor-pointer group min-w-0 rounded-3xl ${auraClass}`}
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full h-full min-h-[360px] flex flex-col duration-500 transform-style-3d transition-transform ease-out-expo ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* FRONT SIDE */}
        <div className="absolute inset-0 w-full h-full min-h-[360px] p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-navy-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.2)] backface-hidden flex flex-col justify-between bg-white dark:bg-navy-950/80 backdrop-blur-xl transform translate-z-0 will-change-transform">
          
          {/* Card Top: Rank & Department Pill */}
          <div className="flex items-center justify-between gap-2">
            <span className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider flex items-center space-x-1.5 whitespace-nowrap ${getRankBadgeStyle(effectiveRank)}`}>
              {effectiveRank === 1 ? (
                <>
                  <Crown className="w-3.5 h-3.5 fill-amber-400 stroke-amber-900 animate-pulse" />
                  <span>Rank #1</span>
                </>
              ) : effectiveRank === 2 ? (
                <>
                  <Trophy className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                  <span>Rank #2</span>
                </>
              ) : effectiveRank === 3 ? (
                <>
                  <Award className="w-3.5 h-3.5 text-amber-100" />
                  <span>Rank #3</span>
                </>
              ) : effectiveRank ? (
                <span>Rank #{effectiveRank}</span>
              ) : (
                <span>Unranked</span>
              )}
            </span>
            <span className="font-black text-[10px] tracking-wider uppercase text-slate-400 dark:text-slate-500">
              {student.department?.code || student.department || 'DEPT'}
            </span>
          </div>

          {/* Card Center: Avatar & Student Details */}
          <div className="text-center space-y-3 py-2 flex-1 flex flex-col justify-center min-w-0">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
              className="relative w-24 h-24 mx-auto shrink-0"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-brand-400/20 to-indigo-500/20 rounded-full blur-xl animate-pulse-slow"></div>
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-brand-500 via-indigo-600 to-navy-800 text-white font-black text-3xl flex items-center justify-center shadow-lg border-2 border-white dark:border-navy-900">
                {student.name ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2) : <User className="w-10 h-10" />}
              </div>
            </motion.div>
            
            <div className="min-w-0 px-1 pt-1">
              <h3 className="font-black text-lg text-slate-900 dark:text-white truncate max-w-full tracking-tight" title={student.name}>
                {student.name}
              </h3>
              <div className="flex items-center justify-center space-x-2 mt-1">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold tracking-wider truncate">
                  {student.reg_no}
                </p>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-navy-600"></span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold truncate">
                  {(student.year_level || student.year || '').toString().replace(/\s*year/i, '')} Yr • {student.section?.name || student.section || ''}
                </p>
              </div>
            </div>
          </div>

          {/* Card Bottom: Quick Stats & Sync Badge */}
          <div className="pt-4 flex flex-col items-center justify-center gap-1 mt-auto">
            {isVerified ? (
              <div className="flex flex-col items-center">
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-teal-600 drop-shadow-sm leading-none">
                  {totalSolved}
                </span>
                <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-widest mt-1">
                  Problems Solved
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[52px]">
                <span className="text-xs font-bold text-slate-400">Stats Unavailable</span>
              </div>
            )}
            
            <div className="mt-3 flex items-center justify-center">
              <SyncBadge />
            </div>
          </div>

        </div>

        {/* BACK SIDE */}
        <div className="absolute inset-0 w-full h-full min-h-[360px] p-5 sm:p-6 rounded-3xl border border-slate-100 dark:border-navy-800 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] backface-hidden rotate-y-180 flex flex-col bg-white dark:bg-navy-950/90 backdrop-blur-2xl transform translate-z-0 will-change-transform">

          {/* Top Header */}
          <div className="flex items-center justify-between pb-3 shrink-0">
            <div className="flex items-center space-x-2 min-w-0">
              <ShieldCheck className="w-5 h-5 text-brand-500 shrink-0" />
              <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate tracking-tight" title={student.name}>{student.name}</span>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
          </div>

          {/* Clean Line Divider */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-navy-700 to-transparent shrink-0" />

          {/* Stats Breakdown Container - Clean Typography (No boxes) */}
          <div className="flex-1 flex flex-col justify-center py-4 min-w-0">
            
            {!isVerified ? (
              <div className="text-center space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-navy-600 mb-4" />
                <p className="font-extrabold text-sm text-slate-700 dark:text-slate-300">
                  {state === 'pending_username' ? 'Pending LeetCode Username' :
                   state === 'pending' ? 'Awaiting Scheduled Sync' :
                   state === 'mismatch' ? 'Data Mismatch Detected' : 'Stats Unavailable'}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  {state === 'pending_username' && 'Awaiting valid LeetCode profile assignment'}
                  {state === 'pending' && 'Scheduled for background sync'}
                  {state === 'failed' && (lastVerifiedAt ? `Last verified: ${verifiedAgo}` : 'Never successfully synced')}
                  {state === 'mismatch' && 'Easy + Medium + Hard ≠ Total'}
                </p>
                <p className="text-xs font-black text-brand-500 mt-2 truncate">
                  {student.username || '—'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Total & Difficulty (Seamless layout) */}
                <div className="text-center">
                  <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">
                    {totalSolved}
                  </span>
                  <div className="text-[10px] font-extrabold uppercase text-slate-400 tracking-widest mt-1 mb-4">
                    Total Solved
                  </div>

                  <div className="flex justify-center items-center gap-6">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black text-emerald-500">{easy}</span>
                      <span className="text-[9px] font-extrabold uppercase text-emerald-700/70 dark:text-emerald-400/70 tracking-widest">Easy</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-navy-800" />
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black text-amber-500">{medium}</span>
                      <span className="text-[9px] font-extrabold uppercase text-amber-700/70 dark:text-amber-400/70 tracking-widest">Med</span>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-navy-800" />
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-black text-rose-500">{hard}</span>
                      <span className="text-[9px] font-extrabold uppercase text-rose-700/70 dark:text-rose-400/70 tracking-widest">Hard</span>
                    </div>
                  </div>
                </div>

                {/* Clean Line Divider */}
                <div className="h-px w-2/3 mx-auto bg-gradient-to-r from-transparent via-slate-200 dark:via-navy-700 to-transparent" />

                {/* Additional Stats */}
                <div className="grid grid-cols-2 gap-4 text-center px-4">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">Contest Rank</span>
                    <span className="text-sm font-black text-indigo-500 truncate max-w-full">
                      {(() => {
                        const status = (student as any).contest_status || 'NOT_ATTENDED';
                        const isAttended = status === 'PUBLIC_ATTENDED' || status === 'PUBLIC' || status === 'ATTENDED' || status === 'VIRTUAL_ATTENDED' || status === 'VIRTUAL';
                        const rawRank = student.stats?.contest_global_ranking ?? (student as any).contest_global_ranking;
                        if (!isAttended || !rawRank || rawRank === 50000) return '—';
                        return `#${Number(rawRank).toLocaleString('en-US')}`;
                      })()}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">Global Rank</span>
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200 truncate max-w-full">
                      {(() => {
                        const rawProfileRank = student.stats?.public_profile_ranking ?? (student as any).public_profile_ranking;
                        if (!rawProfileRank || rawProfileRank >= 5000000 || rawProfileRank <= 0) return '—';
                        return `#${Number(rawProfileRank).toLocaleString('en-US')}`;
                      })()}
                    </span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Action Footer: Buttons */}
          <div className="flex items-center space-x-2 pt-4 mt-auto shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectStudent) onSelectStudent(student);
              }}
              className="flex-1 min-h-[44px] rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-extrabold text-xs shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
            >
              <span>View Profile</span>
            </button>

            {onDeleteStudent && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteStudent(student);
                }}
                className="w-11 min-h-[44px] flex items-center justify-center rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer active:scale-95"
                title="Delete Student Record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </div>
    </motion.div>
  );
};

export const StudentFlipCard = React.memo(StudentFlipCardComponent);
