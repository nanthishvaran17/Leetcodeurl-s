import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  CheckCircle2,
  ShieldAlert,
  FileText,
  Award,
  Sparkles,
  ArrowRight,
  Send,
  Phone,
  Mail,
  Users,
  Clock,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  Zap,
  BarChart3,
  Flame,
  CheckCircle,
  HelpCircle,
  Download
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export const ForCollegesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin' || user?.role === 'Super Admin' || user?.role === 'admin';

  // Form state
  const [collegeName, setCollegeName] = useState('');
  const [collegeCode, setCollegeCode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [designation, setDesignation] = useState('Principal');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('Coimbatore');
  const [approxStudents, setApproxStudents] = useState('500');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Admin Outreach Studio State
  const [activeAdminTab, setActiveAdminTab] = useState<'pitch_copy' | 'leads_list' | 'quick_send'>('pitch_copy');
  const [copiedLang, setCopiedLang] = useState<'en' | 'ta' | null>(null);
  const [quickSendEmail, setQuickSendEmail] = useState('');
  const [quickSendCollege, setQuickSendCollege] = useState('');
  const [quickSendStatus, setQuickSendStatus] = useState<string | null>(null);
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeName.trim() || !contactPerson.trim() || !email.trim() || !phone.trim()) {
      setErrorMessage('Please fill in all required institutional details.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await api.post('/leads/register', {
        college_name: collegeName.trim(),
        college_code: collegeCode.trim() || undefined,
        contact_person: contactPerson.trim(),
        designation: designation,
        email: email.trim(),
        phone: phone.trim(),
        district: district,
        approx_students: parseInt(approxStudents, 10) || 500,
        notes: notes.trim() || undefined
      });

      if (res.data?.success) {
        setSubmitSuccess(true);
      } else {
        setErrorMessage(res.data?.detail || 'Failed to submit registration.');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Network error occurred. Please contact +91-9488358488 directly.');
    } finally {
      setSubmitting(false);
    }
  };

  const loadLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await api.get('/leads/list');
      setLeadsList(res.data?.leads || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    const handlePull = () => {
      loadLeads();
    };
    window.addEventListener('pull_to_refresh', handlePull);
    return () => window.removeEventListener('pull_to_refresh', handlePull);
  }, []);

  const handleQuickSend = async () => {
    if (!quickSendEmail.trim()) return;
    setQuickSendStatus('Sending...');
    try {
      await api.post('/leads/dispatch-pitch', {
        recipient_emails: [quickSendEmail.trim()],
        custom_college_name: quickSendCollege.trim() || 'Your Engineering College'
      });
      setQuickSendStatus('Pitch successfully sent!');
      setQuickSendEmail('');
      setQuickSendCollege('');
      setTimeout(() => setQuickSendStatus(null), 4000);
    } catch (err: any) {
      setQuickSendStatus(`Failed: ${err.message}`);
    }
  };

  const englishPitchText = `Subject: Transforming Campus Placement Readiness with Automated LeetCode Intelligence

Respected Principal / Placement Officer,

In the ongoing tier-1 recruitment season, companies like TCS Prime, Cognizant GenC Next, Amazon, and Zoho assess candidates strictly on automated algorithmic coding.

We have developed LeetCode Institutional Intelligence — an automated real-time analytics platform that captures every student's Sunday contest performance (08:00–09:30 AM IST) with 0% faculty manual effort.

Key Benefits for Your Institution:
1. Automated Contest Audit & Live Forensic Anti-Plagiarism telemetry.
2. 1-Click Executive PDF Reports for NBA/NAAC criteria 2 & 5 accreditation.
3. Real-Time Leaderboards & Placement Readiness Risk Banding.

We are pleased to offer a complimentary 14-day institutional pilot for your college.

Live Demo: http://13.53.231.6/#/for-colleges

Warm regards,
Institutional Partnerships Team
Phone: +91-9488358488 | Email: nanthishvaran17@gmail.com`;

  const tamilPitchText = `பொருள்: கல்லூரி மாணவர்களின் கேம்பஸ் பிளேஸ்மென்ட் தயார்நிலைக்கான தானியங்கி LeetCode அனலிட்டிக்ஸ் தளம்

மதிப்பிற்குரிய முதல்வர் / பிளேஸ்மென்ட் அதிகாரி அவர்களுக்கு,

இன்றைய முன்னணி ஐடி மற்றும் ப்ராடக்ட் நிறுவனங்களின் (TCS Prime, Cognizant, Amazon, Zoho) நேர்முகத் தேர்வில் LeetCode கோடிங் மிக முக்கியமான தகுதியாக உள்ளது.

இதற்காக, கல்லூரி பேராசிரியர்களுக்கு எந்தவித கைமுறை வேலையுமின்றி (Zero Manual Work), மாணவர்கள் ஞாயிறு தோறும் எழுதும் LeetCode Weekly Contest முடிவுகள், அவர்களின் முயற்சி நேரம் மற்றும் ரேட்டிங்கை துல்லியமாக ஆட்டோமேஷன் செய்யும் LeetCode Institutional Intelligence தளத்தை அறிமுகப்படுத்துகிறோம்.

முக்கிய பலன்கள்:
1. தானியங்கி போட்டி கண்காணிப்பு & ஏமாற்றுதலை தடுக்கும் Forensic Audit.
2. NBA / NAAC அக்ரடிடேஷனுக்கான 1-கிளிக் Executive PDF & Excel அறிக்கைகள்.
3. மாணவர்கள் எந்த கம்பெனிக்கு தகுதியானவர்கள் என்பதை காட்டும் Placement Readiness Matrix.

தங்கள் கல்லூரிக்கு 14 நாட்கள் இலவச முன்னோட்ட அனுமதி (Free 14-Day Pilot) வழங்க தயாராக உள்ளோம்.

நேரடி டெமோ பார்வை: http://13.53.231.6/#/for-colleges

நன்றியுடன்,
LeetCode Intelligence Team
தொடர்புக்கு: +91-9488358488 | nanthishvaran17@gmail.com`;

  const copyToClipboard = (text: string, lang: 'en' | 'ta') => {
    navigator.clipboard.writeText(text);
    setCopiedLang(lang);
    setTimeout(() => setCopiedLang(null), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-24">
      {/* Top Banner Glow */}
      <div className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 border-b border-slate-800/80">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[350px] bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Institutional SaaS Platform For Engineering Colleges
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
            Empower Your College With Autonomous <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-emerald-400 bg-clip-text text-transparent">LeetCode Intelligence</span>
          </h1>

          <p className="text-sm sm:text-lg text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Eliminate 100% of faculty manual auditing. Real-time Sunday Weekly Contest tracking, forensic anti-plagiarism verification, and instant NBA/NAAC placement audit reports.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#register-pilot"
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Activate 14-Day Free College Pilot</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/api/leads/sample-audit-pdf"
              target="_blank"
              rel="noopener noreferrer"
              download="Sample_Institutional_Contest_Forensic_Report.pdf"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4 text-emerald-100" />
              <span>Download Sample Principal PDF Report</span>
            </a>
            <a
              href="#/weekly-contest"
              className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-bold text-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ExternalLink className="w-4 h-4 text-slate-400" />
              <span>Explore Live Contest Sandbox</span>
            </a>
          </div>

          {/* Institutional Trust Badges */}
          <div className="pt-8 flex flex-wrap justify-center items-center gap-6 sm:gap-10 text-xs font-semibold text-slate-400 border-t border-slate-800/60 max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Zero Faculty Manual Work</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-indigo-400" />
              <span>NBA / NAAC Ready Reports</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-purple-400" />
              <span>Patent-Grade Anti-Cheat Audits</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content: Features & Institutional Value */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Autonomous Sunday Contests</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Every Sunday 08:00–09:30 AM IST, student activity is ingested live. No student screenshots or manual Google Forms needed.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Forensic Anti-Cheating Telemetry</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Calculates exact submission timestamps, detecting post-contest copy-pasting vs genuine live algorithmic solves.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Executive PDF & Accreditation</h3>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              One-click comprehensive PDF and Excel exports formatted for Principal reviews and NBA Criteria 2 & 5 documentation.
            </p>
          </div>
        </div>

        {/* Onboarding Registration Form */}
        <div id="register-pilot" className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Institutional Pilot Program</span>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Request 14-Day Free Pilot For Your Institution
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Provide your college details. Our academic engineering team will provision your institution's portal within 24 hours.
              </p>
            </div>

            {submitSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-8 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-4"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-emerald-300">Registration Successful!</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Thank you! An onboarding package with sample reports and demo credentials has been dispatched to <strong>{email}</strong>. Our team will contact you via WhatsApp / Phone shortly.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitSuccess(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer"
                >
                  Register Another Institution
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                    {errorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">College / Institution Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kongu Engineering College"
                      value={collegeName}
                      onChange={(e) => setCollegeName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">College Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. TNEA 7322"
                      value={collegeCode}
                      onChange={(e) => setCollegeCode(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Contact Person Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. K. Saravanan"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Designation *</label>
                    <select
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                    >
                      <option value="Principal">Principal</option>
                      <option value="Training & Placement Officer (TPO)">Training & Placement Officer (TPO)</option>
                      <option value="HOD - Computer Science">HOD - Computer Science & Engg</option>
                      <option value="HOD - Information Technology">HOD - Information Technology</option>
                      <option value="Dean - Academic / Placements">Dean - Academic / Placements</option>
                      <option value="Director">Director / Management</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Official Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. principal@college.edu.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Phone / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">District / Region</label>
                    <input
                      type="text"
                      placeholder="e.g. Coimbatore, Erode, Chennai"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">Approx. Students (Year II to IV)</label>
                    <select
                      value={approxStudents}
                      onChange={(e) => setApproxStudents(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                    >
                      <option value="250">100 - 250 Students</option>
                      <option value="500">250 - 500 Students</option>
                      <option value="1000">500 - 1,000 Students</option>
                      <option value="2500">1,000 - 2,500 Students</option>
                      <option value="5000">2,500+ Students</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Special Requirements (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. We want to track 3rd year CSE and IT departments for upcoming TCS Digital drives."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 mt-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Submitting Registration...' : 'Submit Institutional Pilot Request'}</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ADMIN EXCLUSIVE: Principal Outreach Studio */}
        {isAdmin && (
          <div className="rounded-3xl bg-slate-900 border border-indigo-500/40 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  Admin Exclusive Tool
                </span>
                <h3 className="text-xl font-black text-white mt-1">
                  Institutional Pitch & Outreach Studio
                </h3>
                <p className="text-xs text-slate-400">
                  Manage registered college leads and dispatch cold outreach emails to Engineering College Principals.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('pitch_copy')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeAdminTab === 'pitch_copy'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Ready Pitches
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAdminTab('leads_list');
                    loadLeads();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeAdminTab === 'leads_list'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Registered Leads
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('quick_send')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeAdminTab === 'quick_send'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  1-Click Emailer
                </button>
              </div>
            </div>

            {/* Sub-tab 1: Ready-to-copy Pitches */}
            {activeAdminTab === 'pitch_copy' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400">English Proposal Pitch</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(englishPitchText, 'en')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-xs font-bold transition cursor-pointer"
                    >
                      {copiedLang === 'en' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLang === 'en' ? 'Copied!' : 'Copy Pitch'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    {englishPitchText}
                  </pre>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400">Tamil Proposal Pitch</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(tamilPitchText, 'ta')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 text-xs font-bold transition cursor-pointer"
                    >
                      {copiedLang === 'ta' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLang === 'ta' ? 'Copied!' : 'Copy Pitch'}</span>
                    </button>
                  </div>
                  <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap max-h-72 overflow-y-auto bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    {tamilPitchText}
                  </pre>
                </div>
              </div>
            )}

            {/* Sub-tab 2: Leads List */}
            {activeAdminTab === 'leads_list' && (
              <div className="space-y-3">
                {loadingLeads ? (
                  <div className="text-center py-8 text-xs text-slate-400 font-medium">Loading leads...</div>
                ) : leadsList.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-medium">
                    No institutional leads registered yet. Share the link <span className="text-indigo-400">http://13.53.231.6/#/for-colleges</span> with college leadership.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">College</th>
                          <th className="py-2.5 px-3">Contact Person</th>
                          <th className="py-2.5 px-3">Email & Phone</th>
                          <th className="py-2.5 px-3">Region</th>
                          <th className="py-2.5 px-3">Students</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {leadsList.map((lead) => (
                          <tr key={lead.id} className="hover:bg-slate-800/30">
                            <td className="py-3 px-3 font-bold text-white">
                              {lead.college_name} {lead.college_code && `(${lead.college_code})`}
                            </td>
                            <td className="py-3 px-3 text-slate-300">
                              {lead.contact_person}
                              <span className="block text-[10px] text-slate-400 font-medium">{lead.designation}</span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300">
                              {lead.email}
                              <span className="block text-[10px] text-slate-400">{lead.phone}</span>
                            </td>
                            <td className="py-3 px-3 text-slate-400">{lead.district || '—'}</td>
                            <td className="py-3 px-3 font-bold text-indigo-400">{lead.approx_students}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
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

            {/* Sub-tab 3: 1-Click Emailer */}
            {activeAdminTab === 'quick_send' && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-w-xl mx-auto space-y-4">
                <h4 className="text-sm font-bold text-white">Dispatch Institutional Pitch to Principal / TPO</h4>
                
                {quickSendStatus && (
                  <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs font-bold text-indigo-300">
                    {quickSendStatus}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Recipient Email (Principal / TPO)</label>
                  <input
                    type="email"
                    placeholder="e.g. principal@skcet.ac.in"
                    value={quickSendEmail}
                    onChange={(e) => setQuickSendEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">College Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sri Krishna College of Engineering and Technology"
                    value={quickSendCollege}
                    onChange={(e) => setQuickSendCollege(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleQuickSend}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  Send Official Institutional Proposal Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
