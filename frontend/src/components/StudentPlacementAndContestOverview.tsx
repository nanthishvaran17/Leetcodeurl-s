import React, { useState, useEffect } from 'react';
import { 
  Trophy, Clock, CheckCircle2, AlertCircle, ExternalLink, 
  Briefcase, Code, Sparkles, ChevronRight, Zap
} from 'lucide-react';

interface RecentSubmission {
  title: string;
  title_slug: string;
  lang: string;
  status: string;
  runtime?: string;
  memory?: string;
  date?: string;
  timestamp?: string;
}

interface StudentPlacementAndContestOverviewProps {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  contestRating?: number | null;
  recentSubmissions?: RecentSubmission[];
  studentName?: string;
}

export const StudentPlacementAndContestOverview: React.FC<StudentPlacementAndContestOverviewProps> = ({
  totalSolved,
  mediumSolved,
  hardSolved,
  contestRating,
  recentSubmissions = [],
}) => {
  // Weekly Contest (Sunday 08:00 AM - 09:30 AM IST only, NO Biweekly)
  const [countdown, setCountdown] = useState<{
    isLiveNow: boolean;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    formattedDate: string;
  }>({
    isLiveNow: false,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    formattedDate: '',
  });

  useEffect(() => {
    const calcCountdown = () => {
      const now = new Date();
      // IST offset (UTC + 5:30)
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const istNow = new Date(utc + 3600000 * 5.5);

      const day = istNow.getDay(); // 0 is Sunday
      const hour = istNow.getHours();
      const minute = istNow.getMinutes();

      let daysUntilSunday = (7 - day) % 7;
      const isPastContestToday = day === 0 && (hour > 9 || (hour === 9 && minute >= 30));
      const isLiveNow = day === 0 && (hour === 8 || (hour === 9 && minute < 30));

      if (isPastContestToday) {
        daysUntilSunday = 7;
      }

      const nextSundayDate = new Date(istNow);
      nextSundayDate.setDate(istNow.getDate() + daysUntilSunday);
      nextSundayDate.setHours(8, 0, 0, 0);

      const diffMs = Math.max(0, nextSundayDate.getTime() - istNow.getTime());
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diffMs / 1000 / 60) % 60);
      const seconds = Math.floor((diffMs / 1000) % 60);

      setCountdown({
        isLiveNow,
        days,
        hours,
        minutes,
        seconds,
        formattedDate: nextSundayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    };

    calcCountdown();
    const interval = setInterval(calcCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const ratingNum = contestRating && Number(contestRating) > 0 && Math.round(Number(contestRating)) !== 1500 
    ? Math.round(Number(contestRating)) 
    : 0;

  // Placement Readiness Tiers
  const placementGoals = [
    {
      title: 'Mass Recruiters (TCS, Infosys, Cognizant, Wipro)',
      reqDesc: '100+ Problems Solved',
      isEligible: totalSolved >= 100,
      progress: Math.min(100, Math.round((totalSolved / 100) * 100)),
      color: 'emerald',
    },
    {
      title: 'Product & Core (Zoho, Virtusa, Freshworks, Hexaware)',
      reqDesc: '200+ Solved (50+ Medium) & 1450+ Rating',
      isEligible: totalSolved >= 200 && mediumSolved >= 40 && ratingNum >= 1450,
      progress: Math.min(
        100,
        Math.round(
          (Math.min(totalSolved, 200) / 200) * 50 +
          (Math.min(mediumSolved, 40) / 40) * 25 +
          (ratingNum > 0 ? (Math.min(ratingNum, 1450) / 1450) * 25 : 0)
        )
      ),
      color: 'indigo',
    },
    {
      title: 'Dream & Tier-1 (Amazon, Google, Microsoft, PayPal)',
      reqDesc: '350+ Solved (100+ Medium, 20+ Hard) & 1650+ Rating',
      isEligible: totalSolved >= 350 && mediumSolved >= 80 && hardSolved >= 15 && ratingNum >= 1650,
      progress: Math.min(
        100,
        Math.round(
          (Math.min(totalSolved, 350) / 350) * 40 +
          (Math.min(mediumSolved, 80) / 80) * 30 +
          (ratingNum > 0 ? (Math.min(ratingNum, 1650) / 1650) * 30 : 0)
        )
      ),
      color: 'amber',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Upcoming Weekly Contest Countdown & Placement Readiness Tracker Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card A: Upcoming Weekly Contest (Weekly Contest Only) */}
        <div className="bg-white/80 dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/40 flex flex-col justify-between backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-brand-500/10 blur-3xl rounded-full pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Next Weekly Contest
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    Official College Contest Window (Sunday 8:00 AM)
                  </p>
                </div>
              </div>

              {countdown.isLiveNow ? (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  LIVE NOW
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 border border-brand-200/50 dark:border-brand-800/30">
                  Every Sunday
                </span>
              )}
            </div>

            {/* Countdown Display */}
            {countdown.isLiveNow ? (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/10 border border-rose-500/20 text-center my-3">
                <p className="text-lg font-black text-rose-600 dark:text-rose-400">
                  Weekly Contest is Live!
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                  Contest window closes at 09:30 AM IST. Submit your solutions on LeetCode now!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center my-3">
                <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono block">
                    {countdown.days}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Days
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono block">
                    {countdown.hours}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Hours
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono block">
                    {countdown.minutes}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Mins
                  </span>
                </div>
                <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/5">
                  <span className="text-xl sm:text-2xl font-black text-brand-600 dark:text-brand-400 font-mono block">
                    {countdown.seconds}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Secs
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-navy-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Sunday 08:00 AM - 09:30 AM IST
            </span>
            <span className="font-bold text-brand-600 dark:text-brand-400">
              Auto Leaderboard Sync Active
            </span>
          </div>
        </div>

        {/* Card B: Placement Readiness Goal Tracker */}
        <div className="bg-white/80 dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/40 flex flex-col justify-between backdrop-blur-xl relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none"></div>

          <div>
            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Placement Readiness Tracker
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    Campus placement criteria milestones
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                {totalSolved} Solved
              </span>
            </div>

            {/* Placement Tiers */}
            <div className="space-y-3 my-2">
              {placementGoals.map((g) => (
                <div key={g.title} className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate pr-2">
                      {g.title}
                    </span>
                    {g.isEligible ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Eligible
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        {g.progress}%
                      </span>
                    )}
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-navy-800 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        g.isEligible ? 'bg-emerald-500' : 'bg-gradient-to-r from-brand-500 to-indigo-500'
                      }`}
                      style={{ width: `${g.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                    <span>{g.reqDesc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Recent Submissions Timeline */}
      <div className="bg-white/80 dark:bg-slate-900/70 p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xl shadow-slate-200/50 dark:shadow-black/40 backdrop-blur-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Recent Submissions
              </h3>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Latest accepted algorithmic solutions verified from LeetCode
              </p>
            </div>
          </div>

          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {recentSubmissions.length} Recent Verified
          </span>
        </div>

        {recentSubmissions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Sparkles className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
            <p>No recent submissions synced yet. Click "Sync Live" to fetch latest activity.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentSubmissions.map((sub, idx) => (
              <a
                key={idx}
                href={`https://leetcode.com/problems/${sub.title_slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5 hover:border-brand-500/40 hover:-translate-y-0.5 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20">
                      {sub.status || 'Accepted'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                      {sub.lang}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors line-clamp-2">
                    {sub.title}
                  </h4>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 dark:border-white/5 text-[10px] text-slate-400">
                  <span>{sub.date || 'Recent'}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-brand-500 transition-colors" />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
export default StudentPlacementAndContestOverview;