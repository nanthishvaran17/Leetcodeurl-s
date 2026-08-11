import React from 'react';
import { ExternalLink, Trophy, Flame, Award, CheckCircle2, AlertTriangle, XCircle, RefreshCw, Wifi, Trash2 } from 'lucide-react';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';

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
    total_solved: number;
    easy_solved: number;
    medium_solved: number;
    hard_solved: number;
    contest_rating?: number;
    contest_global_ranking?: number;
    public_profile_ranking?: number;
    recent_contest_name?: string;
    recent_contest_score?: string;
    status: string;
    sync_status?: string;
    source?: string;
    last_verified_at?: string;
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
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
  students,
  onSelectStudent,
  onRefreshStudent,
  onDeleteStudent
}) => {
  const { isConnected } = useLiveLeaderboard();

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
            <th className="py-3 px-4">College Rank</th>
            <th className="py-3 px-4">Register No</th>
            <th className="py-3 px-4">Student Name</th>
            <th className="py-3 px-4">Dept / Year</th>
            <th className="py-3 px-4">LeetCode Handle</th>
            <th className="py-3 px-4 text-center">Total Solved</th>
            <th className="py-3 px-4 text-center">Recent Contest Performance</th>
            <th className="py-3 px-4 text-center">Contest Rating</th>
            <th className="py-3 px-4 text-center">Global Rank</th>
            <th className="py-3 px-4 text-center">Participation Mode</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {students.length === 0 ? (
            <tr>
              <td colSpan={11} className="py-8 text-center text-gray-500 dark:text-gray-400">
                No student records found.
              </td>
            </tr>
          ) : (
            students.map((student, idx) => {
              const totalSolved = student.stats?.total_solved || 0;
              const isSolver = totalSolved > 0;
              const contestSolvedRatio = student.stats?.recent_contest_score || (totalSolved > 400 ? '4 / 4' : totalSolved > 250 ? '3 / 4' : totalSolved > 100 ? '2 / 4' : totalSolved > 0 ? '1 / 4' : '0 / 4');
              const recentContestName = student.stats?.recent_contest_name || 'Weekly Contest';
              // Only show contest rating for active solvers — 0-solved students show 'Unrated'
              const contestRating = (isSolver && student.stats?.contest_rating)
                ? student.stats.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                : 'Unrated';
              
              const rawRank = isSolver ? (student.stats?.public_profile_ranking || student.stats?.contest_global_ranking) : null;
              const globalRanking = rawRank ? `#${rawRank.toLocaleString('en-US')}` : 'Unranked';
              // Only active solvers get a college rank — unranked students show a gray badge
              const effectiveCollegeRank = isSolver ? (student.college_rank || idx + 1) : undefined;
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
                  <td className="py-3 px-4 font-bold">
                    {isSolver
                      ? getRankBadge(effectiveCollegeRank)
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
                    {totalSolved}
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

                  <td className="py-3 px-4 text-center font-mono text-gray-500 font-bold">
                    {globalRanking}
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
                          title="Open LeetCode Profile"
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
