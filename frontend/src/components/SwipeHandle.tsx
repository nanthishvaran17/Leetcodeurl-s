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
  label = 'Tap or drag down to close'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const currentDeltaYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const [isPressed, setIsPressed] = useState<boolean>(false);

  // Helper to find the drawer/modal element to animate
  const getDrawerElement = (): HTMLElement | null => {
    if (targetRef?.current) return targetRef.current;
    if (!containerRef.current) return null;
    return (
      containerRef.current.closest<HTMLElement>(
        '.modal-container-responsive, [role="dialog"], .h-\\[92vh\\], .h-\\[100dvh\\], .shadow-2xl'
      ) || containerRef.current.parentElement
    );
  };

  const smoothClose = () => {
    const drawer = getDrawerElement();
    if (drawer) {
      drawer.style.transition = 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.22s ease-out';
      drawer.style.transform = 'translateY(100%)';
      drawer.style.opacity = '0';
      setTimeout(() => {
        onClose();
      }, 200);
    } else {
      onClose();
    }
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    currentDeltaYRef.current = 0;
    isDraggingRef.current = true;
    setIsPressed(true);

    const drawer = getDrawerElement();
    if (drawer) {
      drawer.style.transition = 'none';
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
        drawer.style.transform = `translateY(${translateY}px)`;
      }
    } else {
      currentDeltaYRef.current = 0;
      const drawer = getDrawerElement();
      if (drawer) drawer.style.transform = 'translateY(0px)';
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPressed(false);

    const deltaY = currentDeltaYRef.current;
    const drawer = getDrawerElement();

    if (deltaY > 40) {
      smoothClose();
    } else {
      if (drawer) {
        drawer.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
        drawer.style.transform = 'translateY(0px)';
      }
    }

    startYRef.current = null;
    currentDeltaYRef.current = 0;
  };

  // Mouse drag handlers for desktop/mouse testing
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    startYRef.current = e.clientY;
    currentDeltaYRef.current = 0;
    isDraggingRef.current = true;
    setIsPressed(true);

    const drawer = getDrawerElement();
    if (drawer) {
      drawer.style.transition = 'none';
    }

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingRef.current || startYRef.current === null) return;
      const deltaY = moveEvt.clientY - startYRef.current;
      if (deltaY > 0) {
        currentDeltaYRef.current = deltaY;
        const d = getDrawerElement();
        if (d) {
          const translateY = deltaY < 80 ? deltaY : 80 + (deltaY - 80) * 0.7;
          d.style.transform = `translateY(${translateY}px)`;
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
      if (deltaY > 40) {
        smoothClose();
      } else {
        const d = getDrawerElement();
        if (d) {
          d.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
          d.style.transform = 'translateY(0px)';
        }
      }
      startYRef.current = null;
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
      onMouseDown={handleMouseDown}
      className={`group w-full py-2.5 sm:py-3 flex justify-center items-center cursor-pointer select-none active:opacity-75 transition-opacity touch-none shrink-0 z-30 ${className}`}
    >
      <div
        className={`w-12 h-1.5 sm:w-14 sm:h-1.5 rounded-full shadow-2xs group-hover:scale-110 active:scale-95 transition-all duration-150 ${
          pillClassName
            ? pillClassName
            : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'
        } ${isPressed ? 'scale-95 opacity-80' : ''}`}
      />
    </div>
  );
};
