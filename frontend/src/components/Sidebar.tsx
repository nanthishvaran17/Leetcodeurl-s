import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, LogOut, LayoutDashboard, Users, BarChart3, CheckCircle2, FileSpreadsheet, Settings, ShieldAlert, Globe, Layers, Calendar, Clock, TrendingUp, Activity, ChevronRight, Cpu, Compass, AlertOctagon, Download, Radio, X, MessageSquare, Brain, Briefcase, User, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CollegeLogo } from './CollegeLogo';
import { SignOutConfirmModal } from './SignOutConfirmModal';
import { getApiUrl } from '../services/api';
import { isAdminOtpVerified } from '../utils/adminOtpAuth';
import { useScrollLock } from '../hooks/useScrollLock';
import { prefetchRoute } from '../utils/pagePrefetch';

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
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const touchStartXRef = React.useRef(0);
  const touchStartYRef = React.useRef(0);
  const roleClean = (user?.role || '').trim().toLowerCase();
  const isPrincipalOrManagement = ['principal', 'management', 'director'].includes(roleClean);
  const isFaculty = ['staff', 'faculty', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(roleClean);
  const isHOD = ['hod', 'department hod', 'department_hod', 'placement coordinator'].includes(roleClean);
  const isAdmin = ['admin', 'administrator', 'super admin', 'super_admin'].includes(roleClean);
  const isStudent = roleClean === 'student';

  useScrollLock(isOpen && typeof window !== 'undefined' && window.innerWidth < 1024);

  // PRINCIPAL & MANAGEMENT: Institutional Command, All HODs oversight, Faculty actions, Master reports
  const executiveSections: NavSection[] = [
    {
      title: 'EXECUTIVE COMMAND',
      items: [
        { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, badge: 'CAMPUS', badgeColor: 'indigo' },
        { id: 'hod-command-center', label: 'Department Leadership', icon: Cpu, badge: 'ALL DEPTS', badgeColor: 'purple' },
        { id: 'faculty-action-center', label: 'Faculty & Staff Portal', icon: Activity, badge: 'STAFF', badgeColor: 'rose', pulse: true },
        { id: 'hr-candidate-finder', label: 'Placement Portal', icon: Briefcase, badge: 'HIRE', badgeColor: 'purple' },
        { id: 'growth', label: 'Growth Intelligence', icon: TrendingUp },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
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
        { id: 'reports', label: 'Executive Reports & Export', icon: FileSpreadsheet, badge: 'EXECUTIVE', badgeColor: 'emerald' },
        { id: 'public', label: 'Public Shareable View', icon: Globe },
        { id: 'account-settings', label: 'Account Settings', icon: User },
      ]
    }
  ];

  // FACULTY / STAFF MENTOR: Full Academic, Contest & Mentoring Access 
  const facultySections: NavSection[] = [
    {
      title: 'FACULTY & MENTOR PORTAL',
      items: [
        { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard, badge: 'MENTOR', badgeColor: 'indigo' },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'faculty-action-center', label: 'Faculty Portal', icon: Activity, badge: 'LIVE', badgeColor: 'rose', pulse: true },
        { id: 'hr-candidate-finder', label: 'Placement Portal', icon: Briefcase, badge: 'HIRE', badgeColor: 'purple' },
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
      title: 'REPORTS & PREFERENCES',
      items: [
        { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
        { id: 'public', label: 'Public Shareable View', icon: Globe },
        { id: 'account-settings', label: 'Account Settings', icon: User },
      ]
    }
  ];

  // HOD: Command center + faculty tools; NO admin-only pages 
  const hodSections: NavSection[] = [
    {
      title: 'EXECUTIVE INTELLIGENCE',
      items: [
        { id: 'dashboard', label: 'Department Leadership', icon: LayoutDashboard },
        { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 'NEW', badgeColor: 'indigo' },
        { id: 'faculty-action-center', label: 'Faculty Portal', icon: Activity, badge: 'FACULTY', badgeColor: 'indigo' },
        { id: 'hr-candidate-finder', label: 'Placement Portal', icon: Briefcase, badge: 'HIRE', badgeColor: 'purple' },
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
      title: 'REPORTS & PREFERENCES',
      items: [
        { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
        { id: 'public', label: 'Public Shareable View', icon: Globe },
        { id: 'account-settings', label: 'Account Settings', icon: User },
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
        { id: 'hod-command-center', label: 'Department Leadership', icon: Cpu, badge: 'HOD', badgeColor: 'purple' },
        { id: 'faculty-action-center', label: 'Faculty Portal', icon: Activity, badge: 'STAFF', badgeColor: 'indigo' },
        { id: 'hr-candidate-finder', label: 'Placement Portal', icon: Briefcase, badge: 'HIRE', badgeColor: 'purple' },
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
        { id: 'account-settings', label: 'Account Settings', icon: User },
        { id: 'settings', label: 'Admin Settings', icon: Settings },
        { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
        ...(isAdmin
          ? [{ id: 'dev-studio', label: 'Developer Studio', icon: Cpu, badge: 'LIVE' as const, badgeColor: 'emerald' as const }]
          : []),
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
        { id: 'account-settings', label: 'Account Settings', icon: User },
      ]
    }
  ];

  const sections: NavSection[] = isAdmin
    ? adminSections
    : isPrincipalOrManagement
    ? executiveSections
    : isHOD
    ? hodSections
    : isFaculty
    ? facultySections
    : studentSections;


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
            className="fixed inset-0 bg-navy-950/65 backdrop-blur-md"
            onClick={onClose}
          />
          
          {/* Drawer with Native Smooth Touch-Aware Navigation */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            onTouchStart={(e) => {
              touchStartXRef.current = e.touches[0].clientX;
              touchStartYRef.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;
              const deltaY = Math.abs(touchStartYRef.current - e.changedTouches[0].clientY);
              if (deltaX > 70 && deltaX > deltaY * 1.5) {
                onClose();
              }
            }}
            className="relative w-[88vw] max-w-[335px] sm:max-w-[350px] h-full shadow-2xl bg-white/95 dark:bg-navy-950/95 backdrop-blur-2xl pt-[max(0.85rem,env(safe-area-inset-top,0.85rem))] pb-[max(0.85rem,env(safe-area-inset-bottom,0.85rem))] px-4 sm:px-4.5 flex flex-col justify-between overflow-hidden z-10 border-r border-slate-200/80 dark:border-white/[0.08]"
          >
            {/* Region 1: Fixed Header with clean breathing room */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-white/[0.06] shrink-0 mb-1.5 relative z-10">
              <button 
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  onClose();
                }}
                className="flex items-center space-x-3 p-1 -m-1 rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/[0.05] active:scale-[0.98] transition-all text-left cursor-pointer min-w-0 group"
                title="Return to Institutional Dashboard"
              >
                <div className="shrink-0 transition-transform group-hover:scale-105 p-1 rounded-xl bg-slate-100/60 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.08]">
                  <CollegeLogo size={32} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-[13px] font-extrabold text-slate-900 dark:text-white uppercase tracking-wider truncate leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors font-display">
                    Nandha Intelligence
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] sm:text-[10.5px] font-bold tracking-wider text-brand-600 dark:text-brand-400 uppercase truncate">
                      Institutional Platform
                    </span>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.06] cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center transition-all shrink-0 ml-1 active:scale-95 border border-transparent hover:border-slate-200/60 dark:hover:border-white/10"
                title="Close Navigation Menu"
                aria-label="Close Navigation Menu"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Region 2: Independently Scrollable Menu with tight, harmonious spacing */}
            <div
              className="space-y-4 sm:space-y-5 overflow-y-auto pr-1 flex-1 min-h-0 pt-2 pb-1.5 relative z-10 touch-pan-y"
              style={{
                WebkitOverflowScrolling: 'touch',
                overscrollBehaviorY: 'contain'
              }}
            >
              {sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-2">
                  <div className="px-2 pb-0.5 flex items-center justify-between">
                    <span className="text-[10.5px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      {section.title}
                    </span>
                    <span className="w-8 h-px bg-slate-200 dark:bg-white/[0.08] shrink-0" />
                  </div>

                  <nav className="space-y-1.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => prefetchRoute(item.id)}
                          onTouchStart={() => prefetchRoute(item.id)}
                          onClick={() => {
                            if (item.id === 'ai-copilot') {
                              window.dispatchEvent(new CustomEvent('open_ai_widget'));
                              if (window.innerWidth < 1024) onClose();
                              return;
                            }
                            setActiveTab(item.id);
                            if (window.innerWidth < 1024) onClose();
                          }}
                          className={`w-full min-h-[42px] sm:min-h-[44px] flex items-center justify-between px-3 py-2 sm:py-2.5 rounded-xl text-left cursor-pointer select-none transition-all duration-150 group active:scale-[0.98] ${
                            isActive
                              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold shadow-md shadow-brand-500/20'
                              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          {/* Left Icon + Label */}
                          <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2 relative z-10">
                            <div className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors ${
                              isActive 
                                ? 'text-white' 
                                : 'text-slate-400 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400'
                            }`}>
                              <Icon className="w-4 h-4 shrink-0" />
                            </div>
                            <span className={`text-[12.5px] sm:text-[13px] tracking-tight leading-tight whitespace-nowrap truncate transition-colors ${
                              isActive ? 'font-bold text-white' : 'font-medium'
                            }`}>
                              {item.label}
                            </span>
                          </div>

                          {/* Badges & Consistent Right-Aligned Arrow */}
                          <div className="flex items-center space-x-1.5 shrink-0 ml-auto relative z-10">
                            {item.badge && (
                              <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider transition-all duration-150 shrink-0 inline-flex items-center gap-1 ${
                                isActive
                                  ? 'bg-white/20 text-white font-bold'
                                  : item.badgeColor === 'purple'
                                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                                  : item.badgeColor === 'indigo'
                                  ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                                  : item.badgeColor === 'rose'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
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

                            <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-all duration-150 ${
                              isActive
                                ? 'text-white/80 opacity-100 translate-x-0.5'
                                : 'opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5 text-slate-400 dark:text-slate-500'
                            }`} />
                          </div>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              ))}
            </div>

            {/* Region 3: Clean, Compact Fixed Footer Dock (Theme & Auth + Session Window) */}
            <div className="shrink-0 relative z-10 border-t border-slate-200/80 dark:border-white/[0.08] pt-2.5 space-y-2 mt-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="h-[38px] px-3 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] transition-all duration-150 flex items-center justify-center flex-1 font-semibold text-xs cursor-pointer active:scale-95"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400 mr-2 shrink-0" /> : <Moon className="w-3.5 h-3.5 text-navy-700 dark:text-slate-300 mr-2 shrink-0" />}
                  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                {user && (
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)}
                    className="h-[38px] px-3 rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 transition-colors flex items-center justify-center flex-1 font-semibold text-xs cursor-pointer active:scale-95"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-2 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>

              {/* Sunday Session Window Card */}
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-900 dark:bg-navy-900 text-white border border-emerald-500/25 shadow-xs text-xs space-y-1 relative overflow-hidden group cursor-default">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-12 h-12 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                <div className="flex items-center space-x-2 relative z-10">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-white text-[11px] sm:text-xs font-black tracking-wide">Sunday Session Window</span>
                </div>
                <p className="text-[10px] sm:text-[10.5px] text-slate-300 leading-snug font-medium relative z-10">
                  Official Window: <b className="text-emerald-400 font-bold">08:00 AM – 09:30 AM IST</b>.<br />
                  Continuous tracking & live sync.
                </p>
                <div className="pt-1 border-t border-slate-800/80 relative z-10">
                  <p className="text-[9px] text-slate-400 font-semibold tracking-wide">
                    Nandha Engineering College • Erode
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sign Out Confirmation Modal */}
          <SignOutConfirmModal
            isOpen={showLogoutConfirm}
            onClose={() => setShowLogoutConfirm(false)}
            onConfirm={() => {
              if (onClose) onClose();
              logout();
            }}
            user={user}
          />
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default Sidebar;
