import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  Trophy, 
  Flame, 
  Sparkles,
  Award,
  Zap
} from 'lucide-react';
import { Share } from '@capacitor/share';
import { StudentData } from './LeaderboardTable';

interface StudentShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: StudentData | any;
}

export const StudentShareCardModal: React.FC<StudentShareCardModalProps> = ({
  isOpen,
  onClose,
  student
}) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !student) return null;

  const easy = Number(student.easy_solved) || 0;
  const medium = Number(student.medium_solved) || 0;
  const hard = Number(student.hard_solved) || 0;
  const calculatedSolved = easy + medium + hard;
  const totalSolved = Number(student.total_solved) || (calculatedSolved > 0 ? calculatedSolved : 0);

  const rawRank = student.college_rank ?? student.rank ?? student.dept_rank;
  const rankDisplay = (rawRank !== undefined && rawRank !== null && rawRank !== '' && !isNaN(Number(rawRank))) 
    ? `#${rawRank}` 
    : 'Unranked';

  const rawStreak = student.streak_count ?? student.current_streak;
  const streak = (rawStreak !== undefined && rawStreak !== null && !isNaN(Number(rawStreak))) 
    ? Number(rawStreak) 
    : 0;

  const rawRating = student.stats?.contest_rating ?? student.contest_rating;
  const contestRating = (rawRating !== undefined && rawRating !== null && !isNaN(Number(rawRating))) 
    ? Math.round(Number(rawRating)) 
    : 'Unrated';

  const deptName = typeof student.department === 'object' 
    ? (student.department?.code || student.department?.name || 'CSE') 
    : (student.department || 'CSE');

  const shareText = `🔥 Check out my LeetCode Stats!\n👤 ${student.name || 'Student'} (${deptName})\n📊 Solved: ${totalSolved} Problems (E:${easy} M:${medium} H:${hard})\n🏆 Rank: ${rankDisplay} | Rating: ${contestRating}\n⚡ Streak: ${streak} Days\n\nTracked via College LeetCode Hub!`;

  // Handle Native Share functionality
  const handleShare = async () => {
    setSharing(true);
    try {
      const canNativeShare = await Share.canShare();
      if (canNativeShare.value) {
        await Share.share({
          title: `${student.name || 'Student'} LeetCode Achievements`,
          text: shareText,
          dialogTitle: 'Share Achievement Card',
        });
        setSharing(false);
        return;
      }
    } catch (_e) {}

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${student.name || 'Student'} LeetCode Achievements`,
          text: shareText,
        });
      } catch (_e) {}
    } else {
      await handleCopy();
    }
    setSharing(false);
  };

  // Handle Direct Copy functionality
  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_e) {}
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm sm:max-w-md bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-navy-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 animate-spin-slow" />
            <span className="font-bold text-slate-900 dark:text-white text-base">
              Achievement Card
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Mobile Rank Card Preview */}
        <div className="p-5 overflow-y-auto">
          <div 
            ref={cardRef}
            className="relative rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-slate-950 via-navy-950 to-blue-950 text-white shadow-2xl overflow-hidden border border-blue-500/30 space-y-4"
          >
            {/* Background Glow Accents */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>

            {/* Top User Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-semibold text-blue-400 tracking-wider uppercase block">
                  LEETCODE TRACKER
                </span>
                <h3 className="text-xl font-black text-white tracking-tight mt-0.5 truncate">
                  {student.name || 'Student'}
                </h3>
                <p className="text-xs text-slate-400 font-medium truncate">
                  {deptName} • {student.batch || 'Batch'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs shrink-0">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>{rankDisplay}</span>
              </div>
            </div>

            {/* Total Solved Main Display */}
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300 font-medium">Total Problems Solved</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-emerald-400 to-amber-300">
                    {totalSolved}
                  </span>
                  <span className="text-xs text-slate-400">Questions</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1 text-amber-400 font-bold text-sm">
                  <Flame className="w-4 h-4 fill-amber-400" />
                  {streak} Days
                </div>
                <span className="text-[10px] text-slate-400">Active Streak</span>
              </div>
            </div>

            {/* Difficulty Breakdown Grid */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[10px] font-semibold text-emerald-400 block uppercase">Easy</span>
                <span className="text-base font-bold text-emerald-300">{easy}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] font-semibold text-amber-400 block uppercase">Medium</span>
                <span className="text-base font-bold text-amber-300">{medium}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-[10px] font-semibold text-rose-400 block uppercase">Hard</span>
                <span className="text-base font-bold text-rose-300">{hard}</span>
              </div>
            </div>

            {/* Rating / Badge Footer */}
            <div className="pt-2 flex items-center justify-between border-t border-white/10 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>Rating: <strong className="text-white">{contestRating}</strong></span>
              </div>
              <div className="flex items-center gap-1 text-emerald-400 font-medium text-[11px]">
                <Award className="w-3.5 h-3.5" /> Verified Profile
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 bg-slate-50 dark:bg-navy-950 border-t border-slate-100 dark:border-navy-800 flex items-center gap-2.5">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-500 hover:to-blue-500 active:scale-95 text-white font-extrabold text-sm transition-all shadow-md shadow-brand-500/20 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{sharing ? 'Sharing...' : 'Share Rank Card'}</span>
          </button>
          
          <button
            onClick={handleCopy}
            className="flex items-center justify-center w-12 h-11 rounded-xl bg-slate-200 dark:bg-navy-800 hover:bg-slate-300 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-200 font-medium active:scale-95 transition-all cursor-pointer border border-slate-300/60 dark:border-navy-700 shrink-0"
            title="Copy Stats"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
