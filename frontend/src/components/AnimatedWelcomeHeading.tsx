import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface AnimatedWelcomeHeadingProps {
  className?: string;
  nameClassName?: string;
  prefix?: string;
}

export const AnimatedWelcomeHeading: React.FC<AnimatedWelcomeHeadingProps> = ({
  className = "",
  nameClassName = "text-brand-300",
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

  // Calculate dynamic responsive font size scaling based on fullText character length.
  // Guarantees very long names scale down gracefully on mobile/tablet so the heading stays on a single line!
  const textLen = fullText.length;
  let dynamicFontClasses = "text-base sm:text-2xl md:text-3xl lg:text-4xl";
  if (textLen > 40) {
    dynamicFontClasses = "text-[11px] xs:text-xs sm:text-base md:text-lg lg:text-xl";
  } else if (textLen > 28) {
    dynamicFontClasses = "text-xs xs:text-sm sm:text-lg md:text-xl lg:text-2xl";
  } else if (textLen > 20) {
    dynamicFontClasses = "text-sm xs:text-base sm:text-xl md:text-2xl lg:text-3xl";
  }

  // Clean up any break-words, break-all, or whitespace-pre overrides that could cause 2-line wraps
  const safeClassName = (className || '')
    .replace(/\bbreak-words\b/g, '')
    .replace(/\bbreak-all\b/g, '')
    .replace(/\bwhitespace-\S+\b/g, '')
    .trim();

  // Check if passed className already includes an explicit Tailwind text size
  const hasExplicitFontSize = /\btext-(xs|sm|base|lg|[0-9]+xl|\[[^\]]+\])\b/.test(safeClassName);
  const finalFontClasses = hasExplicitFontSize ? safeClassName : `${dynamicFontClasses} ${safeClassName}`;

  const safeNameClassName = (nameClassName || '')
    .replace(/\bbreak-words\b/g, '')
    .replace(/\bbreak-all\b/g, '')
    .replace(/\bwhitespace-\S+\b/g, '')
    .trim();

  return (
    <h1
      className={`whitespace-nowrap overflow-hidden text-ellipsis max-w-full block leading-tight font-black uppercase tracking-tight ${finalFontClasses}`}
      title={fullText}
    >
      <span>{revealedPrefix}</span>
      {hasCommaOnly && <span>,</span>}
      {hasCommaAndSpace && <span>, </span>}
      {canonicalName && (
        <span className={`inline-block ${safeNameClassName}`}>{revealedName}</span>
      )}
      {isTyping && (
        <span className="inline-block w-[2px] sm:w-[3px] h-[0.85em] ml-1 bg-brand-400 animate-pulse rounded-xs align-middle shadow-[0_0_10px_rgba(129,140,248,0.9)]" />
      )}
    </h1>
  );
};

