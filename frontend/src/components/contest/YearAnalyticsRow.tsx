import React, { useMemo } from 'react';
import { GraduationCap, TrendingUp, Users } from 'lucide-react';

interface YearAnalyticsRowProps {
  matrixRows: any[];
}

const yearOrder = ['I','II','III','IV'];
const yearColors: Record<string, { text: string; bg: string; bar: string; border: string }> = {
  'I':   { text: 'text-teal-400',   bg: 'bg-teal-500/10',   bar: 'bg-teal-500',   border: 'border-teal-500/30' },
  'II':  { text: 'text-indigo-400', bg: 'bg-indigo-500/10', bar: 'bg-indigo-500', border: 'border-indigo-500/30' },
  'III': { text: 'text-purple-400', bg: 'bg-purple-500/10', bar: 'bg-purple-500', border: 'border-purple-500/30' },
  'IV':  { text: 'text-amber-400',  bg: 'bg-amber-500/10',  bar: 'bg-amber-500',  border: 'border-amber-500/30' },
};

export const YearAnalyticsRow: React.FC<YearAnalyticsRowProps> = ({ matrixRows }) => {
  const yearData = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of matrixRows) {
      const y = (r.year || r.year_level || 'Unknown').toString().toUpperCase().replace(' YEAR','').trim();
      if (!map[y]) map[y] = [];
      map[y].push(r);
    }
    return yearOrder.map(yr => {
      const rows = map[yr] || [];
      if (rows.length === 0) return null;
      const attended = rows.filter(r => ['PUBLIC','PUBLIC_ATTENDED','ATTENDED','VIRTUAL','VIRTUAL_ATTENDED'].includes(r.participation_status || r.status || ''));
      const totalSolves = attended.reduce((s, r) => s + (Number(r.total_solved || r.total_contest_solved) || 0), 0);
      const avgSolved = attended.length > 0 ? (totalSolves / attended.length).toFixed(2) : '0.00';
      const pct = rows.length > 0 ? ((attended.length / rows.length) * 100).toFixed(1) : '0.0';
      const best = attended.sort((a,b) => (Number(b.total_solved||b.total_contest_solved)||0) - (Number(a.total_solved||a.total_contest_solved)||0))[0];
      return { year: yr, total: rows.length, attended: attended.length, totalSolves, avgSolved, pct, topPerformer: best ? { name: best.name, solved: Number(best.total_solved||best.total_contest_solved)||0 } : null };
    }).filter(Boolean);
  }, [matrixRows]);

  if (yearData.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-brand-500" />
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Year-wise Analytics</h4>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {yearData.map(d => {
          if (!d) return null;
          const cfg = yearColors[d.year] || yearColors['III'];
          const barW = Math.min(100, Number(d.pct));
          return (
            <div key={d.year} className={`p-4 rounded-2xl border ${cfg.border} ${cfg.bg} space-y-2.5`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-black ${cfg.text}`}>{d.year} Year</span>
                <span className={`text-xs font-mono font-black ${cfg.text}`}>{d.pct}%</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                <div>
                  <span className="text-slate-500 block">Total</span>
                  <span className="font-mono font-black text-slate-300">{d.total}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Active</span>
                  <span className={`font-mono font-black ${cfg.text}`}>{d.attended}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Avg Q</span>
                  <span className="font-mono font-black text-white">{d.avgSolved}</span>
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${barW}%` }} />
              </div>
              {d.topPerformer && (
                <div className="text-[10px] text-slate-400 truncate">
                  <span className={`font-bold ${cfg.text}`}>Top: </span>{d.topPerformer.name} ({d.topPerformer.solved}Q)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
