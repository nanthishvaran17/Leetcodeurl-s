import React, { useState } from 'react';
import {
  Lock, ArrowLeft, ShieldAlert, Key, ShieldCheck,
  UserCheck, ChevronRight, Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AccessRestrictedViewProps {
  resourceName?: string;
  onGoBack: () => void;
  onOpenLogin: () => void;
}

export const AccessRestrictedView: React.FC<AccessRestrictedViewProps> = ({
  resourceName = "this institutional resource",
  onGoBack,
  onOpenLogin
}) => {
  const { user, isAuthenticated } = useAuth();
  const [animating, setAnimating] = useState(false);

  const handleSecureAuthRedirect = () => {
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      onOpenLogin();
    }, 200);
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4 relative overflow-hidden animate-fade-in">
      {/* Ambient Lighting Background Blurs */}

      <div className="max-w-lg w-full bg-white/85 dark:bg-navy-900/85 backdrop-blur-2xl border border-gray-200/80 dark:border-navy-700/80 rounded-3xl p-8 sm:p-10 text-center shadow-lg space-y-6 relative z-10 transition-all duration-300 transform hover:scale-[1.005]">
        
        {/* Institutional Security Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 dark:border-rose-500/30 text-[11px] font-black tracking-wider uppercase text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-3.5 h-3.5 animate-bounce text-rose-500" />
          <span>Nandha Engineering College • Security Gateway</span>
        </div>

        {/* Security Shield Lock Emblem */}
        <div className="relative w-24 h-24 mx-auto my-2">
          <div className="absolute inset-0 bg-gradient-to-tr from-rose-500 via-indigo-500 to-purple-600 rounded-3xl blur-xl opacity-40 animate-pulse" />
          <div className="relative w-full h-full bg-gradient-to-br from-rose-50 to-indigo-50 dark:from-rose-950/40 dark:to-navy-950/80 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60 rounded-3xl flex items-center justify-center shadow-inner group">
            <Lock className="w-11 h-11 stroke-[2.2] transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-rose-600 to-indigo-600 text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-navy-900">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Access Restriction Header & Context */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center justify-center gap-2">
            <Shield className="w-7 h-7 text-rose-500 inline-block" />
            <span>Access Restricted</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
            Authorization clearance required to access <strong className="text-gray-900 dark:text-white font-black">{resourceName}</strong>.
          </p>

          <div className="mt-4 p-3.5 bg-gray-50/80 dark:bg-navy-950/60 rounded-2xl border border-gray-200/60 dark:border-navy-800 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-center gap-2.5">
            <UserCheck className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span className="font-semibold">
              {isAuthenticated ? (
                <>Authenticated as <strong className="text-gray-900 dark:text-white font-bold">{user?.name || user?.email}</strong> ({user?.role || 'User'}). HOD or Admin clearance required.</>
              ) : (
                <>Currently browsing in Guest Mode. Authoritative HOD, Faculty, or Admin credentials required.</>
              )}
            </span>
          </div>
        </div>

        {/* Streamlined Action Buttons Bar (Clean, Non-Redundant) */}
        <div className="space-y-3 pt-2">
          {/* Main Action: Authenticate via Production OTP Login Portal */}
          <button
            onClick={handleSecureAuthRedirect}
            disabled={animating}
            className="w-full group relative flex items-center justify-center gap-2.5 px-6 py-4 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white text-xs sm:text-sm font-black rounded-2xl shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <Key className="w-4 h-4 text-amber-300" />
            <span>{animating ? 'Opening Security Portal...' : 'Authenticate Admin / HOD OTP Access'}</span>
            <ChevronRight className="w-4 h-4 opacity-80 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Secondary Action: Return to Public Dashboard */}
          <button
            onClick={onGoBack}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-2xl transition-all border border-gray-200 dark:border-navy-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Starting Overview</span>
          </button>
        </div>

        {/* Institutional Footer */}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
          Nandha Engineering College • Autonomous • Official Performance Tracking Platform
        </p>

      </div>
    </div>
  );
};
