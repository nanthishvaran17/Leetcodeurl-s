import React, { useState } from 'react';
import { ExternalLink, Trophy, Flame, Star, Award, CheckCircle2, RotateCw, User, Trash2, ShieldCheck } from 'lucide-react';
import { StudentData } from './LeaderboardTable';

interface StudentFlipCardProps {
  student: StudentData;
  onSelectStudent?: (student: StudentData) => void;
  onDeleteStudent?: (student: StudentData) => void;
}

export const StudentFlipCard: React.FC<StudentFlipCardProps> = ({ student, onSelectStudent, onDeleteStudent }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const totalSolved = student.stats?.total_solved || 0;
  const easy = student.stats?.easy_solved || 0;
  const medium = student.stats?.medium_solved || 0;
  const hard = student.stats?.hard_solved || 0;
  const rank = student.college_rank;

  const getRankBadgeStyle = (r?: number) => {
    if (!r) return 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-700';
    if (r === 1) return 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30 border-amber-300';
    if (r === 2) return 'bg-gradient-to-r from-slate-200 via-gray-100 to-slate-400 text-slate-900 font-extrabold shadow-sm shadow-slate-400/20 border-slate-300';
    if (r === 3) return 'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-800 text-amber-100 font-extrabold shadow-sm shadow-amber-700/20 border-amber-600';
    if (r <= 10) return 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold shadow-sm shadow-emerald-500/20 border-emerald-400';
    return 'bg-gray-100 dark:bg-navy-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800';
  };

  return (
    <div
      className="w-full h-[340px] perspective-1000 cursor-pointer group"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* FRONT SIDE OF FLIP CARD (CLEAN EXECUTIVE BRAND) */}
        <div className="absolute inset-0 w-full h-full glass-card p-6 rounded-3xl border border-gray-200/90 dark:border-gray-800 shadow-xl hover:shadow-2xl dark:hover:border-brand-500/40 backface-hidden flex flex-col justify-between transition-all duration-300 bg-white/95 dark:bg-navy-900/90">
          
          {/* Card Top: Rank & Department Pill */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-xs border uppercase tracking-wider flex items-center space-x-1 ${getRankBadgeStyle(rank)}`}>
              {rank === 1 ? (
                <><span>🥇</span><span>#1 Rank</span></>
              ) : rank === 2 ? (
                <><span>🥈</span><span>#2 Rank</span></>
              ) : rank === 3 ? (
                <><span>🥉</span><span>#3 Rank</span></>
              ) : (
                <span>#{rank || '—'} Rank</span>
              )}
            </span>

            <span className="px-3 py-1 rounded-xl bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-800 font-extrabold text-[11px] font-mono">
              {student.department?.code || 'CSE'}
            </span>
          </div>

          {/* Card Center: Avatar & Student Details */}
          <div className="text-center space-y-2.5 py-1">
            
            {/* Executive Avatar Frame */}
            <div className="relative w-16 h-16 mx-auto group-hover:scale-105 transition-transform duration-300">
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-navy-800 text-white font-black text-xl flex items-center justify-center shadow-md">
                {student.name ? student.name.split(' ').map(n => n[0]).join('').slice(0, 2) : <User className="w-8 h-8" />}
              </div>
            </div>

            <div>
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white truncate max-w-[210px] mx-auto tracking-tight">
                {student.name}
              </h3>
              <p className="text-xs text-brand-600 dark:text-brand-400 font-mono font-bold mt-0.5 tracking-wider">
                {student.reg_no}
              </p>
              <p className="text-[11px] text-gray-500 font-medium mt-1">
                {student.department?.name} • <span className="font-bold text-gray-700 dark:text-gray-300">{student.year_level} Year</span>
              </p>
            </div>
          </div>

          {/* Card Bottom: Quick Stats & Tap to Flip Prompt */}
          <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>{totalSolved} Solved</span>
            </div>

            <div className="flex items-center space-x-1 text-gray-400 text-[10px] font-semibold tracking-wide">
              <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
              <span>Tap to Flip ➔</span>
            </div>
          </div>

        </div>

        {/* BACK SIDE OF FLIP CARD (APPLE / LINEAR SLEEK EXECUTIVE PROFESSIONAL) */}
        <div className="absolute inset-0 w-full h-full p-6 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-navy-950 text-gray-900 dark:text-white shadow-2xl backface-hidden rotate-y-180 flex flex-col justify-between">
          
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
            <div className="flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              <span className="font-extrabold text-sm text-gray-900 dark:text-white truncate max-w-[140px] tracking-tight">{student.name}</span>
            </div>
            <span className="text-[11px] text-brand-700 dark:text-brand-300 font-mono font-bold bg-brand-50 dark:bg-brand-950 px-2.5 py-1 rounded-xl border border-brand-200 dark:border-brand-800">
              {student.reg_no}
            </span>
          </div>

          {/* Stats Breakdown */}
          <div className="space-y-3.5">
            
            {/* Total Solved Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-500/10 to-indigo-500/10 border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider">Total Problems Solved</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {totalSolved}
              </span>
            </div>

            {/* Difficulty Breakdown - Executive Pastel Badges */}
            <div className="grid grid-cols-3 gap-2 text-center">
              
              <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Easy</span>
                <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">{easy}</span>
              </div>

              <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider">Med</span>
                <span className="text-base font-extrabold text-amber-700 dark:text-amber-300 mt-0.5">{medium}</span>
              </div>

              <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex flex-col items-center">
                <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 tracking-wider">Hard</span>
                <span className="text-base font-extrabold text-rose-700 dark:text-rose-300 mt-0.5">{hard}</span>
              </div>

            </div>

            {/* Streak & Contest Rating / Global Rank */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center space-x-1.5 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/60">
                <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>Rating: {student.stats?.contest_rating ? student.stats.contest_rating.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '1,355.3'}</span>
              </div>

              <div className="flex items-center space-x-1.5 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
                <Star className="w-3.5 h-3.5 fill-indigo-500 text-indigo-500" />
                <span>Rank: {student.stats?.public_profile_ranking ? `#${student.stats.public_profile_ranking.toLocaleString('en-US')}` : student.stats?.contest_global_ranking ? `#${student.stats.contest_global_ranking.toLocaleString('en-US')}` : 'Unranked'}</span>
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectStudent) onSelectStudent(student);
              }}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-extrabold text-xs shadow-md shadow-brand-600/30 transition-all flex items-center justify-center space-x-1.5"
            >
              <span>View Full Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {onDeleteStudent && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteStudent(student);
                }}
                className="p-2.5 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-gray-200 dark:border-gray-800 transition-colors"
                title="Delete Student Record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
