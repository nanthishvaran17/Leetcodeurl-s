import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Normalizes a placeholder string to fit cleanly on mobile screens
 * so that register numbers, hints, and instructions are NEVER cut off.
 */
export function toMobilePlaceholder(text: string): string {
  if (!text) return text;
  if (text.length <= 22) return text;

  const lower = text.toLowerCase();
  if (lower.includes('732224cc031') || lower.includes('reg no') || lower.includes('reg. no')) {
    return 'Search reg no...';
  }
  if (lower.includes('department') || lower.includes('cyber')) {
    return 'Search department...';
  }
  if (lower.includes('student name') || lower.includes('by name')) {
    return 'Search name...';
  }
  if (lower.includes('leetcode handle') || lower.includes('username')) {
    return 'Search username...';
  }
  if (lower.includes('command') || lower.includes('action')) {
    return 'Search commands...';
  }
  if (lower.includes('name, reg no') || lower.includes('name or reg')) {
    return 'Search name, reg no...';
  }

  return text.length > 22 ? text.slice(0, 20).trim() + '...' : text;
}

/**
 * Custom hook that animates placeholder text character-by-character (typewriter effect)
 * smoothly cycling through multiple search hints with zero stutter, zero blank frames,
 * and guaranteed instant visibility on initial mount.
 * Automatically adapts on mobile screens so text NEVER cuts off.
 */
export function useTypewriterPlaceholder(
  customPlaceholders?: string[],
  enabled: boolean = true,
  isPaused: boolean = false
): string {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile((prev) => (prev !== mobile ? mobile : prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const desktopDefaultList = useMemo(() => [
    "Search student name...",
    "Search reg no (e.g. 732224CC031)...",
    "Search username...",
    "Search LeetCode handle...",
    "Search department (Cyber Security, IoT, IT)..."
  ], []);

  const mobileDefaultList = useMemo(() => [
    "Search reg no...",
    "Search student name...",
    "Search username...",
    "Search handle...",
    "Search department..."
  ], []);

  const defaultList = isMobile ? mobileDefaultList : desktopDefaultList;

  // Stabilize list across parent re-renders and format for mobile if needed
  const listKey = customPlaceholders ? customPlaceholders.join('|||') + (isMobile ? '-m' : '-d') : (isMobile ? 'def-m' : 'def-d');
  const list = useMemo(() => {
    if (customPlaceholders && customPlaceholders.length > 0) {
      if (isMobile) {
        return customPlaceholders.map(toMobilePlaceholder);
      }
      return customPlaceholders;
    }
    return defaultList;
  }, [listKey, customPlaceholders, isMobile, defaultList]);

  // Start with the first full text immediately so the placeholder is NEVER blank
  const [text, setText] = useState(() => list[0] || (isMobile ? 'Search reg no...' : 'Search name, reg no, username...'));
  const textIndexRef = useRef(0);
  const charIndexRef = useRef(list[0]?.length || 16);
  const isDeletingRef = useRef(true);

  // If list changes (e.g. on resize from desktop to mobile), reset textIndex and clamp
  useEffect(() => {
    if (textIndexRef.current >= list.length) {
      textIndexRef.current = 0;
    }
    const currentFullText = list[textIndexRef.current % list.length];
    if (currentFullText && charIndexRef.current > currentFullText.length) {
      charIndexRef.current = currentFullText.length;
      setText(currentFullText);
    }
  }, [list]);

  useEffect(() => {
    if (!enabled || isPaused || list.length === 0) return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      const fullText = list[textIndexRef.current % list.length];

      if (!isDeletingRef.current) {
        // Typing forward: letter by letter
        charIndexRef.current++;
        const nextSlice = fullText.slice(0, charIndexRef.current);
        setText(nextSlice);

        if (charIndexRef.current >= fullText.length) {
          // Finished typing word, hold it so user can read comfortably
          isDeletingRef.current = true;
          timer = setTimeout(tick, 2200);
          return;
        }
        timer = setTimeout(tick, 60);
      } else {
        // Backspacing: letter by letter
        charIndexRef.current--;
        const nextSlice = fullText.slice(0, charIndexRef.current);
        setText(nextSlice.length > 0 ? nextSlice : '');

        if (charIndexRef.current <= 0) {
          // Finished deleting, move to next sentence
          isDeletingRef.current = false;
          textIndexRef.current = (textIndexRef.current + 1) % list.length;
          charIndexRef.current = 0;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 28);
      }
    };

    // Hold the initial full text for 2.2 seconds before starting the first deletion
    timer = setTimeout(tick, 2200);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [enabled, isPaused, listKey, list]);

  return text || list[textIndexRef.current % list.length] || list[0] || 'Search name, reg no, username...';
}
