import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface AnimatedWelcomeHeadingProps {
  className?: string;
  nameClassName?: string;
  prefix?: string;
}

export const AnimatedWelcomeHeading: React.FC<AnimatedWelcomeHeadingProps> = ({
  className = "text-xl sm:text-3xl lg:text-4xl font-display font-extrabold tracking-tight text-white uppercase leading-tight break-words",
  nameClassName = "text-brand-300 break-words",
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

  return (
    <h1 className={className}>
      <span>{revealedPrefix}</span>
      {hasCommaOnly && <span>,</span>}
      {hasCommaAndSpace && <span>, </span>}
      {canonicalName && (
        <span className={nameClassName}>{revealedName}</span>
      )}
      {isTyping && (
        <span className="inline-block w-2 sm:w-2.5 h-6 sm:h-8 ml-1 bg-brand-400 animate-pulse rounded-xs align-middle shadow-[0_0_10px_rgba(129,140,248,0.9)]" />
      )}
    </h1>
  );
};

