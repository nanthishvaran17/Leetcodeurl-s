import React, { memo } from 'react';
import { useStudentEntity } from '../stores/studentLiveStore';
import { Clock, AlertCircle, Trophy, Flame, Award, TrendingUp, RefreshCw, Trash2, Edit3, Eye, ExternalLink } from 'lucide-react';

function getRankBadge(rank?: number) {
  if (!rank || rank <= 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-navy-700">Unranked</span>;
  if (rank === 1) return <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-white shadow-md shadow-amber-500/30 border border-amber-300/60"><Trophy className="w-3.5 h-3.5 text-white" /><span>#1</span></span>;
  if (rank === 2) return <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-slate-400 via-slate-500 to-slate-600 text-white shadow-md shadow-slate-500/20 border border-slate-300/60"><Trophy className="w-3.5 h-3.5 text-white" /><span>#2</span></span>;
  if (rank === 3) return <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-700 via-orange-600 to-orange-500 text-white shadow-md shadow-amber-700/20 border border-amber-600/60"><Trophy className="w-3.5 h-3.5 text-white" /><span>#3</span></span>;
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700">#{rank}</span>;
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

// million-ignore
export const FastStudentRow = memo(({ 
  studentId, 
  index, 
  style, 
  isSelected, 
  toggleStudent, 
  onView, 
  onEdit, 
  onRefresh, 
  onDelete 
}: any) => {
  const student = useStudentEntity(studentId);

  const syncState = getSyncState(student?.stats?.sync_status, student?.stats?.last_verified_at);
  const isVerified = syncState === 'verified' || syncState === 'stale';
  const totalSolved = (student && isVerified) ? (student.stats?.total_solved ?? 0) : null;
  const isSolver = isVerified && (totalSolved ?? 0) > 0;
  
  const effectiveCollegeRank = isSolver ? index + 1 : undefined;
  const isSyncing = syncState === 'fetching';

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

  if (!student) return null;

  return (
    <div 
      style={style} 
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest('button') ||
          (e.target as HTMLElement).closest('input') ||
          (e.target as HTMLElement).closest('a')
        ) {
          return;
        }
        onView(student, e);
      }}
      className="flex flex-col md:flex-row p-3 md:py-2.5 md:px-0 gap-3 md:gap-0 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10 transition-all duration-150 group font-medium text-xs border border-slate-200/80 md:border-t-0 md:border-x-0 md:border-b dark:border-navy-800/60 cursor-pointer w-full min-w-full md:min-w-[1100px] items-start md:items-center bg-white md:bg-transparent dark:bg-navy-950 md:dark:bg-transparent rounded-2xl md:rounded-none shadow-sm md:shadow-none mb-3 md:mb-0 min-h-[52px]"
    >
      {/* MOBILE LAYOUT (PREMIUM CARD DESIGN) */}
      <div className="flex md:hidden flex-col w-full p-4 space-y-3 bg-white dark:bg-navy-900/90 rounded-2xl border border-slate-200/90 dark:border-navy-700/80 shadow-md hover:shadow-xl transition-all duration-200 relative overflow-hidden backdrop-blur-md">
        
        {/* Top Header Row: Checkbox + Rank Badge on Left, Department/Year Pill on Right */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <input 
              type="checkbox" 
              checked={isSelected} 
              onChange={() => toggleStudent(student.id)} 
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer" 
              onClick={(e) => e.stopPropagation()} 
            />
            {isSolver ? getRankBadge(effectiveCollegeRank) : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-navy-700">Unranked</span>}
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100/90 dark:bg-navy-800/90 border border-slate-200/80 dark:border-navy-700/80 text-[11px] font-black tracking-tight text-slate-700 dark:text-slate-200 shadow-2xs">
            <span>{student.department?.code || student.department?.name || '—'}</span>
            <span className="text-slate-400 font-normal">•</span>
            <span>{String(student.year_level || '').replace(/\s*Yr\s*/gi, '').replace(/\s*Year\s*/gi, '').trim()} Yr</span>
          </div>
        </div>

        {/* Student Profile Info Row */}
        <div className="flex items-center gap-3 w-full">
          <div className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-600 to-purple-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-brand-500/20 ring-2 ring-white dark:ring-navy-900">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-black text-sm text-slate-900 dark:text-white truncate tracking-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {student.name}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                {student.reg_no}
              </span>
              {student.username && (
                <span className="font-mono text-[11px] font-bold text-brand-600 dark:text-brand-400 truncate">
                  @{student.username}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Row: Stats Chips & Action Buttons */}
        <div className="flex items-center justify-between w-full pt-3 border-t border-slate-100 dark:border-navy-800/80 gap-2 flex-wrap">
          
          {/* Solved & Rating Metric Chips */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-[200px]">
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">SOLVED</span>
              <span className="text-[11px] sm:text-xs font-black font-mono text-emerald-700 dark:text-emerald-300">{totalSolved ?? '—'}</span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">RATING</span>
              <span className="text-[11px] sm:text-xs font-black font-mono text-amber-700 dark:text-amber-300">
                {(() => {
                  const rawRating = student.stats?.contest_rating ?? (student as any).contest_rating;
                  if (rawRating == null || rawRating <= 0) return '—';
                  return Math.round(Number(rawRating)).toLocaleString();
                })()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(student, e); }} 
              className="w-9 h-9 rounded-xl text-brand-600 dark:text-brand-400 bg-brand-50 hover:bg-brand-500 hover:text-white dark:bg-brand-950/60 dark:hover:bg-brand-500 dark:hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs" 
              title="View Student"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(student, e); }} 
              className="w-9 h-9 rounded-xl text-amber-600 dark:text-amber-400 bg-amber-50 hover:bg-amber-500 hover:text-white dark:bg-amber-950/60 dark:hover:bg-amber-500 dark:hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs" 
              title="Edit Student"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            {onDelete && (
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(student, e); }} 
                className="w-9 h-9 rounded-xl text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-500 hover:text-white dark:bg-rose-950/60 dark:hover:bg-rose-500 dark:hover:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-xs" 
                title="Delete Student Record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT COLUMNS */}
      <div className="hidden md:flex flex-none w-10 items-center justify-center text-center px-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleStudent(student.id)}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
        />
      </div>

      <div className="hidden md:flex flex-none w-24 items-center justify-start px-3 font-bold" onClick={(e) => e.stopPropagation()}>
        {isSolver
          ? getRankBadge(effectiveCollegeRank)
          : syncState === 'pending'
            ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700"><Clock className="w-3 h-3" /><span>Pending</span></span>
            : syncState === 'failed'
              ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"><AlertCircle className="w-3 h-3" /><span>Failed</span></span>
              : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Unranked</span>
        }
      </div>

      <div className="hidden md:flex flex-none w-32 items-center justify-start px-3">
        <span className="font-mono text-xs font-extrabold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-md border border-slate-300 dark:border-navy-700">
          {student.reg_no}
        </span>
      </div>

      <div className="hidden md:flex flex-1 min-w-[200px] px-3 items-center justify-start text-left">
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(student, e); }} className="flex items-center space-x-3 w-full text-left">
          <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
            {student.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm text-slate-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {student.name}
            </p>
          </div>
        </button>
      </div>

      <div className="hidden md:flex flex-none w-36 px-3 text-[11px] font-bold items-center justify-start gap-0.5 self-center my-auto overflow-hidden min-h-[44px]">
        <span className="text-slate-900 dark:text-white truncate font-extrabold">{student.department?.code || student.department?.name || '—'}</span>
        <span className="text-slate-600 dark:text-slate-300 shrink-0 font-extrabold px-0.5">/</span>
        <span className="text-slate-800 dark:text-slate-200 shrink-0 font-extrabold">{String(student.year_level || '').replace(/\s*Yr\s*/gi, '').replace(/\s*Year\s*/gi, '').trim()} Yr</span>
      </div>

      <div className="hidden md:flex flex-1 min-w-[160px] px-3 flex-col justify-center self-center my-auto overflow-hidden min-h-[44px]">
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
              className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 shrink-0 mt-0.5 w-fit"
              onClick={(e) => e.stopPropagation()}
              title="Secondary LeetCode Account"
            >
              <span>Sec: @{secUser}</span>
            </a>
          );
        })()}
      </div>

      <div className={`hidden md:flex flex-none w-24 px-3 py-1 rounded-lg items-center justify-center text-center transition-colors ${flashSolved ? 'bg-emerald-200 dark:bg-emerald-800/50 duration-75' : 'bg-transparent duration-1000'}`}>
        {totalSolved !== null ? (
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{totalSolved}</span>
        ) : <span className="text-slate-400">—</span>}
      </div>

      <div className="hidden md:flex flex-none w-32 px-3 items-center justify-center text-center">
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

      <div className="hidden md:flex flex-none w-24 px-3 items-center justify-center text-center text-amber-600 dark:text-amber-400 font-extrabold">
        {(() => {
          const rawRating = student.stats?.contest_rating ?? (student as any).contest_rating;
          if (rawRating == null || rawRating <= 0) return '—';
          return Math.round(Number(rawRating)).toLocaleString();
        })()}
      </div>

      <div className="hidden md:flex flex-none w-28 px-3 items-center justify-center text-center text-indigo-700 dark:text-indigo-300 font-extrabold">
        {(() => {
          const rawRank = student.stats?.contest_global_ranking ?? (student as any).contest_global_ranking;
          if (rawRank == null || rawRank <= 0 || rawRank === 50000) return '—';
          return `#${Number(rawRank).toLocaleString()}`;
        })()}
      </div>

      <div className="hidden md:flex flex-none w-28 px-3 items-center justify-center text-center text-slate-900 dark:text-slate-100 font-extrabold">
        {(() => {
          const rawProfileRank = student.stats?.public_profile_ranking ?? (student as any).public_profile_ranking;
          if (!rawProfileRank || rawProfileRank >= 5000000 || rawProfileRank <= 0) return '—';
          return `#${Number(rawProfileRank).toLocaleString()}`;
        })()}
      </div>

      <div className="hidden md:flex flex-none w-32 px-3 items-center justify-center text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1 transition-opacity">
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(student, e); }} className="p-1.5 rounded-xl text-brand-600 hover:bg-brand-50" title="View"><Eye className="w-4 h-4" /></button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(student, e); }} className="p-1.5 rounded-xl text-amber-600 hover:bg-amber-50" title="Edit"><Edit3 className="w-4 h-4" /></button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRefresh(student.id); }} disabled={isSyncing} className={`p-1.5 rounded-xl ${isSyncing ? 'text-brand-500 animate-spin' : 'text-emerald-600 hover:bg-emerald-50'}`}><RefreshCw className="w-4 h-4" /></button>
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(student, e); }} className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
});
