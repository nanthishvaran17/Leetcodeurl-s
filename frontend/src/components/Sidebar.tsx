import React from 'react';
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
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'growth', label: 'Growth Intelligence', icon: TrendingUp, badge: 'AI' },
    { id: 'departments', label: 'Departments & Sections', icon: Layers },
    { id: 'weekly-contest', label: 'Weekly Contest Tracker', icon: Calendar, pulse: true },
    { id: 'students', label: 'Student Leaderboard', icon: Users },
    { id: 'compare', label: 'Student Comparison', icon: BarChart3 },
    { id: 'quality', label: 'Data Quality Board', icon: CheckCircle2 },
    { id: 'system-health', label: 'Institutional Operations Center', icon: Activity, badge: 'PROD' },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'public', label: 'Public Shareable View', icon: Globe },
    { id: 'settings', label: 'Admin Settings', icon: Settings },
    { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
  ];

  return (
    <aside className="sticky top-20 w-full shrink-0 glass-card h-[calc(100vh-6rem)] border border-gray-200/80 dark:border-navy-800/80 rounded-3xl p-5 flex flex-col justify-between shadow-xl backdrop-blur-xl bg-white/80 dark:bg-navy-900/80 hidden lg:flex transition-all duration-300">
      
      {/* Navigation Links */}
      <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0 custom-scrollbar">
        <div className="px-3 py-1.5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center justify-between">
          <span>Main Navigation</span>
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-ping"></span>
        </div>

        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-sm text-left transition-all duration-250 group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 text-white shadow-lg shadow-brand-600/30 font-extrabold translate-x-1 scale-[1.01]'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-brand-50/80 dark:hover:bg-navy-800/80 hover:text-brand-600 dark:hover:text-brand-300 hover:translate-x-1'
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-amber-400 rounded-r-full shadow-[0_0_8px_#fbbf24] animate-pulse"></span>
                )}

                <div className="flex items-center space-x-3 truncate">
                  <div className={`p-2 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-white/20 text-white shadow-sm' 
                      : 'bg-gray-100 dark:bg-navy-800 text-gray-500 dark:text-gray-400 group-hover:bg-brand-100 dark:group-hover:bg-navy-700 group-hover:text-brand-600 dark:group-hover:text-brand-300 group-hover:scale-110 group-hover:rotate-3'
                  }`}>
                    <Icon className="w-5 h-5 shrink-0" />
                  </div>
                  <span className="truncate tracking-tight">{item.label}</span>
                </div>

                {/* Badges & Indicators */}
                <div className="flex items-center space-x-1.5 shrink-0">
                  {item.pulse && (
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  )}
                  {item.badge && (
                    <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md uppercase tracking-wider ${
                      isActive ? 'bg-amber-400 text-slate-900' : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isActive ? 'text-amber-300 opacity-100 translate-x-0.5' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 text-gray-400'
                  }`} />
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Session Info Card */}
      <div className="pt-4 mt-2 border-t border-gray-100 dark:border-navy-800 shrink-0">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-950 via-navy-950 to-indigo-950 border border-brand-500/30 shadow-lg text-xs space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-6 -mr-6 w-20 h-20 bg-brand-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-brand-500/20 transition-all"></div>
          <div className="flex items-center space-x-2 text-amber-400 font-extrabold relative z-10">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-white text-xs font-bold truncate">Sunday Weekly Session</span>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed font-medium relative z-10">
            Start snapshot: <b className="text-emerald-400 font-bold">08:00 AM IST</b>.<br />
            Final evaluation: <b className="text-emerald-400 font-bold">09:30 AM IST</b>.
          </p>
        </div>
      </div>

    </aside>
  );
};
