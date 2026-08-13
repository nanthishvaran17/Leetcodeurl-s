import React from 'react';
import { ExternalLink, Trophy, Flame, Award, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Wifi, Trash2, Clock, AlertCircle } from 'lucide-react';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';

function parseUtcTime(ts?: string): number {
  if (!ts) return Date.now();
  let str = ts.trim();
  if (!str.endsWith('Z') && !str.includes('+')) {
    str += 'Z';
  }
  const time = new Date(str).getTime();
  return isNaN(time) ? Date.now() : time;
}

// Sync state helpers — mirrors StudentFlipCard logic
function getSyncState(syncStatus?: string, lastVerifiedAt?: string): 'pending'|'syncing'|'verified'|'failed'|'mismatch'|'stale'|'invalid_profile' {
  if (syncStatus === 'invalid_profile' || syncStatus === 'INVALID_LINK' || syncStatus === 'MISSING_LINK') return 'invalid_profile';
  if (syncStatus === 'syncing') return 'syncing';
  if (!syncStatus || syncStatus === 'pending' || syncStatus === 'not_started') return 'pending';
  if (syncStatus === 'success' || syncStatus === 'OK' || syncStatus === 'verified' || syncStatus === 'stale') {
    if (lastVerifiedAt) {
      const age = Date.now() - parseUtcTime(lastVerifiedAt);
      if (age > 24 * 60 * 60 * 1000) return 'stale';
    }
    return 'verified';
  }
  if (syncStatus === 'mismatch' || syncStatus === 'data_mismatch') return 'mismatch';
  return 'failed';
}
function formatAgo(ts?: string): string {
  if (!ts) return 'just now';
  const diffMs = Date.now() - parseUtcTime(ts);
  if (diffMs <= 0) return 'just now';
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export interface StudentData {
  id: number;
  reg_no: string;
  name: string;
  email?: string;
  department_id?: number;
  department?: { id?: number; name: string; code: string };
  year_level: string;
  section?: { name: string };
  leetcode_url?: string;
  username?: string;
  stats?: {
    total_solved: number | null;
    easy_solved: number | null;
    medium_solved: number | null;
    hard_solved: number | null;
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
  consistency_score?: number;
  badge_list?: string[];
}

interface LeaderboardTableProps {
  students: StudentData[];
  onSelectStudent?: (student: StudentData) => void;
  onRefreshStudent?: (studentId: number) => void;
  onDeleteStudent?: (student: StudentData) => void;
  onBulkDeleteStudents?: (studentIds: number[]) => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  students,
  onSelectStudent,
  onRefreshStudent,
  onDeleteStudent,
  onBulkDeleteStudents
}) => {
  const { isConnected } = useLiveLeaderboard();
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);

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

  const handleTriggerBulkDelete = () => {
    if (onBulkDeleteStudents) {
      onBulkDeleteStudents(selectedIds);
      setSelectedIds([]);
    } else if (onDeleteStudent) {
      if (confirm(`Are you sure you want to delete ${selectedIds.length} selected students?`)) {
        selectedIds.forEach(id => {
          const st = students.find(s => s.id === id);
          if (st) onDeleteStudent(st);
        });
        setSelectedIds([]);
      }
    }
  };

  const getRankBadge = (rank?: number) => {
    if (!rank) return null;
    if (rank === 1) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">🥇 #1</span>;
    if (rank === 2) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300">🥈 #2</span>;
    if (rank === 3) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-800/20 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-600/30">🥉 #3</span>;
    return <span className="text-xs font-semibold text-gray-500">#{rank}</span>;
  };

  const getStatusBadge = (status: string = "DATA UNAVAILABLE") => {
    if (status === "OK" || status === "STARTED") {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
          <CheckCircle2 className="w-3 h-3" />
          <span>OK</span>
        </span>
      );
    }
    if (status === "NOT STARTED" || status === "WARNING") {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
          <AlertTriangle className="w-3 h-3" />
          <span>NOT STARTED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
        <XCircle className="w-3 h-3" />
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="w-full space-y-2">
      {/* Bulk Delete Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl mb-3 text-rose-600 dark:text-rose-300">
          <div className="flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-rose-500 animate-bounce" />
            <span className="font-black text-xs md:text-sm">
              {selectedIds.length} Student{selectedIds.length > 1 ? 's' : ''} Selected
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-300 transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={handleTriggerBulkDelete}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center space-x-1.5 shadow-lg transition-transform transform hover:scale-105"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end px-2">
        <div className="flex items-center space-x-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>WebSocket Real-Time Live Push Active</span>
        </div>
      </div>
      
      <div className="w-full overflow-x-auto rounded-2xl glass-card border border-gray-200 dark:border-gray-800 shadow-lg">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100/80 dark:bg-navy-900/80 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-gray-800 uppercase tracking-wider">
            <th className="py-3 px-3 text-center w-10">
              <input
                type="checkbox"
                checked={students.length > 0 && selectedIds.length === students.length}
                onChange={toggleAll}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
              />
            </th>
            <th className="py-3 px-4">College Rank</th>
            <th className="py-3 px-4">Register No</th>
            <th className="py-3 px-4">Student Name</th>
            <th className="py-3 px-4">Dept / Year</th>
            <th className="py-3 px-4">LeetCode Handle</th>
            <th className="py-3 px-4 text-center">Total Solved</th>
            <th className="py-3 px-4 text-center">Recent Contest Performance</th>
            <th className="py-3 px-4 text-center">Contest Rating</th>
            <th className="py-3 px-4 text-center">Contest Rank</th>
            <th className="py-3 px-4 text-center">Profile Rank</th>
            <th className="py-3 px-4 text-center">Participation Mode</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {students.length === 0 ? (
            <tr>
              <td colSpan={13} className="py-8 text-center text-gray-500 dark:text-gray-400">
                No student records found.
              </td>
            </tr>
          ) : (
            students.map((student, idx) => {
              const syncState = getSyncState(student.stats?.sync_status, student.stats?.last_verified_at);
              const isVerified = syncState === 'verified' || syncState === 'stale';

              // RULE: Never show 0 for unverified students
              const totalSolved = isVerified ? (student.stats?.total_solved ?? 0) : null;
              const isSolver = isVerified && (totalSolved ?? 0) > 0;

              const contestSolvedRatio = student.stats?.recent_contest_score || (isVerified ? 'Not Attended' : '—');
              const recentContestName = student.stats?.recent_contest_name || 'Weekly Contest';

              const contestRating = (isVerified && student.stats?.contest_rating)
                ? student.stats.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : (isVerified ? 'Unrated' : '—');

              const contestRank = (isVerified && student.stats?.contest_global_ranking)
                ? `#${student.stats.contest_global_ranking.toLocaleString('en-US')}`
                : (isVerified ? 'Unranked' : '—');

              const profileRank = (isVerified && student.stats?.public_profile_ranking)
                ? `#${student.stats.public_profile_ranking.toLocaleString('en-US')}`
                : (isVerified ? 'Unranked' : '—');

              const effectiveCollegeRank = isSolver ? (student.college_rank || idx + 1) : undefined;
              const verifiedAgo = formatAgo(student.stats?.last_verified_at);
              const username = student.username || student.leetcode_url?.split('/u/')[1]?.replace('/', '') || `${student.name.replace(/\s+/g, '_')}`;

              // Determine Participation Mode (Public Live vs Not Started)
              let modeBadge = (
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-400/30">
                  <span>🟢 Public Live (08:00–09:30 AM)</span>
                </span>
              );

              if (totalSolved === 0 || student.stats?.status === "NOT STARTED") {
                modeBadge = (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-400/30">
                    <span>🔴 Not Yet Started</span>
                  </span>
                );
              } else if (student.stats?.status === "MISSING LINK" || student.stats?.status === "INVALID LINK") {
                modeBadge = (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-400/30">
                    <span>⚠️ Link Issue</span>
                  </span>
                );
              }

              return (
                <tr
                  key={student.id}
                  className="hover:bg-brand-50/40 dark:hover:bg-brand-900/20 transition-colors font-medium text-xs"
                >
                  <td className="py-3 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                    />
                  </td>

                  <td className="py-3 px-4 font-bold">
                    {isSolver
                      ? getRankBadge(effectiveCollegeRank)
                      : syncState === 'pending'
                        ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 border border-gray-300 dark:border-gray-700"><Clock className="w-3 h-3" /><span>Pending</span></span>
                        : syncState === 'failed'
                          ? <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 border border-rose-300"><AlertCircle className="w-3 h-3" /><span>Failed</span></span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-300 dark:border-gray-700">Unranked</span>
                    }
                  </td>

                  <td className="py-3 px-4 font-mono text-gray-500 font-bold">
                    {student.reg_no}
                  </td>

                  <td className="py-3 px-4">
                    <p 
                      onClick={() => onSelectStudent && onSelectStudent(student)}
                      className="font-bold text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 cursor-pointer"
                    >
                      {student.name}
                    </p>
                  </td>

                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-medium">
                    <span className="font-bold text-gray-900 dark:text-white">{student.department?.code}</span> • {student.year_level}
                  </td>

                  <td className="py-3 px-4 font-mono font-bold text-brand-600 dark:text-brand-400">
                    {username}
                  </td>

                  <td className="py-3 px-4 text-center font-bold text-gray-900 dark:text-white text-sm">
                    {!isVerified
                      ? <span className="text-gray-400 dark:text-gray-600 text-xs">{syncState === 'pending' ? '⏳ Pending' : syncState === 'failed' ? '🔴 Failed' : '—'}</span>
                      : totalSolved
                    }
                  </td>

                  <td className="py-3 px-4 text-center bg-brand-50/40 dark:bg-brand-950/20">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{recentContestName}</span>
                      <span className="font-black text-brand-600 dark:text-brand-400 text-sm">{contestSolvedRatio}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center font-mono font-bold text-amber-500">
                    {contestRating}
                  </td>

                  <td className="py-3 px-4 text-center font-mono font-bold text-indigo-500">
                    {contestRank}
                  </td>

                  <td className="py-3 px-4 text-center font-mono text-gray-500 font-bold">
                    {profileRank}
                  </td>

                  <td className="py-3 px-4 text-center">
                    {modeBadge}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {student.leetcode_url && (
                        <a
                          href={student.leetcode_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="View LeetCode Profile"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {onRefreshStudent && (
                        <button
                          onClick={() => onRefreshStudent(student.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          title="Refresh Stats"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      {onDeleteStudent && (
                        <button
                          onClick={() => onDeleteStudent(student)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Student Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
};
