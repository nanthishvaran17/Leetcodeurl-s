import React, { useState, useEffect, useRef } from 'react';
import {
  Lock, Mail, User, Eye, EyeOff, CheckCircle2, AlertCircle,
  ArrowRight, RefreshCw, Sun, Moon, HelpCircle, ShieldCheck,
  KeyRound, X, Check, Calendar, Building2, Sparkles, Shield,
  Cpu, Layers, CheckCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { CollegeLogo } from '../components/CollegeLogo';
import api from '../services/api';

interface LoginPageProps {
  onSuccess: () => void;
  onClose?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { login } = useAuth();

  // Auth Mode: 'password' | 'otp'
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');
  
  // Views: 'login' | 'forgot_password' | 'help'
  const [currentView, setCurrentView] = useState<'login' | 'forgot_password' | 'help'>('login');

  // Password Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // OTP Form States
  const [otpEmail, setOtpEmail] = useState('');
  const [otpStep, setOtpStep] = useState<'email' | 'verify'>('email');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [requestId, setRequestId] = useState<string>('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Forgot Password Real Flow States
  const [forgotStep, setForgotStep] = useState<'dob' | 'send_otp' | 'verify_otp' | 'reset_password' | 'success'>('dob');
  const [forgotInstId, setForgotInstId] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotDob, setForgotDob] = useState('');
  const [forgotRequestId, setForgotRequestId] = useState('');
  const [forgotResetToken, setForgotResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Global UI & Micro-interaction States
  const [loading, setLoading] = useState(false);
  const [authStatusText, setAuthStatusText] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const digitRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  // Sync Dark Mode state with document element
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    }
  };

  // Cooldown timer for OTP resend
  useEffect(() => {
    let timer: any = null;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 600);
  };

  // Helper to mask email for security display
  const maskEmail = (emailStr: string) => {
    if (!emailStr || !emailStr.includes('@')) return emailStr;
    const [name, domain] = emailStr.split('@');
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
    return `${maskedName}@${domain}`;
  };

  // ─── 1. Password Login Handler ──────────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      triggerShake();
      setError('Please enter your institutional email or username and password.');
      return;
    }

    setLoading(true);
    setAuthStatusText('Authenticating credentials...');

    try {
      const res = await api.post('/auth/login', { username: cleanUser, password: cleanPass }, { timeout: 8000 });
      if (res.data && res.data.access_token) {
        setAuthStatusText(`Welcome back, ${res.data.user?.username || 'User'} • Loading authorized workspace...`);
        setSuccessMsg('Authentication verified. Directing to workspace...');
        login(res.data.access_token, res.data.user);
        setTimeout(() => {
          onSuccess();
        }, 400);
        return;
      }
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Invalid email/username or password. Please check your credentials.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
    }
  };

  // ─── 2. OTP Send & Verify Handlers ─────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanEmail = otpEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      triggerShake();
      setError('Please enter a valid registered institutional email address.');
      return;
    }

    setLoading(true);
    setAuthStatusText('Dispatching secure OTP code...');
    try {
      const res = await api.post('/auth/send-otp', { email: cleanEmail }, { timeout: 6000 });
      const masked = res.data?.masked_email || maskEmail(cleanEmail);
      setRequestId(res.data?.request_id || `req_${Date.now()}`);
      setSuccessMsg(`Verification code sent to ${masked}. Please check your inbox.`);
      setOtpStep('verify');
      setResendCooldown(30);
      setTimeout(() => digitRefs[0].current?.focus(), 150);
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Failed to send OTP code. Please verify your email.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      triggerShake();
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setAuthStatusText('Verifying OTP code...');
    try {
      const res = await api.post('/auth/verify-otp', {
        email: otpEmail.trim().toLowerCase(),
        otp: fullOtp,
        request_id: requestId
      }, { timeout: 6000 });

      if (res.data && res.data.access_token) {
        setAuthStatusText('Authentication verified • Directing to workspace...');
        setSuccessMsg('OTP verified successfully!');
        login(res.data.access_token, res.data.user);
        setTimeout(() => {
          onSuccess();
        }, 400);
        return;
      }
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
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

    if (index < 5 && digit) {
      digitRefs[index + 1].current?.focus();
    }
  };

  // ─── 3. Forgot Password 5-Step Real Handlers ────────────────────────────────
  const handleForgotVerifyDob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanInstId = forgotInstId.trim();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    const cleanDob = forgotDob.trim();

    if (!cleanInstId) {
      triggerShake();
      setError('Please enter your Institutional ID.');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      triggerShake();
      setError('Please enter a valid registered institutional email.');
      return;
    }

    if (!cleanDob) {
      triggerShake();
      setError('Please enter your registered Date of Birth.');
      return;
    }

    setLoading(true);
    setAuthStatusText('Verifying identity & dispatching OTP...');
    try {
      await api.post('/auth/forgot-password/request', {
        institutional_id: cleanInstId,
        email: cleanEmail,
        date_of_birth: cleanDob
      });

      setSuccessMsg(`Identity verified! Reset code sent to ${maskEmail(cleanEmail)}.`);
      setForgotStep('verify_otp');
      setOtpDigits(['', '', '', '', '', '']);
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Identity verification failed. Please verify your details and try again.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
    }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      triggerShake();
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    setAuthStatusText('Validating reset code...');
    try {
      await api.post('/auth/forgot-password/verify', {
        institutional_id: forgotInstId.trim(),
        email: forgotEmail.trim().toLowerCase(),
        otp: fullOtp
      });
      setForgotStep('reset_password');
      setSuccessMsg('Reset code verified. Please set your new password.');
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
    }
  };

  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword.length < 12) {
      triggerShake();
      setError('Password must be at least 12 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerShake();
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setAuthStatusText('Updating password credentials...');
    try {
      await api.post('/auth/forgot-password/reset', {
        institutional_id: forgotInstId.trim(),
        email: forgotEmail.trim().toLowerCase(),
        otp: otpDigits.join(''),
        new_password: newPassword
      });
      setForgotStep('success');
      setSuccessMsg('Your password has been successfully updated!');
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col justify-between transition-colors duration-200 selection:bg-brand-500 selection:text-white">
      
      {/* ── TOP GLOBAL INSTITUTIONAL HEADER ── */}
      <header className="w-full bg-white/80 dark:bg-navy-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-navy-800 transition-colors shadow-xs z-20">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Official College Logo & Platform Title */}
            <div className="flex items-center space-x-3 group">
              <CollegeLogo size={38} className="w-9 h-9 transition-transform group-hover:scale-105" />
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="font-black text-sm sm:text-base tracking-tight text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    NANDHA LEETCODE INTELLIGENCE
                  </span>
                  <span className="hidden sm:inline-flex px-2 py-0.5 text-[9px] font-black rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 uppercase tracking-wider">
                    Institutional Portal
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide">
                  Nandha Engineering College (Autonomous) • Erode
                </span>
              </div>
            </div>

            {/* Right: Theme Switcher & Institutional Badge */}
            <div className="flex items-center space-x-3">
              <span className="hidden md:inline-flex text-xs font-semibold text-slate-500 dark:text-slate-400">
                Authorized Personnel & Students
              </span>

              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 border border-slate-200 dark:border-navy-800 transition-all cursor-pointer shadow-xs"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-600" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT: BALANCED INSTITUTIONAL SPLIT LAYOUT ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex items-center justify-center">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden bg-white dark:bg-navy-900 border border-slate-200/90 dark:border-navy-800 shadow-xl">
          
          {/* ══════════════════════════════════════════════════════════════════
              LEFT PANEL: INSTITUTIONAL CONTEXT & CAMPUS SHOWCASE (5 Cols)
              ════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-5 text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-white/15">
            
            {/* Real Nandha Campus Gate Background Image (Clearly & Sharply Visible) */}
            <div
              className="absolute inset-0 z-0 bg-cover bg-center object-cover transition-transform duration-700 hover:scale-105"
              style={{ backgroundImage: "url('/nandha_gate_bg.jpg')" }}
            />
            {/* Elegant Dark Gradient for Clear Visibility & High-Contrast Readability */}
            <div className="absolute inset-0 z-0 bg-gradient-to-t from-navy-950/95 via-navy-950/70 to-navy-950/45" />

            {/* Top Branding Section */}
            <div className="relative z-10 space-y-4">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/20 backdrop-blur-md text-sky-300 text-[10px] font-black uppercase tracking-wider shadow-md">
                <Shield className="w-3.5 h-3.5 text-sky-400" />
                <span>OFFICIAL PLATFORM GATEWAY</span>
              </div>

              <div className="space-y-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                  Nandha Institutional Coding Intelligence
                </h2>
                <p className="text-xs text-slate-200 font-medium leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  Real-time algorithmic analytics, autonomous contest tracking, and forensic student evaluation platform.
                </p>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="relative z-10 my-6 space-y-2.5">
              {[
                { title: '1,500+ Tracked Engineers', desc: 'Real-time performance tracking & rating analytics' },
                { title: 'Autonomous Sunday Pipeline', desc: 'Auto-sync, verification & multi-format reports' },
                { title: 'Cryptographic Parity & Audit', desc: 'Zero mock data • Forensic evidence verification' }
              ].map((feat, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-slate-900/80 border border-white/20 backdrop-blur-md flex items-start space-x-3 text-xs shadow-lg"
                >
                  <div className="w-5 h-5 rounded-lg bg-sky-500/30 text-sky-300 flex items-center justify-center shrink-0 mt-0.5 border border-sky-400/40">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-[11.5px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{feat.title}</h4>
                    <p className="text-[10.5px] text-slate-200 leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Security Note */}
            <div className="relative z-10 pt-4 border-t border-white/20 flex items-center justify-between text-[11px] text-slate-200 font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Dual-Token Protected</span>
              </span>
              <span className="text-white font-bold">256-Bit Encrypted</span>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              RIGHT PANEL: AUTHENTICATION CONSOLE (7 Cols)
              ════════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-6">
            
            {/* Card Header */}
            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {currentView === 'login' ? 'Sign In to Workspace' : currentView === 'forgot_password' ? 'Password Recovery' : 'Institutional Support'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {currentView === 'login'
                  ? 'Enter your institutional email/username or authenticate with Google'
                  : currentView === 'forgot_password'
                  ? 'Verify your registered details to reset your access credentials'
                  : 'Assistance for password resets, OTP delivery, or account status'}
              </p>
            </div>

            {/* Status Progress State */}
            {authStatusText && (
              <div className="p-3 rounded-2xl bg-brand-50 dark:bg-brand-950/50 border border-brand-200 dark:border-brand-900/50 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center justify-center space-x-2 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{authStatusText}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center space-x-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center space-x-2.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                VIEW 1: REGULAR LOGIN (PASSWORD & OTP)
                ══════════════════════════════════════════════════════════════ */}
            {currentView === 'login' && (
              <div className={`space-y-5 ${isShaking ? 'animate-shake' : ''}`}>
                
                {/* Segmented Tab Control */}
                <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('password'); setError(''); setSuccessMsg(''); }}
                    className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                      authMode === 'password'
                        ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Password Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('otp'); setError(''); setSuccessMsg(''); }}
                    className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                      authMode === 'otp'
                        ? 'bg-white dark:bg-navy-800 text-brand-600 dark:text-brand-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Secure OTP Code
                  </button>
                </div>

                {/* PASSWORD MODE FORM */}
                {authMode === 'password' && (
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Institutional Email or User ID
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="username or email@nandha.edu.in"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Options Row */}
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <label className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                        />
                        <span>Remember me</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => { setCurrentView('forgot_password'); setError(''); setSuccessMsg(''); setForgotStep('dob'); }}
                        className="text-brand-600 dark:text-brand-400 hover:underline font-bold cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>

                    {/* Sign In Button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-md shadow-brand-500/20 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>SIGN IN TO WORKSPACE</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* OTP MODE FORM */}
                {authMode === 'otp' && (
                  <div className="space-y-4">
                    {otpStep === 'email' && (
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                            Registered Institutional Email
                          </label>
                          <div className="relative">
                            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="email"
                              value={otpEmail}
                              onChange={(e) => setOtpEmail(e.target.value)}
                              placeholder="user@nandha.edu.in"
                              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
                              required
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-md shadow-brand-500/20 transition-all cursor-pointer hover:scale-[1.01]"
                        >
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Dispatch OTP Code</span>}
                        </button>
                      </form>
                    )}

                    {otpStep === 'verify' && (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
                          Enter 6-digit code sent to <strong className="text-slate-800 dark:text-white">{maskEmail(otpEmail)}</strong>
                        </p>

                        <div className="flex justify-center space-x-2">
                          {otpDigits.map((digit, idx) => (
                            <input
                              key={idx}
                              ref={digitRefs[idx]}
                              type="text"
                              maxLength={1}
                              value={digit}
                              onChange={(e) => handleDigitChange(idx, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !digit && idx > 0) {
                                  digitRefs[idx - 1].current?.focus();
                                }
                              }}
                              className="w-10 sm:w-11 h-12 text-center text-lg font-mono font-bold rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none"
                            />
                          ))}
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center space-x-2 shadow-md shadow-brand-500/20 transition-all cursor-pointer hover:scale-[1.01]"
                        >
                          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Verify & Sign In</span>}
                        </button>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <button
                            type="button"
                            onClick={() => setOtpStep('email')}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                          >
                            ← Change Email
                          </button>

                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={resendCooldown > 0 || loading}
                            className="text-brand-600 dark:text-brand-400 font-bold disabled:opacity-50 cursor-pointer"
                          >
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Google Sign-In & Single Sign-On Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-navy-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-navy-900 px-3 text-[10.5px] font-black text-slate-400 tracking-wider">
                      Or continue with
                    </span>
                  </div>
                </div>

                <GoogleSignInButton onSuccess={onSuccess} className="w-full" />

                {/* Help Trigger */}
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentView('help')}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 font-bold inline-flex items-center space-x-1 cursor-pointer transition-colors"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Need help accessing your account?</span>
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                VIEW 2: FORGOT PASSWORD 5-STEP PROCESS
                ══════════════════════════════════════════════════════════════ */}
            {currentView === 'forgot_password' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-3">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
                    <KeyRound className="w-4 h-4 text-brand-600" />
                    <span>Password Reset Verification</span>
                  </h4>
                  <button
                    onClick={() => { setCurrentView('login'); setError(''); setSuccessMsg(''); }}
                    className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Back to Login
                  </button>
                </div>

                {forgotStep === 'dob' && (
                  <form onSubmit={handleForgotVerifyDob} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Institutional ID
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={forgotInstId}
                          onChange={(e) => setForgotInstId(e.target.value)}
                          placeholder="e.g. NEC-CSE-FAC-001 or 732221104001"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-xs font-semibold text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Registered Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="user@nandha.edu.in"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-xs font-semibold text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Date of Birth (YYYY-MM-DD)
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={forgotDob}
                          onChange={(e) => setForgotDob(e.target.value)}
                          placeholder="2003-05-15"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-xs font-mono text-slate-900 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs shadow-md cursor-pointer transition-all"
                    >
                      {loading ? 'Verifying Identity...' : 'Verify DOB & Request Reset Code'}
                    </button>
                  </form>
                )}

                {forgotStep === 'verify_otp' && (
                  <form onSubmit={handleForgotVerifyOtp} className="space-y-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center font-medium">
                      Enter 6-digit reset code sent to <strong className="text-slate-800 dark:text-white">{maskEmail(forgotEmail)}</strong>
                    </p>
                    <div className="flex justify-center space-x-2">
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={digitRefs[idx]}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(idx, e.target.value)}
                          className="w-10 sm:w-11 h-12 text-center text-lg font-mono font-bold rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white outline-none"
                        />
                      ))}
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-black text-xs shadow-md cursor-pointer transition-all"
                    >
                      {loading ? 'Validating Code...' : 'Validate Reset Code'}
                    </button>
                  </form>
                )}

                {forgotStep === 'reset_password' && (
                  <form onSubmit={handleForgotResetPassword} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 12 chars, uppercase, lowercase, number, special"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-xs font-semibold text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-950 text-xs font-semibold text-slate-900 dark:text-white"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-md cursor-pointer transition-all"
                    >
                      {loading ? 'Updating Credentials...' : 'Save New Password & Sign In'}
                    </button>
                  </form>
                )}

                {forgotStep === 'success' && (
                  <div className="text-center space-y-4 py-4">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
                      <Check className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        Password Updated Successfully
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Your account credentials have been synchronized. You can now sign in with your new password.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCurrentView('login'); setAuthMode('password'); setError(''); setSuccessMsg(''); }}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-black cursor-pointer shadow-md"
                    >
                      Return to Sign In
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                VIEW 3: INSTITUTIONAL HELP MODAL
                ══════════════════════════════════════════════════════════════ */}
            {currentView === 'help' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-navy-800 pb-3">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center space-x-2">
                    <HelpCircle className="w-4 h-4 text-brand-600" />
                    <span>Institutional Help Desk</span>
                  </h4>
                  <button
                    onClick={() => setCurrentView('login')}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-1">
                    <h5 className="font-extrabold text-slate-900 dark:text-white">OTP Delivery Questions</h5>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Check your institutional inbox or spam folder. Verification codes expire in 5 minutes.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 space-y-1">
                    <h5 className="font-extrabold text-slate-900 dark:text-white">Account Locked or Disabled</h5>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Contact your Department Coordinator or HOD to verify your active roster enrollment.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-brand-50/60 dark:bg-navy-950 border border-brand-200/60 dark:border-navy-800 text-center space-y-0.5">
                    <p className="font-black text-brand-900 dark:text-brand-200">Official Support Inquiries</p>
                    <a href="mailto:admin@nandhaengg.org" className="text-[11px] font-mono text-brand-600 dark:text-brand-400 hover:underline">
                      admin@nandhaengg.org
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentView('login')}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-slate-200 font-black text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  Return to Sign In
                </button>
              </div>
            )}

            {/* Bottom Institutional Disclaimer */}
            <div className="pt-3 border-t border-slate-100 dark:border-navy-800 text-center text-[10.5px] text-slate-400 dark:text-slate-500 font-medium">
              <span>Restricted institutional platform for authorized faculty, staff, and enrolled students.</span>
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER: UNIFIED INSTITUTIONAL FOOTER ── */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold border-t border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/60 backdrop-blur-sm">
        <p>© {new Date().getFullYear()} Nandha Engineering College (Autonomous) • Institutional Coding Intelligence Platform</p>
      </footer>

    </div>
  );
};
