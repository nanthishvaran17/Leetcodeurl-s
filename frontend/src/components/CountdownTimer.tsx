import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Radio, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CountdownTimerProps {
  targetSeconds?: number;
  isLive?: boolean;
}

export const MOTIVATIONAL_HOOKS = [
  (name: string) => `Keep Grinding, ${name}!`,
  (name: string) => `Consistency beats intensity, ${name}!`,
  (name: string) => `One problem a day builds mastery, ${name}!`,
  (name: string) => `Debug your limits & elevate your logic, ${name}!`,
  (name: string) => `Small daily code reps build big careers, ${name}!`,
  (name: string) => `Master the patterns, conquer the contest, ${name}!`,
  (name: string) => `Sharpen your skills for Sunday's arena, ${name}!`,
  (name: string) => `Algorithms get sharper with practice, ${name}!`,
  (name: string) => `Every accepted submission counts, ${name}!`,
  (name: string) => `Turn tough bugs into deep breakthroughs, ${name}!`,
  (name: string) => `Break complex challenges into simple wins, ${name}!`,
  (name: string) => `Stay focused, stay persistent, ${name}!`,
];

export function getIstSessionTiming(userName: string = 'User', customMotivation?: string): {
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
      const motivation = customMotivation || `Keep Grinding, ${userName}!`;
      return {
        isLive: false,
        secondsRemaining: Math.max(0, secondsRemaining),
        phase: 'NEXT_WEEK',
        headerTitle: `${userName}'s Next Sunday Session`,
        subTitle: `${motivation} • Next Window: 08:00 AM – 09:30 AM IST`
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
  const rawName = user?.name ? user.name.split(' ')[0] : 'Admin';
  const firstName = rawName.length > 12 ? rawName.substring(0, 12) + '...' : rawName;
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : 'Admin';

  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_HOOKS.length));

  useEffect(() => {
    const quoteInterval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % MOTIVATIONAL_HOOKS.length);
    }, 6000);
    return () => clearInterval(quoteInterval);
  }, []);

  const [timing, setTiming] = useState(() => getIstSessionTiming(displayName, MOTIVATIONAL_HOOKS[quoteIndex](displayName)));

  useEffect(() => {
    const updateTiming = () => {
      setTiming(getIstSessionTiming(displayName, MOTIVATIONAL_HOOKS[quoteIndex](displayName)));
    };
    updateTiming();
    const interval = setInterval(updateTiming, 1000);
    return () => clearInterval(interval);
  }, [displayName, quoteIndex]);

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
      whileHover={{ scale: 1.002 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`p-5 sm:p-7 rounded-3xl border transition-all duration-500 relative overflow-hidden backdrop-blur-xl ${
        isSessionLive
          ? 'bg-white border-emerald-200/90 shadow-[0_10px_35px_-8px_rgba(16,185,129,0.15),0_4px_12px_rgba(0,0,0,0.02)]'
          : 'bg-white border-slate-200/90 shadow-[0_10px_35px_-8px_rgba(99,102,241,0.12),0_4px_12px_rgba(0,0,0,0.02)]'
      }`}
    >
      {/* Soft Pastel Ambient Glow Halos (Clean White Atmosphere) */}
      <div 
        className={`absolute -top-24 -right-24 w-80 h-80 rounded-full blur-[90px] pointer-events-none transition-all duration-700 ${
          isSessionLive 
            ? 'bg-emerald-100/70' 
            : 'bg-indigo-100/60'
        }`} 
      />
      <div 
        className={`absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-[90px] pointer-events-none transition-all duration-700 ${
          isSessionLive 
            ? 'bg-teal-100/60' 
            : 'bg-blue-100/60'
        }`} 
      />

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 w-full relative z-10">
        
        {/* Left Section: Live Beacon & Title */}
        <div className="flex items-center space-x-4">
          
          {/* Animated Icon Badge */}
          <div className="relative flex items-center justify-center shrink-0">
            {isSessionLive ? (
              <>
                <span className="absolute -inset-1 rounded-2xl bg-emerald-400/30 blur-sm animate-ping opacity-60" />
                <div className="relative p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 border border-emerald-400/40 flex items-center justify-center">
                  <Radio className="w-6 h-6 text-white animate-pulse stroke-[2.5]" />
                </div>
              </>
            ) : (
              <div className="relative p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-brand-500 via-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/25 border border-indigo-400/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-white stroke-[2.5]" />
              </div>
            )}
          </div>

          {/* Titles and Badges */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h4 className="font-black text-xl sm:text-2xl tracking-tight flex items-center gap-2 w-full text-slate-900">
                {isSessionLive ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-900 font-black">SUNDAY SESSION</span>
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 font-black">
                      LIVE NOW
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-900 font-black line-clamp-2 break-words max-w-full">
                    {timing.headerTitle}
                  </span>
                )}
              </h4>

              {/* Status Pill Badge */}
              {isSessionLive ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200/90 shadow-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                  </span>
                  <span>LIVE WINDOW ACTIVE</span>
                </span>
              ) : timing.phase === 'COUNTDOWN_TODAY' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>STARTING TODAY</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-black uppercase tracking-wider bg-brand-50 text-brand-700 border border-brand-200 shadow-xs">
                  <Clock className="w-3.5 h-3.5 text-brand-600" />
                  <span>COUNTDOWN ACTIVE</span>
                </span>
              )}
            </div>

            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs sm:text-[13px] font-bold shadow-xs transition-colors duration-300 ${
              isSessionLive
                ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-800'
                : 'bg-slate-50 border border-slate-200 text-slate-700'
            }`}>
              <div className="line-clamp-2 break-words max-w-full overflow-hidden">
                {timing.phase === 'NEXT_WEEK' && !isSessionLive ? (
                  <span className="inline-flex items-center gap-1.5 flex-wrap">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={quoteIndex}
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.3 }}
                        className="text-slate-900 font-extrabold"
                      >
                        {MOTIVATIONAL_HOOKS[quoteIndex](displayName)}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-slate-500 font-medium">• Next Window: 08:00 AM – 09:30 AM IST</span>
                  </span>
                ) : (
                  <span>{timing.subTitle}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Time Counter Digit Cards (Clean White Elevated Cards) */}
        <div className="flex items-center space-x-2 sm:space-x-3 self-center sm:self-auto font-mono">
          {!isSessionLive && (
            <>
              {/* Days Box */}
              <div className="flex flex-col items-center">
                <div className="relative px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-sm min-w-[58px] sm:min-w-[66px] text-center">
                  <span className="text-2xl sm:text-3xl font-mono font-black text-slate-800">
                    {time.days}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-black mt-1.5 uppercase tracking-widest text-slate-500">
                  DAYS
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-mono font-black text-slate-300 mb-4 animate-pulse">:</span>
            </>
          )}

          {/* Hours Box */}
          <div className="flex flex-col items-center">
            <div className="relative px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-sm min-w-[58px] sm:min-w-[66px] text-center">
              <span className="text-2xl sm:text-3xl font-mono font-black text-slate-800">
                {time.hours}
              </span>
            </div>
            <span className="text-[10px] font-mono font-black mt-1.5 uppercase tracking-widest text-slate-500">
              HOURS
            </span>
          </div>

          <span className="text-xl sm:text-2xl font-mono font-black text-slate-300 mb-4 animate-pulse">:</span>

          {/* Minutes Box */}
          <div className="flex flex-col items-center">
            <div className="relative px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-slate-50/90 border border-slate-200/90 shadow-sm min-w-[58px] sm:min-w-[66px] text-center">
              <span className="text-2xl sm:text-3xl font-mono font-black text-slate-800">
                {time.minutes}
              </span>
            </div>
            <span className="text-[10px] font-mono font-black mt-1.5 uppercase tracking-widest text-slate-500">
              MINS
            </span>
          </div>

          <span className="text-xl sm:text-2xl font-mono font-black text-slate-300 mb-4 animate-pulse">:</span>

          {/* Seconds Box - Hero Accent Card on White */}
          <div className="flex flex-col items-center">
            <div className={`relative px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl min-w-[58px] sm:min-w-[66px] text-center shadow-sm transition-all ${
              isSessionLive 
                ? 'bg-gradient-to-b from-emerald-50 to-emerald-100/60 border border-emerald-300 shadow-emerald-500/10' 
                : 'bg-gradient-to-b from-brand-50 to-indigo-100/60 border border-brand-300 shadow-brand-500/10'
            }`}>
              <span className={`text-2xl sm:text-3xl font-mono font-black ${
                isSessionLive 
                  ? 'text-emerald-600' 
                  : 'text-brand-600'
              }`}>
                {time.seconds}
              </span>
            </div>
            <span className={`text-[10px] font-mono font-black mt-1.5 uppercase tracking-widest ${
              isSessionLive ? 'text-emerald-700' : 'text-brand-700'
            }`}>
              SECS
            </span>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
