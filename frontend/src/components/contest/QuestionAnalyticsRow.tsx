import React, { useMemo } from 'react';
import { Target } from 'lucide-react';

interface QuestionAnalyticsRowProps {
  matrixRows: any[];
}

export const QuestionAnalyticsRow: React.FC<QuestionAnalyticsRowProps> = ({ matrixRows }) => {
  const stats = useMemo(() => {
    const attended = matrixRows.filter(r => ['PUBLIC','PUBLIC_ATTENDED','ATTENDED','VIRTUAL','VIRTUAL_ATTENDED'].includes(r.participation_status || r.status || ''));
    const total = attended.length;
    
    let q1 = 0, q2 = 0, q3 = 0, q4 = 0;
    attended.forEach(r => {
      if (Number(r.q1) === 1) q1++;
      if (Number(r.q2) === 1) q2++;
      if (Number(r.q3) === 1) q3++;
      if (Number(r.q4) === 1) q4++;
    });

    const getPct = (cnt: number) => total > 0 ? ((cnt / total) * 100).toFixed(1) : '0.0';

    const arr = [
      { id: 'Q1', diff: 'Easy', count: q1, pct: getPct(q1), color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800/50' },
      { id: 'Q2', diff: 'Medium', count: q2, pct: getPct(q2), color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800/50' },
      { id: 'Q3', diff: 'Med-Hard', count: q3, pct: getPct(q3), color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-800/50' },
      { id: 'Q4', diff: 'Hard', count: q4, pct: getPct(q4), color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-800/50' },
    ];

    let easiest = arr[0];
    let hardest = arr[3];
    arr.forEach(q => {
      if (q.count > easiest.count) easiest = q;
      if (q.count < hardest.count) hardest = q;
    });

    return { total, arr, easiest, hardest };
  }, [matrixRows]);

  if (stats.total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-500" />
          <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">Question Analytics</h4>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold">
          <span className="text-gray-500">Easiest: <span className="text-emerald-500">{stats.easiest.id}</span></span>
          <span className="text-gray-500">Hardest: <span className="text-rose-500">{stats.hardest.id}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.arr.map(q => (
          <div key={q.id} className={`p-4 rounded-xl border ${q.border} ${q.bg} flex flex-col items-center text-center space-y-2`}>
            <div>
              <span className={`text-sm font-black ${q.color}`}>{q.id}</span>
              <span className="text-[10px] text-gray-500 block uppercase font-bold">{q.diff}</span>
            </div>
            
            <div className="w-full flex justify-between items-end border-t border-gray-200 dark:border-gray-800/50 pt-2 mt-1">
              <div className="text-left">
                <span className="text-[9px] text-gray-500 block uppercase font-bold">Solved</span>
                <span className="text-sm font-mono font-black text-gray-900 dark:text-white">{q.count}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-gray-500 block uppercase font-bold">Solve %</span>
                <span className={`text-sm font-mono font-black ${q.color}`}>{q.pct}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
