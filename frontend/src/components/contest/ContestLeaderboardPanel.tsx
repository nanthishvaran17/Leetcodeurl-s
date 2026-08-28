import React, { useState, useEffect } from 'react';
import { Trophy, Building2, GraduationCap, ChevronRight, Medal, Crown } from 'lucide-react';
import api from '../../services/api';

interface LeaderboardEntry {
  rank: number;
  studentId: number;
  name: string;
  regNo: string;
  dept: string;
  year: string;
  q1: number; q2: number; q3: number; q4: number;
  totalSolved: number;
  score: number;
  contestRank?: number;
  participationStatus?: string;
}

interface ContestLeaderboardPanelProps {
  sessionId: number | null;
  matrixRows?: any[];
}

type TierType = 'overall' | 'dept' | 'year';

const qColors = ['text-emerald-400','text-purple-400','text-indigo-400','text-rose-400'];

const computeOverallFromMatrix = (matrixRows: any[]): LeaderboardEntry[] => {
  return matrixRows
    .filter(r => ['PUBLIC','PUBLIC_ATTENDED','ATTENDED','VIRTUAL','VIRTUAL_ATTENDED'].includes(r.participation_status || r.status || ''))
    .sort((a,b) => {
      const sa = Number(a.total_solved||a.total_contest_solved)||0;
      const sb = Number(b.total_solved||b.total_contest_solved)||0;
      if (sb !== sa) return sb - sa;
      const ra = Number(a.rank||a.contest_rank)||999999;
      const rb = Number(b.rank||b.contest_rank)||999999;
      return ra - rb;
    })
    .slice(0, 25)
    .map((r, idx) => ({
      rank: idx+1, studentId: r.student_id||r.id, name: r.name, regNo: r.reg_no,
      dept: r.dept||r.department, year: r.year||r.year_level,
      q1: r.q1||0, q2: r.q2||0, q3: r.q3||0, q4: r.q4||0,
      totalSolved: Number(r.total_solved||r.total_contest_solved)||0,
      score: Number(r.score||r.contest_score)||0, contestRank: Number(r.rank||r.contest_rank)||undefined,
      participationStatus: r.participation_status||r.status
    }));
};

const computeDeptFromMatrix = (matrixRows: any[]): Record<string, LeaderboardEntry[]> => {
  const depts: Record<string, LeaderboardEntry[]> = {};
  matrixRows
    .filter(r => ['PUBLIC','PUBLIC_ATTENDED','ATTENDED','VIRTUAL','VIRTUAL_ATTENDED'].includes(r.participation_status || r.status || ''))
    .forEach(r => {
      const d = r.dept || r.department || 'Unknown';
      if (!depts[d]) depts[d] = [];
      depts[d].push({
        rank: 0, studentId: r.student_id||r.id, name: r.name, regNo: r.reg_no,
        dept: d, year: r.year||r.year_level,
        q1: r.q1||0, q2: r.q2||0, q3: r.q3||0, q4: r.q4||0,
        totalSolved: Number(r.total_solved||r.total_contest_solved)||0,
        score: Number(r.score||r.contest_score)||0, contestRank: Number(r.rank||r.contest_rank)||undefined,
        participationStatus: r.participation_status||r.status
      });
    });
  
  Object.keys(depts).forEach(d => {
    depts[d] = depts[d]
      .sort((a,b) => {
        if (b.totalSolved !== a.totalSolved) return b.totalSolved - a.totalSolved;
        return (a.contestRank||999999) - (b.contestRank||999999);
      })
      .slice(0, 10)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  });
  return depts;
};

const computeYearFromMatrix = (matrixRows: any[]): Record<string, LeaderboardEntry[]> => {
  const years: Record<string, LeaderboardEntry[]> = {};
  matrixRows
    .filter(r => ['PUBLIC','PUBLIC_ATTENDED','ATTENDED','VIRTUAL','VIRTUAL_ATTENDED'].includes(r.participation_status || r.status || ''))
    .forEach(r => {
      const y = r.year || r.year_level || 'Unknown';
      if (!years[y]) years[y] = [];
      years[y].push({
        rank: 0, studentId: r.student_id||r.id, name: r.name, regNo: r.reg_no,
        dept: r.dept||r.department, year: y,
        q1: r.q1||0, q2: r.q2||0, q3: r.q3||0, q4: r.q4||0,
        totalSolved: Number(r.total_solved||r.total_contest_solved)||0,
        score: Number(r.score||r.contest_score)||0, contestRank: Number(r.rank||r.contest_rank)||undefined,
        participationStatus: r.participation_status||r.status
      });
    });
  
  Object.keys(years).forEach(y => {
    years[y] = years[y]
      .sort((a,b) => {
        if (b.totalSolved !== a.totalSolved) return b.totalSolved - a.totalSolved;
        return (a.contestRank||999999) - (b.contestRank||999999);
      })
      .slice(0, 10)
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  });
  return years;
};

const MedalIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return <Crown className="w-4 h-4 text-amber-400" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-gray-300" />;
  if (rank === 3) return <Medal className="w-4 h-4 text-amber-600" />;
  return <span className="text-xs font-mono font-black text-gray-500 w-4 text-center">#{rank}</span>;
};

export const ContestLeaderboardPanel: React.FC<ContestLeaderboardPanelProps> = ({ sessionId, matrixRows = [] }) => {
  const [activeTier, setActiveTier] = useState<TierType>('overall');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [deptData, setDeptData] = useState<Record<string, LeaderboardEntry[]>>({});
  const [yearData, setYearData] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const fetchTier = (tier: TierType) => {
    if (!sessionId) return;
    setLoading(true);
    // Use dynamic client-side computation to support real-time websocket patches
    setTimeout(() => {
      if (tier === 'overall') {
        setEntries(computeOverallFromMatrix(matrixRows));
      } else if (tier === 'dept') {
        const deps = computeDeptFromMatrix(matrixRows);
        setDeptData(deps);
        setSelectedGroup(Object.keys(deps)[0] || '');
      } else if (tier === 'year') {
        const yrs = computeYearFromMatrix(matrixRows);
        setYearData(yrs);
        setSelectedGroup(Object.keys(yrs)[0] || '');
      }
      setLoading(false);
    }, 100);
  };

  useEffect(() => { fetchTier('overall'); }, [sessionId]);

  const handleTier = (tier: TierType) => {
    setActiveTier(tier);
    fetchTier(tier);
  };

  useEffect(() => {
    if (activeTier === 'overall') {
      setEntries(computeOverallFromMatrix(matrixRows));
    } else if (activeTier === 'dept') {
      const deps = computeDeptFromMatrix(matrixRows);
      setDeptData(deps);
      if (!selectedGroup || !deps[selectedGroup]) setSelectedGroup(Object.keys(deps)[0] || '');
    } else if (activeTier === 'year') {
      const yrs = computeYearFromMatrix(matrixRows);
      setYearData(yrs);
      if (!selectedGroup || !yrs[selectedGroup]) setSelectedGroup(Object.keys(yrs)[0] || '');
    }
  }, [matrixRows, activeTier]);

  const displayEntries: LeaderboardEntry[] = activeTier === 'overall'
    ? entries
    : activeTier === 'dept'
      ? (deptData[selectedGroup] || [])
      : (yearData[selectedGroup] || []);

  const groupKeys = activeTier === 'dept'
    ? Object.keys(deptData)
    : activeTier === 'year'
      ? ['I','II','III','IV'].filter(k => yearData[k])
      : [];

  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md space-y-4">
      {/* Header + Tier tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>Contest Leaderboard</span>
          {displayEntries.length > 0 && (
            <span className="text-[10px] font-mono text-gray-500">({displayEntries.length} entries)</span>
          )}
        </h4>
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-navy-950 border border-gray-200 dark:border-gray-800">
          {([
            { key: 'overall', label: 'Overall', icon: <Trophy className="w-3 h-3" /> },
            { key: 'dept',    label: 'By Dept', icon: <Building2 className="w-3 h-3" /> },
            { key: 'year',    label: 'By Year', icon: <GraduationCap className="w-3 h-3" /> },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => handleTier(t.key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeTier === t.key
                  ? 'bg-gradient-to-r from-indigo-600 to-brand-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Group selector for dept/year */}
      {groupKeys.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {groupKeys.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                selectedGroup === g
                  ? 'bg-brand-600 text-white border-brand-500'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-brand-500'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mr-2" />
          <span className="text-xs text-gray-400">Loading...</span>
        </div>
      )}

      {/* Table */}
      {!loading && displayEntries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-y-0.5">
            <thead>
              <tr className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
                <th className="text-left pl-2 py-1 w-8">#</th>
                <th className="text-left py-1">Student</th>
                <th className="text-left py-1">Dept</th>
                <th className="text-left py-1">Yr</th>
                <th className="text-center py-1 w-6">Q1</th>
                <th className="text-center py-1 w-6">Q2</th>
                <th className="text-center py-1 w-6">Q3</th>
                <th className="text-center py-1 w-6">Q4</th>
                <th className="text-center py-1">Solved</th>
                <th className="text-right py-1 pr-2">LC Rank</th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map(e => (
                <tr key={`${e.rank}-${e.regNo}`} className={`rounded-lg ${
                  e.rank <= 3 ? 'bg-amber-500/5 dark:bg-amber-500/5' : 'bg-gray-50 dark:bg-navy-950/50'
                } hover:bg-brand-500/5 transition-colors`}>
                  <td className="pl-2 py-2 rounded-l-xl">
                    <div className="flex items-center justify-center w-6">
                      <MedalIcon rank={e.rank} />
                    </div>
                  </td>
                  <td className="py-2">
                    <div>
                      <span className="font-bold text-gray-900 dark:text-white">{e.name}</span>
                      <span className="text-[10px] text-gray-400 block font-mono">{e.regNo}</span>
                    </div>
                  </td>
                  <td className="py-2 text-indigo-400 font-bold">{e.dept}</td>
                  <td className="py-2 text-gray-400 font-mono">{e.year}</td>
                  {[e.q1,e.q2,e.q3,e.q4].map((q,idx) => (
                    <td key={idx} className="py-2 text-center">
                      {q > 0
                        ? <span className={`font-bold ${qColors[idx]}`}>1</span>
                        : <span className="text-gray-600 font-bold">0</span>
                      }
                    </td>
                  ))}
                  <td className="py-2 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-black text-[11px]">
                      {e.totalSolved}/4
                    </span>
                  </td>
                  <td className="py-2 text-right pr-2">
                    {e.contestRank
                      ? <span className="font-mono text-amber-400 font-bold">#{e.contestRank}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && displayEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500 space-y-1">
          <Trophy className="w-6 h-6 text-gray-600" />
          <p className="text-xs">No participants yet. Start the contest to see leaderboard.</p>
        </div>
      )}
    </div>
  );
};
