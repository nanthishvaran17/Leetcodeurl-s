import React, { useState } from 'react';
import { Loader2, LogOut, AlertCircle, ExternalLink, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authenticateWithGoogle } from '../services/googleAuth';

/** True when running inside Capacitor Android/iOS native app. */
const isNativeMobile = (): boolean => {
  try {
    // @ts-ignore — window.Capacitor is injected by the native bridge
    return !!(window?.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onSuccess, className = '' }) => {
  const { user, login, logout, authState } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showMobileNotice, setShowMobileNotice] = useState(false);

  const handleSignIn = async () => {
    setErrorMsg('');

    if (isNativeMobile()) {
      setShowMobileNotice(true);
      return;
    }

    setIsSigningIn(true);
    try {
      const res = await authenticateWithGoogle();
      if (res && res.user) {
        login('', res.user);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in could not be completed. Please try again.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleOpenBrowser = async () => {
    setShowMobileNotice(false);
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: 'https://leetcodeurl-s-roan.vercel.app' });
    } catch {
      window.open('https://leetcodeurl-s-roan.vercel.app', '_system');
    }
  };

  if (user) {
    return (
      <div className={`flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 shadow-md ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm">
            {user.username ? user.username[0].toUpperCase() : 'A'}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate max-w-[160px]">
                {user.username}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-500/20 text-brand-600 dark:text-brand-300 uppercase tracking-wider">
                {user.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
              {user.email}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          disabled={authState === 'AUTHENTICATING'}
          className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-all"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Render active Google Sign-In button on all platforms (web & mobile)
  return (
    <div className="space-y-3 w-full">
      {showMobileNotice && (
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-navy-900 border border-indigo-200 dark:border-indigo-800 text-slate-800 dark:text-slate-200 text-xs space-y-3 animate-fade-in shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold text-indigo-900 dark:text-indigo-200">
              <ShieldAlert className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <span>Google Sign-In on Mobile</span>
            </div>
            <button onClick={() => setShowMobileNotice(false)} className="text-slate-400 hover:text-indigo-600 text-sm font-bold px-1.5 py-0.5 rounded-md">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
            Google OAuth security policy requires Chrome Browser for Google Sign-In. You can either open the Web Portal in Chrome or use Password / Secure OTP login directly in this app.
          </p>
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={handleOpenBrowser}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center justify-center space-x-2 shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Web Portal in Chrome</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMobileNotice(false)}
              className="w-full py-2 px-4 rounded-xl bg-white dark:bg-navy-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-300 font-bold text-[11px]"
            >
              Use Password / OTP Login Here
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-2 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg.includes('Unauthorized Domain') ? 'Firebase Domain Authorization Needed' : 'Sign-In Notice'}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-slate-400 hover:text-rose-600 text-sm font-bold px-1.5 py-0.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/50">×</button>
          </div>
          <p className="text-[11.5px] leading-relaxed font-medium">{errorMsg}</p>
          {errorMsg.includes('Unauthorized Domain') && (
            <div className="p-3 rounded-xl bg-white dark:bg-navy-950 border border-rose-200 dark:border-rose-900 text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5 shadow-sm">
              <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <span>1-Minute Fix in Firebase Console:</span>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[10.5px] leading-snug">
                <li>Go to <b className="text-slate-900 dark:text-white">Firebase Console</b> &rarr; Select project <b className="text-brand-600">leetcode-student-data</b></li>
                <li>Navigate to <b className="text-slate-900 dark:text-white">Authentication</b> &rarr; <b className="text-slate-900 dark:text-white">Settings</b> &rarr; <b className="text-slate-900 dark:text-white">Authorized domains</b></li>
                <li>Click <b className="text-indigo-600">Add domain</b> &rarr; Paste: <code className="bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-1.5 py-0.5 rounded font-mono font-bold">{typeof window !== 'undefined' ? window.location.hostname : 'leetcodeurl-s-roan.vercel.app'}</code></li>
              </ol>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        className={`w-full py-3 px-5 rounded-xl bg-white dark:bg-navy-950 hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-800 dark:text-white font-extrabold text-xs border border-slate-300 dark:border-slate-700 shadow-md hover:shadow-lg flex items-center justify-center space-x-3 transition-all duration-200 ${className}`}
      >
        {isSigningIn ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            <span>Verifying Google Account...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>
    </div>
  );
};

