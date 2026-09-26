import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  Lock, 
  Eye, 
  Database, 
  UserCheck, 
  Search, 
  Printer, 
  Copy, 
  Check, 
  Sparkles, 
  Mail, 
  Code, 
  Cpu, 
  CheckCircle2, 
  Key,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Globe,
  Layers,
  Filter,
  HelpCircle
} from 'lucide-react';

interface PolicySection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge: string;
  badgeGradient: string;
  cardGlow: string;
  summary: string;
  content: React.ReactNode;
}

export const PrivacyPolicyPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    collection: true,
    usage: true,
    security: true,
    sharing: true,
    rights: true,
    developer: true,
  });
  const [activeSection, setActiveSection] = useState<string>('collection');

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
    role: 'Lead System Architect & Core Platform Engineer',
    platform: 'Nandha LeetCode Intelligence',
    institution: 'Nandha Engineering College (Autonomous), Erode',
    email: 'nanthishvaran17@gmail.com',
  };

  const sections: PolicySection[] = [
    {
      id: 'collection',
      title: '1. Information We Collect',
      icon: Database,
      badge: 'Data Intake',
      badgeGradient: 'from-blue-600 to-cyan-500 text-white shadow-blue-500/30',
      cardGlow: 'border-blue-500/40 shadow-blue-500/5',
      summary: 'OAuth profile ingestion, LeetCode problem solved counts, and academic hierarchy.',
      content: (
        <div className="space-y-4 pt-3 border-t border-blue-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            When you authenticate into the <strong className="text-blue-600 dark:text-blue-400 font-black">Nandha LeetCode Intelligence Platform</strong> via Google OAuth, we ingest and maintain the following data points for academic tracking:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 my-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-slate-50 to-white dark:from-blue-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-blue-500/20 shadow-sm flex items-start gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-blue-600 to-cyan-500 text-white rounded-xl font-extrabold shrink-0 mt-0.5 shadow-md">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">OAuth Profile Metadata</h4>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">Full Name, Institutional Email Address, and Avatar image URL provided by Google OAuth.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-slate-50 to-white dark:from-indigo-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-indigo-500/20 shadow-sm flex items-start gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-indigo-600 to-purple-500 text-white rounded-xl font-extrabold shrink-0 mt-0.5 shadow-md">
                <Code className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">LeetCode Telemetry</h4>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">Public handle, problem breakdown (Easy/Medium/Hard), and active contest ratings.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-slate-50 to-white dark:from-cyan-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-cyan-500/20 shadow-sm flex items-start gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-500 text-white rounded-xl font-extrabold shrink-0 mt-0.5 shadow-md">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">Academic Hierarchy</h4>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">Department, Register Number, Graduation Year, and assigned faculty mentor mapping.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-slate-50 to-white dark:from-purple-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-purple-500/20 shadow-sm flex items-start gap-3.5">
              <div className="p-3 bg-gradient-to-tr from-purple-600 to-pink-500 text-white rounded-xl font-extrabold shrink-0 mt-0.5 shadow-md">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">Contest Audit Timestamps</h4>
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1 leading-relaxed">Problem solve timing recorded during Sunday 8:00 AM – 9:30 AM contest sessions.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'usage',
      title: '2. Purpose & How We Use Data',
      icon: Eye,
      badge: 'Academic Analytics',
      badgeGradient: 'from-purple-600 to-pink-500 text-white shadow-purple-500/30',
      cardGlow: 'border-purple-500/40 shadow-purple-500/5',
      summary: 'Data processing for department rankings, risk detection, and accreditation.',
      content: (
        <div className="space-y-3 pt-3 border-t border-purple-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            Data is strictly processed for academic skill development, placement preparation, and institutional reporting:
          </p>
          <div className="space-y-2.5">
            {[
              'Real-time calculation of department standings and campus leaderboards.',
              'Automated risk identification for stagnated coding progress.',
              'Generating official department analytics for HOD evaluation and accreditation.',
              'HR Candidate Placement matching based on difficulty solve ratios.'
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-slate-50 to-white dark:from-purple-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-purple-500/20 font-bold text-slate-900 dark:text-white text-xs sm:text-sm shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'security',
      title: '3. Data Storage & Security Directive',
      icon: Lock,
      badge: 'Enterprise Guard',
      badgeGradient: 'from-emerald-600 to-teal-500 text-white shadow-emerald-500/30',
      cardGlow: 'border-emerald-500/40 shadow-emerald-500/5',
      summary: 'Encrypted storage with Neon PostgreSQL, SQLite WAL, and zero synthetic data rules.',
      content: (
        <div className="space-y-4 pt-3 border-t border-emerald-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            Data is protected using encrypted cloud storage powered by <strong className="text-emerald-600 dark:text-emerald-400 font-black">Neon PostgreSQL</strong> and high-speed <strong className="text-teal-600 dark:text-teal-400 font-black">SQLite WAL engines</strong>.
          </p>
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-navy-950 text-white border-2 border-emerald-500/50 space-y-2.5 shadow-xl">
            <div className="flex items-center gap-2.5 text-emerald-400 font-black text-sm sm:text-base">
              <ShieldAlert className="w-5 h-5" />
              <span>Zero Password & Zero Synthetic Data Guarantee</span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed">
              We never store your LeetCode password or Google password. Authentication is strictly managed via secure OAuth tokens. Production databases adhere strictly to a <strong className="text-amber-300 font-bold">Zero Mock Data Policy</strong>, guaranteeing 100% data authenticity across all student rosters.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'sharing',
      title: '4. Data Sharing & Visibility',
      icon: UserCheck,
      badge: 'Strict Privacy',
      badgeGradient: 'from-rose-600 to-orange-500 text-white shadow-rose-500/30',
      cardGlow: 'border-rose-500/40 shadow-rose-500/5',
      summary: 'Strict non-commercialization policy and campus visibility parameters.',
      content: (
        <div className="space-y-3 pt-3 border-t border-rose-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            Your data is <strong className="text-rose-600 dark:text-rose-400 font-black">never sold, commercialized, or shared with external third-party advertisers</strong>.
          </p>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-slate-50 to-white dark:from-rose-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-rose-500/20 space-y-2 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-sm">
            <h4 className="font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider text-xs">Institutional Visibility Boundaries:</h4>
            <p>• <strong>Public Leaderboards:</strong> Your Name, Register Number, Department, and Solved Counts are visible on campus leaderboards.</p>
            <p>• <strong>Faculty Desk:</strong> Assigned HODs and Staff Mentors can inspect detailed progress telemetry for student guidance.</p>
          </div>
        </div>
      )
    },
    {
      id: 'rights',
      title: '5. Student Rights & Control',
      icon: Key,
      badge: 'User Control',
      badgeGradient: 'from-amber-600 to-yellow-500 text-white shadow-amber-500/30',
      cardGlow: 'border-amber-500/40 shadow-amber-500/5',
      summary: 'Data export rights, handle unlinking, and leaderboard privacy controls.',
      content: (
        <div className="space-y-3 pt-3 border-t border-amber-500/20">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            Students retain full ownership and control over their platform profile:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Right to request full data export',
              'Right to request handle unlinking',
              'Right to correct register details',
              'Right to opt-out of public kiosk'
            ].map((r, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-50 to-white dark:from-amber-950/40 dark:via-navy-900 dark:to-navy-900 border-2 border-amber-500/20 text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2.5 shadow-sm">
                <CheckCircle2 className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'developer',
      title: '6. System Governance & Lead Developer',
      icon: Cpu,
      badge: 'Architect Desk',
      badgeGradient: 'from-brand-600 via-indigo-600 to-purple-600 text-white shadow-brand-500/40',
      cardGlow: 'border-brand-500/50 shadow-brand-500/10',
      summary: 'Author attribution, direct contact desk, and engineering support.',
      content: (
        <div className="space-y-4 pt-3 border-t border-brand-500/30">
          <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm sm:text-base leading-relaxed">
            This platform and its data privacy algorithms are engineered and maintained by Lead Developer <strong className="text-brand-600 dark:text-brand-400 font-black">{developerInfo.name}</strong>. For inquiries or data updates:
          </p>
          
          <div className="p-6 rounded-3xl bg-gradient-to-br from-brand-950 via-slate-950 to-navy-950 text-white border-2 border-brand-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-xl border-2 border-white/20">
                NS
              </div>
              <div>
                <h4 className="font-black text-white text-lg sm:text-xl">{developerInfo.name}</h4>
                <p className="text-xs sm:text-sm text-brand-300 font-black">{developerInfo.role}</p>
                <p className="text-xs font-semibold text-slate-300">{developerInfo.institution}</p>
              </div>
            </div>

            <a 
              href={`mailto:${developerInfo.email}`} 
              className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-brand-500/30 transition-all shrink-0 border border-white/20 relative z-10"
            >
              <Mail className="w-5 h-5" />
              <span>Email Nanthish S</span>
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
      
      {/* Background Lighting Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-10 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute top-96 right-10 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-40 left-1/3 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-full px-4 sm:px-6 lg:px-12 pt-6 lg:pt-10">
        
        {/* Top Floating Control Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 p-4 bg-white dark:bg-navy-900 rounded-3xl border-2 border-slate-200 dark:border-navy-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-brand-600 to-indigo-600 text-white rounded-2xl shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Privacy Policy Directive</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Version 2.4.0 • Updated Sept 2026</p>
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500 text-white shadow-lg shadow-brand-500/20 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            <span>Nandha LeetCode Intelligence Directive</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Privacy Policy <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 dark:from-brand-400 dark:via-indigo-400 dark:to-purple-400">• Nandha Intelligence</span>
          </h1>
          <p className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-200 max-w-3xl mx-auto leading-relaxed">
            Official Data Governance Protocol. Engineered by Lead Developer <strong className="text-brand-600 dark:text-brand-400 font-black">Nanthish S</strong> for Nandha Engineering College (Autonomous).
          </p>
        </div>

        {/* Search & Global Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search policy sections (e.g. collection, security, rights)..."
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
                  Policy Navigation
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
                        ? 'bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white border-brand-500 shadow-lg shadow-brand-500/30 scale-[1.02]' 
                        : 'bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-navy-800 hover:border-brand-500 hover:bg-white dark:hover:bg-navy-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`} />
                      <span className="font-extrabold leading-snug text-slate-900 dark:text-white text-xs">{s.title.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] shrink-0 font-extrabold shadow-sm ${
                      isActive 
                        ? 'bg-white text-brand-700 font-black shadow-md' 
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
                <h3 className="font-black text-slate-900 dark:text-white text-lg">No matching policy found</h3>
                <p className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300">Try searching for keywords like "collection" or "security".</p>
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
                        ? 'ring-4 ring-brand-500/20 border-brand-500 shadow-2xl scale-[1.01]' 
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
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-950 via-navy-950 to-brand-950 text-white shadow-2xl border-2 border-brand-500/50 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500 text-white text-xs font-black">
                  <Code className="w-3.5 h-3.5" />
                  Engineering & Compliance Desk
                </div>
                <h3 className="text-xl font-black">Have questions about your data?</h3>
                <p className="text-xs sm:text-sm font-semibold text-slate-200 max-w-md">
                  Reach out directly to Lead Developer <strong className="text-white">Nanthish S</strong> for data export requests or privacy questions.
                </p>
              </div>

              <a 
                href={`mailto:${developerInfo.email}`}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-brand-500/30 transition-all shrink-0 border border-white/20"
              >
                <Mail className="w-5 h-5" />
                <span>Email Nanthish S</span>
              </a>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
