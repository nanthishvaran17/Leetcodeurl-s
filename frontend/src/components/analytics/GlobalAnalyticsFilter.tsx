import React from 'react';
import { Calendar, Filter, ChevronDown } from 'lucide-react';

export type AnalyticsPeriod = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | '30d' | '90d' | 'academic_year' | 'custom';

interface GlobalAnalyticsFilterProps {
  period: AnalyticsPeriod;
  setPeriod: (period: AnalyticsPeriod) => void;
  customRange?: { start: string; end: string };
  setCustomRange?: (range: { start: string; end: string }) => void;
  className?: string;
}

const PERIOD_OPTIONS: { label: string; value: AnalyticsPeriod }[] = [
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Last 90 Days', value: '90d' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Academic Year', value: 'academic_year' },
];

export const GlobalAnalyticsFilter: React.FC<GlobalAnalyticsFilterProps> = ({
  period,
  setPeriod,
  className = ''
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-3 shadow-xs ${className}`}>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 pl-1">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-semibold uppercase tracking-wider">Timeframe</span>
      </div>
      
      <div className="relative group">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
          className="appearance-none bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg py-2 pl-10 pr-10 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-brand-500 outline-none hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
        >
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors" />
      </div>
    </div>
  );
};
