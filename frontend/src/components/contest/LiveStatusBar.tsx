import React from 'react';
import { Activity, Wifi, WifiOff, Clock } from 'lucide-react';

interface LiveStatusBarProps {
  isLive: boolean;
  workerState?: string;
  totalStudents: number;
  participants: number;
  totalSolved: number;
  lastEventTime?: string;
}

export const LiveStatusBar: React.FC<LiveStatusBarProps> = ({
  isLive,
  workerState,
  totalStudents,
  participants,
  totalSolved,
  lastEventTime
}) => {
  let statusColor = 'text-gray-400 bg-gray-900 border-gray-700';
  let statusText = 'FINALIZED';
  let syncStatus = 'OFFLINE';
  
  if (isLive) {
    syncStatus = 'LIVE';
    if (!workerState || workerState === 'OFFLINE' || workerState === 'ERROR' || workerState === 'IDLE' || workerState === 'DISCONNECTED') {
      statusColor = 'text-rose-500 bg-rose-500/10 border-rose-500/30';
      statusText = 'SOURCE OFFLINE';
    } else if (workerState === 'WAITING' || workerState === 'POLLING') {
      statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/30';
      statusText = 'WAITING FOR LIVE EVENTS';
    } else if (workerState === 'STALE') {
      statusColor = 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      statusText = 'DATA STALE';
    } else {
      statusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
      statusText = 'LIVE';
    }
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-navy-950 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm text-xs font-mono font-bold text-gray-700 dark:text-gray-300">
      <div className="flex items-center gap-4 flex-wrap">
        <span><span className="text-gray-900 dark:text-white">{totalStudents}</span> Students</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span><span className="text-gray-900 dark:text-white">{participants}</span> Participants</span>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span><span className="text-gray-900 dark:text-white">{totalSolved}</span> Questions Solved</span>
      </div>
      
      <div className="flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          Last Event: <span className="text-gray-900 dark:text-white">{lastEventTime || '—'}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
          Sync: <span className={isLive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}>{syncStatus}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {isLive ? <Wifi className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}
          Realtime: <span className={isLive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}>{isLive ? 'CONNECTED' : 'DISCONNECTED'}</span>
        </span>
        <div className={`px-2.5 py-1 rounded-lg border ${statusColor}`}>
          {statusText}
        </div>
      </div>
    </div>
  );
};
