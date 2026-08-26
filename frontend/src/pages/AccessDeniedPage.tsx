import React from 'react';
import { ShieldOff, ArrowLeft, Home, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AccessDeniedPageProps {
  restrictedResource?: string;
  onGoBack?: () => void;
}

const ROLE_HOME: Record<string, string> = {
  faculty: 'faculty-action-center',
  staff: 'faculty-action-center',
  hod: 'hod-command-center',
  student: 'dashboard',
  admin: 'dashboard',
  'super admin': 'dashboard',
  super_admin: 'dashboard',
};

export const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({
  restrictedResource = 'this resource',
  onGoBack,
}) => {
  const { user } = useAuth();
  const roleClean = (user?.role || '').trim().toLowerCase();
  const homePage = ROLE_HOME[roleClean] || 'dashboard';
  const roleLabel = roleClean.charAt(0).toUpperCase() + roleClean.slice(1);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-12 text-center">
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-red-500/5 blur-3xl" />
      </div>

      {/* Lock Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500/20 to-rose-600/20 border border-red-500/30 flex items-center justify-center shadow-2xl shadow-red-500/10">
          <ShieldOff className="w-12 h-12 text-red-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
          <Lock className="w-3 h-3 text-white" />
        </div>
      </div>

      {/* Status Code */}
      <div className="mb-2">
        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-red-400 border border-red-500/30 bg-red-500/10 px-3 py-1 rounded-full">
          403 — Access Denied
        </span>
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white mt-4 mb-3">
        Restricted Area
      </h1>

      {/* Description */}
      <p className="text-gray-500 dark:text-gray-400 max-w-md leading-relaxed mb-2">
        You do not have permission to access <strong className="text-gray-700 dark:text-gray-200">{restrictedResource}</strong>.
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mb-8">
        Your account role (<span className="font-semibold text-brand-500">{roleLabel}</span>) is
        not authorized for this page. If you believe this is an error, contact your system administrator.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-navy-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        )}
        <button
          onClick={() => onGoBack?.()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-bold transition-all shadow-lg shadow-brand-500/20 cursor-pointer"
        >
          <Home className="w-4 h-4" />
          Go to My Dashboard
        </button>
      </div>

      {/* Note */}
      <p className="mt-10 text-[11px] text-gray-400 dark:text-gray-600 font-mono">
        This access attempt has been logged for security audit purposes.
      </p>
    </div>
  );
};
