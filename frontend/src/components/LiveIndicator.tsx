import React from 'react';
import { useGlobalWebSocket } from '../context/GlobalWebSocketProvider';

export const LiveIndicator: React.FC = () => {
  const { isConnected, visualStatus } = useGlobalWebSocket();

  // 1. Healthy / Live state (or initializing within 4s grace period)
  if (isConnected || visualStatus === 'LIVE' || visualStatus === 'INITIALIZING') {
    return (
      <div className="flex items-center space-x-1.5 text-[9px] sm:text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-emerald-200 dark:border-emerald-800/50 shadow-sm transition-all duration-300 select-none shrink-0 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)] shrink-0"></span>
        <span className="tracking-wider">LIVE</span>
      </div>
    );
  }

  // 2. Genuine Offline / Reconnecting state (only after >4 seconds of continuous disconnection)
  return (
    <div className="flex items-center space-x-1 sm:space-x-1.5 text-[9px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border border-amber-200 dark:border-amber-800/50 shadow-sm transition-all duration-300 select-none shrink-0 whitespace-nowrap">
      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full opacity-75 animate-ping shrink-0"></span>
      <span className="tracking-wider hidden sm:inline">RECONNECTING...</span>
      <span className="tracking-wider sm:hidden">REC...</span>
    </div>
  );
};

