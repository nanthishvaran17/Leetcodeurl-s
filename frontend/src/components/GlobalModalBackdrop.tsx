import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';

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
  const scrollPositionRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      // Lock body scroll
      document.body.style.overflow = 'hidden';
      
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onClose) {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Render outside of standard hierarchy via Portal directly to body
  return createPortal(
    <div 
      className={twMerge(
        "fixed inset-0 bg-slate-950/65 dark:bg-navy-950/80 backdrop-blur-md transition-all select-none",
        className
      )}
      style={{ zIndex }}
      onClick={(e) => {
        // Only trigger close if they clicked the exact backdrop overlay, not the modal children
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      aria-hidden="true"
    >
      {children}
    </div>,
    document.body
  );
};
