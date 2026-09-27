import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Lock, Eye, Database, UserCheck, Search, Printer, Copy, Check, Sparkles, Mail, Code, Cpu, CheckCircle2, Key,
  ShieldAlert, ChevronDown, ChevronRight, Globe, Layers, Filter, HelpCircle, Activity, Layout, Terminal, Scale, 
  FileText, ArrowRight, Zap, RefreshCw, XCircle, AlertCircle, FileSignature, BookOpen, ShieldCheck
} from 'lucide-react';

interface ContentSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeGradient: string;
  cardGlow: string;
  summary: string;
  content: React.ReactNode;
}

const developerInfo = {
  name: "Nanthish S",
  email: "nanthishvaran17@gmail.com",
  role: "Lead Platform Engineer",
  institution: "Nandha Engineering College (Autonomous)"
};

export const TermsOfServicePage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('collection');
  const [isCopied, setIsCopied] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const sections: ContentSection[] = [
    {
      id: 'acceptance',
      title: '1. Acceptance & User Agreement',
      icon: FileSignature,
      badge: 'Mandatory Consent',
      badgeGradient: 'from-blue-600 to-indigo-600 text-white shadow-blue-500/30',
      cardGlow: 'border-blue-500/40 shadow-blue-500/5',
      summary: 'Binding operational conditions for using the platform via Google OAuth.',
      content: (
        <div className="space-y-4 pt-3 border-t border-blue-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            By authenticating into, browsing, or utilizing the <strong className="text-blue-600 dark:text-blue-400 font-black">Nandha LeetCode Intelligence Platform</strong>, you explicitly agree to be bound by these Terms of Service and all operational conditions established by the institution.
          </p>
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-extrabold leading-relaxed shadow-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>If you do not agree to these terms, you must immediately revoke your Google OAuth authorization and cease access to the platform.</span>
          </div>
        </div>
      )
    },
    {
      id: 'purpose',
      title: '2. Platform Purpose & Scope',
      icon: BookOpen,
      badge: 'Academic Hub',
      badgeGradient: 'from-indigo-600 to-purple-600 text-white shadow-indigo-500/30',
      cardGlow: 'border-indigo-500/40 shadow-indigo-500/5',
      summary: 'Institutional analytics, student skill monitoring, and placement evaluation.',
      content: (
        <div className="space-y-4 pt-3 border-t border-indigo-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            The platform functions as an <strong className="text-indigo-600 dark:text-indigo-400 font-black">Institutional Analytics & Coding Intelligence Hub</strong>. It aggregates public LeetCode problem-solving metrics, computes department leaderboards, and tracks cohort progress.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-slate-50 to-white dark:from-indigo-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-indigo-500/20 shadow-sm">
              <h4 className="font-black text-indigo-600 dark:text-indigo-400 text-xs uppercase tracking-wider mb-1">Target Audience</h4>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">Designated for students, faculty mentors, HODs, and placement officers of Nandha Engineering College.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-slate-50 to-white dark:from-purple-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-purple-500/20 shadow-sm">
              <h4 className="font-black text-purple-600 dark:text-purple-400 text-xs uppercase tracking-wider mb-1">Non-Commercial Use</h4>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">Use of the platform for commercial scraping or unauthorized data harvesting is strictly prohibited.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'integrity',
      title: '3. Academic Conduct & Anti-Cheat Rules',
      icon: ShieldCheck,
      badge: 'Sentinel Guard Enforced',
      badgeGradient: 'from-emerald-600 to-teal-500 text-white shadow-emerald-500/30',
      cardGlow: 'border-emerald-500/40 shadow-emerald-500/5',
      summary: 'Strict anti-cheat protocols, submission verification, and disciplinary escalation.',
      content: (
        <div className="space-y-4 pt-3 border-t border-emerald-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            Every user is required to link their authentic LeetCode handle. The platform utilizes an automated <strong className="text-emerald-600 dark:text-emerald-400 font-black">Contest Integrity Engine & Sentinel Guard</strong> to verify submission authenticity during weekly contests.
          </p>
          <div className="space-y-3">
            {[
              "Prohibited: Linking fake or other students' LeetCode handles.",
              "Prohibited: Submission bots, automated script solvers, or plagiarized contest codes.",
              "Consequence: Flagged violations are escalated directly to HOD & Academic Disciplinary Cell."
            ].map((rule, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-transparent border-2 border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs sm:text-sm font-black flex items-center gap-3 shadow-sm">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'modifications',
      title: '4. Service Availability & Modifications',
      icon: RefreshCw,
      badge: 'Dynamic Operations',
      badgeGradient: 'from-purple-600 to-pink-500 text-white shadow-purple-500/30',
      cardGlow: 'border-purple-500/40 shadow-purple-500/5',
      summary: 'Sync interval dynamics, rate limit handling, and system maintenance windows.',
      content: (
        <div className="space-y-4 pt-3 border-t border-purple-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            We reserve the right to update, modify, or pause background scrapers to ensure system stability, database performance, or compliance with institution guidelines.
          </p>
          <div className="space-y-2.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-slate-50 to-white dark:from-purple-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-purple-500/20 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-3 shadow-sm">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Sync frequency may fluctuate based on LeetCode API rate limits and server load.</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-slate-50 to-white dark:from-purple-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-purple-500/20 text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-3 shadow-sm">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Maintenance windows may temporarily disable live leaderboard updates.</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'ip',
      title: '5. Intellectual Property & Author Credits',
      icon: Cpu,
      badge: 'Developed by Nanthish S',
      badgeGradient: 'from-amber-600 to-yellow-500 text-white shadow-amber-500/30',
      cardGlow: 'border-amber-500/40 shadow-amber-500/5',
      summary: 'System authorship credits, institutional ownership, and software protection.',
      content: (
        <div className="space-y-4 pt-3 border-t border-amber-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            The architecture, user interface, database schemas, and analytics algorithms of this platform were engineered and authored by <strong className="text-amber-600 dark:text-amber-400 font-black">{developerInfo.name}</strong>.
          </p>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-50 to-white dark:from-amber-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-amber-500/20 text-xs sm:text-sm font-bold text-slate-900 dark:text-white space-y-2 shadow-sm">
            <p>• <strong>System Owner:</strong> Nandha Engineering College (Autonomous)</p>
            <p>• <strong>Lead Platform Engineer:</strong> Nanthish S ({developerInfo.email})</p>
            <p className="text-slate-700 dark:text-slate-300 font-semibold pt-1">All platform logos, custom intelligence scripts, and analytics dashboards are protected under institutional guidelines.</p>
          </div>
        </div>
      )
    },
    {
      id: 'contact',
      title: '6. Governance & Support Inquiries',
      icon: Mail,
      badge: 'Developer Reachout',
      badgeGradient: 'from-rose-600 to-orange-500 text-white shadow-rose-500/30',
      cardGlow: 'border-rose-500/40 shadow-rose-500/5',
      summary: 'Direct developer contact desk, handle verification support, and escalations.',
      content: (
        <div className="space-y-4 pt-3 border-t border-rose-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            For terms clarification, handle corrections, or technical support, contact Lead Developer <strong className="text-rose-600 dark:text-rose-400 font-black">{developerInfo.name}</strong> or the Department HOD desk.
          </p>
          
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-navy-950 to-indigo-950 text-white border-2 border-indigo-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-xl border-2 border-white/20">
                NS
              </div>
              <div>
                <h4 className="font-black text-white text-lg sm:text-xl">{developerInfo.name}</h4>
                <p className="text-xs sm:text-sm text-indigo-300 font-black">{developerInfo.role}</p>
                <p className="text-xs font-semibold text-slate-300">{developerInfo.institution}</p>
              </div>
            </div>

            <a 
              href={`mailto:${developerInfo.email}`} 
              className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-indigo-500/30 transition-all shrink-0 border border-white/20 relative z-10"
            >
              <Mail className="w-5 h-5 text-white" />
              <span>nanthishvaran17@gmail.com</span>
            </a>
          </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    if (sections.length > 0 && !sections.find(s => s.id === activeSection)) {
      setActiveSection(sections[0].id);
    }
  }, [sections, activeSection]);

  const handlePrint = () => window.print();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const activeData = sections.find(s => s.id === activeSection) || sections[0];
  const ActiveIcon = activeData?.icon || Shield;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030816] text-slate-900 dark:text-slate-100 font-sans relative overflow-hidden transition-colors duration-500">
      
      {/* Animated Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-600/10 dark:bg-brand-500/10 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 dark:bg-indigo-500/10 blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div 
          className="absolute w-[600px] h-[600px] rounded-full bg-purple-500/5 dark:bg-purple-500/10 blur-[100px] transition-transform duration-700 ease-out"
          style={{ transform: `translate(${mousePosition.x - 300}px, ${mousePosition.y - 300}px)` }}
        />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.015] dark:opacity-[0.03] mix-blend-overlay" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        
        {/* Header Title & Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-navy-900/60 border border-slate-200/50 dark:border-navy-700/50 backdrop-blur-md shadow-sm mb-6">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500"></span>
            </span>
            <span className="text-xs font-black tracking-widest uppercase text-brand-600 dark:text-brand-400">
              Official Directive
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 tracking-tight leading-tight drop-shadow-sm">
            Terms of Service <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500 animate-gradient-x">
              Operational Framework
            </span>
          </h1>
          
          <p className="text-lg text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-8">
            Engineered with a Zero-Trust architecture by Lead Developer <strong className="text-slate-900 dark:text-white">Nanthish S</strong> for Nandha Engineering College. 100% data authenticity guarantee.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={handlePrint}
              className="group flex items-center gap-2 px-6 py-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-brand-500/50 dark:hover:border-brand-500/50 rounded-2xl text-sm font-black transition-all shadow-sm hover:shadow-brand-500/10"
            >
              <Printer className="w-4 h-4 text-slate-500 group-hover:text-brand-500 transition-colors" />
              <span>Print Document</span>
            </button>
            <button 
              onClick={handleCopyLink}
              className="group flex items-center gap-2 px-6 py-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl text-sm font-black transition-all shadow-sm hover:shadow-indigo-500/10"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-500 group-hover:text-indigo-500 transition-colors" />}
              <span>{isCopied ? 'Link Copied!' : 'Share Link'}</span>
            </button>
          </div>
        </motion.div>

        {/* Layout Grid */}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Navigation Sidebar */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-4 space-y-4 sticky top-24"
          >
            <div className="p-1.5 bg-white/40 dark:bg-navy-900/40 backdrop-blur-xl border border-white/60 dark:border-navy-700/50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
              <div className="px-4 py-3 border-b border-slate-200/50 dark:border-navy-700/50 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Index
                </span>
                <Sparkles className="w-4 h-4 text-brand-500/50" />
              </div>
              <div className="p-2 flex flex-col gap-1.5">
                {sections.map((s, idx) => {
                  const Icon = s.icon;
                  const isActive = activeSection === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className={`relative w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-300 flex items-center justify-between group overflow-hidden ${
                        isActive 
                          ? 'bg-gradient-to-r from-brand-500 to-indigo-600 text-white shadow-md shadow-brand-500/20 scale-[1.02]' 
                          : 'hover:bg-white dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="navGlow"
                          className="absolute inset-0 bg-gradient-to-r from-brand-400 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-navy-950 group-hover:bg-brand-50 dark:group-hover:bg-brand-500/10'}`}>
                          <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-brand-500'}`} />
                        </div>
                        <span className="font-extrabold text-sm tracking-tight truncate">{s.title.replace(/^\d+\.\s*/, '')}</span>
                      </div>
                      <ChevronRight className={`relative z-10 shrink-0 w-4 h-4 transition-transform duration-300 ${isActive ? 'text-white translate-x-1 opacity-100' : 'opacity-0 -translate-x-2 group-hover:opacity-50 group-hover:translate-x-0'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tech Stack Security Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 to-navy-950 border border-navy-800 shadow-xl overflow-hidden relative group hidden lg:block">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition-all duration-500" />
              <ShieldAlert className="w-8 h-8 text-brand-400 mb-4" />
              <h4 className="text-white font-black text-lg mb-2">Zero-Trust Framework</h4>
              <p className="text-slate-400 text-sm font-medium leading-relaxed">
                Platform telemetry is protected by Neon PostgreSQL encrypted at rest. We never store passwords or sync mock data.
              </p>
            </div>
          </motion.div>

          {/* Right Main Content Area */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="lg:col-span-8"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
                className="relative"
              >
                {/* Glowing Aura around active content */}
                <div className={`absolute -inset-0.5 rounded-[2.5rem] blur-xl opacity-20 bg-gradient-to-br ${activeData.badgeGradient.replace('text-white', '').replace(/shadow-.*/, '')} transition-all duration-700`} />
                
                <div className="relative bg-white/70 dark:bg-navy-900/70 backdrop-blur-2xl border border-white/50 dark:border-navy-700/50 p-6 sm:p-10 rounded-[2.5rem] shadow-xl">
                  
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-8 border-b border-slate-200/50 dark:border-navy-700/50">
                    <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl bg-gradient-to-br ${activeData.badgeGradient} shadow-lg shrink-0`}>
                        <ActiveIcon className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                          {activeData.title}
                        </h2>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                          {activeData.summary}
                        </p>
                      </div>
                    </div>
                    <div className={`hidden sm:flex px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-gradient-to-r ${activeData.badgeGradient} shrink-0`}>
                      {activeData.badge}
                    </div>
                  </div>

                  {/* Formatted Content */}
                  <div className="prose prose-slate dark:prose-invert prose-headings:font-black prose-p:font-medium prose-p:leading-relaxed prose-strong:font-black prose-strong:text-brand-600 dark:prose-strong:text-brand-400 max-w-none">
                    {activeData.content}
                  </div>

                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

        </div>
      </div>
    </div>
  );
};
