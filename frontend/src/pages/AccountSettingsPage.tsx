import React from 'react';
import { AccountProfileSettings } from '../components/AccountProfileSettings';
import { ShieldCheck, UserCheck, Lock, ChevronRight, ArrowLeft } from 'lucide-react';

export const AccountSettingsPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  return (
    <div className="relative min-h-screen w-full pb-32 sm:pb-20 text-slate-900 dark:text-slate-100 animate-fade-in overflow-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-48 right-10 w-80 h-80 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full px-2.5 sm:px-4 lg:px-6 pt-3 sm:pt-6 space-y-6">
        {/* Executive Breadcrumb & Section Header — Mobile Native Optimized */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200/60 dark:border-navy-800/60">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 min-w-0">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-black transition-all cursor-pointer mr-1 active:scale-95 shadow-2xs shrink-0"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
            )}
            <span className="text-slate-500 dark:text-slate-400 hidden xs:inline">Command Deck</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden xs:inline shrink-0" />
            <span className="text-slate-900 dark:text-white font-extrabold truncate text-xs sm:text-sm">Account Settings &amp; Security</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Verified</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-mono font-bold bg-slate-100 dark:bg-navy-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-navy-800">
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand-500 shrink-0" />
              <span>256-Bit SSL</span>
            </span>
          </div>
        </div>

        {/* Main Profile & Settings Engine */}
        <AccountProfileSettings />
      </div>
    </div>
  );
};

export default AccountSettingsPage;
