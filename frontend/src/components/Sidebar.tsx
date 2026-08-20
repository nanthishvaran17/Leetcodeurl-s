import React from 'react';
import { motion } from 'framer-motion';
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
  Compass
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const sections: NavSection[] = [
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

  return (
    <aside className="sticky top-20 w-full max-w-[305px] xl:max-w-[325px] shrink-0 glass-card h-[calc(100vh-6rem)] border border-slate-200/80 dark:border-navy-800/80 rounded-3xl p-3.5 sm:p-4 flex flex-col justify-between shadow-2xl backdrop-blur-2xl bg-white/90 dark:bg-navy-950/90 hidden lg:flex transition-all duration-300 relative overflow-hidden">
      
      {/* Subtle Background Mesh Glow */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-brand-500/10 dark:bg-brand-500/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Navigation Header */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between shrink-0 mb-2.5">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
            <Compass className="w-4 h-4 animate-spin" style={{ animationDuration: '18s' }} />
          </div>
          <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Main Navigation
          </span>
        </div>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </div>

      {/* Navigation Groups & Links */}
      <div className="space-y-4 overflow-y-auto pr-1 flex-1 min-h-0 custom-scrollbar">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="px-3 py-1 text-[9.5px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
              <span>{section.title}</span>
            </div>

            <nav className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={() => setActiveTab(item.id)}
                    className={`relative w-full flex items-center justify-between px-3 py-2.5 rounded-2xl font-bold text-xs text-left transition-all duration-200 group cursor-pointer ${
                      isActive
                        ? 'text-white font-extrabold shadow-lg shadow-brand-600/30 border border-brand-400/30'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-navy-900/90 hover:text-brand-600 dark:hover:text-brand-300'
                    }`}
                  >
                    {/* Animated Sliding Active Background Pill */}
                    {isActive && (
                      <motion.div
                        layoutId="activeSidebarIndicator"
                        className="absolute inset-0 bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 rounded-2xl z-0 shadow-md"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}

                    {/* Left Active Glow Notch */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-amber-400 rounded-r-full shadow-[0_0_8px_#fbbf24] z-10"></span>
                    )}

                    {/* Content */}
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2 relative z-10">
                      <div className={`p-1.5 rounded-xl transition-all duration-200 shrink-0 ${
                        isActive 
                          ? 'bg-white/20 text-white shadow-inner' 
                          : 'bg-slate-100 dark:bg-navy-900 text-slate-500 dark:text-slate-400 group-hover:bg-brand-50 dark:group-hover:bg-navy-800 group-hover:text-brand-600 dark:group-hover:text-brand-300 group-hover:scale-105'
                      }`}>
                        <Icon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:rotate-6" />
                      </div>
                      <span className="text-xs font-bold leading-normal tracking-tight whitespace-nowrap">
                        {item.label}
                      </span>
                    </div>

                    {/* Badges & Micro-Indicators */}
                    <div className="flex items-center space-x-1.5 shrink-0 relative z-10">
                      {item.pulse && (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                      
                      {item.badge && (
                        <span className={`px-2 py-0.5 text-[9.5px] font-black rounded-md uppercase tracking-wider ${
                          isActive
                            ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                            : item.badgeColor === 'purple'
                            ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                            : item.badgeColor === 'indigo'
                            ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {item.badge}
                        </span>
                      )}

                      <ChevronRight className={`w-3.5 h-3.5 transition-all duration-200 ${
                        isActive
                          ? 'text-amber-300 opacity-100 translate-x-0.5'
                          : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 text-slate-400'
                      }`} />
                    </div>
                  </motion.button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Bottom Session Info Card */}
      <div className="pt-3 mt-2 border-t border-slate-100 dark:border-navy-800 shrink-0">
        <motion.div
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-900 via-navy-950 to-indigo-950 text-white border border-brand-500/30 shadow-xl text-xs space-y-2 relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-20 h-20 bg-brand-500/15 rounded-full blur-xl pointer-events-none group-hover:bg-brand-500/25 transition-all"></div>
          <div className="flex items-center space-x-2 text-amber-400 font-extrabold relative z-10">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span className="text-white text-xs font-extrabold truncate">Sunday Session Window</span>
          </div>
          <p className="text-[10.5px] text-slate-300 leading-relaxed font-medium relative z-10">
            Official Window: <b className="text-emerald-400 font-black">08:00 AM – 09:30 AM IST</b>.<br />
            Continuous LeetCode tracking & live sync.
          </p>
        </motion.div>
      </div>

    </aside>
  );
};
