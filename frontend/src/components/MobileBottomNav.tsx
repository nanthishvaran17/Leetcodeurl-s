import React from 'react';
import { 
  LayoutDashboard, 
  Trophy, 
  Swords, 
  TrendingUp, 
  Share2
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenShareCard?: () => void;
  onOpenAiWidget?: () => void;
  isAuthenticated: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenShareCard,
  isAuthenticated
}) => {
  const tabs = [
    {
      id: isAuthenticated ? 'dashboard' : 'landing',
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      id: 'roster',
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
  ];

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-navy-950/90 backdrop-blur-xl border-t border-slate-200/80 dark:border-navy-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-200 active:scale-95 touch-manipulation ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-blue-50 dark:bg-blue-900/30 scale-105' : ''
              }`}>
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
                )}
              </div>
              <span className="text-[10.5px] tracking-tight mt-0.5 font-medium leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}

        {onOpenShareCard && (
          <button
            onClick={onOpenShareCard}
            aria-label="Share Student Achievement Card"
            className="flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl text-amber-500 hover:text-amber-600 active:scale-95 transition-all touch-manipulation"
          >
            <div className="p-1 rounded-xl bg-amber-50 dark:bg-amber-900/20">
              <Share2 className="w-5 h-5 stroke-[2px]" />
            </div>
            <span className="text-[10.5px] tracking-tight mt-0.5 font-medium leading-none">
              Share
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};
