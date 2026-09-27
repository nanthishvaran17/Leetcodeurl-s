import React from 'react';
import { useGlobalWebSocket } from '../context/GlobalWebSocketProvider';

export const LiveIndicator: React.FC = () => {
  const { isConnected, visualStatus } = useGlobalWebSocket();

  // 1. Healthy / Live state (or initializing within 4s grace period)
  if (isConnected || visualStatus === 'LIVE' || visualStatus === 'INITIALIZING') {
    return (
      <div className="flex items-center justify-center space-x-2 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 h-[44px] rounded-xl transition-all duration-300 select-none shrink-0 whitespace-nowrap">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.9)] shrink-0"></span>
        <span className="tracking-wider">LIVE</span>
      </div>
    );
  }

  // 2. Genuine Offline / Reconnecting state (only after >4 seconds of continuous disconnection)
  return (
    <div className="flex items-center justify-center space-x-2 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 h-[44px] rounded-xl transition-all duration-300 select-none shrink-0 whitespace-nowrap">
      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full opacity-75 animate-ping shrink-0"></span>
      <span className="tracking-wider hidden sm:inline">RECONNECTING...</span>
      <span className="tracking-wider sm:hidden">REC...</span>
    </div>
  );
};

