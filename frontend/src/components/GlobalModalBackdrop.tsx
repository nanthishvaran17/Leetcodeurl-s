import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';
import { useEscapeKey } from '../hooks/useEscapeKey';

interface GlobalModalBackdropProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  className?: string; // Additional classes for the backdrop itself (e.g. flex alignments, padding)
  zIndex?: number; // Override z-index if needed (default 100000)
}

export const GlobalModalBackdrop: React.FC<GlobalModalBackdropProps> = ({ 
  children, 
  isOpen, 
  onClose,
  className,
  zIndex = 100000 
}) => {
  const isMouseDownOnBackdrop = useRef(false);

  // Bind to universal priority LIFO escape stack
  useEscapeKey(onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Render outside of standard hierarchy via Portal directly to body
  return createPortal(
    <div 
      className={twMerge(
        "fixed inset-0 bg-slate-950/65 dark:bg-navy-950/80 backdrop-blur-md transition-all select-auto",
        className
      )}
      style={{ zIndex }}
      onMouseDown={(e) => {
        // Track whether mousedown originated strictly on the backdrop overlay itself
        isMouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Only trigger close if BOTH mousedown and mouseup originated directly on the backdrop overlay.
        // This strictly prevents accidental modal closing when dragging/selecting text or copying inside modals!
        if (isMouseDownOnBackdrop.current && e.target === e.currentTarget && onClose) {
          onClose();
        }
        isMouseDownOnBackdrop.current = false;
      }}
      aria-modal="true"
      role="dialog"
    >
      {children}
    </div>,
    document.body
  );
};
