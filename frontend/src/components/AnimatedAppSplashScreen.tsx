import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../utils/haptics';

interface AnimatedAppSplashScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

/**
 * Trending World-Class Ultra-Clean Light-Theme Launch Screen
 * Modeled after Apple iOS, Swiggy, Cred (Light), and Stripe.
 * Pure luminous porcelain backdrop, vibrant institutional insignia,
 * and physics-based fluid spring animations.
 */
export const AnimatedAppSplashScreen: React.FC<AnimatedAppSplashScreenProps> = ({
  onComplete,
  minDurationMs = 1150
}) => {
  const [statusText, setStatusText] = useState('Connecting to Campus Roster...');
  const [progress, setProgress] = useState(25);
  const [isReadyToExit, setIsReadyToExit] = useState(false);

  useEffect(() => {
    // 1. Initial micro-haptic upon app mount
    triggerHaptic('light');

    // 2. Asset pre-flight: ensure logo is pre-cached
    const preloadImg = new Image();
    preloadImg.src = '/round_logo.png';

    const t1 = setTimeout(() => {
      setStatusText('Syncing Contest Forensics...');
      setProgress(72);
    }, 420);

    const t2 = setTimeout(() => {
      setStatusText('Workspace Ready');
      setProgress(100);
      triggerHaptic('selection');
    }, 850);

    const tExit = setTimeout(() => {
      setIsReadyToExit(true);
      triggerHaptic('light');
      if (onComplete) {
        setTimeout(onComplete, 400);
      }
    }, minDurationMs);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tExit);
    };
  }, [minDurationMs, onComplete]);

  return (
    <AnimatePresence>
      {!isReadyToExit && (
        <motion.div
          key="trending-light-splash-screen"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.05,
            transition: {
              duration: 0.38,
              ease: [0.16, 1, 0.3, 1] // Apple Spring deceleration
            }
          }}
          className="fixed inset-0 z-[100099] flex flex-col items-center justify-between bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFC] to-[#F1F5F9] text-slate-900 select-none overflow-hidden touch-none"
        >
          {/* Subtle Ambient Light Gradients (Clean Pastel Atmosphere) */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Luminous Top Arc - Soft Nandha Cyan */}
            <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[600px] h-[340px] bg-gradient-to-b from-sky-400/15 via-blue-500/08 to-transparent rounded-full blur-[90px]" />
            
            {/* Ambient Golden Warmth Center Accent */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] bg-gradient-to-tr from-amber-400/10 via-indigo-400/08 to-transparent rounded-full blur-[80px]" />

            {/* Microscopic Studio Dot Matrix */}
            <div 
              className="absolute inset-0 opacity-[0.045] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #002B49 1px, transparent 0)',
                backgroundSize: '24px 24px'
              }}
            />
          </div>

          {/* Top Bar Status */}
          <div 
            className="w-full px-5 sm:px-8 flex items-center justify-between"
            style={{ paddingTop: 'max(env(safe-area-inset-top, 0px) + 0.75rem, 1.75rem)' }}
          >
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/40" />
              <span className="text-[10px] font-mono tracking-[0.22em] text-slate-500 font-bold uppercase">
                NEC TELEMETRY
              </span>
            </div>
            <span className="text-[9.5px] font-mono tracking-[0.24em] text-sky-700 font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-200/80 shadow-2xs">
              AUTONOMOUS
            </span>
          </div>

          {/* Centerpiece: Clean White Ceramic Jewel Emblem */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 text-center w-full max-w-lg my-auto">
            {/* Floating Insignia Tile */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-6 flex items-center justify-center"
            >
              {/* Outer Golden/Cyan Aura Halo */}
              <div className="absolute -inset-4 rounded-[36px] bg-gradient-to-tr from-amber-300/30 via-sky-300/25 to-indigo-300/20 blur-xl opacity-75 animate-pulse" />

              {/* White Ceramic Jewel Card */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-[30px] bg-white border border-slate-200/90 p-3 shadow-[0_20px_45px_rgba(0,43,73,0.12),0_4px_12px_rgba(0,0,0,0.04)] flex items-center justify-center overflow-hidden">
                {/* 45-degree Specular Light Reflection Sweep */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-30"
                  style={{
                    background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.9) 50%, transparent 65%)',
                    animation: 'sheenSweep 3s ease-in-out infinite'
                  }}
                />

                <img
                  src="/round_logo.png"
                  alt="Nandha 25th Silver Jubilee Emblem"
                  className="w-full h-full object-contain relative z-10 drop-shadow-[0_4px_10px_rgba(0,43,73,0.15)]"
                  onError={(e: any) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/nec_25_years_logo.png';
                  }}
                />
              </div>
            </motion.div>

            {/* Typography & Identity */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-1.5"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50/80 border border-sky-200/60 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#006A94]" />
                <span className="text-[10.5px] font-bold text-[#006A94] tracking-wider uppercase">
                  Nandha Engineering College
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-[#002B49] uppercase">
                NANDHA INTELLIGENCE
              </h1>

              <p className="text-xs text-slate-500 font-semibold tracking-wide">
                Competitive Programming Forensics &amp; Roster Platform
              </p>
            </motion.div>

            {/* Trending Modern Status Capsule (Swiggy / Apple style) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.35 }}
              className="mt-8 flex flex-col items-center space-y-3"
            >
              {/* Progress Rail */}
              <div className="w-48 h-1 bg-slate-200/80 rounded-full overflow-hidden relative shadow-inner">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#006A94] via-indigo-500 to-teal-400 rounded-full"
                  initial={{ width: '15%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              {/* Status Capsule Pill */}
              <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/80 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                <span className="text-[10px] font-mono font-bold text-slate-700 tracking-wider">
                  {statusText}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Bottom Accreditation Badge */}
          <div 
            className="w-full px-4 text-center flex flex-col items-center justify-center"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 1.25rem, 1.75rem)' }}
          >
            <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-full bg-slate-100/95 border border-slate-200/90 shadow-2xs max-w-[94vw]">
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 tracking-wide uppercase">
                Autonomous Institution
              </span>
              <span className="text-slate-400 font-bold">•</span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 tracking-wide uppercase">
                Affiliated to Anna University
              </span>
            </div>
            <p className="mt-1.5 text-[9px] sm:text-[9.5px] font-semibold text-slate-500 tracking-wider uppercase">
              Accredited by NAAC with &apos;A+&apos; Grade &amp; NBA
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
