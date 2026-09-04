import React, { memo } from 'react';
import { useStudentEntity } from '../stores/studentLiveStore';
import { Clock, AlertCircle, Trophy, Flame, Award, TrendingUp, RefreshCw, Trash2, Edit3, Eye, ExternalLink } from 'lucide-react';

function getRankBadge(rank?: number) {
  if (!rank || rank <= 0) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-300">Unranked</span>;
  if (rank === 1) return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-sm"><Trophy className="w-3.5 h-3.5 text-amber-500" /><span>#1</span></span>;
  if (rank === 2) return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300 shadow-sm"><Trophy className="w-3.5 h-3.5 text-slate-500" /><span>#2</span></span>;
  if (rank === 3) return <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-300 shadow-sm"><Trophy className="w-3.5 h-3.5 text-orange-500" /><span>#3</span></span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white text-slate-700 border border-slate-200">#{rank}</span>;
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
  
  const effectiveCollegeRank = student?.college_rank || (isSolver ? index + 1 : undefined);
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
      onClick={() => onView(student)}
      className="flex items-center hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10 transition-colors duration-150 group font-medium text-xs border-b border-slate-100 dark:border-navy-800/60 cursor-pointer w-[1450px] min-w-full"
    >
      <div className="flex-none w-10 text-center px-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleStudent(student.id)}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
        />
      </div>

      <div className="flex-none w-24 px-3 font-bold" onClick={(e) => e.stopPropagation()}>
        {isSolver
          ? getRankBadge(effectiveCollegeRank)
          : syncState === 'pending'
            ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-400 border border-slate-300"><Clock className="w-3 h-3" /><span>Pending</span></span>
            : syncState === 'failed'
              ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-600 border border-rose-300"><AlertCircle className="w-3 h-3" /><span>Failed</span></span>
              : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-300">Unranked</span>
        }
      </div>

      <div className="flex-none w-32 px-3">
        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-navy-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-navy-700">
          {student.reg_no}
        </span>
      </div>

      <div className="flex-none w-72 px-3 flex flex-col justify-center text-left py-2">
        <button onClick={() => onView(student)} className="flex items-center space-x-3 w-full text-left">
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

      <div className="flex-none w-28 px-3 text-[11px] font-bold">
        <span className="text-slate-900 dark:text-white block">{student.department?.code || student.department?.name || '—'}</span>
        <span className="text-slate-500 dark:text-slate-400">{student.year_level} Yr</span>
      </div>

      <div className="flex-none w-40 px-3">
        {student.username ? (
          <a href={`https://leetcode.com/u/${student.username}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline">
            @{student.username}
          </a>
        ) : <span className="text-slate-400 text-[11px]">Not Linked</span>}
      </div>

      <div className={`flex-none w-24 px-3 py-1 rounded-lg text-center transition-colors ${flashSolved ? 'bg-emerald-200 dark:bg-emerald-800/50 duration-75' : 'bg-transparent duration-1000'}`}>
        {totalSolved !== null ? (
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{totalSolved}</span>
        ) : <span className="text-slate-400">—</span>}
      </div>

      <div className="flex-none w-32 px-3 flex items-center justify-center text-center">
        {(() => {
          const status = student.contest_status || 'NOT_ATTENDED';
          if (status === 'PUBLIC_ATTENDED' || status === 'PUBLIC' || status === 'ATTENDED') {
            return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[10px] tracking-wider uppercase">Public</span>;
          }
          if (status === 'VIRTUAL_ATTENDED' || status === 'VIRTUAL') {
            return <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-extrabold text-[10px] tracking-wider uppercase">Virtual</span>;
          }
          if (status === 'NOT_ATTENDED' || status === 'PUBLIC_NOT_ATTENDED' || status === 'ABSENT') {
            return <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-extrabold text-[10px] tracking-wider uppercase">Not Attended</span>;
          }
          return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-[10px] tracking-wider uppercase">Data Error</span>;
        })()}
      </div>

      <div className="flex-none w-24 px-3 text-center text-amber-500 font-bold">
        {student.stats?.contest_rating ? student.stats.contest_rating.toLocaleString() : '—'}
      </div>

      <div className="flex-none w-28 px-3 text-center text-indigo-500 font-bold">
        {student.stats?.contest_global_ranking ? `#${student.stats.contest_global_ranking.toLocaleString()}` : '—'}
      </div>

      <div className="flex-none w-28 px-3 text-center text-slate-600 font-bold">
        {student.stats?.public_profile_ranking ? `#${student.stats.public_profile_ranking.toLocaleString()}` : '—'}
      </div>

      <div className="flex-none w-32 px-3 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1 transition-opacity">
          <button onClick={() => onView(student)} className="p-1.5 rounded-xl text-brand-600 hover:bg-brand-50" title="View"><Eye className="w-4 h-4" /></button>
          <button onClick={() => onEdit(student)} className="p-1.5 rounded-xl text-amber-600 hover:bg-amber-50" title="Edit"><Edit3 className="w-4 h-4" /></button>
          <button onClick={() => onRefresh(student.id)} disabled={isSyncing} className={`p-1.5 rounded-xl ${isSyncing ? 'text-brand-500 animate-spin' : 'text-emerald-600 hover:bg-emerald-50'}`}><RefreshCw className="w-4 h-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(student, e); }} className="p-1.5 rounded-xl text-rose-600 hover:bg-rose-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
});
