import React from 'react';
import { LayoutDashboard, Swords, TrendingUp, UserCircle, Share2, Building2, UserCheck, Calendar } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenShareCard?: () => void;
  onOpenAiWidget?: () => void;
  isAuthenticated: boolean;
  userRole?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenShareCard,
  isAuthenticated,
  userRole
}) => {
  // Trigger light tactile haptic vibration on devices that support it
  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    } catch {
      // Ignore vibration errors if disabled
    }
  };

  const handleTabClick = (tabId: string) => {
    triggerHaptic();
    setActiveTab(tabId);
  };

  const role = (userRole || '').trim().toLowerCase();
  const isHODorExec = ['hod', 'principal', 'management', 'director', 'admin', 'administrator', 'super admin', 'super_admin'].includes(role);
  const isFaculty = ['faculty', 'staff', 'professor', 'faculty mentor', 'staff mentor', 'faculty_mentor', 'staff_mentor'].includes(role);

  const fourthTab = isHODorExec
    ? { id: 'hod-command-center', label: 'HOD Deck', icon: Building2 }
    : isFaculty
    ? { id: 'faculty-action-center', label: 'Action Hub', icon: UserCheck }
    : { id: 'growth', label: 'Analytics', icon: TrendingUp };

  const tabs = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'students',
      label: 'Rankings',
      icon: Calendar,
    },
    {
      id: 'weekly-contest',
      label: 'Contests',
      icon: Swords,
    },
    fourthTab,
    {
      id: 'account-settings',
      label: 'Profile',
      icon: UserCircle,
    },
  ];

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-2.5 left-2.5 right-2.5 z-40 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-2xl border border-slate-200/90 dark:border-white/15 px-1.5 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-all backdrop-blur-2xl bg-white/92 dark:bg-[#070a14]/92 text-slate-700 dark:text-slate-300 ring-1 ring-black/5 dark:ring-white/10"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = 
            activeTab === tab.id || 
            (tab.id === 'students' && (activeTab === 'roster' || activeTab === 'leaderboard')) ||
            (tab.id === 'dashboard' && (activeTab === 'landing' || activeTab === '')) ||
            (tab.id === 'account-settings' && (activeTab === 'account' || activeTab === 'profile-settings')) ||
            (tab.id === 'hod-command-center' && (activeTab === 'hod' || activeTab === 'command-center')) ||
            (tab.id === 'faculty-action-center' && (activeTab === 'faculty'));

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all duration-300 active:scale-90 touch-manipulation select-none cursor-pointer ${
                isActive
                  ? 'text-brand-600 dark:text-brand-400 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className={`relative px-3 py-1 rounded-xl transition-all duration-300 ${
                isActive 
                  ? 'bg-brand-50 dark:bg-brand-500/20 border border-brand-200 dark:border-brand-400/30 -translate-y-0.5 shadow-xs text-brand-600 dark:text-brand-300' 
                  : 'bg-transparent text-slate-500 dark:text-slate-400'
              }`}>
                <Icon className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'stroke-[2.5px] scale-110 text-brand-600 dark:text-brand-400' : 'stroke-[1.8px]'
                }`} />

                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3.5 h-1 rounded-full bg-brand-600 dark:bg-brand-400 shadow-glow-indigo" />
                )}
              </div>
              
              <span className={`text-[10px] tracking-tight mt-0.5 leading-none transition-all ${
                isActive ? 'font-black scale-105 text-brand-700 dark:text-white' : 'font-semibold text-slate-500 dark:text-slate-400'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {onOpenShareCard && (
          <button
            onClick={() => {
              triggerHaptic();
              onOpenShareCard();
            }}
            aria-label="Share Student Achievement Card"
            className="flex flex-col items-center justify-center flex-none px-2 py-1 rounded-xl text-amber-400 hover:text-amber-300 active:scale-90 transition-all touch-manipulation select-none cursor-pointer"
          >
            <div className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-400/20">
              <Share2 className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold leading-none text-amber-300">
              Share
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};
