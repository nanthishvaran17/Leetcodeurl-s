import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetSeconds: number;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetSeconds }) => {
  const [secondsLeft, setSecondsLeft] = useState(targetSeconds);

  useEffect(() => {
    setSecondsLeft(targetSeconds);
  }, [targetSeconds]);

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
    <div className="glass-card p-6 rounded-3xl border border-brand-500/20 bg-gradient-to-r from-brand-900/10 via-indigo-900/10 to-purple-900/10">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-500/30">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h4 className="font-extrabold text-base text-gray-900 dark:text-white">Next Sunday LeetCode Session</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">Official Monitoring Window: <b>08:00 AM – 09:30 AM IST</b></p>
          </div>
        </div>

        {/* Timer Numbers */}
        <div className="flex items-center space-x-3 font-mono">
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-extrabold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-brand-600 dark:text-brand-400">
              {time.days}
            </span>
            <span className="text-[10px] text-gray-400 font-sans mt-1 uppercase font-semibold">Days</span>
          </div>
          <span className="text-xl font-bold text-gray-400">:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-extrabold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">
              {time.hours}
            </span>
            <span className="text-[10px] text-gray-400 font-sans mt-1 uppercase font-semibold">Hours</span>
          </div>
          <span className="text-xl font-bold text-gray-400">:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-extrabold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100">
              {time.minutes}
            </span>
            <span className="text-[10px] text-gray-400 font-sans mt-1 uppercase font-semibold">Mins</span>
          </div>
          <span className="text-xl font-bold text-gray-400">:</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-extrabold px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-rose-500">
              {time.seconds}
            </span>
            <span className="text-[10px] text-gray-400 font-sans mt-1 uppercase font-semibold">Secs</span>
          </div>
        </div>

      </div>
    </div>
  );
};
