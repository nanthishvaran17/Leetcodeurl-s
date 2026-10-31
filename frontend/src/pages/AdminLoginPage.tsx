import React, { useState } from 'react';
// removed react-router-dom
import { Shield, Key, Mail, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { setAdminOtpVerified } from '../utils/adminOtpAuth';
import { useAuth } from '../context/AuthContext';

export const AdminLoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'CREDENTIALS' | 'OTP'>('CREDENTIALS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { login } = useAuth();
  // const navigate = useNavigate();

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/admin-login', { username, password });
      if (res.data?.success && res.data?.otp_required) {
        setStep('OTP');
        const emailStr = res.data.email || res.data.masked_email || '';
        setTargetEmail(emailStr);
        setSuccessMsg(res.data.message || `Verification code sent to ${emailStr}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials or unauthorized access.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/admin-verify-otp', { username, password, otp });
      if (res.data?.success && res.data?.access_token) {
        // Authenticated successfully with 2FA OTP
        const token = res.data.access_token;
        localStorage.setItem('token', token);
        localStorage.setItem('access_token', token);
        if (res.data.refresh_token) {
          localStorage.setItem('refresh_token', res.data.refresh_token);
        }
        
        // Mark session as 2FA OTP verified
        setAdminOtpVerified(true);
        sessionStorage.setItem('admin_login_portal', 'true');
        localStorage.setItem('admin_login_portal', 'true');
        
        if (res.data.user) {
          const userWithOtp = {
            ...res.data.user,
            admin_otp_verified: true,
          };
          localStorage.setItem('user', JSON.stringify(userWithOtp));
        }

        // Navigate directly to Developer Studio with fully verified 2FA session
        window.location.href = '/#/dev-studio';
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid OTP code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8 overflow-hidden relative">
          
          {/* Accent Line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-slate-800/80 rounded-2xl border border-slate-700 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Shield className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Portal</h1>
            <p className="text-slate-400 text-sm mt-2">Secure access for authorized personnel only</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-emerald-400 text-sm">
              <Mail className="w-5 h-5 shrink-0" />
              <p>{successMsg}</p>
            </div>
          )}

          {step === 'CREDENTIALS' ? (
            <form onSubmit={handleCredentialSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Username or Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Key className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-950/50 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[48px] touch-manipulation active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <span>Continue to verification</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-2.5 text-xs text-indigo-300">
                <Mail className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Enter 6-Digit Verification Code</p>
                  <p className="mt-0.5 text-slate-300">
                    A code has been sent to <span className="text-indigo-400 font-mono font-bold">{targetEmail || 'your email'}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block text-center">
                  Verification Code
                </label>
                <div className="relative">
                  {/* Invisible real input for mobile keyboard, autofill, and paste */}
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-text touch-manipulation"
                    placeholder="000000"
                  />

                  {/* 6 Animated Digit Slot Boxes */}
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-3 py-1">
                    {[0, 1, 2, 3, 4, 5].map((index) => {
                      const char = otp[index] || '';
                      const isCurrent = otp.length === index;
                      const isFilled = Boolean(char);

                      return (
                        <div
                          key={index}
                          style={{ animationDelay: `${index * 70}ms` }}
                          className={`h-14 sm:h-16 flex flex-col items-center justify-center rounded-xl font-mono text-2xl font-bold transition-all duration-200 select-none border animate-in fade-in zoom-in-50 slide-in-from-bottom-2 fill-mode-both ${
                            isCurrent
                              ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_18px_rgba(56,189,248,0.4)] scale-105 ring-2 ring-cyan-400/40'
                              : isFilled
                              ? 'border-indigo-500/60 bg-slate-900/90 text-cyan-300 shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                              : 'border-slate-700/60 bg-slate-950/60 text-slate-600'
                          }`}
                        >
                          {char ? (
                            <span className="animate-in zoom-in-75 duration-150 text-white font-black drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]">
                              {char}
                            </span>
                          ) : isCurrent ? (
                            <span className="w-2.5 h-0.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#38bdf8]" />
                          ) : (
                            <span className="text-slate-700 text-sm font-sans">&bull;</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-h-[48px] touch-manipulation active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Verify & Open Developer Studio</span>}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('CREDENTIALS');
                  setOtp('');
                  setSuccessMsg('');
                }}
                className="w-full text-slate-400 hover:text-white text-sm transition-colors py-2 cursor-pointer"
              >
                Back to credentials
              </button>
            </form>
          )}

          <div className="pt-4 text-center border-t border-slate-800 mt-4">
            <a
              href="/"
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>&larr; Return to Dashboard</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
