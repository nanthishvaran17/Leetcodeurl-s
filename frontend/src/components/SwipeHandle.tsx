import React, { useRef, useState } from 'react';

interface SwipeHandleProps {
  onClose: () => void;
  className?: string;
  pillClassName?: string;
  targetRef?: React.RefObject<HTMLElement | null>;
  label?: string;
}

export const SwipeHandle: React.FC<SwipeHandleProps> = ({
  onClose,
  className = '',
  pillClassName = '',
  targetRef,
  label = 'Swipe or tap down to close'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentDeltaYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const [isPressed, setIsPressed] = useState<boolean>(false);

  // Helper to find the sliding drawer/modal card to animate
  const getDrawerElement = (): HTMLElement | null => {
    if (targetRef?.current) return targetRef.current;
    if (!containerRef.current) return null;

    let current: HTMLElement | null = containerRef.current.parentElement;
    let fallbackModal: HTMLElement | null = null;

    while (current && current !== document.body) {
      // 1. Explicit markers for bottom sheet or drawer card
      if (
        current.hasAttribute('data-bottom-sheet') ||
        current.getAttribute('role') === 'document' ||
        current.classList.contains('modal-container-responsive') ||
        current.classList.contains('animate-slide-up-drawer')
      ) {
        return current;
      }

      // 2. Direct child inside a full-screen fixed overlay backdrop
      const parent = current.parentElement;
      if (
        parent &&
        (parent.classList.contains('fixed') || (typeof window !== 'undefined' && window.getComputedStyle(parent).position === 'fixed')) &&
        (parent.classList.contains('inset-0') || parent.getAttribute('data-modal-active') === 'true' || parent.getAttribute('role') === 'dialog') &&
        !current.classList.contains('fixed')
      ) {
        return current;
      }

      // 3. Fallback animated card classes
      if (
        current.classList.contains('animate-slide-up') ||
        current.classList.contains('animate-fade-in-up') ||
        current.classList.contains('animate-modal-content')
      ) {
        fallbackModal = current;
      }

      current = current.parentElement;
    }

    if (fallbackModal) return fallbackModal;

    // Check closest elements, strictly avoiding full-screen fixed overlays
    const closestDialog = containerRef.current.closest<HTMLElement>(
      '[role="document"], [data-bottom-sheet], .modal-container-responsive, [role="dialog"]'
    );
    if (closestDialog) {
      if (closestDialog.classList.contains('fixed') && closestDialog.classList.contains('inset-0')) {
        const innerCard = closestDialog.querySelector<HTMLElement>(':scope > div:not(.fixed):not(.absolute)');
        if (innerCard) return innerCard;
      }
      return closestDialog;
    }

    return containerRef.current.parentElement;
  };

  const smoothClose = () => {
    const drawer = getDrawerElement();
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch (_) {}

    if (drawer) {
      drawer.style.transition = 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease-out';
      drawer.style.transform = 'translateY(100%)';
      drawer.style.opacity = '0';
      setTimeout(() => {
        onClose();
        // Hold translation down until React unmounts so it doesn't snap back into view
        setTimeout(() => {
          if (drawer) {
            drawer.style.transform = '';
            drawer.style.opacity = '';
            drawer.style.transition = '';
          }
        }, 150);
      }, 190);
    } else {
      onClose();
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    startTimeRef.current = Date.now();
    currentDeltaYRef.current = 0;
    isDraggingRef.current = true;
    setIsPressed(true);

    const drawer = getDrawerElement();
    if (drawer) {
      drawer.style.transition = 'none';
      drawer.style.willChange = 'transform, opacity';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingRef.current || startYRef.current === null) return;
    const deltaY = e.touches[0].clientY - startYRef.current;

    // Only allow downward drag
    if (deltaY > 0) {
      if (e.cancelable) e.preventDefault();
      currentDeltaYRef.current = deltaY;

      const drawer = getDrawerElement();
      if (drawer) {
        const translateY = deltaY < 80 ? deltaY : 80 + (deltaY - 80) * 0.7;
        const opacity = Math.max(0.4, 1 - deltaY / 500);
        drawer.style.transform = `translateY(${translateY}px)`;
        drawer.style.opacity = `${opacity}`;
      }
    } else {
      currentDeltaYRef.current = 0;
      const drawer = getDrawerElement();
      if (drawer) {
        drawer.style.transform = 'translateY(0px)';
        drawer.style.opacity = '1';
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPressed(false);

    const deltaY = currentDeltaYRef.current;
    const elapsed = Date.now() - startTimeRef.current;
    const isQuickFlick = elapsed < 280 && deltaY > 20;
    const drawer = getDrawerElement();

    if (drawer) {
      drawer.style.willChange = '';
    }

    if (deltaY > 38 || isQuickFlick) {
      smoothClose();
    } else {
      if (drawer) {
        drawer.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out';
        drawer.style.transform = 'translateY(0px)';
        drawer.style.opacity = '1';
      }
    }

    startYRef.current = null;
    currentDeltaYRef.current = 0;
  };

  // Mouse drag handlers for desktop / mouse testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    currentDeltaYRef.current = 0;
    isDraggingRef.current = true;
    setIsPressed(true);

    const drawer = getDrawerElement();
    if (drawer) {
      drawer.style.transition = 'none';
      drawer.style.willChange = 'transform, opacity';
    }

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingRef.current || startYRef.current === null) return;
      const deltaY = moveEvt.clientY - startYRef.current;
      if (deltaY > 0) {
        currentDeltaYRef.current = deltaY;
        const d = getDrawerElement();
        if (d) {
          const translateY = deltaY < 80 ? deltaY : 80 + (deltaY - 80) * 0.7;
          const opacity = Math.max(0.4, 1 - deltaY / 500);
          d.style.transform = `translateY(${translateY}px)`;
          d.style.opacity = `${opacity}`;
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsPressed(false);

      const deltaY = currentDeltaYRef.current;
      const elapsed = Date.now() - startTimeRef.current;
      const isQuickFlick = elapsed < 280 && deltaY > 20;
      const d = getDrawerElement();

      if (d) {
        d.style.willChange = '';
      }

      if (deltaY > 38 || isQuickFlick) {
        smoothClose();
      } else {
        if (d) {
          d.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out';
          d.style.transform = 'translateY(0px)';
          d.style.opacity = '1';
        }
      }
      startYRef.current = null;
      currentDeltaYRef.current = 0;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentDeltaYRef.current < 12) {
      smoothClose();
    }
  };

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      className={`group w-full py-2 sm:py-2.5 flex justify-center items-center cursor-pointer select-none active:opacity-75 transition-opacity touch-none shrink-0 z-30 ${className}`}
    >
      <div
        className={`w-12 h-1.5 sm:w-14 sm:h-1.5 rounded-full shadow-2xs group-hover:scale-110 active:scale-95 transition-all duration-150 ${
          pillClassName
            ? pillClassName
            : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'
        } ${isPressed ? 'scale-90 opacity-70' : ''}`}
      />
    </div>
  );
};
