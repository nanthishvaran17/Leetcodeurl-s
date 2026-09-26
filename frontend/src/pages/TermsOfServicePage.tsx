import React, { useState, useMemo } from 'react';
import { 
  Scale, 
  FileSignature, 
  AlertCircle, 
  RefreshCw, 
  Mail, 
  ShieldCheck, 
  Code, 
  Printer, 
  Copy, 
  Check, 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  Search, 
  HelpCircle,
  Zap,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Filter
} from 'lucide-react';

interface TermsSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeGradient: string;
  cardGlow: string;
  summary: string;
  content: React.ReactNode;
}

export const TermsOfServicePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    acceptance: true,
    purpose: true,
    integrity: true,
    modifications: true,
    ip: true,
    contact: true,
  });
  const [activeSection, setActiveSection] = useState<string>('acceptance');

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    sections.forEach(s => { allExpanded[s.id] = true; });
    setExpandedSections(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    sections.forEach(s => { allCollapsed[s.id] = false; });
    setExpandedSections(allCollapsed);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSectionClick = (id: string) => {
    setActiveSection(id);
    setExpandedSections(prev => ({ ...prev, [id]: true }));
    
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        const yOffset = -90;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }, 50);
  };

  const developerInfo = {
    name: 'Nanthish S',
    role: 'Lead Platform Engineer & System Architect',
    platform: 'Nandha LeetCode Intelligence Platform',
    institution: 'Nandha Engineering College (Autonomous), Erode',
    email: 'nanthishvaran17@gmail.com',
  };

  const sections: TermsSection[] = [
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

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      s => s.title.toLowerCase().includes(q) || s.badge.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-navy-950 font-sans selection:bg-brand-500/30 text-slate-900 dark:text-white pb-24 relative overflow-hidden">
      
      {/* Background Lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-32 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-96 left-10 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-full px-4 sm:px-6 lg:px-12 pt-6 lg:pt-10">
        
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 p-4 bg-white dark:bg-navy-900 rounded-3xl border-2 border-slate-200 dark:border-navy-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-slate-900 to-indigo-900 text-white rounded-2xl shadow-md">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Terms of Service Framework</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Version 2.4.0 • Operational Sept 2026</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-extrabold bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white hover:bg-brand-500 hover:text-white dark:hover:bg-brand-500 border border-slate-300 dark:border-navy-700 transition-all shadow-sm"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-extrabold bg-slate-100 dark:bg-navy-800 text-slate-900 dark:text-white hover:bg-brand-500 hover:text-white dark:hover:bg-brand-500 border border-slate-300 dark:border-navy-700 transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Hero Header */}
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-slate-900 via-indigo-900 to-purple-900 text-white shadow-lg text-xs font-black uppercase tracking-widest">
            <Scale className="w-4 h-4 text-brand-400" />
            <span>Institutional Governance Framework</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Terms of <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 dark:from-brand-400 dark:via-indigo-400 dark:to-purple-400">Service</span>
          </h1>
          <p className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-200 max-w-3xl mx-auto leading-relaxed">
            Please read these operational terms carefully. Engineered & Enforced by Lead Developer <strong className="text-brand-600 dark:text-brand-400 font-black">Nanthish S</strong>.
          </p>
        </div>

        {/* Search & Global Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search terms (e.g. conduct, bots, HOD, developer)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-navy-900 border-2 border-slate-300 dark:border-navy-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-md transition-all"
            />
            {searchQuery && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-navy-800 px-2 py-1 rounded-md">
                {filteredSections.length} matches
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-black text-slate-700 dark:text-slate-300">
            <button 
              onClick={expandAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all shadow-sm"
            >
              <Maximize2 className="w-4 h-4 text-brand-500" />
              <span>Expand All</span>
            </button>
            <button 
              onClick={collapseAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 hover:bg-slate-100 dark:hover:bg-navy-800 transition-all shadow-sm"
            >
              <Minimize2 className="w-4 h-4 text-brand-500" />
              <span>Collapse All</span>
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Index Sidebar */}
          <div className="hidden lg:block lg:col-span-3 sticky top-6">
            <div className="p-4 rounded-3xl bg-white dark:bg-navy-900 border-2 border-slate-200 dark:border-navy-800 shadow-xl space-y-2">
              <div className="px-3 py-2 text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center justify-between border-b-2 border-slate-100 dark:border-navy-800 pb-3 mb-2">
                <span className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-brand-500" />
                  Terms Index
                </span>
                <Sparkles className="w-4 h-4 text-brand-500" />
              </div>

              {sections.map(s => {
                const Icon = s.icon;
                const isActive = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSectionClick(s.id)}
                    className={`w-full text-left p-3 rounded-2xl text-xs font-black transition-all flex items-center justify-between gap-2 border-2 ${
                      isActive 
                        ? 'bg-gradient-to-r from-slate-900 via-indigo-900 to-navy-900 text-white border-slate-800 shadow-lg scale-[1.02]' 
                        : 'bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-navy-800 hover:border-brand-500 hover:bg-white dark:hover:bg-navy-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-400' : 'text-slate-700 dark:text-slate-300'}`} />
                      <span className="font-extrabold leading-snug text-slate-900 dark:text-white text-xs">{s.title.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] shrink-0 font-extrabold shadow-sm ${
                      isActive 
                        ? 'bg-white text-slate-900 font-black shadow-md' 
                        : 'bg-slate-200 dark:bg-navy-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-navy-700'
                    }`}>
                      {s.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cards List */}
          <div className="lg:col-span-9 space-y-6">
            {filteredSections.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-navy-900 rounded-3xl border-2 border-slate-200 dark:border-navy-800 space-y-3">
                <HelpCircle className="w-12 h-12 text-slate-400 mx-auto" />
                <h3 className="font-black text-slate-900 dark:text-white text-lg">No matching terms found</h3>
                <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">Try searching for keywords like "conduct" or "bots".</p>
              </div>
            ) : (
              filteredSections.map((section) => {
                const Icon = section.icon;
                const isExpanded = !!expandedSections[section.id];
                const isActive = activeSection === section.id;

                return (
                  <div 
                    key={section.id} 
                    id={section.id}
                    className={`rounded-3xl bg-white dark:bg-navy-900 border-2 transition-all shadow-xl ${section.cardGlow} ${
                      isActive 
                        ? 'ring-4 ring-slate-900/20 dark:ring-white/20 border-slate-900 dark:border-white shadow-2xl scale-[1.01]' 
                        : 'border-slate-200 dark:border-navy-800 hover:border-slate-300 dark:hover:border-navy-700'
                    }`}
                  >
                    {/* Header Button */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4 focus:outline-none"
                    >
                      <div className="flex items-center gap-4 truncate">
                        <div className={`p-3.5 rounded-2xl shrink-0 shadow-md bg-gradient-to-tr ${section.badgeGradient}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2.5">
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                              {section.title}
                            </h2>
                            <span className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-lg text-xs font-black shadow-sm bg-gradient-to-r ${section.badgeGradient}`}>
                              {section.badge}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 truncate mt-1">
                            {section.summary}
                          </p>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 shrink-0">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </button>

                    {/* Accordion Body */}
                    {isExpanded && (
                      <div className="px-5 pb-6 sm:px-6 sm:pb-7">
                        {section.content}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Support Desk Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-navy-950 to-indigo-950 text-white shadow-2xl border-2 border-indigo-500/50 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center sm:text-left">
                <h3 className="text-xl font-black">Questions about platform terms?</h3>
                <p className="text-xs sm:text-sm font-semibold text-slate-200 max-w-md">
                  For inquiries regarding terms enforcement or account verification, contact Lead Developer <strong className="text-white">Nanthish S</strong>.
                </p>
              </div>

              <a 
                href={`mailto:${developerInfo.email}`}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 font-black text-xs sm:text-sm rounded-2xl shadow-xl transition-all shrink-0"
              >
                <Mail className="w-5 h-5 text-slate-900" />
                <span>Email Nanthish S</span>
              </a>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
