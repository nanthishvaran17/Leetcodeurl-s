import React, { useState, useEffect } from 'react';
import { Building2, TrendingUp, Users, Award, ChevronRight } from 'lucide-react';
import api from '../../services/api';

interface DeptData {
  dept: string;
  total: number;
  attended: number;
  notAttended: number;
  errors: number;
  pending: number;
  totalSolves: number;
  avgSolved: number;
  participationPct: number;
  topPerformer?: { name: string; regNo: string; year: string; totalSolved: number; rank?: number } | null;
  questionCounts?: { q1: number; q2: number; q3: number; q4: number };
}

interface DepartmentAnalyticsGridProps {
  sessionId: number | null;
  matrixRows?: any[];
}

// Compute from matrix rows as fallback
const computeFromMatrix = (matrixRows: any[]): DeptData[] => {
  const map: Record<string, any[]> = {};
  for (const r of matrixRows) {
    const d = r.dept || r.department || 'Unknown';
    if (!map[d]) map[d] = [];
    map[d].push(r);
  }
  return Object.entries(map).map(([dept, rows]) => {
    const attended = rows.filter(r => ['PUBLIC','PUBLIC_ATTENDED','ATTENDED','VIRTUAL','VIRTUAL_ATTENDED'].includes(r.participation_status || r.status || ''));
    const notAttended = rows.filter(r => ['NOT_ATTENDED','PUBLIC_NOT_ATTENDED'].includes(r.participation_status || r.status || ''));
    const errors = rows.filter(r => ['DATA_ERROR','USERNAME_NOT_FOUND','UNKNOWN'].includes(r.participation_status || r.status || ''));
    const totalSolves = attended.reduce((s, r) => s + (Number(r.total_solved || r.total_contest_solved) || 0), 0);
    const avgSolved = attended.length > 0 ? Math.round((totalSolves / attended.length) * 100) / 100 : 0;
    const best = attended.sort((a,b) => (Number(b.total_solved||b.total_contest_solved)||0) - (Number(a.total_solved||a.total_contest_solved)||0))[0];
    return {
      dept, total: rows.length, attended: attended.length, notAttended: notAttended.length, errors: errors.length, pending: 0,
      totalSolves, avgSolved, participationPct: rows.length > 0 ? Math.round((attended.length / rows.length) * 100 * 10) / 10 : 0,
      topPerformer: best ? { name: best.name, regNo: best.reg_no, year: best.year, totalSolved: Number(best.total_solved||best.total_contest_solved)||0, rank: best.rank } : null,
      questionCounts: { q1: attended.filter(r => (r.q1||0)>0).length, q2: attended.filter(r => (r.q2||0)>0).length, q3: attended.filter(r => (r.q3||0)>0).length, q4: attended.filter(r => (r.q4||0)>0).length }
    };
  }).sort((a,b) => b.attended - a.attended);
};

const pctColor = (pct: number) => pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-rose-400';
const pctBg = (pct: number) => pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';

export const DepartmentAnalyticsGrid: React.FC<DepartmentAnalyticsGridProps> = ({ sessionId, matrixRows = [] }) => {
  const [depts, setDepts] = useState<DeptData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    api.get(`/contests/sessions/${sessionId}/dept-analytics`)
      .then(res => {
        if (res.data?.departments?.length > 0) {
          setDepts(res.data.departments);
        } else if (matrixRows.length > 0) {
          setDepts(computeFromMatrix(matrixRows));
        }
      })
      .catch(() => {
        if (matrixRows.length > 0) setDepts(computeFromMatrix(matrixRows));
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Recompute from matrix rows when they update (live sync patches)
  useEffect(() => {
    if (matrixRows.length > 0 && depts.length === 0) {
      setDepts(computeFromMatrix(matrixRows));
    }
  }, [matrixRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 rounded-full border-2 border-brand-500 border-t-transparent animate-spin mr-2" />
        <span className="text-xs text-gray-400">Loading department analytics...</span>
      </div>
    );
  }

  if (depts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-brand-500" />
        <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">Department Analytics</h4>
        <span className="text-[10px] font-mono text-gray-500">({depts.length} departments)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {depts.map(d => (
          <div key={d.dept} className="p-4 rounded-2xl bg-white dark:bg-navy-950 border border-gray-200 dark:border-gray-800 shadow-sm space-y-3 hover:shadow-md transition-shadow">
            {/* Dept header */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-400 truncate max-w-[100px]">{d.dept}</span>
              <span className={`text-xs font-mono font-black ${pctColor(d.participationPct)}`}>{d.participationPct}%</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-1 text-center">
              <div>
                <span className="text-[9px] text-gray-500 uppercase block">Total</span>
                <span className="text-sm font-mono font-black text-gray-300">{d.total}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 uppercase block">Participated</span>
                <span className="text-sm font-mono font-black text-emerald-400">{d.attended}</span>
              </div>
              <div>
                <span className="text-[9px] text-gray-500 uppercase block">Avg Solved</span>
                <span className="text-sm font-mono font-black text-indigo-400">{d.avgSolved}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${pctBg(d.participationPct)} transition-all duration-700`}
                style={{ width: `${d.participationPct}%` }}
              />
            </div>

            {/* Q1-Q4 mini solve bar */}
            {d.questionCounts && (
              <div className="grid grid-cols-4 gap-1">
                {[1,2,3,4].map(q => {
                  const cnt = (d.questionCounts as any)[`q${q}`] || 0;
                  const pct = d.attended > 0 ? Math.round((cnt / d.attended) * 100) : 0;
                  const colors = ['bg-emerald-500','bg-purple-500','bg-indigo-500','bg-rose-500'];
                  return (
                    <div key={q} className="text-center">
                      <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden mb-0.5">
                        <div className={`h-full ${colors[q-1]} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[9px] text-gray-500 font-mono">Q{q}:{cnt}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Top performer */}
            {d.topPerformer && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-gray-800">
                <Award className="w-3 h-3 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-gray-900 dark:text-white block truncate">{d.topPerformer.name}</span>
                  <span className="text-[9px] text-gray-500">{d.topPerformer.totalSolved}Q solved</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
