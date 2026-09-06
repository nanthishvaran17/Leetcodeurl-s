import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Radio, Zap, ShieldCheck, Sparkles } from 'lucide-react';

interface CountdownTimerProps {
  targetSeconds?: number;
  isLive?: boolean;
}

export function getIstSessionTiming(): {
  isLive: boolean;
  secondsRemaining: number;
  phase: 'COUNTDOWN_TODAY' | 'LIVE_NOW' | 'NEXT_WEEK';
  headerTitle: string;
  subTitle: string;
} {
  try {
    const now = new Date();
    // Format to Asia/Kolkata timezone components
    const istFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = istFormatter.formatToParts(now);
    const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);

    const year = getPart('year');
    const month = getPart('month') - 1; // 0-indexed month
    const dayDate = getPart('day');
    const hour = getPart('hour');
    const minute = getPart('minute');
    const second = getPart('second');

    const istDate = new Date(Date.UTC(year, month, dayDate, hour, minute, second));
    const dayOfWeek = istDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const secondsToday = hour * 3600 + minute * 60 + second;

    const startSec = 8 * 3600;         // 08:00:00 AM IST = 28,800s
    const endSec = 9 * 3600 + 30 * 60; // 09:30:00 AM IST = 34,200s

    if (dayOfWeek === 0) {
      // Sunday
      if (secondsToday < startSec) {
        // Before 8:00 AM today
        return {
          isLive: false,
          secondsRemaining: Math.max(0, startSec - secondsToday),
          phase: 'COUNTDOWN_TODAY',
          headerTitle: "Today's Sunday LeetCode Session",
          subTitle: 'Official Monitoring Window: 08:00 AM – 09:30 AM IST (Starts in)'
        };
      } else if (secondsToday <= endSec) {
        // 8:00 AM - 9:30 AM Live Window
        return {
          isLive: true,
          secondsRemaining: Math.max(0, endSec - secondsToday),
          phase: 'LIVE_NOW',
          headerTitle: 'SUNDAY SESSION LIVE NOW',
          subTitle: 'Official Monitoring Window: 08:00 AM – 09:30 AM IST (Remaining Time)'
        };
      } else {
        // After 9:30 AM today -> Next Sunday
        const secondsRemaining = (7 * 86400) - (secondsToday - startSec);
        return {
          isLive: false,
          secondsRemaining: Math.max(0, secondsRemaining),
          phase: 'NEXT_WEEK',
          headerTitle: 'Next Sunday LeetCode Session',
          subTitle: "Today's Session Completed • Next Window: Next Sunday 08:00 AM IST"
        };
      }
    } else {
      // Monday (1) through Saturday (6)
      const daysUntilSunday = (7 - dayOfWeek) % 7;
      const secondsRemaining = (daysUntilSunday * 86400) + (startSec - secondsToday);
      return {
        isLive: false,
        secondsRemaining: Math.max(0, secondsRemaining),
        phase: 'NEXT_WEEK',
        headerTitle: 'Next Sunday LeetCode Session',
        subTitle: 'Official Monitoring Window: 08:00 AM – 09:30 AM IST'
      };
    }
  } catch (_e) {
    return {
      isLive: false,
      secondsRemaining: 86400,
      phase: 'NEXT_WEEK',
      headerTitle: 'Next Sunday LeetCode Session',
      subTitle: 'Official Monitoring Window: 08:00 AM – 09:30 AM IST'
    };
  }
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetSeconds: _propTarget, isLive: propIsLive }) => {
  const [timing, setTiming] = useState(getIstSessionTiming);

  useEffect(() => {
    const updateTiming = () => {
      setTiming(getIstSessionTiming());
    };
    updateTiming();
    const interval = setInterval(updateTiming, 1000);
    return () => clearInterval(interval);
  }, []);

  const isSessionLive = propIsLive !== undefined ? propIsLive : timing.isLive;
  const secondsLeft = timing.secondsRemaining;

  const formatTime = (totalSeconds: number) => {
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0')
    };
  };

  const time = formatTime(secondsLeft);

  return (
    <motion.div
      whileHover={{ scale: 1.008 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`p-5 sm:p-6 rounded-3xl border transition-all duration-500 shadow-2xl relative overflow-hidden backdrop-blur-xl ${
        isSessionLive
          ? 'bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-600/20 dark:from-emerald-950/80 dark:via-slate-900/90 dark:to-teal-950/80 border-emerald-500/50 dark:border-emerald-400/50 shadow-emerald-500/20 dark:shadow-[0_0_40px_rgba(16,185,129,0.25)]'
          : 'bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-purple-500/10 dark:from-slate-900/90 dark:via-indigo-950/50 dark:to-purple-950/60 border-indigo-200/80 dark:border-indigo-500/40 shadow-indigo-500/10 dark:shadow-[0_0_30px_rgba(99,102,241,0.2)]'
      }`}
    >
      {/* Dynamic Ambient Background Glow Elements */}
      <div 
        className={`absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isSessionLive 
            ? 'bg-emerald-400/25 dark:bg-emerald-500/20 animate-pulse' 
            : 'bg-indigo-400/20 dark:bg-indigo-600/15'
        }`} 
      />
      <div 
        className={`absolute -bottom-16 -left-16 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          isSessionLive 
            ? 'bg-teal-400/20 dark:bg-teal-500/15' 
            : 'bg-purple-400/20 dark:bg-purple-600/15'
        }`} 
      />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 w-full relative z-10">
        
        {/* Left Section: Live Beacon & Title */}
        <div className="flex items-center space-x-4">
          
          {/* Glowing Animated Icon Badge */}
          <div className="relative flex items-center justify-center shrink-0">
            {isSessionLive ? (
              <>
                <span className="absolute -inset-2 rounded-2xl bg-emerald-500/40 blur-md animate-ping opacity-75" />
                <div className="relative p-3.5 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-300 dark:ring-emerald-400/40">
                  <Radio className="w-6 h-6 text-white animate-pulse" />
                </div>
              </>
            ) : (
              <div className="relative p-3.5 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-200 dark:ring-indigo-500/40">
                <Clock className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          {/* Titles and Badges */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h4 className="font-black text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                {isSessionLive ? (
                  <>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-600 dark:from-emerald-300 dark:via-teal-200 dark:to-emerald-400">
                      SUNDAY SESSION LIVE NOW
                    </span>
                  </>
                ) : (
                  <span className="text-slate-900 dark:text-white">
                    {timing.headerTitle}
                  </span>
                )}
              </h4>

              {/* Status Pill Badge */}
              {isSessionLive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-400/40 shadow-sm shadow-emerald-600/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span>LIVE WINDOW ACTIVE</span>
                </span>
              ) : timing.phase === 'COUNTDOWN_TODAY' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-500/20 text-brand-700 dark:text-brand-300 border border-brand-500/30 shadow-sm">
                  <Zap className="w-3 h-3 text-brand-600 dark:text-brand-400" />
                  <span>Starting Today</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-300/40 dark:border-indigo-500/30">
                  <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Weekly Automation</span>
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className={`w-4 h-4 shrink-0 ${isSessionLive ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
              <span>{timing.subTitle}</span>
            </p>
          </div>
        </div>

        {/* Right Section: Time Counter Digit Cards */}
        <div className="flex items-center space-x-2 sm:space-x-3 self-center sm:self-auto font-mono">
          {!isSessionLive && (
            <>
              {/* Days Box */}
              <div className="flex flex-col items-center">
                <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/40 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/20 min-w-[52px] sm:min-w-[62px] text-center">
                  <span className="text-2xl sm:text-3xl font-black tracking-tight">
                    {time.days}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold font-sans mt-1.5 uppercase tracking-widest text-indigo-700 dark:text-indigo-300">
                  DAYS
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-indigo-300 dark:text-indigo-500 mb-4">:</span>
            </>
          )}

          {/* Hours Box */}
          <div className="flex flex-col items-center">
            <div className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl min-w-[52px] sm:min-w-[62px] text-center shadow-md ring-1 transition-all ${
              isSessionLive 
                ? 'bg-white/95 dark:bg-slate-900/90 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/50 ring-emerald-500/30 shadow-emerald-500/15' 
                : 'bg-white/95 dark:bg-slate-900/90 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/40 ring-blue-500/20 shadow-blue-500/10'
            }`}>
              <span className="text-2xl sm:text-3xl font-black tracking-tight">
                {time.hours}
              </span>
            </div>
            <span className={`text-[10px] font-extrabold font-sans mt-1.5 uppercase tracking-widest ${
              isSessionLive ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'
            }`}>
              HOURS
            </span>
          </div>

          <span className={`text-xl sm:text-2xl font-black mb-4 ${
            isSessionLive ? 'text-emerald-400 dark:text-emerald-500 animate-pulse' : 'text-slate-300 dark:text-slate-600'
          }`}>:</span>

          {/* Minutes Box */}
          <div className="flex flex-col items-center">
            <div className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl min-w-[52px] sm:min-w-[62px] text-center shadow-md ring-1 transition-all ${
              isSessionLive 
                ? 'bg-white/95 dark:bg-slate-900/90 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/50 ring-emerald-500/30 shadow-emerald-500/15' 
                : 'bg-white/95 dark:bg-slate-900/90 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/40 ring-purple-500/20 shadow-purple-500/10'
            }`}>
              <span className="text-2xl sm:text-3xl font-black tracking-tight">
                {time.minutes}
              </span>
            </div>
            <span className={`text-[10px] font-extrabold font-sans mt-1.5 uppercase tracking-widest ${
              isSessionLive ? 'text-emerald-700 dark:text-emerald-300' : 'text-purple-700 dark:text-purple-300'
            }`}>
              MINS
            </span>
          </div>

          <span className={`text-xl sm:text-2xl font-black mb-4 ${
            isSessionLive ? 'text-emerald-400 dark:text-emerald-500 animate-pulse' : 'text-slate-300 dark:text-slate-600'
          }`}>:</span>

          {/* Seconds Box */}
          <div className="flex flex-col items-center">
            <div className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-2xl min-w-[52px] sm:min-w-[62px] text-center shadow-md ring-1 transition-all ${
              isSessionLive 
                ? 'bg-emerald-600 text-white dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-400/60 ring-emerald-400/40 shadow-emerald-600/30 animate-pulse' 
                : 'bg-white/95 dark:bg-slate-900/90 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/40 ring-rose-500/20 shadow-rose-500/10'
            }`}>
              <span className="text-2xl sm:text-3xl font-black tracking-tight">
                {time.seconds}
              </span>
            </div>
            <span className={`text-[10px] font-extrabold font-sans mt-1.5 uppercase tracking-widest ${
              isSessionLive ? 'text-emerald-700 dark:text-emerald-300 font-black' : 'text-rose-600 dark:text-rose-400'
            }`}>
              SECS
            </span>
          </div>

          {/* Audio Wave / Pulse Visualizer when Live */}
          {isSessionLive && (
            <div className="hidden sm:flex items-end space-x-1 h-8 pl-3 pb-4">
              <span className="w-1 bg-emerald-500 rounded-full animate-[bounce_0.8s_infinite_100ms] h-full" />
              <span className="w-1 bg-emerald-500 rounded-full animate-[bounce_0.8s_infinite_300ms] h-3/4" />
              <span className="w-1 bg-emerald-500 rounded-full animate-[bounce_0.8s_infinite_200ms] h-5/6" />
              <span className="w-1 bg-emerald-500 rounded-full animate-[bounce_0.8s_infinite_400ms] h-1/2" />
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
};
