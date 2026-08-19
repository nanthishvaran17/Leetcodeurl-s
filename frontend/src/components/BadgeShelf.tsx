import React from 'react';
import { Award, Flame, Trophy, Zap, ShieldCheck, Star } from 'lucide-react';

interface BadgeItem {
  id: string;
  name: string;
  category: string;
  icon: any;
  color: string;
  bg: string;
  unlocked: boolean;
  description: string;
}

interface BadgeShelfProps {
  solvedCount?: number;
  streakCount?: number;
  rating?: number;
}

export const BadgeShelf: React.FC<BadgeShelfProps> = ({
  solvedCount = 0,
  streakCount = 0,
  rating = 0
}) => {
  const badges: BadgeItem[] = [
    {
      id: '100-club',
      name: '100-Club Master',
      category: 'Milestone',
      icon: Trophy,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/30',
      unlocked: solvedCount >= 100,
      description: 'Solved 100+ LeetCode algorithmic problems'
    },
    {
      id: 'streak-master',
      name: 'Streak Master',
      category: 'Consistency',
      icon: Flame,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 border-rose-500/30',
      unlocked: streakCount >= 5,
      description: 'Maintained 5+ consecutive active solving days'
    },
    {
      id: 'contest-champion',
      name: 'Contest Champion',
      category: 'Competitive',
      icon: Star,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10 border-indigo-500/30',
      unlocked: rating >= 1400,
      description: 'Achieved 1400+ contest rating performance'
    },
    {
      id: 'speed-demon',
      name: 'Speed Demon',
      category: 'Performance',
      icon: Zap,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      unlocked: solvedCount >= 50,
      description: 'Solved 50+ problems in quick succession'
    },
    {
      id: 'certified-solver',
      name: 'Certified Solver',
      category: 'Verification',
      icon: ShieldCheck,
      color: 'text-brand-500',
      bg: 'bg-brand-500/10 border-brand-500/30',
      unlocked: solvedCount > 0,
      description: 'Active verified platform participant'
    }
  ];

  return (
    <div className="glass-card p-6 rounded-3xl border border-gray-200/90 dark:border-gray-800 shadow-xl space-y-4 bg-white/90 dark:bg-navy-900/90">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-base text-gray-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Achievement Badge Shelf</span>
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-300 font-bold">Unlocked Gamified Achievements</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 text-xs font-black uppercase shadow-sm">
          {badges.filter(b => b.unlocked).length} / {badges.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
        {badges.map((b) => {
          const IconComp = b.icon;
          return (
            <div
              key={b.id}
              className={`p-4 rounded-2xl border-2 text-center transition-all duration-300 relative group ${
                b.unlocked
                  ? `${b.bg} shadow-md hover:scale-105`
                  : 'bg-gray-100 dark:bg-gray-800/40 border-gray-300 dark:border-gray-700 opacity-50 grayscale'
              }`}
            >
              <div className={`w-11 h-11 rounded-2xl mx-auto flex items-center justify-center mb-2 shadow-sm ${b.unlocked ? b.bg : 'bg-gray-200 dark:bg-gray-800'}`}>
                <IconComp className={`w-6 h-6 ${b.unlocked ? b.color : 'text-gray-400'}`} />
              </div>
              <p className="font-black text-xs text-gray-900 dark:text-gray-100 truncate">{b.name}</p>
              <p className="text-[10px] text-gray-600 dark:text-gray-300 font-extrabold uppercase tracking-wider mt-0.5">{b.category}</p>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:block w-48 p-2.5 rounded-2xl bg-slate-950 border border-slate-700 text-white text-xs shadow-2xl z-30 pointer-events-none">
                <p className="font-black text-amber-400">{b.name}</p>
                <p className="text-gray-200 text-[10px] font-medium mt-1 leading-snug">{b.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
