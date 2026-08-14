import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, User, Mail, KeyRound, AlertCircle, CheckCircle2, Loader2, ArrowLeft, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import api from '../services/api';

interface LoginPageProps {
  onSuccess: () => void;
  onClose?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess, onClose }) => {
  const [authMode, setAuthMode] = useState<'otp' | 'admin'>('otp');
  const [step, setStep] = useState<'email' | 'otp_verify' | 'success'>('email');

  // Form States
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [requestId, setRequestId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // UI & Timer States
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);

  const digitRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  const { login } = useAuth();

  // Keyboard ESC Key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


  // 5-minute OTP Expiration Timer
  useEffect(() => {
    let interval: any = null;
    if (step === 'otp_verify' && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timerSeconds]);

  // Resend Cooldown Timer
  useEffect(() => {
    let interval: any = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const maskEmail = (str: string) => {
    if (!str || !str.includes('@')) return str;
    const [name, domain] = str.split('@');
    if (name.length <= 2) return `${name[0]}***@${domain}`;
    return `${name[0]}*****${name[name.length - 1]}@${domain}`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid official email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { email: cleanEmail });
      setSuccessMsg(res.data.message || 'OTP sent to your registered email address.');
      setRequestId(res.data.request_id || '');
      setStep('otp_verify');
      setOtpDigits(['', '', '', '', '', '']);
      setTimerSeconds(300);
      setResendCooldown(60);
      setTimeout(() => {
        digitRefs[0].current?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to send the verification code. Please check the email service configuration or try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await api.post('/auth/send-otp', { email: email.trim().toLowerCase() });
      setSuccessMsg(res.data.message || 'Verification code sent to your registered email address.');
      setRequestId(res.data.request_id || '');
      setStep('otp_verify');
      setOtpDigits(['', '', '', '', '', '']);
      setTimerSeconds(300);
      setResendCooldown(60);
      setTimeout(() => {
        digitRefs[0].current?.focus();
      }, 100);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Unable to send the verification code. Please check the email service configuration or try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal) {
      const newDigits = [...otpDigits];
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    const digit = cleanVal[cleanVal.length - 1];
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);

    // Auto-advance focus
    if (index < 5) {
      digitRefs[index + 1].current?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      digitRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setOtpDigits(newDigits);

    const nextIndex = Math.min(pastedData.length, 5);
    digitRefs[nextIndex].current?.focus();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6 || !/^\d+$/.test(fullOtp)) {
      setError('Please enter a valid 6-digit numeric verification code.');
      return;
    }

    if (timerSeconds <= 0) {
      setError('This verification code has expired. Please request a new code.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        otp: fullOtp,
        request_id: requestId
      });
      login(res.data.access_token, res.data.user);
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid verification code. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password }, { timeout: 30000 });
      login(res.data.access_token, res.data.user);
      onSuccess();
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Login request timed out. Please verify backend server on port 8000.');
      } else {
        setError(err.response?.data?.detail || 'Invalid username or password.');
      }
    } finally {
      setLoading(false);
    }
  };


  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative max-w-md mx-auto my-4 glass-card p-7 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close admin login"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-800 rounded-xl transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      
      {/* Header */}
      <div className="text-center space-y-1.5">

        <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-brand-600/30">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
          NANDHA ENGINEERING COLLEGE
        </h2>
        <p className="text-xs font-bold text-brand-600 dark:text-brand-400">
          LeetCode Performance Tracker • Official Portal
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-gray-100 dark:bg-navy-900 border border-gray-200 dark:border-navy-800">
        <button
          type="button"
          onClick={() => { setAuthMode('otp'); setStep('email'); setError(''); }}
          className={`py-2 text-xs font-extrabold rounded-xl transition-all ${
            authMode === 'otp'
              ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Secure Email OTP
        </button>
        <button
          type="button"
          onClick={() => { setAuthMode('admin'); setError(''); }}
          className={`py-2 text-xs font-extrabold rounded-xl transition-all ${
            authMode === 'admin'
              ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Admin Password
        </button>
      </div>

      {/* Error & Success Banners */}
      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between space-x-2 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all shrink-0"
            title="Close error message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && step !== 'success' && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Step 3: Verification Success */}
      {step === 'success' && (
        <div className="py-6 text-center space-y-3 animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border-2 border-emerald-500">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-gray-900 dark:text-white">
            ✓ Verification Successful
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Loading your institutional dashboard...
          </p>
        </div>
      )}

      {/* Email OTP Mode */}
      {authMode === 'otp' && step !== 'success' && (
        <>
          {step === 'email' && (
            <div className="space-y-4">
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    Official Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@nandhaengg.org or admin@nandha.edu.in"
                      required
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-md shadow-brand-600/30 flex items-center justify-center space-x-2 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Verification Code...</span>
                    </>
                  ) : (
                    <span>SEND OTP</span>
                  )}
                </button>
              </form>

              {/* Google Sign In Option */}
              <div className="space-y-2 pt-1">
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-gray-200 dark:border-gray-800 w-full"></div>
                  <span className="bg-white dark:bg-navy-950 px-3 text-[10px] font-black text-gray-400 uppercase tracking-widest absolute">
                    OR GOOGLE SIGN IN
                  </span>
                </div>
                <GoogleSignInButton onSuccess={onSuccess} />
              </div>
            </div>
          )}

          {step === 'otp_verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fadeIn">
              <div className="p-3 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-xs text-brand-900 dark:text-brand-200 flex items-center justify-between">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold">Verification code sent to:</span>
                  <span className="font-extrabold text-brand-700 dark:text-brand-300">{maskEmail(email)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-[11px] font-bold text-brand-600 hover:underline flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Change</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    6-Digit Verification Code
                  </label>
                  <span className="text-xs font-extrabold font-mono text-brand-600 dark:text-brand-400">
                    Expires: {formatTimer(timerSeconds)}
                  </span>
                </div>

                {/* 6-Digit Segmented Box Inputs */}
                <div className="grid grid-cols-6 gap-2">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={digitRefs[idx]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      className="w-full h-12 text-center text-lg font-mono font-black border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-navy-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-sm transition-all"
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="py-2.5 rounded-xl border border-gray-300 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-gray-700 dark:text-gray-200 font-extrabold text-xs hover:bg-gray-100 dark:hover:bg-navy-800 disabled:opacity-50 flex items-center justify-center space-x-1 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'RESEND OTP'}</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6 || timerSeconds <= 0}
                  className="py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-md shadow-brand-600/30 flex items-center justify-center space-x-1 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>VERIFY OTP</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* Admin Password Mode */}
      {authMode === 'admin' && (
        <form onSubmit={handleAdminSubmit} className="space-y-4 animate-fadeIn">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-md shadow-brand-600/30 flex items-center justify-center space-x-2 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Admin Dashboard</span>
            )}
          </button>
        </form>
      )}

    </div>
  );
};
