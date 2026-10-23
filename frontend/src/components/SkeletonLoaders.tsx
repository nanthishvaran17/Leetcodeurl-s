import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 bg-slate-200 dark:bg-slate-800/60 rounded-xl w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800/40 rounded-xl w-full flex items-center px-4 space-x-4">
          <div className="w-8 h-6 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
          <div className="w-24 h-6 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
          <div className="flex-1 h-6 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
          <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
          <div className="w-16 h-6 bg-slate-200 dark:bg-slate-700/60 rounded-md" />
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="w-20 h-6 bg-slate-200 dark:bg-slate-800 rounded-full" />
      </div>
      <div className="w-3/4 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      <div className="w-full h-12 bg-slate-200 dark:bg-slate-800 rounded-xl" />
    </div>
  );
};

export const MobileStudentCardSkeleton: React.FC = () => {
  return (
    <div className="w-full bg-white dark:bg-[#0c1424] rounded-2xl border border-slate-200/80 dark:border-white/10 p-3.5 space-y-3 animate-pulse shadow-xs">
      <div className="flex items-center gap-3">
        {/* Avatar skeleton */}
        <div className="w-11 h-11 rounded-2xl bg-slate-200 dark:bg-slate-800 shrink-0" />
        {/* Identity skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-5 w-12 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
            <div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
          </div>
        </div>
      </div>

      {/* Symmetrical bottom metrics skeleton */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        </div>
        <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
    </div>
  );
};

export const MobileCardListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <MobileStudentCardSkeleton key={idx} />
      ))}
    </div>
  );
};
