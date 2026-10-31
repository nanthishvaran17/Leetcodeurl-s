import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, Activity, Menu, X, LayoutDashboard, Users, BarChart3, CheckCircle2, FileSpreadsheet, Settings, ShieldAlert, Globe, Layers, Calendar, TrendingUp, Cpu, AlertOctagon, Bell, Palette, Check, RefreshCw, Search } from 'lucide-react';
import { CollegeLogo } from './CollegeLogo';
import { getDataFreshness } from '../services/api';
const SyncStatusModal = lazy(() => import('./SyncStatusModal').then(m => ({ default: m.SyncStatusModal })));
const SignOutConfirmModal = lazy(() => import('./SignOutConfirmModal').then(m => ({ default: m.SignOutConfirmModal })));
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
  const { user, logout, isAuthenticated } = useAuth();

  const [freshness, setFreshness] = useState<any>(null);
  const [menteesCount, setMenteesCount] = useState<number | null>(null);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const { unreadCount } = useGlobalNotifications();

  useEffect(() => {
    loadFreshness();
    const isMentorRole = ['staff', 'faculty', 'staff mentor', 'faculty mentor', 'placement coordinator', 'placement_coordinator', 'placement officer', 'placement_officer'].includes((user?.role || '').toLowerCase());
    if (isAuthenticated && isMentorRole) {
      loadMenteesCount();
    }
    const interval = setInterval(() => {
      loadFreshness();
      if (isAuthenticated && isMentorRole) {
        loadMenteesCount();
      }
    }, 30000);
    const handleToggleNotifications = () => {
      setShowNotifications(prev => !prev);
    };
    window.addEventListener('toggle_notifications', handleToggleNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener('toggle_notifications', handleToggleNotifications);
    };
  }, [isAuthenticated, user?.role]);

  const loadMenteesCount = async () => {
    try {
      const { default: api } = await import('../services/api');
      const res = await api.get('/faculty-assignments/my-students');
      if (res.data && res.data.total_assigned !== undefined) {
        setMenteesCount(res.data.total_assigned);
      }
    } catch (err) {
      console.warn("Mentees load warning:", err);
    }
  };

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
      <header 
        className="sticky top-0 z-40 bg-white/80 dark:bg-[#070A14]/85 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/[0.08] transition-all shadow-subtle dark:shadow-[0_4px_30px_rgba(0,0,0,0.6),inset_0_-1px_0_rgba(255,255,255,0.05)] pt-safe-top"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}
      >
        <div className="w-full max-w-full mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[50px] sm:min-h-[56px] py-1 sm:py-1.5 gap-2 sm:gap-4">
            
            {/* Left: Hamburger Button (Mobile/Tablet) + Branding */}
            <div className="flex items-center space-x-1.5 sm:space-x-3.5 min-w-0 flex-1">
              {(isAuthenticated || activeTab === "public") && (
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 flex-shrink-0 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] hover:text-brand-600 dark:hover:text-brand-400 transition-all cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-95 border border-transparent hover:border-slate-200/60 dark:hover:border-white/10"
                  title="Toggle Navigation Menu"
                >
                  {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}

              <div
                onClick={() => setActiveTab('landing')}
                className="flex items-center cursor-pointer group min-w-0 select-none pl-1"
              >
                <div className="flex flex-col justify-center min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                    <span className="font-black text-[13px] leading-tight sm:text-[15.5px] sm:leading-tight tracking-tight text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors whitespace-nowrap truncate font-display">
                      NANDHA <span className="text-brand-600 dark:text-brand-400">INTELLIGENCE</span>
                    </span>
                    {(freshness?.total_students || menteesCount !== null) ? (
                      <span className="hidden sm:inline-flex px-2 py-0.5 text-[9px] font-bold rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25 whitespace-nowrap flex-shrink-0 items-center tracking-wide shadow-xs">
                        {menteesCount !== null && menteesCount > 0
                          ? `${menteesCount} MENTEES` 
                          : `${freshness?.total_students || 0} STUDENTS`}
                      </span>
                    ) : null}
                  </div>
                  <span className="hidden sm:block text-[9px] xs:text-[10.5px] leading-tight sm:text-[12px] sm:leading-snug text-slate-500 dark:text-slate-400 font-semibold tracking-wide truncate">
                    Nandha Engineering College • Erode
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-3.5 flex-shrink-0">

              {/* Quick Search Button (Mobile & Desktop) */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_command_palette'))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-200/80 dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10 transition-all cursor-pointer min-h-[38px] active:scale-95 touch-manipulation shadow-2xs select-none"
                title="Search Students & Commands (Ctrl+K)"
                aria-label="Quick Search"
              >
                <Search className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Search</span>
                <kbd className="hidden md:inline-flex items-center px-1.5 py-0.2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded text-[9px] font-mono text-slate-400 ml-0.5">
                  ⌘K
                </kbd>
              </button>





              {/* Sync Status Button */}
              <button
                type="button"
                onClick={() => setShowSyncModal(true)}
                className="hidden lg:flex items-center justify-center space-x-2 px-3.5 h-[38px] rounded-xl glass-pill text-[11.5px] font-bold text-slate-700 dark:text-slate-200 transition-all duration-200 cursor-pointer active:scale-95 hover:shadow-subtle"
              >
                <Activity className={`w-3.5 h-3.5 ${currentSessionStatus === 'ACTIVE' ? 'text-emerald-500 animate-sync-spin' : 'text-brand-500'}`} />
                <span>Sync Engine Status</span>
              </button>

              {/* Notifications */}
              {isAuthenticated && (
                <div className="relative">
                  <button
                    type="button"
                    data-notification-trigger="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNotifications(prev => !prev);
                    }}
                    className="relative p-2 flex-shrink-0 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 transition-all duration-200 cursor-pointer active:scale-90 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                    aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                    aria-expanded={showNotifications}
                  >
                    <Bell className="w-4 h-4 sm:w-4 sm:h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 bg-rose-600 text-white text-[9px] font-black rounded-full border-2 border-white dark:border-navy-900 flex items-center justify-center shadow-md animate-pulse">
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

              {/* Mobile Compact Profile Button */}
              {isAuthenticated && user && (
                <button
                  type="button"
                  onClick={() => setActiveTab('account-settings')}
                  className="sm:hidden p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] active:scale-95 transition-all flex items-center justify-center shrink-0 min-w-[36px] min-h-[36px]"
                  title="Open Profile Settings"
                >
                  {(user.photoURL || (user as any).profile_photo) ? (
                    <img
                      src={user.photoURL || (user as any).profile_photo}
                      alt={user.full_name || user.username}
                      className="w-7 h-7 rounded-full border-2 border-brand-500 object-contain p-0.5 bg-white dark:bg-navy-900 shadow-xs"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-brand-600 text-white font-black text-[11px] flex items-center justify-center uppercase shadow-xs">
                      {(user.full_name || user.displayName || user.name || user.username || 'U')[0]}
                    </div>
                  )}
                </button>
              )}

              {/* Auth Profile / Login */}
              {isAuthenticated && user ? (
                <div className="hidden sm:flex items-center space-x-1.5 sm:space-x-3 pl-1.5 sm:pl-3 border-l border-slate-200 dark:border-navy-700">
                  <button
                    type="button"
                    onClick={() => setActiveTab('account-settings')}
                    className="flex items-center space-x-1.5 flex-shrink-0 hover:opacity-85 transition-all cursor-pointer p-0.5 sm:p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 text-left active:scale-95"
                    title="Open Account & Profile Settings"
                  >
                    {(user.photoURL || (user as any).profile_photo) ? (
                      <img
                        src={user.photoURL || (user as any).profile_photo}
                        alt={user.full_name || user.displayName || user.name || user.username}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 border-brand-500 object-contain p-0.5 bg-white dark:bg-navy-900 shadow-xs"
                      />
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-brand-600 text-white font-black text-xs flex items-center justify-center uppercase shadow-xs">
                        {(user.full_name || user.displayName || user.name || user.username || 'U')[0]}
                      </div>
                    )}
                    <div className="hidden sm:block text-left">
                      <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate max-w-[120px]">
                        {user.full_name || user.displayName || user.name || user.username}
                      </div>
                      <div className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider">
                        {user.role || 'User'}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(true)}
                    className="hidden sm:flex px-2.5 py-1.5 sm:px-3 sm:py-2 flex-shrink-0 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors items-center space-x-1.5 cursor-pointer min-w-[44px] min-h-[44px] sm:min-w-auto sm:min-h-auto justify-center"
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
                  className="px-3 sm:px-4 py-2 sm:py-2 min-h-[40px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-[11px] sm:text-xs shadow-md shadow-brand-600/30 transition-all active:scale-95 flex items-center space-x-1 sm:space-x-1.5 cursor-pointer flex-shrink-0 touch-manipulation"
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
        <Suspense fallback={null}>
          <SignOutConfirmModal
            isOpen={showLogoutConfirm}
            onClose={() => setShowLogoutConfirm(false)}
            onConfirm={logout}
            user={user}
          />
        </Suspense>
      )}

      {/* Sync Engine Status Top-Level Portal Modal */}
      {showSyncModal && (
        <Suspense fallback={null}>
          <SyncStatusModal
            isOpen={showSyncModal}
            onClose={() => setShowSyncModal(false)}
          />
        </Suspense>
      )}
    </>
  );
};
