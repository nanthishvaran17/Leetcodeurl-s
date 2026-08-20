import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Radio, Activity } from 'lucide-react';

interface CountdownTimerProps {
  targetSeconds: number;
  isLive?: boolean;
}

function getIstLiveStatus(): { isLive: boolean; secondsRemaining: number } {
  try {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ist = new Date(utc + (3600000 * 5.5));

    const day = ist.getDay(); // 0 = Sunday
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const seconds = ist.getSeconds();
    const timeInSec = hours * 3600 + minutes * 60 + seconds;

    const startSec = 8 * 3600;         // 08:00 AM IST = 28800s
    const endSec = 9 * 3600 + 30 * 60; // 09:30 AM IST = 34200s

    if (day === 0 && timeInSec >= startSec && timeInSec <= endSec) {
      return { isLive: true, secondsRemaining: endSec - timeInSec };
    }
  } catch {
    // fallback
  }
  return { isLive: false, secondsRemaining: 0 };
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetSeconds, isLive: propIsLive }) => {
  const istStatus = getIstLiveStatus();
  const isSessionLive = propIsLive !== undefined ? propIsLive : istStatus.isLive;
  
  const initialSeconds = isSessionLive && istStatus.isLive ? istStatus.secondsRemaining : targetSeconds;
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    const currentIst = getIstLiveStatus();
    if (currentIst.isLive) {
      setSecondsLeft(currentIst.secondsRemaining);
    } else {
      setSecondsLeft(targetSeconds);
    }
  }, [targetSeconds, propIsLive]);

  useEffect(() => {
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

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
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center space-x-3.5">
          <div className={`p-3 rounded-2xl text-white shadow-lg ${
            isSessionLive ? 'bg-emerald-600 shadow-emerald-500/40 animate-pulse' : 'bg-brand-600 shadow-brand-500/30'
          }`}>
            {isSessionLive ? <Radio className="w-6 h-6 animate-pulse text-white" /> : <Clock className="w-6 h-6 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-black text-base text-gray-900 dark:text-white">
                {isSessionLive ? '🟢 SUNDAY SESSION LIVE NOW' : 'Next Sunday LeetCode Session'}
              </h4>
              {isSessionLive && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
                  Live Window
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isSessionLive 
                ? 'Official Monitoring Window: 08:00 AM – 09:30 AM IST (Remaining Time)'
                : 'Official Monitoring Window: 08:00 AM – 09:30 AM IST'
              }
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
