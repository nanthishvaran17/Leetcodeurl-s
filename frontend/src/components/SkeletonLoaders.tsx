import React from 'react';

export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 bg-gray-200 dark:bg-gray-800/60 rounded-xl w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800/40 rounded-xl w-full flex items-center px-4 space-x-4">
          <div className="w-8 h-6 bg-gray-200 dark:bg-gray-700/60 rounded-md" />
          <div className="w-24 h-6 bg-gray-200 dark:bg-gray-700/60 rounded-md" />
          <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700/60 rounded-md" />
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700/60 rounded-md" />
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700/60 rounded-md" />
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        <div className="w-20 h-6 bg-gray-200 dark:bg-gray-800 rounded-full" />
      </div>
      <div className="w-3/4 h-6 bg-gray-200 dark:bg-gray-800 rounded-lg" />
      <div className="w-full h-12 bg-gray-200 dark:bg-gray-800 rounded-xl" />
    </div>
  );
};
