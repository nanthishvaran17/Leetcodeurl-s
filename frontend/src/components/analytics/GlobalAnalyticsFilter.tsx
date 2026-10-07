import React from 'react';
import { Calendar, Filter } from 'lucide-react';
import { CustomDropdown } from '../CustomDropdown';

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
    <div className={`flex flex-wrap items-center gap-3 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-2xl p-2 sm:p-2.5 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 pl-2">
        <Filter className="w-4 h-4 text-brand-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Timeframe</span>
      </div>
      
      <CustomDropdown
        label="Timeframe"
        value={period}
        onChange={(val) => setPeriod(val as AnalyticsPeriod)}
        options={PERIOD_OPTIONS}
        icon={Calendar}
        menuWidthClass="w-56"
        align="right"
        triggerClassName="bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 text-xs sm:text-sm font-bold text-slate-800 dark:text-white rounded-xl py-2 px-3.5 shadow-xs"
      />
    </div>
  );
};
