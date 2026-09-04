import React from 'react';
import { Trophy, Award } from 'lucide-react';

interface TopPerformersRowProps {
  matrixRows: any[];
}

export const TopPerformersRow: React.FC<TopPerformersRowProps> = ({ matrixRows }) => {
  const attended = matrixRows.filter(r => ['PUBLIC','PUBLIC_ATTENDED','ATTENDED','VIRTUAL','VIRTUAL_ATTENDED'].includes(r.participation_status || r.status || ''));
  
  if (attended.length === 0) return null;

  const topPerformers = attended
    .sort((a, b) => {
      const sa = Number(a.total_solved || a.total_contest_solved) || 0;
      const sb = Number(b.total_solved || b.total_contest_solved) || 0;
      if (sb !== sa) return sb - sa;
      const ra = Number(a.rank || a.contest_rank) || 999999;
      const rb = Number(b.rank || b.contest_rank) || 999999;
      return ra - rb;
    })
    .slice(0, 3);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Label */}
      <div className="shrink-0 flex items-center justify-center bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl px-4 py-3 text-white shadow-md">
        <div className="flex flex-col items-center">
          <Trophy className="w-5 h-5 mb-1 text-amber-200" />
          <span className="text-[10px] font-black tracking-widest uppercase">Top Performers</span>
        </div>
      </div>
      
      {/* Performers */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topPerformers.map((p, idx) => {
          const isGold = idx === 0;
          const isSilver = idx === 1;
          const isBronze = idx === 2;
          
          let ringColor = 'border-amber-300 dark:border-amber-500/50';
          let bgColor = 'bg-amber-50 dark:bg-amber-950/20';
          let textColor = 'text-amber-700 dark:text-amber-400';
          let rankColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300';
          
          if (isSilver) {
            ringColor = 'border-slate-300 dark:border-slate-600';
            bgColor = 'bg-slate-50 dark:bg-slate-800/40';
            textColor = 'text-slate-700 dark:text-slate-300';
            rankColor = 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
          } else if (isBronze) {
            ringColor = 'border-orange-300 dark:border-orange-800/50';
            bgColor = 'bg-orange-50 dark:bg-orange-950/20';
            textColor = 'text-orange-700 dark:text-orange-400';
            rankColor = 'bg-orange-200 text-orange-800 dark:bg-orange-900/60 dark:text-orange-300';
          }
          
          return (
            <div key={p.id || p.reg_no || idx} className={`flex items-center gap-3 p-3 rounded-xl border ${ringColor} ${bgColor}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${rankColor}`}>
                #{idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-slate-900 dark:text-white truncate">
                  {p.name}
                </div>
                <div className={`text-[10px] font-bold truncate ${textColor}`}>
                  {p.dept} • {p.year} Year
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end">
                <span className="text-sm font-mono font-black text-slate-900 dark:text-white">{p.total_solved || p.total_contest_solved || 0}/4</span>
                <span className={`text-[9px] uppercase font-bold ${textColor}`}>Solved</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
