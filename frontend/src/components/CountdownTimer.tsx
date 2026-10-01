import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Radio, Zap, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CountdownTimerProps {
  targetSeconds?: number;
  isLive?: boolean;
}

export function getIstSessionTiming(userName: string = 'User'): {
  isLive: boolean;
  secondsRemaining: number;
  phase: 'COUNTDOWN_TODAY' | 'LIVE_NOW' | 'NEXT_WEEK';
  headerTitle: string;
  subTitle: string;
} {
  try {
    // Get absolute UTC milliseconds since epoch
    const nowMs = Date.now();
    // Calculate IST time using fixed offset (UTC + 5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTimeMs = nowMs + istOffset;
    const istDate = new Date(istTimeMs);

    // Extract IST time components using UTC methods on the shifted date
    const dayOfWeek = istDate.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = istDate.getUTCHours();
    const minute = istDate.getUTCMinutes();
    const second = istDate.getUTCSeconds();

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
          headerTitle: `${userName}'s Today Session`,
          subTitle: `Ready to code, ${userName}? 08:00 AM – 09:30 AM IST (Starts in)`
        };
      } else if (secondsToday <= endSec) {
        // 8:00 AM - 9:30 AM Live Window
        return {
          isLive: true,
          secondsRemaining: Math.max(0, endSec - secondsToday),
          phase: 'LIVE_NOW',
          headerTitle: `${userName.toUpperCase()} IS LIVE NOW`,
          subTitle: 'Focus time! 08:00 AM – 09:30 AM IST (Remaining Time)'
        };
      } else {
        // After 9:30 AM today -> Next Sunday
        const secondsRemaining = (7 * 86400) - (secondsToday - startSec);
        return {
          isLive: false,
          secondsRemaining: Math.max(0, secondsRemaining),
          phase: 'NEXT_WEEK',
          headerTitle: `${userName}'s Next Sunday Session`,
          subTitle: `Great work today, ${userName}! • Next: Sunday 08:00 AM IST`
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
        headerTitle: `${userName}'s Next Sunday Session`,
        subTitle: `Keep Grinding, ${userName}! • Next Window: 08:00 AM – 09:30 AM IST`
      };
    }
  } catch (_e) {
    return {
      isLive: false,
      secondsRemaining: 86400,
      phase: 'NEXT_WEEK',
      headerTitle: `${userName}'s Next Sunday Session`,
      subTitle: 'Official Monitoring Window: 08:00 AM – 09:30 AM IST'
    };
  }
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetSeconds: _propTarget, isLive: propIsLive }) => {
  const { user } = useAuth();
  const rawName = user?.name ? user.name.split(' ')[0] : 'Nanthish';
  const firstName = rawName.length > 12 ? rawName.substring(0, 12) + '...' : rawName;

  const [timing, setTiming] = useState(() => getIstSessionTiming(firstName));

  useEffect(() => {
    const updateTiming = () => {
      setTiming(getIstSessionTiming(firstName));
    };
    updateTiming();
    const interval = setInterval(updateTiming, 1000);
    return () => clearInterval(interval);
  }, [firstName]);

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
      whileHover={{ scale: 1.005 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`p-5 sm:p-7 rounded-3xl border transition-all duration-500 shadow-2xl relative overflow-hidden ${
        isSessionLive
          ? 'bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-950 border-emerald-500/40 shadow-emerald-950/50 text-white'
          : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 dark:from-navy-950 dark:via-indigo-950 dark:to-slate-950 border-indigo-400/30 shadow-indigo-950/40 text-white'
      }`}
    >
      {/* Dynamic Ambient Background Glow Elements */}
      <div 
        className={`absolute -top-20 -right-20 w-72 h-72 rounded-full blur-[90px] pointer-events-none transition-all duration-700 ${
          isSessionLive 
            ? 'bg-emerald-500/30 animate-pulse' 
            : 'bg-indigo-500/25'
        }`} 
      />
      <div 
        className={`absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-[90px] pointer-events-none transition-all duration-700 ${
          isSessionLive 
            ? 'bg-teal-400/25' 
            : 'bg-blue-500/20'
        }`} 
      />
      <div 
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 rounded-full blur-[110px] pointer-events-none transition-all duration-700 ${
          isSessionLive 
            ? 'bg-emerald-400/10' 
            : 'bg-violet-500/15'
        }`} 
      />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 w-full relative z-10">
        
        {/* Left Section: Live Beacon & Title */}
        <div className="flex items-center space-x-4">
          
          {/* Glowing Animated Icon Badge */}
          <div className="relative flex items-center justify-center shrink-0">
            {isSessionLive ? (
              <>
                <span className="absolute -inset-1.5 rounded-2xl bg-emerald-400/40 blur-md animate-ping opacity-75" />
                <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 border border-emerald-300/40 text-white shadow-lg shadow-emerald-500/30">
                  <Radio className="w-6 h-6 text-white animate-pulse stroke-[2.5]" />
                </div>
              </>
            ) : (
              <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 border border-indigo-300/40 text-white shadow-lg shadow-indigo-500/30">
                <Clock className="w-6 h-6 text-white stroke-[2.5]" />
              </div>
            )}
          </div>

          {/* Titles and Badges */}
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h4 className="font-black text-xl sm:text-2xl tracking-tight flex items-center gap-2 w-full">
                {isSessionLive ? (
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 truncate block w-full">
                    SUNDAY SESSION LIVE NOW
                  </span>
                ) : (
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-blue-200 drop-shadow-sm line-clamp-2 break-words max-w-full">
                    {timing.headerTitle}
                  </span>
                )}
              </h4>

              {/* Status Pill Badge */}
              {isSessionLive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/40 shadow-sm backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400"></span>
                  </span>
                  <span>LIVE WINDOW ACTIVE</span>
                </span>
              ) : timing.phase === 'COUNTDOWN_TODAY' ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm backdrop-blur-md">
                  <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Starting Today</span>
                </span>
              ) : null}
            </div>

            <p className="text-xs sm:text-sm font-bold text-indigo-200/90 flex items-start gap-1.5 mt-1">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span className="line-clamp-2 break-words max-w-full">{timing.subTitle}</span>
            </p>
          </div>
        </div>

        {/* Right Section: Time Counter Digit Cards */}
        <div className="flex items-center space-x-2 sm:space-x-3 self-center sm:self-auto font-mono">
          {!isSessionLive && (
            <>
              {/* Days Box */}
              <div className="flex flex-col items-center">
                <div className="px-4 py-3 rounded-2xl bg-indigo-950/80 backdrop-blur-md border border-indigo-400/40 text-white shadow-lg shadow-indigo-950/50 min-w-[60px] sm:min-w-[68px] text-center">
                  <span className="text-2xl sm:text-3xl font-mono font-black text-indigo-300 drop-shadow-[0_0_10px_rgba(165,180,252,0.4)]">
                    {time.days}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-extrabold mt-1.5 uppercase tracking-widest text-indigo-200/80">
                  DAYS
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-mono font-black text-indigo-300/60 mb-4">:</span>
            </>
          )}

          {/* Hours Box */}
          <div className="flex flex-col items-center">
            <div className="px-4 py-3 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-indigo-400/30 text-white shadow-lg shadow-slate-950/50 min-w-[60px] sm:min-w-[68px] text-center">
              <span className="text-2xl sm:text-3xl font-mono font-black text-cyan-300 drop-shadow-[0_0_10px_rgba(103,232,249,0.4)]">
                {time.hours}
              </span>
            </div>
            <span className="text-[10px] font-mono font-extrabold mt-1.5 uppercase tracking-widest text-indigo-200/80">
              HOURS
            </span>
          </div>

          <span className="text-xl sm:text-2xl font-mono font-black text-indigo-300/60 mb-4 animate-pulse">:</span>

          {/* Minutes Box */}
          <div className="flex flex-col items-center">
            <div className="px-4 py-3 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-indigo-400/30 text-white shadow-lg shadow-slate-950/50 min-w-[60px] sm:min-w-[68px] text-center">
              <span className="text-2xl sm:text-3xl font-mono font-black text-blue-300 drop-shadow-[0_0_10px_rgba(147,197,253,0.4)]">
                {time.minutes}
              </span>
            </div>
            <span className="text-[10px] font-mono font-extrabold mt-1.5 uppercase tracking-widest text-indigo-200/80">
              MINS
            </span>
          </div>

          <span className="text-xl sm:text-2xl font-mono font-black text-indigo-300/60 mb-4 animate-pulse">:</span>

          {/* Seconds Box - Neon Live Pill */}
          <div className="flex flex-col items-center">
            <div className={`px-4 py-3 rounded-2xl min-w-[60px] sm:min-w-[68px] text-center shadow-lg transition-all ${
              isSessionLive 
                ? 'bg-gradient-to-b from-emerald-500 to-teal-600 border border-emerald-300/50 text-white shadow-emerald-500/30 animate-pulse' 
                : 'bg-gradient-to-b from-indigo-500 via-indigo-600 to-blue-600 border border-indigo-300/50 text-white shadow-indigo-500/30'
            }`}>
              <span className="text-2xl sm:text-3xl font-mono font-black drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]">
                {time.seconds}
              </span>
            </div>
            <span className="text-[10px] font-mono font-extrabold mt-1.5 uppercase tracking-widest text-indigo-200/80">
              SECS
            </span>
          </div>

          {/* Live Activity Pulse Visualizer */}
          {isSessionLive && (
            <div className="hidden sm:flex items-end space-x-1 h-8 pl-3 pb-4">
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-full" />
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_300ms] h-3/4" />
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_200ms] h-5/6" />
              <span className="w-1 bg-emerald-400 rounded-full animate-[bounce_0.8s_infinite_400ms] h-1/2" />
            </div>
          )}
        </div>

      </div>
    </motion.div>
  );
};
