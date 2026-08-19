// frontend/src/utils/useCountUp.ts
import { useState, useEffect } from 'react';

/**
 * Smoothly animates a numeric value from 0 (or previous value) to target value.
 * Fully GPU-friendly with requestAnimationFrame and respects prefers-reduced-motion.
 */
export function useCountUp(
  targetValue: number,
  durationMs: number = 500,
  decimals: number = 0
): number {
  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || isNaN(targetValue) || durationMs <= 0) {
      setDisplayValue(targetValue);
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = 0;
    let animationFrameId: number;

    // Ease-out cubic formula: 1 - pow(1 - t, 3)
    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = easeOutCubic(progress);

      const current = startValue + (targetValue - startValue) * easedProgress;
      setDisplayValue(
        decimals > 0
          ? parseFloat(current.toFixed(decimals))
          : Math.round(current)
      );

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(targetValue);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [targetValue, durationMs, decimals]);

  return displayValue;
}
