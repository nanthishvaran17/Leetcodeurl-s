import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, User, LogOut, Activity, Menu, X, LayoutDashboard, Users, BarChart3, CheckCircle2, FileSpreadsheet, Settings, ShieldAlert, Globe, Layers, Calendar, TrendingUp, Cpu, Zap } from 'lucide-react';
import { CollegeLogo } from './CollegeLogo';
import { getDataFreshness } from '../services/api';
import { SyncStatusModal } from './SyncStatusModal';

interface NavbarProps {
  currentSessionStatus?: string;
  onOpenLogin: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentSessionStatus = 'ACTIVE',
  onOpenLogin,
  activeTab,
  setActiveTab
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  const [freshness, setFreshness] = useState<any>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  useEffect(() => {
    loadFreshness();
    const interval = setInterval(loadFreshness, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadFreshness = async () => {
    try {
      const data = await getDataFreshness();
      setFreshness(data);
    } catch (err) {
      console.warn("Freshness load warning:", err);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-[100000] bg-white/95 dark:bg-navy-900/95 backdrop-blur-md border-b border-gray-200 dark:border-navy-800 transition-colors shadow-sm">
        <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Hamburger Button (Mobile/Tablet) + Branding */}
            <div className="flex items-center space-x-3">
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
                  className="p-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 lg:hidden transition-colors cursor-pointer"
                  title="Toggle Mobile Navigation Menu"
                >
                  {isMobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}

              <div
                onClick={() => setActiveTab('landing')}
                className="flex items-center space-x-3 cursor-pointer group"
              >
                <CollegeLogo size={40} className="transition-transform group-hover:scale-105" />
                <div className="flex flex-col">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-extrabold text-sm sm:text-base tracking-tight text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      Nandha Engineering College
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                      LEETCODE
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium -mt-0.5">
                    LeetCode Tracker • Institutional Edition
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Quick Status Indicator */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-100/90 dark:bg-navy-950/90 border border-slate-200 dark:border-navy-800 text-xs shadow-inner">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  currentSessionStatus === 'ACTIVE'
                    ? 'bg-emerald-500 pulse-live-indicator'
                    : currentSessionStatus === 'FINALIZED'
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`} />
                <span className="font-extrabold text-slate-700 dark:text-slate-300 tracking-tight flex items-center space-x-1.5">
                  <span>Sync Engine:</span>
                  <span className="text-slate-900 dark:text-white uppercase font-black tracking-wider px-1.5 py-0.5 rounded-md bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 text-[10px]">
                    {currentSessionStatus}
                  </span>
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              
              {/* Sync Status Button */}
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all duration-200 border border-slate-200 dark:border-navy-700 cursor-pointer active:scale-95"
              >
                <Activity className={`w-3.5 h-3.5 ${currentSessionStatus === 'ACTIVE' ? 'text-emerald-500 animate-sync-spin' : 'text-brand-500'}`} />
                <span>Sync Engine Status</span>
              </button>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 transition-all duration-200 cursor-pointer active:scale-90"
                title="Toggle Dark / Light Mode"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-90" />
                ) : (
                  <Moon className="w-4 h-4 text-navy-700 transition-transform duration-300 hover:-rotate-12" />
                )}
              </button>

              {/* Auth Profile / Login */}
              {isAuthenticated && user ? (
                <div className="flex items-center space-x-3 pl-2 border-l border-gray-200 dark:border-navy-700">
                  <div className="flex items-center space-x-2">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.name}
                        className="w-8 h-8 rounded-full border-2 border-brand-500 object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-600 text-white font-black text-xs flex items-center justify-center">
                        {user.name ? user.name[0] : 'U'}
                      </div>
                    )}
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-extrabold text-gray-900 dark:text-white truncate max-w-[120px]">
                        {user.name || user.username}
                      </div>
                      <div className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">
                        {user.role || 'User'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-2 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center space-x-1 cursor-pointer"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span className="hidden sm:inline text-rose-600 font-bold text-xs">Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/30 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>Portal Sign In</span>
                </button>
              )}

            </div>

          </div>
        </div>
      </header>

      {/* Mobile / Tablet Responsive Drawer Navigation Overlay */}
      {isMobileDrawerOpen && isAuthenticated && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-white dark:bg-navy-950 h-full shadow-2xl p-5 flex flex-col justify-between overflow-y-auto z-10 border-r border-gray-200 dark:border-navy-800 animate-slideInLeft">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-navy-800">
                <div className="flex items-center space-x-2">
                  <CollegeLogo size={32} />
                  <span className="font-black text-xs text-gray-900 dark:text-white">Main Navigation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-navy-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1">
                {[
                  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'hod-command-center', label: 'HOD Command Center', icon: Cpu },
                  { id: 'faculty-action-center', label: 'Faculty Action Center', icon: Zap },
                  { id: 'growth', label: 'Growth Intelligence', icon: TrendingUp },
                  { id: 'departments', label: 'Departments & Sections', icon: Layers },
                  { id: 'weekly-contest', label: 'Weekly Contest Tracker', icon: Calendar },
                  { id: 'students', label: 'Student Leaderboard', icon: Users },
                  { id: 'compare', label: 'Student Comparison', icon: BarChart3 },
                  { id: 'quality', label: 'Data Quality Board', icon: CheckCircle2 },
                  { id: 'system-health', label: 'Institutional Operations', icon: Activity },
                  { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
                  { id: 'public', label: 'Public Shareable View', icon: Globe },
                  { id: 'settings', label: 'Admin Settings', icon: Settings },
                  { id: 'audit', label: 'Audit Log', icon: ShieldAlert },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileDrawerOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-bold text-xs text-left transition-all ${
                        isActive
                          ? 'bg-brand-600 text-white shadow-md'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-navy-800">
              <button
                type="button"
                onClick={() => {
                  logout();
                  setIsMobileDrawerOpen(false);
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-500/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out Portal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Engine Status Top-Level Portal Modal */}
      <SyncStatusModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </>
  );
};
