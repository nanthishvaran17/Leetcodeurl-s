import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  X,
  Mail,
  Send,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  Award,
  Users,
  Timer,
  ChevronRight,
  PhoneCall,
  ExternalLink,
  MessageSquare,
  Globe,
  Flame,
  ArrowRight
} from 'lucide-react';
import api from '../services/api';

export interface CollegeSaaSPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CollegeSaaSPortalModal: React.FC<CollegeSaaSPortalModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'request_pilot' | 'email_pitch' | 'impact_specs' | 'leads'>('request_pilot');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form State
  const [collegeName, setCollegeName] = useState('');
  const [contactName, setContactName] = useState('');
  const [designation, setDesignation] = useState('Principal');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Coimbatore / Erode');
  const [approxStudents, setApproxStudents] = useState<number>(500);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<any>(null);

  // Pitch Sender State
  const [pitchTargetEmail, setPitchTargetEmail] = useState('');
  const [pitchRecipientName, setPitchRecipientName] = useState('');
  const [pitchCollegeName, setPitchCollegeName] = useState('');
  const [pitchDesignation, setPitchDesignation] = useState('Principal');
  const [pitchTemplateType, setPitchTemplateType] = useState('principal_executive');
  const [isSendingPitch, setIsSendingPitch] = useState(false);
  const [pitchSendStatus, setPitchSendStatus] = useState<string | null>(null);

  // Leads State
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  // Stats State
  const [stats, setStats] = useState({
    active_students_audited: 686,
    colleges_onboarded_or_in_pilot: 3,
    weekly_contests_tracked: 26,
    accuracy_guarantee: '99.8%',
    nba_naac_ready: true,
    trial_offer: '14 Days Free Autonomous Pilot'
  });

  useEffect(() => {
    if (isOpen) {
      api.get('/saas/metrics-summary')
        .then(res => {
          if (res.data) setStats(res.data);
        })
        .catch(() => {});
      loadLeads();
    }
  }, [isOpen]);

  const loadLeads = async () => {
    setIsLoadingLeads(true);
    try {
      const res = await api.get('/saas/leads');
      if (res.data && res.data.leads) {
        setLeadsList(res.data.leads);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleSubmitPilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName.trim() || !email.trim() || !contactName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.post('/saas/request-demo', {
        college_name: collegeName,
        contact_name: contactName,
        designation,
        email,
        phone,
        city,
        approx_students: Number(approxStudents),
        pilot_requested: true,
        message
      });
      setSubmitSuccess(res.data);
      loadLeads();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to submit pilot request. Please check inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendPitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pitchTargetEmail || !pitchCollegeName) return;

    setIsSendingPitch(true);
    try {
      await api.post('/saas/send-pitch', {
        target_email: pitchTargetEmail,
        recipient_name: pitchRecipientName || 'Principal',
        college_name: pitchCollegeName,
        designation: pitchDesignation,
        template_type: pitchTemplateType
      });
      setPitchSendStatus('Proposal dispatched successfully! Lead created.');
      loadLeads();
      setTimeout(() => setPitchSendStatus(null), 4000);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to dispatch pitch.');
    } finally {
      setIsSendingPitch(false);
    }
  };

  if (!isOpen) return null;

  const executivePitchText = `Respected ${pitchDesignation || 'Principal'},

I am reaching out regarding an autonomous competitive coding intelligence system designed for engineering colleges in Tamil Nadu to dramatically elevate student placement readiness and competitive coding compliance.

Key Capabilities for ${pitchCollegeName || '[College Name]'}:
1. Autonomous Sunday 8:00 AM IST LeetCode Contest tracking (zero faculty manual effort).
2. Anti-cheat submission forensics (verifies exact solve seconds & live telemetry).
3. 1-Click Executive PDF & Excel reports for NBA Criterion 2 & 5 / NAAC and Placement accreditation.
4. Faculty-to-Student automated mentoring matrix and at-risk student early intervention.

We would be pleased to provide ${pitchCollegeName || 'your esteemed institution'} with a Complimentary 2-Week Autonomous Pilot for up to 500 students.

Would you or your Placement / CSE team be open for a brief 10-minute walkthrough this week?

Respectfully,
Nanthishvaran | LeetCode Intelligence Platform
Direct Contact: +91 94883 17001 | Portal: https://leetcodetracker.live`;

  const whatsAppBlurbText = `🚀 *Autonomous LeetCode Intelligence Platform for Engineering Colleges*

Track student Sunday LeetCode Weekly Contests 100% autonomously:
✅ Live Sunday 8:00 AM Telemetry (Q1-Q4 exact timing)
✅ Zero manual screenshots - Anti-cheat verified
✅ 1-Click Executive PDF & Excel for NBA/NAAC & Placement
✅ Weekly HOD & Faculty Mentoring Matrix

👉 *Request a 2-Week Free College Pilot for ${pitchCollegeName || 'Your College'}:*
Direct WhatsApp: +91 94883 17001`;

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-4xl max-h-[92vh] bg-white dark:bg-navy-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-white"
      >
        {/* Header Banner */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-indigo-900 via-indigo-950 to-purple-950 text-white border-b border-indigo-800/40 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Multi-College SaaS Expansion
                </span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider hidden sm:inline-block">
                  NBA & NAAC Compliant
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-400 shrink-0" />
                Empower Engineering Colleges with LeetCode Intelligence
              </h2>
              <p className="text-xs text-indigo-200/80 max-w-2xl font-medium">
                Autonomous Sunday contest tracking, anti-cheat submission forensics, and 1-click accreditation reports for Principals, HODs, and Placement Directors.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer shrink-0"
              title="Close Dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/10 text-center">
            <div className="bg-white/5 rounded-xl p-2 border border-white/10">
              <div className="text-base sm:text-lg font-black text-emerald-400 font-mono">{stats.active_students_audited}+</div>
              <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Students Audited</div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 border border-white/10">
              <div className="text-base sm:text-lg font-black text-indigo-300 font-mono">0 Manual Hours</div>
              <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Sunday Automation</div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 border border-white/10">
              <div className="text-base sm:text-lg font-black text-amber-300 font-mono">{stats.accuracy_guarantee}</div>
              <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Anti-Cheat Accuracy</div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 border border-white/10">
              <div className="text-base sm:text-lg font-black text-purple-300 font-mono">14 Days Free</div>
              <div className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Institutional Pilot</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 py-2 bg-slate-50 dark:bg-navy-950/70 border-b border-slate-200 dark:border-white/10 overflow-x-auto text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('request_pilot')}
            className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'request_pilot'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Request College Pilot (Free 14 Days)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('email_pitch')}
            className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'email_pitch'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Principal & HOD Pitch Toolkit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('impact_specs')}
            className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'impact_specs'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Accreditation & Features</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('leads')}
            className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'leads'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Registered Inquiries ({leadsList.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: Request College Pilot */}
          {activeTab === 'request_pilot' && (
            <div className="space-y-6">
              {submitSuccess ? (
                <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-emerald-950 dark:text-emerald-100">
                      Pilot Request Successfully Received!
                    </h3>
                    <p className="text-sm text-emerald-800 dark:text-emerald-300 mt-1 max-w-lg mx-auto">
                      {submitSuccess.message}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-navy-900 border border-emerald-300 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                    Reference Pilot ID: #PILOT-{submitSuccess.lead_id}
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitSuccess(null);
                        setCollegeName('');
                        setEmail('');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                    >
                      Register Another Institution
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitPilot} className="space-y-4">
                  <div className="bg-indigo-50/80 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-800/40 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-indigo-950 dark:text-indigo-200">
                      <strong>Zero Setup Required:</strong> We configure your college’s students from an Excel list within 10 minutes. Your faculty will receive automated verified reports every Sunday at 10:00 AM IST.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        College / Institution Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={collegeName}
                        onChange={(e) => setCollegeName(e.target.value)}
                        placeholder="e.g., PSG College of Technology"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-white/10 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Official Contact Person *
                      </label>
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="e.g., Dr. K. Senthil Kumar"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-white/10 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Designation *
                      </label>
                      <select
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-white/10 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="Principal">Principal</option>
                        <option value="Dean - Academics">Dean - Academics</option>
                        <option value="Placement Director / TPO">Placement Director / TPO</option>
                        <option value="HOD - CSE / IT">HOD - Computer Science / IT</option>
                        <option value="HOD - AI&DS / Cyber">HOD - AI&DS / Cyber Security</option>
                        <option value="Faculty Coordinator">Competitive Coding Coordinator</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Official Institutional Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g., principal@college.ac.in"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-white/10 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Mobile / WhatsApp Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g., +91 94883 17001"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-white/10 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Approximate Students (Coding Cohort)
                      </label>
                      <input
                        type="number"
                        min="20"
                        step="50"
                        value={approxStudents}
                        onChange={(e) => setApproxStudents(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-white/10 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Specific Requirements or Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="e.g., Need automated Sunday tracking for II & III Year CSE/IT students (600 count)."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-navy-950 border border-slate-300 dark:border-white/10 text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black shadow-md shadow-indigo-500/25 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSubmitting ? 'Registering Institution...' : 'Submit Institutional Pilot Request'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: Pitch Generator & Direct Email Dispatcher */}
          {activeTab === 'email_pitch' && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-navy-950 p-4 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-indigo-500" />
                    1-Click College Pitch Dispatcher
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Send directly to prospective Principal / HOD
                  </span>
                </div>

                <form onSubmit={handleSendPitch} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <input
                    type="email"
                    required
                    placeholder="Principal / HOD Email"
                    value={pitchTargetEmail}
                    onChange={(e) => setPitchTargetEmail(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-300 dark:border-white/10 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    required
                    placeholder="College Name (e.g. KEC)"
                    value={pitchCollegeName}
                    onChange={(e) => setPitchCollegeName(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-300 dark:border-white/10 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Recipient Name (e.g. Dr. Rajesh)"
                    value={pitchRecipientName}
                    onChange={(e) => setPitchRecipientName(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-navy-900 border border-slate-300 dark:border-white/10 text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={isSendingPitch}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingPitch ? 'Sending...' : 'Dispatch Pitch'}</span>
                  </button>
                </form>

                {pitchSendStatus && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>{pitchSendStatus}</span>
                  </div>
                )}
              </div>

              {/* Ready-to-Copy Pitch Templates */}
              <div className="grid grid-cols-1 gap-4">
                {/* Template 1: Formal Executive Email */}
                <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-mono text-[10px] font-black uppercase">
                        Template A: Principal & Dean Executive Pitch
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(executivePitchText, 'exec_pitch')}
                      className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                    >
                      {copiedKey === 'exec_pitch' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'exec_pitch' ? 'Copied to Clipboard!' : 'Copy Email Text'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950 text-[11px] font-sans whitespace-pre-wrap text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 max-h-48 overflow-y-auto">
                    {executivePitchText}
                  </pre>
                </div>

                {/* Template 2: WhatsApp / Blurb Pitch */}
                <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-mono text-[10px] font-black uppercase">
                        Template B: WhatsApp & Direct Pitch Blurb
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(whatsAppBlurbText, 'wa_pitch')}
                        className="flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                      >
                        {copiedKey === 'wa_pitch' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedKey === 'wa_pitch' ? 'Copied!' : 'Copy WhatsApp Text'}</span>
                      </button>
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppBlurbText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Share on WhatsApp</span>
                      </a>
                    </div>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-50 dark:bg-navy-950 text-[11px] font-sans whitespace-pre-wrap text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/5 max-h-40 overflow-y-auto">
                    {whatsAppBlurbText}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Accreditation & Features */}
          {activeTab === 'impact_specs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                    <Award className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">NBA Criterion 2 & 5 Accreditation Ready</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Provides continuous competitive coding assessment evidence, student performance distribution curves, and program outcome compliance documentation required for NBA Tier 1 / Tier 2 SAR reports.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Authoritative Anti-Cheat Forensics</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Proprietary time-bounded verification window (08:00–09:30 AM IST). Flags proxy accounts, post-window solves, and calculates honest finish times and durations with zero spoofing.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Autonomous Sunday 10:00 AM Dispatch</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Management receives high-fidelity consolidated Excel workbooks and audit PDFs automatically via email and WhatsApp within 30 minutes of contest completion.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Faculty Mentor Allocation Matrix</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Faculty mentors receive automated notifications for their assigned cohort, tracking consecutive absentees and low-rank solvers for guided remedial mentoring.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Registered Inquiries & Leads Table */}
          {activeTab === 'leads' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Institutional Demo Inquiries & Leads ({leadsList.length})
                </h3>
                <button
                  type="button"
                  onClick={loadLeads}
                  disabled={isLoadingLeads}
                  className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  {isLoadingLeads ? 'Refreshing...' : 'Refresh List'}
                </button>
              </div>

              {leadsList.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-300 dark:border-white/10 rounded-2xl">
                  No college inquiries registered yet. Use the "Request College Pilot" tab to add one!
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-white/10 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-navy-950 text-slate-500 font-bold border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="p-3">College Name</th>
                        <th className="p-3">Contact Person</th>
                        <th className="p-3">Designation</th>
                        <th className="p-3">Email & Phone</th>
                        <th className="p-3">Students</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {leadsList.map((lead) => (
                        <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                          <td className="p-3 font-bold text-slate-900 dark:text-white">{lead.college_name}</td>
                          <td className="p-3 font-medium">{lead.contact_name}</td>
                          <td className="p-3 text-slate-500">{lead.designation}</td>
                          <td className="p-3 font-mono">
                            <div>{lead.email}</div>
                            {lead.phone && <div className="text-[10px] text-slate-400">{lead.phone}</div>}
                          </td>
                          <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{lead.approx_students}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {lead.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
