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

  const [displayedName, setDisplayedName] = useState<string>('');
  const lastAnimatedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // If no authenticated user or empty name, clear state
    if (!canonicalName || !userIdKey) {
      setDisplayedName('');
      lastAnimatedUserIdRef.current = null;
      return;
    }

    // If already animated for this specific user session, preserve full name without re-triggering animation
    // (Prevents animation from restarting on unrelated re-renders: notifications, AI assistant, live sync, filters, KPI updates)
    if (lastAnimatedUserIdRef.current === userIdKey) {
      setDisplayedName(canonicalName);
      return;
    }

    // New user session or user switch detected: reset & trigger letter-by-letter animation
    lastAnimatedUserIdRef.current = userIdKey;
    setDisplayedName('');

    let charIndex = 0;
    const typingInterval = setInterval(() => {
      charIndex++;
      if (charIndex <= canonicalName.length) {
        setDisplayedName(canonicalName.slice(0, charIndex));
      } else {
        clearInterval(typingInterval);
      }
    }, 45); // Smooth 45ms per character typing animation

    return () => {
      clearInterval(typingInterval);
    };
  }, [userIdKey, canonicalName]);

  return (
    <h1 className={className}>
      {prefix}
      {displayedName ? (
        <>
          , <span className={nameClassName}>{displayedName}</span>
        </>
      ) : canonicalName ? (
        <>
          , <span className={nameClassName}>&nbsp;</span>
        </>
      ) : null}
    </h1>
  );
};
