import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Radio } from 'lucide-react';

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
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={`glass-card p-6 rounded-3xl border transition-all duration-500 shadow-xl relative overflow-hidden ${
        isSessionLive 
          ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 shadow-emerald-950/30' 
          : 'border-brand-500/20 bg-gradient-to-r from-brand-900/10 via-indigo-900/10 to-purple-900/10'
      }`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 w-full">
        
        <div className="flex items-center space-x-3.5">
          <div className={`p-3 rounded-2xl text-white shadow-lg ${
            isSessionLive ? 'bg-emerald-600 shadow-emerald-500/40 animate-pulse' : 'bg-brand-600 shadow-brand-500/30'
          }`}>
            {isSessionLive ? <Radio className="w-6 h-6 animate-pulse text-white" /> : <Clock className="w-6 h-6 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-black text-base text-gray-900 dark:text-white">
                {isSessionLive ? 'SUNDAY SESSION LIVE NOW' : timing.headerTitle}
              </h4>
              {isSessionLive ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
                  Live Window
                </span>
              ) : timing.phase === 'COUNTDOWN_TODAY' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  Starting Today
                </span>
              ) : null}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {timing.subTitle}
            </p>
          </div>
        </div>

        {/* Timer Numbers */}
        <div className="flex items-center space-x-3 font-mono">
          {!isSessionLive && (
            <>
              <div className="flex flex-col items-center">
                <span className="text-2xl md:text-3xl font-extrabold px-3 py-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-brand-600 dark:text-brand-400 shadow-sm">
                  {time.days}
                </span>
                <span className="text-[10px] text-gray-400 font-sans mt-1 uppercase font-bold">Days</span>
              </div>
              <span className="text-xl font-black text-gray-400">:</span>
            </>
          )}
          <div className="flex flex-col items-center">
            <span className={`text-2xl md:text-3xl font-extrabold px-3 py-1.5 rounded-2xl shadow-sm ${
              isSessionLive 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
            }`}>
              {time.hours}
            </span>
            <span className="text-[10px] text-gray-400 font-sans mt-1 uppercase font-bold">Hours</span>
          </div>
          <span className="text-xl font-black text-gray-400">:</span>
          <div className="flex flex-col items-center">
            <span className={`text-2xl md:text-3xl font-extrabold px-3 py-1.5 rounded-2xl shadow-sm ${
              isSessionLive 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
            }`}>
              {time.minutes}
            </span>
            <span className="text-[10px] text-gray-400 font-sans mt-1 uppercase font-bold">Mins</span>
          </div>
          <span className="text-xl font-black text-gray-400">:</span>
          <div className="flex flex-col items-center">
            <span className={`text-2xl md:text-3xl font-extrabold px-3 py-1.5 rounded-2xl shadow-sm ${
              isSessionLive 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                : 'bg-gray-100 dark:bg-gray-800 text-rose-500 dark:text-rose-400'
            }`}>
              {time.seconds}
            </span>
            <span className="text-[10px] text-gray-400 font-sans mt-1 uppercase font-bold">Secs</span>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

