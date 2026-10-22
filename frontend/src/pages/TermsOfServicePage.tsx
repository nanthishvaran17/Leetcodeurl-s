import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Lock, Eye, Database, UserCheck, Search, Printer, Copy, Check, Mail, Code, Cpu, 
  CheckCircle2, Key, ShieldAlert, ChevronRight, Globe, Layers, Activity, Scale, 
  FileText, ArrowRight, ShieldCheck, Award, Sparkles, Trash2, ExternalLink, 
  Server, ShieldPlus, UserX, Clock, HardDrive, ArrowLeft, Download, Building, 
  Info, HelpCircle, AlertTriangle, FileLock2, Fingerprint, RefreshCw, FileSignature, 
  BookOpen, Users, AlertCircle, Ban, Gavel, CheckCheck
} from 'lucide-react';

interface ContentSection {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  icon: React.ElementType;
  badge: string;
  badgeGradient: string;
  summary: string;
  content: React.ReactNode;
}

export interface TeamMember {
  name: string;
  role: string;
  badge: string;
  badgeGradient: string;
  image: string;
  initials: string;
  desc: string;
  email?: string;
  isAdvisor?: boolean;
  isLead?: boolean;
  borderColor: string;
  glowColor: string;
  department: string;
}

export const teamMembers: TeamMember[] = [
  {
    name: "Dr. S. Prabhu",
    role: "Head of the Department & Faculty Advisor",
    badge: "Faculty Advisor",
    badgeGradient: "from-amber-500 via-yellow-500 to-amber-600 text-white shadow-amber-500/40",
    image: "/team/hod_dr_s_prabhu.png",
    initials: "SP",
    desc: "Department Leadership, Institutional Governance & Academic Direction",
    department: "CSE (Cyber Security & IoT)",
    isAdvisor: true,
    borderColor: "border-amber-500/50 dark:border-amber-400/50",
    glowColor: "shadow-amber-500/20"
  },
  {
    name: "Mr. Mohammed Affan J A",
    role: "Security & Forensic Anti-Cheat Lead",
    badge: "Security Head",
    badgeGradient: "from-cyan-600 via-teal-500 to-blue-600 text-white shadow-cyan-500/30",
    image: "/team/security_head_affan.jpg",
    initials: "MA",
    desc: "Forensic Contest Verification, Sentinel Guard & Auth Security Architecture",
    department: "CSE (Cyber Security)",
    borderColor: "border-cyan-500/40 dark:border-cyan-400/40",
    glowColor: "shadow-cyan-500/20"
  },
  {
    name: "Mr. S. Nanthish",
    role: "Lead Platform Engineer & Full-Stack Architect",
    badge: "Lead Developer",
    badgeGradient: "from-blue-600 via-indigo-600 to-purple-600 text-white shadow-indigo-500/40",
    image: "/team/lead_dev_nanthish_s.jpg",
    initials: "NS",
    desc: "Core Platform Architecture, Real-Time Telemetry Engine & Contest Engine",
    email: "nanthishvaran17@gmail.com",
    department: "CSE (Cyber Security)",
    isLead: true,
    borderColor: "border-indigo-500/60 dark:border-indigo-400/60",
    glowColor: "shadow-indigo-500/30"
  },
  {
    name: "Mr. B. Kavin",
    role: "Quality Assurance & Testing Lead",
    badge: "Testing Head",
    badgeGradient: "from-purple-600 via-fuchsia-500 to-pink-600 text-white shadow-purple-500/30",
    image: "/team/testing_head_kavin_b.png",
    initials: "KB",
    desc: "End-to-End System Testing, Contest Reconciliation & Stress Benchmarking",
    department: "CSE (Cyber Security)",
    borderColor: "border-purple-500/40 dark:border-purple-400/40",
    glowColor: "shadow-purple-500/20"
  }
];

export const TeamAvatar: React.FC<{ member: TeamMember; size?: 'sm' | 'md' | 'lg' }> = ({ member, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: "w-12 h-12 text-sm",
    md: "w-16 h-16 sm:w-20 sm:h-20 text-lg sm:text-xl",
    lg: "w-20 h-20 sm:w-24 sm:h-24 text-xl sm:text-2xl"
  }[size];

  return (
    <div className={`relative ${sizeClasses} rounded-2xl overflow-hidden shrink-0 border-2 ${member.borderColor} ${member.glowColor} shadow-md bg-slate-900 flex items-center justify-center font-black text-white group`}>
      {!imgError ? (
        <img 
          src={member.image} 
          alt={member.name} 
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${
          member.isAdvisor 
            ? 'from-amber-600 to-yellow-800' 
            : member.isLead 
            ? 'from-blue-600 to-indigo-900' 
            : member.badge.includes('Security')
            ? 'from-cyan-700 to-slate-900'
            : 'from-purple-700 to-slate-900'
        } font-black text-white tracking-wider`}>
          <span>{member.initials}</span>
        </div>
      )}
    </div>
  );
};

export const TermsOfServicePage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('acceptance');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [mousePos, setMousePos] = useState({ x: -500, y: -500 });

  // Mouse move listener for smooth ambient cursor aura
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Scroll & reading progress calculation
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
        setReadingProgress(Math.round(progress));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2200);
  };

  const handleNavigateBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const sections: ContentSection[] = useMemo(() => [
    {
      id: 'acceptance',
      number: '01',
      title: 'Acceptance of Terms & Binding Agreement',
      shortTitle: 'Acceptance & Agreement',
      icon: FileSignature,
      badge: 'Mandatory Consent',
      badgeGradient: 'from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-blue-500/25',
      summary: 'Binding operational conditions, institutional jurisdiction, and mandatory Google OAuth consent.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            By authenticating into, browsing, or utilizing the <strong className="text-slate-900 dark:text-white font-bold">Nandha LeetCode Intelligence Platform</strong> via institutional Google OAuth, you explicitly enter into a legally binding operational agreement governed under the authority of <strong className="text-slate-900 dark:text-white font-bold">Nandha Engineering College (Autonomous)</strong>.
          </p>

          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs sm:text-sm font-bold flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-extrabold uppercase tracking-wider text-[11px] text-amber-700 dark:text-amber-400">
                Institutional Condition of Use
              </div>
              <p className="leading-relaxed">
                If you do not agree to these terms, you must immediately revoke your Google OAuth authorization and cease access to the platform. Continued utilization constitutes unreserved acceptance of all operational and academic conduct directives.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit">
                <Building className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Autonomous Collegiate Jurisdiction</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                These terms operate in full concordance with the statutory regulations, examination directives, and disciplinary codes of Nandha Engineering College.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit">
                <Scale className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Severability & Continuance</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                If any provision of this agreement is deemed unenforceable by legal or academic authorities, all remaining clauses shall remain in full force and effect.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'purpose',
      number: '02',
      title: 'Platform Scope, Educational Mission & Usage Limits',
      shortTitle: 'Scope & Usage',
      icon: BookOpen,
      badge: 'Academic Hub',
      badgeGradient: 'from-indigo-600 via-purple-600 to-pink-500 text-white shadow-indigo-500/25',
      summary: 'Educational skill benchmarking, placement evaluation, and strict non-commercialization.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            The platform functions as an <strong className="text-slate-900 dark:text-white font-bold">Institutional Analytics & Coding Intelligence Hub</strong>. It aggregates public LeetCode problem-solving metrics, computes real-time department leaderboards, and tracks student progress for academic growth.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-1.5">
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Authorized Cohort
              </span>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Designated Stakeholders</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Platform access is reserved strictly for enrolled students, faculty mentors, department heads, and placement officers of Nandha Engineering College.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-1.5">
              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Placement & Training
              </span>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Career Readiness Profiling</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Performance data assists placement officers in assessing industry readiness and presenting verified candidate metrics to recruiting organizations.
              </p>
            </div>
          </div>

          {/* Strict Non-Commercial Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs sm:text-sm font-medium space-y-1">
            <div className="font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Ban className="w-4 h-4" />
              <span>Strict Prohibition on Scraping & Commercial Exploitation</span>
            </div>
            <p className="leading-relaxed">
              Automated scraping, bulk data harvesting, unauthorized reverse-engineering, or commercial exploitation of student rankings or platform algorithms is strictly prohibited.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'integrity',
      number: '03',
      title: 'Academic Conduct, Contest Integrity & Sentinel Guard',
      shortTitle: 'Academic Integrity',
      icon: ShieldCheck,
      badge: 'Sentinel Guard Enforced',
      badgeGradient: 'from-emerald-600 via-teal-600 to-cyan-500 text-white shadow-emerald-500/25',
      summary: 'Strict anti-cheat protocols, submission hashing, and academic disciplinary escalation.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            Every user is mandated to link their authentic personal LeetCode handle. The platform utilizes an automated <strong className="text-slate-900 dark:text-white font-bold">Contest Integrity Engine & Sentinel Guard</strong> to verify submission authenticity during weekly contests and live sessions.
          </p>

          {/* 3 Pillars of Prohibited Conduct */}
          <div className="space-y-3">
            {[
              {
                rule: "Identity Masquerading & Fake Handles",
                desc: "Linking someone else's LeetCode account, registering synthetic dummy handles, or claiming problem statistics not authored by the student.",
                tag: "Zero Tolerance"
              },
              {
                rule: "Automated Script Solvers & Plagiarized Code",
                desc: "Employing submission bots, automated headless browser scripts, AI code injectors, or submitting copied code during timed Sunday contests.",
                tag: "Forensically Monitored"
              },
              {
                rule: "Disciplinary Escalation to Academic Council",
                desc: "Flagged violations are immediately reported to the respective Department HOD and the Academic Disciplinary Cell for formal inquiry.",
                tag: "Disciplinary Recourse"
              }
            ].map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.rule}</h4>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 pl-3.5 leading-relaxed">{item.desc}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 shrink-0 w-fit self-start sm:self-auto">
                  {item.tag}
                </span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              <strong className="text-emerald-700 dark:text-emerald-300">Forensic Contest Verification:</strong> Submission solve timestamps are cross-referenced with official LeetCode GraphQL audit trails. Any temporal discrepancy results in instantaneous leaderboard score revocation.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'availability',
      number: '04',
      title: 'Service Availability, API Sync Quotas & Maintenance',
      shortTitle: 'Service Availability',
      icon: RefreshCw,
      badge: 'Infrastructure Operations',
      badgeGradient: 'from-purple-600 via-indigo-600 to-blue-500 text-white shadow-purple-500/25',
      summary: 'Dynamic synchronization frequency, rate limit handling, and scheduled maintenance.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            While we strive for 99.9% uptime, platform services depend on upstream cloud infrastructure, serverless clusters, and external LeetCode endpoints:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-1.5">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 w-fit">
                <Activity className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Dynamic Sync Cycles</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Background scraping frequencies adapt dynamically to prevent LeetCode API throttling and maintain database health.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-1.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 w-fit">
                <Clock className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Maintenance Windows</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Periodic system upgrades and schema migrations may temporarily pause live leaderboard recalculations with prior notification.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-1.5">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit">
                <Server className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">High-Speed Caching</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                SQLite WAL caching layers sustain uninterrupted contest viewability even during peak Sunday traffic spikes.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'ip',
      number: '05',
      title: 'Intellectual Property & Core Architecture Directorate',
      shortTitle: 'Governance & Team',
      icon: Cpu,
      badge: 'Institutional Council',
      badgeGradient: 'from-amber-500 via-indigo-600 to-purple-600 text-white shadow-indigo-500/25',
      summary: 'Institutional ownership, faculty leadership, and core engineering authorship.',
      content: (
        <div className="space-y-8">
          
          {/* Institutional Preamble */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-100 dark:bg-navy-950/80 border border-slate-200 dark:border-navy-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Official Institutional Council
              </span>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Autonomous Institution
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  NAAC &apos;A&apos; Grade & NBA
                </span>
              </div>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-xs sm:text-sm">
              The platform architecture, real-time sync engines, neural telemetry, and security algorithms were engineered and deployed under institutional governance at <strong className="text-slate-900 dark:text-white font-bold">Nandha Engineering College (Autonomous)</strong>.
            </p>
          </div>

          {/* Faculty Advisor Hero Executive Card (Dr. S. Prabhu) - Clean Enterprise Micro-Icons, NO Emojis */}
          <motion.div 
            whileHover={{ y: -4, scale: 1.008 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-white dark:bg-navy-900/95 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl transition-all"
          >
            {/* Subtle Executive Top Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="relative shrink-0">
                <TeamAvatar member={teamMembers[0]} size="lg" />
                <div className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-amber-500 text-white shadow-md">
                  <Award className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Faculty Advisor & Institutional Head
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-navy-700">
                    Institutional Governance
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {teamMembers[0].name}
                  </h3>
                  <p className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {teamMembers[0].role} • Department of CSE (Cyber Security & IoT)
                  </p>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl font-medium">
                  Directs institutional policy, accreditation compliance (NBA / NAAC), and academic data protection guidelines. Exercises ultimate faculty authority over platform integrity and student privacy directives.
                </p>

                {/* Scope Indicators - Clean Enterprise Micro-Icons (No Emojis) */}
                <div className="pt-1 flex flex-wrap items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-700">
                    <Building className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Institutional Governance</span>
                  </div>
                  
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-700">
                    <Scale className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>NAAC / NBA Accreditation</span>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-navy-800/80 border border-slate-200/80 dark:border-navy-700">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Ethical Telemetry Oversight</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Core Engineering Trio - Corporate Security Directorate Style (Nanthish FIRST!) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                  Core Engineering & Security Directorate
                </h4>
              </div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                Department of CSE (Cyber Security)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Member 1: Lead Developer (Mr. S. Nanthish) - First! */}
              <div className="p-5 rounded-2xl bg-white dark:bg-navy-900/90 border-2 border-indigo-500/50 dark:border-indigo-400/40 shadow-md hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between gap-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

                <div className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <TeamAvatar member={teamMembers[2]} size="sm" />
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-sm">
                      Lead Developer
                    </span>
                  </div>

                  <div>
                    <h5 className="font-black text-slate-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {teamMembers[2].name}
                    </h5>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      Lead Platform Engineer & Full-Stack Architect
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Core Platform Architecture, Real-Time Telemetry Engine, Neon Lakebase synchronization, and zero-trust data pipeline.
                  </p>

                  <div className="space-y-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>Distributed Telemetry Engine</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>Neon PostgreSQL Architecture</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-navy-800 flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 relative z-10">
                  <span>{teamMembers[2].department}</span>
                  <a 
                    href="mailto:nanthishvaran17@gmail.com"
                    className="text-indigo-600 dark:text-indigo-400 font-black hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="w-3 h-3" />
                    <span>Contact</span>
                  </a>
                </div>
              </div>

              {/* Member 2: Security Head (Mr. Mohammed Affan J A) - Second! */}
              <div className="p-5 rounded-2xl bg-white dark:bg-navy-900/90 border-2 border-cyan-500/30 dark:border-cyan-500/20 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between gap-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />

                <div className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <TeamAvatar member={teamMembers[1]} size="sm" />
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-sm">
                      Security Head
                    </span>
                  </div>

                  <div>
                    <h5 className="font-black text-slate-900 dark:text-white text-base group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                      {teamMembers[1].name}
                    </h5>
                    <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                      Security & Forensic Anti-Cheat Lead
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    Architect of Sentinel Guard, forensic anti-cheat verification, and OAuth token security protocols protecting contest integrity.
                  </p>

                  <div className="space-y-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                      <span>Sentinel Anti-Cheat Engine</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                      <span>Forensic Solve Hashing</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-navy-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 relative z-10">
                  {teamMembers[1].department}
                </div>
              </div>

              {/* Member 3: Testing Head (Mr. B. Kavin) - Third! */}
              <div className="p-5 rounded-2xl bg-white dark:bg-navy-900/90 border-2 border-purple-500/30 dark:border-purple-500/20 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between gap-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all pointer-events-none" />

                <div className="space-y-3 relative z-10">
                  <div className="flex items-center justify-between gap-2">
                    <TeamAvatar member={teamMembers[3]} size="sm" />
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm">
                      Testing Head
                    </span>
                  </div>

                  <div>
                    <h5 className="font-black text-slate-900 dark:text-white text-base group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                      {teamMembers[3].name}
                    </h5>
                    <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                      Quality Assurance & Testing Lead
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    End-to-End System Testing, contest stress benchmarking, load reconciliation, and automated regression validation suites.
                  </p>

                  <div className="space-y-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>Contest Stress Benchmarking</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                      <span>End-to-End Regression Audits</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-navy-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 relative z-10">
                  {teamMembers[3].department}
                </div>
              </div>

            </div>
          </div>
        </div>
      )
    },
    {
      id: 'contact',
      number: '06',
      title: 'Governance & Operational Escalation Desks',
      shortTitle: 'Escalation Desks',
      icon: Mail,
      badge: 'Official Desks',
      badgeGradient: 'from-rose-600 via-orange-500 to-amber-500 text-white shadow-rose-500/25',
      summary: 'Direct support channels for handle corrections, security reports, and technical escalations.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            For operational inquiries, LeetCode handle corrections, contest escalations, or security reports, reach out directly to the designated official desks:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Technical Desk */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-navy-950 to-indigo-950 text-white border border-slate-800 shadow-xl flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Code className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                      Primary Engineering Desk
                    </span>
                    <h5 className="font-black text-white text-base">Technical & Platform Architecture</h5>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Direct technical escalation for handle corrections, contest synchronization verifications, and system bugs.
                </p>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1">
                  <div className="text-slate-400">Lead Platform Engineer:</div>
                  <div className="font-bold text-white">Mr. S. Nanthish (Lead Platform Architect)</div>
                  <div className="text-[11px] text-emerald-400">SLA Response Window: Within 24 Hours</div>
                </div>
              </div>

              <a 
                href="mailto:nanthishvaran17@gmail.com?subject=[Terms%20Operational%20Escalation]"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all border border-white/10"
              >
                <Mail className="w-4 h-4" />
                <span>Dispatch Technical Escalation • nanthishvaran17@gmail.com</span>
              </a>
            </div>

            {/* Institutional Governance Desk */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-navy-950 to-amber-950 text-white border border-slate-800 shadow-xl flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Institutional Governance Desk
                    </span>
                    <h5 className="font-black text-white text-base">Academic & Statutory Oversight</h5>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Academic conduct appeals, anti-cheat dispute escalation, and formal collegiate inquiries.
                </p>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1">
                  <div className="text-slate-400">Faculty Advisor & Institutional Head:</div>
                  <div className="font-bold text-white">Dr. S. Prabhu (Head of the Department)</div>
                  <div className="text-[11px] text-amber-300">Department of CSE (Cyber Security & IoT)</div>
                </div>
              </div>

              <div className="py-3 px-4 bg-amber-500/10 rounded-xl text-center text-xs font-bold text-amber-200 border border-amber-500/20">
                Nandha Engineering College (Autonomous), Erode - 638 052
              </div>
            </div>

          </div>
        </div>
      )
    }
  ], []);

  // Filter sections if search query is active
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.summary.toLowerCase().includes(q) ||
      s.shortTitle.toLowerCase().includes(q)
    );
  }, [sections, searchQuery]);

  // Ensure active section exists in filtered list
  useEffect(() => {
    if (filteredSections.length > 0 && !filteredSections.find(s => s.id === activeSection)) {
      setActiveSection(filteredSections[0].id);
    }
  }, [filteredSections, activeSection]);

  const activeData = sections.find(s => s.id === activeSection) || sections[0];
  const ActiveIcon = activeData.icon;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#070a12] text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300 pb-20 relative overflow-hidden">
      
      {/* Dynamic Cursor Ambient Glow */}
      <div 
        className="fixed w-[600px] h-[600px] rounded-full pointer-events-none z-0 blur-[140px] opacity-25 dark:opacity-20 bg-gradient-to-tr from-indigo-600 via-blue-500 to-purple-600 transition-transform duration-700 ease-out hidden lg:block"
        style={{
          transform: `translate(${mousePos.x - 300}px, ${mousePos.y - 300}px)`
        }}
      />

      {/* Reading Progress Top Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200/50 dark:bg-navy-900/60 z-50">
        <div 
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 transition-all duration-150"
          style={{ width: `${readingProgress}%` }}
        />
      </div>

      {/* Enterprise Executive Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-navy-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Left: Brand Identity & Breadcrumb */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button 
              onClick={handleNavigateBack}
              className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 transition-colors shrink-0"
              title="Return to platform"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Nandha Engineering College (Autonomous)
                </span>
                <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300 dark:bg-navy-700" />
                <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Trust Center
                </span>
              </div>
              <h1 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white truncate tracking-tight">
                Terms of Service & Operational Framework
              </h1>
            </div>
          </div>

          {/* Right: Quick Tools */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
              title="Print official document"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Print / PDF</span>
            </button>

            <button 
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors border border-indigo-200/50 dark:border-indigo-800/50"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 relative z-10">

        {/* Hero Banner: Enterprise Trust Standard */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-navy-950 to-indigo-950 text-white p-6 sm:p-10 lg:p-12 border border-slate-800 shadow-2xl overflow-hidden mb-10 group"
        >
          {/* Subtle Ambient Background Light */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            
            {/* Regulatory Status Badges with Subtle Floating Motion */}
            <div className="flex flex-wrap items-center gap-2">
              <motion.span 
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Institutional Code of Conduct Enforced
              </motion.span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Autonomous Academic Framework
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-slate-300 border border-white/10 backdrop-blur-sm">
                v3.2.0 Directive
              </span>
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Terms of Service & <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                Operational Framework
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Official institutional agreement establishing operational guidelines, contest integrity mandates, and zero-trust academic conduct policies for the Nandha LeetCode Intelligence Platform.
            </p>

            {/* Quick Metadata Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Effective Date: <strong>Current Academic Year</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-500" />
                <span>Audited By: <strong>CSE (Cyber Security & IoT)</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Status: <strong className="text-emerald-400">100% Authentic Roster</strong></span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Executive Highlights Grid ("Terms at a Glance" with Hover Spring Elevation) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          
          <motion.div 
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all space-y-2 group"
          >
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Authentic Identity 1:1</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Every profile is linked directly to verified college register numbers. Synthetic accounts are strictly prohibited.
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all space-y-2 group"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Sentinel Anti-Cheat</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Automated contest submission verification. Flagged bot scripts or code plagiarism result in immediate disqualification.
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl hover:border-purple-500/40 dark:hover:border-purple-500/40 transition-all space-y-2 group"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 w-fit group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <Building className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Institutional IP</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Platform telemetry, ranking algorithms, and contest engines are proprietary assets of Nandha Engineering College.
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all space-y-2 group"
          >
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 w-fit group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
              <Gavel className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Academic Recourse</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Uncompromising academic governance with direct escalation to Department Head and Academic Disciplinary Cell.
            </p>
          </motion.div>

        </div>

        {/* Live Filter / Search Bar */}
        <div className="mb-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search terms clauses (e.g., 'anti-cheat', 'OAuth', 'HOD', 'plagiarism')..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                Clear
              </button>
            )}
          </div>

          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 self-end sm:self-auto">
            <span>Showing {filteredSections.length} of {sections.length} policy sections</span>
          </div>
        </div>

        {/* Layout Grid: Sidebar Index + Section Details */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Navigation Sidebar with Silky layoutId Slider */}
          <nav className="lg:col-span-4 space-y-4 lg:sticky lg:top-28">
            <div className="bg-white dark:bg-navy-900/90 rounded-3xl border border-slate-200 dark:border-navy-800 p-2 shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Terms Index
                </span>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  {filteredSections.length} Active
                </span>
              </div>

              <div className="p-1.5 space-y-1">
                {filteredSections.map((s) => {
                  const Icon = s.icon;
                  const isActive = activeSection === s.id;
                  return (
                    <motion.button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative w-full text-left px-3.5 py-3 rounded-2xl transition-colors duration-200 flex items-center justify-between group overflow-hidden ${
                        isActive
                          ? 'text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-navy-800/60'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTermsSidebarIndicator"
                          className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-600/25"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-3 min-w-0">
                        <span className={`text-[11px] font-mono font-bold shrink-0 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {s.number}
                        </span>
                        <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 group-hover:text-indigo-500'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-bold text-xs sm:text-sm truncate">
                          {s.shortTitle}
                        </span>
                      </div>
                      <ChevronRight className={`relative z-10 w-3.5 h-3.5 shrink-0 transition-transform ${isActive ? 'text-white translate-x-0.5' : 'opacity-0 group-hover:opacity-60'}`} />
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Institutional Security Notice Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-navy-950 to-slate-950 text-white border border-slate-800 shadow-md space-y-2 hidden lg:block">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero-Trust Framework</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Platform telemetry is protected by Neon PostgreSQL encrypted at rest. We never store passwords or synthetic user records.
              </p>
            </div>
          </nav>

          {/* Right Main Content Area */}
          <section className="lg:col-span-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeData.id}
                initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -16, filter: 'blur(6px)' }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="bg-white dark:bg-navy-900/90 rounded-3xl border border-slate-200 dark:border-navy-800 p-6 sm:p-10 shadow-sm space-y-6"
              >
                {/* Section Header */}
                <div className="pb-6 border-b border-slate-100 dark:border-navy-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${activeData.badgeGradient} shrink-0 shadow-md`}>
                      <ActiveIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          SECTION {activeData.number}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-navy-700" />
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          {activeData.badge}
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {activeData.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {activeData.summary}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section Content */}
                <div className="pt-2">
                  {activeData.content}
                </div>

                {/* Section Footer Navigation */}
                <div className="pt-6 border-t border-slate-100 dark:border-navy-800 flex items-center justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Nandha Engineering College Directive • Section {activeData.number} of {sections.length}
                  </div>
                  <motion.button
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      const currentIndex = sections.findIndex(s => s.id === activeData.id);
                      const nextIndex = (currentIndex + 1) % sections.length;
                      setActiveSection(sections[nextIndex].id);
                      window.scrollTo({ top: 400, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                  >
                    <span>Next Section</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

              </motion.div>
            </AnimatePresence>
          </section>

        </div>

        {/* Institutional Seal & Sign-off Footer Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-16 p-8 sm:p-10 rounded-3xl bg-slate-100 dark:bg-navy-900/60 border border-slate-200 dark:border-navy-800 text-center space-y-4 hover:shadow-xl transition-all"
        >
          <motion.div 
            whileHover={{ rotate: 8, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 350, damping: 20 }}
            className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black shadow-inner cursor-pointer"
          >
            <Building className="w-7 h-7" />
          </motion.div>
          <div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white">
              Nandha Engineering College (Autonomous)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl mx-auto leading-relaxed">
              Affiliated to Anna University • Accredited by NAAC with &apos;A&apos; Grade & NBA • Erode - 638 052, Tamil Nadu, India.
              Governed under the Department of Computer Science and Engineering (Cyber Security & IoT).
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>Faculty Advisor: <strong>Dr. S. Prabhu</strong></span>
            <span>•</span>
            <span>Lead Architect: <strong>Mr. S. Nanthish</strong></span>
            <span>•</span>
            <span>Security Lead: <strong>Mr. Mohammed Affan J A</strong></span>
            <span>•</span>
            <span>QA & Testing Lead: <strong>Mr. B. Kavin</strong></span>
          </div>
        </motion.div>

      </main>
    </div>
  );
};
