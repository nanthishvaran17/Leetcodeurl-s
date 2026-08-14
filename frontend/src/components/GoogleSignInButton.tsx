import React, { useState } from 'react';
import { Loader2, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authenticateWithGoogle } from '../services/googleAuth';

interface GoogleSignInButtonProps {
  onSuccess?: () => void;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onSuccess, className = '' }) => {
  const { user, login, logout, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignIn = async () => {
    setErrorMsg('');
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

  if (user) {
    return (
      <div className={`flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 shadow-md ${className}`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-sm">
            {user.username ? user.username[0].toUpperCase() : 'A'}
          </div>

          <div>
            <div className="flex items-center space-x-1.5">
              <h4 className="text-sm font-extrabold text-gray-900 dark:text-white truncate max-w-[160px]">
                {user.username}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-500/20 text-brand-600 dark:text-brand-300 uppercase tracking-wider">
                {user.role}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
              {user.email}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          disabled={loading}
          className="p-2.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 transition-all"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full">
      {errorMsg && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-gray-400 hover:text-rose-600 text-sm font-bold ml-2">✕</button>
        </div>
      )}

      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        className={`w-full py-3 px-5 rounded-xl bg-white dark:bg-navy-900 hover:bg-gray-50 dark:hover:bg-navy-800 text-gray-800 dark:text-white font-extrabold text-xs border border-gray-300 dark:border-gray-700 shadow-md hover:shadow-lg flex items-center justify-center space-x-3 transition-all duration-200 ${className}`}
      >
        {isSigningIn ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            <span>Verifying Google Account...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>
    </div>
  );
};
