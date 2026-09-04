import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, User, LogOut, Activity, Menu, X, LayoutDashboard, Users, BarChart3, CheckCircle2, FileSpreadsheet, Settings, ShieldAlert, Globe, Layers, Calendar, TrendingUp, Cpu, Zap, AlertOctagon, Bell } from 'lucide-react';
import { CollegeLogo } from './CollegeLogo';
import { getDataFreshness } from '../services/api';
import { SyncStatusModal } from './SyncStatusModal';
import { LiveIndicator } from './LiveIndicator';
import { NotificationPanel } from './NotificationPanel';
import { useGlobalNotifications } from '../context/GlobalNotificationContext';

interface NavbarProps {
  currentSessionStatus?: string;
  onOpenLogin: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentSessionStatus = 'ACTIVE',
  onOpenLogin,
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  const [freshness, setFreshness] = useState<any>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const { unreadCount } = useGlobalNotifications();

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
      <header className="sticky top-0 z-40 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-800 transition-colors shadow-sm pt-[env(safe-area-inset-top,0px)]">
        <div className="w-full max-w-[1800px] mx-auto px-2.5 sm:px-5 lg:px-8">
          <div className="flex items-center justify-between h-[60px] sm:h-[72px] gap-1 sm:gap-4">
            
            {/* Left: Hamburger Button (Mobile/Tablet) + Branding */}
            <div className="flex items-center space-x-1.5 sm:space-x-3 min-w-0 flex-1">
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-1.5 sm:p-2 flex-shrink-0 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-800 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                  title="Toggle Navigation Menu"
                >
                  {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}

              <div
                onClick={() => setActiveTab('landing')}
                className="flex items-center space-x-1.5 sm:space-x-2.5 cursor-pointer group min-w-0"
              >
                <div className="flex-shrink-0 flex items-center justify-center">
                  <div className="sm:hidden"><CollegeLogo size={26} className="transition-transform group-hover:scale-105" /></div>
                  <div className="hidden sm:block"><CollegeLogo size={34} className="transition-transform group-hover:scale-105" /></div>
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <div className="flex items-center space-x-1.5 min-w-0">
                    <span className="font-black text-[10px] xs:text-[11px] leading-tight sm:text-base sm:leading-tight tracking-tight text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors truncate">
                      <span className="hidden sm:inline">NANDHA </span>LEETCODE INTELLIGENCE
                    </span>
                    <span className="hidden sm:inline-flex px-1.5 py-0.2 text-[9px] font-black rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 whitespace-nowrap flex-shrink-0">
                      {freshness?.total_students ? `${freshness.total_students} STUDENTS` : '1500+ STUDENTS'}
                    </span>
                  </div>
                  <span className="text-[8.5px] xs:text-[9px] leading-tight sm:text-[11px] sm:leading-snug text-gray-500 dark:text-gray-400 font-semibold tracking-wide truncate">
                    Nandha Engineering College<span className="hidden sm:inline"> • Erode</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Quick Status Indicator */}
            <div className="hidden md:flex items-center space-x-4 flex-shrink-0 mx-2">
              <div className="flex items-center space-x-2.5 px-3.5 py-1.5 rounded-2xl bg-slate-100/90 dark:bg-navy-950/90 border border-slate-200 dark:border-navy-800 text-xs shadow-inner">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  currentSessionStatus === 'ACTIVE' || currentSessionStatus === 'LIVE' || currentSessionStatus === 'RUNNING'
                    ? 'bg-brand-500 pulse-live-indicator'
                    : currentSessionStatus === 'FINALIZED' || currentSessionStatus === 'COMPLETED' || currentSessionStatus === 'READY'
                    ? 'bg-emerald-500'
                    : 'bg-brand-500'
                }`} />
                <span className="font-extrabold text-slate-700 dark:text-slate-300 tracking-tight flex items-center space-x-1.5">
                  <span>Sync Engine:</span>
                  <span className={`uppercase font-black tracking-wider px-2 py-0.5 rounded-md border text-[10px] ${
                    currentSessionStatus === 'ACTIVE' || currentSessionStatus === 'LIVE' || currentSessionStatus === 'RUNNING'
                      ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400 border-brand-500/30'
                      : currentSessionStatus === 'FINALIZED' 
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20'
                  }`}>
                    {currentSessionStatus === 'SCHEDULED' ? 'READY' : currentSessionStatus}
                  </span>
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center space-x-1 sm:space-x-2.5 flex-shrink-0">
              
              <LiveIndicator />

              {/* Sync Status Button */}
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all duration-200 border border-slate-200 dark:border-navy-700 cursor-pointer active:scale-95"
              >
                <Activity className={`w-3.5 h-3.5 ${currentSessionStatus === 'ACTIVE' ? 'text-brand-500 animate-sync-spin' : 'text-brand-500'}`} />
                <span>Sync Engine Status</span>
              </button>

              {/* Notifications */}
              {isAuthenticated && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNotifications(!showNotifications);
                    }}
                    className="relative p-1.5 sm:p-2 flex-shrink-0 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 transition-all duration-200 cursor-pointer active:scale-90 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center"
                    title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                    aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                  >
                    <Bell className="w-4 h-4 sm:w-4 sm:h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-rose-600 text-white text-[9px] font-black rounded-full border-2 border-white dark:border-navy-900 flex items-center justify-center shadow-md animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <NotificationPanel
                    isOpen={showNotifications}
                    onClose={() => setShowNotifications(false)}
                    onNavigateTab={(tab) => {
                      setActiveTab(tab);
                      setShowNotifications(false);
                    }}
                  />
                </div>
              )}


              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 sm:p-2 flex-shrink-0 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 transition-all duration-200 cursor-pointer active:scale-90 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] flex items-center justify-center"
                title="Toggle Dark / Light Mode"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 sm:w-4 sm:h-4 text-amber-400 transition-transform duration-300 hover:rotate-90" />
                ) : (
                  <Moon className="w-4 h-4 sm:w-4 sm:h-4 text-navy-700 transition-transform duration-300 hover:-rotate-12" />
                )}
              </button>

              {/* Auth Profile / Login */}
              {isAuthenticated && user ? (
                <div className="flex items-center space-x-1.5 sm:space-x-3 pl-1 sm:pl-2 border-l border-gray-200 dark:border-navy-700">
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.name}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-brand-500 object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-600 text-white font-black text-xs flex items-center justify-center">
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
                    onClick={() => setShowLogoutConfirm(true)}
                    className="p-1.5 sm:p-2 flex-shrink-0 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center space-x-1 cursor-pointer min-w-[36px] min-h-[36px] sm:min-w-auto sm:min-h-auto justify-center"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4 sm:w-4 sm:h-4 text-rose-500" />
                    <span className="hidden sm:inline text-rose-600 font-bold text-xs">Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] sm:text-xs shadow-md shadow-brand-600/30 transition-all flex items-center space-x-1 sm:space-x-1.5 cursor-pointer flex-shrink-0"
                >
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Portal Sign In</span>
                  <span className="sm:hidden">Sign In</span>
                </button>
              )}

            </div>

          </div>
        </div>
      </header>

      {/* Sign Out Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <LogOut className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-gray-900 dark:text-white">
                Sign Out Confirmation
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Are you sure you want to sign out from <span className="font-bold text-gray-800 dark:text-gray-200">{user?.name || user?.username}</span>?
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-navy-700 hover:bg-gray-100 dark:hover:bg-navy-800 text-gray-700 dark:text-gray-300 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Yes, Sign Out</span>
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
