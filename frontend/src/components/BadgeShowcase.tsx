import React from "react";
import { Award, Lock, CheckCircle, Sparkles } from "lucide-react";

interface BadgeItem {
  id: string;
  title: string;
  icon: string;
  category: string;
  rarity: string;
  gradient: string;
  description: string;
  criteria: string;
  is_unlocked: boolean;
  progress_pct: number;
}

interface BadgeShowcaseProps {
  badges?: BadgeItem[];
  unlockedCount?: number;
}

export const BadgeShowcase: React.FC<BadgeShowcaseProps> = ({ badges, unlockedCount }) => {
  const defaultBadges: BadgeItem[] = [
    {
      id: "streak_100",
      title: "100-Day Streak Knight",
      icon: "",
      category: "STREAK",
      rarity: "LEGENDARY",
      gradient: "from-amber-500 via-orange-500 to-red-600",
      description: "Maintained an unbroken 100+ day problem solving streak.",
      criteria: "Active Streak >= 100",
      is_unlocked: true,
      progress_pct: 100
    },
    {
      id: "contest_champ",
      title: "Contest Champion",
      icon: "",
      category: "CONTEST",
      rarity: "LEGENDARY",
      gradient: "from-yellow-400 via-amber-500 to-yellow-600",
      description: "Achieved Top 3 Rank in official college-wide weekly contests.",
      criteria: "Weekly Contest Rank <= 3",
      is_unlocked: true,
      progress_pct: 100
    },
    {
      id: "speed_demon",
      title: "Speed Demon",
      icon: "",
      category: "SPEED",
      rarity: "EPIC",
      gradient: "from-cyan-400 via-brand-500 to-indigo-600",
      description: "Solved Q1 & Q2 in weekly contest under 10 minutes.",
      criteria: "Contest Q1+Q2 Solved in < 10 mins",
      is_unlocked: true,
      progress_pct: 100
    },
    {
      id: "algo_master",
      title: "Algorithm Master",
      icon: "",
      category: "MASTERY",
      rarity: "EPIC",
      gradient: "from-purple-500 via-indigo-500 to-violet-600",
      description: "Solved 30 or more Hard difficulty algorithms.",
      criteria: "Hard Problems Solved >= 30",
      is_unlocked: false,
      progress_pct: 65
    },
    {
      id: "grandmaster",
      title: "Grandmaster",
      icon: "",
      category: "RATING",
      rarity: "MYTHIC",
      gradient: "from-emerald-400 via-teal-500 to-cyan-600",
      description: "Crossed 2000+ LeetCode Contest Rating.",
      criteria: "Contest Rating >= 2000",
      is_unlocked: false,
      progress_pct: 78
    },
    {
      id: "century_club",
      title: "Century Club",
      icon: "",
      category: "MILESTONE",
      rarity: "RARE",
      gradient: "from-brand-500 via-indigo-500 to-purple-600",
      description: "Reached 100+ Total Problems Solved on platform.",
      criteria: "Total Solved >= 100",
      is_unlocked: true,
      progress_pct: 100
    }
  ];

  const displayBadges = badges && badges.length > 0 ? badges : defaultBadges;
  const count = unlockedCount !== undefined ? unlockedCount : displayBadges.filter(b => b.is_unlocked).length;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-md shadow-amber-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Award className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                GAMIFICATION SYSTEM
              </span>
            </div>
            <h3 className="text-lg font-bold text-white">Digital Badges & Accolades</h3>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-400 font-semibold">Unlocked: </span>
          <span className="text-sm font-black text-amber-400">{count} / {displayBadges.length}</span>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {displayBadges.map((badge) => (
          <div
            key={badge.id}
            className={`group relative rounded-xl p-3 text-center transition-all duration-300 border backdrop-blur-md ${
              badge.is_unlocked
                ? "bg-slate-950/70 border-slate-700/80 hover:border-amber-500/50 hover:scale-105 shadow-md"
                : "bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-90"
            }`}
          >
            {/* Icon Container */}
            <div className={`w-12 h-12 rounded-xl mx-auto mb-2 flex items-center justify-center text-2xl shadow-inner transition-transform group-hover:scale-110 ${
              badge.is_unlocked 
                ? `bg-gradient-to-tr ${badge.gradient} text-white shadow-lg` 
                : "bg-slate-800 text-slate-500 border border-slate-700"
            }`}>
              {badge.is_unlocked ? badge.icon : <Lock className="w-5 h-5 text-slate-500" />}
            </div>

            {/* Badge Title */}
            <h4 className="text-xs font-bold text-slate-200 truncate" title={badge.title}>
              {badge.title}
            </h4>
            <p className="text-[10px] text-slate-400 truncate mt-0.5" title={badge.criteria}>
              {badge.criteria}
            </p>

            {/* Progress Bar (if locked) */}
            {!badge.is_unlocked && (
              <div className="mt-2 w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-cyan-500"
                  style={{ width: `${badge.progress_pct}%` }}
                />
              </div>
            )}

            {/* Unlocked Checkmark */}
            {badge.is_unlocked && (
              <div className="absolute top-1.5 right-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
