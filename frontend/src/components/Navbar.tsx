import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, User, LogOut, Activity } from 'lucide-react';
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
  onOpenLogin,
  setActiveTab
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  const [freshness, setFreshness] = useState<any>(null);
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
    } catch (err) {
      console.warn("Freshness load warning:", err);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-navy-900/90 backdrop-blur-md border-b border-gray-200 dark:border-navy-800 transition-colors">
        <div className="w-full px-3 sm:px-6 lg:px-8">
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
                onClick={() => setShowSyncModal(true)}
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
      </header>

      {/* Sync Engine Status Top-Level Portal Modal */}
      <SyncStatusModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
      />
    </>
  );
};
