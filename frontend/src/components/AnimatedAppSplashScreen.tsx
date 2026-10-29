import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../utils/haptics';

interface AnimatedAppSplashScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

export const AnimatedAppSplashScreen: React.FC<AnimatedAppSplashScreenProps> = ({
  onComplete,
  minDurationMs = 1250
}) => {
  const [phase, setPhase] = useState<'initializing' | 'connecting' | 'restoring' | 'ready'>('initializing');
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Stage 1: Initializing
    triggerHaptic('light');

    const t1 = setTimeout(() => {
      setPhase('connecting');
    }, Math.floor(minDurationMs * 0.3));

    const t2 = setTimeout(() => {
      setPhase('restoring');
    }, Math.floor(minDurationMs * 0.65));

    const t3 = setTimeout(() => {
      setPhase('ready');
      triggerHaptic('success');
    }, Math.floor(minDurationMs * 0.9));

    const tExit = setTimeout(() => {
      setIsExiting(true);
      if (onComplete) {
        onComplete();
      }
    }, minDurationMs);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tExit);
    };
  }, [minDurationMs, onComplete]);

  const phaseLabel = {
    initializing: 'Booting Secure Workspace...',
    connecting: 'Syncing Institutional Telemetry...',
    restoring: 'Calibrating Forensic Engine...',
    ready: 'Welcome to Nandha Intelligence'
  }[phase];

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="nec-splash-screen"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.06,
            filter: 'blur(10px)',
            transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
          }}
          className="fixed inset-0 z-[100099] flex flex-col items-center justify-center bg-[#050814] text-white select-none overflow-hidden touch-none"
        >
          {/* Ambient Radial Mesh Lights (Swiggy / Cred Ambient Aesthetic) */}
          <div className="absolute top-1/4 -right-20 w-80 h-80 rounded-full bg-indigo-600/15 blur-[90px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 -left-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-[90px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-brand-500/10 blur-[110px] pointer-events-none" />

          {/* Centered Brand Emblem Architecture */}
          <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-sm">
            {/* Logo Outer Halo Rings */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-6"
            >
              {/* Outer Glowing Ring */}
              <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-brand-500/25 via-indigo-500/20 to-teal-400/25 blur-md animate-pulse" />
              
              {/* Glass Capsule Badge */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-slate-900/90 border border-white/15 p-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center backdrop-blur-xl">
                <img
                  src="/nec_25_logo.webp"
                  alt="NEC Silver Jubilee Logo"
                  className="w-full h-full object-contain rounded-2xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                  onError={(e: any) => {
                    // Graceful fallback to emblem if webp missing
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/nandha_emblem.png';
                  }}
                />
              </div>

              {/* Status Indicator Dot */}
              <div className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-[#050814]" />
              </div>
            </motion.div>

            {/* Typography & Subtitles */}
            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-1.5"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-mono font-bold text-indigo-300 tracking-wider uppercase mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Nandha Engineering College</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display bg-gradient-to-r from-white via-indigo-100 to-teal-200 bg-clip-text text-transparent uppercase drop-shadow-sm">
                NANDHA INTELLIGENCE
              </h1>

              <p className="text-xs text-slate-400 font-medium tracking-wide">
                Autonomous LeetCode Contest Forensics &amp; Roster Intelligence
              </p>
            </motion.div>

            {/* Sleek Minimal Progress Track (Swiggy / Airtel / Apple style) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="mt-8 flex flex-col items-center space-y-2.5 w-full max-w-[200px]"
            >
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative shadow-inner">
                <motion.div
                  className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-teal-400 rounded-full"
                  initial={{ width: '12%' }}
                  animate={{
                    width: phase === 'initializing' ? '30%' : phase === 'connecting' ? '65%' : phase === 'restoring' ? '90%' : '100%'
                  }}
                  transition={{ duration: 0.35, ease: 'easeInOut' }}
                />
              </div>

              <span className="text-[10px] font-mono font-semibold text-slate-400 tracking-wide transition-all duration-200">
                {phaseLabel}
              </span>
            </motion.div>
          </div>

          {/* Bottom Security Watermark */}
          <div className="absolute bottom-6 inset-x-0 flex flex-col items-center justify-center text-center space-y-0.5 pointer-events-none">
            <span className="text-[9.5px] font-mono font-bold text-slate-500 uppercase tracking-widest">
              NANDHA AUTONOMOUS PORTAL • SECURE CLOUD
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
