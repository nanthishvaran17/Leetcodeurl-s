import React from 'react';
import { Radio, Wifi, WifiOff, Activity, Clock, ShieldCheck, AlertTriangle, Zap, RefreshCw } from 'lucide-react';

interface LiveCommandBarProps {
  isLive: boolean;
  contestName?: string;
  contestDate?: string;
  timeRemainingSec: number;
  verificationStatus?: string;
  verifiedCount?: number;
  totalStudents?: number;
  attendedCount?: number;
  wsStatus: 'connected' | 'disconnected';
  wsConnectionCount?: number;
  eventCount?: number;
  lastEvent?: any;
  errorCount?: number;
  pendingCount?: number;
  sessionStatus?: string;
  workerState?: string;
}

const formatTime = (totalSec: number) => {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

export const LiveCommandBar: React.FC<LiveCommandBarProps> = ({
  isLive,
  contestName,
  contestDate,
  timeRemainingSec,
  verificationStatus,
  verifiedCount = 0,
  totalStudents = 302,
  attendedCount = 0,
  wsStatus,
  wsConnectionCount = 0,
  eventCount = 0,
  lastEvent,
  errorCount = 0,
  pendingCount = 0,
  sessionStatus,
  workerState,
}) => {
  const isFullyVerified = verificationStatus === 'FULLY_VERIFIED' || verificationStatus === 'FINALIZED';
  const isPartial = verificationStatus === 'PARTIALLY_VERIFIED';

  const verifLabel = isFullyVerified
    ? `${verifiedCount}/${totalStudents} VERIFIED`
    : isPartial
      ? `${verifiedCount}/${totalStudents} PARTIALLY VERIFIED`
      : `${verifiedCount}/${totalStudents} PENDING`;

  const verifColor = isFullyVerified
    ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
    : isPartial
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : 'text-gray-400 border-gray-600/40 bg-gray-800/30';

  const lastEventStr = lastEvent?.timestamp
    ? lastEvent.timestamp
    : lastEvent?.studentName
      ? `${lastEvent.studentName}`
      : '—';

  return (
    <div className="w-full rounded-2xl border border-rose-500/30 bg-gradient-to-r from-slate-950 via-rose-950/30 to-slate-950 shadow-xl overflow-hidden">
      {/* Top bar — contest identity + LIVE pill */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-3">
          {isLive ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black tracking-widest uppercase shadow-lg shadow-rose-900/40">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600/80 text-white text-[11px] font-black tracking-widest uppercase">
              <span>{sessionStatus || 'FINALIZED'}</span>
            </div>
          )}
          {workerState && isLive && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-600 text-brand-300 text-[11px] font-black tracking-widest uppercase">
              <Activity className="w-3.5 h-3.5" />
              <span>{workerState.replace(/_/g, ' ')}</span>
            </div>
          )}
          <span className="text-white font-black text-sm tracking-wide">{contestName || 'Weekly Contest'}</span>
          {contestDate && (
            <span className="text-gray-400 text-xs font-mono">{contestDate}</span>
          )}
          <span className="text-gray-500 text-xs">•</span>
          <span className="text-gray-300 text-xs font-mono">08:00 AM – 09:30 AM IST</span>
        </div>

        {/* WS status */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${
          wsStatus === 'connected'
            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
            : 'text-red-400 border-red-500/40 bg-red-500/10'
        }`}>
          {wsStatus === 'connected'
            ? <Wifi className="w-3 h-3" />
            : <WifiOff className="w-3 h-3" />
          }
          <span>{wsStatus === 'connected' ? 'REALTIME CONNECTED' : 'RECONNECTING...'}</span>
          {wsStatus === 'connected' && wsConnectionCount > 0 && (
            <span className="text-gray-500">({wsConnectionCount})</span>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-white/5 px-0">
        {/* Timer */}
        <div className="flex flex-col items-center justify-center py-3 px-4">
          <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1 mb-1">
            <Clock className="w-3 h-3" /> {isLive ? 'TIME LEFT' : 'CONTEST'}
          </span>
          <span className={`text-lg font-mono font-black ${isLive ? 'text-rose-400' : 'text-gray-400'}`}>
            {isLive ? formatTime(timeRemainingSec) : '00:00:00'}
          </span>
        </div>

        {/* Verification */}
        <div className="flex flex-col items-center justify-center py-3 px-4">
          <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1 mb-1">
            <ShieldCheck className="w-3 h-3" /> VERIFIED
          </span>
          <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-full border ${verifColor}`}>
            {verifLabel}
          </span>
        </div>

        {/* Participants */}
        <div className="flex flex-col items-center justify-center py-3 px-4">
          <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1 mb-1">
            <Activity className="w-3 h-3" /> PARTICIPANTS
          </span>
          <span className="text-lg font-mono font-black text-indigo-300">{attendedCount}</span>
        </div>

        {/* Live Events */}
        <div className="flex flex-col items-center justify-center py-3 px-4">
          <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1 mb-1">
            <Zap className="w-3 h-3" /> EVENTS
          </span>
          <span className="text-lg font-mono font-black text-amber-400">{eventCount}</span>
        </div>

        {/* Last Event */}
        <div className="flex flex-col items-center justify-center py-3 px-4">
          <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1 mb-1">
            <Radio className="w-3 h-3" /> LAST EVENT
          </span>
          <span className="text-[11px] font-bold text-white text-center truncate max-w-[110px]">{lastEventStr}</span>
        </div>

        {/* Errors / Pending */}
        <div className="flex flex-col items-center justify-center py-3 px-4">
          <span className="text-[10px] font-bold uppercase text-gray-500 tracking-wider flex items-center gap-1 mb-1">
            <AlertTriangle className="w-3 h-3" /> ERRORS
          </span>
          <span className={`text-lg font-mono font-black ${errorCount > 0 ? 'text-red-400' : 'text-gray-500'}`}>
            {errorCount}
          </span>
        </div>
      </div>
    </div>
  );
};
