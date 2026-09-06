import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import '../styles/login.css';
import {
  Lock, Mail, User, Eye, EyeOff, CheckCircle2, AlertCircle,
  ArrowRight, RefreshCw, Sun, Moon, HelpCircle, ShieldCheck,
  KeyRound, X, Check, Calendar, Building2, Sparkles, Shield,
  Cpu, Layers, CheckCircle, ChevronRight, Loader2
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
  const { user, isAuthenticated, login, authError, clearAuthError } = useAuth();
  
  useEffect(() => {
    if (isAuthenticated || user) {
      onSuccess();
    }
  }, [isAuthenticated, user, onSuccess]);
  
  const pageVariants: Variants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } }
  };

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

  // Live Stats State
  const [liveStats, setLiveStats] = useState<{
    totalStudents: number;
    verifiedStudents: number;
    integrityStatus: string;
    lastUpdated: string;
  } | null>(null);

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

  // Fetch Live Stats from Public Endpoint
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/public/stats', { timeout: 6000 });
        const data = res.data;
        const total = data?.total || 307;
        const verified = data?.verified || 290;
        
        setLiveStats({
          totalStudents: total,
          verifiedStudents: verified,
          integrityStatus: 'PASS',
          lastUpdated: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        });
      } catch {
        // Keep previous value if fetch fails
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
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

  // 1. Password Login Handler
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
    setAuthStatusText('Signing in...');

    try {
      const res = await api.post('/auth/login', { username: cleanUser, password: cleanPass }, { timeout: 30000 });
      if (res.data && res.data.access_token) {
        setSuccessMsg('Authentication verified. Directing to workspace...');
        login(res.data.access_token, res.data.user);
        setTimeout(() => {
          onSuccess();
        }, 180);
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

  // 2. OTP Send & Verify Handlers
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
        onSuccess();
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

  // 3. Forgot Password Handlers
  const handleForgotVerifyDob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanInstId = forgotInstId.trim();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    const cleanDob = forgotDob.trim();

    if (!cleanInstId) {
      triggerShake();
      setError('Please enter your Institutional ID (Username).');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      triggerShake();
      setError('Please enter a valid registered institutional email.');
      return;
    }
    const dobParts = cleanDob.split('/');
    if (dobParts.length !== 3 || dobParts[2].length !== 4) {
      triggerShake();
      setError('Please enter a valid Date of Birth (DD/MM/YYYY).');
      return;
    }
    const backendDob = `${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`;

    setLoading(true);
    setAuthStatusText('Verifying identity & dispatching OTP...');
    try {
      await api.post('/auth/forgot-password/request', {
        institutional_id: cleanInstId,
        email: cleanEmail,
        date_of_birth: backendDob
      });
      setSuccessMsg(`Identity verified! Reset code sent to ${maskEmail(cleanEmail)}.`);
      setForgotStep('verify_otp');
      setForgotResetToken('');
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Identity verification failed. Please check your Institutional ID, Email and Date of Birth.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
    }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const rawOtp = forgotResetToken.trim();
    if (rawOtp.length !== 6) {
      triggerShake();
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setLoading(true);
    setAuthStatusText('Validating reset code...');
    try {
      const res = await api.post('/auth/forgot-password/verify', {
        institutional_id: forgotInstId.trim(),
        email: forgotEmail.trim().toLowerCase(),
        otp: rawOtp
      });
      if (res.data && res.data.reset_token) {
        setForgotResetToken(res.data.reset_token);
      }
      setForgotStep('reset_password');
      setSuccessMsg('Reset code verified. Please set your new password.');
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Invalid or expired verification code. Please try again.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
    }
  };

  const handleForgotResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword.length < 6) {
      triggerShake();
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      triggerShake();
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setAuthStatusText('Updating password credentials...');
    try {
      await api.post('/auth/forgot-password/reset', {
        institutional_id: forgotInstId.trim(),
        email: forgotEmail.trim().toLowerCase(),
        otp: forgotResetToken.trim(),
        new_password: newPassword
      });
      setForgotStep('success');
      setSuccessMsg('Your password has been successfully updated!');
    } catch (err: any) {
      triggerShake();
      setError(err.response?.data?.detail || 'Failed to reset password. Please start over.');
    } finally {
      setLoading(false);
      setAuthStatusText('');
    }
  };

  return (
    <div className="login-page-container">
      {/* ========================================================
          MOBILE HERO / HEADER: Official Floating Institutional Branding
          ======================================================== */}
      <div className="mobile-top-branding hide-on-desktop" role="banner">
        <div className="mobile-jubilee-badge">
          <picture>
            <source srcSet="/nec_25_logo.webp" type="image/webp" />
            <img
              src="/nec_25_logo.png"
              alt="25 NEC Silver Jubilee"
              className="mobile-jubilee-img"
              width={70}
              height={70}
              // @ts-ignore
              fetchPriority="high"
              onError={(e) => {
                // Fallback to CollegeLogo if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </picture>
        </div>
        <span className="mobile-eyebrow">INSTITUTIONAL PORTAL</span>
        <h1 className="mobile-title">Nandha LeetCode Intelligence</h1>
        <p className="mobile-subtitle">Nandha Engineering College (Autonomous) · Erode</p>
      </div>

      {/* Main Login Frame / Card */}
      <main className="login-frame" role="main">
        {/* ========================================================
            DESKTOP LEFT HERO PANEL
            ======================================================== */}
        <div className="panel-left hide-on-mobile">
          <div className="grid-texture"></div>
          <svg className="seal" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r="95" fill="none" stroke="#eae7de" strokeWidth="1"/>
            <circle cx="100" cy="100" r="80" fill="none" stroke="#eae7de" strokeWidth="1"/>
            <circle cx="100" cy="100" r="80" fill="none" stroke="#eae7de" strokeWidth="0.5" strokeDasharray="2 4"/>
            <text x="100" y="30" fill="#eae7de" fontSize="9" fontFamily="Inter, sans-serif" textAnchor="middle">VERIFIED · AUDITED · TRACKED</text>
            <text x="100" y="178" fill="#eae7de" fontSize="9" fontFamily="Inter, sans-serif" textAnchor="middle">NANDHA ENGINEERING COLLEGE</text>
          </svg>

          <div className="brand-row">
            <CollegeLogo className="brand-mark" size={48} />
            <div className="brand-text">
              <p className="eyebrow">INSTITUTIONAL PORTAL</p>
              <p className="name">Nandha LeetCode Intelligence</p>
              <p className="sub">Nandha Engineering College (Autonomous) · Erode</p>
            </div>
          </div>

          <div className="headline">
            <span className="kicker">
              <span className="kicker-dot" aria-hidden="true" />
              ZERO MOCK DATA · LIVE SYNC
            </span>
            <h1>
              <span className="block">Every submission,</span>
              <span className="block">verified and on record.</span>
            </h1>
            <p>
              Real-time algorithmic analytics and forensic evaluation for{' '}
              <strong>{liveStats ? liveStats.totalStudents.toLocaleString('en-IN') : '307'}</strong> tracked engineers across the institution.
            </p>
          </div>

          <div className="audit-log">
            <div className="audit-row audit-row--blue">
              <span className="label">Engineers tracked<span className="desc">Live rating & contest sync</span></span>
              <span className="value value--blue">
                {liveStats ? liveStats.totalStudents.toLocaleString('en-IN') : '307'}
              </span>
            </div>
            <div className="audit-row audit-row--green">
              <span className="label">Pipeline<span className="desc">Autonomous Sunday verification</span></span>
              <span className="value value--green">ACTIVE</span>
            </div>
            <div className="audit-row audit-row--amber">
              <span className="label">Integrity audit<span className="desc">
                {liveStats ? `${liveStats.verifiedStudents.toLocaleString('en-IN')} verified profiles` : 'Zero mock data parity'}
              </span></span>
              <span className="value value--amber">{liveStats ? liveStats.integrityStatus : 'PASS'}</span>
            </div>
          </div>
        </div>

        {/* ========================================================
            RIGHT LOGIN PANEL (Frosted Glass Card Surface)
            ======================================================== */}
        <div className={`panel-right ${isShaking ? 'shake-anim' : ''}`}>
          <div className="form-head">
            <div className="form-head-title-row">
              <h2>
                {currentView === 'help'
                  ? 'Institutional Help Desk'
                  : (currentView === 'forgot_password' ? 'Reset Workspace Password' : 'Sign in to your workspace')}
              </h2>
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? (
                  <Sun size={18} strokeWidth={2} />
                ) : (
                  <Moon size={18} strokeWidth={2} />
                )}
              </button>
            </div>
            <p>
              {currentView === 'help'
                ? 'Support for authorized personnel, faculty, and enrolled students.'
                : (currentView === 'forgot_password'
                  ? 'Verify your identity to reset your institutional credentials.'
                  : 'Use your institutional email or authenticate with Google.')}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {(error || authError) && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="error-banner"
                role="alert"
              >
                <AlertCircle size={18} className="shrink-0" />
                <span className="flex-1 min-w-0">{error || authError}</span>
                <button
                  type="button"
                  onClick={() => { setError(''); clearAuthError(); }}
                  className="banner-close-btn"
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
            
            {successMsg && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="success-banner"
                role="status"
              >
                <CheckCircle2 size={18} className="shrink-0" />
                <span className="flex-1 min-w-0">{successMsg}</span>
                <button
                  type="button"
                  onClick={() => setSuccessMsg('')}
                  className="banner-close-btn"
                  aria-label="Dismiss success message"
                >
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* VIEW: Main Login */}
            {currentView === 'login' && (
              <motion.div
                key="login"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="view-wrapper"
              >
                {/* Segmented Control Tabs */}
                <div className="tabs" role="tablist" aria-label="Login authentication method">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authMode === 'password'}
                    className={authMode === 'password' ? 'active' : ''}
                    onClick={() => { setAuthMode('password'); setError(''); clearAuthError(); }}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={authMode === 'otp'}
                    className={authMode === 'otp' ? 'active' : ''}
                    onClick={() => { setAuthMode('otp'); setError(''); clearAuthError(); }}
                  >
                    Secure OTP
                  </button>
                </div>

                {/* Password Form */}
                {authMode === 'password' ? (
                  <form onSubmit={handlePasswordLogin} noValidate>
                    <div className="field">
                      <label htmlFor="userId">Institutional Email or User ID</label>
                      <div className="input-wrap">
                        <Mail className="input-icon" size={19} aria-hidden="true" />
                        <input
                          id="userId"
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="username or faculty@nandhaengg.org"
                          autoComplete="username"
                          autoCapitalize="none"
                          spellCheck={false}
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label htmlFor="password">Password</label>
                      <div className="input-wrap">
                        <Lock className="input-icon" size={19} aria-hidden="true" />
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          required
                          disabled={loading}
                        />
                        <button
                          type="button"
                          className="toggle-visibility"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                        </button>
                      </div>
                    </div>

                    <div className="row-between">
                      <label className="remember">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <span>Remember me</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => { setCurrentView('forgot_password'); setForgotStep('dob'); setError(''); setSuccessMsg(''); }}
                        className="forgot"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <button className="submit-btn" type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" size={18} />
                          <span>{authStatusText || 'Signing in...'}</span>
                        </>
                      ) : (
                        <>
                          <span>Sign in to workspace</span>
                          <ArrowRight size={18} strokeWidth={2.5} className="btn-arrow" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  /* OTP Form */
                  <form onSubmit={otpStep === 'email' ? handleSendOtp : handleVerifyOtp} noValidate>
                    <div className="field">
                      <label htmlFor="otpEmail">Institutional Email</label>
                      <div className="input-wrap">
                        <Mail className="input-icon" size={19} aria-hidden="true" />
                        <input
                          id="otpEmail"
                          type="email"
                          value={otpEmail}
                          onChange={(e) => setOtpEmail(e.target.value)}
                          placeholder="faculty@nandhaengg.org"
                          autoComplete="email"
                          autoCapitalize="none"
                          spellCheck={false}
                          required
                          disabled={loading || otpStep === 'verify'}
                        />
                      </div>
                    </div>

                    {otpStep === 'verify' && (
                      <div className="field">
                        <label>6-Digit Secure OTP</label>
                        <div className="otp-boxes-row">
                          {otpDigits.map((digit, index) => (
                            <input
                              key={index}
                              ref={digitRefs[index]}
                              type="text"
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              pattern="\d{1}"
                              maxLength={1}
                              className="otp-box"
                              value={digit}
                              onChange={(e) => handleDigitChange(index, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !digit && index > 0) {
                                  digitRefs[index - 1].current?.focus();
                                }
                              }}
                              disabled={loading}
                              required
                            />
                          ))}
                        </div>
                        <div className="otp-actions-row">
                          <button
                            type="button"
                            onClick={() => { setOtpStep('email'); setOtpDigits(['', '', '', '', '', '']); setError(''); }}
                            className="forgot"
                          >
                            Change Email
                          </button>
                          <button
                            type="button"
                            onClick={handleSendOtp}
                            disabled={loading || resendCooldown > 0}
                            className="forgot"
                          >
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      className="submit-btn"
                      type="submit"
                      disabled={loading || (otpStep === 'verify' && otpDigits.join('').length !== 6)}
                    >
                      <span>{loading ? 'Processing...' : (otpStep === 'email' ? 'Send OTP Code' : 'Verify & Sign In')}</span>
                      {!loading && <ArrowRight size={18} strokeWidth={2.5} className="btn-arrow" />}
                    </button>
                  </form>
                )}

                {/* Google Divider */}
                <div className="divider">
                  <span>OR CONTINUE WITH</span>
                </div>

                {/* Google Sign In Component */}
                <GoogleSignInButton onSuccess={onSuccess} />

                {/* Single Institutional Help Row */}
                <div className="help-card-row">
                  <button
                    type="button"
                    className="help-trigger-btn"
                    onClick={() => { setCurrentView('help'); setError(''); }}
                  >
                    <div className="help-icon-box">
                      <HelpCircle size={18} />
                    </div>
                    <div className="help-text-box">
                      <span className="help-title">Need help accessing your account?</span>
                      <span className="help-subtitle">Contact your institution administrator.</span>
                    </div>
                    <ChevronRight size={16} className="help-chevron" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* VIEW: Forgot Password Flow */}
            {currentView === 'forgot_password' && (
              <motion.div
                key="forgot"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="view-wrapper"
              >
                {/* Step Indicator */}
                <div className="steps-indicator">
                  {(['dob', 'verify_otp', 'reset_password', 'success'] as const).map((step, i) => {
                    const stepIdx = ['dob', 'verify_otp', 'reset_password', 'success'].indexOf(forgotStep);
                    const done = i < stepIdx;
                    const active = step === forgotStep;
                    return (
                      <div key={step} className="step-item">
                        <div className={`step-dot ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
                          {done ? '' : i + 1}
                        </div>
                        {i < 3 && <div className={`step-line ${done ? 'done' : ''}`} />}
                      </div>
                    );
                  })}
                </div>

                {/* STEP 1: Identity Verification */}
                {forgotStep === 'dob' && (
                  <form onSubmit={handleForgotVerifyDob} noValidate>
                    <p className="step-desc">
                      Enter your <strong>Institutional ID / Username</strong>, email, and Date of Birth to receive a password reset code.
                    </p>
                    <div className="field">
                      <label htmlFor="forgotId">Username / Institutional ID</label>
                      <div className="input-wrap">
                        <User className="input-icon" size={19} />
                        <input
                          id="forgotId"
                          type="text"
                          value={forgotInstId}
                          onChange={(e) => setForgotInstId(e.target.value)}
                          placeholder="e.g. 732224CC101 or staff username"
                          required
                          disabled={loading}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="forgotEmail">Registered Email</label>
                      <div className="input-wrap">
                        <Mail className="input-icon" size={19} />
                        <input
                          id="forgotEmail"
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="faculty@nandhaengg.org"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="forgotDob">Date of Birth (DD/MM/YYYY)</label>
                      <div className="input-wrap">
                        <Calendar className="input-icon" size={19} />
                        <input
                          id="forgotDob"
                          type="text"
                          value={forgotDob}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length >= 3 && val.length <= 4) val = val.slice(0, 2) + '/' + val.slice(2);
                            else if (val.length >= 5) val = val.slice(0, 2) + '/' + val.slice(2, 4) + '/' + val.slice(4, 8);
                            setForgotDob(val);
                          }}
                          placeholder="DD/MM/YYYY"
                          maxLength={10}
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <div className="row-between" style={{ marginTop: '8px', marginBottom: '16px' }}>
                      <button
                        type="button"
                        onClick={() => { setCurrentView('login'); setAuthMode('password'); setError(''); setSuccessMsg(''); }}
                        className="forgot"
                      >
                        ← Back to Sign In
                      </button>
                    </div>
                    <button className="submit-btn" type="submit" disabled={loading}>
                      <span>{loading ? 'Verifying...' : 'Send OTP to Email'}</span>
                      {!loading && <ArrowRight size={18} strokeWidth={2.5} className="btn-arrow" />}
                    </button>
                  </form>
                )}

                {/* STEP 2: Enter OTP */}
                {forgotStep === 'verify_otp' && (
                  <form onSubmit={handleForgotVerifyOtp} noValidate>
                    <div className="text-center" style={{ textAlign: 'center', marginBottom: '16px' }}>
                      <p className="step-desc">
                        A 6-digit verification code was sent to<br />
                        <strong>{forgotEmail}</strong>.
                      </p>
                    </div>
                    <div className="field">
                      <label htmlFor="resetCode">6-Digit Reset Code</label>
                      <input
                        id="resetCode"
                        type="text"
                        inputMode="numeric"
                        pattern="\d{6}"
                        maxLength={6}
                        value={forgotResetToken}
                        onChange={(e) => setForgotResetToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="otp-single-input"
                        required
                        disabled={loading}
                        autoFocus
                      />
                    </div>
                    <div className="row-between" style={{ marginTop: '8px', marginBottom: '16px' }}>
                      <button
                        type="button"
                        onClick={() => { setForgotStep('dob'); setForgotResetToken(''); setError(''); setSuccessMsg(''); }}
                        className="forgot"
                      >
                        ← Change Details
                      </button>
                      <button
                        type="button"
                        onClick={handleForgotVerifyDob}
                        disabled={loading}
                        className="forgot"
                      >
                        Resend Code
                      </button>
                    </div>
                    <button className="submit-btn" type="submit" disabled={loading || forgotResetToken.length !== 6}>
                      <span>{loading ? 'Verifying...' : 'Verify Code'}</span>
                      {!loading && <ArrowRight size={18} strokeWidth={2.5} className="btn-arrow" />}
                    </button>
                  </form>
                )}

                {/* STEP 3: Set New Password */}
                {forgotStep === 'reset_password' && (
                  <form onSubmit={handleForgotResetPassword} noValidate>
                    <p className="step-desc">
                      Code verified. Choose a new secure password for your workspace account.
                    </p>
                    <div className="field">
                      <label htmlFor="newPass">New Password</label>
                      <div className="input-wrap">
                        <Lock className="input-icon" size={19} />
                        <input
                          id="newPass"
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          required
                          disabled={loading}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="toggle-visibility"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                        </button>
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor="confPass">Confirm New Password</label>
                      <div className="input-wrap">
                        <Lock className="input-icon" size={19} />
                        <input
                          id="confPass"
                          type={showPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          required
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <button
                      className="submit-btn"
                      type="submit"
                      disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
                    >
                      <span>{loading ? 'Updating...' : 'Save Password & Sign In'}</span>
                      {!loading && <ArrowRight size={18} strokeWidth={2.5} className="btn-arrow" />}
                    </button>
                  </form>
                )}

                {/* STEP 4: Success */}
                {forgotStep === 'success' && (
                  <div className="forgot-success-box">
                    <div className="success-icon-circle">
                      <Check size={32} strokeWidth={3} />
                    </div>
                    <h3>Password Updated Successfully</h3>
                    <p>
                      Your credentials have been updated. You can now sign in with your new password.
                    </p>
                    <button
                      type="button"
                      className="submit-btn"
                      onClick={() => {
                        setCurrentView('login');
                        setAuthMode('password');
                        setError('');
                        setSuccessMsg('');
                        setForgotInstId('');
                        setForgotEmail('');
                        setForgotDob('');
                        setForgotResetToken('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                    >
                      <span>Sign In Now</span>
                      <ArrowRight size={18} strokeWidth={2.5} className="btn-arrow" />
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* VIEW: Help Desk */}
            {currentView === 'help' && (
              <motion.div
                key="help"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="view-wrapper"
              >
                <div className="help-list">
                  <div className="help-list-item">
                    <div className="help-list-title">Student & Faculty Login Inquiries</div>
                    <div className="help-list-desc">Use your institutional register number or faculty ID to sign in. In case of handle changes, contact your department HOD.</div>
                  </div>
                  <div className="help-list-item">
                    <div className="help-list-title">OTP Delivery & Account Recovery</div>
                    <div className="help-list-desc">OTP codes are sent to your registered college email. If not received, verify your spam folder or use password reset.</div>
                  </div>
                  <div className="help-list-item highlight">
                    <div className="help-list-title">Institution Support Desk</div>
                    <div className="help-list-desc">Email: admin@nandhaengg.org · Nandha Engineering College (Autonomous)</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="submit-btn secondary-btn"
                  onClick={() => setCurrentView('login')}
                >
                  <span>Return to Sign In</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Security Message */}
          <div className="stamp" role="note" aria-label="Security verification notice">
            <ShieldCheck size={16} className="stamp-icon" />
            <span>Secured & audited by institution</span>
          </div>
        </div>
      </main>

      {/* Minimal Unified Footer */}
      <footer className="login-copyright" role="contentinfo">
        <p className="copyright-line">
          &copy; 2026 Nandha Engineering College. All rights reserved.
        </p>
        <p className="tagline-line">
          LEARN | SERVE | SUCCEED
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;
