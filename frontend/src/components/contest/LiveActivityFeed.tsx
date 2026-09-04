import React, { useEffect, useRef } from 'react';
import { Activity, CheckCircle2, XCircle, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface LiveEvent {
  id?: string | number;
  type?: string;
  timestamp?: string;
  studentName?: string;
  regNo?: string;
  dept?: string;
  year?: string;
  detail?: string;
  rank?: number;
  rankChange?: number;
  score?: number;
  isNew?: boolean;
}

interface LiveActivityFeedProps {
  events: LiveEvent[];
  maxHeight?: string;
}

const eventColors: Record<string, string> = {
  SOLVE_Q1: 'border-l-emerald-500 bg-emerald-500/5',
  SOLVE_Q2: 'border-l-purple-500 bg-purple-500/5',
  SOLVE_Q3: 'border-l-indigo-500 bg-indigo-500/5',
  SOLVE_Q4: 'border-l-rose-500 bg-rose-500/5',
  RANK_JUMP: 'border-l-amber-500 bg-amber-500/5',
  NEW_PARTICIPANT: 'border-l-teal-500 bg-teal-500/5',
  CONTEST_RESULT_UPDATED: 'border-l-brand-500 bg-brand-500/5',
  SYNC_ERROR: 'border-l-red-500 bg-red-500/5',
  default: 'border-l-gray-600 bg-white/3',
};

const eventIcons: Record<string, React.ReactNode> = {
  SOLVE_Q1: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
  SOLVE_Q2: <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
  SOLVE_Q3: <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />,
  SOLVE_Q4: <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
  RANK_JUMP: <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
  CONTEST_RESULT_UPDATED: <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 shrink-0" />,
  SYNC_ERROR: <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />,
  default: <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
};

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({ events, maxHeight = '380px' }) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new events arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events.length]);

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-slate-500 space-y-2">
        <Activity className="w-8 h-8 text-slate-600 animate-pulse" />
        <p className="text-xs font-bold">Waiting for live events...</p>
        <p className="text-[11px] text-slate-600">Events will appear here when the contest is LIVE and students begin solving.</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="overflow-y-auto space-y-1.5 pr-1"
      style={{ maxHeight }}
    >
      {events.map((evt, idx) => {
        const colorClass = eventColors[evt.type || ''] || eventColors.default;
        const icon = eventIcons[evt.type || ''] || eventIcons.default;
        const isNew = idx === 0;

        return (
          <div
            key={evt.id || `evt-${idx}`}
            className={`flex items-start gap-3 px-3.5 py-2.5 rounded-xl border-l-4 border border-white/5 transition-all duration-300 ${colorClass} ${
              isNew ? 'ring-1 ring-brand-500/30 shadow-sm shadow-brand-500/10' : ''
            }`}
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-slate-500 shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {evt.timestamp || '—'}
                </span>
                {evt.rank && (
                  <span className="text-[11px] font-mono font-bold text-indigo-300 shrink-0">
                    Rank #{evt.rank}
                    {evt.rankChange && evt.rankChange > 0 && (
                      <span className="text-emerald-400 ml-1">↑+{evt.rankChange}</span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-xs font-black text-white">{evt.studentName || 'Unknown Student'}</span>
                {(evt.dept || evt.year) && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {[evt.dept, evt.year && `${evt.year} Year`].filter(Boolean).join(' • ')}
                  </span>
                )}
              </div>
              {evt.detail && (
                <p className="text-[11px] text-slate-300 mt-0.5 font-medium">{evt.detail}</p>
              )}
            </div>
            {isNew && (
              <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping shrink-0 mt-1.5" />
            )}
          </div>
        );
      })}
    </div>
  );
};
