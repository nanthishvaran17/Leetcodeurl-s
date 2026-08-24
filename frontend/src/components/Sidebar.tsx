import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  Flame,
  Radio,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CollegeLogo } from './CollegeLogo';

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
  const { user } = useAuth();
  const roleClean = (user?.role || '').trim().toLowerCase();
  const isStaff = roleClean === 'staff' || roleClean === 'faculty';

  const sections: NavSection[] = isStaff
    ? [
        {
          title: 'MENTORING WORKSPACE',
          items: [
            { id: 'dashboard', label: 'My Mentoring Dashboard', icon: LayoutDashboard, badge: 'MY MENTOR', badgeColor: 'indigo' },
            { id: 'faculty-action-center', label: 'Faculty Action Center', icon: Zap, badge: 'STAFF', badgeColor: 'indigo' },
            { id: 'weekly-contest', label: 'Weekly Contest Tracker', icon: Calendar, pulse: true, badge: 'LIVE', badgeColor: 'emerald' },
          ]
        },
        {
          title: 'REPORTS & VIEW',
          items: [
            { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
            { id: 'public', label: 'Public Shareable View', icon: Globe },
          ]
        }
      ]
    : [
        {
          title: 'EXECUTIVE INTELLIGENCE',
          items: [
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative w-4/5 max-w-xs xl:max-w-[325px] h-full shadow-lg backdrop-blur-2xl bg-white dark:bg-navy-950 p-4 sm:p-5 flex flex-col justify-between overflow-hidden z-10 border-r border-slate-200/90 dark:border-navy-800/90"
          >
            {/* ── Ambient Radial Mesh Glows ── */}

            {/* ── Header ── */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-navy-800/80 shrink-0 mb-4 relative z-10">
              <div className="flex items-center space-x-2.5">
                <CollegeLogo size={32} />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Nandha Intelligence
                  </span>
                  <span className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500">
                    Institutional Platform
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

      {/* ── Navigation Groups ── */}
      <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0 custom-scrollbar relative z-10">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1.5">
            <div className="px-3 py-1 flex items-center justify-between">
              <span className="text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {section.title}
              </span>
              <span className="w-8 h-px bg-slate-200 dark:bg-navy-800" />
            </div>

            <nav className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-2xl font-bold text-xs text-left cursor-pointer select-none transition-all duration-200 group transform active:scale-[0.98] ${
                      isActive
                        ? 'bg-brand-600 text-white font-extrabold shadow-lg shadow-brand-500/30 border border-brand-400/40 translate-x-1'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-navy-900/90 hover:text-brand-600 dark:hover:text-brand-400 hover:translate-x-1'
                    }`}
                  >
                    {/* Active Left Indicator Notch */}
                    {isActive && (
                      <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-r-full shadow-sm z-20" />
                    )}

                    {/* Left Icon + Label */}
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2 relative z-10">
                      <div className={`p-1.5 rounded-xl transition-all duration-200 shrink-0 ${
                        isActive 
                          ? 'bg-white/20 text-white shadow-inner scale-105' 
                          : 'bg-slate-100 dark:bg-navy-900 text-slate-500 dark:text-slate-400 group-hover:bg-brand-50 dark:group-hover:bg-navy-800 group-hover:text-brand-600 dark:group-hover:text-brand-300 group-hover:scale-110 group-hover:rotate-3 shadow-sm'
                      }`}>
                        <Icon className="w-4 h-4 shrink-0 transition-transform duration-200" />
                      </div>
                      <span className={`text-xs tracking-tight whitespace-nowrap transition-colors ${
                        isActive ? 'font-black text-white' : 'font-semibold'
                      }`}>
                        {item.label}
                      </span>
                    </div>

                    {/* Badges & Arrow */}
                    <div className="flex items-center space-x-1.5 shrink-0 relative z-10">
                      {item.pulse && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                      )}
                      
                      {item.badge && (
                        <span className={`px-2 py-0.5 text-[9.5px] font-black rounded-lg uppercase tracking-wider transition-all duration-200 ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                            : item.badgeColor === 'purple'
                            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 group-hover:bg-purple-500/25'
                            : item.badgeColor === 'indigo'
                            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 group-hover:bg-indigo-500/25'
                            : item.badgeColor === 'rose'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 group-hover:bg-rose-500/25'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/25'
                        }`}>
                          {item.badge}
                        </span>
                      )}

                      <ChevronRight className={`w-3.5 h-3.5 transition-all duration-200 ${
                        isActive
                          ? 'text-amber-300 opacity-100 translate-x-0.5'
                          : 'opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 text-slate-400'
                      }`} />
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* ── Bottom Institution Footer Card ── */}
      <div className="pt-3 mt-2 border-t border-slate-100 dark:border-navy-800 shrink-0 relative z-10">
        <div className="p-3.5 rounded-2xl bg-slate-900 dark:bg-navy-950 text-white border border-emerald-500/20 shadow-lg text-xs space-y-2 relative overflow-hidden group cursor-default">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center space-x-2 relative z-10">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-white text-xs font-extrabold truncate">Sunday Session Window</span>
          </div>
          <p className="text-[10.5px] text-slate-400 leading-relaxed font-medium relative z-10">
            Official Window: <b className="text-emerald-400 font-black">08:00 AM – 09:30 AM IST</b>.<br />
            Continuous LeetCode tracking & live sync.
          </p>
          <div className="pt-1 border-t border-slate-800 relative z-10">
            <p className="text-[9.5px] text-slate-500 font-semibold">
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
