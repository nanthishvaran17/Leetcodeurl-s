import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Shield, User, LogOut, Clock, Activity } from 'lucide-react';

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

  return (
    <header className="sticky top-0 z-30 w-full glass-card border-b border-gray-200 dark:border-gray-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div 
          onClick={() => setActiveTab('landing')}
          className="flex items-center space-x-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight gradient-heading">
              LeetTracker <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-300 font-semibold ml-1">v2.0</span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:block">College Weekly Session Platform</p>
          </div>
        </div>

        {/* Live Session Badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Activity className="w-3.5 h-3.5" />
          <span>Sunday Session: <b>08:00 AM – 09:30 AM IST</b> ({currentSessionStatus})</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-3">
          
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
          </button>

          {/* Auth Button */}
          {isAuthenticated ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
                {user?.username} ({user?.role})
              </span>
              <button
                onClick={logout}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center space-x-1 text-xs font-semibold"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-medium text-xs shadow-md shadow-brand-600/30 transition-all flex items-center space-x-1.5"
            >
              <User className="w-4 h-4" />
              <span>Admin Login</span>
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
