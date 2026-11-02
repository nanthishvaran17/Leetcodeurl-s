import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Custom hook that animates placeholder text character-by-character (typewriter effect)
 * smoothly cycling through multiple search hints with zero stutter, zero blank frames,
 * and guaranteed instant visibility on initial mount.
 */
export function useTypewriterPlaceholder(
  customPlaceholders?: string[],
  enabled: boolean = true,
  isPaused: boolean = false
): string {
  const defaultList = useMemo(() => [
    "Search student name...",
    "Search reg no (e.g. 732224CC031)...",
    "Search username...",
    "Search LeetCode handle...",
    "Search department (Cyber Security, IoT, IT)..."
  ], []);

  // Stabilize list across parent re-renders
  const listKey = customPlaceholders ? customPlaceholders.join('|||') : '';
  const list = useMemo(() => {
    return customPlaceholders && customPlaceholders.length > 0 ? customPlaceholders : defaultList;
  }, [listKey, defaultList]);

  // Start with the first full text immediately so the placeholder is NEVER blank
  const [text, setText] = useState(() => list[0] || 'Search name, reg no, username...');
  const textIndexRef = useRef(0);
  const charIndexRef = useRef(list[0]?.length || 22);
  const isDeletingRef = useRef(true);

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
