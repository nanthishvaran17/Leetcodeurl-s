import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export const BackToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const shouldShow = window.scrollY > 350;
          if (visibleRef.current !== shouldShow) {
            visibleRef.current = shouldShow;
            setIsVisible(shouldShow);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    triggerHaptic('light');
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          initial={{ opacity: 0, scale: 0.7, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7, y: 16 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-6 right-2 sm:right-6 z-30 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/90 dark:bg-navy-900/90 backdrop-blur-md border border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 shadow-md hover:shadow-xl active:scale-90 transition-all cursor-pointer flex items-center justify-center group touch-manipulation ring-1 ring-black/5 dark:ring-white/10"
          title="Scroll back to top"
          aria-label="Scroll back to top"
        >
          <ArrowUp className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-y-0.5 stroke-[2.25]" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};
