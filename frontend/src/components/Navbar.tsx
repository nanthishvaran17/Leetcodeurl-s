import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Shield, User, LogOut, Clock, Activity, Lock, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
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

  const handleTriggerLiveSync = async () => {
    try {
      setIsSyncing(true);
      const res = await triggerFullSync('admin');
      pollSyncStatus();
    } catch (err: any) {
      console.error("Live sync trigger error:", err);
      alert(err.response?.data?.detail || "Failed to trigger live sync.");
      setIsSyncing(false);
    }
  };

  const syncTimerRef = React.useRef<any>(null);

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

  const handleLogout = async () => {
    await logout();
    setActiveTab('landing');
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-card border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Branding & College Info */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('landing')}>
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
              onClick={() => setShowSyncModal(true)}
              className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-all border border-gray-200 dark:border-navy-700"
            >
              <Activity className="w-3.5 h-3.5 text-brand-500" />
              <span>Sync Engine Status</span>
            </button>

            {/* Theme Toggle */}
            <button
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
                      {user.role}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center space-x-1 text-xs font-semibold"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span className="hidden sm:inline text-rose-600 font-bold">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
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

      {/* Live Sync Progress Modal Drawer */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <RefreshCw className={`w-5 h-5 text-brand-500 ${isSyncing ? 'animate-spin' : ''}`} />
                <h3 className="text-lg font-black text-gray-900 dark:text-white">
                  {isSyncing ? '🔄 LIVE SYNC IN PROGRESS' : '✅ LIVE SYNC COMPLETED'}
                </h3>
              </div>
              <button
                onClick={() => setShowSyncModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-gray-600 dark:text-gray-300">
                <span>Students Processed: {syncStatus?.completed || 0} / {syncStatus?.total || freshness?.total_students || 273}</span>
                <span>{syncStatus?.total ? Math.min(100, Math.round((syncStatus.completed / syncStatus.total) * 100)) : 0}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-navy-950 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-brand-500 to-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${syncStatus?.total ? Math.min(100, Math.round((syncStatus.completed / syncStatus.total) * 100)) : 0}%` }}
                ></div>
              </div>
            </div>

            {/* Status Counters Grid */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{syncStatus?.success || 0}</div>
                <div className="text-[10px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300">Fully Verified</div>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                <div className="text-xl font-black text-amber-600 dark:text-amber-400">{syncStatus?.partial || 0}</div>
                <div className="text-[10px] font-extrabold uppercase text-amber-800 dark:text-amber-300">Preserved Valid</div>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center">
                <div className="text-xl font-black text-rose-600 dark:text-rose-400">{syncStatus?.failed || 0}</div>
                <div className="text-[10px] font-extrabold uppercase text-rose-800 dark:text-rose-300">Failed / Errors</div>
              </div>
            </div>

            {/* Real-time Activity Logs */}
            <div className="p-3 rounded-2xl bg-gray-900 text-gray-200 font-mono text-[11px] h-32 overflow-y-auto space-y-1">
              {syncStatus?.recent_logs && syncStatus.recent_logs.length > 0 ? (
                syncStatus.recent_logs.map((log: string, idx: number) => (
                  <div key={idx} className="truncate">{log}</div>
                ))
              ) : (
                <div className="text-gray-500 italic">Initializing synchronization worker...</div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSyncModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-navy-800 hover:bg-gray-200 dark:hover:bg-navy-700 text-gray-900 dark:text-white rounded-xl text-xs font-bold transition-colors"
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
