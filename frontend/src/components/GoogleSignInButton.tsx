import React, { useState } from 'react';
import { Loader2, LogOut, AlertCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authenticateWithGoogle } from '../services/googleAuth';

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onSuccess, className = '' }) => {
  const { user, login, logout, authState } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setErrorMsg('');
    setIsSigningIn(true);

    try {
      const res = await authenticateWithGoogle();
      if (res && res.user) {
        login(res.access_token || '', res.user);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      const msg = err?.message || 'Google sign-in could not be completed. Please try again.';
      if (msg === 'Google sign-in was cancelled.' || msg.toLowerCase().includes('cancel')) {
        setErrorMsg('Google sign-in was cancelled.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (user) {
    return (
      <div className={`flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
            {user.username ? user.username[0].toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                {user.username}
              </h4>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 uppercase tracking-wider">
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
          className="p-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-1 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>Authentication Notice</span>
            </div>
            <button
              onClick={() => setErrorMsg('')}
              className="text-slate-400 hover:text-rose-600 text-xs font-bold p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/40 min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Dismiss notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[12px] leading-relaxed">{errorMsg}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        style={{
          width: '100%',
          height: '52px',
          minHeight: '52px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontSize: '0.95rem',
          fontWeight: 600,
          border: '1.5px solid var(--field-border, #E2E8F0)',
          background: 'var(--bg-card, #FFFFFF)',
          color: 'var(--text-primary, #172033)',
          cursor: isSigningIn ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          boxSizing: 'border-box'
        }}
        className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-[0.99] ${isSigningIn ? 'opacity-70' : ''} ${className}`}
      >
        {isSigningIn ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
            <span>Connecting to Google...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
