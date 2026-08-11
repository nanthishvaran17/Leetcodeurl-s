import React from 'react';
import {
  LayoutDashboard,
  Users,
  Trophy,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  Globe,
  Award,
  Layers,
  Calendar,
  TrendingUp,
  Activity
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'growth', label: 'Growth Intelligence', icon: TrendingUp },
    { id: 'departments', label: 'Departments & Sections', icon: Layers },
    { id: 'weekly-contest', label: 'Weekly Contest Tracker', icon: Calendar },
    { id: 'students', label: 'Student Leaderboard', icon: Users },
    { id: 'compare', label: 'Student Comparison', icon: BarChart3 },
    { id: 'quality', label: 'Data Quality Board', icon: CheckCircle2 },
    { id: 'system-health', label: 'System Operations & Health', icon: Activity },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'public', label: 'Public Shareable View', icon: Globe },
    { id: 'settings', label: 'Admin Settings', icon: Settings },
    { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
  ];

  return (
    <aside className="w-64 glass-card min-h-[calc(100vh-4rem)] border-r border-gray-200 dark:border-gray-800 p-4 space-y-2 hidden md:block">
      <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
        Main Navigation
      </div>

      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-xs text-left transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20 font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'}`} />
              <span className="truncate text-left flex-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="pt-6">
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-brand-900 via-navy-900 to-indigo-950 border border-brand-500/40 shadow-lg text-xs space-y-2">
          <div className="flex items-center space-x-2 text-amber-400 font-extrabold">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="text-white text-xs font-bold">Sunday Weekly Session</span>
          </div>
          <p className="text-[11px] text-gray-200 dark:text-gray-200 leading-relaxed font-medium">
            Automatic starting snapshot triggers at <b className="text-emerald-400 font-bold">08:00 AM IST</b>. Final snapshot & evaluation at <b className="text-emerald-400 font-bold">09:30 AM IST</b>.
          </p>
        </div>
      </div>
    </aside>
  );
};
