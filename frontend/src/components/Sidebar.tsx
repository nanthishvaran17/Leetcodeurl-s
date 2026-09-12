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
  MessageSquare,
  Brain,
  Briefcase
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

  // FACULTY / STAFF MENTOR: Full Academic, Contest & Mentoring Access 
  const facultySections: NavSection[] = [
    {
      title: 'FACULTY & MENTOR PORTAL',
      items: [
        { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard, badge: 'MENTOR', badgeColor: 'indigo' },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'faculty-action-center', label: 'Faculty Action Center', icon: Zap, badge: 'LIVE', badgeColor: 'rose', pulse: true },
        { id: 'hr-candidate-finder', label: 'Placement & Hiring Portal', icon: Briefcase, badge: 'PLACEMENTS', badgeColor: 'purple' },
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

  // HOD: Command center + faculty tools; NO admin-only pages 
  const hodSections: NavSection[] = [
    {
      title: 'EXECUTIVE INTELLIGENCE',
      items: [
        { id: 'dashboard', label: 'HOD Dashboard', icon: LayoutDashboard },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'hod-command-center', label: 'HOD Command Center', icon: Cpu, badge: 'HOD', badgeColor: 'purple' },
        { id: 'faculty-action-center', label: 'Faculty Action Center', icon: Zap, badge: 'FACULTY', badgeColor: 'indigo' },
        { id: 'hr-candidate-finder', label: 'Placement & Hiring Portal', icon: Briefcase, badge: 'PLACEMENTS', badgeColor: 'purple' },
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

  // ADMIN / SUPER ADMIN: Full system access 
  const adminSections: NavSection[] = [
    {
      title: 'EXECUTIVE INTELLIGENCE',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'hod-command-center', label: 'HOD Command Center', icon: Cpu, badge: 'HOD', badgeColor: 'purple' },
        { id: 'faculty-action-center', label: 'Faculty Action Center', icon: Zap, badge: 'STAFF', badgeColor: 'indigo' },
        { id: 'hr-candidate-finder', label: 'Placement & Hiring Portal', icon: Briefcase, badge: 'PLACEMENTS', badgeColor: 'purple' },
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

  // STUDENT: Minimal access 
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
            className="relative w-[78vw] max-w-[285px] sm:max-w-[300px] h-full shadow-2xl bg-white dark:bg-navy-950 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] px-3.5 sm:px-4 flex flex-col justify-between overflow-hidden z-10 border-r border-slate-200 dark:border-navy-800"
          >
            {/* Region 1: Fixed Compact Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-navy-800/80 shrink-0 mb-0.5 relative z-10">
              <button 
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  if (window.innerWidth < 1024) onClose();
                }}
                className="flex items-center space-x-2.5 hover:opacity-85 transition-opacity text-left cursor-pointer min-w-0"
              >
                <CollegeLogo size={30} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">
                    Nandha Intelligence
                  </span>
                  <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 truncate">
                    Institutional Platform
                  </span>
                </div>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-900 cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center transition-colors shrink-0 ml-1"
                title="Close Navigation Menu"
                aria-label="Close Navigation Menu"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Region 2: Independently Scrollable Menu (Compact & Crisp) */}
            <div className="space-y-4 sm:space-y-4.5 overflow-y-auto pr-0.5 flex-1 min-h-0 custom-scrollbar overscroll-contain py-1.5 relative z-10">
              {sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-1.5">
                  <div className="px-1 pb-0.5 flex items-center justify-between">
                    <span className="text-[10px] sm:text-[10.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {section.title}
                    </span>
                    <span className="w-6 h-px bg-slate-200 dark:bg-navy-800 shrink-0" />
                  </div>

                  <nav className="space-y-1">
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
                          className={`w-full min-h-[46px] sm:min-h-[50px] flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-left cursor-pointer select-none transition-all duration-200 group active:scale-[0.98] ${
                            isActive
                              ? 'bg-brand-600 text-white font-bold shadow-sm shadow-brand-500/20 border border-brand-400/30'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/90 dark:hover:bg-navy-900/90 hover:text-brand-600 dark:hover:text-brand-400'
                          }`}
                        >
                          {/* Left Icon + Label */}
                          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1 pr-1.5 relative z-10">
                            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                              isActive 
                                ? 'bg-white/20 text-white shadow-inner scale-105' 
                                : 'bg-slate-100 dark:bg-navy-900 text-slate-500 dark:text-slate-400 group-hover:bg-brand-50 dark:group-hover:bg-navy-800 group-hover:text-brand-600 dark:group-hover:text-brand-300 shadow-xs'
                            }`}>
                              <Icon className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 transition-transform duration-200" />
                            </div>
                            <span className={`text-xs sm:text-[13px] tracking-normal leading-tight break-words transition-colors ${
                              isActive ? 'font-bold text-white' : 'font-semibold'
                            }`}>
                              {item.label}
                            </span>
                          </div>

                          {/* Badges & Consistent Right-Aligned Arrow */}
                          <div className="flex items-center space-x-1.5 shrink-0 ml-auto relative z-10">
                            {item.badge && (
                              <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider transition-all duration-200 shrink-0 inline-flex items-center gap-1 ${
                                isActive
                                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
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

                            <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-all duration-200 ${
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

            {/* Region 3: Fixed Mobile Action Bar (Theme & Auth) */}
            <div className="pt-2 border-t border-slate-100 dark:border-navy-800/80 shrink-0 relative z-10 flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleTheme}
                className="h-[42px] min-h-[42px] sm:h-[46px] sm:min-h-[46px] px-2.5 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-900 border border-slate-200/80 dark:border-navy-800 transition-all duration-200 flex items-center justify-center flex-1 font-bold text-xs shadow-xs cursor-pointer active:scale-95"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400 mr-1.5 shrink-0" /> : <Moon className="w-3.5 h-3.5 text-navy-700 dark:text-slate-300 mr-1.5 shrink-0" />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              {user && (
                <button
                  type="button"
                  onClick={logout}
                  className="h-[42px] min-h-[42px] sm:h-[46px] sm:min-h-[46px] px-2.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/40 transition-colors flex items-center justify-center flex-1 font-bold text-xs shadow-xs cursor-pointer active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>

            {/* Region 4: Fixed Minimal Sunday Session Window Card */}
            <div className="pt-1.5 shrink-0 relative z-10">
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900 dark:bg-navy-900 text-white border border-emerald-500/25 shadow-xs text-xs space-y-1 relative overflow-hidden group cursor-default max-h-[145px]">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center space-x-1.5 relative z-10">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-white text-[11px] sm:text-xs font-black tracking-wide">Sunday Session Window</span>
                </div>
                <p className="text-[10px] sm:text-[10.5px] text-slate-300 leading-snug font-medium relative z-10">
                  Official Window: <b className="text-emerald-400 font-bold">08:00 AM – 09:30 AM IST</b>.<br />
                  Continuous tracking & live sync.
                </p>
                <div className="pt-0.5 border-t border-slate-800/80 relative z-10">
                  <p className="text-[9px] text-slate-400 font-semibold tracking-wide">
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

export default Sidebar;
