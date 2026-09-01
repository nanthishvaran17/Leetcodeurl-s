import React from 'react';
import { useLiveLeaderboard } from '../hooks/useLiveLeaderboard';
import { useIsFetching } from '@tanstack/react-query';

export const LiveIndicator: React.FC = () => {
  const { isConnected } = useLiveLeaderboard();
  const isFetching = useIsFetching();

  // 1. Syncing state takes precedence (when background updates are being fetched)
  if (isFetching > 0) {
    return (
      <div className="flex items-center space-x-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/50 shadow-sm transition-all duration-300">
        <svg className="w-2.5 h-2.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="tracking-wider">SYNCING</span>
      </div>
    );
  }

  // 2. Connected live state
  if (isConnected) {
    return (
      <div className="flex items-center space-x-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50 shadow-sm transition-all duration-300">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_4px_rgba(16,185,129,0.8)]"></span>
        <span className="tracking-wider">LIVE</span>
      </div>
    );
  }

  // 3. Offline / Reconnecting state
  return (
    <div className="flex items-center space-x-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/50 shadow-sm transition-all duration-300">
      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full opacity-60"></span>
      <span className="tracking-wider">RECONNECTING...</span>
    </div>
  );
};
