import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'indigo';
  change?: string;
  loading?: boolean;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
  change,
  loading = false,
  onClick
}) => {
  const colorStyles = {
    blue: 'from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/40 group-hover:bg-blue-500/20',
    green: 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/40 group-hover:bg-emerald-500/20',
    amber: 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/40 group-hover:bg-amber-500/20',
    purple: 'from-purple-500/10 to-violet-500/10 text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/40 group-hover:bg-purple-500/20',
    rose: 'from-rose-500/10 to-pink-500/10 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/40 group-hover:bg-rose-500/20',
    indigo: 'from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/60 dark:border-indigo-800/40 group-hover:bg-indigo-500/20',
  };

  if (loading) {
    return (
      <div className="glass-card p-5 rounded-3xl border border-gray-200 dark:border-navy-800 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 w-20 rounded skeleton-shimmer"></div>
            <div className="h-7 w-28 rounded skeleton-shimmer"></div>
            <div className="h-2.5 w-36 rounded skeleton-shimmer"></div>
          </div>
          <div className="w-12 h-12 rounded-2xl skeleton-shimmer"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { y: -5, scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.98 } : {}}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`glass-card p-5 sm:p-6 rounded-3xl border border-gray-200/80 dark:border-navy-800/80 card-ai-control group relative overflow-hidden shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1 tracking-tight">
            {typeof value === 'number' || (typeof value === 'string' && /^\d+/.test(value)) ? (
              <AnimatedNumber value={value} />
            ) : (
              value
            )}
          </h3>
          {subtitle && <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3.5 rounded-2xl bg-gradient-to-tr border transition-all duration-300 ${colorStyles[color]}`}>
          <Icon className="w-6 h-6 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6" />
        </div>
      </div>
      {change && (
        <div className="mt-3 text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
          <span>{change}</span>
        </div>
      )}
    </motion.div>
  );
};
