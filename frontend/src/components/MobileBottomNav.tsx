import React from 'react';
import { 
  LayoutDashboard, 
  Trophy, 
  Swords, 
  TrendingUp, 
  UserCircle,
  Share2
} from 'lucide-react';

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

  const tabs = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'students',
      label: 'Leaderboard',
      icon: Trophy,
    },
    {
      id: 'weekly-contest',
      label: 'Contests',
      icon: Swords,
    },
    {
      id: 'growth',
      label: 'Analytics',
      icon: TrendingUp,
    },
    {
      id: 'account-settings',
      label: 'Profile',
      icon: UserCircle,
    },
  ];

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-navy-950/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-navy-800/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.3)] px-3 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] transition-transform"
    >
      <div className="flex items-center justify-between max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === 'students' && activeTab === 'roster');

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-2xl transition-all duration-200 active:scale-90 touch-manipulation select-none cursor-pointer ${
                isActive
                  ? 'text-brand-600 dark:text-brand-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <div className={`relative px-3 py-1 rounded-2xl transition-all duration-300 ${
                isActive 
                  ? 'bg-brand-500/10 dark:bg-brand-400/15 -translate-y-0.5' 
                  : 'bg-transparent'
              }`}>
                <Icon className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'stroke-[2.5px] scale-110' : 'stroke-[1.8px]'
                }`} />

                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-1 rounded-full bg-brand-600 dark:bg-brand-400 shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
                )}
              </div>
              
              <span className={`text-[10px] tracking-tight mt-0.5 leading-none transition-all ${
                isActive ? 'font-black scale-105' : 'font-semibold'
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
            className="flex flex-col items-center justify-center flex-none px-2 py-1 rounded-2xl text-amber-500 hover:text-amber-600 active:scale-90 transition-all touch-manipulation select-none cursor-pointer"
          >
            <div className="px-2.5 py-1 rounded-2xl bg-amber-500/10 dark:bg-amber-400/15">
              <Share2 className="w-5 h-5 stroke-[2.2px]" />
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 font-bold leading-none">
              Share
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};
