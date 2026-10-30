import React from 'react';
import { ArrowRight, MoveHorizontal } from 'lucide-react';

interface TableScrollHintProps {
  label?: string;
  className?: string;
}

export const TableScrollHint: React.FC<TableScrollHintProps> = ({
  label = 'Swipe horizontally to view full columns',
  className = ''
}) => {
  return (
    <div className={`md:hidden flex items-center justify-between px-3 py-1.5 mb-2 rounded-xl bg-slate-100/95 dark:bg-navy-900/95 border border-slate-200/80 dark:border-navy-800/80 text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-2xs select-none ${className}`}>
      <div className="flex items-center space-x-1.5 min-w-0 truncate">
        <MoveHorizontal className="w-3.5 h-3.5 text-brand-500 shrink-0 animate-pulse" />
        <span className="truncate">{label}</span>
      </div>
      <span className="inline-flex items-center space-x-0.5 text-brand-600 dark:text-brand-400 font-extrabold text-[10.5px] shrink-0 pl-2">
        <span>Scroll</span>
        <ArrowRight className="w-3 h-3" />
      </span>
    </div>
  );
};

export default TableScrollHint;
