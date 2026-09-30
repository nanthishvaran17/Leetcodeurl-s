import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface AnimatedWelcomeHeadingProps {
  className?: string;
  nameClassName?: string;
  prefix?: string;
}

export const AnimatedWelcomeHeading: React.FC<AnimatedWelcomeHeadingProps> = ({
  className = "",
  nameClassName = "text-indigo-300 font-extrabold",
  prefix = "WELCOME BACK"
}) => {
  const { user } = useAuth();

  // Resolve authentic canonical display name strictly from current logged-in user
  const rawName = (
    user?.full_name ||
    user?.name ||
    user?.displayName ||
    user?.username ||
    (user?.email ? user.email.split('@')[0] : '')
  ).trim();

  // Normalize to uppercase matching heading style
  const canonicalName = rawName ? rawName.toUpperCase() : '';

  // Unique session key for current user (resets on user switch or logout)
  const userIdKey = user?.uid || (user?.id ? `id_${user.id}` : null) || (user?.email ? `email_${user.email}` : null) || (canonicalName ? `name_${canonicalName}` : null);

  const fullText = canonicalName ? `${prefix}, ${canonicalName}` : prefix;
  const prefixLength = prefix.length;
  const prefixAndCommaLength = prefixLength + 2; // length of `${prefix}, `

  const [displayedCount, setDisplayedCount] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(true);
  const lastAnimatedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // If no authenticated user or empty session yet, wait
    if (!userIdKey && !canonicalName) {
      setDisplayedCount(0);
      setIsTyping(true);
      lastAnimatedUserIdRef.current = null;
      return;
    }

    // If already animated for this specific user session, preserve full text
    if (lastAnimatedUserIdRef.current === userIdKey) {
      setDisplayedCount(fullText.length);
      setIsTyping(false);
      return;
    }

    // New user session detected: trigger letter-by-letter typewriter animation
    lastAnimatedUserIdRef.current = userIdKey;
    setDisplayedCount(0);
    setIsTyping(true);

    let count = 0;
    const typingInterval = setInterval(() => {
      count++;
      if (count <= fullText.length) {
        setDisplayedCount(count);
      } else {
        clearInterval(typingInterval);
        setTimeout(() => setIsTyping(false), 700); // Hide caret after typing finishes
      }
    }, 35); // 35ms per character typing animation

    return () => {
      clearInterval(typingInterval);
    };
  }, [userIdKey, fullText, canonicalName]);

  // Revealed slices
  const revealedPrefix = fullText.slice(0, Math.min(displayedCount, prefixLength));
  const hasCommaOnly = displayedCount === prefixLength + 1;
  const hasCommaAndSpace = displayedCount >= prefixAndCommaLength;

  const revealedName = displayedCount > prefixAndCommaLength
    ? canonicalName.slice(0, displayedCount - prefixAndCommaLength)
    : '';

  // Responsive font sizing based on canonicalName character length for standalone line 2
  const nameLen = canonicalName.length;
  let nameFontClasses = "text-xl sm:text-2xl md:text-3xl lg:text-4xl";
  if (nameLen > 28) {
    nameFontClasses = "text-xs xs:text-sm sm:text-base md:text-lg lg:text-xl";
  } else if (nameLen > 20) {
    nameFontClasses = "text-sm xs:text-base sm:text-xl md:text-2xl lg:text-3xl";
  } else if (nameLen > 14) {
    nameFontClasses = "text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl";
  }

  const safeNameClassName = (nameClassName || '')
    .replace(/\bbreak-words\b/g, '')
    .replace(/\bbreak-all\b/g, '')
    .replace(/\bwhitespace-\S+\b/g, '')
    .trim();

  return (
    <div className={`space-y-1.5 sm:space-y-2 max-w-full block my-2 ${className}`}>
      {/* Line 1: WELCOME BACK, */}
      <div className="text-xs sm:text-sm font-extrabold tracking-widest uppercase text-slate-300/90 flex items-center gap-0.5">
        <span>{revealedPrefix}</span>
        {(hasCommaOnly || hasCommaAndSpace) && <span>,</span>}
        {isTyping && displayedCount <= prefixAndCommaLength && (
          <span className="inline-block w-[2px] h-[1em] ml-1 bg-brand-400 animate-pulse rounded-xs align-middle" />
        )}
      </div>

      {/* Line 2: STAFF / USER NAME (Placed on next line with clear spacing, single line, no cut-off) */}
      {canonicalName && (
        <h1
          className={`font-black uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-full block leading-tight pt-0.5 ${nameFontClasses} ${safeNameClassName}`}
          title={canonicalName}
        >
          <span>{revealedName}</span>
          {isTyping && displayedCount > prefixAndCommaLength && (
            <span className="inline-block w-[2px] sm:w-[3px] h-[0.85em] ml-1 bg-brand-400 animate-pulse rounded-xs align-middle shadow-[0_0_10px_rgba(129,140,248,0.9)]" />
          )}
        </h1>
      )}
    </div>
  );
};
