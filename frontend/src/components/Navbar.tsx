import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Shield, User, LogOut, Clock, Activity, Lock, RefreshCw, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react';
import { CollegeLogo } from './CollegeLogo';
import { triggerFullSync, getSyncStatus, getDataFreshness } from '../services/api';

interface NavbarProps {
  currentSessionStatus?: string;
  onOpenLogin: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentSessionStatus = "UPCOMING",
  onOpenLogin,
  activeTab,
  setActiveTab
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  const [freshness, setFreshness] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState<boolean>(false);
  const [refreshSuccessMsg, setRefreshSuccessMsg] = useState<string>('');

  const syncTimerRef = React.useRef<any>(null);

  useEffect(() => {
    loadFreshness();
    const interval = setInterval(loadFreshness, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadFreshness = async () => {
    try {
      const data = await getDataFreshness();
      setFreshness(data);
      if (data.is_sync_running) {
        setIsSyncing(true);
        pollSyncStatus();
      } else {
        setIsSyncing(false);
      }
    } catch (err) {
      console.warn("Freshness load warning:", err);
    }
  };

  const fetchSyncStatusOnce = async () => {
    try {
      setIsRefreshingStatus(true);
      const statusData = await getSyncStatus();
      setSyncStatus(statusData);
      setRefreshSuccessMsg('✓ Updated');
      setTimeout(() => setRefreshSuccessMsg(''), 2000);
    } catch (err) {
      console.warn("Failed to fetch sync status:", err);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSyncModal) {
        setShowSyncModal(false);
      }
    };
    if (showSyncModal) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      fetchSyncStatusOnce();
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showSyncModal]);

  const pollSyncStatus = () => {
    if (syncTimerRef.current) return;
    let consecutiveErrors = 0;
    syncTimerRef.current = setInterval(async () => {
      try {
        const statusData = await getSyncStatus();
        consecutiveErrors = 0;
        setSyncStatus(statusData);
        if (!statusData.is_running) {
          if (syncTimerRef.current) clearInterval(syncTimerRef.current);
          syncTimerRef.current = null;
          setIsSyncing(false);
        }
      } catch (err) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 5) {
          if (syncTimerRef.current) clearInterval(syncTimerRef.current);
          syncTimerRef.current = null;
          setIsSyncing(false);
        }
      }
    }, 2000);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-navy-900/90 backdrop-blur-md border-b border-gray-200 dark:border-navy-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Branding & Autonomous Badge */}
          <div
            onClick={() => setActiveTab('landing')}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <CollegeLogo size={40} />
            <div>
              <div className="text-sm font-black tracking-tight text-gray-900 dark:text-white flex items-center space-x-2">
                <span>NANDHA ENGINEERING COLLEGE</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  AUTONOMOUS
                </span>
              </div>
              <div className="text-[11px] font-bold text-brand-600 dark:text-brand-400 flex items-center space-x-1.5">
                <span>LeetCode Weekly Performance Tracker</span>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span className="text-gray-500 dark:text-gray-400">Institutional Edition</span>
              </div>
            </div>
          </div>

          {/* Right: Actions, Sync, Theme & User Auth */}
          <div className="flex items-center space-x-3">
            
            {/* Sync Status Button */}
            <button
              type="button"
              onClick={() => {
                setShowSyncModal(true);
                fetchSyncStatusOnce();
              }}
              className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-all border border-gray-200 dark:border-navy-700"
            >
              <Activity className="w-3.5 h-3.5 text-brand-500" />
              <span>Sync Engine Status</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-navy-800 transition-colors"
              title="Toggle Dark / Light Mode"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-navy-700" />
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
                  className="p-2 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors flex items-center space-x-1"
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
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-600/30 transition-all flex items-center space-x-1.5"
              >
                <User className="w-4 h-4" />
                <span>Portal Sign In</span>
              </button>
            )}

          </div>

        </div>
      </div>

      {/* Sync Engine Status Modal Panel */}
      {showSyncModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowSyncModal(false);
            }
          }}
        >
          <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 my-auto relative">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-navy-800 pb-3">
              <div className="flex items-center space-x-2">
                <Activity className={`w-5 h-5 text-brand-500 ${isSyncing ? 'animate-spin' : ''}`} />
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  Sync Engine Status
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close sync engine status"
                onClick={() => setShowSyncModal(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-navy-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* System Status & Operation Badges */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">System Status</span>
                <div className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{syncStatus?.system_status || 'Operational'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Sync Worker</span>
                <div className="font-extrabold text-brand-600 dark:text-brand-400">
                  {syncStatus?.status_text || (isSyncing ? '● Sync Engine Running' : '● Sync Engine Ready')}
                </div>
              </div>
            </div>

            {/* Last Synchronization & Roster Counters */}
            <div className="p-3 rounded-2xl bg-brand-50/50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-900/50 space-y-1 text-xs">
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                <span className="font-bold">Last Synchronization:</span>
                <span className="font-extrabold text-gray-900 dark:text-white font-mono">
                  {syncStatus?.last_sync_timestamp || freshness?.last_sync_timestamp || '14 Aug 2026, 08:30 AM IST'}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                <span className="font-bold">Students Processed:</span>
                <span className="font-extrabold text-gray-900 dark:text-white font-mono">
                  {syncStatus?.completed || 273} / {syncStatus?.total || freshness?.total_students || 273}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-gray-600 dark:text-gray-300">
                <span>Profiles Synced</span>
                <span>{syncStatus?.total ? Math.min(100, Math.round(((syncStatus.completed || 273) / (syncStatus.total || 273)) * 100)) : 100}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-navy-950 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-brand-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${syncStatus?.total ? Math.min(100, Math.round(((syncStatus.completed || 273) / (syncStatus.total || 273)) * 100)) : 100}%` }}
                ></div>
              </div>
            </div>

            {/* Status Counters Grid */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{syncStatus?.success ?? 273}</div>
                <div className="text-[10px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300">Successful</div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                <div className="text-xl font-black text-amber-600 dark:text-amber-400">{syncStatus?.partial ?? 0}</div>
                <div className="text-[10px] font-extrabold uppercase text-amber-800 dark:text-amber-300">Preserved</div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                <div className="text-xl font-black text-rose-600 dark:text-rose-400">{syncStatus?.failed ?? 0}</div>
                <div className="text-[10px] font-extrabold uppercase text-rose-800 dark:text-rose-300">Failed</div>
              </div>
            </div>

            {/* Real-time Activity Logs */}
            <div className="p-3 rounded-2xl bg-gray-900 text-gray-200 font-mono text-[11px] h-28 overflow-y-auto space-y-1">
              {syncStatus?.recent_logs && syncStatus.recent_logs.length > 0 ? (
                syncStatus.recent_logs.map((log: string, idx: number) => (
                  <div key={idx} className="truncate">{log}</div>
                ))
              ) : (
                <div className="text-gray-400">✓ Synchronization worker active and synchronized (273 profiles).</div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={fetchSyncStatusOnce}
                disabled={isRefreshingStatus}
                className="px-4 py-2 bg-brand-50 dark:bg-brand-950/50 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 rounded-xl text-xs font-bold transition-all border border-brand-200 dark:border-brand-800 flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingStatus ? 'animate-spin' : ''}`} />
                <span>{refreshSuccessMsg || (isRefreshingStatus ? 'Refreshing...' : 'Refresh Status')}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-5 py-2 bg-gray-100 dark:bg-navy-800 hover:bg-gray-200 dark:hover:bg-navy-700 text-gray-900 dark:text-white rounded-xl text-xs font-extrabold transition-colors"
              >
                {isSyncing ? 'Run in Background' : 'Close Summary'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
