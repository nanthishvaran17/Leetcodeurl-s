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
    <div className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-500" />
            <span>Achievement Badge Shelf</span>
          </h3>
          <p className="text-[11px] text-gray-500">Unlocked Gamified Achievements</p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase">
          {badges.filter(b => b.unlocked).length} / {badges.length} Unlocked
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {badges.map((b) => {
          const IconComp = b.icon;
          return (
            <div
              key={b.id}
              className={`p-3.5 rounded-2xl border text-center transition-all duration-300 relative group ${
                b.unlocked
                  ? `${b.bg} shadow-sm hover:scale-105`
                  : 'bg-gray-100/50 dark:bg-gray-800/20 border-gray-200 dark:border-gray-800 opacity-40 grayscale'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-2 ${b.unlocked ? b.bg : 'bg-gray-200 dark:bg-gray-800'}`}>
                <IconComp className={`w-5 h-5 ${b.unlocked ? b.color : 'text-gray-400'}`} />
              </div>
              <p className="font-extrabold text-[11px] text-gray-900 dark:text-white truncate">{b.name}</p>
              <p className="text-[9px] text-gray-400 font-semibold">{b.category}</p>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-40 p-2 rounded-xl bg-navy-950 text-white text-[10px] shadow-2xl z-30 pointer-events-none">
                <p className="font-bold text-amber-400">{b.name}</p>
                <p className="text-gray-300 text-[9px] mt-0.5">{b.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
