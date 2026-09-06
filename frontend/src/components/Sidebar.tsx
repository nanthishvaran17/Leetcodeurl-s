import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun,
  Moon,
  LogOut,
  LayoutDashboard,
  Users,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  Globe,
  Layers,
  Calendar,
  TrendingUp,
  Activity,
  ChevronRight,
  Cpu,
  Zap,
  Sparkles,
  Compass,
  AlertOctagon,
  Download,
  Flame,
  Radio,
  X,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CollegeLogo } from './CollegeLogo';
import { getApiUrl } from '../services/api';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: 'amber' | 'emerald' | 'indigo' | 'purple' | 'rose';
  pulse?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const roleClean = (user?.role || '').trim().toLowerCase();
  const isFaculty = ['staff', 'faculty', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(roleClean);
  const isHOD = ['hod', 'department hod', 'department_hod'].includes(roleClean);
  const isAdmin = ['admin', 'administrator', 'super admin', 'super_admin'].includes(roleClean);
  const isStudent = roleClean === 'student';

  React.useEffect(() => {
    if (isOpen && window.innerWidth < 1024) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // ── FACULTY / STAFF MENTOR: Full Academic, Contest & Mentoring Access ────────
  const facultySections: NavSection[] = [
    {
      title: 'FACULTY & MENTOR PORTAL',
      items: [
        { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard, badge: 'MENTOR', badgeColor: 'indigo' },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'faculty-action-center', label: 'Faculty Action Center', icon: Zap, badge: 'LIVE', badgeColor: 'rose', pulse: true },
        { id: 'growth', label: 'Growth Intelligence', icon: TrendingUp },
      ]
    },
    {
      title: 'ACADEMIC & CONTEST TRACKING',
      items: [
        { id: 'departments', label: 'Departments & Sections', icon: Layers },
        { id: 'weekly-contest', label: 'Weekly Contest Tracker', icon: Calendar, pulse: true, badge: 'LIVE', badgeColor: 'emerald' },
        { id: 'integrity-monitor', label: 'Contest Integrity Monitor', icon: ShieldAlert, badge: 'DUAL-ID', badgeColor: 'rose' },
        { id: 'students', label: 'Student Leaderboard', icon: Users },
        { id: 'compare', label: 'Student Comparison', icon: BarChart3 },
        { id: 'quality', label: 'Data Quality Board', icon: CheckCircle2 },
        { id: 'data-issues', label: 'Student Data Issues', icon: AlertOctagon, badge: 'RECOVERY', badgeColor: 'rose' },
      ]
    },
    {
      title: 'REPORTS & EXPORT',
      items: [
        { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
        { id: 'public', label: 'Public Shareable View', icon: Globe },
      ]
    }
  ];

  // ── HOD: Command center + faculty tools; NO admin-only pages ──────────────
  const hodSections: NavSection[] = [
    {
      title: 'EXECUTIVE INTELLIGENCE',
      items: [
        { id: 'dashboard', label: 'HOD Dashboard', icon: LayoutDashboard },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'hod-command-center', label: 'HOD Command Center', icon: Cpu, badge: 'HOD', badgeColor: 'purple' },
        { id: 'faculty-action-center', label: 'Faculty Action Center', icon: Zap, badge: 'FACULTY', badgeColor: 'indigo' },
        { id: 'growth', label: 'Growth Intelligence', icon: TrendingUp },
      ]
    },
    {
      title: 'ACADEMIC & CONTEST TRACKING',
      items: [
        { id: 'departments', label: 'Departments & Sections', icon: Layers },
        { id: 'weekly-contest', label: 'Weekly Contest Tracker', icon: Calendar, pulse: true, badge: 'LIVE', badgeColor: 'emerald' },
        { id: 'integrity-monitor', label: 'Contest Integrity Monitor', icon: ShieldAlert, badge: 'DUAL-ID', badgeColor: 'rose' },
        { id: 'students', label: 'Student Leaderboard', icon: Users },
        { id: 'compare', label: 'Student Comparison', icon: BarChart3 },
        { id: 'quality', label: 'Data Quality Board', icon: CheckCircle2 },
        { id: 'data-issues', label: 'Student Data Issues', icon: AlertOctagon, badge: 'RECOVERY', badgeColor: 'rose' },
      ]
    },
    {
      title: 'REPORTS',
      items: [
        { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
        { id: 'public', label: 'Public Shareable View', icon: Globe },
      ]
    }
  ];

  // ── ADMIN / SUPER ADMIN: Full system access ─────────────────────────────
  const adminSections: NavSection[] = [
    {
      title: 'EXECUTIVE INTELLIGENCE',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'hod-command-center', label: 'HOD Command Center', icon: Cpu, badge: 'HOD', badgeColor: 'purple' },
        { id: 'faculty-action-center', label: 'Faculty Action Center', icon: Zap, badge: 'STAFF', badgeColor: 'indigo' },
        { id: 'growth', label: 'Growth Intelligence', icon: TrendingUp },
      ]
    },
    {
      title: 'ACADEMIC & CONTEST TRACKING',
      items: [
        { id: 'departments', label: 'Departments & Sections', icon: Layers },
        { id: 'weekly-contest', label: 'Weekly Contest Tracker', icon: Calendar, pulse: true, badge: 'LIVE', badgeColor: 'emerald' },
        { id: 'students', label: 'Student Leaderboard', icon: Users },
        { id: 'compare', label: 'Student Comparison', icon: BarChart3 },
        { id: 'quality', label: 'Data Quality Board', icon: CheckCircle2 },
        { id: 'data-issues', label: 'Student Data Issues', icon: AlertOctagon, badge: 'RECOVERY', badgeColor: 'rose' },
      ]
    },
    {
      title: 'INSTITUTIONAL OPERATIONS',
      items: [
        { id: 'system-health', label: 'Institutional Operations', icon: Activity, badge: 'PROD', badgeColor: 'emerald' },
        { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
        { id: 'public', label: 'Public Shareable View', icon: Globe },
        { id: 'settings', label: 'Admin Settings', icon: Settings },
        { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
      ]
    }
  ];

  // ── STUDENT: Minimal access ───────────────────────────────────────
  const studentSections: NavSection[] = [
    {
      title: 'MY PORTAL',
      items: [
        { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'public', label: 'Public Leaderboard', icon: Globe },
      ]
    }
  ];

  const sections: NavSection[] = isFaculty
    ? facultySections
    : isHOD
    ? hodSections
    : isStudent
    ? studentSections
    : adminSections;


  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-navy-950/75 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 32 }}
            className="relative w-[88vw] max-w-[340px] sm:max-w-[360px] h-full shadow-2xl bg-white dark:bg-navy-950 pt-[max(1.25rem,env(safe-area-inset-top,1.25rem))] pb-[max(1.25rem,env(safe-area-inset-bottom,1.25rem))] px-5 sm:px-6 flex flex-col justify-between overflow-hidden z-10 border-r border-slate-200 dark:border-navy-800"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-navy-800/80 shrink-0 mb-3 relative z-10">
              <button 
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  if (window.innerWidth < 1024) onClose();
                }}
                className="flex items-center space-x-3 hover:opacity-85 transition-opacity text-left cursor-pointer"
              >
                <CollegeLogo size={36} />
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Nandha Intelligence
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    Institutional Platform
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-900 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
                title="Close Navigation Menu"
                aria-label="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* ── Navigation Groups ── */}
            <div className="space-y-5 overflow-y-auto pr-1 flex-1 min-h-0 custom-scrollbar overscroll-contain py-1 relative z-10">
              {sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-2">
                  <div className="px-1 pt-1 pb-1 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {section.title}
                    </span>
                    <span className="w-10 h-px bg-slate-200 dark:bg-navy-800 shrink-0" />
                  </div>

                  <nav className="space-y-1.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(item.id);
                            if (window.innerWidth < 1024) onClose();
                          }}
                          className={`relative w-full min-h-[48px] flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-left cursor-pointer select-none transition-all duration-200 group transform active:scale-[0.98] ${
                            isActive
                              ? 'bg-brand-600 text-white font-bold shadow-lg shadow-brand-500/25 border border-brand-400/30'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/90 dark:hover:bg-navy-900/90 hover:text-brand-600 dark:hover:text-brand-400'
                          }`}
                        >
                          {/* Active Left Indicator Notch */}
                          {isActive && (
                            <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-r-full shadow-sm z-20" />
                          )}

                          {/* Left Icon + Label */}
                          <div className="flex items-center space-x-3.5 min-w-0 flex-1 pr-2 relative z-10">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                              isActive 
                                ? 'bg-white/20 text-white shadow-inner scale-105' 
                                : 'bg-slate-100 dark:bg-navy-900 text-slate-500 dark:text-slate-400 group-hover:bg-brand-50 dark:group-hover:bg-navy-800 group-hover:text-brand-600 dark:group-hover:text-brand-300 shadow-sm'
                            }`}>
                              <Icon className="w-5 h-5 shrink-0 transition-transform duration-200" />
                            </div>
                            <span className={`text-[13px] sm:text-sm tracking-normal leading-snug break-words transition-colors ${
                              isActive ? 'font-bold text-white' : 'font-semibold'
                            }`}>
                              {item.label}
                            </span>
                          </div>

                          {/* Badges & Arrow */}
                          <div className="flex items-center space-x-2 shrink-0 relative z-10">
                            {item.badge && (
                              <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider transition-all duration-200 shrink-0 inline-flex items-center gap-1.5 ${
                                isActive
                                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                                  : item.badgeColor === 'purple'
                                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                  : item.badgeColor === 'indigo'
                                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                                  : item.badgeColor === 'rose'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              }`}>
                                {item.pulse && (
                                  <span className="flex h-1.5 w-1.5 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                                  </span>
                                )}
                                <span>{item.badge}</span>
                              </span>
                            )}

                            <ChevronRight className={`w-4 h-4 shrink-0 transition-all duration-200 ${
                              isActive
                                ? 'text-white/90 opacity-100 translate-x-0.5'
                                : 'opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 text-slate-400 dark:text-slate-500'
                            }`} />
                          </div>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* ── Mobile Action Bar (Theme & Auth) ── */}
            <div className="sm:hidden pt-3 mt-2 border-t border-slate-100 dark:border-navy-800/80 shrink-0 relative z-10 flex items-center gap-2.5">
              <button
                type="button"
                onClick={toggleTheme}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-900 border border-slate-200/80 dark:border-navy-800 transition-all duration-200 flex items-center justify-center flex-1 font-bold text-xs shadow-sm cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400 mr-2 shrink-0" /> : <Moon className="w-4 h-4 text-navy-700 dark:text-slate-300 mr-2 shrink-0" />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              {user && (
                <button
                  type="button"
                  onClick={logout}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/40 transition-colors flex items-center justify-center flex-1 font-bold text-xs shadow-sm cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2 shrink-0" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>

            {/* ── Bottom Institution Footer Card ── */}
            <div className="pt-3 mt-2 border-t border-slate-100 dark:border-navy-800/80 shrink-0 relative z-10">
              <div className="p-4 rounded-2xl bg-slate-900 dark:bg-navy-900 text-white border border-emerald-500/25 shadow-lg text-xs space-y-2 relative overflow-hidden group cursor-default">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center space-x-2 relative z-10">
                  <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-white text-xs font-black tracking-wide">Sunday Session Window</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed font-medium relative z-10">
                  Official Window: <b className="text-emerald-400 font-bold">08:00 AM – 09:30 AM IST</b>.<br />
                  Continuous LeetCode tracking & live sync.
                </p>
                <div className="pt-1.5 border-t border-slate-800/80 relative z-10">
                  <p className="text-[10px] text-slate-400 font-semibold tracking-wide">
                    Nandha Engineering College • Erode
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
