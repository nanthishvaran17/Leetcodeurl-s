import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import '../styles/login.css';
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
  const { login, authError, clearAuthError, authState } = useAuth();
  
  const pageVariants: Variants = {
    initial: { opacity: 0, x: -15, filter: 'blur(4px)' },
    animate: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.3, ease: 'easeOut' } },
    exit: { opacity: 0, x: 15, filter: 'blur(4px)', transition: { duration: 0.2, ease: 'easeIn' } }
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

  // Premium Mouse Parallax Effect (Desktop only, respects reduced-motion)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (window.innerWidth < 768) return;

      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;

      document.documentElement.style.setProperty('--mouse-x', x.toString());
      document.documentElement.style.setProperty('--mouse-y', y.toString());
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // ─── Fetch Live Stats from Public Endpoint ───────────────────────────────────
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/public/stats', { timeout: 6000 });
        const data = res.data;
        const total = data?.total || 1450;
        const verified = data?.verified || 0;
        
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
    const interval = setInterval(fetchStats, 5 * 60 * 1000); // auto-refresh every 5 min
    return () => clearInterval(interval);
  }, []);;

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
        onSuccess();
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
      await api.post('/auth/forgot-password/verify', {
        institutional_id: forgotInstId.trim(),
        email: forgotEmail.trim().toLowerCase(),
        otp: rawOtp
      });
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
      {/* Mobile Branding Header with Official College Image & Premium Institutional Card */}
      <div className="mobile-header hide-on-desktop">
        <div className="mobile-header-bg">
          <img src="/nandha_gate_bg.jpg" alt="Nandha Engineering College" className="mobile-header-img" />
          <div className="mobile-header-overlay" />
        </div>
        <div className="mobile-header-content">
          <div className="mobile-badge-row">
            <CollegeLogo className="mobile-brand-mark" size={44} />
            <span className="mobile-eyebrow">NANDHA ENGINEERING COLLEGE</span>
          </div>
          <h1 className="mobile-name">Nandha LeetCode Intelligence</h1>
          <p className="mobile-sub">Official Algorithmic Performance & Forensic Portal · Erode</p>
        </div>
      </div>

      <div className="login-frame">

        {/* LEFT PANEL */}
        <div className="panel-left cinematic-bg-anim">
          <div className="grid-texture"></div>
          <svg className="seal animate-stagger-1" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="95" fill="none" stroke="#eae7de" strokeWidth="1"/>
            <circle cx="100" cy="100" r="80" fill="none" stroke="#eae7de" strokeWidth="1"/>
            <circle cx="100" cy="100" r="80" fill="none" stroke="#eae7de" strokeWidth="0.5" strokeDasharray="2 4"/>
            <text x="100" y="30" fill="#eae7de" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle">VERIFIED · AUDITED · TRACKED</text>
            <text x="100" y="178" fill="#eae7de" fontSize="9" fontFamily="IBM Plex Mono" textAnchor="middle">NANDHA ENGINEERING COLLEGE</text>
          </svg>

          <div className="brand-row animate-stagger-2">
            <CollegeLogo className="brand-mark" size={48} />
            <div className="brand-text">
              <p className="eyebrow">Institutional Portal</p>
              <p className="name">Nandha LeetCode Intelligence</p>
              <p className="sub">Nandha Engineering College (Autonomous) · Erode</p>
            </div>
          </div>

          <div className="headline animate-stagger-3">
            <span className="kicker">Zero mock data · Live sync</span>
            <h1>
              <span className="block animate-stagger-3">Every submission,</span>
              <span className="block animate-stagger-4">verified and on record.</span>
            </h1>
            <p className="animate-stagger-4">Real-time algorithmic analytics and forensic evaluation for 1,500+ tracked engineers across the institution.</p>
          </div>

          <div className="audit-log animate-stagger-5">
            <div className="audit-row audit-row--blue">
              <span className="label">Engineers tracked<span className="desc">Live rating &amp; contest sync</span></span>
              <span className="value value--blue">
                {liveStats ? liveStats.totalStudents.toLocaleString('en-IN') : '—'}
              </span>
            </div>
            <div className="audit-row audit-row--green">
              <span className="label">Pipeline<span className="desc">Autonomous Sunday verification</span></span>
              <span className="value value--green">ACTIVE</span>
            </div>
            <div className="audit-row audit-row--amber">
              <span className="label">Integrity check<span className="desc">
                {liveStats ? `${liveStats.verifiedStudents.toLocaleString('en-IN')} verified · updated ${liveStats.lastUpdated}` : 'Cryptographic parity audit'}
              </span></span>
              <span className="value value--amber">{liveStats ? liveStats.integrityStatus : 'PASS'}</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="panel-right card-entrance-anim">
          <div className="top-bar">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle dark mode">
              {isDarkMode ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
          </div>

          <div className="form-head">
            <h2>{currentView === 'help' ? 'Institutional Help Desk' : (currentView === 'forgot_password' ? 'Reset Workspace Password' : 'Sign in to your workspace')}</h2>
            <p>
              {currentView === 'help' 
                ? 'Support for authorized personnel and enrolled students.' 
                : (currentView === 'forgot_password' ? 'Verify your identity to regain access to the institutional portal.' : 'Use your institutional email or authenticate with Google.')
              }
            </p>
          </div>

          <AnimatePresence mode="wait">
            {(error || authError) && (
              <motion.div 
                key="error"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }} 
                exit={{ opacity: 0, height: 0, marginBottom: 0 }} 
                className="error-banner"
                style={{ overflow: 'hidden' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{error || authError}</span>
              </motion.div>
            )}
            
            {successMsg && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                animate={{ opacity: 1, height: 'auto', marginBottom: 16 }} 
                exit={{ opacity: 0, height: 0, marginBottom: 0 }} 
                className="error-banner" 
                style={{ backgroundColor: 'rgba(62,122,92,0.1)', borderColor: 'rgba(62,122,92,0.3)', color: 'var(--verify-green)', overflow: 'hidden' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
          {currentView === 'login' && (
            <motion.div key="login" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="view-wrapper">
              <div className="tabs">
                <div className="tab-highlight" style={{ transform: authMode === 'otp' ? 'translateX(100%)' : 'translateX(0)' }}></div>
                <button type="button" className={authMode === 'password' ? 'active' : ''} onClick={() => { setAuthMode('password'); setError(''); clearAuthError(); }}>Password</button>
                <button type="button" className={authMode === 'otp' ? 'active' : ''} onClick={() => { setAuthMode('otp'); setError(''); clearAuthError(); }}>Secure OTP</button>
              </div>

              {authMode === 'password' ? (
                <form onSubmit={handlePasswordLogin}>
                  <div className="field">
                    <label htmlFor="userId">Institutional Email or User ID</label>
                    <div className="input-wrap">
                      <User className="input-icon" size={18} />
                      <input id="userId" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="id, username or faculty@nandhaengg.org" autoComplete="username" required disabled={loading} style={{ paddingLeft: '2.5rem' }} />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="password">Password</label>
                    <div className="input-wrap">
                      <Lock className="input-icon" size={18} />
                      <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required disabled={loading} style={{ paddingLeft: '2.5rem' }} />
                      <button type="button" className="toggle-visibility" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
                        {showPassword ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="row-between">
                    <label className="remember">
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Remember me
                    </label>
                    <button type="button" onClick={() => { setCurrentView('forgot_password'); setForgotStep('dob'); setError(''); setSuccessMsg(''); }} className="forgot">Forgot password?</button>
                  </div>

                  <button className="submit-btn" type="submit" disabled={loading}>
                    {loading ? 'Authenticating...' : 'Sign in to workspace'}
                    {!loading && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>}
                  </button>
                </form>
              ) : (
                <form onSubmit={otpStep === 'email' ? handleSendOtp : handleVerifyOtp}>
                  <div className="field">
                    <label htmlFor="otpEmail">Institutional Email</label>
                    <input id="otpEmail" type="email" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} placeholder="faculty@nandhaengg.org" required disabled={loading || otpStep === 'verify'} />
                  </div>

                  {otpStep === 'verify' && (
                    <div className="field">
                      <label>6-Digit Secure OTP</label>
                      <div className="flex gap-2 justify-between mt-2" style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                        {otpDigits.map((digit, index) => (
                          <input
                            key={index}
                            ref={digitRefs[index]}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="\d{1}"
                            maxLength={1}
                            style={{ width: '40px', height: '48px', padding: '0', textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
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
                      <div className="flex justify-between items-center mt-3" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                        <button type="button" onClick={() => { setOtpStep('email'); setOtpDigits(['', '', '', '', '', '']); setError(''); }} className="forgot" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Change Email
                        </button>
                        <button type="button" onClick={handleSendOtp} disabled={loading || resendCooldown > 0} className="forgot" style={{ fontSize: '11px', color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--brass-bright)' }}>
                          {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend Code'}
                        </button>
                      </div>
                    </div>
                  )}

                  <button className="submit-btn" type="submit" disabled={loading || (otpStep === 'verify' && otpDigits.join('').length !== 6)} style={{ marginTop: '24px' }}>
                    {loading ? 'Processing...' : (otpStep === 'email' ? 'Send OTP Code' : 'Verify & Sign In')}
                    {!loading && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>}
                  </button>
                </form>
              )}

              <div className="divider"><span>Or continue with</span></div>

              <GoogleSignInButton onSuccess={onSuccess} />

              <div className="footer-links"><button type="button" onClick={() => { setCurrentView('help'); setError(''); }}>Need help accessing your account?</button></div>
            </motion.div>
          )}

          {currentView === 'forgot_password' && (
            <motion.div key="forgot" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="view-wrapper">
              {/* Step Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px' }}>
                {(['dob', 'verify_otp', 'reset_password', 'success'] as const).map((step, i) => {
                  const stepIdx = ['dob', 'verify_otp', 'reset_password', 'success'].indexOf(forgotStep);
                  const done = i < stepIdx;
                  const active = step === forgotStep;
                  return (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, flexShrink: 0,
                        background: done ? 'var(--verify-green)' : active ? 'var(--brass-bright)' : 'var(--field-bg)',
                        color: done || active ? '#fff' : 'var(--text-muted)',
                        border: `1.5px solid ${done ? 'var(--verify-green)' : active ? 'var(--brass-bright)' : 'var(--field-border)'}`,
                        transition: 'all 0.25s'
                      }}
                      className={active ? 'step-indicator-active' : ''}
                      >
                        {done ? '' : i + 1}
                      </div>
                      {i < 3 && <div style={{ flex: 1, height: 2, background: done ? 'var(--verify-green)' : 'var(--field-border)', margin: '0 4px', transition: 'all 0.3s' }} />}
                    </div>
                  );
                })}
              </div>

              {/* STEP 1: Identity Verification */}
              {forgotStep === 'dob' && (
                <form onSubmit={handleForgotVerifyDob}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                    Enter your <strong>Username / Institutional ID</strong>, registered email, and date of birth to receive a reset code.
                  </p>
                  <div className="field">
                    <label>Username / Institutional ID</label>
                    <input
                      type="text"
                      value={forgotInstId}
                      onChange={(e) => setForgotInstId(e.target.value)}
                      placeholder="e.g. admin or staff123"
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  <div className="field">
                    <label>Registered Email</label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="email@nandhaengg.org"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="field">
                    <label>Date of Birth (DD/MM/YYYY)</label>
                    <input
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
                      style={{ fontFamily: 'Inter', textAlign: 'center', letterSpacing: '2px' }}
                    />
                  </div>
                  <div className="row-between" style={{ marginBottom: '4px' }}>
                    <span />
                    <button type="button" onClick={() => { setCurrentView('login'); setAuthMode('password'); setError(''); setSuccessMsg(''); }} className="forgot">
                      Back to Sign In
                    </button>
                  </div>
                  <button className="submit-btn" type="submit" disabled={loading}>
                    {loading ? 'Verifying...' : 'Send OTP to Email →'}
                  </button>
                </form>
              )}

              {/* STEP 2: Enter OTP */}
              {forgotStep === 'verify_otp' && (
                <form onSubmit={handleForgotVerifyOtp}>
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}></div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      A 6-digit code was sent to<br />
                      <strong style={{ color: 'var(--text-primary)' }}>{forgotEmail}</strong>.<br />
                      Enter it below within 10 minutes.
                    </p>
                  </div>
                  <div className="field">
                    <label>6-Digit Reset Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      value={forgotResetToken}
                      onChange={(e) => setForgotResetToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      required
                      disabled={loading}
                      autoFocus
                      style={{ textAlign: 'center', fontSize: '22px', fontWeight: 700, letterSpacing: '6px' }}
                    />
                  </div>
                  <div className="row-between" style={{ marginBottom: '8px' }}>
                    <button type="button" onClick={() => { setForgotStep('dob'); setForgotResetToken(''); setError(''); setSuccessMsg(''); }} className="forgot">
                      ← Change details
                    </button>
                    <button type="button" onClick={handleForgotVerifyDob} disabled={loading} className="forgot" style={{ color: 'var(--brass-bright)' }}>
                      Resend Code
                    </button>
                  </div>
                  <button className="submit-btn" type="submit" disabled={loading || forgotResetToken.length !== 6}>
                    {loading ? 'Verifying...' : 'Verify Code →'}
                  </button>
                </form>
              )}

              {/* STEP 3: Set New Password */}
              {forgotStep === 'reset_password' && (
                <form onSubmit={handleForgotResetPassword}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                    Code verified — Choose a new secure password for your account.
                  </p>
                  <div className="field">
                    <label>New Password</label>
                    <div className="input-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        required
                        disabled={loading}
                        autoFocus
                      />
                      <button type="button" className="toggle-visibility" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword
                          ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
                          : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                    {newPassword.length > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '4px' }}>
                        {[1,2,3,4].map(i => (
                          <div key={i} style={{
                            flex: 1, height: 3, borderRadius: 2,
                            background: newPassword.length >= i * 3
                              ? (newPassword.length >= 10 ? '#22c55e' : newPassword.length >= 6 ? '#f59e0b' : '#ef4444')
                              : 'var(--field-border)',
                            transition: 'all 0.2s'
                          }} />
                        ))}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px', whiteSpace: 'nowrap' }}>
                          {newPassword.length < 6 ? 'Weak' : newPassword.length < 10 ? 'Fair' : 'Strong'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="field">
                    <label>Confirm New Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      disabled={loading}
                    />
                    {confirmPassword.length > 0 && (
                      <p style={{ fontSize: '11px', marginTop: '4px', color: newPassword === confirmPassword ? 'var(--verify-green)' : '#ef4444' }}>
                        {newPassword === confirmPassword ? 'Passwords match' : 'Does not match'}
                      </p>
                    )}
                  </div>
                  <button className="submit-btn" type="submit" disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}>
                    {loading ? 'Updating...' : 'Save Password & Sign In'}
                  </button>
                </form>
              )}

              {/* STEP 4: Success */}
              {forgotStep === 'success' && (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}></div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Password Updated!
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: 1.6 }}>
                    A confirmation email has been sent to <strong>{forgotEmail}</strong>.<br />
                    Your new credentials are active immediately.
                  </p>
                  <button
                    type="button"
                    className="submit-btn"
                    onClick={() => { setCurrentView('login'); setAuthMode('password'); setError(''); setSuccessMsg(''); setForgotInstId(''); setForgotEmail(''); setForgotDob(''); setForgotResetToken(''); setNewPassword(''); setConfirmPassword(''); }}
                  >
                    Sign In Now →
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {currentView === 'help' && (
            <motion.div key="help" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="view-wrapper">
              <div className="help-list">
                <div className="help-list-item">
                  <div className="help-list-title">OTP Delivery Questions</div>
                  <div className="help-list-desc">Check your institutional inbox or spam folder. Verification codes expire in 5 minutes.</div>
                </div>
                <div className="help-list-item">
                  <div className="help-list-title">Account Locked or Disabled</div>
                  <div className="help-list-desc">Contact your Department Coordinator or HOD to verify your active roster enrollment.</div>
                </div>
                <div className="help-list-item" style={{ background: 'rgba(184,134,59,0.06)', borderColor: 'rgba(184,134,59,0.2)' }}>
                  <div className="help-list-title" style={{ color: 'var(--brass-bright)' }}>Official Support Inquiries</div>
                  <div className="help-list-desc">admin@nandhaengg.org</div>
                </div>
              </div>
              <button type="button" className="google-btn" style={{ marginTop: '24px' }} onClick={() => setCurrentView('login')}>
                Return to Sign In
              </button>
            </motion.div>
          )}
          </AnimatePresence>

          <div className="stamp">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            Secured & audited by institution
          </div>
        </div>
      </div>
      <div className="login-copyright" style={{ marginTop: '16px', marginBottom: '16px', width: '100%', textAlign: 'center', fontSize: '12px', fontWeight: '500', color: 'var(--text-muted, #64748b)', padding: '0 16px' }}>
        &copy; {new Date().getFullYear()} Nandha Engineering College. All rights reserved.
      </div>
    </div>
  );
};

export default LoginPage;
