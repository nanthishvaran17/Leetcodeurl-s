import React from 'react';

interface StudentProfileSkeletonProps {
  studentName?: string;
}

export const StudentProfileSkeleton: React.FC<StudentProfileSkeletonProps> = ({ studentName }) => {
  return (
    <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-navy-950 rounded-3xl animate-pulse">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-navy-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between gap-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-20 h-9 bg-white/10 rounded-xl" />
          <div>
            <div className="h-6 w-48 bg-white/20 rounded-lg">
              {studentName && <span className="opacity-0">{studentName}</span>}
            </div>
            <div className="h-3 w-32 bg-white/10 rounded mt-1.5" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-9 bg-white/10 rounded-xl" />
          <div className="w-16 h-9 bg-white/10 rounded-xl" />
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-navy-900/50 px-4 py-3 gap-3 shrink-0">
        <div className="w-24 h-8 bg-slate-200 dark:bg-navy-800 rounded-xl" />
        <div className="w-24 h-8 bg-slate-200 dark:bg-navy-800 rounded-xl" />
        <div className="w-24 h-8 bg-slate-200 dark:bg-navy-800 rounded-xl" />
        <div className="w-24 h-8 bg-slate-200 dark:bg-navy-800 rounded-xl" />
      </div>

      {/* Bento Grid Body Skeleton */}
      <div className="p-5 sm:p-6 space-y-6 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-slate-100 dark:bg-navy-900/60 rounded-3xl p-6 h-64 border border-slate-200/60 dark:border-navy-800 flex flex-col justify-between">
            <div className="w-32 h-4 bg-slate-200 dark:bg-navy-800 rounded" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-20 bg-slate-200/70 dark:bg-navy-800/70 rounded-2xl" />
              <div className="h-20 bg-slate-200/70 dark:bg-navy-800/70 rounded-2xl" />
              <div className="h-20 bg-slate-200/70 dark:bg-navy-800/70 rounded-2xl" />
              <div className="h-20 bg-slate-200/70 dark:bg-navy-800/70 rounded-2xl" />
            </div>
          </div>
          <div className="lg:col-span-5 bg-slate-100 dark:bg-navy-900/60 rounded-3xl p-6 h-64 border border-slate-200/60 dark:border-navy-800 flex flex-col justify-between">
            <div className="w-32 h-4 bg-slate-200 dark:bg-navy-800 rounded" />
            <div className="h-24 bg-slate-200/70 dark:bg-navy-800/70 rounded-2xl" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 bg-slate-200/70 dark:bg-navy-800/70 rounded-2xl" />
              <div className="h-16 bg-slate-200/70 dark:bg-navy-800/70 rounded-2xl" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-100 dark:bg-navy-900/60 rounded-3xl p-6 h-64 border border-slate-200/60 dark:border-navy-800" />
          <div className="bg-slate-100 dark:bg-navy-900/60 rounded-3xl p-6 h-64 border border-slate-200/60 dark:border-navy-800" />
        </div>
      </div>
    </div>
  );
};
