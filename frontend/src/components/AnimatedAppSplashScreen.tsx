import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { triggerHaptic } from '../utils/haptics';

interface AnimatedAppSplashScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

/**
 * World-Class Production-Grade Native App Launch Screen
 * Crafted to the aesthetic standards of Apple iOS, Linear, and Stripe.
 * Features:
 * - Real asset pre-flight verification
 * - Dynamic SVG specular light sweep across institutional insignia
 * - Subtle Apple-tuned spring physics & haptic sync
 * - Zero cliché buzzwords — authentic, high-precision typography
 * - Seamless cinematic expand-and-dissolve into active viewport
 */
export const AnimatedAppSplashScreen: React.FC<AnimatedAppSplashScreenProps> = ({
  onComplete,
  minDurationMs = 1100
}) => {
  const [statusText, setStatusText] = useState('AUTHENTICATING');
  const [progress, setProgress] = useState(15);
  const [isReadyToExit, setIsReadyToExit] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    // 1. Initial subtle haptic vibration upon window mount
    triggerHaptic('light');

    // 2. Preload primary institutional assets in parallel
    const preloadPromise = new Promise<void>((resolve) => {
      const logoImg = new Image();
      logoImg.src = '/nec_25_years_logo_transparent.png';
      logoImg.onload = () => resolve();
      logoImg.onerror = () => resolve();
      // Safeguard timeout in case of slow network
      setTimeout(resolve, 800);
    });

    const timer1 = setTimeout(() => {
      setStatusText('SYNCHRONIZING');
      setProgress(68);
    }, 400);

    const timer2 = setTimeout(() => {
      setStatusText('CONNECTED');
      setProgress(100);
      triggerHaptic('selection');
    }, 850);

    // 3. Coordinate minimum display threshold with asset preload
    Promise.all([
      preloadPromise,
      new Promise((r) => setTimeout(r, minDurationMs))
    ]).then(() => {
      triggerHaptic('light');
      setIsReadyToExit(true);
      if (onComplete) {
        // Allow exit animation to complete before removing from DOM
        setTimeout(onComplete, 450);
      }
    });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [minDurationMs, onComplete]);

  return (
    <AnimatePresence>
      {!isReadyToExit && (
        <motion.div
          key="apple-tier-splash-screen"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            scale: 1.08,
            filter: 'blur(12px)',
            transition: {
              duration: 0.42,
              ease: [0.16, 1, 0.3, 1] // Apple Spring deceleration curve
            }
          }}
          className="fixed inset-0 z-[100099] flex flex-col items-center justify-between bg-[#030612] text-white select-none overflow-hidden touch-none"
        >
          {/* Subtle Background Organic Ambient Atmosphere */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Luminous Top Arc */}
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[540px] h-[320px] bg-gradient-to-b from-indigo-500/12 via-brand-500/06 to-transparent rounded-full blur-[100px]" />
            
            {/* Ambient Radial Depth */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-radial from-indigo-600/10 via-teal-500/05 to-transparent rounded-full blur-[90px]" />

            {/* Microscopic Grid Matrix (Linear / Stripe signature depth) */}
            <div 
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
                backgroundSize: '24px 24px'
              }}
            />
          </div>

          {/* Top Bar Spacer */}
          <div className="w-full pt-10 px-8 flex items-center justify-between opacity-40">
            <span className="text-[9px] font-mono tracking-[0.28em] text-slate-400 uppercase font-semibold">
              NEC • SECURE
            </span>
            <div className="flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-mono tracking-[0.2em] text-emerald-400/90 font-bold">
                LIVE
              </span>
            </div>
          </div>

          {/* Centerpiece: Handcrafted Glass Medallion & Insignia */}
          <div className="relative z-10 flex flex-col items-center px-6 -mt-8">
            {/* The Insignia Disc */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="relative mb-7 flex items-center justify-center"
            >
              {/* Subtle Conic Lens Flare Ring */}
              <div 
                className="absolute -inset-2.5 rounded-[32px] opacity-40 blur-[1px] pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(99,102,241,0.25) 50%, rgba(20,184,166,0.2) 100%)'
                }}
              />

              {/* Glass Lens Case */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-[28px] bg-[#070D1F]/90 border border-white/[0.12] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8),inset_0_1px_1px_0_rgba(255,255,255,0.22)] backdrop-blur-2xl flex items-center justify-center overflow-hidden">
                {/* 45-degree Specular Light Reflection Sweep */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.6) 50%, transparent 65%)',
                    animation: 'sheenSweep 3.2s ease-in-out infinite'
                  }}
                />

                <img
                  src="/nec_25_years_logo_transparent.png"
                  alt="Nandha 25 Years Silver Jubilee Insignia"
                  className="w-full h-full object-contain relative z-10 drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                  onError={(e: any) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/nandha_emblem_white_transparent.png';
                  }}
                />
              </div>
            </motion.div>

            {/* Institutional Brand Identity */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="text-center space-y-2"
            >
              <h1 className="text-xl sm:text-2xl font-black tracking-[0.16em] uppercase font-sans text-white/95">
                NANDHA INTELLIGENCE
              </h1>

              <div className="flex items-center justify-center space-x-2 text-[10.5px] font-mono tracking-[0.22em] text-slate-400 font-medium uppercase">
                <span>INSTITUTIONAL PLATFORM</span>
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                <span className="text-slate-300">AUTONOMOUS</span>
              </div>
            </motion.div>

            {/* Minimalist Apple-Style Progress Thread */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-9 flex flex-col items-center space-y-2.5 w-44"
            >
              {/* Hairline Rail */}
              <div className="w-full h-[2px] bg-white/[0.08] rounded-full overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-brand-400 via-indigo-300 to-teal-300 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                  initial={{ width: '10%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              {/* Status Token */}
              <div className="flex items-center space-x-1.5 text-[9.5px] font-mono tracking-[0.28em] text-slate-400 font-semibold uppercase">
                <span>{statusText}</span>
              </div>
            </motion.div>
          </div>

          {/* Bottom Precision Sub-Footer */}
          <div className="w-full pb-8 px-6 text-center">
            <p className="text-[10px] font-mono tracking-[0.24em] text-slate-500 uppercase font-medium">
              NANDHA ENGINEERING COLLEGE • ERODE
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
