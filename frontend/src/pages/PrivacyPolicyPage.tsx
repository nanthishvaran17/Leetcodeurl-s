import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Lock, Eye, Database, UserCheck, Search, Printer, Copy, Check, Mail, Code, Cpu, 
  CheckCircle2, Key, ShieldAlert, ChevronRight, Globe, Layers, Activity, Scale, 
  FileText, ArrowRight, ShieldCheck, Award, Sparkles, Trash2, ExternalLink, 
  Server, ShieldPlus, UserX, Clock, HardDrive, ArrowLeft, Download, Building, 
  Info, HelpCircle, AlertTriangle, FileLock2, Fingerprint, RefreshCw
} from 'lucide-react';
import { teamMembers, TeamAvatar } from './TermsOfServicePage';

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

export const PrivacyPolicyPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('collection');
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
      id: 'collection',
      number: '01',
      title: 'Information Ingestion & Telemetry Scope',
      shortTitle: 'Data Ingestion',
      icon: Database,
      badge: 'Data Intake Matrix',
      badgeGradient: 'from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-blue-500/25',
      summary: 'Explicit inventory of Google OAuth identity, public LeetCode telemetry, and academic credentials.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            The <strong className="text-slate-900 dark:text-white font-bold">Nandha LeetCode Intelligence Platform</strong> operates strictly on a principle of minimal data ingestion. When a student or faculty member accesses the platform, we collect only the necessary parameters required for academic benchmarking, leaderboard calculation, and contest verification.
          </p>

          {/* Data Intake Matrix Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/60 shadow-sm">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/80 text-slate-700 dark:text-slate-200 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200 dark:border-navy-700">
                <tr>
                  <th className="py-3 px-4">Data Classification</th>
                  <th className="py-3 px-4">Ingested Parameters</th>
                  <th className="py-3 px-4">Collection Vector</th>
                  <th className="py-3 px-4">Legal & Academic Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800 text-slate-600 dark:text-slate-300">
                <tr className="hover:bg-slate-50/50 dark:hover:bg-navy-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-500 shrink-0" />
                    Federated OAuth
                  </td>
                  <td className="py-3.5 px-4">Full Name, Institutional Email (<code className="text-xs bg-slate-100 dark:bg-navy-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">@nandhaengg.org</code>), Google Avatar URL</td>
                  <td className="py-3.5 px-4">Google Identity Services (OAuth 2.0 PKCE)</td>
                  <td className="py-3.5 px-4 font-medium">Student authentication without storing passwords</td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-navy-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-500 shrink-0" />
                    LeetCode Telemetry
                  </td>
                  <td className="py-3.5 px-4">Public handle, solved counts (Easy/Medium/Hard), global ranking, active contest rating</td>
                  <td className="py-3.5 px-4">Public LeetCode GraphQL Endpoints</td>
                  <td className="py-3.5 px-4 font-medium">Real-time leaderboard & placement readiness tracking</td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-navy-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-purple-500 shrink-0" />
                    Institutional Hierarchy
                  </td>
                  <td className="py-3.5 px-4">Department, Register Number, Year of Study, Assigned Faculty Mentor</td>
                  <td className="py-3.5 px-4">Verified College Master Roster</td>
                  <td className="py-3.5 px-4 font-medium">Accreditation metrics (NBA/NAAC) & department evaluation</td>
                </tr>
                <tr className="hover:bg-slate-50/50 dark:hover:bg-navy-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                    Contest Verification
                  </td>
                  <td className="py-3.5 px-4">Submission solve timestamps during official Sunday Contests (8:00 AM – 9:30 AM IST)</td>
                  <td className="py-3.5 px-4">Real-time Contest Sync Engine</td>
                  <td className="py-3.5 px-4 font-medium">Anti-cheat forensic auditing & ranking validation</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Enterprise Guarantees Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-navy-800/50 border border-blue-200/70 dark:border-blue-900/40 flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Authentic Roster Guarantee</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Every account is strictly mapped to authentic institutional register numbers. Falsified or synthetic student entities are systematically quarantined and prohibited.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-navy-800/50 border border-indigo-200/70 dark:border-indigo-900/40 flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
                <FileLock2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Zero Credential Custody</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  We never possess, see, or store passwords for LeetCode or Google. All communications utilize short-lived OAuth 2.0 PKCE cryptographic access tokens.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'purpose',
      number: '02',
      title: 'Lawful Processing Purpose & Usage Policy',
      shortTitle: 'Processing Purpose',
      icon: Eye,
      badge: 'Academic Directive',
      badgeGradient: 'from-purple-600 via-indigo-600 to-pink-500 text-white shadow-purple-500/25',
      summary: 'Strict educational skill indexing, institutional accreditation, and placement readiness profiling.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            In accordance with institutional guidelines and educational data compliance standards, student telemetry is processed exclusively for bona fide academic advancement:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {[
              {
                title: "Department Skill Indexing",
                desc: "Calculating department-wide coding metrics, problem consistency scores, and active problem difficulty ratios.",
                icon: Activity
              },
              {
                title: "Placement & Career Benchmarking",
                desc: "Matching student problem solve profiles with hiring eligibility criteria for elite product and service technology firms.",
                icon: Award
              },
              {
                title: "Autonomous NAAC / NBA Audits",
                desc: "Generating anonymized, institutionally compliant skill outcomes required for mandatory academic accreditation cycles.",
                icon: Building
              },
              {
                title: "Proactive Risk Detection",
                desc: "Identifying stagnant or decelerating solve patterns early so designated faculty mentors can provide targeted mentoring.",
                icon: ShieldAlert
              }
            ].map((item, idx) => {
              const ItemIcon = item.icon;
              return (
                <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                    <ItemIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Strict Prohibitions Box */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-200 dark:border-rose-900/40">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm mb-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Non-Commercialization Covenant</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              We maintain a zero-tolerance policy against data commercialization. We do not sell, rent, license, or monetize student telemetry. No behavioral ad trackers, marketing pixels, or third-party brokers have access to our systems.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'security',
      number: '03',
      title: 'Cryptographic Security & Storage Architecture',
      shortTitle: 'Security & Storage',
      icon: Lock,
      badge: 'Zero-Trust Architecture',
      badgeGradient: 'from-emerald-600 to-teal-500 text-white shadow-emerald-500/25',
      summary: 'Neon PostgreSQL encryption at rest, SQLite WAL caching, and automated token rotation.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            The platform is engineered upon an enterprise Zero-Trust posture inspired by modern cloud security benchmarks established by Google Cloud, AWS, and Cloudflare:
          </p>

          {/* Architecture Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit">
                <Server className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Neon PostgreSQL Lakebase</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Primary cloud records are housed in Neon serverless PostgreSQL, protected by AES-256 disk encryption at rest and isolated VPC networking.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
              <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 w-fit">
                <HardDrive className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">SQLite WAL In-Memory Cache</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                High-throughput contest leaderboards run on Write-Ahead Logging (WAL) memory layers to prevent data deadlocks and race conditions.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-2">
              <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 w-fit">
                <ShieldPlus className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">TLS 1.3 Transmission</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                All client-server exchanges use enforced HTTPS with TLS 1.3 protocol, protecting tokens and telemetry from man-in-the-middle attacks.
              </p>
            </div>
          </div>

          {/* Security Protocols List */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>Standard Enterprise Controls Enforced</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Short-lived JWT authentication with automatic session expiration
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Origin validation and CORS restrictions on all API surfaces
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Forensic tamper-evident contest submission hash logs
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Daily encrypted database snapshot backups with instant recovery
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'sharing',
      number: '04',
      title: 'Institutional Sharing & Access Boundaries',
      shortTitle: 'Sharing & Visibility',
      icon: UserCheck,
      badge: 'Access Governance',
      badgeGradient: 'from-amber-600 via-orange-500 to-yellow-500 text-white shadow-amber-500/25',
      summary: 'Granular visibility tiers separating public leaderboards, faculty oversight, and external boundaries.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            Telemetry is segregated into three distinct boundary zones to uphold student privacy while fostering competitive coding excellence:
          </p>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5" /> Zone 1: Public Campus Leaderboard
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Campus & Kiosk Display</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Visible to logged-in peers: Student Name, Register Number, Department, Total Solved Count, and Global Contest Rank.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 w-fit shrink-0">
                Peer Visible
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  <Building className="w-3.5 h-3.5" /> Zone 2: Faculty & HOD Oversight
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">Academic Mentorship Portal</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Visible to assigned advisors: Detailed growth velocity, weekly problem activity timelines, contest audit logs, and attendance telemetry.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 w-fit shrink-0">
                Faculty Only
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  <UserX className="w-3.5 h-3.5" /> Zone 3: External Commercial Brokers
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">External Third Parties & Ad Networks</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Zero access. Student profiles and performance metrics are strictly air-gapped from external commercial entities.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 w-fit shrink-0">
                Strictly Prohibited
              </span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'deletion',
      number: '05',
      title: 'Google Play & GDPR Account Deletion Rights',
      shortTitle: 'Account Deletion',
      icon: Trash2,
      badge: 'Google Play Compliant',
      badgeGradient: 'from-rose-600 via-pink-600 to-rose-700 text-white shadow-rose-500/25',
      summary: 'Unconditional right to delete account, purge personal telemetry, and institutional retention terms.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            In compliance with the <strong className="text-slate-900 dark:text-white font-bold">Google Play Store User Data Policy</strong>, India&apos;s Digital Personal Data Protection (DPDP) Act 2023, and global GDPR guidelines, students maintain the unconditional right to erase their account and associated identity records.
          </p>

          {/* Deletion Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-3">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Permanently Purged Within 24 Hours</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>Full name, email address, phone number, and profile bio</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>Google OAuth federated tokens and active device session records</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>WebAuthn passkey public keys & local biometric registration references</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>Push notification FCM tokens and device identifiers</span>
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm">
                <Building className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Autonomous Accreditation Retention</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                As Nandha Engineering College is an autonomous accredited educational institution, problem submission statistics and contest metrics are decoupled from your identity and retained in strictly anonymized form for mandatory NBA/NAAC academic accreditation audits.
              </p>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-navy-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Identity dissociation ensures your personal name is never associated with archived historical contest logs.
              </div>
            </div>
          </div>

          {/* Action Center Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-navy-900 to-slate-950 text-white border border-slate-800 space-y-4">
            <div>
              <h4 className="font-bold text-white text-base">How to Exercise Account Deletion</h4>
              <p className="text-xs text-slate-400 mt-0.5">Two guaranteed pathways for instantaneous or verified deletion processing:</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Method A: Self-Serve In-App</span>
                <p className="text-xs text-slate-300">
                  Open application navigation: <strong>Settings → Security → Danger Zone → Delete My Account</strong>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Method B: Direct Dispatch</span>
                <p className="text-xs text-slate-300">
                  Email the Technical Desk at <a href="mailto:nanthishvaran17@gmail.com?subject=Account%20Deletion%20Request" className="text-blue-400 font-bold underline">nanthishvaran17@gmail.com</a> with your register number.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'telemetry',
      number: '06',
      title: 'Cookies, Client Caching & Biometrics Policy',
      shortTitle: 'Cookies & Passkeys',
      icon: Fingerprint,
      badge: 'Client Privacy',
      badgeGradient: 'from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-cyan-500/25',
      summary: 'Zero third-party tracking cookies, localized session caching, and secure enclave passkeys.',
      content: (
        <div className="space-y-6">
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base">
            The platform does not deploy third-party advertising or cross-site tracking cookies. We utilize local client-side storage solely to sustain system operations:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-1.5">
              <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                Session Storage
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">OAuth JWT Access Token</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Stores your cryptographic session token. Automatically invalidated upon explicit sign-out or session expiration.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-1.5">
              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Local Storage
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">UI & Theme Preferences</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Retains dark/light visual theme, sidebar dock position, and active leaderboard filter preferences.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-700 shadow-sm space-y-1.5">
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Hardware Enclave
              </div>
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Passkey / WebAuthn</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Biometric data (Fingerprint / FaceID) never touches our servers. The device hardware enclave verifies identity locally.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'governance',
      number: '07',
      title: 'Institutional Governance & Engineering Desks',
      shortTitle: 'Governance & Team',
      icon: Cpu,
      badge: 'Institutional Council',
      badgeGradient: 'from-amber-500 via-indigo-600 to-purple-600 text-white shadow-indigo-500/25',
      summary: 'Executive cybersecurity council, forensic anti-cheat leadership, full-stack platform architecture, and institutional oversight.',
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
              Data privacy protocols, zero-trust token encryption, and telemetry protections are governed under autonomous institutional supervision at <strong className="text-slate-900 dark:text-white font-bold">Nandha Engineering College (Autonomous)</strong>. Oversight is jointly administered by the Department Head and the appointed Core Engineering Directorate.
            </p>
          </div>

          {/* Faculty Advisor Hero Executive Card (Dr. S. Prabhu) */}
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

          {/* Core Engineering Trio - Corporate Security Directorate Style */}
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

          {/* Three Dedicated Enterprise Escalation Desks (AWS & Google Cloud Standard) */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
              Institutional Contact & Rapid Escalation Desks
            </h4>

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
                    Direct technical escalation for data export requests, account deletion execution, Neon database verification, and platform telemetry audits.
                  </p>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs space-y-1">
                    <div className="text-slate-400">Lead Platform Engineer:</div>
                    <div className="font-bold text-white">Mr. S. Nanthish (Lead Platform Architect)</div>
                    <div className="text-[11px] text-emerald-400">SLA Response Window: Within 24 Hours</div>
                  </div>
                </div>

                <a 
                  href="mailto:nanthishvaran17@gmail.com?subject=[Data%20Privacy%20Directive%20Escalation]"
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
                    Institutional ethics oversight, statutory data compliance (DPDP Act 2023), and formal accreditation audits (NAAC / NBA).
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

          {/* Cryptographic Attestation & Directive Seal (AWS Trust Center Style) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 text-white border-2 border-indigo-500/30 space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  Official Cryptographic Governance Attestation
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                REF: NEC-PRIV-2026-CSE-IOT-AUTH
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This directive certifies that the <strong className="text-white">Nandha LeetCode Intelligence Platform</strong> operates under an uncompromising Zero-Trust architecture. We guarantee 100% data authenticity with an authentic student roster, zero stored passwords, zero synthetic records, and full compliance with the Google Play Store User Data Policy and DPDP Act 2023.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Digitally Sealed & Active for Academic Session 2026</span>
              </div>
              <div className="font-semibold text-slate-300">
                Signed: Dr. S. Prabhu (HOD) & Mr. S. Nanthish (Lead Platform Architect)
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
                Privacy Directive & Data Governance
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
                Google Play Data Safety Certified
              </motion.span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                DPDP Act 2023 Aligned
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/10 text-slate-300 border border-white/10 backdrop-blur-sm">
                v3.2.0 Directive
              </span>
            </div>

            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Enterprise Privacy & <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                Data Protection Directive
              </span>
            </h2>

            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Official institutional statement detailing cryptographic data protection, zero-password federated authentication, and unconditional deletion rights governing the Nandha LeetCode Intelligence Platform.
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

        {/* Executive Highlights Grid ("Privacy at a Glance" with Hover Spring Elevation) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          
          <motion.div 
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all space-y-2 group"
          >
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 w-fit group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
              <Key className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Zero Password Custody</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Google OAuth 2.0 PKCE federated login. Passwords never touch our servers or databases.
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl hover:border-purple-500/40 dark:hover:border-purple-500/40 transition-all space-y-2 group"
          >
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 w-fit group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
              <UserX className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Zero Commercialization</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Non-profit academic infrastructure. Zero advertising trackers, data brokers, or monetization.
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl hover:border-emerald-500/40 dark:hover:border-emerald-500/40 transition-all space-y-2 group"
          >
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Neon AES-256 Storage</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Encrypted at rest on Neon PostgreSQL cloud clusters with isolated VPC boundaries and TLS 1.3.
            </p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -6, scale: 1.015 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="p-5 rounded-2xl bg-white dark:bg-navy-900/80 border border-slate-200 dark:border-navy-800 shadow-sm hover:shadow-xl hover:border-rose-500/40 dark:hover:border-rose-500/40 transition-all space-y-2 group"
          >
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 w-fit group-hover:scale-110 group-hover:bg-rose-600 group-hover:text-white transition-all duration-300">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Self-Serve Deletion</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Instant in-app account erasure & telemetry purge meeting Google Play Data Safety standards.
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
              placeholder="Search privacy topics (e.g., 'deletion', 'OAuth', 'retention', 'Neon')..."
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
                  Directive Index
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
                          layoutId="activeSidebarIndicator"
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
                <span>Zero-Trust Infrastructure</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Engineered with Neon PostgreSQL and SQLite WAL isolated caching. Passwords are never ingested, and telemetry is authenticated via signed JWT tokens.
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
