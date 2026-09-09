import React, { useState, useEffect } from 'react';
import { ShieldCheck, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2, Lock, User, Phone, Building2, ChevronRight, Check } from 'lucide-react';
import api from '../services/api';

const SetupAccountPage: React.FC = () => {
  const token = new URLSearchParams(window.location.search).get('token');
  const navigate = (path: string) => { window.location.href = path; };

  const [activeStep, setActiveStep] = useState(1);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Profile Data
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing setup token. Please use the link provided in your welcome email.");
    }
  }, [token]);

  const getPasswordReqs = (pw: string) => ({
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  });

  const pwReqs = getPasswordReqs(password);
  const allReqsMet = password && Object.values(pwReqs).every(Boolean);
  const strengthScore = Object.values(pwReqs).filter(Boolean).length;
  const strengthStr = strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Fair' : 'Strong';
  const passwordsMatch = password && password === confirmPassword;

  const handleNext = () => {
    setError(null);
    if (activeStep === 1) {
      if (!allReqsMet) return setError("Password does not meet institutional requirements.");
      if (!passwordsMatch) return setError("Passwords do not match.");
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (!fullName.trim()) return setError("Full Name is required.");
      if (!phoneNumber.trim()) return setError("Phone Number is required.");
      setActiveStep(3);
    } else if (activeStep === 3) {
      setActiveStep(4);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!token) {
      setError("Invalid setup token.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/setup-account', {
        token,
        new_password: password,
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim()
      });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to set up account. The link may have expired.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-navy-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-navy-950 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-navy-800 p-8 text-center animate-fade-in-up">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/15 mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Your account is ready.</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 font-medium">
            Your profile has been securely set. You can now access the LeetCode Intelligence System.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const steps = [
    { num: 1, title: 'Secure Password' },
    { num: 2, title: 'Profile Setup' },
    { num: 3, title: 'Institutional Scope' },
    { num: 4, title: 'Final Review' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-900 flex items-center justify-center p-4 py-12">
      <div className="max-w-xl w-full bg-white dark:bg-navy-950 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-navy-800 overflow-hidden animate-fade-in-up">
        
        {/* Header */}
        <div className="p-8 text-center border-b border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-900/50 relative overflow-hidden">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/20 mb-4 relative z-10">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white relative z-10">Secure Account Onboarding</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium relative z-10">
            Complete the following steps to activate your institutional account.
          </p>
        </div>

        {/* Stepper */}
        <div className="px-8 pt-6 pb-2">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-8 right-8 top-1/2 h-0.5 bg-slate-200 dark:bg-navy-800 -z-10 -translate-y-1/2"></div>
            {steps.map(step => (
              <div key={step.num} className="flex flex-col items-center gap-2 bg-white dark:bg-navy-950 px-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  activeStep === step.num ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30' :
                  activeStep > step.num ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-400'
                }`}>
                  {activeStep > step.num ? <Check className="w-4 h-4 stroke-[3]" /> : step.num}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="p-4 mb-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 flex items-start gap-3 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs font-medium">{error}</div>
            </div>
          )}

          {/* STEP 1: PASSWORD */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">New Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-4 pr-10 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Checklist & Strength */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400">Password Strength</span>
                  <span className={`text-xs font-black ${strengthStr === 'Strong' ? 'text-emerald-500' : strengthStr === 'Fair' ? 'text-amber-500' : 'text-rose-500'}`}>
                    {password ? strengthStr : 'None'}
                  </span>
                </div>

                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      strengthScore <= 2 ? 'bg-rose-500 w-1/3' : strengthScore <= 4 ? 'bg-amber-500 w-2/3' : 'bg-emerald-500 w-full'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-bold">
                  <div className={`flex items-center gap-1.5 ${pwReqs.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {pwReqs.length ? <Lock className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-navy-600" />} Min 8 chars
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwReqs.upper ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {pwReqs.upper ? <Lock className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-navy-600" />} Uppercase
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwReqs.lower ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {pwReqs.lower ? <Lock className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-navy-600" />} Lowercase
                  </div>
                  <div className={`flex items-center gap-1.5 ${pwReqs.number || pwReqs.special ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {pwReqs.number || pwReqs.special ? <Lock className="w-3.5 h-3.5" /> : <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-navy-600" />} Num / Special
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Confirm Password *</label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-4 pr-10 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PROFILE INFO */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Full Legal Name *</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="e.g. Dr. A. Ramanathan"
                    className="w-full h-12 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">Phone Number *</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full h-12 pl-10 pr-4 rounded-2xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-sm font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INSTITUTIONAL SCOPE */}
          {activeStep === 3 && (
            <div className="space-y-4 animate-fade-in text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-navy-800 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-2">
                <Building2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Institutional Scope</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium pb-4">
                Your department and academic year access are managed by the System Administrator. You can view these settings in your profile after login.
              </p>
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-navy-900 border border-indigo-100 dark:border-navy-800 space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-900 dark:text-indigo-300">
                  <Lock className="w-4 h-4 text-indigo-500" /> Managed Centrally
                </div>
                <p className="text-[10px] text-indigo-700/70 dark:text-indigo-400/70 leading-relaxed font-medium">
                  If you need to change your assigned Department or Academic Cohort, please contact the IT Administrator.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: FINAL REVIEW */}
          {activeStep === 4 && (
            <div className="space-y-6 animate-fade-in">
               <div className="text-center">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Ready to activate?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  By clicking Activate, you agree to the institutional security guidelines.
                </p>
               </div>
               
               <div className="p-5 rounded-2xl bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-left space-y-3">
                  <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-navy-800 text-xs">
                    <span className="text-slate-500 font-bold">Name:</span>
                    <span className="font-black text-slate-900 dark:text-white">{fullName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-bold">Phone:</span>
                    <span className="font-black text-slate-900 dark:text-white">{phoneNumber}</span>
                  </div>
               </div>
            </div>
          )}

          {/* Controls */}
          <div className="mt-8 flex gap-3">
            {activeStep > 1 && (
              <button
                type="button"
                onClick={() => setActiveStep(activeStep - 1)}
                disabled={isSubmitting}
                className="py-4 px-6 rounded-2xl text-sm font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 transition-all cursor-pointer disabled:opacity-50"
              >
                Back
              </button>
            )}
            
            {activeStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 py-4 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                Continue <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-4 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Activating...</>
                ) : (
                  <><ShieldCheck className="w-5 h-5" /> Activate Account</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupAccountPage;
