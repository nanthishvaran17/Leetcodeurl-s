import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, User, Mail, AlertCircle, CheckCircle2, Loader2, ArrowLeft, RefreshCw, X, Eye, EyeOff, ShieldCheck, KeyRound, Sparkles } from 'lucide-react';

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
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [requestId, setRequestId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI & Animation States
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(300);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isShaking, setIsShaking] = useState(false);

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

  // Real Backend Expiry-driven Countdown Timer
  useEffect(() => {
    let interval: any = null;
    if (step === 'otp_verify') {
      const updateTimer = () => {
        if (expiresAtMs) {
          const remaining = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
          setTimerSeconds(remaining);
        } else {
          setTimerSeconds((prev) => Math.max(0, prev - 1));
        }
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [step, expiresAtMs]);

  // Resend Cooldown Timer
  useEffect(() => {
    let interval: any = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => Math.max(0, prev - 1));
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
      setError('Please enter your registered administrator email address.');
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { email: cleanEmail }, { timeout: 12000 });
      setSuccessMsg(res.data.message || 'Verification code sent to your registered email address.');
      setRequestId(res.data.request_id || '');
      setMaskedEmail(res.data.masked_email || maskEmail(cleanEmail));
      if (res.data.expires_at) {
        setExpiresAtMs(new Date(res.data.expires_at).getTime());
      } else {
        setExpiresAtMs(Date.now() + (res.data.expires_in || 300) * 1000);
      }
      setStep('otp_verify');
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(45);
      setTimeout(() => {
        digitRefs[0].current?.focus();
      }, 150);
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || err.message;
      triggerShake();
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Email request timed out. Please check your connection and try again.');
      } else if (err.response?.status === 403) {
        setError(detailMsg || 'Access denied: Administrator email does not match configured authoritative account.');
      } else if (err.response?.status === 502 || err.response?.status === 503) {
        setError(detailMsg || 'Unable to deliver verification code. Please try again.');
      } else {
        setError(detailMsg || 'Authentication service is temporarily unavailable. Please try again.');
      }
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
      const cleanEmail = email.trim().toLowerCase();
      const res = await api.post('/auth/resend-otp', { email: cleanEmail }, { timeout: 12000 });
      setSuccessMsg(res.data.message || 'New verification code sent to your registered email address.');
      setRequestId(res.data.request_id || '');
      setMaskedEmail(res.data.masked_email || maskEmail(cleanEmail));
      if (res.data.expires_at) {
        setExpiresAtMs(new Date(res.data.expires_at).getTime());
      } else {
        setExpiresAtMs(Date.now() + (res.data.expires_in || 300) * 1000);
      }
      setStep('otp_verify');
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(45);
      setTimeout(() => {
        digitRefs[0].current?.focus();
      }, 150);
    } catch (err: any) {
      const detailMsg = err.response?.data?.detail || err.message;
      triggerShake();
      setError(detailMsg || 'Unable to send the verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 450);
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
    const cleanOtp = fullOtp.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6) {
      setError('Please enter a valid 6-digit numeric verification code.');
      triggerShake();
      return;
    }

    if (timerSeconds <= 0) {
      setError('This verification code has expired. Please request a new code.');
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', {
        email: email.trim().toLowerCase(),
        otp: cleanOtp,
        request_id: requestId
      });

      login(res.data.access_token, res.data.user);
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 1100);
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Invalid verification code. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    try {
      const res = await api.post('/auth/login', { username: cleanUser, password: cleanPass }, { timeout: 45000 });
      login(res.data.access_token, res.data.user);
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      triggerShake();
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Server cold start in progress. Please wait a moment and click Sign In again.');
      } else {
        setError('Invalid username or password.');
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
    <div className={`relative max-w-md mx-auto my-4 glass-card p-7 md:p-8 rounded-3xl border border-indigo-200/80 dark:border-indigo-900/60 shadow-2xl space-y-5 bg-white/90 dark:bg-navy-950/90 backdrop-blur-xl cyber-glow-border transition-all ${isShaking ? 'animate-shake' : ''}`}>
      
      {/* Background Animated Scanline Effect */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
        <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent animate-scanline"></div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close admin login"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-800 rounded-xl transition-all z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      )}
      
      {/* Cyber Command Header with Radar Shield */}
      <div className="text-center space-y-2 relative">
        <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-indigo-600/20 dark:bg-indigo-500/20 animate-radar-ring pointer-events-none"></div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-white/20 relative z-10">
            <ShieldCheck className="w-7 h-7" />
          </div>
        </div>

        <div>
          <h2 className="text-lg md:text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
            NANDHA ENGINEERING COLLEGE
          </h2>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-600 dark:text-brand-400 mt-0.5">
            (AUTONOMOUS) • ESTD 2001
          </p>
        </div>

        <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 inline-flex items-center space-x-1.5 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>LEETCODE TRACKER • OFFICIAL ADMIN CONTROL</span>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-gray-100 dark:bg-navy-900 border border-gray-200 dark:border-navy-800">
        <button
          type="button"
          onClick={() => { setAuthMode('otp'); setStep('email'); setError(''); }}
          className={`py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
            authMode === 'otp'
              ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-md border border-brand-200/50 dark:border-brand-800/50'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Secure Email OTP</span>
        </button>
        <button
          type="button"
          onClick={() => { setAuthMode('admin'); setError(''); }}
          className={`py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
            authMode === 'admin'
              ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-md border border-brand-200/50 dark:border-brand-800/50'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Admin Password</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between space-x-2 animate-fadeIn shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="p-1 text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all shrink-0 cursor-pointer"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && step !== 'success' && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs flex items-center space-x-2 animate-fadeIn shadow-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Step 3: Identity Confirmed Success Unlock Animation */}
      {step === 'success' && (
        <div className="py-8 text-center space-y-4 animate-fadeIn">
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping"></div>
            <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 border-2 border-emerald-400 relative z-10">
              <CheckCircle2 className="w-9 h-9" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-wide uppercase">
              ✓ Identity Confirmed
            </h3>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              ADMINISTRATOR ACCESS GRANTED
            </p>
            <p className="text-[11px] text-gray-400 mt-2 animate-pulse">
              Redirecting to Institutional Control Center...
            </p>
          </div>
        </div>
      )}

      {/* Email OTP Mode */}
      {authMode === 'otp' && step !== 'success' && (
        <>
          {step === 'email' && (
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-navy-900/80 border border-indigo-100 dark:border-indigo-800/60 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-start space-x-2 shadow-sm">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold block">Authoritative Admin Destination:</span>
                  <span>Real OTP is dispatched only to registered administrator accounts (e.g. <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">n******7@gmail.com</span>).</span>
                </div>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                    REGISTERED ADMINISTRATOR EMAIL
                  </label>
                  <div className="relative">
                    <Mail className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. nanthishvaran17@gmail.com"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900 text-sm font-semibold focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>SECURING CONNECTION & SENDING OTP...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>SEND SECURE OTP</span>
                    </>
                  )}
                </button>
              </form>

              <div className="space-y-3 pt-2">
                <div className="relative flex items-center justify-center py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-gray-300 dark:via-navy-700 to-transparent"></div>
                  </div>
                  <div className="relative px-3.5 py-1 rounded-full bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 shadow-sm flex items-center space-x-1.5 text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                    <span>OR INSTITUTIONAL SSO</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                  </div>
                </div>
                <GoogleSignInButton onSuccess={onSuccess} />
              </div>
            </div>
          )}

          {step === 'otp_verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-2xl bg-brand-50/80 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-xs text-brand-900 dark:text-brand-200 flex items-center justify-between shadow-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[10px] uppercase font-bold tracking-wider">Verification Code Sent To:</span>
                  <span className="font-mono font-black text-brand-700 dark:text-brand-300 text-sm">{maskedEmail || maskEmail(email)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); setSuccessMsg(''); }}
                  className="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    ENTER 6-DIGIT SECURITY CODE
                  </label>
                  {timerSeconds > 0 ? (
                    <span className="text-xs font-black font-mono text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950 px-2 py-0.5 rounded-md border border-brand-200 dark:border-brand-800">
                      OTP Expires In {formatTimer(timerSeconds)}
                    </span>
                  ) : (
                    <span className="text-xs font-black font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800 animate-pulse">
                      OTP Expired
                    </span>
                  )}
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
                      className="w-full h-13 text-center text-xl font-mono font-black border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-navy-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none shadow-md transition-all"
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="py-3 rounded-xl border border-gray-300 dark:border-navy-700 bg-gray-50 dark:bg-navy-900 text-gray-700 dark:text-gray-200 font-extrabold text-xs hover:bg-gray-100 dark:hover:bg-navy-800 disabled:opacity-50 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'RESEND OTP'}</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || otpDigits.join('').length !== 6 || timerSeconds <= 0}
                  className="py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-brand-600/30 flex items-center justify-center space-x-1.5 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>VERIFY & CONTINUE</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-navy-900/90 border border-slate-200 dark:border-navy-800 text-[11px] text-slate-600 dark:text-slate-400 text-center leading-relaxed">
                💡 <span className="font-bold text-slate-800 dark:text-slate-200">Gmail Inbox Tip:</span> Check your <strong className="text-brand-600 dark:text-brand-400 font-bold">Inbox, Spam, or Promotions</strong> folders for your verification code.
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
              ADMINISTRATOR USERNAME
            </label>
            <div className="relative">
              <User className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900 text-sm font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
              PASSWORD
            </label>
            <div className="relative">
              <Lock className="w-4.5 h-4.5 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-navy-900 text-sm font-semibold focus:ring-2 focus:ring-brand-500 focus:outline-none shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded-lg focus:outline-none cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AUTHENTICATING...</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>SIGN IN TO ADMIN DASHBOARD</span>
              </>
            )}
          </button>
        </form>
      )}

    </div>
  );
};

