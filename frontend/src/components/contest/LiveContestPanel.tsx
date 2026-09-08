import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { useGlobalWebSocket } from '../../context/GlobalWebSocketProvider';

export const LiveContestPanel: React.FC = () => {
  const { registerCallback, unregisterCallback, isConnected } = useGlobalWebSocket();
  const [panelState, setPanelState] = useState<any>(null);

  useEffect(() => {
    registerCallback('live-contest-panel', (data: any) => {
      if (data && data.type === 'contest_update') {
        setPanelState(data.data);
      }
    });

    return () => {
      unregisterCallback('live-contest-panel');
    };
  }, [registerCallback, unregisterCallback]);

  if (!panelState) return null;

  const { phase, counts, data_freshness, last_successful_update, total_participants, contest_id } = panelState;

  if (phase === 'ended') {
    return (
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 shadow-lg mb-8 flex items-center justify-between text-slate-300">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Contest {contest_id} Ended</h3>
            <p className="text-xs">Live tracking closed. Final virtual/live status is determined by the verification pipeline.</p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'active' || phase === 'degraded') {
    const isStale = data_freshness === 'stale' || phase === 'degraded';
    
    return (
      <div className={`relative overflow-hidden rounded-2xl border mb-8 transition-colors duration-500 shadow-xl
        ${isStale ? 'bg-amber-950/20 border-amber-500/30' : 'bg-slate-900 border-indigo-500/30'} 
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              {!isStale && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isStale ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </div>
            <h2 className="font-black text-white text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              LIVE: Weekly Contest {contest_id}
            </h2>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-4 h-4" /> Updated {new Date(last_successful_update).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
            </span>
            <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
              {total_participants} Participants Tracked
            </span>
          </div>
        </div>

        {/* Stale Warning Banner */}
        {isStale && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-amber-200 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4" />
            <span>Live data may be delayed. {phase === 'degraded' ? 'Significant fetching issues detected.' : 'Experiencing minor LeetCode fetch delays.'}</span>
          </div>
        )}

        {/* Problem Counts */}
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(counts || {}).map(([slug, count]: [string, any], index) => (
              <div key={slug} className="bg-slate-800/50 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                <div className="absolute top-0 right-0 p-2 opacity-10">
                  <span className="text-4xl font-black italic text-white">Q{index + 1}</span>
                </div>
                <div className="text-xs text-slate-400 font-mono mb-2 truncate w-full px-2 relative z-10" title={slug}>
                  {slug}
                </div>
                <div className="text-3xl font-black text-white flex items-center gap-2 relative z-10">
                  <Zap className={`w-5 h-5 ${count > 0 ? 'text-yellow-400' : 'text-slate-600'}`} />
                  {count}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold relative z-10">
                  Distinct Solvers
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
